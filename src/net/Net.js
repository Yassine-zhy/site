import * as THREE from 'three';
import { RoomTransport, BroadcastTransport, WSTransport } from './Transports.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { ABILITIES, basicVisual } from '../game/Abilities.js';

export const PROTO = 3;
const MAX_BYTES = 3900;

// Synchronisation multijoueur par "présence" : chaque joueur publie son état complet
// (position, actions récentes, coups portés...). Le joueur le plus ancien de la salle
// devient l'hôte : il simule les squelettes et publie leur état pour tous.
export class Net {
  constructor(game) {
    this.game = game;
    this.transport = null;
    this.peers = new Map(); // id -> { presence, seen: {chan: seq} }
    this.seq = { a: 0, h: 0, fx: 0, ch: 0, em: 0, ab: 0, K: 0, D: 0, X: 0 };
    this.out = { a: [], h: [], fx: [], K: [], D: [], X: [] };
    this.chat = null; this.emote = null; this.allyBuff = null;
    this.since = Date.now();
    this.sendT = 0;
    this.hostId = null;
    this.mode = 'solo';
    this.lastKillSeq = 0; this.lastXSeq = 0;
  }

  get selfId() { return this.shortId || 'local'; }
  short(id) { return id ? String(id).slice(-8) : null; }
  peerCount() { let n = 1; for (const p of this.peers.values()) if (p.presence.g) n++; return n; }

  start() {
    const g = this.game, params = new URLSearchParams(location.search);
    const ws = params.get('server');
    const room = g.platform.room;
    if (room) this.useTransport(new RoomTransport(room), 'room');
    else if (ws) this.useTransport(new WSTransport(ws), 'ws');
    else if (params.get('local') !== '0' && typeof BroadcastChannel !== 'undefined') { try { this.useTransport(new BroadcastTransport(), 'local'); } catch (e) { console.warn('multijoueur local indisponible', e); } }
    // la salle peut arriver plus tard
    if (!room) g.platform.onRoom((r) => { if (this.mode !== 'room') { this.transport?.close(); this.useTransport(new RoomTransport(r), 'room'); } });
  }

  useTransport(t, mode) {
    try {
      t.onPeers((list) => { if (this.transport === t) this.onPeers(list); });
      t.onStatus((c) => { if (this.transport === t) this.connected = c; });
      t.connect();
    } catch (e) {
      console.warn('transport indisponible', mode, e);
      try { t.close(); } catch { /* */ }
      return false;
    }
    this.transport = t; this.mode = mode;
    this.shortId = this.short(t.selfId) || this.shortId;
    return true;
  }

  // ------------------------------------------------------------------ réception
  onPeers(list) {
    const g = this.game, now = performance.now();
    if (this.transport?.selfId) this.shortId = this.short(this.transport.selfId);
    const seenIds = new Set();
    for (const p of list) {
      if (p.isMe) continue;
      const pr = p.presence || {};
      if (pr.v !== PROTO) continue;
      const id = this.short(p.id);
      seenIds.add(id);
      let st = this.peers.get(id);
      const fresh = !st;
      if (!st) { st = { presence: pr, seen: {} }; this.peers.set(id, st); }
      st.presence = pr;
      st.guest = p.guest;
      if (fresh) {
        // on ne rejoue pas l'historique d'un joueur qu'on découvre
        for (const ch of ['a', 'h', 'fx', 'K', 'D', 'X']) st.seen[ch] = maxSeq(pr[ch]);
        st.seen.ch = pr.ch?.[0] || 0; st.seen.em = pr.em?.[0] || 0; st.seen.ab = pr.ab?.[0] || 0;
        if (pr.g && pr.n) g.ui.toast(`<b>${escapeHtml(pr.n)}</b> a rejoint Aetheria.`, { time: 3 });
      }
      if (pr.g) this.handlePlayer(id, st, pr, now);
      else this.removeRemote(id);
    }
    for (const id of [...this.peers.keys()]) if (!seenIds.has(id)) {
      const pr = this.peers.get(id).presence;
      if (pr.g && pr.n) g.ui.toast(`${escapeHtml(pr.n)} a quitté le monde.`, { time: 2.5 });
      this.peers.delete(id); this.removeRemote(id);
    }
    this.electHost();
    // état des squelettes publié par l'hôte
    if (this.hostId && this.hostId !== this.selfId) {
      const host = this.peers.get(this.hostId);
      if (host && Array.isArray(host.presence.E)) g.enemies.applySnapshot(host.presence.E, now);
    }
  }

  handlePlayer(id, st, pr, now) {
    const g = this.game;
    let rp = g.remotePlayers.get(id);
    if (!rp) { rp = new RemotePlayer(g, id, pr); g.remotePlayers.set(id, rp); }
    else if (pr.c && pr.c !== rp.classId) { rp.dispose(); rp = new RemotePlayer(g, id, pr); g.remotePlayers.set(id, rp); }
    rp.apply(pr, now);
    // actions (compétences, runes, attaques)
    for (const [s, aid, data] of fresh(pr.a, st.seen, 'a')) this.playRemoteAction(rp, aid, data || {});
    // coups portés aux squelettes (pour l'hôte)
    if (g.enemies.isHost) for (const [s, eid, dmg, opts] of fresh(pr.h, st.seen, 'h')) g.enemies.pendingHits.push({ e: eid, d: Math.min(5000, dmg | 0), from: id, o: sanitizeOpts(opts) });
    else fresh(pr.h, st.seen, 'h');
    // effets visuels
    for (const [s, type, d] of fresh(pr.fx, st.seen, 'fx')) { try { g.playNetFx(type, d || {}); } catch { /* données invalides */ } }
    // discussion
    if (Array.isArray(pr.ch) && pr.ch[0] > (st.seen.ch || 0)) {
      st.seen.ch = pr.ch[0];
      const text = cleanText(pr.ch[1]);
      if (text) { rp.say(text); g.chat?.add(rp.name, text, { cls: rp.classId }); g.audio?.play('chat'); }
    }
    if (Array.isArray(pr.em) && pr.em[0] > (st.seen.em || 0)) { st.seen.em = pr.em[0]; rp.char.playAction(pr.em[1] === 'sit' ? 'Sit_Floor_Down' : 'Cheer', { full: true }); }
    if (Array.isArray(pr.ab) && pr.ab[0] > (st.seen.ab || 0)) {
      st.seen.ab = pr.ab[0];
      if (pr.ab[1] === 'rally' && g.player && Math.hypot(rp.position.x - g.player.position.x, rp.position.z - g.player.position.z) < 15) {
        g.hero.addBuff('rally', 10, { 'atk%': 25, 'def%': 30 });
        g.ui.toast(`${escapeHtml(rp.name)} vous galvanise : <b>Cri de ralliement</b>`, { time: 2.5 });
      }
    }
    // évènements de l'hôte : morts de squelettes, dégâts aux joueurs, effets ennemis
    if (pr.H) {
      for (const k of fresh(pr.K, st.seen, 'K')) {
        const [s, eid, type, lvl, elite, xp, x, y, z, killers, boss] = k;
        if (Array.isArray(killers) && killers.includes(this.selfId)) g.rewardKill({ type, level: lvl, elite: !!elite, xp: Math.min(5000, xp | 0), x, y, z, boss: !!boss });
        g.onRemoteKill?.({ type, x, y, z, boss: !!boss });
      }
      for (const [s, target, dmg, kind, sx, sz] of fresh(pr.D, st.seen, 'D')) {
        if (target === this.selfId) g.takeDamage(Math.min(2000, dmg | 0), sx != null && sz != null ? { position: new THREE.Vector3(sx, 0, sz), def: { name: kind === 'boss' ? 'le Roi Sans Lumière' : 'un squelette' } } : null, { kind });
      }
      for (const ev of fresh(pr.X, st.seen, 'X')) { const [s, type, x, y, z, data] = ev; try { g.enemies.playFx({ type, x, y, z, ...(data || {}) }); } catch { /* */ } }
    }
  }

  playRemoteAction(rp, aid, data) {
    const g = this.game;
    const c = { game: g, actor: rp, classId: rp.classId, isLocal: false };
    try {
      if (aid === 'basic') basicVisual(c, data);
      else if (aid.startsWith('rune:')) g.runes?.visual(aid.slice(5), data, rp);
      else if (ABILITIES[aid]) ABILITIES[aid].visual(c, data);
    } catch (e) { console.warn('action distante', aid, e); }
  }

  removeRemote(id) {
    const rp = this.game.remotePlayers.get(id);
    if (rp) { rp.dispose(); this.game.remotePlayers.delete(id); this.game.ui.removePlate('p:' + id); }
  }

  electHost() {
    const g = this.game;
    let best = { id: this.selfId, since: this.since };
    if (!g.inGame) best = null;
    for (const [id, st] of this.peers) {
      const pr = st.presence;
      if (!pr.g) continue;
      const since = pr.si || Infinity;
      if (!best || since < best.since || (since === best.since && id < best.id)) best = { id, since };
    }
    const hostId = best ? best.id : this.selfId;
    if (hostId !== this.hostId) {
      const wasHost = this.hostId === this.selfId;
      this.hostId = hostId;
      if (hostId === this.selfId) { if (!g.enemies.isHost) g.enemies.becomeHost(); }
      else { if (g.enemies.isHost || wasHost) g.enemies.becomeClient(); }
    }
  }

  // ------------------------------------------------------------------ envoi
  push(chan, entry) {
    const list = this.out[chan];
    list.push([++this.seq[chan], ...entry]);
    const max = { a: 4, h: 12, fx: 4, K: 5, D: 8, X: 6 }[chan];
    while (list.length > max) list.shift();
    this.dirty = true;
  }

  sendAction(id, data) { this.push('a', [id, compact(data)]); this.sendT = 0; }
  queueHit(eid, dmg, opts = {}) { this.push('h', [eid, dmg, { s: opts.stun, sl: opts.slow, k: opts.knock ? [round1(opts.knock.x), round1(opts.knock.z), opts.knock.d] : undefined, t: opts.threat }]); this.sendT = 0; }
  sendFx(type, data) { this.push('fx', [type, compact(data)]); }
  queueDamage(target, dmg, kind, src) { this.push('D', [target, dmg, kind, src?.[0] !== undefined ? round1(src[0]) : undefined, src?.[1] !== undefined ? round1(src[1]) : undefined]); }
  sendChat(text) { this.chat = [++this.seq.ch, cleanText(text)]; this.dirty = true; this.sendT = 0; }
  sendEmote(e) { this.emote = [++this.seq.em, e]; this.dirty = true; }
  sendAllyBuff(b) { this.allyBuff = [++this.seq.ab, b]; this.dirty = true; }
  announce() { /* réservé */ }

  update(dt) {
    const g = this.game;
    if (!this.transport) return;
    const now = performance.now();
    for (const rp of g.remotePlayers.values()) rp.update(dt, now);
    // évènements de l'hôte à publier
    if (g.enemies.isHost) {
      for (const k of g.enemies.killEvents.splice(0)) this.push('K', [k.id, k.type, k.level, k.elite ? 1 : 0, k.xp, round1(k.x), round1(k.y), round1(k.z), k.killers, k.boss ? 1 : 0]);
      for (const x of g.enemies.fxEvents.splice(0)) { const { s, type, x: px, y: py, z: pz, t, ...rest } = x; this.push('X', [type, px, py, pz, rest]); }
    } else { g.enemies.killEvents.length = 0; g.enemies.fxEvents.length = 0; }
    this.sendT -= dt;
    const rate = g.enemies.isHost && this.peers.size ? 0.09 : 0.1;
    if (this.sendT > 0) return;
    this.sendT = rate;
    // JSON strict (pas d'undefined ni de NaN) et taille bornée : la salle refuse sinon la mise à jour entière.
    // On réduit d'abord ce qui est purement visuel ; les coups portés et les évènements de l'hôte passent en dernier.
    const pr = this.buildPresence();
    let json = JSON.stringify(pr), bytes = enc.encode(json).length;
    const shrink = () => { json = JSON.stringify(pr); bytes = enc.encode(json).length; };
    if (bytes > MAX_BYTES) { pr.fx = []; if (pr.a) pr.a = pr.a.slice(-2); pr.ti = ''; shrink(); }
    while (bytes > MAX_BYTES && Array.isArray(pr.E) && pr.E.length) { pr.E = pr.E.slice(0, Math.floor(pr.E.length * 0.75)); shrink(); }
    if (bytes > MAX_BYTES) { for (const k of ['X', 'K', 'D', 'h']) if (Array.isArray(pr[k])) pr[k] = pr[k].slice(-4); shrink(); }
    if (bytes > MAX_BYTES) { if (!this.warned) { this.warned = true; console.warn('présence trop volumineuse', bytes); } return; }
    try { this.transport.setPresence(JSON.parse(json)); } catch (e) { console.warn('envoi de la présence', e); }
  }

  buildPresence() {
    const g = this.game, p = g.player, hero = g.hero;
    const pr = { v: PROTO, si: this.since, g: g.inGame ? 1 : 0 };
    if (g.inGame && p) {
      pr.n = hero.name; pr.c = hero.classId; pr.l = hero.level; pr.ti = hero.title || '';
      pr.p = [Math.round(p.position.x * 10), Math.round(p.position.y * 10), Math.round(p.position.z * 10)];
      pr.r = Math.round(p.facing * 100);
      pr.s = (p.gliding ? 1 : 0) | (p.dead ? 2 : 0) | (hero.hasBuff('stealth') ? 4 : 0) | (p.onGround ? 8 : 0) | (p.sprinting ? 16 : 0);
      pr.hp = Math.round(Math.max(0, hero.hp / hero.stats.hp) * 100);
      pr.a = this.out.a; pr.h = this.out.h; pr.fx = this.out.fx;
      pr.ch = this.chat; pr.em = this.emote; pr.ab = this.allyBuff;
    }
    if (g.enemies.isHost && g.inGame) {
      pr.H = 1;
      pr.K = this.out.K; pr.D = this.out.D; pr.X = this.out.X;
      pr.E = this.trimEnemies(g.enemies.snapshot());
    } else { pr.H = 0; pr.E = null; pr.K = null; pr.D = null; pr.X = null; }
    return pr;
  }

  // garde la présence sous la limite de 4 Kio : on ne publie que les squelettes proches des joueurs
  trimEnemies(list) {
    const g = this.game;
    const pts = g.playerTargets().map((t) => t.position);
    const scored = list.map((e) => {
      const x = e[3] / 10, z = e[4] / 10;
      let d = Infinity; for (const p of pts) d = Math.min(d, Math.hypot(p.x - x, p.z - z));
      return { e, d: e[1] === 4 ? 0 : d };
    }).filter((s) => s.d < 140).sort((a, b) => a.d - b.d);
    return scored.slice(0, 32).map((s) => s.e);
  }
}

const enc = new TextEncoder();
function maxSeq(list) { return Array.isArray(list) && list.length ? Math.max(...list.map((e) => (Array.isArray(e) ? e[0] | 0 : 0))) : 0; }
function fresh(list, seen, chan) {
  if (!Array.isArray(list)) return [];
  const last = seen[chan] || 0;
  const out = list.filter((e) => Array.isArray(e) && (e[0] | 0) > last);
  if (out.length) seen[chan] = Math.max(...out.map((e) => e[0] | 0));
  return out;
}
function round1(v) { return Math.round(v * 10) / 10; }
function compact(d) {
  if (!d || typeof d !== 'object') return d;
  const o = {};
  for (const [k, v] of Object.entries(d)) {
    if (Array.isArray(v)) o[k] = v.map((x) => (typeof x === 'number' ? round1(x) : Array.isArray(x) ? x.map((y) => (typeof y === 'number' ? round1(y) : y)) : x));
    else if (typeof v === 'number') o[k] = Math.round(v * 100) / 100;
    else o[k] = v;
  }
  return o;
}
function sanitizeOpts(o) {
  if (!o || typeof o !== 'object') return {};
  const r = {};
  if (typeof o.s === 'number') r.stun = Math.min(3, o.s);
  if (typeof o.sl === 'number') r.slow = Math.min(6, o.sl);
  if (Array.isArray(o.k)) r.knock = { x: +o.k[0], z: +o.k[1], d: Math.min(6, +o.k[2] || 2) };
  if (typeof o.t === 'number') r.threat = Math.min(5, o.t);
  return r;
}
export function cleanText(s) { return String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '').slice(0, 160).trim(); }
export function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
