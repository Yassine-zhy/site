// Orchestre échantillonné : de vrais instruments (cordes, cuivres, harpe, timbales, cloches…)
// enregistrés par Versilian Studios (VSCO 2 Community Edition et VCSL, domaine public CC0),
// joués par un séquenceur qui compose en direct à partir du thème de l'Aube (leitmotiv en ré
// mineur) et de sa variante pastorale : chaque région a son orchestration, chaque seigneur son
// arrangement de combat, et les grands moments du récit leurs fanfares.
// Si les échantillons ne se chargent pas (navigateur sans Ogg Vorbis…), la musique procédurale
// d'Audio.js prend le relais.

const BASE = './assets/orch/';
const CORE = ['cello_sus', 'violin_sus', 'bass_sus', 'harp_pluck', 'horn_sus', 'flute_sus', 'timpani_hit'];
const HIT = /_hit$|timpani_roll/;
const SHORT = /pizz|spic|stac|pluck|glock/;

// réglage de chaque pupitre : niveau, place dans l'orchestre, part de réverbération
const DESK = {
  cello_sus: [0.5, -0.3, 0.35], violin_sus: [0.42, 0.3, 0.4], bass_sus: [0.5, -0.1, 0.25],
  violin_trem: [0.3, 0.35, 0.4], cello_trem: [0.38, -0.35, 0.35],
  horn_sus: [0.55, -0.15, 0.45], trombone_sus: [0.45, 0.1, 0.4], tuba_sus: [0.5, 0, 0.3], trumpet_sus: [0.42, 0.2, 0.45],
  flute_sus: [0.42, 0.25, 0.5], vibes_bowed: [0.32, -0.2, 0.6],
  cello_pizz: [0.5, -0.25, 0.3], violin_spic: [0.42, 0.3, 0.3], horn_stac: [0.42, -0.1, 0.35],
  harp_pluck: [0.5, -0.4, 0.5], tubularbells_hit: [0.32, 0.15, 0.7], glock_hit: [0.25, 0.4, 0.6],
  timpani_hit: [0.6, 0, 0.35], timpani_roll: [0.5, 0, 0.35], bassdrum_hit: [0.55, 0, 0.3], cymbal_hit: [0.28, 0.1, 0.5], gong_hit: [0.5, 0, 0.6],
};

const Q = { M: [0, 4, 7], m: [0, 3, 7], D7: [0, 4, 7, 10], s4: [0, 5, 7] };

// le thème de l'Aube (ré mineur) : 8 mesures, notes [temps, hauteur MIDI, durée en temps]
const AUBE = {
  chords: [[38, 'm'], [34, 'M'], [38, 'm'], [36, 'M'], [31, 'm'], [29, 'M'], [34, 'M'], [33, 'M']],
  mel: [
    [[0, 62, 2], [2, 69, 1], [3, 67, 1]],
    [[0, 65, 1.5], [1.5, 64, 0.5], [2, 62, 1], [3, 60, 1]],
    [[0, 62, 2], [2, 65, 1], [3, 69, 1]],
    [[0, 67, 3]],
    [[0, 70, 2], [2, 69, 1], [3, 67, 1]],
    [[0, 65, 1.5], [1.5, 67, 0.5], [2, 69, 2]],
    [[0, 74, 2], [2, 72, 1], [3, 70, 1]],
    [[0, 69, 4]],
  ],
};
// sa variante pastorale (ré majeur), pour les terres paisibles
const PRES = {
  chords: [[38, 'M'], [33, 'M'], [31, 'M'], [38, 'M'], [35, 'm'], [31, 'M'], [33, 'D7'], [38, 'M']],
  mel: [
    [[0, 66, 1], [1, 69, 1], [2, 74, 2]],
    [[0, 73, 1.5], [1.5, 71, 0.5], [2, 69, 2]],
    [[0, 71, 1], [1, 74, 1], [2, 76, 1], [3, 74, 1]],
    [[0, 69, 3]],
    [[0, 71, 1.5], [1.5, 73, 0.5], [2, 74, 1], [3, 71, 1]],
    [[0, 69, 1], [1, 67, 1], [2, 66, 2]],
    [[0, 64, 1], [1, 66, 1], [2, 67, 1], [3, 69, 1]],
    [[0, 66, 4]],
  ],
};

// arrangements : ensemble harmonique, tonalité (demi-tons), tempo, pupitres
const THEMES = {
  // écran titre : le thème de l'Aube en grand
  title: { set: AUBE, key: 0, bpm: 66, pad: [['cello_sus', 45, 57, 0.55], ['violin_sus', 62, 74, 0.4]], bass: ['bass_sus', 0.5], arp: ['harp_pluck', 0.5, 'quarter'], lead: [['horn_sus', 0, 0.75], ['violin_sus', 0, 0.6]], timp: 'phrase', roll: true },
  prologue: { set: AUBE, key: 0, bpm: 52, pad: [['cello_sus', 45, 57, 0.7], ['violin_sus', 62, 74, 0.45], ['vibes_bowed', 62, 74, 0.5]], bass: ['bass_sus', 0.6], arp: ['harp_pluck', 0.55, 'quarter'], lead: [['horn_sus', 0, 0.75]], roll: true },
  temperate: { set: PRES, key: 0, bpm: 80, pad: [['cello_sus', 45, 57, 0.45], ['violin_sus', 62, 76, 0.32]], bass: ['bass_sus', 0.35], arp: ['harp_pluck', 0.55, 'eighth'], lead: [['flute_sus', 12, 0.6], null, ['violin_sus', 0, 0.55], null] },
  cliffs: { set: PRES, key: -2, bpm: 72, pad: [['cello_sus', 43, 55, 0.45], ['violin_sus', 60, 74, 0.32]], bass: ['bass_sus', 0.4], arp: ['harp_pluck', 0.45, 'quarter'], lead: [['horn_sus', 0, 0.6], null, ['flute_sus', 12, 0.55], null], timp: 'phrase' },
  highland: { set: PRES, key: -2, bpm: 76, pad: [['cello_sus', 43, 55, 0.5], ['violin_sus', 60, 74, 0.35]], bass: ['bass_sus', 0.45], arp: ['harp_pluck', 0.45, 'eighth'], lead: [['horn_sus', 0, 0.65], null, ['trumpet_sus', 0, 0.45], null], timp: 'phrase' },
  beach: { set: PRES, key: 2, bpm: 84, pad: [['cello_sus', 45, 57, 0.35], ['violin_sus', 64, 78, 0.28]], bass: ['bass_sus', 0.3], arp: ['harp_pluck', 0.6, 'eighth'], lead: [['flute_sus', 12, 0.6], null] },
  jungle: { set: PRES, key: 3, bpm: 96, pad: [['cello_sus', 45, 57, 0.35], ['violin_sus', 64, 76, 0.25]], bass: ['bass_sus', 0.3], arp: ['harp_pluck', 0.5, 'eighth'], ost: ['cello_pizz', 0.45], lead: [['flute_sus', 12, 0.55], null, ['glock_hit', 12, 0.4], null] },
  snow: { set: AUBE, key: 7, bpm: 64, pad: [['violin_trem', 62, 76, 0.42], ['vibes_bowed', 57, 74, 0.55], ['cello_sus', 45, 57, 0.4]], bass: ['bass_sus', 0.4], arp: ['harp_pluck', 0.45, 'quarter'], lead: [['glock_hit', 0, 0.5], null, ['flute_sus', 0, 0.6], null], bells: true },
  amber: { set: AUBE, key: -2, bpm: 88, pad: [['cello_sus', 43, 55, 0.45], ['horn_sus', 53, 62, 0.25]], bass: ['bass_sus', 0.45], ost: ['cello_pizz', 0.5], lead: [['horn_sus', 0, 0.65], null, ['trumpet_sus', 0, 0.45], null], timp: 'bar' },
  haunted: { set: AUBE, key: -5, bpm: 58, pad: [['cello_trem', 40, 52, 0.55], ['violin_trem', 57, 69, 0.35]], bass: ['bass_sus', 0.55], arp: ['harp_pluck', 0.3, 'quarter'], lead: [['horn_sus', 0, 0.6], null, ['cello_sus', -12, 0.7], null], bells: true },
  swamp: { set: AUBE, key: -7, bpm: 56, pad: [['cello_trem', 38, 50, 0.4], ['vibes_bowed', 57, 69, 0.35]], bass: ['bass_sus', 0.45], arp: ['harp_pluck', 0.35, 'quarter'], lead: [null, ['cello_sus', -12, 0.6]], bells: true },
  shadow: { set: AUBE, key: 0, bpm: 70, pad: [['trombone_sus', 45, 57, 0.35], ['cello_trem', 38, 50, 0.4], ['violin_trem', 62, 74, 0.25]], bass: ['tuba_sus', 0.45], lead: [['horn_sus', 0, 0.65], ['trumpet_sus', 0, 0.5]], timp: 'bar' },
};

// combats de seigneurs : le thème de l'Aube devenu marche funèbre et furieuse
const BOSS = {
  roi: { key: 0, bpm: 126, lead: [['trumpet_sus', 0, 0.5], ['horn_sus', 0, 0.6]], low: 'trombone_sus' },
  colosse: { key: -2, bpm: 112, lead: [['horn_sus', 0, 0.65], ['trombone_sus', -12, 0.55]], low: 'tuba_sus', heavy: true },
  reine: { key: 7, bpm: 120, lead: [['violin_sus', 0, 0.6], ['flute_sus', 0, 0.5]], low: 'cello_trem', bells: 'glock_hit' },
  gardien: { key: 5, bpm: 116, lead: [['horn_sus', 0, 0.6], ['flute_sus', 0, 0.5]], low: 'cello_sus', pizz: true },
  fossoyeur: { key: -3, bpm: 104, lead: [['horn_sus', 0, 0.6], ['cello_sus', -12, 0.6]], low: 'trombone_sus', bells: 'tubularbells_hit' },
};

const mtor = (d) => Math.pow(2, d / 12);
// ramène une note dans une tessiture (par octaves)
const fit = (n, lo, hi) => { while (n > hi) n -= 12; while (n < lo) n += 12; return n; };

export class Orchestra {
  constructor(A, ctx = A.ctx, out = A.music) {
    this.A = A; this.ctx = ctx; this.out = out;
    this.ready = false; this.failed = false;
    this.inst = {};
    this.buses = {};
    this.cur = null; this.curKey = null; this.want = null;
    this.step = 0; this.nextT = 0;
    this.mix = ctx.createGain(); this.mix.gain.value = 1.6;
    this.mix.connect(out);
    this.restUntil = 0;
  }

  // ------------------------------------------------------------------ échantillons
  async fetchBin(file) {
    const b64 = typeof window !== 'undefined' && window.__AETHERIA_B64;
    const res = await fetch(BASE + file + (b64 ? '.txt' : ''));
    if (!res.ok) throw new Error('orch ' + file + ' ' + res.status);
    if (!b64) return res.arrayBuffer();
    const bin = atob((await res.text()).replace(/\s+/g, ''));
    const outb = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) outb[i] = bin.charCodeAt(i);
    return outb.buffer;
  }

  async init() {
    try {
      const m = JSON.parse(new TextDecoder().decode(await this.fetchBin('manifest.json')));
      for (const [k, list] of Object.entries(m.instruments)) this.inst[k] = list.map((s) => ({ ...s, buffer: null, norm: 1 }));
      // décodage à 32 kHz (la fréquence des fichiers) : un tiers de mémoire en moins qu'à 48 kHz
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      try { this.dctx = OAC ? new OAC(1, 32000, m.sampleRate || 32000) : this.ctx; } catch { this.dctx = this.ctx; }
      await this.load(CORE);
      if (!this.inst.cello_sus?.some((s) => s.buffer)) throw new Error('décodage impossible');
      this.ready = true;
      await this.load(Object.keys(this.inst));
    } catch (e) {
      this.failed = true;
      console.warn('Orchestre indisponible, musique procédurale :', e?.message || e);
    }
  }

  async load(keys) {
    for (const k of keys) {
      const list = this.inst[k];
      if (!list || list.loaded) continue;
      list.loaded = true;
      for (const s of list) {
        try {
          const ab = await this.fetchBin(s.file);
          s.buffer = await new Promise((res, rej) => { const p = this.dctx.decodeAudioData(ab, res, rej); if (p?.then) p.then(res, rej); });
          s.norm = this.measure(s.buffer, k);
        } catch (e) { if (k === 'cello_sus') throw e; }
      }
    }
  }

  // nivellement automatique : chaque échantillon ramené à une intensité commune
  measure(buf, k) {
    const d = buf.getChannelData(0), n = Math.min(d.length, Math.floor(buf.sampleRate * 2));
    let peak = 1e-6, sum = 0;
    for (let i = 0; i < n; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; }
    const rms = Math.sqrt(sum / Math.max(1, n)) || 1e-6;
    if (HIT.test(k) || SHORT.test(k)) return Math.min(10, 0.7 / peak);
    return Math.max(0.2, Math.min(10, 0.14 / rms, 0.9 / peak));
  }

  bus(k) {
    let b = this.buses[k];
    if (b) return b;
    const [lvl, pan, rev] = DESK[k] || [0.4, 0, 0.4];
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = lvl;
    let node = g;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    node.connect(this.mix);
    if (this.A.reverb) { const s = c.createGain(); s.gain.value = rev; node.connect(s).connect(this.A.reverb); }
    return (this.buses[k] = g);
  }

  // une note : l'échantillon le plus proche, transposé ; enveloppe douce, relâchement naturel
  note(k, midi, t, dur, vel = 0.6, { attack = null, release = null } = {}) {
    const list = this.inst[k];
    if (!list) return;
    let s = null, bd = 99;
    for (const x of list) { if (!x.buffer) continue; const d = Math.abs(midi - x.midi); if (d < bd) { bd = d; s = x; } }
    if (!s) { if (!list.loaded) this.load([k]); return; }
    const A = this.A;
    if (A.voices >= A.maxVoices - 4) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = s.buffer;
    const rate = s.midi ? mtor(midi - s.midi) : 1;
    src.playbackRate.value = rate;
    if (!A.voice(src)) return;
    const hit = HIT.test(k) || SHORT.test(k);
    const at = attack ?? (hit ? 0.004 : 0.09);
    const rel = release ?? (hit ? 0.25 : 0.5);
    const len = s.buffer.duration / rate;
    const end = t + Math.max(at + 0.05, Math.min(dur, len - rel));
    const peak = vel * s.norm;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + at);
    if (!hit) g.gain.setValueAtTime(peak, end);
    g.gain.setTargetAtTime(0.0001, hit ? end : end, rel / 3);
    src.connect(g).connect(this.bus(k));
    src.start(t);
    src.stop(Math.min(t + len, end + rel * 1.5) + 0.05);
  }

  // accord voisé dans une tessiture
  voice(root, q, lo, hi) {
    const out = [];
    for (const iv of Q[q] || Q.M) {
      let n = root + iv;
      while (n < lo) n += 12;
      while (n > hi) n -= 12;
      if (n >= lo - 2) out.push(n);
    }
    return out;
  }

  // ------------------------------------------------------------------ séquenceur
  // state : { mode: 'prologue' | 'biome:temperate' | 'boss:roi' | null, night, combat, rage }
  update(now, st) {
    if (!this.ready) return;
    const key = st.mode;
    if (key !== this.wantKey) {
      this.wantKey = key;
      // entrée en combat de seigneur (ou premier thème) : on bascule tout de suite
      if (key?.startsWith('boss:') || !this.curKey) this.switchTo(key, now);
    }
    if (this.nextT < now - 1) this.nextT = now + 0.1;
    const look = this.A.lite ? 0.5 : 0.35;
    let guard = 0;
    while (this.nextT < now + look && guard++ < 32) {
      // changement de région : à la barre de mesure suivante
      if (this.step % 8 === 0 && this.wantKey !== this.curKey) this.switchTo(this.wantKey, this.nextT);
      const th = this.cur;
      const beat = th ? 60 / (th.bpm * (st.night > 0.5 && !th.boss ? 0.88 : 1) * (th.boss && st.rage ? 1.12 : 1)) : 0.5;
      if (th && this.nextT >= this.restUntil) this.play(this.nextT, beat, st);
      this.nextT += beat / 2;
      this.step++;
    }
  }

  switchTo(key, t) {
    this.curKey = key;
    this.step = 0;
    if (!key) { this.cur = null; return; }
    const [kind, id] = key.split(':');
    if (kind === 'boss') {
      const b = BOSS[id] || BOSS.roi;
      this.cur = { boss: true, set: AUBE, key: b.key, bpm: b.bpm, lead: b.lead, low: b.low, heavy: b.heavy, bells: b.bells, pizz: b.pizz };
    } else this.cur = THEMES[kind === 'biome' ? id : kind] || THEMES.temperate;
    this.phrase = 0;
    this.nextT = Math.max(this.nextT, t);
  }

  stop() { this.wantKey = null; this.curKey = null; this.cur = null; }

  play(t, beat, st) {
    const th = this.cur, s = this.step, pos = s % 8, bar = Math.floor(s / 8);
    const bi = bar % 8, phrase = Math.floor(bar / 8);
    const set = th.set, K = th.key;
    const [root0, q] = set.chords[bi];
    const root = root0 + K;
    const barLen = beat * 4;
    const night = st.night > 0.5 ? 1 : 0;
    if (th.boss) return this.playBoss(t, beat, st, root, q, bi, pos, phrase);
    if (pos === 0) {
      // nappes de cordes, basse
      for (const [k, lo, hi, v] of th.pad || []) for (const n of this.voice(root, q, lo, hi)) this.note(k, n, t, barLen + 0.15, v * (night ? 0.8 : 1), { attack: 0.35, release: 0.9 });
      if (th.bass) this.note(th.bass[0], fit(root, th.bass[0] === 'tuba_sus' ? 28 : 29, 41), t, barLen + 0.1, th.bass[1], { attack: 0.25, release: 0.8 });
      // mélodie : une phrase sur deux selon la région (la nuit, plus rare)
      const lead = th.lead ? th.lead[(phrase - (th.leadFrom || 0) + th.lead.length * 4) % th.lead.length] : null;
      if (lead && phrase >= (th.leadFrom || 0) && !(night && phrase % 2 === 1)) {
        const [k, oct, v] = lead;
        for (const [off, n, d] of set.mel[bi]) this.note(k, n + K + oct, t + off * beat, d * beat * 0.98, v * (night ? 0.8 : 1));
      }
      // timbales et cloches aux grandes articulations
      if (th.timp === 'bar' || (th.timp === 'phrase' && bi === 0) || (st.combat > 0.3 && bi % 2 === 0)) this.note('timpani_hit', fit(root, 38, 50), t, 2, 0.45 + st.combat * 0.3);
      if (th.roll && bi === 0) this.note('timpani_roll', fit(root, 38, 50), t, barLen, 0.4);
      if (th.bells && bi === 0 && phrase % 2 === 0) this.note('tubularbells_hit', fit(root, 57, 69), t, 4, 0.4);
    }
    // arpège de harpe
    if (th.arp) {
      const [k, v, rate] = th.arp;
      if (rate === 'eighth' || pos % 2 === 0) {
        const tones = this.voice(root, q, 50, 62).concat(this.voice(root, q, 62, 74)).sort((a, b) => a - b);
        const pat = [0, 1, 2, 3, 4, 3, 2, 1];
        const n = tones[pat[pos] % tones.length];
        if (n) this.note(k, n, t, beat * 1.5, v * (night ? 0.7 : 1) * (pos === 0 ? 1 : 0.8));
      }
    }
    // ostinato (pizzicati) ; en combat, les cordes s'emballent
    if (th.ost) this.note(th.ost[0], fit(root, 36, 47) + [0, 0, 7, 0, 12, 0, 7, 0][pos], t, beat * 0.5, th.ost[1] * (pos % 4 === 0 ? 1 : 0.75));
    if (st.combat > 0.3) {
      this.note('violin_spic', fit(fit(root, 55, 66) + [0, 0, 7, 0, 12, 7, 0, 7][pos], 55, 78), t, beat * 0.45, 0.35 * st.combat);
    }
  }

  playBoss(t, beat, st, root, q, bi, pos, phrase) {
    const th = this.cur, set = th.set, K = th.key, barLen = beat * 4;
    const rage = st.rage ? 1 : 0;
    if (pos === 0) {
      // basses graves et cordes en trémolo (fureur)
      this.note(th.low, fit(root, th.low === 'tuba_sus' ? 28 : 38, th.low === 'tuba_sus' ? 40 : 50), t, barLen, 0.55, { attack: 0.06, release: 0.5 });
      this.note('bass_sus', fit(root, 29, 41), t, barLen, 0.55, { attack: 0.05, release: 0.5 });
      for (const n of this.voice(root, q, 45, 57)) this.note('cello_sus', n, t, barLen, 0.4, { attack: 0.08 });
      if (rage || phrase % 2 === 1) for (const n of this.voice(root, q, 62, 76)) this.note('violin_trem', n, t, barLen, 0.38, { attack: 0.1 });
      // le thème de l'Aube aux cuivres, tordu par la Brume
      const [k, oct, v] = th.lead[phrase % th.lead.length];
      for (const [off, n, d] of set.mel[bi]) this.note(k, n + K + oct, t + off * beat, d * beat * 0.95, v + rage * 0.1);
      if (rage) for (const [off, n, d] of set.mel[bi]) this.note('trumpet_sus', n + K + (n + K < 66 ? 12 : 0), t + off * beat, d * beat * 0.95, 0.38);
      if (bi === 0) { this.note('cymbal_hit', 60, t, 4, 0.55); this.note('bassdrum_hit', 60, t, 2, 0.8); }
      if (th.bells && bi % 2 === 0) this.note(th.bells, th.bells === 'glock_hit' ? fit(root, 76, 88) : fit(root, 57, 69), t, 3, 0.4);
    }
    // ostinato de cordes frappées et timbales
    this.note('violin_spic', fit(fit(root, 55, 66) + [0, 0, 12, 0, 7, 0, 12, 7][pos], 55, 78), t, beat * 0.45, 0.42 + rage * 0.1);
    if (th.pizz) this.note('cello_pizz', fit(root, 36, 47) + (pos % 4 === 2 ? 7 : 0), t, beat * 0.5, 0.45);
    if (pos === 0 || pos === 4 || (th.heavy && pos === 6) || (rage && pos === 2)) this.note('timpani_hit', fit(root + (pos === 4 ? 7 : 0), 38, 50), t, 1.5, 0.6 + rage * 0.2);
    if (pos === 3 || pos === 7) this.note('horn_stac', fit(root, 45, 57), t, beat * 0.5, 0.42 + rage * 0.15);
    if (rage && pos % 2 === 1) this.note('bassdrum_hit', 60, t, 1, 0.45);
  }

  // ------------------------------------------------------------------ fanfares du récit
  sting(name) {
    if (!this.ready) return false;
    const t = this.ctx.currentTime + 0.06;
    const N = (k, n, dt, d, v, o) => this.note(k, n, t + dt, d, v, o);
    switch (name) {
      case 'bossIntro':
        N('gong_hit', 0, 0, 6, 0.7); N('timpani_roll', 38, 0, 2.6, 0.6); N('timpani_hit', 38, 2.6, 3, 0.8);
        for (const n of [38, 45, 50]) N('trombone_sus', n + 12, 0.3, 2.6, 0.5, { attack: 0.6 });
        N('tuba_sus', 38, 0.3, 2.6, 0.55, { attack: 0.6 }); N('cello_trem', 38, 0, 3, 0.5, { attack: 0.4 });
        this.restUntil = this.ctx.currentTime + 3.2;
        return true;
      case 'victory':
        N('timpani_roll', 38, 0, 1.4, 0.55); N('timpani_hit', 38, 1.4, 3, 0.85); N('cymbal_hit', 0, 1.4, 4, 0.7);
        for (const [k, n] of [['trumpet_sus', 74], ['horn_sus', 66], ['horn_sus', 69], ['trombone_sus', 50], ['tuba_sus', 38]]) N(k, n, 1.4, 3.2, 0.6, { attack: 0.03 });
        [62, 66, 69, 74, 78, 81].forEach((n, i) => N('harp_pluck', n, 1.6 + i * 0.07, 2, 0.6));
        for (const n of [62, 66, 69, 74]) N('violin_sus', n, 1.4, 3.4, 0.4, { attack: 0.1 });
        this.restUntil = this.ctx.currentTime + 7;
        return true;
      case 'shard':
        [50, 53, 57, 62, 65, 69, 74, 77, 81].forEach((n, i) => N('harp_pluck', n, i * 0.06, 2.5, 0.5));
        N('tubularbells_hit', 62, 0.55, 5, 0.55); N('glock_hit', 81, 0.6, 2.5, 0.4);
        for (const n of [62, 65, 69]) N('vibes_bowed', n, 0.5, 4, 0.5, { attack: 0.5 });
        for (const n of [69, 74, 77]) N('violin_sus', n, 0.6, 4, 0.35, { attack: 1.2 });
        this.restUntil = Math.max(this.restUntil, this.ctx.currentTime + 4.5);
        return true;
      case 'act':
        N('timpani_hit', 38, 0, 3, 0.9); N('cymbal_hit', 0, 0, 4, 0.45);
        [[62, 0, 1], [69, 0.55, 0.55], [67, 1.1, 1.6]].forEach(([n, dt, d]) => { N('horn_sus', n, dt, d, 0.85, { attack: 0.03 }); N('trombone_sus', n - 12, dt, d, 0.6, { attack: 0.03 }); });
        N('cello_sus', 50, 0, 3, 0.45, { attack: 0.2 }); N('bass_sus', 38, 0, 3, 0.45, { attack: 0.2 });
        this.restUntil = Math.max(this.restUntil, this.ctx.currentTime + 3);
        return true;
      case 'seal':
        for (const n of [57, 64, 69]) N('vibes_bowed', n, 0, 3.5, 0.5, { attack: 0.4 });
        [57, 60, 64, 69, 72, 76].forEach((n, i) => N('harp_pluck', n, 0.2 + i * 0.08, 2.4, 0.45));
        N('violin_trem', 76, 0.3, 3, 0.25, { attack: 0.8 });
        return true;
      case 'death':
        N('gong_hit', 0, 0, 5, 0.45);
        for (const n of [38, 45, 50, 53]) N('cello_sus', n + 12, 0, 3.5, 0.45, { attack: 0.15 });
        N('bass_sus', 38, 0, 3.5, 0.5, { attack: 0.15 });
        this.restUntil = this.ctx.currentTime + 5;
        return true;
      default: return false;
    }
  }
}
