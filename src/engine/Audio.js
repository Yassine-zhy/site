// Moteur audio procédural (Web Audio) : bruitages synthétisés, musique générative, ambiance.
// Aucun fichier audio : tout est calculé en temps réel.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.vol = 0.8; this.musicVol = 0.6;
    this.lastPlay = new Map();
    this.game = null;
    this.combat = 0;
    this.boss = 0;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
    } catch { this.enabled = false; return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.vol;
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.master.connect(this.comp).connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(this.master);
    this.amb = c.createGain(); this.amb.gain.value = 0.5; this.amb.connect(this.master);
    // réverbération (réponse impulsionnelle générée)
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.makeIR(3.2, 2.6);
    this.revGain = c.createGain(); this.revGain.gain.value = 0.55;
    this.reverb.connect(this.revGain).connect(this.master);
    this.noiseBuf = this.makeNoise(2);
    this.startAmbience();
    this.startMusic();
  }

  setVolume(v, m) {
    this.vol = v; this.musicVol = m;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
    if (this.music) this.music.gain.setTargetAtTime(m * 0.5, this.ctx.currentTime, 0.3);
  }

  makeNoise(sec) {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.7 + last * 3; }
    return b;
  }

  makeIR(sec, decay) {
    const c = this.ctx, len = c.sampleRate * sec, b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }

  // ------------------------------------------------------------------ briques de synthèse
  env(g, t, a, peak, d, end = 0.0001) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(end, t + a + d);
  }

  out(vol, pan, rev = 0.2) {
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = vol;
    const p = c.createStereoPanner(); p.pan.value = pan;
    g.connect(p).connect(this.sfx);
    if (rev > 0) { const r = c.createGain(); r.gain.value = rev; p.connect(r).connect(this.reverb); }
    return g;
  }

  tone(dest, t, { type = 'sine', f = 440, f2 = null, a = 0.005, d = 0.3, v = 0.3, detune = 0 }) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + a + d);
    const g = c.createGain();
    this.env(g, t, a, v, d);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + a + d + 0.05);
  }

  noise(dest, t, { a = 0.005, d = 0.2, v = 0.3, type = 'bandpass', f = 1200, f2 = null, q = 1 }) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + a + d);
    const g = c.createGain();
    this.env(g, t, a, v, d);
    s.connect(fl).connect(g).connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + a + d + 0.05);
  }

  // position -> volume & panoramique
  spatial(pos) {
    const g = this.game;
    if (!pos || !g?.camera) return { v: 1, pan: 0 };
    const cam = g.camera;
    const ref = g.player ? g.player.position : cam.position;
    const dx = pos.x - ref.x, dz = pos.z - ref.z, dy = (pos.y ?? ref.y) - ref.y;
    const d = Math.hypot(dx, dy, dz);
    const v = 1 / (1 + Math.max(0, d - 4) * 0.09);
    const yaw = g.rig ? g.rig.yaw : 0;
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const pan = d > 0.5 ? Math.max(-0.85, Math.min(0.85, (dx * rx + dz * rz) / d)) : 0;
    return { v: d > 70 ? 0 : v, pan };
  }

  play(name, pos, vol = 1) {
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const last = this.lastPlay.get(name) || 0;
    if (now - last < 0.03) return;
    this.lastPlay.set(name, now);
    const sp = this.spatial(pos);
    if (sp.v <= 0.01) return;
    const fn = SOUNDS[name];
    if (fn) fn(this, now, this.out(vol * sp.v, sp.pan, REVERBY.has(name) ? 0.5 : 0.15));
  }

  // ------------------------------------------------------------------ ambiance
  startAmbience() {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 0.7;
    const g = c.createGain(); g.gain.value = 0.12;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lg = c.createGain(); lg.gain.value = 260;
    lfo.connect(lg).connect(f.frequency);
    s.connect(f).connect(g).connect(this.amb);
    s.start(); lfo.start();
    this.windGain = g; this.windFilter = f;
    this.ambT = 0;
    // ressac : bruit grave qui enfle et retombe comme une houle
    const w = c.createBufferSource(); w.buffer = this.noiseBuf; w.loop = true; w.playbackRate.value = 0.6;
    const wf = c.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 420; wf.Q.value = 0.4;
    const swell = c.createGain(); swell.gain.value = 0.5;
    const wl = c.createOscillator(); wl.frequency.value = 0.11;
    const wlg = c.createGain(); wlg.gain.value = 0.45;
    wl.connect(wlg).connect(swell.gain);
    const wg = c.createGain(); wg.gain.value = 0;
    w.connect(wf).connect(swell).connect(wg).connect(this.amb);
    w.start(); wl.start();
    this.wavesGain = wg;
    // lieu courant : biome de la région, salle intérieure, proximité de la mer
    this.place = { biome: 'temperate', room: null, coast: 0 };
    this.placeT = 0;
  }

  // où se trouve le héros (évalué deux fois par seconde)
  sensePlace() {
    const g = this.game, p = g?.player?.position, t = g?.world?.terrain;
    if (!p || !t || !g.inGame) return;
    const room = g.rooms?.current?.() || null;
    let biome = 'temperate', coast = 0;
    if (room) biome = 'indoor';
    else if (p.x > 3000) biome = 'citadel';
    else {
      biome = t.regionAt(p.x, p.z)?.biome || 'temperate';
      // part de mer autour du héros (deux cercles)
      let wet = 0;
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2;
        for (const r of [28, 70]) if (t.continentHeight(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r) < 0) wet += r < 50 ? 1.5 : 1;
      }
      coast = Math.min(1, wet / 8) * (p.y < 40 ? 1 : Math.max(0, 1 - (p.y - 40) / 40));
      if (g.player.inWater) coast = 1;
    }
    this.place = { biome, room, coast };
  }

  // ------------------------------------------------------------------ musique générative
  startMusic() {
    this.beat = 0;
    this.nextT = this.ctx.currentTime + 0.5;
    this.chordIdx = 0;
    this.mDelay = this.ctx.createDelay(1); this.mDelay.delayTime.value = 0.42;
    const fb = this.ctx.createGain(); fb.gain.value = 0.38;
    const dl = this.ctx.createGain(); dl.gain.value = 0.3;
    this.mDelay.connect(fb).connect(this.mDelay);
    this.mDelay.connect(dl).connect(this.music);
    this.melodyOut = this.ctx.createGain(); this.melodyOut.gain.value = 0.5;
    this.melodyOut.connect(this.music); this.melodyOut.connect(this.mDelay);
    const r = this.ctx.createGain(); r.gain.value = 0.6; this.melodyOut.connect(r).connect(this.reverb);
    this.padOut = this.ctx.createGain(); this.padOut.gain.value = 0.35; this.padOut.connect(this.music);
    const r2 = this.ctx.createGain(); r2.gain.value = 0.5; this.padOut.connect(r2).connect(this.reverb);
    this.drumOut = this.ctx.createGain(); this.drumOut.gain.value = 0; this.drumOut.connect(this.music);
  }

  update(dt) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const g = this.game;
    const c = this.ctx, now = c.currentTime;
    const night = g?.world?.sky.state.night ?? 0;
    const inCombat = g?.inGame && g.elapsed - g.lastCombat < 5 ? 1 : 0;
    this.combat += (inCombat - this.combat) * Math.min(1, dt * (inCombat ? 2 : 0.4));
    const bossOn = g?.bossEngaged ? 1 : 0;
    this.boss += (bossOn - this.boss) * Math.min(1, dt * 0.8);
    this.drumOut.gain.setTargetAtTime(Math.max(this.combat * 0.55, this.boss * 0.8), now, 0.3);
    this.placeT -= dt;
    if (this.placeT <= 0) { this.placeT = 0.5; this.sensePlace(); }
    const pl = this.place, th = THEMES[pl.room ? 'room_' + pl.room : pl.biome] || THEMES[pl.biome] || THEMES.temperate;
    this.theme = th;
    // vent selon l'altitude et la région ; ressac près des côtes
    const alt = g?.player ? Math.max(0, g.player.position.y - 20) : 40;
    const gl = g?.player?.gliding ? 1 : 0;
    this.windGain.gain.setTargetAtTime((0.06 + Math.min(0.2, alt / 400) + gl * 0.12) * th.wind, now, 0.8);
    this.wavesGain.gain.setTargetAtTime(pl.room ? 0 : pl.coast * 0.32, now, 1.2);
    // vie sonore de la région : oiseaux, insectes, corbeaux, grenouilles, feu de cheminée…
    this.ambT -= dt;
    if (this.ambT <= 0 && g?.inGame) {
      const [lo, hi] = th.ambEvery || [0.6, 3];
      this.ambT = lo + Math.random() * (hi - lo);
      const out = this.out(0.5, Math.random() * 1.6 - 0.8, pl.room ? 0.15 : 0.3);
      const list = (night > 0.5 ? th.ambNight : th.ambDay) || [];
      const fn = list.length ? AMB[list[Math.floor(Math.random() * list.length)]] : null;
      if (fn) fn(this, now, out);
      if (pl.coast > 0.4 && !pl.room && night < 0.6 && Math.random() < 0.12 * pl.coast) AMB.gull(this, now + 0.3, this.out(0.4, Math.random() * 1.6 - 0.8, 0.3));
    }
    // ordonnanceur musical
    const tempo = this.boss > 0.5 ? 0.3 : th.tempo * (night > 0.5 ? 1.2 : 1);
    while (this.nextT < now + 0.25) {
      this.scheduleBeat(this.nextT, night);
      this.nextT += tempo;
      this.beat++;
    }
  }

  scheduleBeat(t, night) {
    const th = this.theme || THEMES.temperate;
    const boss = this.boss > 0.5;
    const prog = boss ? BOSS_PROG : night > 0.5 && th.night ? th.night : th.day;
    const bar = 8;
    const step = this.beat % bar;
    if (step === 0 || this.prog !== prog) {
      // nouvel accord (la région peut avoir changé : la musique suit à la mesure suivante)
      if (this.prog !== prog) { this.prog = prog; this.chordIdx = -1; if (step !== 0) return; }
      this.chordIdx = (this.chordIdx + 1) % prog.length;
      const ch = prog[this.chordIdx];
      const len = (boss ? 0.3 : th.tempo * (night > 0.5 ? 1.2 : 1)) * bar;
      const padNight = night > 0.5 || th.dark ? 1 : 0;
      for (const n of ch.slice(0, 4)) padVoice(this, t, midi(n), len * 1.05, padNight, th.pad);
      // basse (ou bourdon)
      this.tone(this.padOut, t, { type: 'triangle', f: midi(ch[0] - 12), a: 0.4, d: len * 0.9, v: th.drone ? 0.24 : 0.18 });
    }
    // mélodie clairsemée, timbre propre à la région
    const ch = prog[Math.max(0, this.chordIdx)];
    const dens = boss ? 0.3 : th.density * (night > 0.5 ? 0.7 : 1);
    if (Math.random() < dens && (step % 2 === 0 || th.busy)) {
      const scale = [ch[1], ch[2], ch[3], ch[4], ch[1] + 12, ch[2] + 12];
      const n = scale[Math.floor(Math.random() * scale.length)] + 12 + (th.octave || 0);
      (LEADS[boss ? 'pluck' : th.lead] || LEADS.pluck)(this, t, midi(n), night);
    }
    // percussions de combat
    if (this.combat > 0.05 || this.boss > 0.05) {
      if (step % 4 === 0) kick(this, t);
      if (step % 4 === 2) this.noise(this.drumOut, t, { d: 0.12, v: 0.25, type: 'highpass', f: 2500 });
      if (step === 7 || (this.boss > 0.5 && step === 3)) tom(this, t, 110);
      if (this.boss > 0.5 && step % 2 === 1) tom(this, t, 70);
    }
  }
}

function padVoice(A, t, f, len, night, type = null) {
  const c = A.ctx;
  for (const det of [-7, 6]) {
    const o = c.createOscillator(); o.type = type || (night > 0.5 ? 'triangle' : 'sawtooth'); o.frequency.value = f; o.detune.value = det;
    const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(night > 0.5 ? 700 : 1100, t); fl.Q.value = 0.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + len * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    o.connect(fl).connect(g).connect(A.padOut);
    o.start(t); o.stop(t + len + 0.1);
  }
}

function pluck(A, t, f, night) {
  A.tone(A.melodyOut, t, { type: 'sine', f, a: 0.004, d: night > 0.5 ? 1.8 : 1.2, v: 0.16 });
  A.tone(A.melodyOut, t, { type: 'triangle', f: f * 2, a: 0.002, d: 0.4, v: 0.05 });
}

// voix mélodiques des régions
function plucked(A, t, f, { cutoff = 1800, d = 0.7, v = 0.1 } = {}) {
  const c = A.ctx;
  const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
  const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 2;
  fl.frequency.setValueAtTime(cutoff, t); fl.frequency.exponentialRampToValueAtTime(Math.max(120, f * 1.2), t + d * 0.6);
  const g = c.createGain(); A.env(g, t, 0.003, v, d);
  o.connect(fl).connect(g).connect(A.melodyOut);
  o.start(t); o.stop(t + d + 0.05);
}
const LEADS = {
  pluck,
  // cloche de cristal : partiels inharmoniques, longue résonance
  bell: (A, t, f) => { A.tone(A.melodyOut, t, { type: 'sine', f, a: 0.003, d: 2.6, v: 0.1 }); A.tone(A.melodyOut, t, { type: 'sine', f: f * 2.76, a: 0.002, d: 0.9, v: 0.035 }); A.tone(A.melodyOut, t, { type: 'sine', f: f * 5.4, a: 0.001, d: 0.3, v: 0.015 }); },
  // marimba de bois : attaque sèche, résonance courte
  marimba: (A, t, f) => { A.tone(A.melodyOut, t, { type: 'sine', f, a: 0.002, d: 0.45, v: 0.16 }); A.tone(A.melodyOut, t, { type: 'sine', f: f * 4, a: 0.001, d: 0.06, v: 0.05 }); },
  // luth / oud : corde pincée filtrée
  lute: (A, t, f) => plucked(A, t, f, { cutoff: 2400, d: 0.8, v: 0.09 }),
  // flûte : attaque douce, souffle
  flute: (A, t, f) => { A.tone(A.melodyOut, t, { type: 'sine', f, a: 0.09, d: 0.9, v: 0.11, detune: 4 }); A.tone(A.melodyOut, t, { type: 'triangle', f: f * 2, a: 0.1, d: 0.6, v: 0.02 }); A.noise(A.melodyOut, t, { a: 0.05, d: 0.25, v: 0.025, f: f * 2, q: 6 }); },
  // glas lointain : grave et sombre
  knell: (A, t, f) => { A.tone(A.melodyOut, t, { type: 'sine', f: f / 2, a: 0.004, d: 3.2, v: 0.09 }); A.tone(A.melodyOut, t, { type: 'sine', f: f * 1.19, a: 0.003, d: 1.6, v: 0.03 }); },
  // chœur : voyelle tenue (chapelle)
  choir: (A, t, f) => { for (const det of [-6, 5]) A.tone(A.melodyOut, t, { type: 'triangle', f, a: 0.35, d: 1.8, v: 0.05, detune: det }); },
};

// sons d'ambiance des régions
const AMB = {
  bird: (A, t, o) => birdChirp(A, t, o),
  crickets: (A, t, o) => crickets(A, t, o),
  // oiseaux tropicaux : trilles qui montent et descendent
  tropic: (A, t, o) => { const b = 1400 + Math.random() * 1200; for (let i = 0; i < 5; i++) A.tone(o, t + i * 0.11, { type: 'sine', f: b * (i % 2 ? 1.5 : 1), f2: b * (i % 2 ? 1 : 1.6), a: 0.01, d: 0.09, v: 0.05 }); },
  frog: (A, t, o) => { const f = 140 + Math.random() * 90; for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) A.tone(o, t + i * 0.22, { type: 'square', f, f2: f * 0.7, a: 0.01, d: 0.09, v: 0.03 }); },
  insects: (A, t, o) => { for (let i = 0; i < 14; i++) A.tone(o, t + i * 0.03, { type: 'sawtooth', f: 5200 + Math.random() * 600, a: 0.002, d: 0.018, v: 0.008 }); },
  cicada: (A, t, o) => A.noise(o, t, { a: 0.4, d: 1.6, v: 0.05, f: 5600, q: 12 }),
  hawk: (A, t, o) => { A.tone(o, t, { type: 'sine', f: 2300, f2: 1500, a: 0.04, d: 0.55, v: 0.05 }); A.tone(o, t + 0.7, { type: 'sine', f: 2100, f2: 1400, a: 0.04, d: 0.5, v: 0.035 }); },
  gust: (A, t, o) => A.noise(o, t, { a: 0.9, d: 1.8, v: 0.18, f: 300, f2: 900, q: 1.5 }),
  chime: (A, t, o) => { for (let i = 0; i < 3; i++) A.tone(o, t + i * (0.15 + Math.random() * 0.2), { type: 'sine', f: midi(84 + [0, 3, 7, 10, 12][Math.floor(Math.random() * 5)]), a: 0.002, d: 1.4, v: 0.025 }); },
  crow: (A, t, o) => { for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) { A.tone(o, t + i * 0.42, { type: 'sawtooth', f: 620, f2: 430, a: 0.01, d: 0.22, v: 0.035 }); A.noise(o, t + i * 0.42, { d: 0.2, v: 0.05, f: 1400, q: 3 }); } },
  bell: (A, t, o) => { A.tone(o, t, { type: 'sine', f: 196, a: 0.004, d: 4, v: 0.06 }); A.tone(o, t, { type: 'sine', f: 196 * 2.4, a: 0.003, d: 2.2, v: 0.025 }); },
  owl: (A, t, o) => { A.tone(o, t, { type: 'sine', f: 430, f2: 390, a: 0.05, d: 0.35, v: 0.06 }); A.tone(o, t + 0.55, { type: 'sine', f: 420, f2: 370, a: 0.05, d: 0.6, v: 0.05 }); },
  whisper: (A, t, o) => A.noise(o, t, { a: 0.6, d: 1.4, v: 0.05, type: 'highpass', f: 2600, f2: 4200, q: 0.8 }),
  bubble: (A, t, o) => { for (let i = 0; i < 3; i++) A.tone(o, t + i * 0.12 + Math.random() * 0.1, { type: 'sine', f: 280, f2: 900, a: 0.003, d: 0.05, v: 0.04 }); },
  gull: (A, t, o) => { for (let i = 0; i < 2; i++) A.tone(o, t + i * 0.32, { type: 'triangle', f: 1500, f2: 980, a: 0.02, d: 0.25, v: 0.04 }); },
  eagle: (A, t, o) => A.tone(o, t, { type: 'sine', f: 2700, f2: 1700, a: 0.03, d: 0.8, v: 0.045 }),
  // intérieurs : feu qui crépite, chopes, enclume
  fire: (A, t, o) => { for (let i = 0; i < 6; i++) A.noise(o, t + Math.random() * 1.2, { a: 0.001, d: 0.02 + Math.random() * 0.03, v: 0.12, type: 'highpass', f: 2500 + Math.random() * 2500 }); A.noise(o, t, { a: 0.3, d: 1.2, v: 0.04, type: 'lowpass', f: 300 }); },
  clink: (A, t, o) => { A.tone(o, t, { type: 'sine', f: 2600, a: 0.001, d: 0.25, v: 0.03 }); A.tone(o, t + 0.04, { type: 'sine', f: 3900, a: 0.001, d: 0.18, v: 0.02 }); },
  murmur: (A, t, o) => { for (let i = 0; i < 3; i++) A.noise(o, t + i * 0.3, { a: 0.1, d: 0.35, v: 0.04, f: 500 + Math.random() * 500, q: 4 }); },
  anvil: (A, t, o) => { for (let i = 0; i < 3; i++) { const k = t + i * 0.5; [1, 2.76, 5.4].forEach((m) => A.tone(o, k, { type: 'sine', f: 520 * m, a: 0.001, d: 0.7 / m, v: 0.06 / m })); A.noise(o, k, { d: 0.05, v: 0.1, f: 3000 }); } },
  page: (A, t, o) => A.noise(o, t, { a: 0.03, d: 0.18, v: 0.03, type: 'highpass', f: 3500 }),
  hum: (A, t, o) => A.tone(o, t, { type: 'sine', f: 110, a: 0.8, d: 2, v: 0.04 }),
};

// Musique et ambiance de chaque région : progression d'accords (jour/nuit), tempo, voix, densité
const BOSS_PROG = [[38, 45, 50, 53, 57], [36, 43, 48, 51, 55], [34, 41, 46, 50, 53], [33, 40, 45, 49, 52]];
const THEMES = {
  // Prés, Bois, Cendres, Pic : thème pastoral d'origine
  temperate: { day: [[50, 57, 61, 64, 66], [47, 54, 59, 62, 66], [43, 50, 54, 59, 62], [45, 52, 57, 61, 64]], night: [[47, 54, 57, 62, 66], [43, 50, 55, 59, 62], [40, 47, 52, 55, 59], [42, 49, 54, 57, 61]],
    tempo: 0.5, lead: 'pluck', density: 0.32, wind: 1, ambDay: ['bird', 'bird', 'bird'], ambNight: ['crickets', 'crickets', 'owl'] },
  // Cimes de Givre : cloches de cristal, vent fort
  snow: { day: [[52, 59, 64, 67, 71], [48, 55, 60, 64, 67], [50, 57, 62, 66, 69], [47, 54, 59, 62, 66]], night: [[47, 54, 59, 62, 66], [43, 50, 55, 59, 62], [45, 52, 57, 60, 64], [42, 49, 54, 57, 61]],
    tempo: 0.7, lead: 'bell', pad: 'sine', density: 0.22, octave: 12, wind: 1.9, ambDay: ['gust', 'chime'], ambNight: ['gust', 'chime', 'owl'], ambEvery: [2, 5] },
  // Terres d'Ambre : mode phrygien, luth, bourdon, cigales
  amber: { day: [[50, 57, 62, 65, 69], [51, 58, 63, 67, 70], [48, 55, 60, 63, 67], [50, 57, 62, 65, 69]], night: [[45, 52, 57, 60, 64], [46, 53, 58, 62, 65], [43, 50, 55, 58, 62], [45, 52, 57, 60, 64]],
    tempo: 0.42, lead: 'lute', density: 0.42, drone: true, wind: 1.3, ambDay: ['cicada', 'hawk', 'cicada'], ambNight: ['crickets', 'gust'], ambEvery: [1.5, 4] },
  // Canopée d'Émeraude : marimba, oiseaux tropicaux, grenouilles la nuit
  jungle: { day: [[48, 55, 60, 64, 67], [50, 57, 62, 66, 69], [45, 52, 57, 60, 64], [47, 54, 59, 62, 66]], night: [[45, 52, 57, 60, 64], [43, 50, 55, 59, 62], [41, 48, 53, 57, 60], [43, 50, 55, 59, 62]],
    tempo: 0.38, lead: 'marimba', density: 0.45, busy: true, wind: 0.6, ambDay: ['tropic', 'tropic', 'insects', 'bird'], ambNight: ['frog', 'frog', 'insects', 'owl'], ambEvery: [0.5, 2] },
  // Landes Spectrales : mineur et triton, glas, corbeaux, murmures
  haunted: { day: [[45, 52, 57, 60, 64], [46, 53, 58, 61, 65], [41, 48, 53, 56, 60], [44, 51, 56, 59, 63]], night: [[42, 49, 54, 57, 61], [43, 50, 55, 58, 62], [38, 45, 50, 53, 57], [41, 48, 53, 56, 60]],
    tempo: 0.75, lead: 'knell', pad: 'triangle', dark: true, density: 0.16, wind: 1.2, ambDay: ['crow', 'crow', 'bell', 'whisper'], ambNight: ['owl', 'whisper', 'bell', 'crow'], ambEvery: [2.5, 6] },
  // Marais des Saules : flûte, grenouilles, bulles
  swamp: { day: [[43, 50, 55, 58, 62], [41, 48, 53, 57, 60], [39, 46, 51, 55, 58], [38, 45, 50, 53, 57]], night: [[40, 47, 52, 55, 59], [38, 45, 50, 54, 57], [36, 43, 48, 52, 55], [35, 42, 47, 50, 54]],
    tempo: 0.66, lead: 'flute', pad: 'triangle', density: 0.2, wind: 0.7, ambDay: ['frog', 'bubble', 'insects'], ambNight: ['frog', 'frog', 'bubble', 'owl'], ambEvery: [0.8, 2.5] },
  // Côte des Récifs : majeur lumineux, marimba, mouettes
  beach: { day: [[52, 59, 64, 68, 71], [49, 56, 61, 64, 68], [45, 52, 57, 61, 64], [47, 54, 59, 63, 66]], night: [[49, 56, 61, 64, 68], [45, 52, 57, 61, 64], [42, 49, 54, 57, 61], [44, 51, 56, 59, 63]],
    tempo: 0.46, lead: 'marimba', density: 0.35, wind: 1.1, ambDay: ['gull', 'gull', 'bird'], ambNight: ['crickets'], ambEvery: [1.5, 4] },
  // Hauts-Plateaux et Falaises : flûte des hauteurs, aigles, rafales
  highland: { day: [[50, 57, 62, 64, 69], [48, 55, 60, 62, 67], [46, 53, 58, 60, 65], [45, 52, 57, 60, 64]], night: [[47, 54, 59, 61, 66], [45, 52, 57, 59, 64], [43, 50, 55, 57, 62], [42, 49, 54, 57, 61]],
    tempo: 0.56, lead: 'flute', density: 0.28, wind: 1.6, ambDay: ['eagle', 'gust', 'bird'], ambNight: ['gust', 'owl'], ambEvery: [2, 5] },
  cliffs: null,
  // Citadelle des Ombres (expéditions)
  citadel: { day: [[41, 48, 53, 56, 60], [42, 49, 54, 57, 61], [38, 45, 50, 53, 57], [40, 47, 52, 55, 59]], night: null,
    tempo: 0.6, lead: 'knell', pad: 'triangle', dark: true, density: 0.2, wind: 1.4, ambDay: ['gust', 'whisper', 'bell'], ambNight: ['gust', 'whisper', 'bell'], ambEvery: [3, 6] },
  // intérieurs : musique plus intime, sons de la salle
  indoor: { day: [[48, 55, 60, 64, 67], [53, 60, 65, 69, 72], [55, 62, 67, 71, 74], [48, 55, 60, 64, 67]], night: null,
    tempo: 0.42, lead: 'lute', density: 0.4, wind: 0.12, ambDay: ['fire'], ambNight: ['fire'], ambEvery: [1.2, 2.5] },
  room_tavern: { day: [[48, 55, 60, 64, 67], [53, 60, 65, 69, 72], [55, 62, 67, 71, 74], [48, 55, 60, 64, 67]], night: null,
    tempo: 0.34, lead: 'lute', density: 0.6, busy: true, wind: 0.1, ambDay: ['fire', 'clink', 'murmur', 'murmur'], ambNight: ['fire', 'clink', 'murmur', 'murmur'], ambEvery: [0.8, 2] },
  room_forge: { day: [[45, 52, 57, 60, 64], [43, 50, 55, 59, 62], [41, 48, 53, 57, 60], [43, 50, 55, 59, 62]], night: null,
    tempo: 0.5, lead: 'pluck', density: 0.2, drone: true, wind: 0.1, ambDay: ['fire', 'anvil', 'fire'], ambNight: ['fire', 'anvil', 'fire'], ambEvery: [1.5, 3.5] },
  room_chapel: { day: [[50, 57, 62, 66, 69], [55, 62, 67, 71, 74], [52, 59, 64, 67, 71], [57, 64, 69, 73, 76]], night: null,
    tempo: 0.85, lead: 'choir', pad: 'sine', density: 0.3, wind: 0.08, ambDay: ['hum'], ambNight: ['hum'], ambEvery: [4, 8] },
  room_tower: { day: [[50, 57, 62, 65, 69], [48, 55, 60, 63, 67], [46, 53, 58, 62, 65], [45, 52, 57, 61, 64]], night: null,
    tempo: 0.7, lead: 'bell', pad: 'sine', density: 0.3, octave: 12, wind: 0.1, ambDay: ['chime', 'page', 'hum'], ambNight: ['chime', 'page', 'hum'], ambEvery: [2, 5] },
  room_guild: { day: [[50, 57, 62, 66, 69], [47, 54, 59, 62, 66], [43, 50, 55, 59, 62], [45, 52, 57, 61, 64]], night: null,
    tempo: 0.46, lead: 'lute', density: 0.35, wind: 0.1, ambDay: ['fire', 'page', 'murmur'], ambNight: ['fire', 'page', 'murmur'], ambEvery: [1.2, 3] },
};
THEMES.cliffs = THEMES.highland;

function kick(A, t) { A.tone(A.drumOut, t, { type: 'sine', f: 140, f2: 42, a: 0.002, d: 0.32, v: 0.9 }); }
function tom(A, t, f) { A.tone(A.drumOut, t, { type: 'sine', f: f * 1.6, f2: f, a: 0.003, d: 0.35, v: 0.5 }); A.noise(A.drumOut, t, { d: 0.08, v: 0.15, f: 900 }); }

function birdChirp(A, t, out) {
  const base = 2200 + Math.random() * 1800;
  const n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) A.tone(out, t + i * 0.09, { type: 'sine', f: base * (1 + Math.random() * 0.2), f2: base * (1.3 + Math.random() * 0.4), a: 0.005, d: 0.06, v: 0.05 });
}
function crickets(A, t, out) {
  for (let i = 0; i < 6; i++) A.tone(out, t + i * 0.045, { type: 'square', f: 4300, a: 0.002, d: 0.02, v: 0.012 });
}

const REVERBY = new Set(['discover', 'cast', 'holy', 'levelup', 'beacon', 'rune', 'runeok', 'summon', 'blink', 'storm', 'respawn', 'death', 'epic', 'quest', 'oracle', 'frost', 'rally', 'heal']);

// Bibliothèque de bruitages.
const SOUNDS = {
  swoosh: (A, t, o) => A.noise(o, t, { a: 0.02, d: 0.18, v: 0.35, f: 600, f2: 3000, q: 1.2 }),
  hit: (A, t, o) => { A.tone(o, t, { type: 'sine', f: 160, f2: 60, d: 0.14, v: 0.5 }); A.noise(o, t, { d: 0.08, v: 0.4, f: 1800, q: 0.8 }); },
  crit: (A, t, o) => { SOUNDS.hit(A, t, o); A.tone(o, t, { type: 'triangle', f: 1600, f2: 2400, d: 0.18, v: 0.18 }); A.noise(o, t + 0.02, { d: 0.2, v: 0.2, type: 'highpass', f: 4000 }); },
  step: (A, t, o) => A.noise(o, t, { d: 0.06, v: 0.08, type: 'lowpass', f: 700 }),
  splash: (A, t, o) => A.noise(o, t, { d: 0.18, v: 0.15, f: 1400, f2: 500 }),
  jump: (A, t, o) => A.noise(o, t, { a: 0.01, d: 0.15, v: 0.15, f: 500, f2: 1400 }),
  land: (A, t, o) => { A.tone(o, t, { f: 90, f2: 40, d: 0.15, v: 0.35 }); A.noise(o, t, { d: 0.12, v: 0.15, type: 'lowpass', f: 600 }); },
  dodge: (A, t, o) => A.noise(o, t, { a: 0.01, d: 0.22, v: 0.28, f: 900, f2: 300, q: 0.7 }),
  glide: (A, t, o) => { for (let i = 0; i < 4; i++) A.noise(o, t + i * 0.04, { d: 0.05, v: 0.2, f: 1500 + i * 200 }); },
  glideclose: (A, t, o) => A.noise(o, t, { d: 0.12, v: 0.15, f: 900 }),
  bones: (A, t, o) => { for (let i = 0; i < 9; i++) A.tone(o, t + i * 0.035 + Math.random() * 0.02, { type: 'square', f: 900 + Math.random() * 1400, d: 0.03, v: 0.06 }); A.tone(o, t, { f: 120, f2: 50, d: 0.3, v: 0.3 }); },
  rise: (A, t, o) => { A.noise(o, t, { a: 0.3, d: 0.8, v: 0.3, type: 'lowpass', f: 200, f2: 500 }); for (let i = 0; i < 6; i++) A.tone(o, t + 0.3 + i * 0.07, { type: 'square', f: 600 + Math.random() * 900, d: 0.03, v: 0.04 }); },
  aggro: (A, t, o) => A.tone(o, t, { type: 'sawtooth', f: 110, f2: 70, a: 0.02, d: 0.25, v: 0.12 }),
  cast: (A, t, o) => { A.tone(o, t, { type: 'sine', f: 880, f2: 1320, d: 0.25, v: 0.12 }); A.tone(o, t + 0.03, { type: 'sine', f: 1320, f2: 1760, d: 0.25, v: 0.08 }); A.noise(o, t, { d: 0.25, v: 0.08, type: 'highpass', f: 5000 }); },
  bow: (A, t, o) => { A.tone(o, t, { type: 'sawtooth', f: 220, f2: 180, d: 0.12, v: 0.12 }); A.noise(o, t, { d: 0.1, v: 0.2, f: 3000, f2: 1200 }); },
  boom: (A, t, o) => { A.tone(o, t, { f: 90, f2: 30, d: 0.8, v: 0.8 }); A.noise(o, t, { d: 0.9, v: 0.6, type: 'lowpass', f: 1500, f2: 100 }); },
  zap: (A, t, o) => { A.noise(o, t, { d: 0.18, v: 0.35, f: 3000, q: 4 }); A.tone(o, t, { type: 'square', f: 1200, f2: 300, d: 0.12, v: 0.06 }); },
  frost: (A, t, o) => { for (let i = 0; i < 6; i++) A.tone(o, t + i * 0.03, { f: 2000 + Math.random() * 3000, d: 0.4, v: 0.05 }); A.noise(o, t, { d: 0.5, v: 0.2, type: 'highpass', f: 3000 }); },
  heal: (A, t, o) => [0, 4, 7, 12].forEach((s, i) => A.tone(o, t + i * 0.06, { type: 'sine', f: midi(72 + s), d: 0.6, v: 0.1 })),
  potion: (A, t, o) => { for (let i = 0; i < 5; i++) A.tone(o, t + i * 0.07, { type: 'sine', f: 500 + i * 80, f2: 700 + i * 80, d: 0.06, v: 0.08 }); },
  coin: (A, t, o) => { A.tone(o, t, { type: 'square', f: 1975, d: 0.08, v: 0.05 }); A.tone(o, t + 0.07, { type: 'square', f: 2637, d: 0.25, v: 0.05 }); },
  pickup: (A, t, o) => A.tone(o, t, { type: 'triangle', f: 660, f2: 990, d: 0.15, v: 0.15 }),
  epic: (A, t, o) => [0, 7, 12, 16, 19].forEach((s, i) => A.tone(o, t + i * 0.05, { type: 'triangle', f: midi(67 + s), d: 1.2, v: 0.09 })),
  levelup: (A, t, o) => { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => A.tone(o, t + i * 0.07, { type: 'triangle', f: midi(62 + s), d: 1.0, v: 0.12 })); [50, 57, 62, 66].forEach((n) => A.tone(o, t + 0.5, { type: 'sawtooth', f: midi(n), a: 0.1, d: 1.6, v: 0.04 })); },
  death: (A, t, o) => { A.tone(o, t, { type: 'sawtooth', f: 220, f2: 55, a: 0.05, d: 1.8, v: 0.15 }); A.tone(o, t, { type: 'sine', f: 110, f2: 40, d: 2, v: 0.3 }); },
  respawn: (A, t, o) => { [0, 7, 12, 19].forEach((s, i) => A.tone(o, t + i * 0.12, { type: 'sine', f: midi(62 + s), d: 1.4, v: 0.1 })); A.noise(o, t, { a: 0.5, d: 1, v: 0.1, type: 'highpass', f: 2000, f2: 6000 }); },
  hurt: (A, t, o) => { A.tone(o, t, { type: 'sine', f: 200, f2: 90, d: 0.14, v: 0.4 }); A.noise(o, t, { d: 0.1, v: 0.25, f: 900 }); },
  block: (A, t, o) => [1, 2.76, 5.4, 8.93].forEach((m) => A.tone(o, t, { type: 'sine', f: 320 * m, d: 0.5 / m + 0.1, v: 0.12 / m })),
  shield: (A, t, o) => { SOUNDS.block(A, t, o); A.tone(o, t, { f: 660, f2: 990, a: 0.05, d: 0.5, v: 0.08 }); },
  charge: (A, t, o) => A.noise(o, t, { a: 0.05, d: 0.4, v: 0.35, f: 300, f2: 1600 }),
  rally: (A, t, o) => [50, 57, 62, 66, 69].forEach((n, i) => A.tone(o, t + i * 0.03, { type: 'sawtooth', f: midi(n), a: 0.08, d: 1.1, v: 0.05 })),
  holy: (A, t, o) => { [62, 66, 69, 74, 78].forEach((n) => A.tone(o, t, { type: 'triangle', f: midi(n), a: 0.02, d: 1.6, v: 0.08 })); A.tone(o, t, { f: 80, f2: 30, d: 0.8, v: 0.6 }); },
  roar: (A, t, o) => { A.tone(o, t, { type: 'sawtooth', f: 130, f2: 80, a: 0.05, d: 0.8, v: 0.18 }); A.noise(o, t, { a: 0.05, d: 0.8, v: 0.3, f: 500, q: 2 }); },
  slam: (A, t, o) => { A.tone(o, t, { f: 70, f2: 28, d: 0.6, v: 0.8 }); A.noise(o, t, { d: 0.5, v: 0.45, type: 'lowpass', f: 900, f2: 120 }); },
  blink: (A, t, o) => { A.tone(o, t, { type: 'sine', f: 400, f2: 2400, d: 0.2, v: 0.12 }); A.tone(o, t + 0.12, { type: 'sine', f: 2400, f2: 800, d: 0.2, v: 0.08 }); },
  storm: (A, t, o) => A.noise(o, t, { a: 0.3, d: 2.6, v: 0.25, f: 200, f2: 1200, q: 0.6 }),
  smoke: (A, t, o) => A.noise(o, t, { a: 0.05, d: 1.4, v: 0.3, type: 'highpass', f: 1500, f2: 400 }),
  pierce: (A, t, o) => { A.tone(o, t, { type: 'sine', f: 3000, f2: 600, d: 0.35, v: 0.12 }); A.noise(o, t, { d: 0.3, v: 0.3, f: 2500, f2: 600, q: 3 }); },
  summon: (A, t, o) => { A.tone(o, t, { type: 'sawtooth', f: 55, f2: 82, a: 0.4, d: 1.2, v: 0.15 }); A.noise(o, t, { a: 0.4, d: 1.2, v: 0.15, f: 400, q: 5 }); },
  error: (A, t, o) => A.tone(o, t, { type: 'square', f: 180, d: 0.12, v: 0.05 }),
  select: (A, t, o) => A.tone(o, t, { type: 'triangle', f: 880, d: 0.08, v: 0.08 }),
  tick: (A, t, o) => { A.tone(o, t, { type: 'square', f: 2200, f2: 1400, d: 0.025, v: 0.04 }); A.noise(o, t, { d: 0.02, v: 0.06, type: 'highpass', f: 4000 }); },
  unlock: (A, t, o) => { A.tone(o, t, { type: 'square', f: 300, f2: 180, d: 0.06, v: 0.08 }); A.noise(o, t + 0.06, { d: 0.12, v: 0.15, f: 1800 }); A.tone(o, t + 0.16, { type: 'triangle', f: 660, f2: 990, d: 0.2, v: 0.1 }); },
  mythic: (A, t, o) => { [0, 7, 12, 16, 19, 24, 28, 31].forEach((s, i) => A.tone(o, t + i * 0.06, { type: 'triangle', f: midi(64 + s), d: 1.8, v: 0.09 })); A.tone(o, t, { f: 70, f2: 35, d: 1.2, v: 0.5 }); A.noise(o, t, { a: 0.2, d: 1.6, v: 0.12, type: 'highpass', f: 3000, f2: 8000 }); },
  ui: (A, t, o) => A.tone(o, t, { type: 'sine', f: 1200, d: 0.05, v: 0.05 }),
  chat: (A, t, o) => A.tone(o, t, { type: 'sine', f: 1400, f2: 1800, d: 0.08, v: 0.06 }),
  quest: (A, t, o) => [0, 4, 7, 12].forEach((s, i) => A.tone(o, t + i * 0.09, { type: 'triangle', f: midi(67 + s), d: 0.5, v: 0.1 })),
  // entrée dans une nouvelle zone : accord ouvert, lent, avec un souffle
  discover: (A, t, o) => { [0, 7, 14, 19].forEach((s, i) => A.tone(o, t + i * 0.16, { type: 'triangle', f: midi(55 + s), a: 0.12, d: 2.4, v: 0.07 })); A.noise(o, t, { a: 0.6, d: 1.6, v: 0.06, type: 'bandpass', f: 600, f2: 1400, q: 0.6 }); },
  rune: (A, t, o) => A.tone(o, t, { type: 'sine', f: 1500 + Math.random() * 900, d: 0.08, v: 0.03 }),
  runeok: (A, t, o) => { [0, 5, 12, 17].forEach((s, i) => A.tone(o, t + i * 0.04, { type: 'sine', f: midi(74 + s), d: 0.7, v: 0.09 })); },
  runefail: (A, t, o) => { A.tone(o, t, { type: 'sawtooth', f: 300, f2: 120, d: 0.3, v: 0.07 }); A.noise(o, t, { d: 0.3, v: 0.1, f: 600 }); },
  beacon: (A, t, o) => { [50, 57, 62, 66, 69, 74].forEach((n, i) => A.tone(o, t + i * 0.08, { type: 'triangle', f: midi(n), a: 0.15, d: 3, v: 0.08 })); A.tone(o, t, { f: 60, f2: 40, d: 2, v: 0.4 }); },
  oracle: (A, t, o) => [74, 79, 81, 86].forEach((n, i) => A.tone(o, t + i * 0.11, { type: 'sine', f: midi(n), d: 1.2, v: 0.06 })),
};
