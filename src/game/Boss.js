import * as THREE from 'three';
import { VirtualLight } from '../world/Lights.js';
import { WORLD_BOSSES } from '../config.js';
import { angleDiff } from '../engine/math.js';

// Les boss : une « trousse » par boss (couleur, renforts, attaques par phase) et une
// bibliothèque d'attaques commune, simulée par l'hôte et rejouée chez tous les joueurs.
// Les boss du monde apparaissent quand des héros approchent de leur arène ; ceux des
// expéditions sont invoqués par le mode Expédition via spawnBoss().
export const BOSS_KITS = {
  roi: { name: 'Le Roi Sans Lumière', color: '#8a3cff', glow: '#c06bff', adds: ['warrior', 'minion'],
    attacks: [['slam', 3], ['spin', 2], ['cleave', 2], ['waves', 0, 2.5]],
    spawn: 'Il s’éveille au sommet du Pic du Silence.', down: 'La lumière remonte du Pic du Silence.' },
  colosse: { name: 'Le Colosse d’Ambre', color: '#ff9a3d', glow: '#ffb050', adds: ['amberwarrior', 'amberminion'],
    attacks: [['charge', 3], ['slam', 2], ['cleave', 2], ['quake', 0, 3]],
    spawn: 'Le gardien déchu du Cirque se relève dans un fracas de pierre.', down: 'Le Cirque d’Ambre retrouve son silence.' },
  reine: { name: 'La Reine de Givre', color: '#9fe0ff', glow: '#bff0ff', adds: ['frostling', 'frostarcher'],
    attacks: [['volley', 3], ['frostnova', 2], ['blink', 1], ['blizzard', 0, 3]],
    spawn: 'Un chant glacé descend du Mont Givrecroc.', down: 'La glace se tait. Le Givre respire enfin.' },
  // boss d'expédition (Citadelle des Ombres)
  sentinelle: { name: 'La Sentinelle d’Os', color: '#ffcf6b', glow: '#ffe08a', adds: ['warrior', 'rogue'],
    attacks: [['cleave', 3], ['slam', 2], ['charge', 2], ['quake', 0, 2]],
    spawn: 'La Sentinelle d’Os barre la Porte des Ombres.', down: 'La Porte des Ombres s’ouvre.' },
  liche: { name: 'Morvhain, la Liche', color: '#7dff9a', glow: '#a8ffbf', adds: ['mage', 'minion'],
    attacks: [['volley', 3], ['meteors', 2], ['blink', 1], ['waves', 1], ['blizzard', 0, 2]],
    spawn: 'Morvhain lève les morts de la Nef engloutie.', down: 'Le phylactère de Morvhain se brise.' },
  avatar: { name: 'L’Avatar de la Brume', color: '#c04bff', glow: '#e08aff', adds: ['frostguard', 'amberwarrior', 'mage'],
    attacks: [['slam', 2], ['waves', 2], ['charge', 2], ['meteors', 2], ['frostnova', 1], ['blizzard', 0, 2], ['quake', 0, 2]],
    spawn: 'La Brume prend forme : l’Avatar s’éveille au cœur de la Citadelle.', down: 'L’Avatar se dissipe. Une aube nouvelle se lève sur la Citadelle.' },
};

const _v = new THREE.Vector3();

export class Boss {
  constructor(game) {
    this.game = game;
    this.state = new Map(); // id du boss du monde -> { respawnAt }
    this.summoned = new Map(); // id d'ennemi -> Set(seuils)
    // lumière permanente (éteinte hors combat) : déplacée vers le boss le plus proche
    this.aura = new VirtualLight('#9a4cff', 0, 30, 1.5);
    game.scene.add(this.aura);
    this.glowed = new WeakSet();
    this.zones = []; // zones de blizzard actives (hôte)
  }

  kitOf(e) { return BOSS_KITS[e?.def?.bossId] || BOSS_KITS.roi; }

  bosses() { const out = []; for (const e of this.game.enemies.map.values()) if (e.def.boss) out.push(e); return out; }

  // le boss le plus proche du joueur
  find() {
    const p = this.game.player?.position;
    let best = null, bd = Infinity;
    for (const e of this.bosses()) { const d = p ? Math.hypot(e.position.x - p.x, e.position.z - p.z) : 0; if (d < bd) { bd = d; best = e; } }
    return best;
  }

  spawnBoss(type, x, z, level, { players = 1, home = null } = {}) {
    const g = this.game;
    const e = g.enemies.spawn(type, level, x, z, { home: home || { x, z } });
    const scale = 1 + 0.65 * Math.max(0, players - 1);
    e.maxHp = Math.round(e.maxHp * scale); e.hp = e.maxHp;
    e.radius = 0.55 * (e.def.scale || 2.6); e.height = 2.5 * (e.def.scale || 2.6);
    this.summoned.set(e.id, new Set());
    g.enemies.fx('bossSpawn', e.position, { b: e.def.bossId });
    return e;
  }

  update(dt) {
    const g = this.game;
    this.updateAura(this.find(), dt);
    if (!g.enemies.isHost) return;
    const all = this.bosses();
    if (!g.expedition?.active) {
      // boss du monde : apparition quand des héros montent dans l'arène
      for (const wb of WORLD_BOSSES) {
        const st = this.state.get(wb.id) || { respawnAt: 0 };
        this.state.set(wb.id, st);
        const e = all.find((b) => b.def.bossId === wb.id);
        if (e) {
          if (!e.alive && !e.handled) { e.handled = true; st.respawnAt = Date.now() + wb.respawnMinutes * 60000; g.enemies.fx('bossDown', e.position, { b: wb.id }); }
          continue;
        }
        if (Date.now() < st.respawnAt) continue;
        const players = g.playerTargets().filter((p) => Math.hypot(p.position.x - wb.x, p.position.z - wb.z) < 75 && p.position.y > wb.minY);
        if (players.length) this.spawnBoss(wb.type, wb.x, wb.z, wb.level, { players: players.length });
      }
    } else {
      for (const e of all) if (!e.alive && !e.handled) { e.handled = true; g.enemies.fx('bossDown', e.position, { b: e.def.bossId }); g.expedition.onBossDown?.(e); }
    }
    // renforts aux seuils de vie
    for (const e of all) {
      if (!e.alive) continue;
      const kit = this.kitOf(e);
      let done = this.summoned.get(e.id);
      if (!done) { done = new Set(); this.summoned.set(e.id, done); }
      for (const th of [0.7, 0.4, 0.15]) {
        if (e.hpPct < th && !done.has(th)) {
          done.add(th);
          for (let i = 0; i < 4; i++) {
            const a = i / 4 * Math.PI * 2 + Math.random();
            const x = e.position.x + Math.cos(a) * 8, z = e.position.z + Math.sin(a) * 8;
            if (g.world.terrain.heightAt(x, z) === null) continue;
            g.enemies.spawn(kit.adds[i % kit.adds.length], Math.max(1, e.level - 4), x, z, { home: e.home });
          }
          g.enemies.fx('bossSummon', e.position, { b: e.def.bossId });
        }
      }
    }
    // zones de blizzard : dégâts et gel périodiques
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t -= dt; z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = 0.8;
        for (const p of g.playerTargets()) if (Math.hypot(p.position.x - z.x, p.position.z - z.z) < z.r) g.hurtPlayer(p.id, z.dmg, z.src, { kind: 'chill' });
      }
      if (z.t <= 0) this.zones.splice(i, 1);
    }
  }

  // ------------------------------------------------------------------ choix d'attaque (hôte)
  chooseAttack(e, tgt) {
    const kit = this.kitOf(e);
    if (e.hpPct < 0.25) e.attackCd *= 0.7; // enragé
    const phase2 = e.hpPct < 0.55;
    const d = Math.hypot(tgt.position.x - e.position.x, tgt.position.z - e.position.z);
    // poids des attaques : [id, phase 1, phase 2]
    const pool = kit.attacks.map(([id, w1, w2]) => [id, phase2 ? (w2 ?? w1) : w1]).filter(([, w]) => w > 0);
    let r = Math.random() * pool.reduce((s, [, w]) => s + w, 0), pick = pool[0][0];
    for (const [id, w] of pool) { r -= w; if (r <= 0) { pick = id; break; } }
    // corps à corps hors de portée : une attaque à distance à la place
    if ((pick === 'cleave' || pick === 'spin') && d > 7.5) pick = pool.some(([id]) => id === 'charge') ? 'charge' : 'slam';
    (ATTACKS[pick] || ATTACKS.slam)(this, e, tgt, kit);
    e.atkCount++;
  }

  hurtAll(b, test, mult, kind = 'boss') {
    const g = this.game;
    for (const p of g.playerTargets()) if (test(p)) g.hurtPlayer(p.id, b.atk * mult, b, { kind: b.def.chill && kind === 'boss' ? 'chill' : kind });
  }

  // ------------------------------------------------------------------ visuels (tous les clients)
  playFx(ev, p) {
    const g = this.game, fx = g.fx;
    const kit = BOSS_KITS[ev.b] || BOSS_KITS.roi;
    const c = ev.c || kit.color;
    switch (ev.type) {
      case 'bossSpawn':
        fx.beam(p, c, { height: 60, radius: 5, life: 2.5 });
        fx.explosion(p, c, 7);
        g.ui.announce(kit.name, kit.spawn, 4);
        g.audio?.play('summon', p); g.shakeAt(p, 1);
        break;
      case 'bossDown':
        fx.beam(p, '#ffe7a0', { height: 120, radius: 6, life: 3 });
        fx.explosion(p, '#ffd36b', 9);
        g.ui.announce(`${kit.name} est vaincu`, kit.down, 5);
        g.audio?.play('beacon', p);
        g.chat?.system(`✦ ${kit.name} a été vaincu !`);
        break;
      case 'bossSlam':
        fx.explosion(p, c, (ev.r || 8) * 0.8);
        fx.shockwave(p, c, ev.r || 8);
        g.audio?.play('slam', p); g.shakeAt(p, 1);
        break;
      case 'bossSpin':
        for (let k = 0; k < 5; k++) g.schedule(k * 0.4, () => { fx.ring(p, c, { from: 2, to: 6.5, life: 0.4 }); g.audio?.play('swoosh', p); });
        break;
      case 'bossWaves':
        g.audio?.play('summon', p);
        for (let w = 0; w < 3; w++) g.schedule(0.9 + w * 0.55, () => { fx.ring(p, c, { from: Math.max(1, 6 + w * 6 - 3), to: 6 + w * 6 + 1, life: 0.5, intensity: 3.5, thickness: 2 }); g.audio?.play('boom', p); });
        fx.telegraph(p, 18, 0.9, c);
        break;
      case 'bossSummon':
        fx.runeCircle(p, c, { radius: 10, life: 2 });
        g.audio?.play('summon', p);
        g.ui.toast(`${kit.name} appelle des renforts !`, { color: '#e2ccff' });
        break;
      case 'bossLine': {
        // couloir annoncé (charge)
        const len = ev.len || 18, n = Math.ceil(len / 3);
        for (let k = 0; k <= n; k++) {
          const t = k / n;
          fx.telegraph({ x: p.x + Math.sin(ev.rot) * len * t, y: p.y, z: p.z + Math.cos(ev.rot) * len * t }, ev.w || 2.2, ev.d || 1.1, c);
        }
        g.audio?.play('roar', p);
        break;
      }
      case 'bossCharge':
        fx.dust(p, { count: 30, speed: 6, size: 2 });
        fx.shockwave(p, c, 5);
        g.audio?.play('slam', p); g.shakeAt(p, 0.7);
        break;
      case 'bossImpact':
        fx.explosion(p, c, ev.r || 4);
        g.audio?.play('boom', p); g.shakeAt(p, 0.5);
        break;
      case 'bossMeteor':
        fx.meteor(p, c, ev.d || 1.2);
        break;
      case 'bossNova':
        fx.telegraph(p, ev.r || 10, ev.d || 1.2, c);
        g.schedule(ev.d || 1.2, () => { fx.ring(p, c, { from: 1, to: ev.r || 10, life: 0.5, intensity: 3.5, thickness: 2 }); fx.burst({ x: p.x, y: p.y + 1, z: p.z }, '#e8faff', { count: 60, speed: 16, size: 0.4, life: 0.6, gravity: 2, spread: 0.2 }); g.audio?.play('frost', p); });
        break;
      case 'bossZone':
        fx.telegraph(p, ev.r || 3.5, ev.d || 4, c);
        for (let k = 0; k < 8; k++) g.schedule(k * 0.5, () => fx.burst({ x: p.x + (Math.random() - 0.5) * (ev.r || 3.5) * 1.5, y: p.y + 4, z: p.z + (Math.random() - 0.5) * (ev.r || 3.5) * 1.5 }, '#e8faff', { count: 8, speed: 2, size: 0.3, life: 1.2, gravity: 4 }));
        break;
      case 'bossBlink':
        fx.flashSphere(p, c, 3, 0.4);
        fx.burst({ x: p.x, y: p.y + 2, z: p.z }, c, { count: 30, speed: 8, size: 0.4, life: 0.6 });
        g.audio?.play('blink', p);
        break;
      case 'bossVolley':
        // l'hôte voit déjà ses vrais projectiles ; les autres en voient une copie visuelle
        if (!g.enemies.isHost) for (const dir of ev.dirs || []) g.projectiles.spawn({ x: p.x, y: p.y + 2.5, z: p.z, dir: new THREE.Vector3(dir[0], dir[1], dir[2]), speed: 22, range: 34, color: c, size: 0.5, kind: 'orb', team: 'enemy', visualOnly: true });
        g.audio?.play('cast', p);
        break;
    }
  }

  updateAura(boss, dt) {
    const g = this.game;
    if (!boss || !boss.alive) { this.aura.intensity = 0; return; }
    const kit = this.kitOf(boss);
    this.aura.intensity = 30;
    this.aura.color.set(kit.color);
    this.aura.position.set(boss.position.x, boss.position.y + 5, boss.position.z);
    if (!this.glowed.has(boss)) {
      this.glowed.add(boss);
      for (const m of boss.char.materials) if (m.name === 'Glow') { m.emissive.set(kit.glow); m.emissiveIntensity = 5; m.userData.baseEmissive = m.emissive.clone(); m.userData.baseEmissiveIntensity = 5; }
    }
    if (Math.random() < dt * 25) {
      const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 2.5;
      g.fx.sparkle(new THREE.Vector3(boss.position.x + Math.cos(a) * r, boss.position.y + Math.random() * 4, boss.position.z + Math.sin(a) * r), kit.color, 0.4, 1, 0.45);
    }
  }
}

// ------------------------------------------------------------------ bibliothèque d'attaques
const ATTACKS = {
  // saut et onde de choc annoncée au sol
  slam(B, e, tgt, kit) {
    const en = B.game.enemies;
    const d = Math.hypot(tgt.position.x - e.position.x, tgt.position.z - e.position.z);
    e.char.playAction('1H_Melee_Attack_Jump_Chop', { full: true, timeScale: 0.75 });
    e.casting = 1.7;
    const p = d > 7 ? tgt.position.clone() : e.position.clone();
    const r = d > 7 ? 6 : 9;
    en.fx('telegraph', p, { r, d: 1.4, c: kit.color });
    e.pending = { t: 1.4, custom: (b) => { en.fx('bossSlam', p, { r, b: b.def.bossId }); B.hurtAll(b, (pl) => Math.hypot(pl.position.x - p.x, pl.position.z - p.z) < r, 1.5); } };
  },
  // trois anneaux qui s'étendent : il faut se placer entre eux
  waves(B, e, tgt, kit) {
    const g = B.game, en = g.enemies;
    e.char.playAction('Spellcast_Summon', { full: true, timeScale: 1.6 });
    e.casting = 2.2;
    const c = e.position.clone();
    en.fx('bossWaves', c, { b: e.def.bossId });
    e.pending = { t: 0.9, custom: (b) => {
      for (let w = 0; w < 3; w++) g.schedule(w * 0.55, () => {
        const r = 6 + w * 6;
        B.hurtAll(b, (p) => { const pd = Math.hypot(p.position.x - c.x, p.position.z - c.z); return Math.abs(pd - r) < 2.2 && p.position.y < c.y + 3; }, 0.9);
      });
    } };
  },
  spin(B, e) {
    const g = B.game, en = g.enemies;
    e.char.playAction('2H_Melee_Attack_Spin', { full: true, timeScale: 1 });
    e.casting = 2.4;
    en.fx('bossSpin', e.position, { b: e.def.bossId });
    e.pending = { t: 0.3, custom: (b) => {
      for (let k = 0; k < 5; k++) g.schedule(k * 0.4, () => { if (b.alive) B.hurtAll(b, (pl) => Math.hypot(pl.position.x - b.position.x, pl.position.z - b.position.z) < 6.5, 0.45); });
    } };
  },
  cleave(B, e) {
    const en = B.game.enemies;
    e.playAttack();
    e.pending = { t: 0.75, custom: (b) => {
      en.fx('swing', b.position, { rot: b.rot, boss: true });
      B.hurtAll(b, (pl) => { const dx = pl.position.x - b.position.x, dz = pl.position.z - b.position.z; return Math.hypot(dx, dz) < 7.5 && Math.abs(angleDiff(b.rot, Math.atan2(dx, dz))) < 1.2; }, 1.2);
    } };
  },
  // charge en ligne droite le long d'un couloir annoncé
  charge(B, e, tgt) {
    const g = B.game, en = g.enemies;
    const rot = Math.atan2(tgt.position.x - e.position.x, tgt.position.z - e.position.z);
    const len = Math.min(24, Math.hypot(tgt.position.x - e.position.x, tgt.position.z - e.position.z) + 6);
    e.rot = rot;
    e.char.playAction('2H_Melee_Attack_Chop', { full: true, timeScale: 0.6 });
    e.casting = 2.0;
    const start = e.position.clone();
    en.fx('bossLine', start, { rot, len, w: 2.4, d: 1.1, b: e.def.bossId });
    e.pending = { t: 1.1, custom: (b) => {
      const steps = 8, hit = new Set();
      for (let k = 1; k <= steps; k++) g.schedule(k * 0.06, () => {
        if (!b.alive) return;
        const t = k / steps;
        const nx = start.x + Math.sin(rot) * len * t, nz = start.z + Math.cos(rot) * len * t;
        const gy = g.world.terrain.heightAt(nx, nz);
        if (gy === null) return;
        b.position.set(nx, gy, nz);
        for (const p of g.playerTargets()) {
          if (hit.has(p.id) || Math.hypot(p.position.x - nx, p.position.z - nz) > 3.4) continue;
          hit.add(p.id);
          g.hurtPlayer(p.id, b.atk * 1.6, b, { kind: 'boss' });
        }
        if (k === steps) en.fx('bossCharge', b.position, { b: b.def.bossId });
      });
    } };
  },
  // impacts annoncés sous chaque héros
  quake(B, e, tgt, kit) {
    const g = B.game, en = g.enemies;
    e.char.playAction('1H_Melee_Attack_Jump_Chop', { full: true, timeScale: 0.9 });
    e.casting = 1.8;
    const spots = [];
    for (const p of g.playerTargets()) {
      if (Math.hypot(p.position.x - e.position.x, p.position.z - e.position.z) > 40) continue;
      spots.push(p.position.clone());
      spots.push(p.position.clone().add(_v.set((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10)));
    }
    for (const s of spots) { s.y = g.world.terrain.heightAt(s.x, s.z) ?? s.y; en.fx('telegraph', s, { r: 4, d: 1.4, c: kit.color }); }
    e.pending = { t: 1.4, custom: (b) => {
      for (const s of spots) { en.fx('bossImpact', s, { r: 4, b: b.def.bossId }); B.hurtAll(b, (p) => Math.hypot(p.position.x - s.x, p.position.z - s.z) < 4, 1.1); }
    } };
  },
  // pluie de météores sur la zone
  meteors(B, e) {
    const g = B.game, en = g.enemies;
    e.char.playAction('Spellcast_Summon', { full: true, timeScale: 1.4 });
    e.casting = 2.0;
    const spots = [];
    for (const p of g.playerTargets()) if (Math.hypot(p.position.x - e.position.x, p.position.z - e.position.z) < 45) for (let k = 0; k < 2; k++) spots.push(p.position.clone().add(_v.set((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8)));
    spots.forEach((s, k) => {
      s.y = g.world.terrain.heightAt(s.x, s.z) ?? s.y;
      g.schedule(k * 0.25, () => en.fx('bossMeteor', s, { d: 1.2, b: e.def.bossId }));
      g.schedule(k * 0.25 + 1.2, () => { if (e.alive) B.hurtAll(e, (p) => Math.hypot(p.position.x - s.x, p.position.z - s.z) < 5.5, 1.2); });
    });
  },
  // salve en éventail d'orbes vers la cible
  volley(B, e, tgt, kit) {
    const g = B.game, en = g.enemies;
    e.char.playAction('Spellcast_Shoot', { full: true, timeScale: 1.2 });
    e.casting = 1.1;
    e.pending = { t: 0.5, custom: (b) => {
      const from = b.position.clone();
      const base = Math.atan2(tgt.position.x - from.x, tgt.position.z - from.z);
      const dirs = [];
      for (let k = -2; k <= 2; k++) {
        const a = base + k * 0.2;
        const dir = new THREE.Vector3(Math.sin(a), -0.04, Math.cos(a));
        dirs.push([+dir.x.toFixed(3), +dir.y.toFixed(3), +dir.z.toFixed(3)]);
        g.projectiles.spawn({ x: from.x, y: from.y + 2.5, z: from.z, dir, speed: 22, range: 34, color: kit.color, size: 0.5, kind: 'orb', team: 'enemy',
          onHit: (t) => g.hurtPlayer(t.id, b.atk * 0.7, b, { kind: b.def.chill ? 'chill' : 'shadow' }) });
      }
      en.fx('bossVolley', from, { dirs, b: b.def.bossId });
    } };
  },
  // anneau de givre autour du boss
  frostnova(B, e) {
    const en = B.game.enemies;
    e.char.playAction('Spellcast_Raise', { full: true, timeScale: 1 });
    e.casting = 1.6;
    const c = e.position.clone();
    en.fx('bossNova', c, { r: 11, d: 1.2, b: e.def.bossId });
    e.pending = { t: 1.2, custom: (b) => B.hurtAll(b, (p) => Math.hypot(p.position.x - c.x, p.position.z - c.z) < 11, 1.0, 'chill') };
  },
  // zones de blizzard sous les héros, qui blessent et ralentissent
  blizzard(B, e) {
    const g = B.game, en = g.enemies;
    e.char.playAction('Spellcast_Long', { full: true, timeScale: 1 });
    e.casting = 1.4;
    for (const p of g.playerTargets()) {
      if (Math.hypot(p.position.x - e.position.x, p.position.z - e.position.z) > 40) continue;
      const s = p.position.clone();
      en.fx('bossZone', s, { r: 4, d: 4, b: e.def.bossId });
      B.zones.push({ x: s.x, z: s.z, r: 4, t: 4, tick: 0.6, dmg: e.atk * 0.35, src: e });
    }
  },
  // disparaît et réapparaît près du héros le plus éloigné
  blink(B, e, tgt, kit) {
    const g = B.game, en = g.enemies;
    let far = tgt, fd = 0;
    for (const p of g.playerTargets()) { const d = Math.hypot(p.position.x - e.position.x, p.position.z - e.position.z); if (d > fd && d < 45) { fd = d; far = p; } }
    const a = Math.random() * Math.PI * 2;
    const x = far.position.x + Math.cos(a) * 6, z = far.position.z + Math.sin(a) * 6;
    const gy = g.world.terrain.heightAt(x, z);
    if (gy === null || Math.hypot(x - e.home.x, z - e.home.z) > 36) return ATTACKS.frostnova(B, e, tgt, kit);
    en.fx('bossBlink', e.position, { b: e.def.bossId });
    e.position.set(x, gy, z);
    e.rot = Math.atan2(far.position.x - x, far.position.z - z);
    en.fx('bossBlink', e.position, { b: e.def.bossId });
    e.attackCd = 0.6;
  },
};
