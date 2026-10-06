import * as THREE from 'three';
import { Character } from './Character.js';
import { createGlider } from './Glider.js';
import { CLASSES } from '../config.js';
import { damp, dampAngle } from '../engine/math.js';

// Un autre héros, piloté par le réseau : interpolation + animations déduites de l'état.
export class RemotePlayer {
  constructor(game, id, presence) {
    this.game = game;
    this.id = id;
    this.classId = CLASSES[presence.c] ? presence.c : 'knight';
    const cls = CLASSES[this.classId];
    this.char = new Character(game.assets, cls.model, { show: cls.weapons.show });
    this.object = this.char.object;
    this.position = this.object.position;
    this.glider = createGlider(cls.color, '#2b2350');
    this.object.add(this.glider);
    this.velocity = new THREE.Vector3();
    this.moveDir = new THREE.Vector3();
    this.facing = 0;
    this.buf = [];
    this.name = presence.n || 'Héros';
    this.level = presence.l || 1;
    this.dead = false;
    this.stealth = false;
    this.gliding = false;
    this.hpPct = 1;
    this.bubble = ''; this.bubbleT = 0;
    this.first = true;
    this.gOpen = 0;
    game.scene.add(this.object);
    this.apply(presence, performance.now());
  }

  apply(pr, now) {
    if (pr.n) this.name = String(pr.n).slice(0, 16);
    if (pr.l) this.level = pr.l;
    this.title = pr.ti ? String(pr.ti).slice(0, 40) : '';
    if (Array.isArray(pr.p) && pr.p.length === 3) {
      const x = pr.p[0] / 10, y = pr.p[1] / 10, z = pr.p[2] / 10;
      const last = this.buf[this.buf.length - 1];
      if (!last || last.x !== x || last.y !== y || last.z !== z || last.r !== pr.r) this.buf.push({ t: now, x, y, z, r: (pr.r || 0) / 100 });
      if (this.buf.length > 10) this.buf.shift();
      if (this.first) { this.position.set(x, y, z); this.facing = (pr.r || 0) / 100; this.first = false; }
    }
    const s = pr.s | 0;
    this.gliding = !!(s & 1);
    const dead = !!(s & 2);
    this.stealth = !!(s & 4);
    this.onGround = !!(s & 8);
    this.sprint = !!(s & 16);
    if (dead && !this.dead) { this.char.stopAction(0); this.char.playAction('Death_A', { full: true, hold: true }); }
    if (!dead && this.dead) { this.char.stopAction(0); this.game.fx.beam(this.position, '#ffe3a3', { height: 24, radius: 1.6, life: 1.2 }); }
    this.dead = dead;
    this.hpPct = (pr.hp ?? 100) / 100;
  }

  update(dt, now) {
    // interpolation ~120 ms dans le passé
    const buf = this.buf;
    const px = this.position.x, pz = this.position.z;
    if (buf.length) {
      const rt = now - 120;
      let a = buf[0], b = buf[buf.length - 1];
      for (let i = 0; i < buf.length - 1; i++) if (buf[i].t <= rt && buf[i + 1].t >= rt) { a = buf[i]; b = buf[i + 1]; break; }
      const f = b.t > a.t ? Math.min(1, Math.max(0, (rt - a.t) / (b.t - a.t))) : 1;
      const tx = a.x + (b.x - a.x) * f, ty = a.y + (b.y - a.y) * f, tz = a.z + (b.z - a.z) * f;
      // gros écart (téléportation) : on saute
      if (Math.hypot(tx - this.position.x, tz - this.position.z) > 25) this.position.set(tx, ty, tz);
      this.position.x = damp(this.position.x, tx, 18, dt);
      this.position.y = damp(this.position.y, ty, 18, dt);
      this.position.z = damp(this.position.z, tz, 18, dt);
      this.facing = dampAngle(this.facing, b.r, 14, dt);
    }
    this.velocity.set((this.position.x - px) / Math.max(dt, 1e-4), 0, (this.position.z - pz) / Math.max(dt, 1e-4));
    const hs = Math.hypot(this.velocity.x, this.velocity.z);
    this.object.rotation.y = this.facing;
    this.object.visible = !this.stealth || Math.sin(now / 90) > 0.6;
    if (!this.dead) {
      let loco;
      const cls = CLASSES[this.classId];
      if (this.gliding || (!this.onGround && hs > 0.1 && !this.onGroundRecently())) loco = 'Jump_Idle';
      else if (hs < 0.4) loco = cls.weapons.idle;
      else if (hs < 3.6) loco = 'Walking_A';
      else loco = this.sprint ? 'Running_B' : 'Running_A';
      const ts = loco === 'Walking_A' ? Math.min(1.6, Math.max(0.5, hs / 2.9)) : loco.startsWith('Running') ? Math.min(1.6, Math.max(0.6, hs / 6.6)) : 1;
      this.char.setLocomotion(loco, ts);
    }
    this.gOpen = damp(this.gOpen, this.gliding ? 1 : 0, 9, dt);
    this.glider.visible = this.gOpen > 0.02;
    this.glider.scale.set(this.gOpen, 0.3 + this.gOpen * 0.7, 1);
    if (this.bubbleT > 0) { this.bubbleT -= dt; if (this.bubbleT <= 0) this.bubble = ''; }
    this.char.update(dt);
  }

  onGroundRecently() { return this.onGround; }

  say(text) { this.bubble = text; this.bubbleT = 7; }

  faceTowards(x, z) { this.facing = Math.atan2(x - this.position.x, z - this.position.z); }

  plate(ui) {
    ui.setPlate({ id: 'p:' + this.id, position: this.position, height: 2.6, name: `${this.name} · ${this.level}`, kind: 'player', hpPct: this.hpPct, title: this.title || CLASSES[this.classId].name, bubble: this.bubble, hidden: this.stealth });
  }

  dispose() { this.char.dispose(); this.object.removeFromParent(); }
}
