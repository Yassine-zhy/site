import * as THREE from 'three';
import { BEACONS, CLASSES } from '../config.js';
import { h } from '../ui/dom.js';
import { escapeHtml } from '../net/Net.js';

const LOCAL_KEY = 'aetheria.world.local.v1';
const DECAY = BEACONS.map((b) => 100 / (b.decayHours * 3600)); // points par seconde

function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } }

// État partagé du monde : la lumière des Phares (somme des contributions de tous les
// héros, qui s'éteint lentement avec le temps réel) et le classement des héros.
export class WorldState {
  constructor(game) {
    this.game = game;
    this.levels = BEACONS.map(() => 0);
    this.others = new Map(); // uid -> { data, name }
    this.mine = lsGet(LOCAL_KEY) || {}; // { beaconId: { a, t } }
    this.dirty = false;
    this.writeT = 0;
    this.readOnly = false;
    this.corrT = 0;
    this.prevLit = BEACONS.map(() => false);
    this.firstSnapshot = true;
    this.heroT = 0;
    this.lastHeroWrite = '';
  }

  get uid() { return this.game.platform.userId; }

  start() {
    const g = this.game;
    g.platform.onDb((db) => {
      this.db = db;
      try {
        this.unsub = db.collection('light').onSnapshot((snap) => {
          this.others.clear();
          for (const d of snap.docs) {
            if (d.id === this.uid) {
              // notre propre document fait foi s'il est plus récent
              const data = d.data() || {};
              for (const [k, v] of Object.entries(data.b || {})) if (!this.mine[k] || (v.t || 0) > (this.mine[k].t || 0)) this.mine[k] = v;
              continue;
            }
            this.others.set(d.id, d.data() || {});
          }
          this.recompute(true);
        }, (e) => console.warn('lumière', e.code));
      } catch (e) { console.warn(e); }
    });
    this.recompute(false);
  }

  decayed(entry, i, now = Date.now()) {
    if (!entry) return 0;
    return Math.max(0, (entry.a || 0) - DECAY[i] * Math.max(0, now - (entry.t || 0)) / 1000);
  }

  recompute(fromNet) {
    const now = Date.now();
    const lv = BEACONS.map((b, i) => {
      let sum = this.decayed(this.mine[b.id], i, now);
      for (const o of this.others.values()) sum += this.decayed(o.b?.[b.id], i, now);
      return Math.min(1, sum / 100);
    });
    // phare rallumé ?
    lv.forEach((v, i) => {
      const lit = v >= 0.999;
      if (lit && !this.prevLit[i] && !this.firstSnapshot) this.onLit(i);
      this.prevLit[i] = lit;
    });
    if (fromNet) this.firstSnapshot = false;
    if (!fromNet && !this.db) this.firstSnapshot = false;
    this.levels = lv;
    this.game.world.beacons?.setLevels(lv);
  }

  onLit(i) {
    const g = this.game, b = BEACONS[i];
    // qui a le plus contribué récemment ?
    let best = null, bestA = 0;
    for (const o of this.others.values()) { const a = this.decayed(o.b?.[b.id], i); if (a > bestA) { bestA = a; best = o.n; } }
    if (this.decayed(this.mine[b.id], i) >= bestA) best = g.hero.name;
    g.ui.announce(`${b.name} brille à nouveau`, best ? `Grâce à ${best} et aux héros d’Aetheria. La Brume recule.` : 'La Brume recule.', 4.5);
    g.audio?.play('beacon');
    const bc = g.world.beacons?.list[i];
    if (bc) {
      const p = new THREE.Vector3(b.x, bc.y, b.z);
      g.fx.beam(p, '#ffe7a0', { height: 120, radius: 6, life: 3 });
      g.fx.ring(p, '#ffe08a', { from: 2, to: b.radius, life: 2.5, intensity: 3 });
      g.fx.ring(p, '#ffffff', { from: 1, to: b.radius * 0.6, life: 1.8, intensity: 2 });
      g.shakeAt(p, 0.6);
    }
    g.quests?.onEvent('beaconLit', { id: b.id });
    g.chat?.system(`✦ ${b.name} s’est rallumé !`);
  }

  // ajoute de la lumière à un phare (index) — décroissance comprise
  add(i, amount, reason = '') {
    const b = BEACONS[i];
    const now = Date.now();
    const cur = this.decayed(this.mine[b.id], i, now);
    const total = this.levels[i] * 100;
    const room = Math.max(0, 100 - total);
    const gain = Math.min(amount, room + 0.0001);
    if (gain <= 0.001) return 0;
    this.mine[b.id] = { a: Math.round((cur + gain) * 100) / 100, t: now };
    this.game.hero.light += gain;
    this.dirty = true;
    this.recompute(false);
    const p = this.game.player.position;
    this.game.ui.floatText(new THREE.Vector3(p.x, p.y + 3, p.z), `+${gain.toFixed(1)} % lumière`, 'gold', { rise: 2 });
    this.game.quests?.onEvent('light', { id: b.id, amount: gain, reason });
    return gain;
  }

  onKill(k) {
    BEACONS.forEach((b, i) => {
      if (Math.hypot(k.x - b.x, k.z - b.z) < b.radius * 0.9) this.add(i, (k.boss ? 40 : k.elite ? 5 : 2.2) + k.level * 0.08, 'kill');
    });
  }

  channelLight(pos, amount) {
    const bc = this.game.world.beacons?.nearest(pos, 18);
    if (!bc) return false;
    const i = this.game.world.beacons.list.indexOf(bc);
    this.add(i, amount * 100, 'lux');
    return true;
  }

  update(dt) {
    const g = this.game;
    this.corrT -= dt;
    if (this.corrT <= 0) {
      this.corrT = 1.0;
      this.recompute(false);
      // la carte de corruption suit les niveaux affichés (transition douce)
      const shown = g.world.beacons ? g.world.beacons.list.map((b) => b.shown) : this.levels;
      const key = shown.map((v) => v.toFixed(2)).join();
      if (key !== this.corrKey) { this.corrKey = key; g.world.maps.updateCorruption(shown); }
    }
    // écriture de nos contributions
    this.writeT -= dt;
    if (this.dirty && this.writeT <= 0) {
      this.dirty = false; this.writeT = 5;
      lsSet(LOCAL_KEY, this.mine);
      this.writeMine();
    }
    // fiche publique du héros (classement)
    this.heroT -= dt;
    if (this.heroT <= 0) { this.heroT = 45; this.writeHero(); }
  }

  async writeMine() {
    if (!this.db || !this.uid || this.readOnly) return;
    const h = this.game.hero;
    try { await this.db.doc('light/' + this.uid).set({ b: this.mine, n: h.name, c: h.classId, t: Date.now() }); }
    catch (e) { if (e?.code === 'invalid_argument') this.readOnly = true; }
  }

  async writeHero(force = false) {
    if (!this.db || !this.uid || this.readOnly) return;
    const h = this.game.hero;
    const doc = { n: h.name, c: h.classId, l: h.level, li: Math.round(h.light), k: h.kills, r: h.bestRune || 0, t: Date.now() };
    const key = JSON.stringify({ ...doc, t: 0 });
    if (!force && key === this.lastHeroWrite) return;
    this.lastHeroWrite = key;
    try { await this.db.doc('heroes/' + this.uid).set(doc); } catch (e) { if (e?.code === 'invalid_argument') this.readOnly = true; }
  }

  // ------------------------------------------------------------------ fenêtre du classement
  leaderboardWindow(win) {
    const g = this.game;
    const body = h('div', {}, h('div', { class: 'istats' }, 'Chargement du classement…'));
    const worldBox = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '14px' } },
      ...BEACONS.map((b, i) => h('div', { style: { padding: '8px', borderRadius: '5px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--line-soft)' } },
        h('div', { class: 'sc', style: { fontSize: '12px', color: this.levels[i] >= 0.999 ? 'var(--gold-hi)' : 'var(--muted)' } }, b.name),
        h('div', { style: { fontSize: '22px', fontWeight: '800', fontVariantNumeric: 'tabular-nums' } }, Math.round(this.levels[i] * 100) + ' %'),
        h('div', { class: 'istats' }, `s’éteint en ${b.decayHours} h sans soin`))));
    const render = (rows) => {
      body.innerHTML = '';
      if (!rows.length) { body.appendChild(h('div', { class: 'istats' }, this.db ? 'Aucun héros classé pour l’instant. Offrez de la lumière aux Phares pour entrer dans la légende.' : 'Le classement partagé apparaît quand le jeu est ouvert depuis Claude.')); return; }
      const table = h('div', { style: { display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) 70px 80px 70px', gap: '6px 10px', fontSize: '14px', alignItems: 'center' } },
        ...['#', 'héros', 'niveau', 'lumière', 'runes'].map((t) => h('div', { class: 'sc', style: { color: 'var(--muted)', fontSize: '11.5px' } }, t)));
      rows.forEach((r, i) => {
        const me = r.id === this.uid;
        const col = CLASSES[r.c]?.color || 'var(--parch)';
        table.append(h('div', { style: { fontWeight: '800', color: i < 3 ? 'var(--gold-hi)' : 'var(--muted)' } }, String(i + 1)),
          h('div', { style: { fontWeight: me ? '800' : '600', color: col, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, (r.n || 'Héros') + (me ? ' (vous)' : '')),
          h('div', { class: 'num' }, String(r.l || 1)), h('div', { class: 'num gold' }, String(r.li || 0)), h('div', { class: 'num' }, (r.r || 0) + ' %'));
      });
      body.appendChild(table);
    };
    if (this.db) {
      this.writeHero(true).finally(() => {
        this.db.collection('heroes').orderBy('li', 'desc').limit(15).get()
          .then((snap) => render(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
          .catch(() => render([]));
      });
    } else {
      const hh = g.hero;
      render([{ id: this.uid, n: hh.name, c: hh.classId, l: hh.level, li: Math.round(hh.light), r: hh.bestRune }]);
    }
    return win.frame('Légendes d’Aetheria', h('div', { class: 'sc', style: { color: 'var(--gold)', fontSize: '12px', marginBottom: '6px' } }, 'lumière du monde'), worldBox,
      h('div', { class: 'sc', style: { color: 'var(--gold)', fontSize: '12px', marginBottom: '6px' } }, 'héros les plus lumineux'), body);
  }
}

export { escapeHtml };
