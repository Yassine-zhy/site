// Sauvegarde : navigateur (toujours) + base partagée de la plateforme (si disponible),
// pour retrouver son héros sur n'importe quel appareil.
const KEY = 'aetheria.save.v1';
const SKEY = 'aetheria.settings.v1';

// les documents de la base sont figés : on travaille toujours sur une copie
export function clone(v) { return v === undefined || v === null ? v : JSON.parse(JSON.stringify(v)); }
function lsGet(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }

export class Save {
  constructor(game, platform) {
    this.game = game; this.platform = platform;
    this.loaded = null; this.hadSave = false;
    this.timer = null;
    this.lastDb = 0;
    this.dbBlocked = false;
  }

  static localSettings() { return lsGet(SKEY); }
  static saveSettings(s) { lsSet(SKEY, s); }

  docRef() {
    const p = this.platform;
    if (!p.db || !p.userId || this.dbBlocked) return null;
    try { return p.db.doc('data/users/' + p.userId + '/hero'); } catch { return null; }
  }

  async init() {
    const local = lsGet(KEY);
    let remote = null;
    const ref = this.docRef();
    if (ref) {
      try { const snap = await ref.get(); if (snap.exists) remote = clone(snap.data()?.save) || null; } catch { /* hors ligne */ }
    }
    // la sauvegarde la plus récente l'emporte
    const pick = [local, remote].filter(Boolean).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0] || null;
    this.loaded = pick && pick.hero ? { ...pick.hero, pos: pick.pos, quests: pick.quests, savedAt: pick.savedAt } : null;
    this.hadSave = !!this.loaded;
    return this.loaded;
  }

  snapshot() {
    const g = this.game;
    if (!g.hero) return null;
    const p = g.player;
    return {
      v: 1, savedAt: Date.now(),
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
    const data = this.snapshot();
    if (!data) return;
    lsSet(KEY, data);
    const now = Date.now();
    if (!force && now - this.lastDb < 20000) { this.soon(Math.max(2, (20000 - (now - this.lastDb)) / 1000)); return; }
    const ref = this.docRef();
    if (!ref || this.writing) return;
    this.lastDb = now;
    this.writing = true;
    try { await ref.set({ save: data }); }
    catch (e) { if (e?.code === 'invalid_argument') this.dbBlocked = true; }
    finally { this.writing = false; }
  }

  saveSettings() { Save.saveSettings(this.game.settings); }

  wipe() {
    try { localStorage.removeItem(KEY); } catch { /* */ }
    const ref = this.docRef();
    if (ref) ref.delete().catch(() => {});
  }
}
