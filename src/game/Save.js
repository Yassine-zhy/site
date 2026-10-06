// Sauvegarde : navigateur (toujours) + base partagée de la plateforme (si disponible),
// pour retrouver ses héros sur n'importe quel appareil. Quatre emplacements indépendants ;
// l'emplacement 1 reprend les clés d'origine (les anciennes parties sont conservées).
export const SLOTS = 4;
const SKEY = 'aetheria.settings.v1';
const LAST = 'aetheria.slot';
const keyFor = (i) => (i === 0 ? 'aetheria.save.v1' : `aetheria.save.v1.s${i}`);
const docFor = (i) => (i === 0 ? 'hero' : 'hero' + (i + 1));

import { clone } from '../engine/math.js';

export { clone };
function lsGet(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch { /* */ } }

export class Save {
  constructor(game, platform) {
    this.game = game; this.platform = platform;
    this.loaded = null; this.hadSave = false;
    this.timer = null;
    this.lastDb = 0;
    this.dbBlocked = false;
    this.data = new Array(SLOTS).fill(null);
    const last = lsGet(LAST);
    this.slot = Number.isInteger(last) && last >= 0 && last < SLOTS ? last : 0;
  }

  static localSettings() { return lsGet(SKEY); }
  static saveSettings(s) { lsSet(SKEY, s); }

  docRef(i = this.slot) {
    const p = this.platform;
    if (!p.db || !p.userId || this.dbBlocked) return null;
    try { return p.db.doc('data/users/' + p.userId + '/' + docFor(i)); } catch { return null; }
  }

  async init() {
    await Promise.all(Array.from({ length: SLOTS }, async (_, i) => {
      const local = lsGet(keyFor(i));
      let remote = null;
      const ref = this.docRef(i);
      if (ref) {
        try { const snap = await ref.get(); if (snap.exists) remote = clone(snap.data()?.save) || null; } catch { /* hors ligne */ }
      }
      // la sauvegarde la plus récente l'emporte
      const pick = [local, remote].filter((d) => d && d.hero && !d.deleted).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0] || null;
      // un emplacement supprimé sur un autre appareil reste vide
      const del = [local, remote].filter((d) => d && d.deleted).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0];
      this.data[i] = pick && (!del || del.savedAt < pick.savedAt) ? pick : null;
    }));
    // emplacement mémorisé vide : on prend le plus récent
    if (!this.data[this.slot]) {
      const best = this.data.map((d, i) => [d?.savedAt || 0, i]).sort((a, b) => b[0] - a[0])[0];
      if (best && best[0]) this.slot = best[1];
    }
    this.select(this.slot);
    return this.loaded;
  }

  // choisit l'emplacement où l'on joue (et où l'on écrira)
  select(i) {
    this.slot = i;
    lsSet(LAST, i);
    const d = this.data[i];
    this.loaded = d && d.hero ? { ...d.hero, pos: d.pos, quests: d.quests, savedAt: d.savedAt } : null;
    this.hadSave = !!this.loaded;
    return this.loaded;
  }

  // résumé pour l'écran titre
  summary(i) {
    const d = this.data[i];
    if (!d || !d.hero) return null;
    const hh = d.hero;
    return { name: hh.name, classId: hh.classId, level: hh.level || 1, playTime: hh.playTime || 0, savedAt: d.savedAt || 0, gold: hh.gold || 0, title: hh.title || '' };
  }

  snapshot() {
    const g = this.game;
    if (!g.hero) return null;
    const p = g.player;
    return {
      v: 1, savedAt: Date.now(), slot: this.slot,
      hero: g.hero.serialize(),
      pos: p && !p.dead && p.onGround ? [Math.round(p.position.x * 10) / 10, Math.round(p.position.y * 10) / 10, Math.round(p.position.z * 10) / 10] : null,
      quests: g.quests?.serialize?.() || null,
    };
  }

  soon(delay = 3) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.write(), delay * 1000);
  }

  async write(force = false) {
    if (!this.game.inGame) return;
    const data = this.snapshot();
    if (!data) return;
    const slot = this.slot;
    this.data[slot] = data;
    lsSet(keyFor(slot), data);
    const now = Date.now();
    if (!force && now - this.lastDb < 20000) { this.soon(Math.max(2, (20000 - (now - this.lastDb)) / 1000)); return; }
    const ref = this.docRef(slot);
    if (!ref || this.writing) return;
    this.lastDb = now;
    this.writing = true;
    try { await ref.set({ save: data }); }
    catch (e) { if (e?.code === 'invalid_argument') this.dbBlocked = true; }
    finally { this.writing = false; }
  }

  saveSettings() { Save.saveSettings(this.game.settings); }

  // efface un emplacement (local et distant : une marque « supprimé » datée évite qu'une vieille copie revienne)
  wipe(i = this.slot) {
    clearTimeout(this.timer);
    lsDel(keyFor(i));
    this.data[i] = null;
    if (i === this.slot) { this.loaded = null; this.hadSave = false; }
    const ref = this.docRef(i);
    if (ref) ref.set({ save: { deleted: true, savedAt: Date.now() } }).catch(() => {});
  }
}
