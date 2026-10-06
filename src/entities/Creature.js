import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { blobAssets } from './Character.js';

// Créatures de la Brume modélisées en code (style low-poly KayKit) et animées par procédure :
// gelée, araignée, loup, golem, feu follet. Même interface que Character, pour que
// l'IA, le réseau et les effets les traitent comme les squelettes.

const PALETTES = {
  slime: { body: '#9a6cff', core: '#e2ccff', eye: '#ffffff' },
  spider: { body: '#3b3346', leg: '#2a2433', eye: '#ff4a4a', mark: '#b06cff' },
  wolf: { body: '#4a4458', belly: '#6b6478', eye: '#c9a2ff', snout: '#2c2836' },
  golem: { body: '#8a8478', dark: '#5f5a52', crystal: '#7fe0ff' },
  wisp: { core: '#c9f0ff', glow: '#7fd4ff' },
};

const _c = new THREE.Color();

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.75, metalness: opts.metalness ?? 0, flatShading: opts.flat ?? true, emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0), emissiveIntensity: opts.ei ?? 1, transparent: !!opts.transparent, opacity: opts.opacity ?? 1 });
}

export class Creature {
  constructor(kind, { scale = 1, tint = null } = {}) {
    this.kind = kind;
    this.object = new THREE.Group();
    this.root = new THREE.Group();
    this.root.scale.setScalar(scale);
    this.object.add(this.root);
    this.scale = scale;
    this.materials = [];
    this.parts = {};
    this.loco = 'Idle'; this.locoScale = 1;
    this.act = null; this.oneShot = null;
    this.t = Math.random() * 10;
    this.flash = 0; this.opacity = 1;
    this.groundOffset = 0;
    this.pal = { ...PALETTES[kind] };
    if (tint) for (const k of Object.keys(this.pal)) if (k !== 'eye') this.pal[k] = '#' + _c.set(this.pal[k]).lerp(new THREE.Color(tint), 0.55).getHexString();
    this['build_' + kind]();
    this.bake();
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = kind !== 'wisp'; if (!this.materials.includes(o.material)) this.materials.push(o.material); } });
    for (const m of this.materials) { m.userData.baseEmissive = m.emissive ? m.emissive.clone() : null; m.userData.baseEmissiveIntensity = m.emissiveIntensity; m.userData.baseOpacity = m.opacity; }
    const b = blobAssets();
    this.blob = new THREE.Mesh(b.geo, new THREE.MeshBasicMaterial({ map: b.tex, color: 0x000000, transparent: true, depthWrite: false, opacity: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.blobSize = (kind === 'golem' ? 1.9 : kind === 'wolf' ? 1.6 : kind === 'spider' ? 1.8 : 1.2) * scale;
    this.blob.scale.setScalar(this.blobSize);
    this.blob.renderOrder = 1; this.blob.position.y = 0.05;
    this.object.add(this.blob);
  }

  add(parent, geo, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  pivot(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

  // ------------------------------------------------------------------ modèles
  build_slime() {
    const P = this.pal, p = this.parts;
    p.body = this.pivot(this.root);
    const geo = new THREE.IcosahedronGeometry(0.75, 1);
    geo.scale(1, 0.78, 1); geo.translate(0, 0.58, 0);
    p.shell = this.add(p.body, geo, mat(P.body, { transparent: true, opacity: 0.82, roughness: 0.25, emissive: P.body, ei: 0.25 }));
    p.core = this.add(p.body, new THREE.IcosahedronGeometry(0.26, 0), mat(P.core, { emissive: P.core, ei: 1.4 }), 0, 0.55, 0);
    const eyeG = new THREE.SphereGeometry(0.13, 8, 6), pupG = new THREE.SphereGeometry(0.065, 6, 4);
    for (const sx of [-0.24, 0.24]) {
      this.add(p.body, eyeG, mat(P.eye, { roughness: 0.3 }), sx, 0.78, 0.55);
      this.add(p.body, pupG, mat('#120c1c'), sx, 0.78, 0.66);
    }
  }

  build_spider() {
    const P = this.pal, p = this.parts;
    p.body = this.pivot(this.root, 0, 0.62, 0);
    const abd = new THREE.IcosahedronGeometry(0.55, 1); abd.scale(1, 0.8, 1.25);
    this.add(p.body, abd, mat(P.body), 0, 0.12, -0.55);
    const markG = new THREE.OctahedronGeometry(0.2, 0); markG.scale(1, 0.3, 1.3);
    this.add(p.body, markG, mat(P.mark, { emissive: P.mark, ei: 0.8 }), 0, 0.52, -0.6);
    const tho = new THREE.IcosahedronGeometry(0.34, 0); tho.scale(1, 0.75, 1.1);
    p.head = this.pivot(p.body, 0, 0.02, 0.3);
    this.add(p.head, tho, mat(P.body));
    const eyeG = new THREE.SphereGeometry(0.06, 6, 4), eyeM = mat(P.eye, { emissive: P.eye, ei: 2 });
    for (const [x, y] of [[-0.12, 0.12], [0.12, 0.12], [-0.2, 0.05], [0.2, 0.05]]) this.add(p.head, eyeG, eyeM, x, y, 0.3);
    const fangG = new THREE.ConeGeometry(0.05, 0.22, 4); fangG.rotateX(Math.PI);
    p.fangs = [-0.08, 0.08].map((x) => this.add(p.head, fangG, mat('#d8d0c0'), x, -0.18, 0.32));
    // huit pattes à deux segments
    p.legs = [];
    const upG = new THREE.CylinderGeometry(0.05, 0.065, 0.75, 5); upG.rotateZ(Math.PI / 2); upG.translate(0.37, 0, 0);
    const loG = new THREE.CylinderGeometry(0.025, 0.05, 0.85, 5); loG.translate(0, -0.42, 0);
    const legM = mat(P.leg);
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? 1 : -1, k = i % 4;
      const hip = this.pivot(p.body, side * 0.22, 0, 0.32 - k * 0.24);
      hip.rotation.y = side > 0 ? (-0.75 + k * 0.5) : Math.PI - (-0.75 + k * 0.5);
      const up = this.pivot(hip); up.rotation.z = 0.55;
      this.add(up, upG, legM);
      const knee = this.pivot(up, 0.74, 0, 0); knee.rotation.z = -1.25;
      this.add(knee, loG, legM);
      p.legs.push({ hip, up, knee, phase: (k % 2 === 0) === (side > 0) ? 0 : Math.PI, base: hip.rotation.y, side });
    }
  }

  build_wolf() {
    const P = this.pal, p = this.parts;
    const bodyM = mat(P.body), bellyM = mat(P.belly), darkM = mat(P.snout);
    p.body = this.pivot(this.root, 0, 0.92, 0);
    const torso = new THREE.BoxGeometry(0.62, 0.55, 1.25); torso.translate(0, 0, -0.05);
    this.add(p.body, torso, bodyM);
    const chest = new THREE.BoxGeometry(0.7, 0.66, 0.5);
    this.add(p.body, chest, bellyM, 0, 0.04, 0.48);
    // crinière
    const mane = new THREE.ConeGeometry(0.42, 0.5, 5); mane.rotateX(-Math.PI / 2);
    this.add(p.body, mane, darkM, 0, 0.22, 0.5);
    p.head = this.pivot(p.body, 0, 0.3, 0.78);
    this.add(p.head, new THREE.BoxGeometry(0.44, 0.4, 0.44), bodyM, 0, 0, 0.08);
    this.add(p.head, new THREE.BoxGeometry(0.26, 0.22, 0.38), darkM, 0, -0.07, 0.42);
    p.jaw = this.pivot(p.head, 0, -0.16, 0.25);
    this.add(p.jaw, new THREE.BoxGeometry(0.22, 0.08, 0.32), darkM, 0, 0, 0.14);
    const earG = new THREE.ConeGeometry(0.1, 0.24, 4);
    for (const x of [-0.14, 0.14]) this.add(p.head, earG, bodyM, x, 0.3, 0);
    const eyeG = new THREE.SphereGeometry(0.05, 6, 4), eyeM = mat(P.eye, { emissive: P.eye, ei: 2.2 });
    for (const x of [-0.13, 0.13]) this.add(p.head, eyeG, eyeM, x, 0.06, 0.31);
    p.tail = this.pivot(p.body, 0, 0.12, -0.7);
    const tailG = new THREE.ConeGeometry(0.13, 0.75, 5); tailG.rotateX(-Math.PI / 2 - 0.5); tailG.translate(0, -0.15, -0.3);
    this.add(p.tail, tailG, bodyM);
    p.legs = [];
    const legG = new THREE.BoxGeometry(0.16, 0.8, 0.18); legG.translate(0, -0.38, 0);
    const pawG = new THREE.BoxGeometry(0.2, 0.1, 0.26); pawG.translate(0, -0.78, 0.04);
    for (const [x, z, ph] of [[-0.22, 0.45, 0], [0.22, 0.45, Math.PI], [-0.22, -0.5, Math.PI], [0.22, -0.5, 0]]) {
      const hip = this.pivot(p.body, x, -0.1, z);
      this.add(hip, legG, bodyM); this.add(hip, pawG, darkM);
      p.legs.push({ hip, phase: ph });
    }
  }

  build_golem() {
    const P = this.pal, p = this.parts;
    const rockM = mat(P.body, { roughness: 0.95 }), darkM = mat(P.dark, { roughness: 0.95 }), crM = mat(P.crystal, { emissive: P.crystal, ei: 1.6, roughness: 0.2 });
    p.body = this.pivot(this.root, 0, 1.45, 0);
    const torso = new THREE.DodecahedronGeometry(0.85, 0); torso.scale(1.15, 0.95, 0.85);
    this.add(p.body, torso, rockM);
    const belly = new THREE.DodecahedronGeometry(0.55, 0); belly.scale(1, 0.7, 0.8);
    this.add(p.body, belly, darkM, 0, -0.62, 0.05);
    p.core = this.add(p.body, new THREE.OctahedronGeometry(0.22, 0), crM, 0, 0.05, 0.68);
    p.head = this.pivot(p.body, 0, 0.88, 0.18);
    const headG = new THREE.DodecahedronGeometry(0.36, 0); headG.scale(1, 0.85, 0.95);
    this.add(p.head, headG, rockM);
    const eyeG = new THREE.BoxGeometry(0.12, 0.05, 0.05);
    for (const x of [-0.13, 0.13]) this.add(p.head, eyeG, crM, x, 0.03, 0.32);
    // éclats de cristal sur le dos
    for (const [x, y, z, rz, s] of [[-0.35, 0.55, -0.45, 0.4, 1], [0.3, 0.7, -0.4, -0.3, 1.2], [0, 0.35, -0.62, 0, 0.9]]) {
      const cg = new THREE.OctahedronGeometry(0.2 * s, 0); cg.scale(0.6, 2, 0.6);
      const m = this.add(p.body, cg, crM, x, y, z); m.rotation.set(-0.5, 0, rz);
    }
    p.arms = [];
    for (const side of [-1, 1]) {
      const sh = this.pivot(p.body, side * 1.0, 0.35, 0);
      const up = new THREE.DodecahedronGeometry(0.36, 0); up.scale(0.9, 1.3, 0.9); up.translate(0, -0.42, 0);
      this.add(sh, up, rockM);
      const fist = new THREE.DodecahedronGeometry(0.42, 0); fist.translate(0, -1.08, 0.05);
      this.add(sh, fist, darkM);
      p.arms.push({ sh, side });
    }
    p.legs = [];
    for (const side of [-1, 1]) {
      const hip = this.pivot(p.body, side * 0.45, -0.85, 0);
      const lg = new THREE.DodecahedronGeometry(0.34, 0); lg.scale(0.9, 1.4, 0.95); lg.translate(0, -0.3, 0);
      this.add(hip, lg, darkM);
      p.legs.push({ hip, side });
    }
  }

  build_wisp() {
    const P = this.pal, p = this.parts;
    p.body = this.pivot(this.root, 0, 1.5, 0);
    p.core = this.add(p.body, new THREE.IcosahedronGeometry(0.28, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.core).multiplyScalar(2.2), toneMapped: false, transparent: true }));
    p.shell = this.add(p.body, new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.glow).multiplyScalar(1.4), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    p.sparks = [];
    const sg = new THREE.OctahedronGeometry(0.07, 0);
    for (let i = 0; i < 5; i++) {
      const s = this.add(p.body, sg, new THREE.MeshBasicMaterial({ color: new THREE.Color(P.glow).multiplyScalar(2), toneMapped: false, transparent: true }));
      p.sparks.push({ m: s, a: i / 5 * Math.PI * 2, r: 0.5 + Math.random() * 0.25, y: (Math.random() - 0.5) * 0.4, sp: 1.5 + Math.random() });
    }
    // traînée
    const tail = new THREE.ConeGeometry(0.22, 0.9, 6); tail.rotateX(Math.PI); tail.translate(0, -0.55, 0);
    p.tail = this.add(p.body, tail, new THREE.MeshBasicMaterial({ color: new THREE.Color(P.glow).multiplyScalar(1.2), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  }

  // Fusionne, sous chaque articulation, les pièces fixes qui partagent le même matériau :
  // une créature coûte ainsi une dizaine d'appels de rendu au lieu d'une trentaine.
  bake() {
    const keep = new Set();
    for (const v of Object.values(this.parts)) for (const x of [].concat(v)) { if (x?.isMesh) keep.add(x); if (x?.m?.isMesh) keep.add(x.m); }
    const key = (m) => [m.type, m.color.getHex(), m.emissive?.getHex(), m.emissiveIntensity, m.transparent, m.opacity, m.blending, m.roughness].join('|');
    const groups = [];
    this.root.traverse((o) => { if (o.isGroup || o === this.root) groups.push(o); });
    for (const gr of groups) {
      const byKey = new Map();
      for (const c of gr.children) if (c.isMesh && !keep.has(c)) { const k = key(c.material); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(c); }
      for (const list of byKey.values()) {
        if (list.length < 2) continue;
        const geos = list.map((m) => { m.updateMatrix(); const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix); for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); return g; });
        const merged = mergeGeometries(geos, false);
        if (!merged) continue;
        const mesh = new THREE.Mesh(merged, list[0].material);
        gr.add(mesh);
        for (const m of list) { m.removeFromParent(); m.geometry.dispose(); }
      }
    }
  }

  // ------------------------------------------------------------------ interface Character
  setLocomotion(name, timeScale = 1) { this.loco = name; this.locoScale = timeScale; }

  kindOf(name) {
    if (/Death/.test(name)) return 'death';
    if (/Spawn/.test(name)) return 'spawn';
    if (/Hit/.test(name)) return 'hit';
    if (/Spellcast|Summon|Long/.test(name)) return 'cast';
    return 'attack';
  }

  playAction(name, { timeScale = 1, hold = false, onDone = null } = {}) {
    const k = this.kindOf(name);
    const dur = { death: 1.3, spawn: 1.6, hit: 0.32, cast: 1.1, attack: this.kind === 'golem' ? 0.95 : 0.6 }[k] / timeScale;
    this.act = { k, t: 0, dur, hold, onDone };
    this.oneShot = k === 'hit' ? null : this.act;
    return dur;
  }

  playLoop(name) { this.act = { k: this.kindOf(name), t: 0, dur: 1, loop: true }; this.oneShot = this.act; }
  stopAction() { this.act = null; this.oneShot = null; }

  hitFlash(color = '#ffffff', amount = 1) { this.flash = amount; this.flashColor = (this.flashColor || new THREE.Color()).set(color); }

  setOpacity(o) {
    if (o === this.opacity) return;
    this.opacity = o;
    for (const m of this.materials) { m.transparent = o < 1 || (m.userData.baseOpacity ?? 1) < 1; m.opacity = (m.userData.baseOpacity ?? 1) * o; m.depthWrite = o >= 1 && !(m.blending === THREE.AdditiveBlending); }
  }

  update(dt) {
    this.t += dt;
    const a = this.act;
    let k = null, f = 0;
    if (a) {
      a.t += dt;
      f = Math.min(1, a.t / a.dur);
      k = a.k;
      if (a.loop) f = (a.t / a.dur) % 1;
      else if (a.t >= a.dur && !a.hold) { const cb = a.onDone; this.act = null; this.oneShot = null; cb?.(); k = null; }
    }
    const moving = this.loco === 'run' ? 2 : this.loco === 'walk' ? 1 : 0;
    this['pose_' + this.kind](dt, moving, k, f);
    // ombre de contact
    const off = Math.max(0, this.groundOffset || 0), kk = Math.max(0, 1 - off / 5) * this.opacity;
    this.blob.visible = kk > 0.03;
    if (this.blob.visible) { this.blob.material.opacity = 0.4 * kk; this.blob.position.y = 0.05 - off; }
    // éclat d'impact
    if (this.flash > 0 || this._flashing) {
      this.flash = Math.max(0, this.flash - dt * 5);
      this._flashing = this.flash > 0;
      for (const m of this.materials) {
        if (!m.emissive) continue;
        if (this.flash > 0) { m.emissive.copy(this.flashColor); m.emissiveIntensity = this.flash * 1.4; }
        else { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseEmissiveIntensity; }
      }
    }
  }

  // apparition commune : sort du sol ; mort commune : s'affaisse
  spawnLift(k, f) { this.root.position.y = k === 'spawn' ? -1.6 * this.scale * (1 - f) : 0; }

  pose_slime(dt, moving, k, f) {
    const p = this.parts, t = this.t * this.locoScale;
    let sx = 1, sy = 1, y = 0, z = 0;
    if (moving) {
      const hop = Math.abs(Math.sin(t * (moving > 1 ? 9 : 6)));
      y = hop * (moving > 1 ? 0.55 : 0.35);
      sy = 0.8 + hop * 0.35; sx = 1.12 - hop * 0.18;
    } else { sy = 1 + Math.sin(this.t * 3) * 0.05; sx = 1 - Math.sin(this.t * 3) * 0.04; }
    if (k === 'attack' || k === 'cast') {
      if (f < 0.45) { const q = f / 0.45; sy = 1 - q * 0.4; sx = 1 + q * 0.3; }
      else { const q = (f - 0.45) / 0.55; z = Math.sin(q * Math.PI) * 1.1; y = Math.sin(q * Math.PI) * 0.5; sy = 1.2 - q * 0.2; sx = 0.9; }
    } else if (k === 'hit') { sy = 0.75; sx = 1.25; }
    else if (k === 'death') { sy = Math.max(0.08, 1 - f * 1.2); sx = 1 + f * 0.9; }
    else if (k === 'spawn') { sy = f; sx = 0.4 + f * 0.6; }
    p.body.scale.set(sx, sy, sx);
    p.body.position.set(0, y, z);
    p.core.rotation.y += dt * 1.5; p.core.position.y = 0.55 + Math.sin(this.t * 2.2) * 0.06;
  }

  pose_spider(dt, moving, k, f) {
    const p = this.parts, t = this.t * this.locoScale * (moving > 1 ? 16 : 10);
    this.spawnLift(k, f);
    let bodyY = 0.62, pitch = 0;
    for (const L of p.legs) {
      const s = moving ? Math.sin(t + L.phase) : Math.sin(this.t * 1.5 + L.phase) * 0.15;
      L.hip.rotation.y = L.base + s * 0.35 * L.side;
      L.up.rotation.z = 0.55 + Math.max(0, Math.cos(t + L.phase)) * (moving ? 0.35 : 0);
    }
    if (moving) bodyY += Math.abs(Math.sin(t * 2)) * 0.05;
    if (k === 'attack') {
      const q = Math.sin(f * Math.PI);
      pitch = -q * 0.55;
      for (const L of p.legs.slice(0, 1).concat(p.legs.slice(4, 5))) L.up.rotation.z = 0.55 - q * 1.2;
      p.head.position.z = 0.3 + q * 0.25;
      for (const fg of p.fangs) fg.rotation.x = q * 0.5;
    } else if (k === 'death') { pitch = 0; bodyY = 0.62 - f * 0.4; p.body.rotation.z = f * Math.PI * 0.9; for (const L of p.legs) L.knee.rotation.z = -1.25 - f * 0.9; }
    else if (k === 'hit') bodyY -= 0.1;
    if (k !== 'death') p.body.rotation.z = 0;
    p.body.rotation.x = pitch;
    p.body.position.y = bodyY;
  }

  pose_wolf(dt, moving, k, f) {
    const p = this.parts, sp = moving > 1 ? 13 : 8, t = this.t * this.locoScale * sp;
    this.spawnLift(k, f);
    let bodyY = 0.92, pitch = 0, roll = 0;
    for (const L of p.legs) L.hip.rotation.x = moving ? Math.sin(t + L.phase) * (moving > 1 ? 0.85 : 0.5) : 0;
    if (moving) { bodyY += Math.abs(Math.sin(t)) * (moving > 1 ? 0.12 : 0.05); pitch = moving > 1 ? Math.sin(t) * 0.08 : 0; }
    p.tail.rotation.y = Math.sin(this.t * (moving ? 10 : 3)) * 0.4;
    p.tail.rotation.x = moving > 1 ? 0.5 : 0;
    p.head.rotation.x = moving ? 0.1 : Math.sin(this.t * 0.8) * 0.08;
    p.jaw.rotation.x = 0;
    if (k === 'attack') {
      const q = Math.sin(f * Math.PI);
      pitch = -q * 0.25 + (f > 0.5 ? (f - 0.5) * 0.4 : 0);
      bodyY += q * 0.35;
      p.body.position.z = q * 0.8;
      p.jaw.rotation.x = q * 0.7;
      for (const L of p.legs) L.hip.rotation.x = (L === p.legs[0] || L === p.legs[1]) ? -q * 0.9 : q * 0.6;
    } else p.body.position.z = 0;
    if (k === 'cast') { p.head.rotation.x = -0.6 * Math.sin(f * Math.PI); p.jaw.rotation.x = 0.5 * Math.sin(f * Math.PI); }
    if (k === 'hit') roll = 0.15;
    if (k === 'death') { roll = f * Math.PI / 2; bodyY = 0.92 - f * 0.55; for (const L of p.legs) L.hip.rotation.x = 0.3; }
    p.body.rotation.set(pitch, 0, roll);
    p.body.position.y = bodyY;
  }

  pose_golem(dt, moving, k, f) {
    const p = this.parts, t = this.t * this.locoScale * (moving > 1 ? 6 : 4);
    this.spawnLift(k, f);
    let bodyY = 1.45, pitch = 0, roll = 0;
    const sw = moving ? Math.sin(t) : 0;
    for (const L of p.legs) L.hip.rotation.x = sw * 0.45 * L.side;
    for (const A of p.arms) { A.sh.rotation.x = -sw * 0.35 * A.side; A.sh.rotation.z = A.side * 0.12; }
    if (moving) { bodyY += Math.abs(Math.cos(t)) * 0.08; roll = sw * 0.06; }
    else bodyY += Math.sin(this.t * 1.2) * 0.03;
    p.core.rotation.y += dt * 2;
    p.core.scale.setScalar(1 + Math.sin(this.t * 3) * 0.12);
    if (k === 'attack' || k === 'cast') {
      // les deux poings se lèvent puis frappent le sol
      const up = f < 0.55 ? f / 0.55 : 1 - (f - 0.55) / 0.45 * 1.25;
      for (const A of p.arms) { A.sh.rotation.x = -Math.max(-0.4, up) * 2.6; A.sh.rotation.z = A.side * 0.25; }
      pitch = f < 0.55 ? -0.15 * (f / 0.55) : 0.35 * Math.sin((f - 0.55) / 0.45 * Math.PI);
    } else if (k === 'hit') pitch = -0.12;
    else if (k === 'death') {
      // s'écroule en morceaux
      bodyY = 1.45 - f * 1.1; pitch = f * 0.9;
      for (const A of p.arms) { A.sh.rotation.z = A.side * (0.12 + f * 1.4); A.sh.position.y = 0.35 - f * 0.4; }
      p.head.position.y = 0.88 - f * 0.5; p.head.rotation.z = f * 0.8;
    }
    p.body.rotation.set(pitch, 0, roll);
    p.body.position.y = bodyY;
  }

  pose_wisp(dt, moving, k, f) {
    const p = this.parts;
    let y = 1.5 + Math.sin(this.t * 2.4) * 0.18, s = 1;
    if (k === 'spawn') s = f;
    if (k === 'attack' || k === 'cast') s = 1 + Math.sin(f * Math.PI) * 0.5;
    if (k === 'hit') s = 0.8;
    if (k === 'death') { s = 1 + f * 1.5; y += f * 1.5; }
    p.body.position.y = y;
    p.body.scale.setScalar(s);
    p.shell.scale.setScalar(1 + Math.sin(this.t * 6) * 0.08);
    p.tail.rotation.x = moving ? 0.6 : Math.sin(this.t * 2) * 0.1;
    for (const sp of p.sparks) { sp.a += dt * sp.sp; sp.m.position.set(Math.cos(sp.a) * sp.r, sp.y + Math.sin(sp.a * 2) * 0.1, Math.sin(sp.a) * sp.r); }
    this.groundOffset = y - 0.2;
    if (k === 'death') { const o = Math.max(0, 1 - f); for (const m of this.materials) m.opacity = (m.userData.baseOpacity ?? 1) * o; }
  }

  dispose() {
    this.object.removeFromParent();
    this.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of this.materials) m.dispose();
    this.blob.material.dispose();
  }
}
