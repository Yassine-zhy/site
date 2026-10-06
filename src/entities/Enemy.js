import * as THREE from 'three';
import { Character } from './Character.js';
import { ENEMIES } from '../config.js';
import { damp, dampAngle } from '../engine/math.js';

export const ENEMY_TYPES = ['minion', 'warrior', 'rogue', 'mage', 'boss'];
export const STATES = ['spawn', 'idle', 'wander', 'chase', 'attack', 'return', 'dead', 'cast', 'stagger'];

// Un squelette d'Aetheria. La logique (IA) tourne chez l'hôte ; les autres clients
// reçoivent un état compact et interpolent.
export class Enemy {
  constructor(game, id, type, level, x, z, { elite = false, home = null } = {}) {
    this.game = game;
    this.id = id;
    this.type = type;
    this.def = ENEMIES[type];
    this.level = level;
    this.elite = elite;
    // le boss a déjà des valeurs de base élevées : sa progression par niveau est plus douce
    const m = this.def.boss ? 1 + 0.15 * (level - 1) : 1 + 0.35 * (level - 1);
    this.maxHp = Math.round(this.def.hp * m * (elite ? 2.4 : 1));
    this.hp = this.maxHp;
    this.atk = this.def.atk * (1 + (this.def.boss ? 0.12 : 0.2) * (level - 1)) * (elite ? 1.35 : 1);
    this.armor = this.def.def * (1 + 0.15 * (level - 1));
    this.xp = Math.round(this.def.xp * (1 + 0.28 * (level - 1)) * (elite ? 2.5 : 1));
    const scale = (this.def.scale || 1) * (elite ? 1.22 : 1);
    const attach = [];
    if (this.def.weapon) attach.push([this.def.weapon[0], this.def.weapon[1].replace('.', ''), 1]);
    if (this.def.shield) attach.push([this.def.shield[0], this.def.shield[1].replace('.', ''), 1]);
    this.char = new Character(game.assets, this.def.model, { scale, attach, tint: elite ? '#ffe2a8' : null });
    this.object = this.char.object;
    this.position = this.object.position;
    const y = game.world.terrain.heightAt(x, z) ?? 0;
    this.position.set(x, y, z);
    this.home = home || { x, z };
    this.rot = Math.random() * Math.PI * 2;
    this.object.rotation.y = this.rot;
    this.radius = 0.6 * scale;
    this.height = 2.5 * scale;
    this.state = 'spawn';
    this.stateT = 0;
    this.speed = 0;
    this.vel = new THREE.Vector3();
    this.target = null;
    this.threat = new Map();
    this.attackCd = 1 + Math.random();
    this.wanderT = 2 + Math.random() * 4;
    this.dest = null;
    this.atkCount = 0; this.hitCount = 0;
    this.lastAtk = 0; this.lastHit = 0;
    this.deadT = 0;
    this.slow = 0; this.stun = 0;
    this.lastDamagers = new Map();
    // réplication
    this.net = { x, z, rot: this.rot, y, t: 0 };
    this.snapBuf = [];
    this.displayHp = 1;
    this.spawnAnim();
  }

  get alive() { return this.state !== 'dead'; }
  get hpPct() { return this.hp / this.maxHp; }

  spawnAnim() {
    if (this.def.boss) { this.char.playAction('Spawn_Air', { full: true, timeScale: 0.8, hold: true }); }
    else this.char.playAction('Spawn_Ground_Skeletons', { full: true, timeScale: 1.7, hold: true });
    this.char.setLocomotion('Idle');
  }

  setState(s) { if (this.state !== s) { this.state = s; this.stateT = 0; } }

  // ---- visuel commun (hôte et clients)
  updateVisual(dt, moving) {
    const def = this.def;
    if (this.state === 'dead') {
      this.deadT += dt;
      if (this.deadT > 2.6) {
        const f = Math.min(1, (this.deadT - 2.6) / 1.4);
        this.char.setOpacity(1 - f);
        this.object.position.y -= dt * 0.6;
      }
      this.char.update(dt);
      return;
    }
    if (this.state === 'spawn') { this.char.update(dt); return; }
    let loco;
    if (this.stun > 0) loco = 'Idle';
    else if (moving > 3.2) loco = def.run;
    else if (moving > 0.4) loco = def.walk;
    else loco = this.target ? 'Idle_Combat' : 'Idle';
    const ts = loco === def.run ? Math.min(1.5, moving / 6) : loco === def.walk ? Math.max(0.6, moving / 2.4) : 1;
    this.char.setLocomotion(loco, ts);
    this.char.update(dt);
    this.displayHp = damp(this.displayHp, this.hpPct, 10, dt);
  }

  playAttack() {
    const anims = this.def.attack;
    const a = anims[this.atkCount % anims.length];
    this.atkCount++;
    this.char.playAction(a, { full: this.def.boss || !!this.def.caster, timeScale: this.def.boss ? 0.9 : 1.15 });
    return a;
  }

  playHit() {
    if (this.char.oneShot || this.def.boss) return;
    this.char.playAction(Math.random() < 0.5 ? 'Hit_A' : 'Hit_B', { timeScale: 1.6 });
  }

  die() {
    this.setState('dead');
    this.hp = 0;
    this.char.stopAction(0);
    this.char.playAction(this.def.boss ? 'Death_A' : 'Death_C_Skeletons', { full: true, timeScale: 1.1, hold: true });
  }

  // ---- client : interpolation vers l'état reçu
  applyNet(s, now) {
    this.snapBuf.push({ t: now, x: s.x, z: s.z, rot: s.rot });
    if (this.snapBuf.length > 8) this.snapBuf.shift();
    const prevHp = this.hp;
    this.hp = Math.round(s.hp * this.maxHp);
    if (s.state === 'dead' && this.state !== 'dead') this.die();
    else if (s.state !== 'dead') {
      if (this.state === 'spawn' && s.state !== 'spawn') this.char.stopAction(0.3);
      this.state = s.state;
    }
    if (s.atk !== this.lastAtk) { this.lastAtk = s.atk; if (this.state !== 'dead') this.playAttack(); }
    if (s.hit !== this.lastHit) { this.lastHit = s.hit; if (this.state !== 'dead' && this.hp < prevHp) this.playHit(); }
    this.targetPeer = s.tgt;
  }

  interpolate(dt, now) {
    const buf = this.snapBuf;
    if (!buf.length) return 0;
    const renderT = now - 140;
    let a = buf[0], b = buf[buf.length - 1];
    for (let i = 0; i < buf.length - 1; i++) if (buf[i].t <= renderT && buf[i + 1].t >= renderT) { a = buf[i]; b = buf[i + 1]; break; }
    const span = Math.max(1, b.t - a.t);
    const f = Math.min(1, Math.max(0, (renderT - a.t) / span));
    const x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f;
    const px = this.position.x, pz = this.position.z;
    this.position.x = damp(px, x, 16, dt); this.position.z = damp(pz, z, 16, dt);
    const g = this.game.world.terrain.heightAt(this.position.x, this.position.z);
    if (g !== null && this.state !== 'dead') this.position.y = damp(this.position.y, g, 12, dt);
    this.rot = dampAngle(this.rot, b.rot, 10, dt);
    this.object.rotation.y = this.rot;
    return Math.hypot(this.position.x - px, this.position.z - pz) / Math.max(dt, 1e-4);
  }

  dispose() { this.char.dispose(); }
}
