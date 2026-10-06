// Accès aux capacités de la plateforme (salle temps réel, base partagée, identité, IA).
// Tout est optionnel : le jeu fonctionne entièrement en solo si rien n'est disponible.

function withTimeout(p, ms, fallback = null) {
  return Promise.race([Promise.resolve(p).catch(() => fallback), new Promise((r) => setTimeout(() => r(fallback), ms))]);
}

export class Platform {
  constructor() {
    this.db = null; this.room = null; this.user = null; this.sample = null;
    this.userId = null; this.userName = ''; this.canWrite = null;
    this.listeners = { room: [], db: [], sample: [], user: [] };
    this.ready = false;
  }

  get hasClaude() { return !!(window.claude && typeof window.claude.use === 'function'); }

  set(name, ns) {
    if (!ns) return;
    this[name] = ns;
    for (const f of this.listeners[name].splice(0)) { try { f(ns); } catch (e) { console.error(e); } }
  }

  async init() {
    if (!this.hasClaude) { this.ready = true; return this; }
    const use = (n) => withTimeout(window.claude.use(n), 11000, null);
    const userP = use('user').then(async (user) => {
      if (user) {
        const me = await withTimeout(user.me(), 4000, null);
        this.userId = me?.id || null;
        this.userName = me?.name || '';
        this.userColor = me?.color || null;
        this.canWrite = await withTimeout(user.can('data.write'), 3000, null);
      }
      this.set('user', user);
    });
    const dbP = use('db').then((db) => this.set('db', db));
    use('room').then((room) => this.set('room', room));
    use('sample').then((s) => this.set('sample', s));
    await Promise.all([userP, dbP]);
    this.ready = true;
    return this;
  }

  on(name, f) { if (this[name]) f(this[name]); else this.listeners[name].push(f); }
  onRoom(f) { this.on('room', f); }
  onDb(f) { this.on('db', f); }

  // nombre de joueurs dans la salle (pour l'écran titre)
  onOnline(f) {
    this.onRoom((room) => {
      try { room.onPeers((ch) => f(ch.peers.filter((p) => p.kind === 'viewer').length)); } catch { /* salle indisponible */ }
    });
  }

  firstName() { return (this.userName || '').split(/\s+/)[0] || ''; }
}
