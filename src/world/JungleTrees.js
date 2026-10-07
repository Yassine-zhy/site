import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../engine/math.js';

// Arbres tropicaux de la Canopée d'Émeraude, modélisés en code (style low-poly KayKit) :
// palmiers courbés, grands fromagers à contreforts et lianes, fougères de sous-bois.
// Ils sont enregistrés comme des « props » pour la végétation instanciée (hauteur ~1, mise à
// l'échelle à la pose, comme les arbres du pack nature).

const _c = new THREE.Color();

// prépare une géométrie : non indexée, normales, couleur uniforme (légèrement bruitée par face)
function painted(geo, color, rng, jitter = 0.06) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g.computeVertexNormals();
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let f = 0; f < n; f += 3) {
    _c.set(color).offsetHSL(0, 0, (rng() - 0.5) * jitter);
    for (let v = 0; v < 3 && f + v < n; v++) { col[(f + v) * 3] = _c.r; col[(f + v) * 3 + 1] = _c.g; col[(f + v) * 3 + 2] = _c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// cylindre orienté de a vers b
function limb(a, b, r0, r1, sides = 6) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, sides, 1, false);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

// palme : bande pliée le long de la nervure, qui s'incurve vers le bas
function frond(top, yaw, len, width, droop, segs = 5) {
  const pos = [];
  const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), side = new THREE.Vector3(dir.z, 0, -dir.x);
  const pt = (t) => top.clone().addScaledVector(dir, t * len).add(new THREE.Vector3(0, 0.08 * t - droop * t * t, 0));
  for (let k = 0; k < segs; k++) {
    const t0 = k / segs, t1 = (k + 1) / segs;
    const w0 = width * Math.sin(Math.PI * Math.max(0.12, t0)), w1 = width * Math.sin(Math.PI * Math.min(0.92, t1));
    const c0 = pt(t0), c1 = pt(t1);
    const fold = (w) => new THREE.Vector3(0, -w * 0.35, 0);
    const l0 = c0.clone().addScaledVector(side, w0).add(fold(w0)), r0 = c0.clone().addScaledVector(side, -w0).add(fold(w0));
    const l1 = c1.clone().addScaledVector(side, w1).add(fold(w1)), r1 = c1.clone().addScaledVector(side, -w1).add(fold(w1));
    // les deux faces (le matériau ne dessine que l'avant : l'intérieur des houppiers reste invisible)
    const tris = [c0, l0, c1, l0, l1, c1, c0, c1, r0, r0, c1, r1];
    for (const v of tris) pos.push(v.x, v.y, v.z);
    for (let t = tris.length - 3; t >= 0; t -= 3) for (const v of [tris[t], tris[t + 2], tris[t + 1]]) pos.push(v.x, v.y, v.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

function palm(seed, lean = 0.28, height = 1.15) {
  const rng = mulberry32(seed), parts = [];
  const N = 7, pts = [];
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push(new THREE.Vector3(lean * t * t, t * height, 0)); }
  for (let i = 0; i < N; i++) {
    const r0 = 0.05 * (1 - 0.4 * (i / N)), r1 = 0.05 * (1 - 0.4 * ((i + 1) / N));
    parts.push(painted(limb(pts[i], pts[i + 1], r0 * 1.12, r1, 7), i % 2 ? '#8a6440' : '#a57d52', rng, 0.04));
  }
  const top = pts[N];
  parts.push(painted(new THREE.SphereGeometry(0.06, 6, 4).translate(top.x, top.y, top.z), '#6b8f3a', rng));
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.4;
    parts.push(painted(new THREE.IcosahedronGeometry(0.035, 0).translate(top.x + Math.sin(a) * 0.05, top.y - 0.05, top.z + Math.cos(a) * 0.05), '#5a3d22', rng));
  }
  const n = 9;
  for (let i = 0; i < n; i++) {
    const yaw = (i / n) * Math.PI * 2 + rng() * 0.3;
    const g = frond(top, yaw, 0.55 + rng() * 0.15, 0.085, 0.42 + rng() * 0.18);
    parts.push(painted(g, i % 3 === 0 ? '#5fae45' : i % 3 === 1 ? '#4a9a3c' : '#6fbe4c', rng, 0.08));
  }
  return mergeGeometries(parts, false);
}

function kapok(seed) {
  const rng = mulberry32(seed), parts = [];
  const bark = '#7a5a3c', dark = '#5e432c';
  parts.push(painted(limb(new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0.02, 0.78, 0.01), 0.085, 0.055, 8), bark, rng, 0.05));
  // contreforts : lames triangulaires au pied du tronc
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rng() * 0.4;
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.2 + rng() * 0.06, 0); s.lineTo(0, 0.24 + rng() * 0.08); s.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: false });
    g.translate(0.04, -0.03, -0.011); g.rotateY(-a);
    parts.push(painted(g, dark, rng, 0.05));
  }
  // grosses branches et houppier en dômes
  const blobs = [[0, 1.02, 0, 0.34], [0.22, 0.95, 0.08, 0.24], [-0.2, 0.96, -0.1, 0.25], [0.06, 0.92, -0.24, 0.22], [-0.08, 0.93, 0.22, 0.23], [0.02, 1.2, 0.02, 0.22]];
  for (const [x, y, z, r] of blobs.slice(1, 5)) parts.push(painted(limb(new THREE.Vector3(0.01, 0.62, 0), new THREE.Vector3(x * 0.8, y - 0.12, z * 0.8), 0.03, 0.018, 5), bark, rng, 0.05));
  const greens = ['#2f7f34', '#3f9a3a', '#2a6f30', '#4aa63f'];
  blobs.forEach(([x, y, z, r], i) => {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(1.15, 0.55, 1.15); g.translate(x, y, z);
    parts.push(painted(g, greens[i % greens.length], rng, 0.1));
  });
  // lianes pendantes
  for (let i = 0; i < 6; i++) {
    const a = rng() * Math.PI * 2, r = 0.18 + rng() * 0.2, len = 0.35 + rng() * 0.3;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    parts.push(painted(new THREE.BoxGeometry(0.008, len, 0.008).translate(x, 0.9 - len / 2, z), '#3f7f3a', rng, 0.05));
  }
  return mergeGeometries(parts, false);
}

function fern(seed) {
  const rng = mulberry32(seed), parts = [];
  const base = new THREE.Vector3(0, 0.02, 0);
  for (let i = 0; i < 8; i++) {
    const yaw = (i / 8) * Math.PI * 2 + rng() * 0.4;
    const g = frond(base, yaw, 0.32 + rng() * 0.1, 0.05, -0.22, 4);
    parts.push(painted(g, i % 2 ? '#3f9a3a' : '#57b04a', rng, 0.08));
  }
  return mergeGeometries(parts, false);
}

// Enregistre les modèles comme props instanciables : proc_palm_A/B, proc_kapok, proc_fern.
export function registerJungleTrees(assets) {
  if (assets.geoCache.has('proc_kapok')) return;
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true });
  const add = (name, geometry) => {
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    assets.geoCache.set(name, { geometry, material: leafMat, box: geometry.boundingBox });
  };
  add('proc_palm_A', palm(11, 0.28, 1.15));
  add('proc_palm_B', palm(23, -0.18, 1.3));
  add('proc_kapok', kapok(37));
  add('proc_fern', fern(41));
}
