// Transports réseau interchangeables. Tous exposent la même interface :
//   connect() · setPresence(obj) · onPeers(cb(list)) · onStatus(cb(bool)) · selfId · close()
// où list = [{ id, isMe, presence, guest, by }].

// 1) Salle temps réel de la plateforme Claude (capacité `room`) : la présence de
//    chaque joueur est partagée avec tout le monde et rejouée aux nouveaux venus.
export class RoomTransport {
  constructor(room) { this.room = room; this.kind = 'room'; this.selfId = null; this.cbs = []; this.statusCbs = []; this.pending = null; this.sending = false; }
  connect() {
    const room = this.room;
    room.onPeers((ch) => {
      const list = ch.peers.filter((p) => p.kind === 'viewer').map((p) => ({ id: p.peer, isMe: p.sameTab, presence: p.presence || {}, guest: p.guest, by: p.by, updatedAt: p.updatedAt }));
      const me = ch.peers.find((p) => p.sameTab);
      if (me) this.selfId = me.peer;
      for (const cb of this.cbs) cb(list);
    }, (e) => { console.warn('salle', e.code); this.dead = true; this.statusCbs.forEach((f) => f(false)); });
    room.onConnection((c) => this.statusCbs.forEach((f) => f(c)), () => {});
  }
  get connected() { try { return !this.dead && this.room.connected(); } catch { return false; } }
  setPresence(obj) {
    // une seule écriture en vol ; la dernière valeur gagne
    this.pending = obj;
    if (this.sending || this.dead) return;
    const flush = () => {
      const p = this.pending; this.pending = null;
      if (!p) { this.sending = false; return; }
      this.sending = true;
      this.room.presence(p).catch((e) => { if (e?.code === 'invalid_argument') console.warn('présence trop volumineuse', e.message); }).finally(() => { this.sending = false; if (this.pending) flush(); });
    };
    flush();
  }
  onPeers(cb) { this.cbs.push(cb); }
  onStatus(cb) { this.statusCbs.push(cb); }
  close() { try { this.room.presence({ g: null }); } catch { /* */ } }
}

// 2) Onglets du même navigateur (BroadcastChannel) : multijoueur local pour tester.
export class BroadcastTransport {
  constructor(name = 'aetheria-v1') {
    this.kind = 'local';
    this.selfId = 'tab-' + Math.random().toString(36).slice(2, 10);
    this.ch = new BroadcastChannel(name);
    this.peers = new Map();
    this.cbs = []; this.statusCbs = [];
    this.presence = {};
  }
  connect() {
    this.ch.onmessage = (e) => {
      const m = e.data;
      if (!m || m.from === this.selfId) return;
      if (m.type === 'bye') this.peers.delete(m.from);
      else if (m.type === 'p') { this.peers.set(m.from, { presence: m.presence, t: Date.now() }); if (m.hello) this.ch.postMessage({ type: 'p', from: this.selfId, presence: this.presence }); }
      this.emit();
    };
    this.ch.postMessage({ type: 'p', from: this.selfId, presence: this.presence, hello: true });
    this.iv = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, p] of this.peers) if (now - p.t > 6000) { this.peers.delete(id); changed = true; }
      if (changed) this.emit();
      this.ch.postMessage({ type: 'p', from: this.selfId, presence: this.presence });
    }, 2000);
    addEventListener('beforeunload', () => this.close());
    setTimeout(() => this.statusCbs.forEach((f) => f(true)), 0);
  }
  get connected() { return true; }
  emit() {
    if (this.closed) return;
    const list = [{ id: this.selfId, isMe: true, presence: this.presence }];
    for (const [id, p] of this.peers) list.push({ id, isMe: false, presence: p.presence });
    for (const cb of this.cbs) cb(list);
  }
  setPresence(obj) {
    if (this.closed) return;
    this.presence = { ...this.presence, ...obj };
    for (const k of Object.keys(this.presence)) if (this.presence[k] === null) delete this.presence[k];
    this.ch.postMessage({ type: 'p', from: this.selfId, presence: this.presence });
  }
  onPeers(cb) { this.cbs.push(cb); }
  onStatus(cb) { this.statusCbs.push(cb); }
  close() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.iv);
    try { this.ch.postMessage({ type: 'bye', from: this.selfId }); } catch { /* */ }
    this.ch.onmessage = null;
    try { this.ch.close(); } catch { /* */ }
    this.cbs.length = 0; this.statusCbs.length = 0;
  }
}

// 3) Serveur relais WebSocket (server/relay.mjs) pour un hébergement indépendant.
export class WSTransport {
  constructor(url) {
    this.kind = 'ws'; this.url = url; this.selfId = null;
    this.cbs = []; this.statusCbs = []; this.presence = {}; this.peers = new Map();
    this.ok = false;
  }
  connect() {
    const open = () => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => { this.ok = true; this.statusCbs.forEach((f) => f(true)); ws.send(JSON.stringify({ t: 'p', p: this.presence })); };
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'hello') this.selfId = m.id;
        else if (m.t === 'p') this.peers.set(m.id, m.p);
        else if (m.t === 'bye') this.peers.delete(m.id);
        else if (m.t === 'all') { this.peers.clear(); for (const [id, p] of Object.entries(m.peers)) this.peers.set(id, p); }
        this.emit();
      };
      ws.onclose = () => { this.ok = false; if (this.closed) return; this.statusCbs.forEach((f) => f(false)); setTimeout(() => { if (!this.closed) open(); }, 3000); };
    };
    open();
  }
  get connected() { return this.ok; }
  emit() {
    if (this.closed) return;
    const list = [{ id: this.selfId || 'me', isMe: true, presence: this.presence }];
    for (const [id, p] of this.peers) if (id !== this.selfId) list.push({ id, isMe: false, presence: p });
    for (const cb of this.cbs) cb(list);
  }
  setPresence(obj) {
    this.presence = { ...this.presence, ...obj };
    for (const k of Object.keys(this.presence)) if (this.presence[k] === null) delete this.presence[k];
    if (this.ok) this.ws.send(JSON.stringify({ t: 'p', p: this.presence }));
  }
  onPeers(cb) { this.cbs.push(cb); }
  onStatus(cb) { this.statusCbs.push(cb); }
  close() { this.closed = true; this.cbs.length = 0; this.statusCbs.length = 0; try { this.ws?.close(); } catch { /* */ } }
}
