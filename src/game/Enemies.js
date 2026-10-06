import * as THREE from 'three';
import { Enemy, ENEMY_TYPES, STATES } from '../entities/Enemy.js';
import { SPAWN_ZONES, ENEMIES } from '../config.js';
import { angleDiff, dampAngle, rand } from '../engine/math.js';
import { computeDamage } from './Combat.js';

const _v = new THREE.Vector3();

// Gestion des squelettes : apparition, IA (chez l'hôte), réplication réseau.
export class Enemies {
  constructor(game) {
    this.game = game;
    this.map = new Map();
    this.isHost = true;
    this.nextId = 1;
    this.zones = SPAWN_ZONES.map((z) => ({ ...z, timer: rand(1, 4), ids: new Set(), idle: 0 }));
    this.idPrefix = Math.random().toString(36).slice(2, 6);
    this.pendingHits = [];
    this.killEvents = [];
    this.fxEvents = [];
    this.fxSeq = 0;
  }

  get list() { return [...this.map.values()]; }
  hittable() { const r = []; for (const e of this.map.values()) if (e.alive && e.state !== 'spawn') r.push(e); return r; }

  spawn(type, level, x, z, opts = {}) {
    const id = opts.id || (this.idPrefix + (this.nextId++).toString(36));
    const e = new Enemy(this.game, id, type, level, x, z, opts);
    this.map.set(id, e);
    this.game.scene.add(e.object);
    if (!opts.silent) {
      const p = e.position;
      this.game.fx.dust(p, { count: 18, color: '#5d4b3c', size: 1.6, speed: 2.5 });
      this.game.fx.burst({ x: p.x, y: p.y + 0.3, z: p.z }, '#9a7cff', { count: 16, speed: 3, size: 0.35, life: 0.9, gravity: -1, up: 2 });
      this.game.audio?.play('rise', p);
    }
    return e;
  }

  remove(id) {
    const e = this.map.get(id);
    if (!e) return;
    e.dispose();
    this.map.delete(id);
    for (const z of this.zones) z.ids.delete(id);
    if (this.game.target === e) this.game.target = null;
  }

  // ----------------------------------------------------------------------------- HÔTE
  hostSpawning(dt) {
    const g = this.game;
    const players = g.playerTargets();
    const night = g.world.sky.state.night;
    for (const z of this.zones) {
      let nearest = Infinity;
      for (const p of players) nearest = Math.min(nearest, Math.hypot(p.position.x - z.x, p.position.z - z.z));
      const active = nearest < z.radius + 120;
      // nettoyage des zones désertées
      if (!active) {
        z.idle += dt;
        if (z.idle > 25) for (const id of [...z.ids]) { const e = this.map.get(id); if (e && !e.target) this.remove(id); }
        continue;
      }
      z.idle = 0;
      const cor = g.world.maps.corruptionAt(z.x, z.z);
      const density = (0.25 + 0.75 * cor) * (1 + night * 0.4);
      const desired = Math.max(1, Math.round(z.max * density));
      for (const id of [...z.ids]) if (!this.map.has(id)) z.ids.delete(id);
      const alive = [...z.ids].filter((id) => this.map.get(id)?.alive).length;
      if (alive >= desired) continue;
      z.timer -= dt;
      if (z.timer > 0) continue;
      z.timer = rand(5, 10) / (1 + night * 0.5);
      // position : parfois en embuscade près d'un joueur
      let x, zz, ok = false;
      for (let k = 0; k < 12 && !ok; k++) {
        const ambush = Math.random() < 0.3 && nearest < z.radius + 10;
        if (ambush) {
          const p = players.reduce((a, b) => (Math.hypot(a.position.x - z.x, a.position.z - z.z) < Math.hypot(b.position.x - z.x, b.position.z - z.z) ? a : b));
          const a = Math.random() * Math.PI * 2, r = rand(9, 16);
          x = p.position.x + Math.cos(a) * r; zz = p.position.z + Math.sin(a) * r;
          if (Math.hypot(x - z.x, zz - z.z) > z.radius * 1.2) continue;
        } else {
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * z.radius;
          x = z.x + Math.cos(a) * r; zz = z.z + Math.sin(a) * r;
        }
        if (g.world.terrain.heightAt(x, zz) === null) continue;
        if (g.world.terrain.slopeAt(x, zz) > 0.7) continue;
        if (players.some((p) => Math.hypot(p.position.x - x, p.position.z - zz) < 7)) continue;
        if (Math.hypot(x, zz) < 62) continue; // jamais dans le village
        ok = true;
      }
      if (!ok) continue;
      const type = z.types[Math.floor(Math.random() * z.types.length)];
      const lvl = Math.floor(rand(z.level[0], z.level[1] + 0.99)) + (night > 0.5 ? 1 : 0);
      const elite = Math.random() < 0.05 + night * 0.06;
      const e = this.spawn(type, lvl, x, zz, { elite, home: { x: z.x, z: z.z } });
      e.zone = z.id;
      z.ids.add(e.id);
    }
  }

  addThreat(e, id, amount) { e.threat.set(id, (e.threat.get(id) || 0) + amount); }

  chooseTarget(e, players) {
    let best = null, bestT = -1;
    for (const p of players) {
      if (!p.alive || p.stealth) continue;
      const d = Math.hypot(p.position.x - e.position.x, p.position.z - e.position.z);
      if (d > 60) { e.threat.delete(p.id); continue; }
      const t = (e.threat.get(p.id) || 0) + (d < 14 + (e.elite ? 4 : 0) ? 30 - d : 0) * (p.threatMul || 1);
      if (t > bestT && (e.threat.get(p.id) || d < 14 + (e.elite ? 4 : 0) + e.level * 0.3)) { bestT = t; best = p; }
    }
    return best;
  }

  moveTowards(e, tx, tz, speed, dt) {
    const dx = tx - e.position.x, dz = tz - e.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return 0;
    const step = Math.min(d, speed * dt);
    const nx = e.position.x + dx / d * step, nz = e.position.z + dz / d * step;
    const terrain = this.game.world.terrain;
    const gy = terrain.groundBelow(nx, e.position.y + 1.5, nz);
    if (gy === null || gy < e.position.y - 4) return 0; // ne tombe pas de l'île
    e.position.x = nx; e.position.z = nz;
    this.game.world.colliders.resolve(e.position, e.radius, e.position.y);
    const g2 = terrain.groundBelow(e.position.x, e.position.y + 1.5, e.position.z);
    if (g2 !== null) e.position.y = g2;
    e.rot = dampAngle(e.rot, Math.atan2(dx, dz), 10, dt);
    return step / dt;
  }

  ai(e, dt, players) {
    const g = this.game;
    e.stateT += dt;
    e.attackCd -= dt;
    e.stun = Math.max(0, e.stun - dt);
    e.slow = Math.max(0, e.slow - dt);
    let moving = 0;
    const def = e.def;
    const spd = def.speed * (e.slow > 0 ? 0.45 : 1) * (e.elite ? 1.08 : 1);
    if (e.state === 'spawn') {
      if (e.stateT > (def.boss ? 1.4 : 2.0)) { e.char.stopAction(0.25); e.setState('idle'); }
      return 0;
    }
    if (e.stun > 0) return 0;
    if (e.state === 'return') {
      moving = this.moveTowards(e, e.home.x, e.home.z, spd * 1.6, dt);
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25 * dt);
      if (Math.hypot(e.position.x - e.home.x, e.position.z - e.home.z) < 4) { e.setState('idle'); e.threat.clear(); }
      return moving;
    }
    // cible
    const tgt = this.chooseTarget(e, players);
    if (tgt && !e.target) { e.attackCd = Math.max(e.attackCd, 0.6); g.audio?.play('aggro', e.position); }
    e.target = tgt;
    if (!tgt) {
      // flânerie
      if (e.state === 'chase' || e.state === 'attack') e.setState('idle');
      e.wanderT -= dt;
      if (e.wanderT <= 0) {
        e.wanderT = rand(4, 9);
        const a = Math.random() * Math.PI * 2, r = rand(4, 14);
        e.dest = { x: e.home.x + Math.cos(a) * r, z: e.home.z + Math.sin(a) * r };
      }
      if (e.dest) {
        moving = this.moveTowards(e, e.dest.x, e.dest.z, spd * 0.42, dt);
        if (Math.hypot(e.position.x - e.dest.x, e.position.z - e.dest.z) < 1) e.dest = null;
      }
      return moving;
    }
    const dx = tgt.position.x - e.position.x, dz = tgt.position.z - e.position.z;
    const dist = Math.hypot(dx, dz);
    // laisse : trop loin de la maison
    if (Math.hypot(e.position.x - e.home.x, e.position.z - e.home.z) > (def.boss ? 40 : 60)) { e.setState('return'); e.target = null; e.threat.clear(); return 0; }
    // attaque en cours
    if (e.pending) {
      e.pending.t -= dt;
      e.rot = dampAngle(e.rot, Math.atan2(dx, dz), 6, dt);
      if (e.pending.t <= 0) { const pnd = e.pending; e.pending = null; this.resolveAttack(e, pnd, players); }
      return 0;
    }
    if (e.casting) { e.casting -= dt; if (e.casting > 0) return 0; e.casting = 0; }
    const range = def.range + (tgt.radius || 0.5);
    if (def.ranged) {
      const pref = def.caster ? 14 : 16;
      if (dist > def.range) { moving = this.moveTowards(e, tgt.position.x, tgt.position.z, spd, dt); e.setState('chase'); }
      else if (dist < pref * 0.5) { moving = this.moveTowards(e, e.position.x - dx, e.position.z - dz, spd * 0.8, dt); e.rot = dampAngle(e.rot, Math.atan2(dx, dz), 8, dt); }
      else { e.rot = dampAngle(e.rot, Math.atan2(dx, dz), 8, dt); e.setState('attack'); }
      if (dist <= def.range && e.attackCd <= 0 && Math.abs(angleDiff(e.rot, Math.atan2(dx, dz))) < 0.5) this.startAttack(e, tgt);
    } else {
      if (dist > range * 0.9) { moving = this.moveTowards(e, tgt.position.x, tgt.position.z, spd, dt); e.setState('chase'); }
      else {
        e.rot = dampAngle(e.rot, Math.atan2(dx, dz), 10, dt);
        e.setState('attack');
        if (e.attackCd <= 0) this.startAttack(e, tgt);
      }
    }
    return moving;
  }

  startAttack(e, tgt) {
    const def = e.def;
    e.attackCd = def.cd * (0.85 + Math.random() * 0.3) / (e.elite ? 1.15 : 1);
    if (def.boss && this.game.boss) { this.game.boss.chooseAttack(e, tgt); return; }
    // nécromancien : invocation ou zone d'ombre de temps en temps
    if (def.caster && Math.random() < 0.28) {
      const roll = Math.random();
      if (roll < 0.45 && e.level >= 5 && this.countNear(e.position, 14) < 6) {
        e.char.playAction('Spellcast_Summon', { full: true, timeScale: 1.8 });
        e.casting = 1.6;
        e.pending = { kind: 'summon', t: 1.4 };
        this.fx('summon', e.position);
        return;
      }
      e.char.playAction('Spellcast_Long', { full: true, timeScale: 1.4 });
      const p = tgt.position.clone();
      e.pending = { kind: 'shadowzone', t: 1.3, x: p.x, y: p.y, z: p.z };
      this.fx('telegraph', p, { r: 3.6, d: 1.3 });
      e.atkCount++;
      return;
    }
    e.playAttack();
    e.pending = { kind: def.ranged ? 'shoot' : 'melee', t: def.ranged ? 0.42 : 0.48, tgt: tgt.id };
  }

  countNear(p, r) { let n = 0; for (const e of this.map.values()) if (e.alive && Math.hypot(e.position.x - p.x, e.position.z - p.z) < r) n++; return n; }

  resolveAttack(e, pnd, players) {
    const g = this.game;
    const def = e.def;
    if (pnd.kind === 'melee') {
      for (const p of players) {
        if (!p.alive) continue;
        const dx = p.position.x - e.position.x, dz = p.position.z - e.position.z;
        const d = Math.hypot(dx, dz);
        if (d > def.range + 1.2 + (p.radius || 0.5)) continue;
        if (Math.abs(angleDiff(e.rot, Math.atan2(dx, dz))) > 1.2) continue;
        g.hurtPlayer(p.id, e.atk * (def.boss ? 1 : 1), e, { kind: 'melee' });
      }
      this.fx('swing', e.position, { rot: e.rot, boss: !!def.boss });
    } else if (pnd.kind === 'shoot') {
      const tgt = players.find((p) => p.id === pnd.tgt) || e.target;
      if (!tgt) return;
      const from = new THREE.Vector3(e.position.x + Math.sin(e.rot) * 0.8, e.position.y + 1.6, e.position.z + Math.cos(e.rot) * 0.8);
      const lead = tgt.velocity ? tgt.velocity.clone().multiplyScalar(0.35) : new THREE.Vector3();
      const to = new THREE.Vector3(tgt.position.x + lead.x, tgt.position.y + 1.2, tgt.position.z + lead.z);
      const dir = to.sub(from);
      const caster = !!def.caster;
      const atk = e.atk;
      g.projectiles.spawn({
        x: from.x, y: from.y, z: from.z, dir, speed: caster ? 17 : 30, range: def.range + 8, color: caster ? '#b05cff' : '#c9f0ff', size: caster ? 0.42 : 0.2,
        kind: caster ? 'orb' : 'bolt', team: 'enemy', homing: caster ? 1.4 : 0, target: tgt,
        onHit: (t) => g.hurtPlayer(t.id, atk, e, { kind: caster ? 'shadow' : 'bolt' }),
      });
      this.fx('shot', from, { dir: [dir.x, dir.y, dir.z], caster });
    } else if (pnd.kind === 'shadowzone') {
      this.fx('shadowboom', { x: pnd.x, y: pnd.y, z: pnd.z });
      for (const p of players) {
        if (!p.alive) continue;
        if (Math.hypot(p.position.x - pnd.x, p.position.z - pnd.z) < 3.8) g.hurtPlayer(p.id, e.atk * 1.4, e, { kind: 'shadow' });
      }
    } else if (pnd.kind === 'summon') {
      for (let i = 0; i < 2; i++) {
        const a = e.rot + (i ? 1.2 : -1.2);
        const x = e.position.x + Math.sin(a) * 3, z = e.position.z + Math.cos(a) * 3;
        if (g.world.terrain.heightAt(x, z) === null) continue;
        const m = this.spawn('minion', Math.max(1, e.level - 2), x, z, { home: e.home });
        if (e.zone) { m.zone = e.zone; this.zones.find((zz) => zz.id === e.zone)?.ids.add(m.id); }
      }
    } else if (pnd.custom) pnd.custom(e, players);
  }

  // évènements visuels rejoués chez les autres clients
  fx(type, p, data = {}) {
    this.fxEvents.push({ s: ++this.fxSeq, type, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), ...data, t: Date.now() });
    if (this.fxEvents.length > 12) this.fxEvents.shift();
    this.playFx({ type, x: p.x, y: p.y, z: p.z, ...data });
  }

  playFx(ev) {
    const fx = this.game.fx;
    const p = new THREE.Vector3(ev.x, ev.y, ev.z);
    switch (ev.type) {
      case 'telegraph': fx.telegraph(p, ev.r || 3.5, ev.d || 1.2, '#b05cff'); break;
      case 'shadowboom': fx.explosion(p, '#8a3cff', 3.5); this.game.audio?.play('boom', p); this.game.shakeAt(p, 0.5); break;
      case 'summon': fx.runeCircle(p, '#b05cff', { radius: 4, life: 1.8 }); this.game.audio?.play('summon', p); break;
      case 'swing': if (ev.boss) { fx.shockwave(p, '#b05cff', 7); this.game.shakeAt(p, 0.8); } this.game.audio?.play('swoosh', p); break;
      case 'shot': this.game.audio?.play(ev.caster ? 'cast' : 'bow', p); break;
      default: this.game.boss?.playFx?.(ev, p);
    }
  }

  // dégâts infligés par un joueur. Chez l'hôte : appliqués ; ailleurs : prédits puis envoyés.
  damage(e, mult, attacker, opts = {}) {
    if (!e || !e.alive) return null;
    const g = this.game;
    const hero = g.hero;
    const atk = opts.atk ?? hero.stats.atk;
    const r = opts.fixed ? { amount: Math.round(opts.fixed), crit: false } : computeDamage(atk, mult, e.armor, { crit: hero.stats.crit + (opts.critBonus || 0) });
    if (e.def.boss && opts.vsUndead) r.amount = Math.round(r.amount * 1.0);
    if (opts.vsUndead) r.amount = Math.round(r.amount * 1.25);
    const selfId = g.selfId;
    e.lastDamagers.set(selfId, Date.now());
    if (this.isHost) this.hostApplyDamage(e, r.amount, selfId, opts);
    else {
      g.net?.queueHit(e.id, r.amount, opts);
      e.hp = Math.max(1, e.hp - r.amount); // prédiction
      e.char.hitFlash('#ffffff', 1);
      e.playHit();
    }
    g.onDamageDealt(e, r, opts);
    return r;
  }

  hostApplyDamage(e, amount, fromId, opts = {}) {
    if (!e.alive) return;
    e.hp -= amount;
    e.hitCount++;
    e.lastDamagers.set(fromId, Date.now());
    this.addThreat(e, fromId, amount * (opts.threat || 1));
    if (opts.stun) e.stun = Math.max(e.stun, opts.stun);
    if (opts.slow) e.slow = Math.max(e.slow, opts.slow);
    if (opts.knock && !e.def.boss) {
      const a = Math.atan2(e.position.x - opts.knock.x, e.position.z - opts.knock.z);
      const nx = e.position.x + Math.sin(a) * (opts.knock.d || 2.5), nz = e.position.z + Math.cos(a) * (opts.knock.d || 2.5);
      if (this.game.world.terrain.heightAt(nx, nz) !== null) { e.position.x = nx; e.position.z = nz; }
    }
    e.char.hitFlash('#ffffff', 1);
    if (e.state === 'spawn') { e.char.stopAction(0.2); e.setState('idle'); }
    if (e.hp <= 0) this.kill(e);
    else e.playHit();
  }

  kill(e) {
    e.die();
    const killers = [...e.lastDamagers.entries()].filter(([, t]) => Date.now() - t < 30000).map(([id]) => id);
    this.killEvents.push({ id: e.id, type: e.type, level: e.level, elite: e.elite, xp: e.xp, x: e.position.x, y: e.position.y, z: e.position.z, killers, t: Date.now() });
    if (this.killEvents.length > 10) this.killEvents.shift();
    this.game.onEnemyKilled(e, killers);
  }

  // ----------------------------------------------------------------------------- MISE À JOUR
  update(dt) {
    const g = this.game;
    const now = performance.now();
    const cam = g.camera.position;
    if (this.isHost) {
      this.hostSpawning(dt);
      // dégâts reçus des autres joueurs
      for (const h of this.pendingHits.splice(0)) {
        const e = this.map.get(h.e);
        if (e) this.hostApplyDamage(e, h.d, h.from, h.o || {});
      }
    }
    const players = this.isHost ? g.playerTargets() : null;
    const arr = [...this.map.values()];
    for (const e of arr) {
      const far = (e.position.x - cam.x) ** 2 + (e.position.z - cam.z) ** 2 > 150 * 150;
      let moving = 0;
      if (this.isHost) {
        if (e.alive) moving = this.ai(e, dt, players);
        e.object.rotation.y = e.rot;
        e.speed = moving;
      } else {
        moving = e.interpolate(dt, now);
      }
      e.object.visible = !far;
      if (!far || e.def.boss) e.updateVisual(dt, moving);
      if (e.state === 'dead' && e.deadT > 4.2) this.remove(e.id);
    }
    // séparation
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < arr.length; j++) {
        const b = arr[j];
        if (!b.alive) continue;
        const dx = b.position.x - a.position.x, dz = b.position.z - a.position.z;
        const d2 = dx * dx + dz * dz, m = a.radius + b.radius;
        if (d2 < m * m && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (m - d) * 0.5;
          a.position.x -= dx / d * push; a.position.z -= dz / d * push;
          b.position.x += dx / d * push; b.position.z += dz / d * push;
        }
      }
    }
  }

  // ----------------------------------------------------------------------------- RÉSEAU
  snapshot() {
    const out = [];
    for (const e of this.map.values()) {
      if (e.state === 'dead' && e.deadT > 3) continue;
      out.push([e.id, ENEMY_TYPES.indexOf(e.type), e.level, Math.round(e.position.x * 10), Math.round(e.position.z * 10), Math.round(e.rot * 100), Math.round(e.hpPct * 1000), STATES.indexOf(e.state), e.atkCount % 100, e.hitCount % 100, e.elite ? 1 : 0, e.target ? e.target.id : 0]);
    }
    return out;
  }

  applySnapshot(list, now = performance.now()) {
    const seen = new Set();
    for (const s of list) {
      const [id, ti, level, x10, z10, r100, hp1000, si, atk, hit, elite, tgt] = s;
      seen.add(id);
      let e = this.map.get(id);
      const x = x10 / 10, z = z10 / 10;
      if (!e) {
        const type = ENEMY_TYPES[ti];
        if (!type || !ENEMIES[type]) continue;
        e = this.spawn(type, level, x, z, { id, elite: !!elite, silent: STATES[si] !== 'spawn' });
        if (STATES[si] !== 'spawn') { e.char.stopAction(0); e.state = STATES[si]; }
        e.lastAtk = atk; e.lastHit = hit;
      }
      e.applyNet({ x, z, rot: r100 / 100, hp: hp1000 / 1000, state: STATES[si], atk, hit, tgt }, now);
    }
    for (const id of [...this.map.keys()]) if (!seen.has(id)) { const e = this.map.get(id); if (e.state !== 'dead' || e.deadT > 1) this.remove(id); }
  }

  // reprise en tant qu'hôte (migration) : on garde les squelettes connus
  becomeHost() {
    this.isHost = true;
    for (const e of this.map.values()) { e.snapBuf.length = 0; if (e.state === 'spawn') e.setState('idle'); e.home = e.home || { x: e.position.x, z: e.position.z }; }
    for (const z of this.zones) z.ids.clear();
    for (const e of this.map.values()) {
      let best = null, bd = Infinity;
      for (const z of this.zones) { const d = Math.hypot(e.position.x - z.x, e.position.z - z.z); if (d < bd) { bd = d; best = z; } }
      if (best) { best.ids.add(e.id); e.home = { x: best.x, z: best.z }; e.zone = best.id; }
    }
  }
  becomeClient() { this.isHost = false; }
}
