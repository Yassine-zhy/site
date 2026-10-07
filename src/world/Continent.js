import * as THREE from 'three';
import { Simplex, smoothstep, lerp, clamp, distToSegment } from '../engine/math.js';
import {
  WORLD_SEED, WORLD_HALF, LANDMASS, VILLAGE, HAMLET, LAKE, HILLS, FOREST, RUINS, MOUNTAIN, REGIONS, PATHS, ZONES,
} from '../config.js';

// Le continent d'Aetheria : relief, couleurs et matières du sol, calculés point par point.
// Ces fonctions servent à cuire la carte de hauteur (tools/bake-terrain.mjs) ; le jeu ne lit
// ensuite que les tableaux pré-calculés.
//
//   hauteur   : base de chaque région mêlée en douceur, puis les reliefs (pics, plateaux, lacs…),
//               les routes, et enfin le littoral (plages, falaises, fonds marins).
//   couleur   : palette du biome dominant + routes, plages, roche des pentes, neige des cimes.
//   matières  : herbe, terre, roche, sable, neige (pour les textures de détail du rendu).

const N = new Simplex(WORLD_SEED);
const N2 = new Simplex(WORLD_SEED + 99);
const NC = new Simplex(WORLD_SEED + 7);

// ------------------------------------------------------------------ routes
// Index spatial des segments : la distance n'est exacte que jusqu'à ROAD_REACH unités.
const ROAD_REACH = 40, CELL = 64;
const SEGS = [];
for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) SEGS.push([p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]]);
const GRID = new Map();
for (let s = 0; s < SEGS.length; s++) {
  const [ax, az, bx, bz] = SEGS[s];
  const x0 = Math.floor((Math.min(ax, bx) - ROAD_REACH) / CELL), x1 = Math.floor((Math.max(ax, bx) + ROAD_REACH) / CELL);
  const z0 = Math.floor((Math.min(az, bz) - ROAD_REACH) / CELL), z1 = Math.floor((Math.max(az, bz) + ROAD_REACH) / CELL);
  for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
    const k = i * 4096 + j;
    if (!GRID.has(k)) GRID.set(k, []);
    GRID.get(k).push(s);
  }
}

export function pathDistance(x, z) {
  const list = GRID.get(Math.floor(x / CELL) * 4096 + Math.floor(z / CELL));
  let best = ROAD_REACH;
  if (list) for (const s of list) {
    const g = SEGS[s];
    const d = distToSegment(x, z, g[0], g[1], g[2], g[3]);
    if (d < best) best = d;
  }
  // léger méandre
  return best + N.noise2(x * 0.05, z * 0.05) * 1.4;
}

// ------------------------------------------------------------------ littoral
// Distance signée à la côte (positive dans les terres) : union douce des disques du continent,
// déformée par du bruit pour dessiner caps, baies et presqu'îles.
function smax(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; }

export function coastDistance(x, z) {
  const wx = x + NC.fbm2(x / 520, z / 520, 3) * 140, wz = z + NC.fbm2(x / 520 + 31.7, z / 520 - 17.3, 3) * 140;
  let d = -1e9;
  for (const L of LANDMASS) d = smax(d, L.r - Math.hypot(wx - L.x, wz - L.z), 150);
  // caps et criques : bruit plus marqué loin du cœur (les zones de départ restent sûres)
  const far = smoothstep(500, 900, Math.hypot(x, z));
  return d + NC.fbm2(x / 190, z / 190, 4) * (28 + far * 16) + N.noise2(x / 48, z / 48) * 6;
}

// côte à falaises (0 = plage douce, 1 = falaise)
function cliffAt(x, z) {
  let s = 0, w = 0;
  for (const L of LANDMASS) {
    const k = Math.max(0, 1.3 - Math.hypot(x - L.x, z - L.z) / L.r);
    const kk = k * k * k + 1e-6;
    s += L.cliff * kk; w += kk;
  }
  return clamp(s / w + N2.noise2(x / 130, z / 130) * 0.3, 0, 1);
}

// ------------------------------------------------------------------ régions
const CORE = { id: 'core', name: 'Cœur d’Aetheria', biome: 'temperate', x: 0, z: 0, radius: 660 };
const SOURCES = [CORE, ...REGIONS].map((def) => ({
  def, biome: def.biome, x: def.x, z: def.z, r: def.radius,
  nz: new Simplex(def.seed ?? WORLD_SEED), nz2: new Simplex((def.seed ?? WORLD_SEED) + 7), nc: new Simplex((def.seed ?? WORLD_SEED) + 3),
}));

// définitions des régions, dans l'ordre des indices de la carte des biomes
export const REGION_DEFS = SOURCES.map((s) => s.def);

// poids de chaque région (lisses pour le relief, plus francs pour les couleurs)
const _w = new Float32Array(SOURCES.length);
function regionWeights(x, z, sharp) {
  // frontières sinueuses : coordonnées déformées + bruit propre à chaque région
  const wx = x + N2.fbm2(x / 300, z / 300, 3) * 170, wz = z + N2.fbm2(x / 300 - 13.1, z / 300 + 7.7, 3) * 170;
  let sum = 0;
  for (let i = 0; i < SOURCES.length; i++) {
    const s = SOURCES[i];
    const d = Math.hypot(wx - s.x, wz - s.z) / s.r + s.nc.fbm2(x / 120, z / 120, 3) * 0.24;
    let w = Math.max(0, 1 - d / 1.3);
    w = sharp ? Math.pow(w, 5) : w * w * w;
    _w[i] = w; sum += w;
  }
  if (sum < 1e-9) { _w.fill(0); _w[0] = 1; return _w; }
  for (let i = 0; i < SOURCES.length; i++) _w[i] /= sum;
  return _w;
}

const BASE = {
  temperate: [9, 2.2], snow: [9, 2.2], jungle: [8, 1.8], haunted: [6, 1.4], amber: [5, 1.4],
  highland: [8, 1.6], beach: [3, 0.8], swamp: [1.2, 0.5], cliffs: [9, 2],
};

function baseHeight(s, x, z) {
  const { nz, nz2, biome } = s;
  if (biome === 'temperate') return 11 + N.fbm2(x / 260, z / 260, 4) * 9 + N.fbm2(x / 60, z / 60, 3) * 2.2 + N.fbm2(x / 22, z / 22, 2) * 0.6;
  const [big, fine] = BASE[biome];
  let h = s.def.baseY + nz.fbm2(x / 160, z / 160, 4) * big + nz.fbm2(x / 40, z / 40, 3) * fine;
  if (biome === 'amber') h += Math.max(0, nz2.noise2(x / 22, z / 60)) * 1.6; // dunes allongées
  else if (biome === 'jungle') h += Math.pow(Math.max(0, nz2.ridge2(x / 70, z / 70, 3) - 0.35), 1.5) * 18; // collines arrondies
  else if (biome === 'haunted') h += nz2.fbm2(x / 55, z / 55, 3) * 3 - Math.max(0, nz2.noise2(x / 90, z / 90)) * 3; // landes bosselées
  else if (biome === 'highland') h += Math.pow(Math.max(0, nz2.ridge2(x / 90, z / 90, 3) - 0.55), 1.3) * 26; // chaos rocheux
  else if (biome === 'beach') h += Math.max(0, nz2.noise2(x / 30, z / 30)) * 1.2;
  else if (biome === 'swamp') h += Math.max(0, nz2.noise2(x / 14, z / 14)) * 0.8 - Math.max(0, nz2.noise2(x / 40 + 9, z / 40)) * 1.6;
  else if (biome === 'cliffs') h += Math.round(nz2.ridge2(x / 80, z / 80, 3) * 4) * 3 * smoothstep(0.3, 0.7, nz.noise2(x / 200, z / 200) * 0.5 + 0.5); // terrasses
  return h;
}

function polyDist(x, z, pts) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, distToSegment(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return best;
}

// étendue d'influence d'un relief (rejet rapide)
for (const s of SOURCES) for (const f of s.def.features || []) {
  if (f.type === 'canyon') {
    const xs = f.pts.map((p) => p[0]), zs = f.pts.map((p) => p[1]);
    f.bx = (Math.min(...xs) + Math.max(...xs)) / 2; f.bz = (Math.min(...zs) + Math.max(...zs)) / 2;
    f.br = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2 + f.width * 2;
  } else { f.bx = f.x; f.bz = f.z; f.br = f.radius * (f.type === 'mesa' ? 3.6 : f.type === 'basin' ? 1.9 : 1.4) + 24; }
}

function applyFeatures(s, x, z, h, state) {
  const { nz, nz2, biome } = s;
  for (const f of s.def.features || []) {
    if (Math.abs(x - f.bx) > f.br || Math.abs(z - f.bz) > f.br) continue;
    if (f.type === 'canyon') {
      const d = polyDist(x, z, f.pts) + nz.noise2(x / 15, z / 15) * 2.5;
      h -= f.depth * (1 - smoothstep(f.width * 0.35, f.width, d));
      continue;
    }
    const d = Math.hypot(x - f.x, z - f.z);
    if (f.type === 'peak') {
      const mt = 1 - smoothstep(0, f.radius, d);
      if (mt <= 0) continue;
      state.peak = Math.max(state.peak, mt);
      h += f.height * Math.pow(mt, 1.25) + nz2.ridge2(x / 34, z / 34, 4) * 13 * mt;
      if (f.summitHeight) h = lerp(h, f.summitHeight, 1 - smoothstep(f.summitRadius * 0.6, f.summitRadius * 1.35, d));
    } else if (f.type === 'plateau') {
      h = lerp(h, f.height + nz.noise2(x / 20, z / 20) * 0.3, 1 - smoothstep(f.radius * 0.75, f.radius + 20, d));
    } else if (f.type === 'basin') {
      if (f.wall) {
        // arène : fond plat entouré d'un rempart rocheux (ouvert vers f.gate, l'ouest par défaut)
        const a = Math.atan2(z - f.z, x - f.x), ga = f.gate ?? Math.PI;
        const gate = 1 - smoothstep(0.25, 0.55, Math.abs(Math.atan2(Math.sin(a - ga), Math.cos(a - ga))));
        const rim = (1 - smoothstep(f.radius * 0.9, f.radius * 1.5, d)) * smoothstep(f.radius * 0.75, f.radius * 1.05, d) * f.wall * (1 - gate);
        h = lerp(h, f.level, 1 - smoothstep(f.radius * 0.8, f.radius * 1.3, d)) + rim;
      } else {
        const dl = d + nz.noise2(x / 18, z / 18) * 5;
        if (biome === 'snow' && dl < f.radius * 1.6) { h = lerp(h, f.level, 1 - smoothstep(f.radius, f.radius * 1.6, dl)); continue; } // lac gelé
        if ((biome === 'haunted' || biome === 'swamp') && dl < f.radius * 1.8) { // marais
          h = lerp(h, f.level - 0.6 + nz2.noise2(x / 9, z / 9) * 0.9, 1 - smoothstep(f.radius * 0.8, f.radius * 1.8, dl));
          continue;
        }
        if (dl < f.radius * 1.6) {
          const shore = f.level + 0.8;
          h = lerp(h, Math.max(shore, Math.min(h, shore + (dl - f.radius) * 0.35)), 1 - smoothstep(f.radius, f.radius * 1.6, dl));
          if (dl < f.radius) h = lerp(f.level - 3.5 + (dl / f.radius) * 2.5, shore, smoothstep(f.radius * 0.75, f.radius, dl));
        }
      }
    } else if (f.type === 'mesa') {
      // plateau à falaises franches, une rampe douce dans la direction rampAngle
      const a = Math.atan2(z - f.z, x - f.x);
      const da = Math.abs(Math.atan2(Math.sin(a - f.rampAngle), Math.cos(a - f.rampAngle)));
      const ramp = 1 - smoothstep(0.18, 0.4, da);
      const edge = f.radius * (1 + ramp * 1.4);
      const t = 1 - smoothstep(f.radius * 0.9, edge + 3 + ramp * 10, d);
      const top = f.height + nz.noise2(x / 14, z / 14) * 0.6;
      h = Math.max(h, lerp(h, top, ramp > 0.01 ? t : Math.pow(t, 0.35)));
    }
  }
  return h;
}

// reliefs du cœur : Collines Ambrées, Bois-Murmure, Pic du Silence, Cendres, Lac Miroir, Prés-Bas, Havrelumière
function coreFeatures(x, z, h, state) {
  const dh = Math.hypot(x - HILLS.x, z - HILLS.z);
  if (dh < HILLS.radius * 1.2) h += (1 - smoothstep(0, HILLS.radius * 1.2, dh)) * (N2.ridge2(x / 55, z / 55, 3) * 16 - 4);
  const df = Math.hypot(x - FOREST.x, z - FOREST.z);
  if (df < FOREST.radius) h += (1 - smoothstep(0, FOREST.radius, df)) * N2.fbm2(x / 30, z / 30, 3) * 3.5;
  const dm = Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z);
  const mt = 1 - smoothstep(0, MOUNTAIN.radius, dm);
  if (mt > 0) {
    state.peak = Math.max(state.peak, mt);
    h += (MOUNTAIN.peak - 11) * Math.pow(mt, 1.25) + N2.ridge2(x / 38, z / 38, 4) * 14 * mt;
    // plateau sommital pour l'arène du boss
    h = lerp(h, MOUNTAIN.summitHeight, 1 - smoothstep(MOUNTAIN.summitRadius * 0.6, MOUNTAIN.summitRadius * 1.35, dm));
  }
  const dr = Math.hypot(x - RUINS.x, z - RUINS.z);
  if (dr < RUINS.radius) h = lerp(h, RUINS.height + N.fbm2(x / 20, z / 20, 2) * 0.8, 1 - smoothstep(RUINS.radius * 0.55, RUINS.radius, dr));
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z) + N.noise2(x / 18, z / 18) * 5;
  if (dl < LAKE.radius * 1.6) {
    const shore = LAKE.level + 0.8;
    h = lerp(h, Math.max(shore, Math.min(h, shore + (dl - LAKE.radius) * 0.35)), 1 - smoothstep(LAKE.radius, LAKE.radius * 1.6, dl));
    const bed = LAKE.level - 4.5 + (dl / LAKE.radius) * 3;
    if (dl < LAKE.radius) h = lerp(bed, shore, smoothstep(LAKE.radius * 0.75, LAKE.radius, dl));
  }
  const dhm = Math.hypot(x - HAMLET.x, z - HAMLET.z);
  if (dhm < HAMLET.radius + 30) h = lerp(h, HAMLET.height + N.noise2(x / 25, z / 25) * 0.25, 1 - smoothstep(HAMLET.radius * 0.8, HAMLET.radius + 28, dhm));
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  if (dv < VILLAGE.radius + 26) h = lerp(h, VILLAGE.height + N.noise2(x / 25, z / 25) * 0.25, 1 - smoothstep(VILLAGE.radius * 0.8, VILLAGE.radius + 26, dv));
  return h;
}

// Hauteur du continent (avant le littoral). state.peak : 0..1 sur les montagnes.
function landHeight(x, z, state) {
  const w = regionWeights(x, z, false);
  let h = 0;
  for (let i = 0; i < SOURCES.length; i++) if (w[i] > 1e-4) h += w[i] * baseHeight(SOURCES[i], x, z);
  h = coreFeatures(x, z, h, state);
  for (let i = 1; i < SOURCES.length; i++) h = applyFeatures(SOURCES[i], x, z, h, state);
  // routes : légèrement creusées et adoucies
  const pd = pathDistance(x, z);
  if (pd < 6 && state.peak < 0.35) h -= 0.3 * (1 - smoothstep(2, 6, pd));
  return h;
}

const _st = { peak: 0, sd: 0, cliff: 0 };
// Hauteur finale (avec plages, falaises et fonds marins). Renseigne _st.sd (distance à la côte).
export function continentHeight(x, z, st = _st) {
  st.peak = 0;
  const sd = coastDistance(x, z);
  st.sd = sd;
  if (sd < -260) { st.cliff = 0; return -38 + N.noise2(x / 90, z / 90) * 3; }
  const cl = cliffAt(x, z);
  st.cliff = cl;
  if (sd <= 0) {
    // fonds : plateau sableux qui plonge, plus vite au pied des falaises
    const h = 0.6 + sd * lerp(0.075, 0.32, cl) + N.noise2(x / 30, z / 30) * 0.4 * smoothstep(-6, -30, sd);
    return Math.max(h, -38 + N.noise2(x / 90, z / 90) * 3);
  }
  const land = landHeight(x, z, st);
  const W = lerp(70, 9, cl);
  const t = smoothstep(0, W, sd);
  const beach = 0.6 + Math.min(sd, W) * 0.035;
  return lerp(beach, Math.max(land, beach + 0.2), cl > 0.5 ? Math.pow(t, 0.6) : t);
}

// ------------------------------------------------------------------ couleurs et matières
const col = (h) => new THREE.Color(h);
const C = {
  // tempéré (cœur)
  grass1: col('#6fb24a'), grass2: col('#8cc152'), grass3: col('#a9c45a'), forest: col('#4c8a3a'), forest2: col('#3f7a37'),
  amber: col('#c9b15a'), amber2: col('#d6a855'), dirt: col('#b98a5a'), dirt2: col('#a87a4c'), rock: col('#8d867c'), rock2: col('#6f6a64'),
  snow: col('#eef3f6'), sand: col('#e2cf98'), wetsand: col('#c4ad78'), bed: col('#5e8f7c'), ash: col('#9d8f7e'), plaza: col('#c7b08a'),
  sea1: col('#d9c58f'), sea2: col('#5f8a78'), sea3: col('#2f5560'),
  // givre
  snowA: col('#eef4fa'), snowB: col('#d7e3ef'), frost: col('#a9bfae'), ice: col('#9fd6ea'), srock: col('#7d8693'), srock2: col('#5f6774'), spath: col('#c3cdd8'), camp: col('#b9aea0'),
  // ambre
  gold: col('#d4a63a'), ochre: col('#e3b84a'), earth: col('#cf7a2c'), sandy: col('#ecc985'), red1: col('#b4451f'), red2: col('#e08a3c'), apath: col('#e2b670'), sage: col('#9aa04a'),
  // jungle
  jg1: col('#2f8f3a'), jg2: col('#4fae3e'), jg3: col('#7cc04a'), jmoss: col('#2a6b3a'), jpath: col('#b08a56'), jrock: col('#5e7a64'),
  // landes hantées
  hg1: col('#5a5a46'), hg2: col('#6b6a4e'), heath: col('#6e4f78'), hdead: col('#8a7a5a'), hpath: col('#7d7262'), hrock: col('#5a5566'), hmud: col('#3f4a3a'), hgrave: col('#4a4a3c'), hsand: col('#8f8a7a'),
  // hauts-plateaux
  hl1: col('#9fae58'), hl2: col('#b9b466'), hl3: col('#7f9a4a'), hlrock: col('#8f8a82'), hlheath: col('#9a7f8f'),
  // côte des récifs
  bc1: col('#78c25a'), bc2: col('#a2d46a'), bsand: col('#f0dea6'), coral: col('#e9a08a'),
  // marais
  sw1: col('#566f3e'), sw2: col('#6c7b44'), swmud: col('#4b4633'), swreed: col('#8a8a4a'),
  // falaises
  cf1: col('#7f945c'), cf2: col('#93a468'), cfheath: col('#8b78a6'), chalk: col('#ddd6c4'), cfrock: col('#9a958a'),
};
const tA = new THREE.Color(), tB = new THREE.Color(), tC = new THREE.Color();

// matières : [herbe, terre, roche, sable, neige]
const M = new Float32Array(5);
function matSet(g, d, r, s, n) { M[0] = g; M[1] = d; M[2] = r; M[3] = s; M[4] = n; }
function matTo(k, t) { if (t <= 0) return; t = Math.min(1, t); for (let i = 0; i < 5; i++) M[i] *= 1 - t; M[k] += t; }

// couleur et matières propres à un biome (sans littoral ni routes)
function biomeSurface(s, out, x, y, z, slope) {
  const def = s.def, nc = s.nc;
  const n = nc.noise2(x / 14, z / 14) * 0.5 + 0.5, n2 = nc.noise2(x / 5, z / 5) * 0.5 + 0.5;
  switch (s.biome) {
    case 'temperate': {
      const m = N.noise2(x / 14, z / 14) * 0.5 + 0.5, m2 = N2.noise2(x / 5, z / 5) * 0.5 + 0.5;
      out.copy(C.grass1).lerp(C.grass2, m);
      if (m2 > 0.72) out.lerp(C.grass3, (m2 - 0.72) * 2.4);
      matSet(1, 0, 0, 0, 0);
      const ft = 1 - smoothstep(FOREST.radius * 0.5, FOREST.radius * 1.05, Math.hypot(x - FOREST.x, z - FOREST.z));
      if (ft > 0) { out.lerp(tA.copy(C.forest).lerp(C.forest2, m2), ft * 0.85); matTo(1, ft * 0.25 * m2); }
      const ht = 1 - smoothstep(HILLS.radius * 0.3, HILLS.radius * 1.1, Math.hypot(x - HILLS.x, z - HILLS.z));
      if (ht > 0) out.lerp(tA.copy(C.amber).lerp(C.amber2, m), ht * 0.55 * (0.6 + m2 * 0.4));
      const rt = 1 - smoothstep(RUINS.radius * 0.4, RUINS.radius * 1.1, Math.hypot(x - RUINS.x, z - RUINS.z));
      if (rt > 0) { out.lerp(C.ash, rt * 0.55 * (0.5 + m * 0.5)); matTo(1, rt * 0.45); }
      const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
      if (dv < 18) { const t = (1 - smoothstep(12, 18, dv)) * 0.9; out.lerp(C.plaza, t); matTo(1, t); }
      const dhm = Math.hypot(x - HAMLET.x, z - HAMLET.z);
      if (dhm < 12) { const t = (1 - smoothstep(7, 12, dhm)) * 0.8; out.lerp(C.plaza, t); matTo(1, t); }
      const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
      if (y < LAKE.level + 1.4 && dl < LAKE.radius * 1.7) { out.lerp(y < LAKE.level - 0.3 ? C.bed : C.sand, 0.9); matTo(3, 0.9); }
      const rk = clamp(smoothstep(0.42, 0.62, slope) + smoothstep(48, 64, y) * 0.6, 0, 1);
      if (rk > 0) { out.lerp(tB.copy(C.rock).lerp(C.rock2, m2), rk); matTo(2, rk); }
      if (y > 80) { const t = smoothstep(80, 90, y) * (1 - smoothstep(0.55, 0.75, slope)); out.lerp(C.snow, t); matTo(4, t); }
      return;
    }
    case 'snow': {
      out.copy(C.snowA).lerp(C.snowB, n * 0.7);
      matSet(0, 0, 0, 0, 1);
      const low = 1 - smoothstep(def.baseY + 1, def.baseY + 9, y);
      if (low > 0 && n2 > 0.55) { const t = low * (n2 - 0.55) * 1.6; out.lerp(C.frost, t); matTo(0, t); }
      const camp = def.camp;
      if (camp) { const dc = Math.hypot(x - camp.x, z - camp.z); if (dc < camp.radius * 0.8) { const t = 0.55 * (1 - smoothstep(camp.radius * 0.5, camp.radius * 0.8, dc)); out.lerp(C.camp, t); matTo(1, t); } }
      const lake = def.lake;
      if (lake && y < lake.level + 0.4 && Math.hypot(x - lake.x, z - lake.z) < lake.radius * 1.5) { out.lerp(C.ice, 0.85); matTo(3, 0.6); }
      const rk = smoothstep(0.42, 0.62, slope);
      if (rk > 0) { out.lerp(tB.copy(C.srock).lerp(C.srock2, n2), rk); matTo(2, rk); }
      return;
    }
    case 'amber': {
      out.copy(C.gold).lerp(C.ochre, n);
      matSet(0.45, 0.45, 0, 0.1, 0);
      if (n2 > 0.7) { out.lerp(C.sage, (n2 - 0.7) * 1.8); matTo(0, (n2 - 0.7) * 1.8); }
      const bare = smoothstep(0.35, 0.7, nc.noise2(x / 40, z / 40) * 0.5 + 0.5);
      out.lerp(C.earth, bare * 0.45); matTo(1, bare * 0.5);
      const rk = smoothstep(0.38, 0.6, slope);
      if (rk > 0) { out.lerp(tB.copy(C.red1).lerp(C.red2, 0.5 + 0.5 * Math.sin(y * 0.9 + n * 2)), rk); matTo(2, rk); }
      if (y < def.baseY - 4) { out.lerp(C.sandy, 0.6 * (1 - rk)); matTo(3, 0.6 * (1 - rk)); } // fond de gorge sableux
      if (def.camp && Math.hypot(x - def.camp.x, z - def.camp.z) < def.camp.radius * 0.8) { out.lerp(C.sandy, 0.5); matTo(1, 0.5); }
      return;
    }
    case 'jungle': {
      out.copy(C.jg1).lerp(C.jg2, n);
      matSet(1, 0, 0, 0, 0);
      if (n2 > 0.62) out.lerp(C.jg3, (n2 - 0.62) * 1.6);
      out.lerp(C.jmoss, smoothstep(0.4, 0.8, nc.noise2(x / 45, z / 45) * 0.5 + 0.5) * 0.5);
      const lake = def.lake;
      if (lake && y < lake.level + 1.2 && Math.hypot(x - lake.x, z - lake.z) < lake.radius * 1.7) { out.lerp(C.sand, 0.75); matTo(3, 0.75); }
      if (def.camp && Math.hypot(x - def.camp.x, z - def.camp.z) < def.camp.radius * 0.8) { out.lerp(C.jpath, 0.45); matTo(1, 0.45); }
      const rk = smoothstep(0.42, 0.62, slope);
      if (rk > 0) { out.lerp(C.jrock, rk); matTo(2, rk); }
      return;
    }
    case 'haunted': {
      out.copy(C.hg1).lerp(C.hg2, n);
      matSet(0.8, 0.2, 0, 0, 0);
      const heath = smoothstep(0.45, 0.75, nc.noise2(x / 38, z / 38) * 0.5 + 0.5);
      out.lerp(C.heath, heath * 0.55);
      if (n2 > 0.7) out.lerp(C.hdead, (n2 - 0.7) * 2);
      if (def.cemetery && Math.hypot(x - def.cemetery.x, z - def.cemetery.z) < def.cemetery.radius) { out.lerp(C.hgrave, 0.5); matTo(1, 0.4); }
      const lake = def.lake;
      if (lake) { const d = Math.hypot(x - lake.x, z - lake.z); if (d < lake.radius * 1.9) { const t = 0.7 * (1 - smoothstep(lake.radius, lake.radius * 1.9, d)); out.lerp(C.hmud, t); matTo(1, t); } }
      const rk = smoothstep(0.42, 0.62, slope);
      if (rk > 0) { out.lerp(C.hrock, rk); matTo(2, rk); }
      return;
    }
    case 'highland': {
      out.copy(C.hl1).lerp(C.hl2, n);
      matSet(1, 0, 0, 0, 0);
      if (n2 > 0.6) out.lerp(C.hl3, (n2 - 0.6) * 1.5);
      const heath = smoothstep(0.55, 0.8, nc.noise2(x / 50, z / 50) * 0.5 + 0.5);
      out.lerp(C.hlheath, heath * 0.4);
      const rk = clamp(smoothstep(0.36, 0.56, slope) + smoothstep(0.62, 0.8, nc.noise2(x / 24, z / 24) * 0.5 + 0.5) * 0.5, 0, 1);
      if (rk > 0) { out.lerp(C.hlrock, rk); matTo(2, rk); }
      return;
    }
    case 'beach': {
      out.copy(C.bc1).lerp(C.bc2, n);
      matSet(1, 0, 0, 0, 0);
      const sandy = smoothstep(0.5, 0.8, nc.noise2(x / 34, z / 34) * 0.5 + 0.5) * 0.6;
      out.lerp(C.bsand, sandy); matTo(3, sandy);
      const lake = def.lake;
      if (lake && y < lake.level + 1.4 && Math.hypot(x - lake.x, z - lake.z) < lake.radius * 1.8) { out.lerp(C.bsand, 0.9); matTo(3, 0.9); }
      const rk = smoothstep(0.42, 0.62, slope);
      if (rk > 0) { out.lerp(C.rock, rk); matTo(2, rk); }
      return;
    }
    case 'swamp': {
      out.copy(C.sw1).lerp(C.sw2, n);
      matSet(0.8, 0.2, 0, 0, 0);
      const mud = smoothstep(0.5, 0.75, nc.noise2(x / 22, z / 22) * 0.5 + 0.5);
      out.lerp(C.swmud, mud * 0.7); matTo(1, mud * 0.7);
      if (n2 > 0.7) out.lerp(C.swreed, (n2 - 0.7) * 2);
      const lake = def.lake;
      if (lake) { const d = Math.hypot(x - lake.x, z - lake.z); if (d < lake.radius * 1.9) { const t = 0.75 * (1 - smoothstep(lake.radius, lake.radius * 1.9, d)); out.lerp(C.swmud, t); matTo(1, t); } }
      const rk = smoothstep(0.45, 0.65, slope);
      if (rk > 0) { out.lerp(C.rock2, rk); matTo(2, rk); }
      return;
    }
    case 'cliffs': {
      out.copy(C.cf1).lerp(C.cf2, n);
      matSet(1, 0, 0, 0, 0);
      const heath = smoothstep(0.45, 0.75, nc.noise2(x / 40, z / 40) * 0.5 + 0.5);
      out.lerp(C.cfheath, heath * 0.5);
      const rk = smoothstep(0.38, 0.58, slope);
      if (rk > 0) { out.lerp(C.cfrock, rk); matTo(2, rk); }
      if (y > 60) { const t = smoothstep(60, 74, y) * (1 - smoothstep(0.5, 0.7, slope)) * 0.7; out.lerp(C.snow, t); matTo(4, t); }
      return;
    }
    default: out.copy(C.grass1); matSet(1, 0, 0, 0, 0);
  }
}

// teintes de route et de plage selon le biome
const ROAD = { temperate: 'dirt', snow: 'spath', amber: 'apath', jungle: 'jpath', haunted: 'hpath', highland: 'dirt', beach: 'jpath', swamp: 'hpath', cliffs: 'dirt' };
const SHORE = { snow: 'srock', haunted: 'hsand', swamp: 'swmud', cliffs: 'sand', amber: 'sandy', beach: 'bsand' };

const _acc = new THREE.Color();
const _macc = new Float32Array(5);
// Couleur (linéaire) et matières du sol. sd : distance à la côte, cl : falaise (0..1).
export function surfaceAt(out, mats, x, y, z, slope, sd, cl) {
  const w = regionWeights(x, z, true);
  _acc.setRGB(0, 0, 0); _macc.fill(0);
  let dom = 0;
  for (let i = 0; i < SOURCES.length; i++) {
    if (w[i] < 0.01) continue;
    if (w[i] > w[dom]) dom = i;
    biomeSurface(SOURCES[i], tC, x, y, z, slope);
    _acc.r += tC.r * w[i]; _acc.g += tC.g * w[i]; _acc.b += tC.b * w[i];
    for (let k = 0; k < 5; k++) _macc[k] += M[k] * w[i];
  }
  let ws = 0;
  for (let i = 0; i < SOURCES.length; i++) if (w[i] >= 0.01) ws += w[i];
  out.setRGB(_acc.r / ws, _acc.g / ws, _acc.b / ws);
  for (let k = 0; k < 5; k++) M[k] = _macc[k] / ws;
  const biome = SOURCES[dom].biome;
  const n2 = N2.noise2(x / 5, z / 5) * 0.5 + 0.5;
  // routes
  const pd = pathDistance(x, z);
  const pt = 1 - smoothstep(1.6, 3.7, pd);
  if (pt > 0) { out.lerp(tA.copy(C[ROAD[biome]]).lerp(C.dirt2, n2 * 0.4), pt * 0.88); matTo(1, pt * 0.9); }
  // plages et falaises du littoral
  if (sd < 40 && y < 3.2 && sd > -2) {
    const t = (1 - smoothstep(1.4, 3.2, y)) * (1 - cl * 0.6);
    const sc = C[SHORE[biome] || 'sand'];
    out.lerp(tA.copy(sc).lerp(C.wetsand, (1 - smoothstep(0.2, 0.9, y)) * 0.5), t); matTo(3, t);
  }
  if (cl > 0.5 && sd < 22 && sd > -2) {
    // falaises : roche franche (craie blanche au Couchant)
    const t = smoothstep(0.35, 0.55, slope) * smoothstep(0.5, 0.75, cl);
    out.lerp(biome === 'cliffs' ? C.chalk : biome === 'snow' ? C.srock : C.rock, t); matTo(2, t);
  }
  // fonds marins
  if (y < 0.15) {
    const d = -y;
    out.copy(C.sea1).lerp(C.sea2, smoothstep(0.5, 6, d)).lerp(C.sea3, smoothstep(6, 26, d));
    matSet(0, 0, 0.1, 0.9, 0);
  }
  mats[0] = M[0]; mats[1] = M[1]; mats[2] = M[2]; mats[3] = M[3]; mats[4] = M[4];
  return out;
}

// ------------------------------------------------------------------ zones
export function zoneAt(x, z) {
  let best = null, bd = 1e9;
  for (const zn of ZONES) {
    const d = Math.hypot(x - zn.x, z - zn.z) / zn.r;
    if (d < bd) { bd = d; best = zn; }
  }
  return bd < 1.25 ? best : null;
}

// ------------------------------------------------------------------ cuisson
// Grille de hauteurs : RES × RES échantillons sur [-WORLD_HALF, WORLD_HALF] (aux sommets),
// couleurs et matières : CRES × CRES texels (aux centres).
export const RES = 2049, CRES = 1024, BRES = 512;
export const BAKE_VERSION = 7;

export function continentSignature() {
  const str = JSON.stringify({ BAKE_VERSION, WORLD_SEED, WORLD_HALF, LANDMASS, VILLAGE, HAMLET, LAKE, HILLS, FOREST, RUINS, MOUNTAIN, REGIONS, PATHS, RES, CRES, BRES });
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16);
}

// hauteurs (entiers 16 bits, 1/50 d'unité)
export function bakeHeights(onRow) {
  const h = new Int16Array(RES * RES), T = (WORLD_HALF * 2) / (RES - 1);
  for (let j = 0; j < RES; j++) {
    const z = -WORLD_HALF + j * T;
    for (let i = 0; i < RES; i++) h[j * RES + i] = Math.round(clamp(continentHeight(-WORLD_HALF + i * T, z), -600, 600) * 50);
    onRow?.(j);
  }
  return h;
}

function enc(v) { v = clamp(v, 0, 1); return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255); }

// couleurs sRGB (A = profondeur d'eau de mer) et matières (R herbe, G roche, B sable, A neige ; terre = reste)
export function bakeSurface(h, onRow) {
  const color = new Uint8Array(CRES * CRES * 4), mats = new Uint8Array(CRES * CRES * 4);
  const T = (WORLD_HALF * 2) / (RES - 1), S = (WORLD_HALF * 2) / CRES;
  const H = (x, z) => sampleHeights(h, x, z);
  const out = new THREE.Color(), m = new Float32Array(5);
  for (let j = 0; j < CRES; j++) {
    const z = -WORLD_HALF + (j + 0.5) * S;
    for (let i = 0; i < CRES; i++) {
      const x = -WORLD_HALF + (i + 0.5) * S;
      const y = H(x, z);
      const gx = (H(x + T, z) - H(x - T, z)) / (2 * T), gz = (H(x, z + T) - H(x, z - T)) / (2 * T);
      const slope = Math.atan(Math.hypot(gx, gz)) / (Math.PI / 2);
      const sd = coastDistance(x, z);
      const cl = sd > -40 && sd < 60 ? cliffAt(x, z) : 0;
      surfaceAt(out, m, x, y, z, slope, sd, cl);
      const k = (j * CRES + i) * 4;
      color[k] = enc(out.r); color[k + 1] = enc(out.g); color[k + 2] = enc(out.b);
      color[k + 3] = Math.round(clamp(-y / 24, 0, 1) * 255);
      mats[k] = Math.round(m[0] * 255); mats[k + 1] = Math.round(m[2] * 255); mats[k + 2] = Math.round(m[3] * 255); mats[k + 3] = Math.round(m[4] * 255);
    }
    onRow?.(j);
  }
  // région dominante (indice dans REGION_DEFS)
  const biome = new Uint8Array(BRES * BRES), SB = (WORLD_HALF * 2) / BRES;
  for (let j = 0; j < BRES; j++) for (let i = 0; i < BRES; i++) {
    const w = regionWeights(-WORLD_HALF + (i + 0.5) * SB, -WORLD_HALF + (j + 0.5) * SB, true);
    let best = 0;
    for (let k = 1; k < w.length; k++) if (w[k] > w[best]) best = k;
    biome[j * BRES + i] = best;
  }
  return { color, mats, biome };
}

// hauteur interpolée dans la grille (mêmes triangles que le maillage rendu)
export function sampleHeights(h, x, z) {
  const T = (WORLD_HALF * 2) / (RES - 1);
  let fx = (x + WORLD_HALF) / T, fz = (z + WORLD_HALF) / T;
  if (fx < 0 || fz < 0 || fx >= RES - 1 || fz >= RES - 1) { fx = clamp(fx, 0, RES - 1.001); fz = clamp(fz, 0, RES - 1.001); }
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const a = j * RES + i;
  const ha = h[a], hb = h[a + 1], hc = h[a + RES], hd = h[a + RES + 1];
  return (u + v <= 1 ? ha + (hb - ha) * u + (hc - ha) * v : hd + (hc - hd) * (1 - u) + (hb - hd) * (1 - v)) / 50;
}

// Fichiers : terrain-h.bin (hauteurs) et terrain-c.bin (couleurs + matières), en-tête 'AETC'.
export function packBaked(sig, kind, arrays) {
  const head = new TextEncoder().encode(JSON.stringify({ sig, kind, RES, CRES, WORLD_HALF }).padEnd(120, ' '));
  let size = 8 + head.length;
  for (const a of arrays) size += a.byteLength;
  const buf = new Uint8Array(size), dv = new DataView(buf.buffer);
  dv.setUint32(0, 0x43544541, true); dv.setUint32(4, head.length, true);
  buf.set(head, 8);
  let off = 8 + head.length;
  for (const a of arrays) { buf.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), off); off += a.byteLength; }
  return buf;
}

export function unpackBaked(buf) {
  if (!buf) return null;
  const dv = new DataView(buf);
  if (buf.byteLength < 16 || dv.getUint32(0, true) !== 0x43544541) return null;
  const hl = dv.getUint32(4, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)));
  if (head.sig !== continentSignature()) return null;
  const off = 8 + hl;
  if (head.kind === 'h') return { kind: 'h', h: new Int16Array(buf.slice(off, off + RES * RES * 2)) };
  const n = CRES * CRES * 4;
  return { kind: 'c', color: new Uint8Array(buf, off, n), mats: new Uint8Array(buf, off + n, n), biome: new Uint8Array(buf, off + 2 * n, BRES * BRES) };
}
