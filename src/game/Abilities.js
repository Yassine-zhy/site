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
    // petit pas en avant sur le coup : l'attaque a du poids
    g.schedule(cls === 'barbarian' ? 0.22 : 0.14, () => a.startDash?.(Math.sin(a.facing), Math.cos(a.facing), third ? 1.1 : 0.6, 0.12));
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
        onHit: (e) => {
          g.enemies.damage(e, mult * (ambush ? 2 : 1), a, { critBonus: ambush ? 100 : 0, kind: 'ranged' });
          g.fx.hit(e.position.clone().setY(e.position.y + 1.3), cls === 'mage' ? '#8fb8ff' : '#ffe9a8', 0.7);
          if (g.hero.hasBuff?.('poison')) dot(c, e, 0.3, 4, 0.75, '#7ee05a');
        },
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
    g.fx.weaponTrail(a.char, cls === 'knight' ? '#bfe0ff' : '#ffb27a', { delay: cls === 'barbarian' ? 0.16 : 0.08, duration: cls === 'barbarian' ? 0.3 : 0.22, intensity: 1.6 });
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


// ------------------------------------------------------------------ outils des nouvelles compétences
const _f = new THREE.Vector3();
function fwd(a, k = 1) { return { x: Math.sin(a.facing) * k, z: Math.cos(a.facing) * k }; }
function groundAt(g, x, z, fallback) { return g.world.terrain.heightAt(x, z) ?? fallback; }
// dégâts sur la durée (saignement, brûlure, poison) : quelques ticks tant que la cible vit
function dot(c, e, mult, ticks, every, color) {
  const g = c.game;
  for (let i = 1; i <= ticks; i++) g.schedule(i * every, () => {
    if (!e.alive) return;
    g.enemies.damage(e, mult, c.actor, { kind: 'dot' });
    g.fx.burst(e.position.clone().setY(e.position.y + 1.2), color, { count: 5, speed: 2, size: 0.25, life: 0.4, gravity: -1 });
  });
}
function nearestEnemy(c, from, range, exclude = null) {
  let best = null, bd = range;
  for (const e of c.game.enemies.hittable()) {
    if (exclude?.has(e.id)) continue;
    const d = Math.hypot(e.position.x - from.x, e.position.z - from.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
// salve de projectiles en éventail autour de la direction de visée
function fanShot(c, n, spread, o) {
  const g = c.game, a = c.actor;
  const to = (g.target && g.target.alive) ? g.target.position.clone().setY(g.target.position.y + 1.2) : aimPoint(c, o.range || 30).add(new THREE.Vector3(0, 1.2, 0));
  const f = chest(a, 1.5, 0.9);
  const base = Math.atan2(to.x - f.x, to.z - f.z);
  for (let i = 0; i < n; i++) {
    const ang = base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
    const dir = new THREE.Vector3(Math.sin(ang), (to.y - f.y) / Math.max(4, Math.hypot(to.x - f.x, to.z - f.z)), Math.cos(ang));
    g.projectiles.spawn({ x: f.x, y: f.y, z: f.z, dir, speed: o.speed || 50, range: o.range || 30, color: o.color, size: o.size || 0.22, kind: o.kind || 'bolt', team: 'player', pierce: o.pierce, hitRadius: o.hitRadius,
      onHit: (e, pos) => { g.enemies.damage(e, o.mult, a, { kind: 'ranged', ...(o.opts || {}) }); g.fx.hit(pos || e.position.clone().setY(e.position.y + 1.2), o.color, 0.8); o.onHit?.(e); } });
  }
}

export const MORE_ABILITIES = {
  // ================= CHEVALIER
  shieldbash: {
    name: 'Coup de bouclier', cd: 7, mana: 14, level: 8, icon: 'bash',
    desc: 'Frappe du bouclier devant soi : 1,8× dégâts, étourdit 2 s et repousse.',
    cast(c) {
      const g = c.game;
      c.actor.startDash(Math.sin(c.actor.facing), Math.cos(c.actor.facing), 2.5, 0.16);
      g.schedule(0.2, () => { const h = hitArc(c, 4.2, 1.7, 1.8, { stun: 2, knock: 3.5 }); if (h.length) { g.rig.shake(0.3); g.hitStop(0.08); } });
      return {};
    },
    visual(c) {
      const g = c.game, a = c.actor;
      a.char.playAction('Block_Attack', { full: false, timeScale: 1.6 });
      g.schedule(0.2, () => {
        g.fx.slash(a.position, a.facing, '#ffd36b', { radius: 3.6, arc: 1.8, y: 1.0, width: 1.6, life: 0.25 });
        g.fx.burst(chest(a, 1.1, 1.6), '#fff0b0', { count: 22, speed: 8, size: 0.35, life: 0.4, spread: 0.4 });
        g.audio?.play('block', a.position); g.audio?.play('hit', a.position);
      });
    },
  },
  holyblade: {
    name: 'Lame sacrée', cd: 12, mana: 22, level: 10, icon: 'blade',
    desc: 'Enchaînement de quatre coups lumineux (0,85× chacun) achevé par une explosion sacrée (1,4×).',
    cast(c) {
      const g = c.game, a = c.actor;
      a.attackSlow = 0.5;
      [0.15, 0.4, 0.65, 0.92].forEach((t, i) => g.schedule(t, () => {
        a.startDash(Math.sin(a.facing), Math.cos(a.facing), 1.2, 0.1);
        const h = hitArc(c, 3.9, 2.3, 0.85, { kind: 'melee', vsUndead: true });
        if (h.length) g.hitStop(0.04);
      }));
      g.schedule(1.12, () => { hitRadius(c, a.position, 5, 1.4, { vsUndead: true, knock: 2.5 }); g.rig.shake(0.35); a.attackSlow = 0; });
      return {};
    },
    visual(c) {
      const g = c.game, a = c.actor;
      const seq = ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Chop', '1H_Melee_Attack_Stab'];
      seq.forEach((anim, i) => g.schedule(i * 0.25, () => {
        a.char.playAction(anim, { full: false, timeScale: 2.1 });
        g.fx.weaponTrail(a.char, '#ffe08a', { duration: 0.2, delay: 0.04 });
        g.schedule(0.1, () => { g.fx.slash(a.position, a.facing, '#ffe7a0', { radius: 3.2, arc: 2.2, tilt: [0.4, -0.3, 0.1, 0][i], y: 1.2 }); g.audio?.play('swoosh', a.position); });
      }));
      g.schedule(1.12, () => { g.fx.beam(a.position, '#ffe7a0', { height: 14, radius: 2.4, life: 0.6 }); g.fx.shockwave(a.position, '#ffd36b', 5.5); g.audio?.play('holy', a.position); });
    },
  },
  consecrate: {
    name: 'Consécration', cd: 20, mana: 30, level: 13, icon: 'consecrate',
    desc: 'Sanctifie le sol (7 m) pendant 6 s : brûle les ennemis (0,32× toutes les 0,5 s) et soigne les alliés qui s’y tiennent.',
    cast(c) {
      const g = c.game, a = c.actor, p = a.position.clone();
      for (let i = 1; i <= 12; i++) g.schedule(i * 0.5, () => {
        hitRadius(c, p, 7, 0.32, { vsUndead: true, kind: 'dot' });
        if (Math.hypot(a.position.x - p.x, a.position.z - p.z) < 7) g.healSelf(Math.round(g.hero.stats.hp * 0.02), i % 4 === 0);
      });
      return { p: [p.x, p.y, p.z] };
    },
    visual(c, d) {
      const g = c.game, a = c.actor, p = new THREE.Vector3(...d.p);
      a.char.playAction('Spellcast_Summon', { full: false, timeScale: 1.6 });
      g.fx.runeCircle(p, '#ffd36b', { radius: 7, life: 6.2, spin: 0.6 });
      g.fx.ring(p, '#ffe7a0', { to: 7, life: 0.7 });
      for (let i = 0; i < 24; i++) g.schedule(i * 0.25, () => {
        const ang = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 6.5;
        g.fx.burst({ x: p.x + Math.cos(ang) * r, y: p.y + 0.2, z: p.z + Math.sin(ang) * r }, '#ffe7a0', { count: 4, speed: 1, size: 0.35, life: 1.1, gravity: -3, up: 2 });
      });
      g.audio?.play('holy', p);
    },
  },
  divineshield: {
    name: 'Égide divine', cd: 40, mana: 35, level: 16, icon: 'dome',
    desc: 'Une bulle sacrée réduit de moitié les dégâts subis pendant 6 s et rend 20 % de vie (alliés proches aussi).',
    cast(c) {
      const g = c.game;
      g.hero.addBuff('divineshield', 6, { 'def%': 20 }, { reduce: 0.5, icon: 'dome', label: 'Égide divine' });
      g.healSelf(Math.round(g.hero.stats.hp * 0.2));
      return { ally: 'rally' };
    },
    visual(c) {
      const g = c.game, a = c.actor;
      a.char.playAction('Cheer', { full: false, timeScale: 1.5 });
      g.fx.bubble(a, '#ffe7a0', 6, 2.6);
      g.fx.beam(a.position, '#ffe7a0', { height: 22, radius: 2, life: 1 });
      g.fx.ring(a.position, '#ffd36b', { to: 9, life: 0.8 });
      g.audio?.play('shield', a.position); g.audio?.play('heal', a.position);
    },
  },
  lances: {
    name: 'Lances de lumière', cd: 22, mana: 40, level: 20, icon: 'spears',
    desc: 'Huit lances de lumière s’abattent sur la zone visée (6 m) : 0,95× chacune, étourdissent.',
    cast(c) {
      const g = c.game, p = aimPoint(c, 22), pts = [];
      for (let i = 0; i < 8; i++) {
        const ang = Math.random() * Math.PI * 2, r = i ? 1.5 + Math.random() * 4.5 : 0;
        const x = p.x + Math.cos(ang) * r, z = p.z + Math.sin(ang) * r;
        pts.push([Math.round(x * 10) / 10, Math.round(groundAt(g, x, z, p.y) * 10) / 10, Math.round(z * 10) / 10]);
      }
      pts.forEach((q, i) => g.schedule(0.55 + i * 0.09, () => hitRadius(c, { x: q[0], y: q[1], z: q[2] }, 2.4, 0.95, { vsUndead: true, stun: 0.5 })));
      g.schedule(0.6, () => g.shakeAt(p, 0.4));
      return { pts };
    },
    visual(c, d) {
      const g = c.game, a = c.actor;
      a.char.playAction('Spellcast_Shoot', { full: false, timeScale: 1.4 });
      d.pts.forEach((q, i) => g.schedule(0.5 + i * 0.09, () => {
        const v = new THREE.Vector3(q[0], q[1], q[2]);
        g.fx.lightning(v.clone().add(new THREE.Vector3(0.6, 18, 0.3)), v, '#ffe7a0', { life: 0.25, segments: 3, jitter: 0.2, width: 4 });
        g.fx.beam(v, '#ffe7a0', { height: 6, radius: 0.5, life: 0.5 });
        g.fx.ring(v, '#ffd36b', { to: 2.6, life: 0.4 });
        if (i % 2 === 0) g.audio?.play('zap', v);
      }));
    },
  },
  avatar: {
    name: 'Avatar de lumière', cd: 90, mana: 60, level: 24, icon: 'crown',
    desc: 'Devient un colosse de lumière 12 s : +50 % attaque et défense, des ondes sacrées frappent autour (0,6× toutes les 1,5 s).',
    cast(c) {
      const g = c.game, a = c.actor;
      g.hero.addBuff('avatar', 12, { 'atk%': 50, 'def%': 50 }, { icon: 'crown', label: 'Avatar de lumière' });
      for (let i = 1; i <= 8; i++) g.schedule(i * 1.5, () => { hitRadius(c, a.position, 6, 0.6, { vsUndead: true }); g.fx.ring(a.position, '#ffd36b', { to: 6, life: 0.5 }); });
      return {};
    },
    visual(c) {
      const g = c.game, a = c.actor, m = a.char.model, base = a.char.scale;
      a.char.playAction('Cheer', { full: true, timeScale: 1.2 });
      g.fx.levelUp(a);
      g.fx.aura(a, '#ffd36b', { duration: 12, rate: 16, radius: 1.6, size: 0.4 });
      let t = 0;
      const grow = (k) => m.scale.setScalar(base * (1 + 0.28 * k));
      for (let i = 0; i <= 10; i++) g.schedule(i * 0.05, () => grow(i / 10));
      g.schedule(11.5, () => { for (let i = 0; i <= 10; i++) g.schedule(i * 0.05, () => grow(1 - i / 10)); });
      void t;
      g.audio?.play('holy', a.position); g.audio?.play('levelup', a.position);
    },
  },
  // ================= BARBARE
  warcry: {
    name: 'Cri de guerre', cd: 16, mana: 15, level: 8, icon: 'shout',
    desc: 'Hurlement terrifiant (9 m) : étourdit 1,6 s, ralentit 5 s, et +25 % de défense pendant 8 s.',
    cast(c) {
      const g = c.game;
      hitRadius(c, c.actor.position, 9, 0.5, { stun: 1.6, slow: 5 });
      g.hero.addBuff('warcry', 8, { 'def%': 25 }, { icon: 'shout', label: 'Cri de guerre' });
      g.rig.shake(0.3);
      return {};
    },
    visual(c) {
      const g = c.game, a = c.actor;
      a.char.playAction('Taunt', { full: true, timeScale: 1.5 });
      g.fx.ring(a.position, '#ff5a3a', { to: 9, life: 0.6, intensity: 3 });
      g.schedule(0.15, () => g.fx.ring(a.position, '#ffb27a', { to: 7, life: 0.5 }));
      g.fx.dust(a.position, { count: 20, speed: 8 });
      g.audio?.play('roar', a.position);
    },
  },
  cleave: {
    name: 'Fendoir sanglant', cd: 9, mana: 18, level: 10, icon: 'cleave',
    desc: 'Taille immense en arc (240°, 5 m) : 2× dégâts et saignement (5 × 0,22×).',
    cast(c) {
      const g = c.game;
      g.schedule(0.38, () => {
        const h = hitArc(c, 5, 4.2, 2.0, { knock: 1.5, kind: 'melee' });
        for (const e of h) dot(c, e, 0.22, 5, 0.6, '#c0182a');
        if (h.length) { g.rig.shake(0.35); g.hitStop(0.07); }
      });
      return {};
    },
    visual(c) {
      const g = c.game, a = c.actor;
      a.char.playAction('2H_Melee_Attack_Slice', { full: true, timeScale: 1.35 });
      g.fx.weaponTrail(a.char, '#ff3a2a', { duration: 0.35, delay: 0.18 });
      g.schedule(0.36, () => { g.fx.slash(a.position, a.facing, '#ff4a3a', { radius: 5, arc: 4.2, y: 1.1, width: 1.4, life: 0.3 }); g.audio?.play('swoosh', a.position); g.audio?.play('slam', a.position); });
    },
  },
  quake: {
    name: 'Séisme', cd: 22, mana: 30, level: 13, icon: 'quake',
    desc: 'Trois coups de terre successifs, de plus en plus larges (4, 7 puis 10 m) : 1× dégâts et étourdissement.',
    cast(c) {
      const g = c.game, a = c.actor;
      a.rooted = 1.5;
      [4, 7, 10].forEach((r, i) => g.schedule(0.45 + i * 0.42, () => { hitRadius(c, a.position, r, 1.0, { stun: 0.6, knock: 2 }); g.rig.shake(0.3 + i * 0.15); }));
      return {};
    },
    visual(c) {
      const g = c.game, a = c.actor;
      [4, 7, 10].forEach((r, i) => g.schedule(i * 0.42, () => {
        a.char.playAction('2H_Melee_Attack_Chop', { full: true, timeScale: 1.6 });
        g.schedule(0.45, () => {
          g.fx.shockwave(a.position, '#d0a070', r);
          const pts = [];
          for (let k = 0; k < 10 + i * 6; k++) { const ang = k / (10 + i * 6) * Math.PI * 2; const x = a.position.x + Math.cos(ang) * r * 0.85, z = a.position.z + Math.sin(ang) * r * 0.85; pts.push({ x, y: groundAt(g, x, z, a.position.y), z }); }
          g.fx.spikes(pts, '#8a6a4a', { height: 1.6 + i * 0.6, radius: 0.5 + i * 0.1 });
          g.audio?.play('slam', a.position);
        });
      }));
    },
  },
  axethrow: {
    name: 'Hache tournoyante', cd: 10, mana: 20, level: 16, icon: 'axe',
    desc: 'Lance une hache qui traverse tout (1,7×) puis revient en frappant à nouveau (1,2×).',
    cast(c) {
      const g = c.game, a = c.actor;
      const to = (g.target && g.target.alive) ? g.target.position.clone() : aimPoint(c, 24);
      const f = chest(a, 1.4, 0.9);
      const dir = new THREE.Vector3(to.x - f.x, 0, to.z - f.z);
      const range = Math.min(26, Math.max(10, dir.length() + 4));
      g.schedule(0.3, () => g.projectiles.spawn({ x: f.x, y: f.y, z: f.z, dir, speed: 34, range, color: '#ffb27a', size: 0.55, kind: 'orb', team: 'player', pierce: true, hitRadius: 1.0,
        onHit: (e) => { g.enemies.damage(e, 1.7, a, { kind: 'melee' }); },
        onEnd: (pos) => {
          const back = new THREE.Vector3(a.position.x - pos.x, 0, a.position.z - pos.z);
          g.projectiles.spawn({ x: pos.x, y: pos.y, z: pos.z, dir: back, speed: 38, range: back.length(), color: '#ffd0a0', size: 0.55, kind: 'orb', team: 'player', pierce: true, hitRadius: 1.0, homing: 0,
            onHit: (e) => { g.enemies.damage(e, 1.2, a, { kind: 'melee' }); } });
        } }));
      return {};
    },
    visual(c) {
      const g = c.game, a = c.actor;
      a.char.playAction('Throw', { full: false, timeScale: 1.5 });
      g.schedule(0.3, () => g.audio?.play('swoosh', a.position));
    },
  },
  bloodlust: {
    name: 'Soif de sang', cd: 45, mana: 0, level: 20, icon: 'blood',
    desc: 'Rend 30 % de vie, puis +20 % attaque et vol de vie 25 % pendant 8 s.',
    cast(c) {
      const g = c.game;
      g.healSelf(Math.round(g.hero.stats.hp * 0.3));
      g.hero.addBuff('bloodlust', 8, { 'atk%': 20 }, { lifesteal: 0.25, icon: 'blood', label: 'Soif de sang' });
      return {};
    },
    visual(c) {
      const g = c.game, a = c.actor;
      a.char.playAction('Cheer', { full: false, timeScale: 1.4 });
      g.fx.aura(a, '#c0182a', { duration: 8, rate: 14, size: 0.35 });
      g.fx.burst(chest(a, 1.2, 0), '#ff3a3a', { count: 40, speed: 6, size: 0.4, life: 0.7, gravity: 4 });
      g.fx.ring(a.position, '#c0182a', { to: 6, life: 0.6 });
      g.audio?.play('roar', a.position);
    },
  },
  titan: {
    name: 'Colère du titan', cd: 60, mana: 45, level: 24, icon: 'titan',
    desc: 'Bond titanesque jusqu’à 18 m et impact dévastateur (10 m) : 4,5× dégâts, étourdit 2 s.',
    cast(c) {
      const g = c.game, a = c.actor;
      const p = aimPoint(c, 18);
      a.faceTowards(p.x, p.z, true);
      const d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
      a.startDash(p.x - a.position.x, p.z - a.position.z, d, 0.95);
      a.launch(17);
      g.schedule(1.0, () => { hitRadius(c, a.position, 10, 4.5, { stun: 2, knock: 5 }); g.rig.shake(1.0); g.hitStop(0.12); });
      return {};
    },
    visual(c) {
      const g = c.game, a = c.actor;
      a.char.playAction('Jump_Full_Short', { full: true, timeScale: 0.75 });
      g.fx.weaponTrail(a.char, '#ff6a3a', { duration: 0.9 });
      g.schedule(1.0, () => {
        g.fx.explosion(a.position, '#ff7a3a', 7);
        const pts = [];
        for (let k = 0; k < 22; k++) { const ang = k / 22 * Math.PI * 2, r = 3 + (k % 3) * 2.2; const x = a.position.x + Math.cos(ang) * r, z = a.position.z + Math.sin(ang) * r; pts.push({ x, y: groundAt(g, x, z, a.position.y), z }); }
        g.fx.spikes(pts, '#6a4a34', { height: 3.2, radius: 0.8, life: 1.6 });
        g.audio?.play('boom', a.position);
      });
    },
  },
  // ================= MAGE
  fireball: {
    name: 'Boule de feu', cd: 5, mana: 16, level: 8, icon: 'fire',
    desc: 'Projette une boule de feu qui explose (3,5 m) : 2,2× dégâts puis brûlure (3 × 0,25×).',
    cast(c) {
      const g = c.game, a = c.actor;
      const tgt = g.target && g.target.alive ? g.target : null;
      const to = tgt ? tgt.position.clone().setY(tgt.position.y + 1.2) : aimPoint(c, 32).add(new THREE.Vector3(0, 1, 0));
      const boom = (pos) => {
        for (const e of hitRadius(c, pos, 3.5, 2.2, { knock: 1.5 })) dot(c, e, 0.25, 3, 0.8, '#ff7a2a');
        g.fx.explosion(pos, '#ff7a2a', 3); g.audio?.play('boom', pos);
      };
      g.schedule(0.3, () => {
        const f = chest(a, 1.6, 0.9);
        g.projectiles.spawn({ x: f.x, y: f.y, z: f.z, dir: to.clone().sub(f), speed: 30, range: 36, color: '#ff7a2a', size: 0.7, kind: 'orb', team: 'player', homing: tgt ? 4 : 0, target: tgt,
          onHit: (e, pos) => boom(pos || e.position.clone()), onExpire: (pos) => boom(pos) });
      });
      return {};
    },
    visual(c) {
      const g = c.game, a = c.actor;
      a.char.playAction('Spellcast_Shoot', { full: false, timeScale: 1.6 });
      g.fx.sparkle(chest(a, 1.6, 0.8), '#ffb04a', 0.4, 10, 0.3);
      g.audio?.play('cast', a.position);
    },
  },
  chain: {
    name: 'Chaîne d’éclairs', cd: 8, mana: 22, level: 10, icon: 'chain',
    desc: 'Un éclair bondit d’ennemi en ennemi (jusqu’à 5) : 1,5× puis de moins en moins.',
    cast(c) {
      const g = c.game, a = c.actor;
      const hit = new Set();
      let cur = g.target && g.target.alive && Math.hypot(g.target.position.x - a.position.x, g.target.position.z - a.position.z) < 24 ? g.target : nearestEnemy(c, a.position, 22);
      let from = [a.position.x, a.position.y + 1.6, a.position.z];
      const mults = [1.5, 1.3, 1.1, 0.95, 0.8];
      for (let i = 0; i < 5 && cur; i++) {
        const e = cur, f = from, k = i;
        hit.add(e.id);
        g.schedule(0.25 + i * 0.09, () => {
          if (!e.alive) return;
          g.enemies.damage(e, mults[k], a, { stun: 0.3, kind: 'spell' });
          g.netFx('bolt', { from: f, to: [e.position.x, e.position.y + 1.2, e.position.z] });
        });
        from = [e.position.x, e.position.y + 1.2, e.position.z];
        cur = nearestEnemy(c, e.position, 10, hit);
      }
      return {};
    },
    visual(c) { c.actor.char.playAction('Spellcast_Shoot', { full: false, timeScale: 1.8 }); c.game.fx.sparkle(chest(c.actor, 1.6, 0.8), '#a8d8ff', 0.4, 10, 0.3); c.game.audio?.play('zap', c.actor.position); },
  },
  icelances: {
    name: 'Lances de glace', cd: 10, mana: 24, level: 13, icon: 'shards',
    desc: 'Cinq lances de glace en éventail : 1× chacune, ralentissent et gèlent un instant.',
    cast(c) {
      c.game.schedule(0.25, () => fanShot(c, 5, 0.7, { color: '#9be8ff', mult: 1.0, speed: 46, size: 0.3, opts: { slow: 3, stun: 0.3 } }));
      return {};
    },
    visual(c) { c.actor.char.playAction('Spellcast_Shoot', { full: false, timeScale: 1.7 }); c.game.fx.burst(chest(c.actor, 1.6, 1), '#c8f4ff', { count: 20, speed: 5, size: 0.3, life: 0.4 }); c.game.audio?.play('frost', c.actor.position); },
  },
  singularity: {
    name: 'Singularité', cd: 24, mana: 40, level: 16, icon: 'vortex',
    desc: 'Ouvre un vortex (8 m) qui aspire les ennemis 3 s en les blessant, puis implose : 2,2×.',
    cast(c) {
      const g = c.game, p = aimPoint(c, 24);
      for (let i = 1; i <= 10; i++) g.schedule(i * 0.3, () => {
        for (const e of g.enemies.hittable()) {
          const dx = e.position.x - p.x, dz = e.position.z - p.z, d = Math.hypot(dx, dz);
          if (d > 8 + e.radius || d < 0.5) continue;
          // repoussé depuis un point situé derrière lui : il glisse vers le centre
          g.enemies.damage(e, 0.32, c.actor, { slow: 1, kind: 'dot', knock: !e.def.boss ? { x: e.position.x + dx, z: e.position.z + dz, d: Math.min(1.4, d * 0.4) } : null });
        }
      });
      g.schedule(3.2, () => { hitRadius(c, p, 6, 2.2, { stun: 1.2 }); g.shakeAt(p, 0.6); });
      return { p: [p.x, p.y, p.z] };
    },
    visual(c, d) {
      const g = c.game, p = new THREE.Vector3(...d.p);
      c.actor.char.playAction('Spellcast_Long', { full: true, timeScale: 1.8 });
      g.fx.vortex(p, '#b07aff', { radius: 8, duration: 3.2 });
      g.fx.flashSphere(p.clone().setY(p.y + 1.5), '#5a2a9a', 1.5, 3.2);
      g.schedule(3.2, () => { g.fx.explosion(p, '#b07aff', 5); g.audio?.play('boom', p); });
      g.audio?.play('summon', p);
    },
  },
  manashield: {
    name: 'Bouclier d’éther', cd: 40, mana: 20, level: 20, icon: 'manashield',
    desc: 'Pendant 10 s, −45 % de dégâts subis et l’éther se régénère (40 % au total).',
    cast(c) {
      const g = c.game;
      g.hero.addBuff('manashield', 10, {}, { reduce: 0.45, icon: 'manashield', label: 'Bouclier d’éther' });
      for (let i = 1; i <= 10; i++) g.schedule(i, () => { g.hero.mp = Math.min(g.hero.stats.mp, g.hero.mp + g.hero.stats.mp * 0.04); });
      return {};
    },
    visual(c) { const g = c.game, a = c.actor; a.char.playAction('Spellcast_Raise', { full: false, timeScale: 1.6 }); g.fx.bubble(a, '#8fb8ff', 10, 2.1); g.fx.aura(a, '#8fb8ff', { duration: 1.2, rate: 50 }); g.audio?.play('shield', a.position); },
  },
  cataclysm: {
    name: 'Cataclysme', cd: 75, mana: 70, level: 24, icon: 'cataclysm',
    desc: 'Une pluie de huit météores ravage la zone visée (9 m) : 2,4× chacun.',
    cast(c) {
      const g = c.game, a = c.actor, p = aimPoint(c, 28), pts = [];
      a.rooted = 1.2;
      for (let i = 0; i < 8; i++) {
        const ang = i / 8 * Math.PI * 2 + Math.random() * 0.6, r = i ? 2.5 + Math.random() * 6 : 0;
        const x = p.x + Math.cos(ang) * r, z = p.z + Math.sin(ang) * r;
        pts.push([Math.round(x * 10) / 10, Math.round(groundAt(g, x, z, p.y) * 10) / 10, Math.round(z * 10) / 10]);
      }
      pts.forEach((q, i) => g.schedule(1.25 + i * 0.28, () => { hitRadius(c, { x: q[0], y: q[1], z: q[2] }, 4.5, 2.4, { knock: 2 }); g.shakeAt({ x: q[0], y: q[1], z: q[2] }, 0.4); }));
      return { pts };
    },
    visual(c, d) {
      const g = c.game, a = c.actor;
      a.char.playAction('Spellcast_Long', { full: true, timeScale: 1.3 });
      g.fx.runeCircle(a.position, '#ff7a2a', { radius: 3.5, life: 2, spin: 3 });
      d.pts.forEach((q, i) => g.schedule(0.35 + i * 0.28, () => { const v = new THREE.Vector3(q[0], q[1], q[2]); g.fx.meteor(v, i % 2 ? '#ff7a2a' : '#ff4a1a', 0.9, () => g.audio?.play('boom', v)); }));
      g.audio?.play('cast', a.position);
    },
  },
  // ================= RÔDEUSE
  multishot: {
    name: 'Tir multiple', cd: 6, mana: 14, level: 8, icon: 'multishot',
    desc: 'Cinq carreaux en éventail : 1× chacun.',
    cast(c) { c.game.schedule(0.18, () => fanShot(c, 5, 0.6, { color: '#ffe9a8', mult: 1.0, speed: 60 })); return {}; },
    visual(c) { c.actor.char.playAction('2H_Ranged_Shoot', { full: false, timeScale: 1.6 }); c.game.audio?.play('bow', c.actor.position); c.game.schedule(0.06, () => c.game.audio?.play('bow', c.actor.position)); },
  },
  trap: {
    name: 'Piège explosif', cd: 14, mana: 18, level: 10, icon: 'trap',
    desc: 'Pose un piège (20 s) : au premier ennemi qui passe, il explose (4,5 m) : 2,6× et étourdit 2 s.',
    cast(c) {
      const g = c.game, a = c.actor;
      const f = fwd(a, 2.2), x = a.position.x + f.x, z = a.position.z + f.z;
      const p = new THREE.Vector3(x, groundAt(g, x, z, a.position.y), z);
      let done = false;
      for (let i = 1; i <= 100 && !done; i++) g.schedule(0.4 + i * 0.2, () => {
        if (done) return;
        if (!g.enemies.hittable().some((e) => Math.hypot(e.position.x - p.x, e.position.z - p.z) < 2.4)) return;
        done = true;
        hitRadius(c, p, 4.5, 2.6, { stun: 2.2, knock: 2 });
        g.fx.explosion(p, '#ffb04a', 4); g.audio?.play('boom', p); g.shakeAt(p, 0.4);
        if (c.trapFx) c.trapFx.t = c.trapFx.life;
      });
      return { p: [p.x, p.y, p.z] };
    },
    visual(c, d) {
      const g = c.game, p = new THREE.Vector3(...d.p);
      c.actor.char.playAction('Throw', { full: false, timeScale: 1.7 });
      g.schedule(0.35, () => { c.trapFx = g.fx.runeCircle(p, '#ffb04a', { radius: 1.6, life: 20, spin: 2 }); g.fx.dust(p, { count: 6 }); g.audio?.play('unlock', p); });
    },
  },
  shadowstep: {
    name: 'Pas de l’ombre', cd: 12, mana: 20, level: 13, icon: 'shadowstep',
    desc: 'Surgit dans le dos de la cible et la poignarde : 2,6× dégâts, coup critique assuré, étourdit 1 s.',
    cast(c) {
      const g = c.game, a = c.actor;
      const t = g.target && g.target.alive && Math.hypot(g.target.position.x - a.position.x, g.target.position.z - a.position.z) < 24 ? g.target : nearestEnemy(c, a.position, 20);
      const from = a.position.clone();
      if (!t) { a.startDash(Math.sin(a.facing), Math.cos(a.facing), 10, 0.2); return { from: [from.x, from.y, from.z] }; }
      const dx = t.position.x - a.position.x, dz = t.position.z - a.position.z, d = Math.hypot(dx, dz) || 1;
      const x = t.position.x + dx / d * (t.radius + 1.3), z = t.position.z + dz / d * (t.radius + 1.3);
      a.position.set(x, Math.max(groundAt(g, x, z, a.position.y), t.position.y), z);
      a.faceTowards(t.position.x, t.position.z, true);
      g.schedule(0.18, () => { if (t.alive) { g.enemies.damage(t, 2.6, a, { critBonus: 100, stun: 1, kind: 'melee' }); g.hitStop(0.08); g.rig.shake(0.25); } });
      return { from: [from.x, from.y, from.z] };
    },
    visual(c, d) {
      const g = c.game, a = c.actor, f = new THREE.Vector3(...d.from);
      g.fx.dust(f, { count: 18, color: '#4a3a5a', size: 2, speed: 3, life: 1 });
      g.fx.burst(f.clone().setY(f.y + 1.2), '#8a5aff', { count: 20, speed: 4, size: 0.35, life: 0.5 });
      g.fx.dust(a.position, { count: 14, color: '#4a3a5a', size: 1.6, speed: 3, life: 0.8 });
      a.char.playAction('Dualwield_Melee_Attack_Stab', { full: false, timeScale: 1.8 });
      g.fx.weaponTrail(a.char, '#b07aff', { duration: 0.25, delay: 0.05 });
      g.audio?.play('blink', a.position);
    },
  },
  poison: {
    name: 'Carreaux empoisonnés', cd: 25, mana: 20, level: 16, icon: 'poison',
    desc: 'Pendant 12 s, chaque tir empoisonne la cible (4 × 0,3×).',
    cast(c) { c.game.hero.addBuff('poison', 12, {}, { icon: 'poison', label: 'Carreaux empoisonnés' }); return {}; },
    visual(c) { const g = c.game, a = c.actor; a.char.playAction('Use_Item', { full: false, timeScale: 1.6 }); g.fx.aura(a, '#7ee05a', { duration: 1.5, rate: 40 }); g.audio?.play('potion', a.position); },
  },
  fan: {
    name: 'Éventail de lames', cd: 14, mana: 26, level: 20, icon: 'fan',
    desc: 'Projette douze lames tout autour : 1,1× chacune et saignement.',
    cast(c) {
      const g = c.game, a = c.actor;
      g.schedule(0.25, () => {
        const f = chest(a, 1.3, 0);
        for (let i = 0; i < 12; i++) {
          const ang = i / 12 * Math.PI * 2;
          g.projectiles.spawn({ x: f.x, y: f.y, z: f.z, dir: new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang)), speed: 34, range: 15, color: '#e0e6ff', size: 0.25, kind: 'bolt', team: 'player',
            onHit: (e) => { g.enemies.damage(e, 1.1, a, { kind: 'ranged' }); dot(c, e, 0.15, 3, 0.7, '#c0182a'); } });
        }
      });
      return {};
    },
    visual(c) {
      const g = c.game, a = c.actor;
      a.char.playAction('2H_Melee_Attack_Spin', { full: true, timeScale: 1.6 });
      g.schedule(0.25, () => { g.fx.ring(a.position, '#e0e6ff', { to: 5, life: 0.4, y: 1.2 }); g.audio?.play('swoosh', a.position); });
    },
  },
  arrowstorm: {
    name: 'Pluie mortelle', cd: 70, mana: 60, level: 24, icon: 'arrowstorm',
    desc: 'Pendant 2,5 s, une tempête de carreaux s’abat sur la zone visée (9 m) : 10 salves de 0,7×.',
    cast(c) {
      const g = c.game, a = c.actor, p = aimPoint(c, 28);
      a.rooted = 2.6;
      for (let i = 0; i < 10; i++) g.schedule(0.5 + i * 0.25, () => hitRadius(c, p, 9, 0.7, { slow: 2, kind: 'ranged' }));
      return { p: [p.x, p.y, p.z] };
    },
    visual(c, d) {
      const g = c.game, a = c.actor, p = new THREE.Vector3(...d.p);
      a.char.playAction('2H_Ranged_Aiming', { full: true, timeScale: 1.5 });
      g.fx.telegraph(p, 9, 0.5, '#ffe9a8');
      g.fx.runeCircle(p, '#ffe9a8', { radius: 9, life: 3, spin: 1 });
      for (let i = 0; i < 10; i++) g.schedule(0.4 + i * 0.25, () => {
        if (i % 3 === 0) a.char.playAction('2H_Ranged_Shoot', { full: false, timeScale: 2 });
        for (let k = 0; k < 8; k++) {
          const ang = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 8.6;
          const q = new THREE.Vector3(p.x + Math.cos(ang) * r, p.y, p.z + Math.sin(ang) * r);
          q.y = groundAt(g, q.x, q.z, p.y);
          g.fx.lightning(q.clone().add(new THREE.Vector3(2, 16, 0.6)), q, '#ffe9a8', { life: 0.12, segments: 2, jitter: 0 });
          if (k % 3 === 0) g.fx.dust(q, { count: 3, size: 0.8 });
        }
        g.audio?.play('bow', p);
      });
    },
  },
};
Object.assign(ABILITIES, MORE_ABILITIES);

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
  book: 'M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4V4ZM20 4h-4a3 3 0 0 0-3 3M20 4v14h-6',
  arrowstorm: 'M3 3l5 5M8 2l3 7M13 2l1 7M18 3l-3 6M5 21l3-6M12 22v-6M19 21l-3-6M2 14h20',
  bash: 'M5 4h8l4 4v8l-4 4H5V4ZM17 12h5M19 9l3 3-3 3',
  blade: 'M4 20 18 6l2-4-4 2L2 18l2 2ZM14 10l3 3M7 15l2 2',
  consecrate: 'M12 2v6M9 5h6M3 20c3-4 6-5 9-5s6 1 9 5M5 20h14',
  dome: 'M3 18a9 9 0 0 1 18 0H3ZM12 9v4M10 11h4',
  spears: 'M6 2v14M12 2v18M18 2v14M4 6l2-4 2 4M10 6l2-4 2 4M16 6l2-4 2 4',
  crown: 'M3 18h18M4 18 3 7l5 4 4-7 4 7 5-4-1 11',
  shout: 'M4 9v6h4l6 4V5L8 9H4ZM17 8c2 2 2 6 0 8M20 5c4 4 4 10 0 14',
  cleave: 'M3 14a9 9 0 0 1 18 0M6 14l-3 6M18 14l3 6M12 5v4',
  quake: 'M2 12h4l2-5 3 10 3-8 2 3h6M4 20h16',
  axe: 'M14 3a6 6 0 0 1 7 7l-5-2-2-5ZM15 9 4 20',
  blood: 'M12 2c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12Z',
  titan: 'M12 3v8M8 7l4 4 4-4M3 21l4-6h10l4 6H3Z',
  fire: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4 0-6 1-9Z',
  chain: 'M13 2 6 12h5l-3 10 10-13h-6l3-7Z',
  shards: 'M12 2v20M5 5l14 14M19 5 5 19M2 12h20',
  vortex: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 4a8 8 0 1 1-8 8M16 6a6 6 0 1 1-10 6',
  manashield: 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3ZM12 8l-3 5h6l-3 5',
  cataclysm: 'M6 3l4 6M12 2l2 7M18 3l-2 6M8 14a4 4 0 1 0 8 0 4 4 0 0 0-8 0M3 21h18',
  multishot: 'M3 12h14M3 12l14-7M3 12l14 7M15 3l4 2-2 4M19 10l2 2-2 2',
  trap: 'M3 18h18M5 18l2-7 5 4 5-4 2 7M12 15V9',
  shadowstep: 'M9 4a2 2 0 1 0 0 .1M7 22l2-8-3-3 4-4 3 3 3 1M2 12h3M2 16h4',
  poison: 'M9 2h6M10 2v5L5 18a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4L14 7V2M9 15h.1M13 13h.1M12 17h.1',
  fan: 'M12 12 4 4M12 12l8-8M12 12l-8 8M12 12l8 8M12 2v4M12 18v4M2 12h4M18 12h4',

};
