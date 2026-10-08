import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, Simplex } from '../engine/math.js';

// Arbres et buissons modélisés en code, dans l'esprit low-poly des modèles KayKit mais plus
// variés : chênes à houppier en dômes, bouleaux, sapins étagés (enneigés ou non), saules
// pleureurs, acacias des Terres d'Ambre, buissons fleuris. Couleurs par sommet, hauteur ~1
// (mis à l'échelle à la pose comme les autres arbres instanciés).

const _c = new THREE.Color();
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function painted(geo, color, rng, jitter = 0.06, opts = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g.computeVertexNormals();
  const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
  const base = new THREE.Color(color), top = opts.top ? new THREE.Color(opts.top) : null;
  for (let f = 0; f < n; f += 3) {
    _c.copy(base).offsetHSL((rng() - 0.5) * (opts.hue || 0), 0, (rng() - 0.5) * jitter);
    // faces tournées vers le haut : neige, ou lumière plus chaude
    if (top) {
      const ny = g.attributes.normal.getY(f);
      if (ny > (opts.topMin ?? 0.35)) _c.lerp(top, Math.min(1, (ny - (opts.topMin ?? 0.35)) * 2.2));
    }
    for (let v = 0; v < 3 && f + v < n; v++) { col[(f + v) * 3] = _c.r; col[(f + v) * 3 + 1] = _c.g; col[(f + v) * 3 + 2] = _c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function limb(a, b, r0, r1, sides = 6) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, sides, 1, false);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

// boule de feuillage bosselée (icosaèdre déformé par du bruit)
function blob(cx, cy, cz, r, sy, seed, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const n = new Simplex(seed), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + n.noise3(x * 3.1, y * 3.1, z * 3.1) * 0.18;
    p.setXYZ(i, x * k, y * k * sy, z * k);
  }
  g.translate(cx, cy, cz);
  return g;
}

// tronc courbe en segments, retourne aussi les points
function trunk(rng, parts, { h, r0, r1, lean = 0, bend = 0.06, segs = 4, color, sides = 7 }) {
  const pts = [V(0, -0.04, 0)];
  const la = rng() * Math.PI * 2;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    pts.push(V(Math.cos(la) * lean * t * t + (rng() - 0.5) * bend, h * t, Math.sin(la) * lean * t * t + (rng() - 0.5) * bend));
  }
  for (let i = 0; i < segs; i++) {
    const ra = r0 + (r1 - r0) * (i / segs), rb = r0 + (r1 - r0) * ((i + 1) / segs);
    parts.push(painted(limb(pts[i], pts[i + 1], ra, rb, sides), color, rng, 0.06));
  }
  return pts;
}

function oak(seed, { leaves = ['#4f9a3a', '#5fae42', '#3f8a36'], bark = '#7a5638', size = 1 } = {}) {
  const rng = mulberry32(seed), parts = [];
  const pts = trunk(rng, parts, { h: 0.55, r0: 0.075, r1: 0.05, lean: 0.06, color: bark });
  const top = pts[pts.length - 1];
  // racines
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + rng() * 0.6;
    parts.push(painted(limb(V(0, 0.08, 0), V(Math.cos(a) * 0.14, -0.03, Math.sin(a) * 0.14), 0.035, 0.012, 5), bark, rng));
  }
  const crowns = [];
  const nb = 3 + Math.floor(rng() * 2);
  for (let i = 0; i < nb; i++) {
    const a = i / nb * Math.PI * 2 + rng() * 0.8, r = 0.18 + rng() * 0.1;
    const end = V(top.x + Math.cos(a) * r, top.y + 0.12 + rng() * 0.12, top.z + Math.sin(a) * r);
    parts.push(painted(limb(V(top.x, top.y - 0.12, top.z), end, 0.03, 0.016, 5), bark, rng));
    crowns.push([end.x, end.y + 0.06, end.z, (0.2 + rng() * 0.08) * size]);
  }
  crowns.push([top.x, top.y + 0.3, top.z, 0.28 * size]);
  crowns.forEach(([x, y, z, r], i) => parts.push(painted(blob(x, y, z, r, 0.78, seed + i), leaves[i % leaves.length], rng, 0.12, { top: '#a9d65a', topMin: 0.55, hue: 0.02 })));
  return mergeGeometries(parts, false);
}

function birch(seed) {
  const rng = mulberry32(seed), parts = [];
  const pts = trunk(rng, parts, { h: 0.82, r0: 0.04, r1: 0.022, lean: 0.05, segs: 5, color: '#e9e4d6', sides: 6 });
  // marques sombres de l'écorce
  for (let i = 1; i < 5; i++) {
    const p = pts[i];
    parts.push(painted(new THREE.CylinderGeometry(0.036, 0.036, 0.018, 6).translate(p.x, p.y - 0.06, p.z), '#2f2a26', rng));
  }
  const leaves = ['#9cc449', '#b5cf52', '#86b443'];
  for (let i = 0; i < 6; i++) {
    const t = 0.45 + i * 0.09, p = pts[Math.min(5, Math.round(t * 5))];
    const a = rng() * Math.PI * 2, r = 0.07 + rng() * 0.08;
    parts.push(painted(blob(p.x + Math.cos(a) * r, 0.5 + i * 0.09, p.z + Math.sin(a) * r, 0.11 + rng() * 0.05, 1.1, seed + i), leaves[i % 3], rng, 0.1, { top: '#d6e070', topMin: 0.6 }));
  }
  return mergeGeometries(parts, false);
}

// sapin étagé : cônes déchiquetés, branches tombantes, neige sur le dessus si demandé
function pine(seed, { snow = false, tall = 1 } = {}) {
  const rng = mulberry32(seed), parts = [];
  trunk(rng, parts, { h: 0.3 * tall, r0: 0.05, r1: 0.035, segs: 2, color: '#5e4330', sides: 6 });
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const y = (0.16 + t * 0.78) * tall, r = 0.34 * (1 - t * 0.75) + 0.04, hgt = 0.28 * (1 - t * 0.35) * tall;
    const sides = 9;
    const g = new THREE.ConeGeometry(r, hgt, sides, 2, true);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), yy = p.getY(k), z = p.getZ(k);
      const rr = Math.hypot(x, z);
      if (rr > r * 0.9) { // bord : dents qui pendent
        const a = Math.atan2(z, x), tooth = Math.sin(a * sides) * 0.5 + 0.5;
        p.setXYZ(k, x * (1 + tooth * 0.18), yy - tooth * 0.05 - 0.03, z * (1 + tooth * 0.18));
      }
    }
    g.rotateY(rng() * Math.PI);
    g.translate(0, y, 0);
    // dessous des étages (fermeture) pour ne pas voir à travers
    const under = new THREE.CircleGeometry(r * 0.95, sides).rotateX(Math.PI / 2).translate(0, y - hgt / 2 - 0.03, 0);
    const green = i % 2 ? '#2f6f45' : '#357a4a';
    parts.push(painted(g, green, rng, 0.08, snow ? { top: '#f4f8fc', topMin: 0.25 } : { top: '#4f8f52', topMin: 0.5 }));
    parts.push(painted(under, '#244f36', rng, 0.04));
  }
  return mergeGeometries(parts, false);
}

function willow(seed) {
  const rng = mulberry32(seed), parts = [];
  const pts = trunk(rng, parts, { h: 0.5, r0: 0.08, r1: 0.055, lean: 0.12, bend: 0.1, color: '#5d5040' });
  const top = pts[pts.length - 1];
  const leaves = ['#7a9a4a', '#6a8c42', '#8aa652'];
  parts.push(painted(blob(top.x, top.y + 0.12, top.z, 0.34, 0.45, seed), leaves[0], rng, 0.1));
  // rideaux de branches qui tombent
  for (let i = 0; i < 22; i++) {
    const a = rng() * Math.PI * 2, r = 0.2 + rng() * 0.14;
    const x = top.x + Math.cos(a) * r, z = top.z + Math.sin(a) * r, len = 0.3 + rng() * 0.25;
    const g = new THREE.BoxGeometry(0.05, len, 0.012).translate(0, -len / 2, 0).rotateY(-a + Math.PI / 2).translate(x, top.y + 0.12, z);
    parts.push(painted(g, leaves[i % 3], rng, 0.1));
  }
  return mergeGeometries(parts, false);
}

function acacia(seed) {
  const rng = mulberry32(seed), parts = [];
  const pts = trunk(rng, parts, { h: 0.5, r0: 0.05, r1: 0.03, lean: 0.14, bend: 0.08, color: '#6b4a32' });
  const top = pts[pts.length - 1];
  const crowns = [];
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + rng(), r = 0.16 + rng() * 0.1;
    const end = V(top.x + Math.cos(a) * r, top.y + 0.1 + rng() * 0.06, top.z + Math.sin(a) * r);
    parts.push(painted(limb(top, end, 0.025, 0.014, 5), '#6b4a32', rng));
    crowns.push(end);
  }
  // houppier plat en parasol
  const leaves = ['#8f9a3a', '#a3a845', '#7d8c36'];
  crowns.forEach((c, i) => parts.push(painted(blob(c.x, c.y + 0.04, c.z, 0.24 + rng() * 0.06, 0.32, seed + i), leaves[i], rng, 0.1, { top: '#c8b45a', topMin: 0.7 })));
  return mergeGeometries(parts, false);
}

function bush(seed, flowers = '#ff8fb8') {
  const rng = mulberry32(seed), parts = [];
  const greens = ['#4f9a3a', '#5fae42', '#448c34'];
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + rng(), r = i ? 0.12 + rng() * 0.05 : 0;
    parts.push(painted(blob(Math.cos(a) * r, 0.12 + rng() * 0.04, Math.sin(a) * r, 0.15 + rng() * 0.05, 0.8, seed + i), greens[i % 3], rng, 0.1, { top: '#8fcf55', topMin: 0.6 }));
  }
  if (flowers) for (let i = 0; i < 9; i++) {
    const a = rng() * Math.PI * 2, r = 0.1 + rng() * 0.14;
    parts.push(painted(new THREE.OctahedronGeometry(0.03, 0).translate(Math.cos(a) * r, 0.2 + rng() * 0.12, Math.sin(a) * r), flowers, rng, 0.08));
  }
  return mergeGeometries(parts, false);
}

// --- petits éléments du sol (dessinés seulement près du héros)
// touffe de fleurs : tiges fines et corolles colorées
function flowers(seed, colors) {
  const rng = mulberry32(seed), parts = [];
  for (let i = 0; i < 9; i++) {
    const a = rng() * Math.PI * 2, r = rng() * 0.22, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.12 + rng() * 0.16;
    parts.push(painted(new THREE.CylinderGeometry(0.006, 0.008, h, 3).translate(x, h / 2, z), '#4f8f34', rng, 0.08));
    const petal = new THREE.OctahedronGeometry(0.035 + rng() * 0.02, 0); petal.scale(1, 0.55, 1); petal.translate(x, h + 0.01, z);
    parts.push(painted(petal, colors[i % colors.length], rng, 0.1));
  }
  for (let i = 0; i < 4; i++) { const a = rng() * 6.28; parts.push(painted(new THREE.ConeGeometry(0.03, 0.14, 3).translate(Math.cos(a) * 0.15, 0.07, Math.sin(a) * 0.15), '#5aa040', rng, 0.1)); }
  return mergeGeometries(parts, false);
}
// champignons : pied clair et chapeau rouge à pois ou brun
function mushrooms(seed, cap) {
  const rng = mulberry32(seed), parts = [];
  for (let i = 0; i < 3; i++) {
    const x = (rng() - 0.5) * 0.25, z = (rng() - 0.5) * 0.25, h = 0.08 + rng() * 0.1, r = 0.05 + rng() * 0.05;
    parts.push(painted(new THREE.CylinderGeometry(r * 0.35, r * 0.45, h, 5).translate(x, h / 2, z), '#efe6cf', rng, 0.05));
    parts.push(painted(new THREE.SphereGeometry(r, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, h, z), cap, rng, 0.08));
  }
  return mergeGeometries(parts, false);
}
// souche coupée
function stump(seed) {
  const rng = mulberry32(seed), parts = [];
  parts.push(painted(new THREE.CylinderGeometry(0.22, 0.28, 0.32, 8).translate(0, 0.16, 0), '#6d4b30', rng, 0.08, { top: '#c9a06a', topMin: 0.9 }));
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + rng(); parts.push(painted(limb(V(Math.cos(a) * 0.2, 0.05, Math.sin(a) * 0.2), V(Math.cos(a) * 0.42, -0.02, Math.sin(a) * 0.42), 0.07, 0.03, 5), '#5e402a', rng, 0.08)); }
  return mergeGeometries(parts, false);
}
// tronc couché, moussu
function log(seed) {
  const rng = mulberry32(seed), parts = [];
  const g = new THREE.CylinderGeometry(0.16, 0.19, 1.6, 7); g.rotateZ(Math.PI / 2); g.translate(0, 0.16, 0);
  parts.push(painted(g, '#6a4a30', rng, 0.08, { top: '#5f8f3a', topMin: 0.55 }));
  parts.push(painted(limb(V(0.3, 0.2, 0), V(0.45, 0.5, 0.15), 0.05, 0.02, 4), '#5e402a', rng, 0.08));
  return mergeGeometries(parts, false);
}
// grande touffe d'herbes folles
function tuft(seed, color) {
  const rng = mulberry32(seed), parts = [];
  for (let i = 0; i < 11; i++) {
    const a = rng() * 6.28, r = rng() * 0.12, h = 0.25 + rng() * 0.3;
    const blade = new THREE.ConeGeometry(0.025, h, 3); blade.translate(0, h / 2, 0);
    blade.rotateX((rng() - 0.5) * 0.5); blade.rotateZ((rng() - 0.5) * 0.5); blade.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
    parts.push(painted(blade, color, rng, 0.12, { top: '#c9d66a', topMin: 0.2 }));
  }
  return mergeGeometries(parts, false);
}

// Enregistre les modèles comme props instanciables (noms « pt_… »).
export function registerProcTrees(assets) {
  if (assets.geoCache.has('pt_oak_A')) return;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true });
  const add = (name, geometry) => {
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    assets.geoCache.set(name, { geometry, material: mat, box: geometry.boundingBox });
  };
  add('pt_oak_A', oak(101));
  add('pt_oak_B', oak(202, { leaves: ['#5aa040', '#6cb848', '#4a9238'], size: 1.08 }));
  add('pt_oak_autumn', oak(303, { leaves: ['#d9772e', '#e8a03a', '#c25a26'] }));
  add('pt_oak_gold', oak(404, { leaves: ['#d8b23a', '#e6c64a', '#c9982e'] }));
  add('pt_birch_A', birch(505));
  add('pt_birch_B', birch(606));
  add('pt_pine_A', pine(707));
  add('pt_pine_B', pine(808, { tall: 1.25 }));
  add('pt_pine_snow_A', pine(909, { snow: true }));
  add('pt_pine_snow_B', pine(1010, { snow: true, tall: 1.25 }));
  add('pt_willow', willow(1111));
  add('pt_acacia_A', acacia(1212));
  add('pt_acacia_B', acacia(1313));
  add('pt_bush_rose', bush(1414, '#ff8fb8'));
  add('pt_bush_yellow', bush(1515, '#ffe066'));
  add('pt_bush', bush(1616, null));
  add('pt_flowers_A', flowers(1717, ['#ffe066', '#ffffff', '#ffd23a']));
  add('pt_flowers_B', flowers(1818, ['#ff8fb8', '#d27aff', '#ffffff']));
  add('pt_flowers_C', flowers(1919, ['#7fb8ff', '#b0d4ff', '#ffffff']));
  add('pt_flowers_D', flowers(2020, ['#ff6a3a', '#ffb347', '#ffe066']));
  add('pt_mushroom_red', mushrooms(2121, '#d93a2a'));
  add('pt_mushroom_brown', mushrooms(2222, '#9a6a3c'));
  add('pt_stump', stump(2323));
  add('pt_log', log(2424));
  add('pt_tuft', tuft(2525, '#6aa646'));
  add('pt_tuft_dry', tuft(2626, '#b9a75a'));
  return mat;
}
