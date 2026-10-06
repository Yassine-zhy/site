import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { Character } from '../entities/Character.js';
import { CLASSES } from '../config.js';
import { cleanText } from '../net/Net.js';
import { clone } from '../engine/math.js';

// Phrases d'échos : un gabarit + un mot, à la manière des messages gravés des anciens.
export const ECHO_TEMPLATES = [
  'Attention : {w} droit devant', 'Essayez de {w}', 'Un trésor se cache {w}', 'Ici, {w}', 'Courage, {w} !',
  'Le Phare a besoin de {w}', 'Ne faites pas confiance à {w}', 'Je rêve de {w}', 'Merci pour {w}', 'Regardez {w}',
];
export const ECHO_WORDS = [
  'un squelette d’élite', 'la Brume', 'la mer de nuages', 'planer', 'tracer Ventus', 'tracer Lux', 'la lumière', 'en haut', 'derrière', 'sous le pont',
  'l’îlot', 'le Roi Sans Lumière', 'le vent', 'la nuit', 'l’aurore', 'voyageur', 'ensemble', 'la paravoile', 'un coffre', 'l’Oracle',
  'votre aide', 'patience', 'une embuscade', 'la vue', 'repos', 'la forêt', 'les ruines', 'l’amitié', 'un saut de foi', 'rien du tout',
];

// Les Échos : messages laissés dans le monde + fantômes des héros tombés (rejoue leurs dernières secondes).
export class Echoes {
  constructor(game) {
    this.game = game;
    this.echoes = new Map(); // key -> {uid, e:{...}, mesh}
    this.ghosts = new Map(); // key -> {uid, g:{...}, mesh}
    this.likes = new Map(); // echoKey -> Set(uid)
    this.mineEchoes = []; this.mineGhosts = []; this.myLikes = {};
    this.trail = []; this.trailT = 0;
    this.stoneGeo = new THREE.CylinderGeometry(0.45, 0.6, 0.5, 6);
    this.glyphGeo = new THREE.TorusGeometry(0.75, 0.05, 6, 32);
    this.replay = null;
    this.localKey = 'aetheria.echoes.local.v1';
  }

  get uid() { return this.game.platform.userId || 'local'; }

  start() {
    const g = this.game;
    try { const loc = JSON.parse(localStorage.getItem(this.localKey) || 'null'); if (loc) { this.mineEchoes = loc.e || []; this.mineGhosts = loc.g || []; } } catch { /* */ }
    this.syncLocal();
    g.platform.onDb((db) => {
      this.db = db;
      const sub = (col, fn) => { try { db.collection(col).onSnapshot(fn, (e) => console.warn(col, e.code)); } catch (e) { console.warn(e); } };
      sub('echoes', (snap) => {
        const seen = new Set();
        for (const d of snap.docs) {
          const list = clone(d.data()?.list) || [];
          if (d.id === this.uid) { this.mineEchoes = clone(list); }
          for (const e of list.slice(0, 5)) { const key = d.id + ':' + e.id; seen.add(key); this.upsertEcho(key, d.id, e); }
        }
        for (const k of [...this.echoes.keys()]) if (!seen.has(k)) this.removeEcho(k);
      });
      sub('ghosts', (snap) => {
        const seen = new Set();
        for (const d of snap.docs) {
          const list = clone(d.data()?.list) || [];
          if (d.id === this.uid) this.mineGhosts = clone(list);
          for (const gh of list.slice(0, 3)) { const key = d.id + ':' + gh.id; seen.add(key); this.upsertGhost(key, d.id, gh); }
        }
        for (const k of [...this.ghosts.keys()]) if (!seen.has(k)) this.removeGhost(k);
      });
      sub('resonance', (snap) => {
        this.likes.clear();
        for (const d of snap.docs) {
          const m = clone(d.data()?.e) || {};
          if (d.id === this.uid) this.myLikes = clone(m);
          for (const key of Object.keys(m)) { if (!this.likes.has(key)) this.likes.set(key, new Set()); this.likes.get(key).add(d.id); }
        }
        this.checkMyResonance();
      });
    });
  }

  syncLocal() {
    if (this.db) return;
    for (const e of this.mineEchoes) this.upsertEcho(this.uid + ':' + e.id, this.uid, e);
    for (const gh of this.mineGhosts) this.upsertGhost(this.uid + ':' + gh.id, this.uid, gh);
  }

  saveMine() {
    try { localStorage.setItem(this.localKey, JSON.stringify({ e: this.mineEchoes, g: this.mineGhosts })); } catch { /* */ }
    if (!this.db || !this.game.platform.userId) { this.syncLocal(); return; }
    this.db.doc('echoes/' + this.uid).set({ list: this.mineEchoes }).catch(() => {});
    this.db.doc('ghosts/' + this.uid).set({ list: this.mineGhosts }).catch(() => {});
  }

  // ------------------------------------------------------------------ messages
  upsertEcho(key, uid, e) {
    if (!e || typeof e.x !== 'number') return;
    let it = this.echoes.get(key);
    if (it && it.e.t === e.t) return;
    if (it) this.removeEcho(key);
    const g = this.game;
    const group = new THREE.Group();
    const y = g.world.terrain.heightAt(e.x, e.z) ?? e.y;
    group.position.set(e.x, y, e.z);
    const stone = new THREE.Mesh(this.stoneGeo, new THREE.MeshStandardMaterial({ color: '#4b3f6e', roughness: 0.8, flatShading: true, emissive: new THREE.Color('#7a5cff'), emissiveIntensity: 0.3 }));
    stone.position.y = 0.2;
    const glyph = new THREE.Mesh(this.glyphGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#c9b6ff').multiplyScalar(2.2), toneMapped: false, transparent: true, opacity: 0.8 }));
    glyph.rotation.x = -Math.PI / 2; glyph.position.y = 0.06;
    group.add(stone, glyph);
    g.scene.add(group);
    this.echoes.set(key, { uid, e: { ...e, text: cleanText(e.text) }, mesh: group, glyph });
  }

  removeEcho(key) { const it = this.echoes.get(key); if (it) { it.mesh.removeFromParent(); this.echoes.delete(key); this.game.ui.removePlate('echo:' + key); } }

  composeWindow() {
    const g = this.game, win = g.windows;
    let tpl = 0, word = 0;
    const preview = h('div', { style: { fontFamily: 'var(--font-body)', fontSize: '22px', color: '#e2ccff', textAlign: 'center', margin: '8px 0 14px', minHeight: '32px' } });
    const update = () => { preview.textContent = '« ' + ECHO_TEMPLATES[tpl].replace('{w}', ECHO_WORDS[word]) + ' »'; };
    const sel = (list, on) => {
      const s = h('select', { style: { width: '100%', padding: '8px', background: 'rgba(0,0,0,0.35)', color: 'var(--parch)', border: '1px solid var(--line)', borderRadius: '4px', fontSize: '15px', fontFamily: 'var(--font-body)' } }, ...list.map((t, i) => h('option', { value: i }, t.replace('{w}', '…'))));
      s.addEventListener('change', () => { on(+s.value); update(); });
      return s;
    };
    update();
    const body = win.frame('Graver un écho',
      h('div', { class: 'istats', style: { lineHeight: '1.5' } }, 'Votre message restera gravé ici pour tous les voyageurs d’Aetheria. Ceux qui le trouveront utile pourront le faire résonner.'),
      preview,
      h('div', { class: 'field' }, h('label', {}, 'phrase'), sel(ECHO_TEMPLATES, (v) => { tpl = v; })),
      h('div', { class: 'field' }, h('label', {}, 'mot'), sel(ECHO_WORDS, (v) => { word = v; })),
      h('div', { class: 'row', style: { display: 'flex', gap: '10px' } },
        h('button', { class: 'btn', onclick: () => { this.place(ECHO_TEMPLATES[tpl].replace('{w}', ECHO_WORDS[word])); win.close(); } }, 'Graver ici'),
        h('button', { class: 'btn ghost', onclick: () => win.close() }, 'Annuler')));
    if (win.el) win.el.remove();
    win.current = 'echo'; win.el = body; g.windowOpen = true; g.input.exitLock();
    g.ui.root.appendChild(body);
  }

  place(text) {
    const g = this.game, p = g.player.position;
    const e = { id: Date.now().toString(36), x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, z: Math.round(p.z * 10) / 10, text: cleanText(text), n: g.hero.name, c: g.hero.classId, t: Date.now() };
    this.mineEchoes.unshift(e);
    this.mineEchoes = this.mineEchoes.slice(0, 5);
    this.saveMine();
    this.upsertEcho(this.uid + ':' + e.id, this.uid, e);
    g.fx.runeCircle(p, '#c9b6ff', { radius: 2, life: 1.4 });
    g.ui.toast('Votre écho est gravé dans le monde.');
    g.audio?.play('oracle');
    g.quests?.onEvent('echo', {});
  }

  resonate(key) {
    const it = this.echoes.get(key);
    if (!it || it.uid === this.uid) return;
    if (this.myLikes[key]) { this.game.ui.toast('Vous avez déjà fait résonner cet écho.'); return; }
    this.myLikes[key] = Date.now();
    const keys = Object.entries(this.myLikes).sort((a, b) => b[1] - a[1]).slice(0, 60);
    this.myLikes = Object.fromEntries(keys);
    if (!this.likes.has(key)) this.likes.set(key, new Set());
    this.likes.get(key).add(this.uid);
    if (this.db && this.game.platform.userId) this.db.doc('resonance/' + this.uid).set({ e: this.myLikes }).catch(() => {});
    this.game.fx.ring(it.mesh.position, '#c9b6ff', { to: 5, life: 0.8 });
    this.game.audio?.play('runeok');
    this.game.ui.toast(`L’écho de <b>${escapeHtmlLite(it.e.n)}</b> résonne. Il vous rend un peu d’éther.`);
    this.game.hero.mp = Math.min(this.game.hero.stats.mp, this.game.hero.mp + this.game.hero.stats.mp * 0.25);
  }

  checkMyResonance() {
    let total = 0;
    for (const e of this.mineEchoes) total += this.likes.get(this.uid + ':' + e.id)?.size || 0;
    if (this.lastRes !== undefined && total > this.lastRes) this.game.ui.toast(`Vos échos ont résonné <b>${total - this.lastRes}</b> fois de plus (${total} au total).`, { time: 4 });
    this.lastRes = total;
  }

  // ------------------------------------------------------------------ fantômes
  recordTick(dt) {
    const p = this.game.player;
    if (!p || p.dead) return;
    this.trailT -= dt;
    if (this.trailT > 0) return;
    this.trailT = 0.2;
    this.trail.push([Math.round(p.position.x * 10) / 10, Math.round(p.position.y * 10) / 10, Math.round(p.position.z * 10) / 10, Math.round(p.facing * 100) / 100, p.char.layers.upper.name || '']);
    if (this.trail.length > 30) this.trail.shift();
  }

  recordDeath(source) {
    const g = this.game;
    const path = this.trail.slice(-30);
    if (path.length < 3) return;
    const gh = { id: Date.now().toString(36), path, n: g.hero.name, c: g.hero.classId, cause: source?.def?.name || 'la Brume', t: Date.now() };
    this.mineGhosts.unshift(gh);
    this.mineGhosts = this.mineGhosts.slice(0, 3);
    this.saveMine();
    this.trail.length = 0;
  }

  upsertGhost(key, uid, gh) {
    if (!gh || !Array.isArray(gh.path) || !gh.path.length) return;
    if (this.ghosts.has(key)) return;
    const g = this.game;
    const last = gh.path[gh.path.length - 1];
    const group = new THREE.Group();
    const y = g.world.terrain.heightAt(last[0], last[2]) ?? last[1];
    group.position.set(last[0], y + 0.05, last[2]);
    const stain = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5a6e').multiplyScalar(1.6), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
    stain.rotation.x = -Math.PI / 2;
    group.add(stain);
    g.scene.add(group);
    this.ghosts.set(key, { uid, g: { ...gh, n: cleanText(gh.n).slice(0, 16), cause: cleanText(gh.cause).slice(0, 40) }, mesh: group, stain });
  }

  removeGhost(key) { const it = this.ghosts.get(key); if (it) { it.mesh.removeFromParent(); this.ghosts.delete(key); } }

  playGhost(key) {
    const it = this.ghosts.get(key);
    if (!it || this.replay) return;
    const g = this.game;
    const cls = CLASSES[it.g.c] || CLASSES.knight;
    const ch = new Character(g.assets, cls.model, { show: cls.weapons.show });
    for (const m of ch.materials) { m.transparent = true; m.opacity = 0.45; m.depthWrite = false; m.color.set('#ff9db0'); m.emissive = new THREE.Color('#ff3a5a'); m.emissiveIntensity = 0.8; }
    g.scene.add(ch.object);
    this.replay = { ch, path: it.g.path, t: 0, key };
    g.ui.toast(`Écho de <b>${escapeHtmlLite(it.g.n)}</b>, terrassé par ${escapeHtmlLite(it.g.cause)}…`, { time: 4 });
    g.audio?.play('death');
  }

  updateReplay(dt) {
    const r = this.replay;
    if (!r) return;
    r.t += dt;
    const idx = r.t / 0.2;
    const i = Math.floor(idx);
    if (i >= r.path.length - 1) {
      if (!r.dying) { r.dying = true; r.ch.playAction('Death_A', { full: true, hold: true }); r.endT = r.t + 2; }
      if (r.t > r.endT) { r.ch.dispose(); this.replay = null; return; }
      r.ch.update(dt);
      return;
    }
    const a = r.path[i], b = r.path[i + 1], f = idx - i;
    r.ch.object.position.set(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
    r.ch.object.rotation.y = a[3];
    const speed = Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.2;
    const anim = a[4] && !/Idle|Walk|Run|Jump/.test(a[4]) && this.game.assets.clip(a[4]) ? a[4] : null;
    if (anim && r.lastAnim !== anim) { r.ch.playAction(anim, { timeScale: 1.2 }); }
    r.lastAnim = anim;
    r.ch.setLocomotion(speed > 3.6 ? 'Running_A' : speed > 0.4 ? 'Walking_A' : 'Idle');
    r.ch.update(dt);
  }

  // ------------------------------------------------------------------ interaction & affichage
  nearest(pos, maxD = 3) {
    let best = null, bd = maxD;
    for (const [key, it] of this.echoes) { const d = Math.hypot(pos.x - it.mesh.position.x, pos.z - it.mesh.position.z); if (d < bd) { bd = d; best = { kind: 'echo', key, it }; } }
    for (const [key, it] of this.ghosts) { const d = Math.hypot(pos.x - it.mesh.position.x, pos.z - it.mesh.position.z); if (d < bd) { bd = d; best = { kind: 'ghost', key, it }; } }
    return best;
  }

  plates(ui) {
    const p = this.game.player?.position;
    if (!p) return;
    for (const [key, it] of this.echoes) {
      const d = Math.hypot(p.x - it.mesh.position.x, p.z - it.mesh.position.z);
      if (d > 16) continue;
      const n = this.likes.get(key)?.size || 0;
      ui.setPlate({ id: 'echo:' + key, position: it.mesh.position, height: 1.2, name: d < 7 ? '« ' + it.e.text + ' »' : 'Écho', kind: 'npc', title: d < 7 ? `— ${it.e.n}${n ? ` · résonne ×${n}` : ''}` : '' });
    }
  }

  markers(out) {
    for (const it of this.echoes.values()) out.push({ x: it.mesh.position.x, z: it.mesh.position.z, color: '#c9b6ff', r: 3 });
  }

  update(dt) {
    const t = this.game.elapsed;
    for (const it of this.echoes.values()) { it.glyph.rotation.z = t * 0.8; it.glyph.material.opacity = 0.55 + Math.sin(t * 2 + it.mesh.position.x) * 0.25; }
    for (const it of this.ghosts.values()) it.stain.material.opacity = 0.35 + Math.sin(t * 2.5 + it.mesh.position.z) * 0.15;
    this.recordTick(dt);
    this.updateReplay(dt);
  }
}

function escapeHtmlLite(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
