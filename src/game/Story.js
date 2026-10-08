import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { ENEMIES, SEA_LEVEL } from '../config.js';
import { MAIN_IDS } from './Quests.js';
import { Aura } from '../world/Aura.js';
import { PROLOGUE, ACTS, SHARDS, SHARD_OF, LORDS, SEALS, ARENA_QUEST, ARENA_NEED, ELDER_LINES, STELES } from './Lore.js';

// L'histoire d'Aetheria mise en scène : prologue, actes, sceaux de Brume qui ferment les terres
// lointaines tant que le récit n'y mène pas, Éclats repris aux seigneurs, stèles de mémoire et
// Chroniques. La progression suit la chaîne des quêtes principales : une étape « est atteinte »
// dès que sa quête est proposée au héros.

const WALL_H = 64;        // hauteur du rideau de Brume
const STELE_R = 3.2;      // distance de lecture d'une stèle

export class Story {
  constructor(game) {
    this.game = game;
    this.lore = null;
    this.banners = [];
    this.bannerBusy = false;
    this.msgT = 0;
    this.checkT = 0;
    this.blocking = false;
    this.seals = SEALS.map((s) => ({ ...s, open: true, wall: null, dissolve: 0 }));
    this.noise = makeNoiseTexture();
    this.buildWalls();
    this.buildSteles();
    this.aura = new Aura(game);
    this.banner = h('div', { class: 'lore-banner' });
    this.banner.hidden = true;
    game.ui.root.append(this.banner);
  }

  // ------------------------------------------------------------------ progression
  idx(id) { return MAIN_IDS.indexOf(id); }
  reached(id) { const i = this.idx(id); return this.game.storyFree || (i >= 0 && i <= (this.game.quests?.mainIdx ?? 0)); }
  act() { let a = 0; for (const A of ACTS) if (this.reached(A.from)) a = Math.max(a, A.n); return a; }
  actInfo(n = this.act()) { return ACTS[n] || ACTS[0]; }
  sealOpen(s) { return this.reached(s.quest); }
  arenaOpen(boss) { const q = ARENA_QUEST[boss]; return !q || this.reached(q); }
  arenaNeed(boss) { return ARENA_NEED[boss] || 'Le récit ne vous mène pas encore ici'; }
  expeditionOpen(ex) { return ex === 'arene' ? this.reached('m16') : this.reached('m15'); }
  expeditionNeed(ex) { return ex === 'arene' ? 'Terrassez d’abord le Roi, le Colosse et la Reine' : 'Il faut d’abord reprendre les cinq Éclats (Acte V)'; }
  shardCount() { return Object.keys(this.lore?.shards || {}).length; }
  hasShard(k) { return !!this.lore?.shards?.[k]; }

  // le héros chargé (au démarrage et après un changement de sauvegarde)
  attach() {
    const g = this.game, hero = g.hero;
    const L = hero.lore || (hero.lore = {});
    L.steles ||= {}; L.shards ||= {};
    // anciennes sauvegardes : les seigneurs déjà terrassés ont rendu leur Éclat
    for (const [boss, q] of Object.entries(ARENA_QUEST)) if (g.quests.done.has(q)) L.shards[SHARD_OF[boss]] ||= 1;
    const veteran = g.quests.mainIdx > 0 || hero.level > 2;
    if (L.prologue === undefined) L.prologue = veteran;
    if (L.act === undefined) L.act = veteran ? this.act() : 0;
    this.lore = L;
    for (const s of this.seals) { s.open = this.sealOpen(s); s.dissolve = s.open ? 1 : 0; this.setWall(s); }
    this.banners.length = 0;
    this.stelesDirty = true;
    this.escapeSeal();
    this.aura.setCrown(this.lore.shards);
    this.aura.updateStatues(this.lore.shards);
  }

  // début de partie : prologue pour un nouveau héros, puis le guide de bienvenue
  begin(then) {
    if (this.lore && !this.lore.prologue) this.playPrologue(then);
    else then?.();
  }

  // ------------------------------------------------------------------ prologue
  playPrologue(then) {
    const g = this.game;
    this.blocking = true;
    g.player.invulnerableT = 999;
    const line = h('div', { class: 'pl-line' });
    const skip = h('button', { class: 'pl-skip', type: 'button' }, 'Passer ›');
    const el = h('div', { class: 'prologue' }, h('div', { class: 'pl-title' }, 'Aetheria'), line, skip);
    g.ui.root.append(el);
    g.input.exitLock?.();
    g.audio?.playTheme?.('prologue');
    let i = -1, t = null, ended = false;
    const end = () => {
      if (ended) return;
      ended = true; clearTimeout(t);
      el.classList.add('out');
      setTimeout(() => el.remove(), 1400);
      this.blocking = false;
      g.player.invulnerableT = 1;
      this.lore.prologue = true;
      g.save?.soon(1);
      g.audio?.playTheme?.(null);
      g.schedule(1.2, () => this.showBanner({ small: ACTS[0].title, big: ACTS[0].name, text: 'Havrelumière, dernier refuge de l’Aube' }));
      g.schedule(5.5, () => then?.());
    };
    const next = () => {
      i++;
      if (i >= PROLOGUE.length) { end(); return; }
      line.classList.remove('show');
      setTimeout(() => {
        line.textContent = PROLOGUE[i];
        line.classList.toggle('last', i === PROLOGUE.length - 1);
        void line.offsetWidth; line.classList.add('show');
      }, i === 0 ? 900 : 650);
      clearTimeout(t);
      t = setTimeout(next, (i === 0 ? 900 : 650) + Math.max(3600, PROLOGUE[i].length * 62));
    };
    skip.addEventListener('click', (e) => { e.stopPropagation(); end(); });
    el.addEventListener('click', () => next());
    next();
  }

  // ------------------------------------------------------------------ bannières (façon Elden Ring)
  showBanner(b) {
    if (this.banners.some((x) => x.big === b.big)) return;
    this.banners.push(b);
    if (!this.bannerBusy) this.nextBanner();
  }

  nextBanner() {
    const b = this.banners.shift();
    const el = this.banner;
    if (!b) { this.bannerBusy = false; el.hidden = true; return; }
    this.bannerBusy = true;
    el.className = 'lore-banner ' + (b.cls || '');
    el.innerHTML = '';
    el.append(
      b.small ? h('div', { class: 'lb-small' }, b.small) : null,
      h('div', { class: 'lb-big', style: b.color ? { color: b.color } : {} }, b.big),
      h('div', { class: 'lb-line' }),
      b.text ? h('div', { class: 'lb-text' }, b.text) : null,
    );
    el.hidden = false;
    void el.offsetWidth; el.classList.add('show');
    if (b.sting) this.game.audio?.sting?.(b.sting, b.sound);
    else if (b.sound) this.game.audio?.play(b.sound, null);
    const dur = b.time || 5.2;
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => this.nextBanner(), 900);
    }, dur * 1000);
  }

  // ------------------------------------------------------------------ Éclats
  onKill(k) {
    if (!k.boss || !this.lore) return;
    const boss = ENEMIES[k.type]?.bossId;
    const key = SHARD_OF[boss];
    if (!key || this.lore.shards[key]) return;
    this.grantShard(key, boss);
  }

  grantShard(key, boss) {
    const g = this.game, S = SHARDS[key], lord = LORDS[boss];
    this.lore.shards[key] = Date.now();
    g.save?.soon(1);
    g.schedule(6.2, () => {
      this.showBanner({ small: 'Éclat repris', big: S.name, text: lord?.fall || '', color: S.color, cls: 'shard', sting: 'shard', sound: 'levelup', time: 6 });
      this.aura.setCrown(this.lore.shards, key);
      this.aura.updateStatues(this.lore.shards);
      g.fx.beam(g.player.position.clone(), S.color, { height: 90, radius: 2.6, life: 2.6 });
      const n = this.shardCount();
      g.chat?.system(`${lord?.name || 'Le seigneur'} était ${lord?.true || 'un gardien de l’Aube'}. Son histoire est inscrite dans vos Chroniques (${g.input.isTouch ? 'menu ☰' : 'touche U'}). Éclats repris : ${n}/5.`, 14);
    });
  }

  // ------------------------------------------------------------------ sceaux de Brume
  buildWalls() {
    const g = this.game, t = g.world.terrain;
    for (const s of this.seals) {
      const n = Math.ceil((Math.PI * 2 * s.r) / 7);
      const pos = new Float32Array((n + 1) * 2 * 3), uv = new Float32Array((n + 1) * 2 * 2);
      const ground = [];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = s.x + Math.cos(a) * s.r, z = s.z + Math.sin(a) * s.r;
        ground.push(Math.max(t.heightAt(x, z) ?? SEA_LEVEL, SEA_LEVEL));
      }
      // sommet lissé : le rideau suit le relief sans dents de scie
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = s.x + Math.cos(a) * s.r, z = s.z + Math.sin(a) * s.r;
        let top = 0, c = 0;
        for (let k = -6; k <= 6; k++) { top += ground[(i + k + n) % n]; c++; }
        top = top / c + WALL_H;
        const b = i * 6;
        pos[b] = x; pos[b + 1] = ground[i] - 6; pos[b + 2] = z;
        pos[b + 3] = x; pos[b + 4] = Math.max(top, ground[i] + WALL_H * 0.7); pos[b + 5] = z;
        const u = (i / n) * Math.PI * 2 * s.r / 34;
        uv[i * 4] = u; uv[i * 4 + 1] = 0; uv[i * 4 + 2] = u; uv[i * 4 + 3] = 1;
      }
      const idx = [];
      for (let i = 0; i < n; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      const mat = mistMaterial(this.noise);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = true;
      mesh.renderOrder = 3;
      mesh.visible = false;
      mesh.matrixAutoUpdate = false;
      g.scene.add(mesh);
      s.wall = mesh;
    }
  }

  setWall(s) {
    if (!s.wall) return;
    s.wall.material.uniforms.uOpen.value = s.dissolve;
    s.wall.visible = s.dissolve < 0.999;
  }

  sealAt(x, z) {
    for (const s of this.seals) if (!s.open && Math.hypot(x - s.x, z - s.z) < s.r) return s;
    return null;
  }

  // héros chargé au cœur d'une terre encore scellée (vieille sauvegarde) : retour au Cœur
  escapeSeal() {
    const g = this.game, p = g.player?.position;
    if (!p || p.x > 3500) return;
    const s = this.sealAt(p.x, p.z);
    if (!s) return;
    const sp = g.respawnPoint(true);
    g.player.spawn(sp.x, sp.y, sp.z, sp.facing);
    g.rig.initialized = false;
    g.schedule(1.5, () => g.chat?.system(`La Brume recouvre encore ${s.name}. Le Cœur de Lumière vous a ramené à Havrelumière.`, 10));
  }

  updateSeals(dt) {
    const g = this.game, p = g.player, pos = p.position;
    const inCitadel = pos.x > 3500;
    for (const s of this.seals) {
      const open = this.sealOpen(s);
      if (open && !s.open) {
        s.open = true;
        this.showBanner({ small: 'La Brume se retire', big: cap(s.name), text: 'Une nouvelle terre s’ouvre à vous', cls: 'seal', sting: 'seal', sound: 'discover', time: 5 });
      } else if (!open && s.open) { s.open = false; s.dissolve = 0; }
      if (s.open && s.dissolve < 1) s.dissolve = Math.min(1, s.dissolve + dt / 5);
      const d = Math.hypot(pos.x - s.x, pos.z - s.z);
      if (s.wall) {
        const near = !inCitadel && Math.abs(d - s.r) < 900;
        this.setWall(s);
        if (!near) s.wall.visible = false;
        if (s.wall.visible) s.wall.material.uniforms.uTime.value = g.elapsed;
      }
      // le rideau repousse le héros (à pied, à cheval, en vol)
      if (!s.open && !inCitadel && d < s.r + 0.6 && !p.dead) {
        const k = (s.r + 0.6) / Math.max(d, 0.01);
        if (d < s.r - 40) { this.escapeSeal(); continue; }
        pos.x = s.x + (pos.x - s.x) * k; pos.z = s.z + (pos.z - s.z) * k;
        if (p.dodge) p.dodge = null;
        if (p.velocity) { p.velocity.x *= 0.2; p.velocity.z *= 0.2; }
        if (Math.random() < dt * 14) g.fx.sparkle(pos.clone().setY(pos.y + 1.2), '#b48cff', 1, 1, 0.35);
        if (this.msgT <= 0) {
          this.msgT = 7;
          g.ui.announce('Une Brume impénétrable', `${cap(s.name)} restent voilées. Il vous faut ${s.need}.`, 3.6);
          g.audio?.play('blink', pos);
        }
      }
    }
  }

  // ------------------------------------------------------------------ stèles de mémoire
  buildSteles() {
    const g = this.game, t = g.world.terrain, col = g.world.colliders;
    const stone = new THREE.MeshStandardMaterial({ color: '#77737f', roughness: 0.92, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: '#4c4954', roughness: 0.95, flatShading: true });
    const slab = new THREE.CylinderGeometry(0.42, 0.62, 2.7, 4, 1);
    slab.rotateY(Math.PI / 4); slab.scale(1.55, 1, 0.55); slab.translate(0, 1.35 + 0.3, 0);
    const cap = new THREE.CylinderGeometry(0.05, 0.5, 0.5, 4, 1);
    cap.rotateY(Math.PI / 4); cap.scale(1.55, 1, 0.55); cap.translate(0, 3.0 + 0.3 + 0.24, 0);
    const base = new THREE.BoxGeometry(1.9, 0.36, 1.15); base.translate(0, 0.14, 0);
    const runeTex = makeRuneTexture();
    this.runeMat = new THREE.MeshBasicMaterial({ map: runeTex, color: new THREE.Color('#ffd98a').multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.readMat = new THREE.MeshBasicMaterial({ map: runeTex, color: new THREE.Color('#9fb6ff').multiplyScalar(0.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const plate = new THREE.PlaneGeometry(0.78, 1.5);
    this.steles = [];
    for (const def of STELES) {
      const spot = findSpot(t, col, def.x, def.z);
      const y = t.heightAt(spot.x, spot.z) ?? 10;
      const grp = new THREE.Group();
      grp.position.set(spot.x, y - 0.12, spot.z);
      // face tournée vers le Cœur de Lumière (le centre du monde), comme une prière
      grp.rotation.y = Math.atan2(-spot.x, -spot.z) + (def.id === 'coeur' || def.id === 'puits' ? Math.PI : 0);
      const m1 = new THREE.Mesh(slab, stone), m2 = new THREE.Mesh(cap, stone), m3 = new THREE.Mesh(base, dark);
      for (const m of [m1, m2, m3]) { m.castShadow = true; m.receiveShadow = true; grp.add(m); }
      const front = new THREE.Mesh(plate, this.runeMat); front.position.set(0, 1.75, 0.255);
      const back = new THREE.Mesh(plate, this.runeMat); back.position.set(0, 1.75, -0.255); back.rotation.y = Math.PI;
      grp.add(front, back);
      g.scene.add(grp);
      g.world.cullFar(grp, 0.45);
      col.addCircle(spot.x, spot.z, 0.75, y - 1, y + 3.3, 'monument');
      this.steles.push({ def, x: spot.x, z: spot.z, y, grp, runes: [front, back] });
    }
  }

  steleNear(pos) {
    for (const s of this.steles) if (Math.abs(pos.x - s.x) < STELE_R && Math.abs(pos.z - s.z) < STELE_R && Math.hypot(pos.x - s.x, pos.z - s.z) < STELE_R) return s;
    return null;
  }

  readStele(s) {
    const g = this.game, L = this.lore;
    const first = !L.steles[s.def.id];
    if (first) {
      L.steles[s.def.id] = Date.now();
      this.stelesDirty = true;
      g.gainXp(60 + g.hero.level * 18);
      g.fx.ring(new THREE.Vector3(s.x, s.y + 0.2, s.z), '#ffd98a', { to: 4, life: 0.9 });
      g.save?.soon(1);
    }
    g.audio?.play('runeok', null);
    const n = Object.keys(L.steles).length;
    g.windows.custom(s.def.title, h('div', { class: 'stele-read' },
      h('div', { class: 'sr-kind' }, 'Stèle de mémoire'),
      h('p', { class: 'sr-text' }, s.def.text),
      h('div', { class: 'istats' }, `${first ? 'Nouvelle mémoire · ' : ''}${n}/${STELES.length} mémoires retrouvées. Relisez-les dans les Chroniques.`),
      h('button', { class: 'btn', type: 'button', onclick: () => g.windows.open('chronicles') }, 'Ouvrir les Chroniques')));
  }

  updateSteles(dt) {
    if (this.stelesDirty) {
      this.stelesDirty = false;
      for (const s of this.steles) { const read = !!this.lore?.steles[s.def.id]; for (const r of s.runes) r.material = read ? this.readMat : this.runeMat; }
    }
    // pulsation douce des runes non lues
    this.runeMat.opacity = 0.75 + Math.sin(this.game.elapsed * 2.2) * 0.25;
    // nom flottant au-dessus de la stèle la plus proche
    const p = this.game.player.position, ui = this.game.ui;
    let best = null, bd = 26;
    for (const s of this.steles) { const d = Math.abs(p.x - s.x) + Math.abs(p.z - s.z); if (d < bd) { bd = d; best = s; } }
    if (best !== this.plateFor) {
      if (this.plateFor) ui.removePlate('stele');
      this.plateFor = best;
    }
    // statue d'un seigneur : son nom (le vrai, une fois libéré)
    const st = this.aura.statueNear(p, 16);
    if (st !== this.statuePlate) { if (this.statuePlate) ui.removePlate('statue'); this.statuePlate = st; }
    if (st) {
      const pl = this.aura.statuePlate(st, !!this.lore?.shards[st.key]);
      ui.setPlate({ id: 'statue', position: st.pos || (st.pos = new THREE.Vector3(st.x, st.y, st.z)), height: 13, name: pl.name, title: pl.title, kind: 'npc', questMark: '' });
    }
    if (best) {
      const read = !!this.lore?.steles[best.def.id];
      ui.setPlate({ id: 'stele', position: best.pos || (best.pos = new THREE.Vector3(best.x, best.y, best.z)), height: 4.1, name: read ? best.def.title : 'Stèle de mémoire', title: read ? 'mémoire retrouvée' : 'mémoire oubliée', kind: 'npc', questMark: read ? '' : '✦' });
    }
  }

  markers(out) {
    if (!this.lore) return;
    for (const s of this.steles) {
      if (this.sealAt(s.x, s.z)) continue;
      const read = !!this.lore.steles[s.def.id];
      out.push({ x: s.x, z: s.z, color: read ? '#8fa2d8' : '#e8d4ff', r: 3, shape: 'dot', label: read ? s.def.title : 'Stèle de mémoire' });
    }
  }

  // ------------------------------------------------------------------ boucle
  update(dt) {
    const g = this.game;
    if (!g.player || !this.lore) return;
    this.msgT -= dt;
    this.aura.update(dt);
    this.updateSeals(dt);
    this.updateSteles(dt);
    this.checkT -= dt;
    if (this.checkT > 0) return;
    this.checkT = 0.5;
    const a = this.act();
    if (a > (this.lore.act ?? 0) && !this.blocking) {
      this.lore.act = a;
      const A = ACTS[a];
      this.showBanner({ small: A.title, big: A.name, text: '', cls: 'act', sting: 'act', sound: 'epic', time: 5.5 });
      g.chat?.system(`${A.title} · ${A.name}. ${A.summary}`, 16);
      g.save?.soon(1);
    }
  }

  // Maëlis parle selon l'avancée du récit
  elderLines() { return ELDER_LINES[this.act()] || null; }

  // ------------------------------------------------------------------ Chroniques
  window(win) {
    const g = this.game, L = this.lore || { steles: {}, shards: {} };
    const act = this.act();
    const sec = (title, ...rows) => h('div', { class: 'chr-sec' }, h('h4', {}, title), ...rows);
    const acts = ACTS.map((A) => A.n <= act
      ? h('div', { class: 'chr-act' + (A.n === act ? ' cur' : '') }, h('div', { class: 'chr-h' }, `${A.title} · ${A.name}`), h('p', {}, A.summary))
      : h('div', { class: 'chr-act locked' }, h('div', { class: 'chr-h' }, `${A.title} · ???`)));
    const shards = Object.entries(SHARDS).map(([k, S]) => {
      const has = !!L.shards[k];
      return h('div', { class: 'chr-shard' + (has ? '' : ' locked') },
        h('span', { class: 'chr-gem', style: { background: has ? S.color : 'transparent', borderColor: S.color } }),
        h('div', {}, h('div', { class: 'chr-h' }, has ? S.name : 'Éclat perdu'), h('p', {}, has ? S.desc : `Détenu par ${LORDS[S.boss].name}.`)));
    });
    const lords = Object.entries(LORDS).map(([k, Lo]) => {
      const fallen = !!L.shards[SHARD_OF[k]];
      return h('div', { class: 'chr-lord' + (fallen ? '' : ' locked') },
        h('div', { class: 'chr-h' }, fallen ? `${Lo.name} · ${Lo.true}` : Lo.name),
        h('p', {}, fallen ? Lo.lore : 'Son vrai nom s’est perdu dans la Brume.'));
    });
    const read = STELES.filter((s) => L.steles[s.id]);
    const steles = read.length
      ? read.map((s) => h('details', { class: 'chr-stele' }, h('summary', {}, s.title), h('p', {}, s.text)))
      : [h('p', { class: 'istats' }, 'Aucune pour l’instant. Les stèles gravées (✦) gardent la mémoire du monde : approchez-vous et lisez-les.')];
    win.customContent = { title: 'Chroniques d’Aetheria', content: '' };
    return win.frame('Chroniques d’Aetheria',
      h('div', { class: 'chronicles' },
        h('div', { class: 'chr-crown' }, ...Object.entries(SHARDS).map(([k, S]) => h('span', { class: 'chr-ray' + (L.shards[k] ? ' lit' : ''), style: { '--c': S.color } }))),
        h('div', { class: 'istats', style: { textAlign: 'center' } }, `Éclats repris : ${this.shardCount()}/5 · Mémoires : ${read.length}/${STELES.length}`),
        sec('Le récit', ...acts),
        sec('Les cinq Éclats', ...shards),
        sec('Les seigneurs de la Brume', ...lords),
        sec(`Mémoires gravées (${read.length}/${STELES.length})`, ...steles),
        h('details', { class: 'chr-stele' }, h('summary', {}, 'Relire le prologue'), ...PROLOGUE.map((l) => h('p', {}, l)))));
  }
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// un coin de terre ferme, plat et dégagé près du point voulu
function findSpot(t, col, x0, z0) {
  for (let r = 0; r <= 24; r += 2) {
    const steps = r === 0 ? 1 : Math.ceil(r * 1.4);
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
      const y = t.heightAt(x, z);
      if (y === null || y === undefined || y < SEA_LEVEL + 0.8) continue;
      if (t.continentHeight && t.continentHeight(x, z) < SEA_LEVEL + 0.8) continue;
      let ok = true;
      for (const [dx, dz] of [[1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4]]) {
        const yy = t.heightAt(x + dx, z + dz);
        if (yy === null || Math.abs(yy - y) > 0.9) { ok = false; break; }
        if (col.insideSolid(x + dx, z + dz, y + 1)) { ok = false; break; }
      }
      if (ok && !col.insideSolid(x, z, y + 1)) return { x, z };
    }
  }
  return { x: x0, z: z0 };
}

// bruit de valeur pavable (128²) : le rideau de Brume le lit au lieu de calculer du fbm
function makeNoiseTexture() {
  const N = 128, data = new Uint8Array(N * N * 4);
  const rnd = (i, j, s) => { const v = Math.sin((i * 127.1 + j * 311.7 + s * 74.7)) * 43758.5453; return v - Math.floor(v); };
  const layer = (x, y, cells, s) => {
    const fx = (x / N) * cells, fy = (y / N) * cells;
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const w = (a, b) => rnd(((a % cells) + cells) % cells, ((b % cells) + cells) % cells, s);
    return (w(i, j) * (1 - su) + w(i + 1, j) * su) * (1 - sv) + (w(i, j + 1) * (1 - su) + w(i + 1, j + 1) * su) * sv;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const a = layer(x, y, 4, 1) * 0.55 + layer(x, y, 8, 2) * 0.28 + layer(x, y, 16, 3) * 0.17;
    const b = layer(x, y, 6, 5) * 0.6 + layer(x, y, 12, 6) * 0.4;
    const o = (y * N + x) * 4;
    data[o] = a * 255; data[o + 1] = b * 255; data[o + 2] = layer(x, y, 32, 9) * 255; data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function mistMaterial(noise) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uOpen: { value: 0 }, uNoise: { value: null },
      uColA: { value: new THREE.Color('#2a1846') }, uColB: { value: new THREE.Color('#9a7ad8') }, uGold: { value: new THREE.Color('#ffcf7a') },
    }]),
    vertexShader: /* glsl */`
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uOpen;
      uniform sampler2D uNoise;
      uniform vec3 uColA, uColB, uGold;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      void main() {
        float u = vUv.x, v = vUv.y;
        // volutes verticales qui montent lentement
        vec4 n1 = texture2D(uNoise, vec2(u * 0.35 + uTime * 0.004, v * 0.32 - uTime * 0.035));
        vec4 n2 = texture2D(uNoise, vec2(u * 0.9 - uTime * 0.01, v * 0.75 - uTime * 0.07));
        float body = smoothstep(0.3, 0.85, n1.r * 0.6 + n2.g * 0.5);
        float streak = smoothstep(0.62, 0.95, n2.r) * (0.3 + 0.7 * v);
        // sommet déchiqueté : les volutes se perdent dans le ciel à des hauteurs différentes
        float fall = smoothstep(0.0, 0.04, v) * (1.0 - smoothstep(0.2 + body * 0.45, 0.98, v));
        float a = (0.5 + body * 0.45) * fall;
        // la Brume se déchire quand le sceau s'ouvre
        float tear = n2.r * 0.7 + n1.b * 0.3;
        a *= 1.0 - smoothstep(tear - 0.12, tear, uOpen * 1.15);
        vec3 col = mix(uColA, uColB, body * (0.45 + 0.55 * v)) + uColB * streak * 0.6;
        // liseré de runes dorées au pied du rideau
        float band = smoothstep(0.03, 0.0, abs(v - 0.07)) * (0.55 + 0.45 * sin(u * 9.0 + uTime * 1.4)) * (1.0 - uOpen);
        col += uGold * band * 1.8;
        a = clamp(a + band * 0.4, 0.0, 0.9);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
  });
  m.uniforms.uNoise.value = noise;
  return m;
}

// rune gravée : un cercle, la couronne fendue et cinq rayons
function makeRuneTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.strokeStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
  x.shadowColor = '#fff'; x.shadowBlur = 10;
  x.lineWidth = 5;
  x.beginPath(); x.arc(64, 92, 38, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 4;
  x.beginPath(); x.moveTo(36, 104); x.lineTo(44, 76); x.lineTo(56, 94); x.lineTo(64, 66); x.lineTo(72, 94); x.lineTo(84, 76); x.lineTo(92, 104); x.stroke();
  x.beginPath(); x.moveTo(64, 60); x.lineTo(60, 80); x.lineTo(68, 92); x.lineTo(62, 118); x.stroke();
  for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.42; x.beginPath(); x.moveTo(64 + Math.cos(a) * 46, 92 + Math.sin(a) * 46); x.lineTo(64 + Math.cos(a) * 58, 92 + Math.sin(a) * 58); x.stroke(); }
  x.lineWidth = 3;
  for (let r = 0; r < 4; r++) { const yy = 160 + r * 20; x.beginPath(); x.moveTo(30, yy); for (let i = 0; i < 6; i++) x.lineTo(34 + i * 12, yy + (i % 2 ? -6 : 4)); x.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
