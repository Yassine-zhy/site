import * as THREE from 'three';
import { angleDiff } from '../engine/math.js';

const _v = new THREE.Vector3();

// ------------------------------------------------------------------ outils communs
export function forwardOf(actor) { return { x: Math.sin(actor.facing), z: Math.cos(actor.facing) }; }

export function hitArc(c, range, arc, mult, opts = {}) {
  const a = c.actor;
  const hits = [];
  for (const e of c.game.enemies.hittable()) {
    const dx = e.position.x - a.position.x, dz = e.position.z - a.position.z;
    const d = Math.hypot(dx, dz);
    if (d > range + e.radius) continue;
    if (Math.abs(e.position.y - a.position.y) > 4 + (e.def.boss ? 4 : 0)) continue;
    if (d > 1.2 && Math.abs(angleDiff(a.facing, Math.atan2(dx, dz))) > arc / 2) continue;
    const r = c.game.enemies.damage(e, mult, a, { ...opts, knock: opts.knock ? { x: a.position.x, z: a.position.z, d: opts.knock } : null });
    if (r) hits.push(e);
  }
  return hits;
}

export function hitRadius(c, center, radius, mult, opts = {}) {
  const hits = [];
  for (const e of c.game.enemies.hittable()) {
    const d = Math.hypot(e.position.x - center.x, e.position.z - center.z);
    if (d > radius + e.radius) continue;
    if (Math.abs(e.position.y - center.y) > 5 + (e.def.boss ? 5 : 0)) continue;
    const r = c.game.enemies.damage(e, mult, c.actor, { ...opts, knock: opts.knock ? { x: center.x, z: center.z, d: opts.knock } : null });
    if (r) hits.push(e);
  }
  return hits;
}

// point visé au sol (marche le long du rayon de la caméra), borné à maxRange autour du joueur
export function aimPoint(c, maxRange = 25) {
  const g = c.game;
  if (g.target && g.target.alive) {
    const d = Math.hypot(g.target.position.x - c.actor.position.x, g.target.position.z - c.actor.position.z);
    if (d <= maxRange + 2) return g.target.position.clone();
  }
  const cam = g.camera;
  const dir = cam.getWorldDirection(_v.set(0, 0, 0)).clone();
  const p = cam.position.clone();
  let hit = null;
  for (let i = 0; i < 160; i++) {
    p.addScaledVector(dir, 0.8);
    const h = g.world.terrain.heightAt(p.x, p.z);
    if (h !== null && p.y <= h) { hit = new THREE.Vector3(p.x, h, p.z); break; }
  }
  const a = c.actor.position;
  if (!hit) { const f = forwardOf(c.actor); hit = new THREE.Vector3(a.x + f.x * maxRange * 0.6, a.y, a.z + f.z * maxRange * 0.6); }
  const dx = hit.x - a.x, dz = hit.z - a.z, d = Math.hypot(dx, dz);
  if (d > maxRange) { hit.x = a.x + dx / d * maxRange; hit.z = a.z + dz / d * maxRange; }
  const h = g.world.terrain.heightAt(hit.x, hit.z);
  hit.y = h ?? a.y;
  return hit;
}

function chest(actor, up = 1.5, fwd = 0.6) {
  return new THREE.Vector3(actor.position.x + Math.sin(actor.facing) * fwd, actor.position.y + up, actor.position.z + Math.cos(actor.facing) * fwd);
}

// ------------------------------------------------------------------ attaques de base
export const BASIC = {
  knight: { cd: 0.62, mults: [1.0, 1.1, 1.45] },
  barbarian: { cd: 0.82, mults: [1.25, 1.35, 1.7] },
  mage: { cd: 0.72, mults: [1.0] },
  rogue: { cd: 0.5, mults: [0.95] },
};

export function basicAttack(c, combo) {
  const g = c.game, a = c.actor, cls = c.classId;
  const info = BASIC[cls];
  const mult = info.mults[combo % info.mults.length];
  const data = { combo };
  if (cls === 'knight' || cls === 'barbarian') {
    const third = combo % 3 === 2;
    g.schedule(cls === 'barbarian' ? 0.36 : 0.26, () => {
      const hits = hitArc(c, g.classDef.attackRange, g.classDef.attackArc, mult, { knock: third ? 2.2 : 0, kind: 'melee' });
      if (hits.length) { g.rig.shake(third ? 0.25 : 0.12); g.hitStop(third ? 0.07 : 0.04); }
    });
  } else {
    const tgt = g.target && g.target.alive ? g.target : null;
    const from = chest(a, 1.55, 0.9);
    const to = tgt ? new THREE.Vector3(tgt.position.x, tgt.position.y + 1.3, tgt.position.z) : aimPoint(c, 30).add(new THREE.Vector3(0, 1.2, 0));
    data.to = [to.x, to.y, to.z];
    const ambush = g.hero.hasBuff('ambush');
    g.schedule(cls === 'mage' ? 0.28 : 0.12, () => {
      const f = chest(a, 1.55, 0.9);
      g.projectiles.spawn({
        x: f.x, y: f.y, z: f.z, dir: to.clone().sub(f), speed: cls === 'mage' ? 36 : 58, range: 34,
        color: cls === 'mage' ? '#8fb8ff' : '#ffe9a8', size: cls === 'mage' ? 0.32 : 0.2, kind: cls === 'mage' ? 'orb' : 'bolt',
        team: 'player', homing: tgt ? (cls === 'mage' ? 5 : 2) : 0, target: tgt,
        onHit: (e) => { g.enemies.damage(e, mult * (ambush ? 2 : 1), a, { critBonus: ambush ? 100 : 0, kind: 'ranged' }); g.fx.hit(e.position.clone().setY(e.position.y + 1.3), cls === 'mage' ? '#8fb8ff' : '#ffe9a8', 0.7); },
      });
      if (ambush) g.hero.buffs = g.hero.buffs.filter((b) => b.id !== 'ambush');
    });
  }
  basicVisual(c, data);
  return data;
}

export function basicVisual(c, data) {
  const g = c.game, a = c.actor, cls = c.classId;
  const def = g.classDefs[cls];
  const anim = def.weapons.combo[data.combo % def.weapons.combo.length];
  const moving = Math.hypot(a.velocity?.x || 0, a.velocity?.z || 0) > 1;
  a.char.playAction(anim, { full: !moving && (cls === 'barbarian'), timeScale: cls === 'barbarian' ? 1.45 : cls === 'knight' ? 1.7 : 1.6 });
  if (cls === 'knight' || cls === 'barbarian') {
    const tilt = [0.25, -0.35, 0.05][data.combo % 3];
    g.schedule(cls === 'barbarian' ? 0.3 : 0.2, () => {
      g.fx.slash(a.position, a.facing, cls === 'knight' ? '#bfe0ff' : '#ffb27a', { radius: cls === 'barbarian' ? 3.4 : 2.9, arc: cls === 'barbarian' ? 2.6 : 2.2, tilt, y: 1.25 });
      g.audio?.play('swoosh', a.position);
    });
  } else {
    g.audio?.play(cls === 'mage' ? 'cast' : 'bow', a.position);
    if (cls === 'mage') g.fx.sparkle(chest(a, 1.6, 0.8), '#8fb8ff', 0.3, 6, 0.2);
  }
}

// ------------------------------------------------------------------ compétences de classe
export const ABILITIES = {
  // ---------- CHEVALIER
  shieldwall: {
    name: 'Rempart', cd: 12, mana: 15, level: 1, icon: 'shield',
    desc: 'Lève le bouclier 3 s : −75 % de dégâts subis, provoque les ennemis proches.',
    cast(c) {
      c.game.hero.addBuff('shieldwall', 3, { 'def%': 0 }, { reduce: 0.75 });
      for (const e of c.game.enemies.hittable()) if (Math.hypot(e.position.x - c.actor.position.x, e.position.z - c.actor.position.z) < 10) c.game.enemies.isHost ? c.game.enemies.addThreat(e, c.game.selfId, 400) : null;
      c.actor.rooted = 0; c.actor.attackSlow = 0.45;
      c.game.schedule(3, () => { c.actor.attackSlow = 0; c.actor.char.stopAction(); });
      return {};
    },
    visual(c) { c.actor.char.playLoop('Blocking', { full: false }); c.game.fx.bubble(c.actor, '#ffd36b', 3, 1.9); c.game.audio?.play('shield', c.actor.position); },
  },
  charge: {
    name: 'Charge', cd: 9, mana: 12, level: 2, icon: 'charge',
    desc: 'Fonce sur 14 m, renverse et étourdit les ennemis sur la route.',
    cast(c) {
      const g = c.game, a = c.actor;
      const hit = new Set();
      a.startDash(Math.sin(a.facing), Math.cos(a.facing), 14, 0.38, {
        onTick: () => {
          for (const e of g.enemies.hittable()) {
            if (hit.has(e.id)) continue;
            if (Math.hypot(e.position.x - a.position.x, e.position.z - a.position.z) < 2.4 + e.radius) {
              hit.add(e.id); g.enemies.damage(e, 1.4, a, { stun: 1.3, knock: { x: a.position.x, z: a.position.z, d: 3 } });
              g.fx.hit(e.position.clone().setY(e.position.y + 1.2), '#ffd36b', 1.2); g.rig.shake(0.2);
            }
          }
        },
      });
      return {};
    },
    visual(c) {
      const a = c.actor;
      a.char.playAction('Block_Attack', { full: true, timeScale: 1.2 });
      c.game.fx.dust(a.position, { count: 14 });
      c.game.audio?.play('charge', a.position);
      for (let n = 0; n < 9; n++) c.game.schedule(n * 0.04, () => c.game.fx.burst(chest(a, 1, 0), '#ffd36b', { count: 4, speed: 2, size: 0.4, life: 0.4 }));
    },
  },
  rally: {
    name: 'Cri de ralliement', cd: 25, mana: 20, level: 4, icon: 'banner',
    desc: 'Galvanise : +25 % attaque, +30 % défense pendant 10 s, soigne 15 % (alliés proches aussi).',
    cast(c) {
      const g = c.game;
      g.hero.addBuff('rally', 10, { 'atk%': 25, 'def%': 30 });
      g.healSelf(Math.round(g.hero.stats.hp * 0.15));
      for (const e of g.enemies.hittable()) if (g.enemies.isHost && Math.hypot(e.position.x - c.actor.position.x, e.position.z - c.actor.position.z) < 12) g.enemies.addThreat(e, g.selfId, 300);
      return { ally: 'rally' };
    },
    visual(c) { c.actor.char.playAction('Cheer', { full: true, timeScale: 1.4 }); c.game.fx.ring(c.actor.position, '#ffd36b', { to: 12, life: 0.8 }); c.game.fx.aura(c.actor, '#ffd36b', { duration: 1.4 }); c.game.audio?.play('rally', c.actor.position); },
  },
  judgement: {
    name: 'Jugement', cd: 30, mana: 35, level: 6, icon: 'sun',
    desc: 'Bondit et frappe le sol d’une lumière sacrée : 3× dégâts sur 6 m, terrible contre les morts.',
    cast(c) {
      const g = c.game, a = c.actor;
      const p = aimPoint(c, 12);
      a.faceTowards(p.x, p.z, true);
      const d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
      a.startDash(p.x - a.position.x, p.z - a.position.z, Math.max(0.5, d - 1), 0.5);
      a.launch(9);
      g.schedule(0.62, () => { hitRadius(c, a.position, 6.2, 3.0, { vsUndead: true, stun: 1, knock: 3 }); g.rig.shake(0.6); g.hitStop(0.09); });
      return { p: [p.x, p.y, p.z] };
    },
    visual(c) {
      const g = c.game, a = c.actor;
      a.char.playAction('1H_Melee_Attack_Jump_Chop', { full: true, timeScale: 1.1 });
      g.schedule(0.62, () => { g.fx.beam(a.position, '#ffe7a0', { height: 40, radius: 3, life: 1 }); g.fx.shockwave(a.position, '#ffd36b', 8); g.fx.runeCircle(a.position, '#ffd36b', { radius: 6.2, life: 1.2 }); g.audio?.play('holy', a.position); });
    },
  },
  // ---------- BARBARE
  whirlwind: {
    name: 'Tourbillon', cd: 8, mana: 15, level: 1, icon: 'spin',
    desc: 'Tournoie 1,6 s en frappant tout autour (0,55× par coup), en restant mobile.',
    cast(c) {
      const g = c.game;
      c.actor.attackSlow = 0.6;
      for (let i = 0; i < 6; i++) g.schedule(0.1 + i * 0.26, () => { const h = hitRadius(c, c.actor.position, 4.4, 0.55, {}); if (h.length) g.rig.shake(0.08); });
      g.schedule(1.65, () => { c.actor.attackSlow = 0; c.actor.char.stopAction(); });
      return {};
    },
    visual(c) {
      const g = c.game, a = c.actor;
      a.char.playLoop('2H_Melee_Attack_Spinning', { full: false, timeScale: 1.3 });
      for (let i = 0; i < 6; i++) g.schedule(0.1 + i * 0.26, () => { g.fx.slash(a.position, a.facing + i * 2.1, '#ffb27a', { radius: 4, arc: 3.6, y: 1.1, life: 0.25 }); g.audio?.play('swoosh', a.position); });
      if (!c.isLocal) g.schedule(1.65, () => a.char.stopAction());
    },
  },
  leap: {
    name: 'Bond', cd: 10, mana: 12, level: 2, icon: 'leap',
    desc: 'Bondit jusqu’à 16 m et s’écrase : 1,6× dégâts autour, repousse.',
    cast(c) {
      const g = c.game, a = c.actor;
      const p = aimPoint(c, 16);
      a.faceTowards(p.x, p.z, true);
      const d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
      a.startDash(p.x - a.position.x, p.z - a.position.z, d, 0.7);
      a.launch(13);
      g.schedule(0.72, () => { hitRadius(c, a.position, 5.2, 1.6, { knock: 3.5 }); g.rig.shake(0.5); });
      return {};
    },
    visual(c) {
      const g = c.game, a = c.actor;
      a.char.playAction('Jump_Full_Short', { full: true, timeScale: 0.9 });
      g.schedule(0.72, () => { g.fx.shockwave(a.position, '#ff9a62', 6); g.audio?.play('slam', a.position); });
    },
  },
  rage: {
    name: 'Rage', cd: 28, mana: 0, level: 4, icon: 'rage',
    desc: '+40 % attaque, +20 % vitesse et vol de vie 15 % pendant 10 s.',
    cast(c) { c.game.hero.addBuff('rage', 10, { 'atk%': 40 }, { lifesteal: 0.15 }); c.actor.speedMult = 1.2; c.game.schedule(10, () => { c.actor.speedMult = 1; }); return {}; },
    visual(c) { c.actor.char.playAction('Taunt', { full: true, timeScale: 1.3 }); c.game.fx.aura(c.actor, '#ff5a3a', { duration: 10, rate: 18, size: 0.35 }); c.game.fx.ring(c.actor.position, '#ff5a3a', { to: 8 }); c.game.audio?.play('roar', c.actor.position); },
  },
  shatter: {
    name: 'Fracas', cd: 20, mana: 30, level: 6, icon: 'crack',
    desc: 'Fend la terre devant soi sur 12 m : 2,6× dégâts et étourdissement.',
    cast(c) {
      const g = c.game, a = c.actor;
      g.schedule(0.55, () => {
        for (let i = 1; i <= 5; i++) g.schedule(i * 0.05, () => {
          const p = { x: a.position.x + Math.sin(a.facing) * i * 2.4, y: a.position.y, z: a.position.z + Math.cos(a.facing) * i * 2.4 };
          hitRadius(c, p, 2.6, 2.6 / 2.2, { stun: 1.1 });
        });
        g.rig.shake(0.55);
      });
      return {};
    },
    visual(c) {
      const g = c.game, a = c.actor;
      a.char.playAction('2H_Melee_Attack_Chop', { full: true, timeScale: 1.2 });
      g.schedule(0.55, () => {
        g.audio?.play('slam', a.position);
        for (let i = 1; i <= 5; i++) g.schedule(i * 0.05, () => {
          const y = g.world.terrain.heightAt(a.position.x + Math.sin(a.facing) * i * 2.4, a.position.z + Math.cos(a.facing) * i * 2.4) ?? a.position.y;
          const p = { x: a.position.x + Math.sin(a.facing) * i * 2.4, y, z: a.position.z + Math.cos(a.facing) * i * 2.4 };
          g.fx.shockwave(p, '#ff9a62', 2.6);
        });
      });
    },
  },
  // ---------- MAGE
  frostnova: {
    name: 'Nova de givre', cd: 10, mana: 20, level: 1, icon: 'frost',
    desc: 'Explosion glaciale (7 m) : dégâts, gel 1,2 s puis ralentissement 4 s.',
    cast(c) { c.game.schedule(0.35, () => hitRadius(c, c.actor.position, 7, 1.1, { stun: 1.2, slow: 4 })); return {}; },
    visual(c) {
      const g = c.game, a = c.actor;
      a.char.playAction('Spellcast_Raise', { full: false, timeScale: 2 });
      g.schedule(0.35, () => { g.fx.ring(a.position, '#9be8ff', { to: 7.5, life: 0.6, intensity: 3 }); g.fx.burst(chest(a, 0.6, 0), '#c8f4ff', { count: 70, speed: 14, size: 0.4, life: 0.6, gravity: 2, spread: 0.2, up: 0.5 }); g.fx.runeCircle(a.position, '#9be8ff', { radius: 7, life: 1 }); g.audio?.play('frost', a.position); });
    },
  },
  blink: {
    name: 'Transfert', cd: 8, mana: 15, level: 2, icon: 'blink',
    desc: 'Se téléporte de 14 m dans la direction du mouvement.',
    cast(c) {
      const g = c.game, a = c.actor;
      let dx = a.moveDir.x, dz = a.moveDir.z;
      if (Math.hypot(dx, dz) < 0.1) { dx = Math.sin(a.facing); dz = Math.cos(a.facing); }
      const l = Math.hypot(dx, dz); dx /= l; dz /= l;
      const from = a.position.clone();
      let dist = 14;
      for (; dist > 2; dist -= 1) { const h = g.world.terrain.heightAt(a.position.x + dx * dist, a.position.z + dz * dist); if (h !== null) break; }
      a.position.x += dx * dist; a.position.z += dz * dist;
      const h = g.world.terrain.heightAt(a.position.x, a.position.z);
      if (h !== null && h > a.position.y - 3) a.position.y = h;
      a.facing = Math.atan2(dx, dz);
      return { from: [from.x, from.y, from.z] };
    },
    visual(c, d) {
      const g = c.game, a = c.actor;
      const f = d.from ? new THREE.Vector3(...d.from) : a.position.clone();
      g.fx.burst(f.clone().setY(f.y + 1.2), '#c69bff', { count: 30, speed: 5, size: 0.35, life: 0.5 });
      g.fx.burst(chest(a, 1.2, 0), '#c69bff', { count: 30, speed: 5, size: 0.35, life: 0.5 });
      g.fx.ring(a.position, '#c69bff', { to: 3, life: 0.4 });
      g.audio?.play('blink', a.position);
    },
  },
  meteor: {
    name: 'Météore', cd: 14, mana: 35, level: 4, icon: 'meteor',
    desc: 'Fait tomber un météore sur la zone visée (6 m) : 3,2× dégâts.',
    cast(c) {
      const p = aimPoint(c, 30);
      c.game.schedule(1.25, () => { hitRadius(c, p, 6, 3.2, { knock: 2.5 }); c.game.shakeAt(p, 0.6); });
      return { p: [p.x, p.y, p.z] };
    },
    visual(c, d) {
      const g = c.game, a = c.actor;
      const p = new THREE.Vector3(...d.p);
      a.char.playAction('Spellcast_Long', { full: true, timeScale: 2.0 });
      a.faceTowards?.(p.x, p.z, true);
      g.schedule(0.35, () => g.fx.meteor(p, '#ff7a2a', 0.9, () => g.audio?.play('boom', p)));
      g.fx.runeCircle(a.position, '#ff9a4a', { radius: 2.5, life: 1.2 });
      g.audio?.play('cast', a.position);
    },
  },
  arcanestorm: {
    name: 'Tempête arcanique', cd: 35, mana: 50, level: 6, icon: 'storm',
    desc: 'Pendant 3 s, des éclairs frappent les ennemis à 16 m (0,9× chacun).',
    cast(c) {
      const g = c.game, a = c.actor;
      a.rooted = 3;
      for (let i = 0; i < 12; i++) g.schedule(0.2 + i * 0.24, () => {
        const near = g.enemies.hittable().filter((e) => Math.hypot(e.position.x - a.position.x, e.position.z - a.position.z) < 16);
        if (!near.length) return;
        const e = near[Math.floor(Math.random() * near.length)];
        g.enemies.damage(e, 0.9, a, { stun: 0.2 });
        g.netFx('bolt', { from: [a.position.x, a.position.y + 6, a.position.z], to: [e.position.x, e.position.y + 1.2, e.position.z] });
      });
      g.schedule(3.1, () => a.char.stopAction());
      return {};
    },
    visual(c) {
      const g = c.game, a = c.actor;
      a.char.playLoop('Spellcasting', { full: true });
      g.fx.runeCircle(a.position, '#a8d8ff', { radius: 5, life: 3.2, spin: 3 });
      g.fx.aura(a, '#a8d8ff', { duration: 3, rate: 30 });
      if (!c.isLocal) g.schedule(3.1, () => a.char.stopAction());
      g.audio?.play('storm', a.position);
    },
  },
  // ---------- RÔDEUSE
  volley: {
    name: 'Pluie de carreaux', cd: 9, mana: 15, level: 1, icon: 'volley',
    desc: 'Arrose la zone visée (5 m) de 6 salves de carreaux (0,45× chacune).',
    cast(c) {
      const p = aimPoint(c, 28);
      for (let i = 0; i < 6; i++) c.game.schedule(0.5 + i * 0.22, () => hitRadius(c, p, 5, 0.45, { slow: 1 }));
      return { p: [p.x, p.y, p.z] };
    },
    visual(c, d) {
      const g = c.game, a = c.actor;
      const p = new THREE.Vector3(...d.p);
      a.char.playAction('2H_Ranged_Shoot', { full: false, timeScale: 1.5 });
      g.fx.telegraph(p, 5, 0.5, '#ffe9a8');
      for (let i = 0; i < 6; i++) g.schedule(0.4 + i * 0.22, () => {
        for (let k = 0; k < 5; k++) {
          const ang = Math.random() * Math.PI * 2, r = Math.random() * 4.6;
          const q = new THREE.Vector3(p.x + Math.cos(ang) * r, p.y, p.z + Math.sin(ang) * r);
          g.fx.lightning(q.clone().add(new THREE.Vector3(1.5, 14, 0.5)), q, '#ffe9a8', { life: 0.12, segments: 2, jitter: 0 });
          g.fx.dust(q, { count: 3, size: 0.8 });
        }
        g.audio?.play('bow', p);
      });
    },
  },
  roll: {
    name: 'Roulade', cd: 5, mana: 8, level: 2, icon: 'roll',
    desc: 'Roulade éclair invulnérable ; le prochain tir est un coup critique ×2.',
    cast(c) {
      const a = c.actor;
      let dx = a.moveDir.x, dz = a.moveDir.z;
      if (Math.hypot(dx, dz) < 0.1) { dx = Math.sin(a.facing); dz = Math.cos(a.facing); }
      a.startDash(dx, dz, 10, 0.32);
      a.invulnerableT = 0.4;
      c.game.hero.addBuff('ambush', 6, {});
      return {};
    },
    visual(c) { c.actor.char.playAction('Dodge_Forward', { full: true, timeScale: 1.1 }); c.game.fx.dust(c.actor.position, { count: 10 }); c.game.audio?.play('dodge', c.actor.position); },
  },
  smoke: {
    name: 'Bombe fumigène', cd: 22, mana: 20, level: 4, icon: 'smoke',
    desc: 'Disparaît dans la fumée 5 s : les ennemis perdent votre trace et sont ralentis.',
    cast(c) {
      const g = c.game, a = c.actor;
      g.hero.addBuff('stealth', 5, {});
      const p = a.position.clone();
      for (const e of g.enemies.hittable()) {
        if (Math.hypot(e.position.x - p.x, e.position.z - p.z) < 7) { if (g.enemies.isHost) e.threat.delete(g.selfId); e.slow = 3; }
      }
      return { p: [p.x, p.y, p.z] };
    },
    visual(c, d) {
      const g = c.game, a = c.actor;
      const p = new THREE.Vector3(...d.p);
      a.char.playAction('Throw', { timeScale: 1.6 });
      for (let i = 0; i < 6; i++) g.schedule(i * 0.3, () => g.fx.dust(p, { count: 22, color: '#9aa0a8', size: 3, speed: 4, life: 2.2 }));
      g.audio?.play('smoke', p);
    },
  },
  piercing: {
    name: 'Tir perçant', cd: 16, mana: 30, level: 6, icon: 'pierce',
    desc: 'Tir chargé qui traverse tout sur 50 m : 3× dégâts.',
    cast(c) {
      const g = c.game, a = c.actor;
      a.rooted = 0.7;
      const to = aimPoint(c, 50).add(new THREE.Vector3(0, 1.2, 0));
      g.schedule(0.6, () => {
        const f = chest(a, 1.5, 0.9);
        g.projectiles.spawn({ x: f.x, y: f.y, z: f.z, dir: to.clone().sub(f), speed: 80, range: 55, color: '#7ee0a8', size: 0.5, kind: 'bolt', team: 'player', pierce: true, hitRadius: 1.1,
          onHit: (e) => { g.enemies.damage(e, 3, a, { kind: 'ranged' }); g.fx.hit(e.position.clone().setY(e.position.y + 1.2), '#7ee0a8', 1.2); } });
        g.rig.shake(0.2);
      });
      return { to: [to.x, to.y, to.z] };
    },
    visual(c) {
      const g = c.game, a = c.actor;
      a.char.playAction('2H_Ranged_Aiming', { full: false, timeScale: 2.6 });
      g.fx.aura(a, '#7ee0a8', { duration: 0.6, rate: 50 });
      g.schedule(0.6, () => { a.char.playAction('2H_Ranged_Shoot', { timeScale: 1.6 }); g.audio?.play('pierce', a.position); });
    },
  },
};

export const ABILITY_ICONS = {
  shield: 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z',
  charge: 'M3 12h11M10 6l6 6-6 6M18 5v14',
  banner: 'M6 22V3M6 4h11l-3 4 3 4H6',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  spin: 'M20 12a8 8 0 1 1-3-6.3M20 4v5h-5',
  leap: 'M3 20c4-12 14-12 18 0M17 9l4-1-1 4',
  rage: 'M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 3 3 5',
  crack: 'M2 20l5-6 3 3 4-7 3 4 5-8',
  frost: 'M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3',
  blink: 'M4 12h4M10 12h4M16 12h4M18 8l3 4-3 4',
  meteor: 'M15 9a5 5 0 1 1-6 6M3 3l7 7M8 2l4 5M2 8l5 4',
  storm: 'M13 2 5 13h6l-2 9 9-12h-6l1-8Z',
  volley: 'M4 4l6 6M10 2l4 8M16 2l-2 8M8 14l-2 8M12 14v8M16 14l2 8',
  roll: 'M12 3a9 9 0 1 0 9 9M21 3v6h-6',
  smoke: 'M6 16a4 4 0 1 1 1-7.9A5 5 0 0 1 17 9a4 4 0 0 1 1 7.9H6Z',
  pierce: 'M2 12h17M15 7l5 5-5 5M6 9v6',
  potion: 'M9 2h6M10 2v5L5 18a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4L14 7V2',
  rune: 'M12 2 3 21h18L12 2Z',
  attack: 'M14 3l7 7-11 11-4 1 1-4L18 7',
};
