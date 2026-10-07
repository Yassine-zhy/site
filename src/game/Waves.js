import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { SPAWN_ZONES, VILLAGE, HAMLET, REGIONS, ENEMIES } from '../config.js';

// Vagues de la Brume : de temps en temps, une faille s'ouvre près d'un héros et lâche trois
// vagues de monstres de la région. L'hôte décide et fait apparaître les monstres ; tout le
// monde voit la faille et la jauge. À la fin, chaque héros présent reçoit un coffre.
const GAP = [200, 420]; // secondes entre deux vagues
const WAVES = 3;
const PH = ['warn', 'fight', 'pause', 'done'];

export class Waves {
  constructor(game) {
    this.game = game;
    this.cur = null;
    this.timer = 100 + Math.random() * 120;
    this.claimed = new Set();
    this.portal = null;
    this.banner = h('div', { class: 'wave-banner' });
    this.banner.hidden = true;
    game.ui.topStack.appendChild(this.banner);
  }

  reset() {
    this.cur = null; this.banner.hidden = true;
    if (this.portal) { this.game.scene.remove(this.portal.grp); this.portal = null; }
  }

  get current() { return this.cur && this.cur.ph !== 'done' ? this.cur : null; }

  // ------------------------------------------------------------------ hôte
  inSafeZone(x, z) {
    if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.radius + 45) return true;
    if (Math.hypot(x - HAMLET.x, z - HAMLET.z) < HAMLET.radius + 40) return true;
    for (const b of REGIONS) if (b.camp && Math.hypot(x - b.camp.x, z - b.camp.z) < (b.camp.radius || 20) + 30) return true;
    return false;
  }

  pickSpot() {
    const g = this.game, terrain = g.world.terrain;
    const players = g.playerTargets().filter((p) => p.alive && p.position.x < 3500 && !this.inSafeZone(p.position.x, p.position.z));
    if (!players.length || g.expedition?.active) return null;
    const p = players[Math.floor(Math.random() * players.length)];
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 6;
      const x = p.position.x + Math.cos(a) * r, z = p.position.z + Math.sin(a) * r;
      const y = terrain.heightAt(x, z);
      if (y === null || terrain.slopeAt(x, z) > 0.4 || this.inSafeZone(x, z) || Math.abs(y - p.position.y) > 6) continue;
      // région : la zone de monstres la plus proche donne le niveau et les espèces
      let zone = null, zd = Infinity;
      for (const s of SPAWN_ZONES) { const d = Math.hypot(s.x - x, s.z - z); if (d < s.radius * 2.2 && d < zd) { zd = d; zone = s; } }
      const heroLvl = p.isLocal ? g.hero.level : (g.remotePlayers.get(p.id)?.level || g.hero.level);
      const lvl = zone ? Math.round((zone.level[0] + zone.level[1]) / 2) : Math.max(1, heroLvl);
      const types = zone ? zone.types : ['minion', 'slime', 'wolf', 'spider'];
      return { x, y, z, lvl, types };
    }
    return null;
  }

  start(s) {
    this.cur = { id: Date.now().toString(36).slice(-6), x: s.x, z: s.z, lvl: s.lvl, types: s.types, n: 0, ph: 'warn', t: 6.5, ids: new Set(), left: 0, away: 0 };
  }

  spawnWave() {
    const g = this.game, c = this.cur;
    c.n++;
    const near = g.playerTargets().filter((p) => Math.hypot(p.position.x - c.x, p.position.z - c.z) < 60).length;
    const count = 3 + c.n * 2 + Math.max(0, near - 1) * 2;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4, r = 2.5 + Math.random() * 3.5;
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (!g.world.terrain.isLand(x, z)) continue;
      let type = c.types[Math.floor(Math.random() * c.types.length)];
      if (ENEMIES[type]?.boss) type = 'minion';
      const elite = c.n === WAVES && i === 0;
      const e = g.enemies.spawn(type, c.lvl + (c.n === WAVES ? 1 : 0), x, z, { home: { x: c.x, z: c.z }, elite });
      e.wave = c.id;
      c.ids.add(e.id);
    }
    c.ph = 'fight';
    g.enemies.fx('summon', { x: c.x, y: g.world.terrain.heightAt(c.x, c.z) ?? 0, z: c.z });
  }

  onKill(e) { if (this.cur && e.wave === this.cur.id) this.cur.ids.delete(e.id); }

  hostUpdate(dt) {
    const g = this.game;
    if (!this.cur) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = GAP[0] + Math.random() * (GAP[1] - GAP[0]);
        const s = this.pickSpot();
        if (s) this.start(s);
      }
      return;
    }
    const c = this.cur;
    c.t -= dt;
    for (const id of [...c.ids]) { const e = g.enemies.map.get(id); if (!e || !e.alive) c.ids.delete(id); }
    c.left = c.ids.size;
    // plus personne : la faille se referme
    const near = g.playerTargets().some((p) => Math.hypot(p.position.x - c.x, p.position.z - c.z) < 80);
    c.away = near ? 0 : c.away + dt;
    if (c.away > 30 && c.ph !== 'done') { for (const id of c.ids) { const e = g.enemies.map.get(id); if (e && !e.target) g.enemies.remove(id); } c.ph = 'done'; c.t = 0; c.failed = true; }
    if (c.ph === 'warn' && c.t <= 0) this.spawnWave();
    else if (c.ph === 'fight' && c.left === 0) { if (c.n < WAVES) { c.ph = 'pause'; c.t = 4; } else { c.ph = 'done'; c.t = 15; } }
    else if (c.ph === 'pause' && c.t <= 0) this.spawnWave();
    else if (c.ph === 'done' && c.t <= 0) this.cur = null;
  }

  publicState() {
    const c = this.cur;
    return c ? [c.id, Math.round(c.x), Math.round(c.z), c.n, PH.indexOf(c.ph), c.left, c.lvl, c.failed ? 1 : 0] : null;
  }

  // client : copie de l'état publié par l'hôte
  applyHostState(s) {
    if (!Array.isArray(s)) { if (this.cur && !this.game.enemies.isHost) this.cur = null; return; }
    const [id, x, z, n, ph, left, lvl, failed] = s;
    if (!this.cur || this.cur.id !== id) this.cur = { id, x, z, ids: new Set() };
    Object.assign(this.cur, { n, ph: PH[ph] || 'warn', left, lvl, failed: !!failed });
  }

  // ------------------------------------------------------------------ tous
  update(dt) {
    const g = this.game;
    if (g.enemies.isHost) this.hostUpdate(dt);
    const c = this.cur, p = g.player;
    this.updatePortal(dt, c);
    // annonce, jauge et récompense pour les héros proches
    const near = c && p && Math.hypot(p.position.x - c.x, p.position.z - c.z) < 70;
    if (c && near && !c.seen) { c.seen = true; g.ui.announce('La Brume se déchire !', 'Une vague de monstres approche — tenez bon', 3.2); g.audio?.play('summon', p.position); g.vibrate?.(80); }
    if (c && c.ph === 'done' && !c.failed && near && !this.claimed.has(c.id)) this.reward(c);
    const show = !!(c && near && c.ph !== 'done');
    this.banner.hidden = !show;
    if (show) {
      const txt = c.ph === 'warn' ? `Vague de la Brume · la faille s’ouvre…` : c.ph === 'pause' ? `Vague ${c.n}/${WAVES} repoussée · la suivante arrive…` : `Vague ${c.n}/${WAVES} · ${c.left} monstre${c.left > 1 ? 's' : ''}`;
      if (this.banner.textContent !== txt) this.banner.textContent = txt;
    }
  }

  reward(c) {
    const g = this.game;
    this.claimed.add(c.id);
    const pos = new THREE.Vector3(c.x, g.world.terrain.heightAt(c.x, c.z) ?? g.player.position.y, c.z);
    g.loot.drop(pos, { chest: Math.random() < 0.25 ? 'or' : 'fer' });
    g.loot.drop(pos, { gold: Math.round(20 + (c.lvl || 1) * 8) });
    g.gainXp(Math.round(60 + (c.lvl || 1) * 35));
    g.ui.announce('Vague repoussée !', 'Un coffre vous attend près de la faille', 3);
    g.audio?.play('levelup');
    g.quests?.onEvent('wave', {});
    g.save?.soon();
  }

  updatePortal(dt, c) {
    const g = this.game;
    const active = c && c.ph !== 'done';
    if (active && !this.portal) {
      const grp = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.16, 8, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color('#c78bff').multiplyScalar(2.2), toneMapped: false }));
      const disc = new THREE.Mesh(new THREE.CircleGeometry(2.1, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color('#5a2aa0').multiplyScalar(1.6), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      ring.position.y = disc.position.y = 2.6;
      grp.add(ring, disc);
      g.scene.add(grp);
      this.portal = { grp, ring, disc, s: 0 };
    }
    const P = this.portal;
    if (!P) return;
    if (active) {
      P.grp.position.set(c.x, (g.world.terrain.heightAt(c.x, c.z) ?? 0), c.z);
      P.s = Math.min(1, P.s + dt * 0.6);
      // la faille fait face au joueur
      const pl = g.player?.position;
      if (pl) P.grp.rotation.y = Math.atan2(pl.x - c.x, pl.z - c.z);
    } else P.s -= dt * 0.8;
    P.ring.rotation.z += dt * 1.5;
    P.disc.rotation.z -= dt * 2.4;
    P.grp.scale.setScalar(Math.max(0.001, P.s) * (1 + Math.sin(g.elapsed * 3) * 0.04));
    if (active && Math.random() < dt * 30) {
      const a = Math.random() * Math.PI * 2;
      g.fx.sparkle(new THREE.Vector3(P.grp.position.x + Math.cos(a) * 2.2 * Math.cos(P.grp.rotation.y), P.grp.position.y + 2.6 + Math.sin(a) * 2.2, P.grp.position.z - Math.cos(a) * 2.2 * Math.sin(P.grp.rotation.y)), '#c78bff', 0.3, 1, 0.25);
    }
    if (P.s <= 0) { g.scene.remove(P.grp); P.grp.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); this.portal = null; }
  }
}
