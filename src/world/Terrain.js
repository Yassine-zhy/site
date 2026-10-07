import * as THREE from 'three';
import { Island, bakeIsland } from './Island.js';
import { Simplex, smoothstep, lerp, clamp, distToSegment } from '../engine/math.js';
import { WORLD_SEED, MAIN_ISLAND, VILLAGE, LAKE, MOUNTAIN, FOREST, RUINS, HILLS, HAMLET, PATHS, ISLETS, BRIDGES, BIG_ISLANDS } from '../config.js';

const N = new Simplex(WORLD_SEED);
const N2 = new Simplex(WORLD_SEED + 99);

function radial(x, z, c) { return Math.hypot(x - c.x, z - c.z); }
// nombre de cellules pour une demi-largeur donnée et une taille de cellule visée
function cellsFor(half, size) { return Math.round((half + 3) * 2 / size); }

// segments des chemins avec boîtes englobantes (rejet rapide : il y a des chemins sur trois îles)
const SEGS = [];
for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) {
  const [ax, az] = p[i], [bx, bz] = p[i + 1];
  SEGS.push({ ax, az, bx, bz, x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: Math.min(az, bz), z1: Math.max(az, bz) });
}

export function pathDistance(x, z) {
  let best = 1e9;
  for (const s of SEGS) {
    const ox = x < s.x0 ? s.x0 - x : x > s.x1 ? x - s.x1 : 0, oz = z < s.z0 ? s.z0 - z : z > s.z1 ? z - s.z1 : 0;
    if (ox > best || oz > best) continue;
    const d = distToSegment(x, z, s.ax, s.az, s.bx, s.bz);
    if (d < best) best = d;
  }
  // léger méandre
  return best + N.noise2(x * 0.05, z * 0.05) * 1.4;
}

// Relief de l'île principale (hauteur absolue).
export function mainHeight(x, z) {
  let h = 11 + N.fbm2(x / 260, z / 260, 4) * 9 + N.fbm2(x / 60, z / 60, 3) * 2.2 + N.fbm2(x / 22, z / 22, 2) * 0.6;
  // Collines ambrées
  const dh = radial(x, z, HILLS);
  h += (1 - smoothstep(0, HILLS.radius * 1.2, dh)) * (N2.ridge2(x / 55, z / 55, 3) * 16 - 4);
  // Forêt : ondulations
  const df = radial(x, z, FOREST);
  h += (1 - smoothstep(0, FOREST.radius, df)) * N2.fbm2(x / 30, z / 30, 3) * 3.5;
  // Montagne
  const dm = radial(x, z, MOUNTAIN);
  const mt = 1 - smoothstep(0, MOUNTAIN.radius, dm);
  if (mt > 0) {
    const ridge = N2.ridge2(x / 38, z / 38, 4);
    let mh = MOUNTAIN.peak * Math.pow(mt, 1.25) + ridge * 14 * mt;
    // plateau sommital pour l'arène du boss
    const st = 1 - smoothstep(MOUNTAIN.summitRadius * 0.6, MOUNTAIN.summitRadius * 1.35, dm);
    mh = lerp(mh, MOUNTAIN.summitHeight - 11, st);
    h += mh;
  }
  // Ruines : terrasse
  const dr = radial(x, z, RUINS);
  h = lerp(h, RUINS.height + N.fbm2(x / 20, z / 20, 2) * 0.8, 1 - smoothstep(RUINS.radius * 0.55, RUINS.radius, dr));
  // Lac
  const dl = radial(x, z, LAKE) + N.noise2(x / 18, z / 18) * 5;
  if (dl < LAKE.radius * 1.6) {
    const shore = LAKE.level + 0.8;
    h = lerp(h, Math.max(shore, Math.min(h, shore + (dl - LAKE.radius) * 0.35)), 1 - smoothstep(LAKE.radius, LAKE.radius * 1.6, dl));
    const bed = LAKE.level - 4.5 + (dl / LAKE.radius) * 3;
    if (dl < LAKE.radius) h = lerp(bed, shore, smoothstep(LAKE.radius * 0.75, LAKE.radius, dl));
  }
  // Prés-Bas : hameau sur un replat
  const dhm = radial(x, z, HAMLET);
  if (dhm < HAMLET.radius + 30) h = lerp(h, HAMLET.height + N.noise2(x / 25, z / 25) * 0.25, 1 - smoothstep(HAMLET.radius * 0.8, HAMLET.radius + 28, dhm));
  // Village : plateau aplani
  const dv = radial(x, z, VILLAGE);
  h = lerp(h, VILLAGE.height + N.noise2(x / 25, z / 25) * 0.25, 1 - smoothstep(VILLAGE.radius * 0.8, VILLAGE.radius + 26, dv));
  // Chemins : adoucis
  const pd = pathDistance(x, z);
  if (pd < 6 && mt < 0.35) {
    const hs = N.fbm2(x / 60, z / 60, 2) * 2;
    h = lerp(h, h * 0.92 + hs * 0.08 + 0.6, (1 - smoothstep(2, 6, pd)) * 0.25);
  }
  return h;
}

const C = {
  grass1: new THREE.Color('#6fb24a'), grass2: new THREE.Color('#8cc152'), grass3: new THREE.Color('#a9c45a'),
  forest: new THREE.Color('#4c8a3a'), forest2: new THREE.Color('#3f7a37'),
  amber: new THREE.Color('#c9b15a'), amber2: new THREE.Color('#d6a855'),
  dirt: new THREE.Color('#b98a5a'), dirt2: new THREE.Color('#a87a4c'),
  rock: new THREE.Color('#8d867c'), rock2: new THREE.Color('#6f6a64'),
  snow: new THREE.Color('#eef3f6'), sand: new THREE.Color('#dcc88f'), bed: new THREE.Color('#5e8f7c'),
  ash: new THREE.Color('#9d8f7e'), plaza: new THREE.Color('#c7b08a'), moss: new THREE.Color('#5f7d44'),
};
const tmpA = new THREE.Color(), tmpB = new THREE.Color();

export function mainColor(out, x, y, z, slope, edge) {
  const n = N.noise2(x / 14, z / 14) * 0.5 + 0.5;
  const n2 = N2.noise2(x / 5, z / 5) * 0.5 + 0.5;
  out.copy(C.grass1).lerp(C.grass2, n);
  if (n2 > 0.72) out.lerp(C.grass3, (n2 - 0.72) * 2.4);
  // forêt plus sombre
  const ft = 1 - smoothstep(FOREST.radius * 0.5, FOREST.radius * 1.05, radial(x, z, FOREST));
  if (ft > 0) out.lerp(tmpA.copy(C.forest).lerp(C.forest2, n2), ft * 0.85);
  // collines ambrées
  const ht = 1 - smoothstep(HILLS.radius * 0.3, HILLS.radius * 1.1, radial(x, z, HILLS));
  if (ht > 0) out.lerp(tmpA.copy(C.amber).lerp(C.amber2, n), ht * 0.55 * (0.6 + n2 * 0.4));
  // ruines cendrées
  const rt = 1 - smoothstep(RUINS.radius * 0.4, RUINS.radius * 1.1, radial(x, z, RUINS));
  if (rt > 0) out.lerp(C.ash, rt * 0.55 * (0.5 + n * 0.5));
  // chemins
  const pd = pathDistance(x, z);
  const pt = 1 - smoothstep(1.6, 3.6, pd);
  if (pt > 0) out.lerp(tmpA.copy(C.dirt).lerp(C.dirt2, n2), pt * 0.92);
  // place du village et cour du hameau
  const dv = radial(x, z, VILLAGE);
  if (dv < 18) out.lerp(C.plaza, (1 - smoothstep(12, 18, dv)) * 0.9);
  const dhm = radial(x, z, HAMLET);
  if (dhm < 12) out.lerp(C.plaza, (1 - smoothstep(7, 12, dhm)) * 0.8);
  // lac
  const dl = radial(x, z, LAKE);
  if (y < LAKE.level + 1.4 && dl < LAKE.radius * 1.7) out.lerp(y < LAKE.level - 0.3 ? C.bed : C.sand, 0.9);
  // roche selon la pente / altitude
  const rk = smoothstep(0.42, 0.62, slope) + smoothstep(48, 64, y) * 0.6;
  if (rk > 0) out.lerp(tmpB.copy(C.rock).lerp(C.rock2, n2), clamp(rk, 0, 1));
  if (y > 80) out.lerp(C.snow, smoothstep(80, 90, y) * (1 - smoothstep(0.55, 0.75, slope)));
  if (edge) out.lerp(C.moss, 0.6);
  return out;
}

export function isletHeightFn(def) {
  const nz = new Simplex(def.seed);
  return (x, z) => {
    const d = Math.hypot(x - def.x, z - def.z) / def.radius;
    return def.baseY + (1 - d * d) * def.relief + nz.fbm2(x / 12, z / 12, 3) * def.relief * 0.5;
  };
}

export function isletColorFn(def) {
  const nz = new Simplex(def.seed + 5);
  return (out, x, y, z, slope, edge) => {
    const n = nz.noise2(x / 9, z / 9) * 0.5 + 0.5;
    out.copy(C.grass2).lerp(C.grass3, n * 0.6);
    if (def.id === 'nuees') out.lerp(tmpA.set('#9fd0b4'), 0.35);
    if (def.id === 'pelerin') out.lerp(C.amber, 0.4);
    if (def.biome === 'snowy') out.lerp(tmpA.set('#e9f0f6'), 0.55 + n * 0.3);
    if (def.biome === 'dry') out.lerp(tmpA.set('#cfa252'), 0.55 + n * 0.2);
    if (def.biome === 'marsh') out.lerp(tmpA.set('#6f8f58'), 0.5 + n * 0.25);
    if (def.biome === 'dusk') out.lerp(tmpA.set('#7a6f8a'), 0.55 + n * 0.25);
    if (def.biome === 'lush') out.lerp(tmpA.set('#3f9a4a'), 0.5 + n * 0.3);
    if (slope > 0.45) out.lerp(C.rock, smoothstep(0.45, 0.65, slope));
    if (edge) out.lerp(C.moss, 0.6);
    return out;
  };
}

// ------------------------------------------------------------------ grandes îles (biomes)
function polyDist(x, z, pts) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, distToSegment(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return best;
}

export function bigHeightFn(def) {
  const nz = new Simplex(def.seed), nz2 = new Simplex(def.seed + 7);
  const snow = def.biome === 'snow', amber = def.biome === 'amber', jungle = def.biome === 'jungle', haunted = def.biome === 'haunted';
  const big = snow ? 9 : jungle ? 8 : haunted ? 6 : 5, fine = snow ? 2.2 : jungle ? 1.8 : 1.4;
  return (x, z) => {
    let h = def.baseY + nz.fbm2(x / 160, z / 160, 4) * big + nz.fbm2(x / 40, z / 40, 3) * fine;
    if (amber) h += Math.max(0, nz2.noise2(x / 22, z / 60)) * 1.6; // dunes allongées
    if (jungle) h += Math.pow(Math.max(0, nz2.ridge2(x / 70, z / 70, 3) - 0.35), 1.5) * 18; // collines arrondies
    if (haunted) h += nz2.fbm2(x / 55, z / 55, 3) * 3 - Math.max(0, nz2.noise2(x / 90, z / 90)) * 3; // landes bosselées
    let peakT = 0;
    for (const f of def.features) {
      if (f.type === 'canyon') {
        const d = polyDist(x, z, f.pts) + nz.noise2(x / 15, z / 15) * 2.5;
        h -= f.depth * (1 - smoothstep(f.width * 0.35, f.width, d));
        continue;
      }
      const d = Math.hypot(x - f.x, z - f.z);
      if (f.type === 'peak') {
        const mt = 1 - smoothstep(0, f.radius, d);
        if (mt <= 0) continue;
        peakT = Math.max(peakT, mt);
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
          if (snow && dl < f.radius * 1.6) { h = lerp(h, f.level, 1 - smoothstep(f.radius, f.radius * 1.6, dl)); continue; }
          if (haunted && dl < f.radius * 1.8) { h = lerp(h, f.level - 0.6 + nz2.noise2(x / 9, z / 9) * 0.9, 1 - smoothstep(f.radius * 0.8, f.radius * 1.8, dl)); continue; } // marais
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
    // chemins adoucis
    const pd = pathDistance(x, z);
    if (pd < 6 && peakT < 0.35) h = lerp(h, h - 0.3, (1 - smoothstep(2, 6, pd)) * 0.5);
    return h;
  };
}

const B = {
  snow: new THREE.Color('#eef4fa'), snow2: new THREE.Color('#d7e3ef'), frost: new THREE.Color('#a9bfae'), ice: new THREE.Color('#9fd6ea'),
  srock: new THREE.Color('#7d8693'), srock2: new THREE.Color('#5f6774'), spath: new THREE.Color('#c3cdd8'), camp: new THREE.Color('#b9aea0'),
  gold: new THREE.Color('#d4a63a'), ochre: new THREE.Color('#e3b84a'), earth: new THREE.Color('#cf7a2c'), sandy: new THREE.Color('#ecc985'),
  red1: new THREE.Color('#b4451f'), red2: new THREE.Color('#e08a3c'), apath: new THREE.Color('#e2b670'), sage: new THREE.Color('#9aa04a'),
  // jungle
  jg1: new THREE.Color('#2f8f3a'), jg2: new THREE.Color('#4fae3e'), jg3: new THREE.Color('#7cc04a'), jmoss: new THREE.Color('#2a6b3a'), jpath: new THREE.Color('#b08a56'), jrock: new THREE.Color('#5e7a64'), jsand: new THREE.Color('#d9c48a'),
  // landes hantées
  hg1: new THREE.Color('#5a5a46'), hg2: new THREE.Color('#6b6a4e'), heath: new THREE.Color('#6e4f78'), hdead: new THREE.Color('#8a7a5a'), hpath: new THREE.Color('#7d7262'), hrock: new THREE.Color('#5a5566'), hmud: new THREE.Color('#3f4a3a'), hgrave: new THREE.Color('#4a4a3c'),
};

export function bigColorFn(def) {
  const nz = new Simplex(def.seed + 3);
  const snow = def.biome === 'snow';
  const lake = def.lake, camp = def.camp;
  const jungle = def.biome === 'jungle', haunted = def.biome === 'haunted';
  return (out, x, y, z, slope, edge) => {
    const n = nz.noise2(x / 14, z / 14) * 0.5 + 0.5, n2 = nz.noise2(x / 5, z / 5) * 0.5 + 0.5;
    const pd = pathDistance(x, z);
    if (jungle) {
      out.copy(B.jg1).lerp(B.jg2, n);
      if (n2 > 0.62) out.lerp(B.jg3, (n2 - 0.62) * 1.6);
      out.lerp(B.jmoss, smoothstep(0.4, 0.8, nz.noise2(x / 45, z / 45) * 0.5 + 0.5) * 0.5);
      if (lake && y < lake.level + 1.2 && Math.hypot(x - lake.x, z - lake.z) < lake.radius * 1.7) out.lerp(B.jsand, 0.75);
      const pt = 1 - smoothstep(1.6, 3.8, pd);
      if (pt > 0) out.lerp(B.jpath, pt * 0.85);
      if (camp && Math.hypot(x - camp.x, z - camp.z) < camp.radius * 0.8) out.lerp(B.jpath, 0.45);
      const rk = smoothstep(0.42, 0.62, slope);
      if (rk > 0) out.lerp(B.jrock, rk);
      if (edge) out.lerp(B.jmoss, 0.6);
      return out;
    }
    if (haunted) {
      out.copy(B.hg1).lerp(B.hg2, n);
      // bruyère violette et herbe morte par plaques
      const heath = smoothstep(0.45, 0.75, nz.noise2(x / 38, z / 38) * 0.5 + 0.5);
      out.lerp(B.heath, heath * 0.55);
      if (n2 > 0.7) out.lerp(B.hdead, (n2 - 0.7) * 2);
      if (def.cemetery && Math.hypot(x - def.cemetery.x, z - def.cemetery.z) < def.cemetery.radius) out.lerp(B.hgrave, 0.5);
      if (lake && Math.hypot(x - lake.x, z - lake.z) < lake.radius * 1.9) out.lerp(B.hmud, 0.7 * (1 - smoothstep(lake.radius, lake.radius * 1.9, Math.hypot(x - lake.x, z - lake.z))));
      const pt = 1 - smoothstep(1.6, 3.8, pd);
      if (pt > 0) out.lerp(B.hpath, pt * 0.85);
      const rk = smoothstep(0.42, 0.62, slope);
      if (rk > 0) out.lerp(B.hrock, rk);
      if (edge) out.lerp(B.hrock, 0.5);
      return out;
    }
    if (snow) {
      out.copy(B.snow).lerp(B.snow2, n * 0.7);
      // herbe gelée qui perce aux basses altitudes
      const low = 1 - smoothstep(def.baseY + 1, def.baseY + 9, y);
      if (low > 0 && n2 > 0.55) out.lerp(B.frost, low * (n2 - 0.55) * 1.6);
      const pt = 1 - smoothstep(1.6, 3.8, pd);
      if (pt > 0) out.lerp(B.spath, pt * 0.85);
      if (camp && Math.hypot(x - camp.x, z - camp.z) < camp.radius * 0.8) out.lerp(B.camp, 0.55 * (1 - smoothstep(camp.radius * 0.5, camp.radius * 0.8, Math.hypot(x - camp.x, z - camp.z))));
      if (lake && y < lake.level + 0.4 && Math.hypot(x - lake.x, z - lake.z) < lake.radius * 1.5) out.lerp(B.ice, 0.85);
      const rk = smoothstep(0.42, 0.62, slope);
      if (rk > 0) out.lerp(tmpB.copy(B.srock).lerp(B.srock2, n2), rk);
    } else {
      out.copy(B.gold).lerp(B.ochre, n);
      if (n2 > 0.7) out.lerp(B.sage, (n2 - 0.7) * 1.8);
      const bare = smoothstep(0.35, 0.7, nz.noise2(x / 40, z / 40) * 0.5 + 0.5);
      out.lerp(B.earth, bare * 0.45);
      // strates rouges sur les pentes (mesas, gorge)
      const rk = smoothstep(0.38, 0.6, slope);
      if (rk > 0) out.lerp(tmpB.copy(B.red1).lerp(B.red2, 0.5 + 0.5 * Math.sin(y * 0.9 + n * 2)), rk);
      if (y < def.baseY - 4) out.lerp(B.sandy, 0.6 * (1 - rk)); // fond de gorge sableux
      const pt = 1 - smoothstep(1.6, 3.8, pd);
      if (pt > 0) out.lerp(B.apath, pt * 0.85);
      if (camp && Math.hypot(x - camp.x, z - camp.z) < camp.radius * 0.8) out.lerp(B.sandy, 0.5);
    }
    if (edge) out.lerp(snow ? B.srock2 : B.red1, 0.5);
    return out;
  };
}

// Signature des paramètres du relief : un fichier pré-calculé ne sert que s'il correspond.
// (À augmenter quand les fonctions de relief ou de couleur changent.)
const BAKE_VERSION = 4;
export function terrainSignature() {
  const str = JSON.stringify({ BAKE_VERSION, WORLD_SEED, MAIN_ISLAND, VILLAGE, LAKE, MOUNTAIN, FOREST, RUINS, HILLS, HAMLET, ISLETS, BIG_ISLANDS, PATHS });
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16);
}

// Lit le fichier binaire produit par tools/bake-terrain.mjs : { sig, islands: Map(id -> {cells, h, c}) }
export function parseBakedTerrain(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x52544541) return null; // 'AETR'
  const hl = dv.getUint32(4, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)));
  const islands = new Map();
  for (const it of head.islands) islands.set(it.id, { cells: it.cells, h: new Int16Array(buf, it.hOff, it.n), c: new Uint8Array(buf, it.cOff, it.n * 3) });
  return { sig: head.sig, islands };
}

// Construit les îles (principale + îlots) et expose la requête de sol.
export class Terrain {
  constructor(baked = null) {
    if (baked && baked.sig !== terrainSignature()) { console.warn('Relief pré-calculé périmé : calcul en direct'); baked = null; }
    const B = (id) => baked?.islands.get(id) || null;
    this.islands = [];
    this.main = new Island({
      x: MAIN_ISLAND.x, z: MAIN_ISLAND.z, radius: MAIN_ISLAND.radius, coastNoise: MAIN_ISLAND.coastNoise,
      seed: WORLD_SEED, cells: cellsFor(MAIN_ISLAND.radius + MAIN_ISLAND.coastNoise, 2.6), heightFn: mainHeight, colorFn: mainColor, depth: 240, name: 'Aetheria', baked: B('main'),
    }).build();
    this.islands.push(this.main);
    for (const def of ISLETS) {
      const isl = new Island({
        x: def.x, z: def.z, radius: def.radius, coastNoise: def.radius * 0.22, seed: def.seed,
        cells: Math.max(32, cellsFor(def.radius * 1.22, 2.1)), heightFn: isletHeightFn(def), colorFn: isletColorFn(def),
        depth: def.radius * 2.2, name: def.name, baked: B(def.id),
      }).build();
      isl.def = def;
      this.islands.push(isl);
    }
    this.big = [];
    for (const def of BIG_ISLANDS) {
      const isl = new Island({
        x: def.x, z: def.z, radius: def.radius, coastNoise: def.coastNoise, seed: def.seed,
        cells: cellsFor(def.radius + def.coastNoise, 2.9), heightFn: bigHeightFn(def), colorFn: bigColorFn(def), depth: def.depth, name: def.name, baked: B(def.id),
      }).build();
      isl.def = def; isl.big = true;
      this.islands.push(isl);
      this.big.push(isl);
    }
    this.resolveBridges();
    this.bridges = BRIDGES.map((b) => this.makeBridgeDef(b));
  }

  byId(id) { return id === 'main' ? this.main : this.islands.find((i) => i.def?.id === id); }

  // Extrémités des ponts : sur la côte de chaque île, face à l'autre.
  resolveBridges() {
    for (const b of BRIDGES) {
      if (b.from) continue;
      const A = this.byId(b.a), B2 = this.byId(b.b);
      if (!A || !B2) continue;
      const th = Math.atan2(B2.cz - A.cz, B2.cx - A.cx);
      const end = (isl, t) => { const r = isl.coastR(t) - 5; return [Math.round(isl.cx + Math.cos(t) * r), Math.round(isl.cz + Math.sin(t) * r)]; };
      b.from = end(A, th);
      b.to = end(B2, th + Math.PI);
    }
  }

  makeBridgeDef(b) {
    const [ax, az] = b.from, [bx, bz] = b.to;
    const ha = this.groundIsland(ax, az) ?? 0, hb = this.groundIsland(bx, bz) ?? 0;
    const len = Math.hypot(bx - ax, bz - az);
    return { ax, az, bx, bz, ha: ha + 0.1, hb: hb + 0.1, len, width: 2.4, sag: Math.min(6, 1.2 + len * 0.025) };
  }

  groundIsland(x, z) {
    let best = null;
    for (const isl of this.islands) {
      const h = isl.heightAt(x, z);
      if (h !== null && (best === null || h > best)) best = h;
    }
    return best;
  }

  bridgeHeight(x, z) {
    for (const b of this.bridges) {
      const vx = b.bx - b.ax, vz = b.bz - b.az;
      const t = ((x - b.ax) * vx + (z - b.az) * vz) / (b.len * b.len);
      if (t < -0.02 || t > 1.02) continue;
      const px = b.ax + vx * t, pz = b.az + vz * t;
      if (Math.hypot(x - px, z - pz) > b.width * 0.5) continue;
      const tt = clamp(t, 0, 1);
      return lerp(b.ha, b.hb, tt) - Math.sin(tt * Math.PI) * b.sag;
    }
    return null;
  }

  // Hauteur du sol (îles + ponts). null = le vide.
  heightAt(x, z) {
    const g = this.groundIsland(x, z);
    const b = this.bridgeHeight(x, z);
    if (b !== null && (g === null || b > g - 0.5)) return Math.max(b, g ?? -1e9);
    return g;
  }

  // Le sol le plus haut sous une position donnée (pour gérer les îlots au-dessus de l'île).
  groundBelow(x, y, z) {
    let best = null;
    for (const isl of this.islands) {
      const h = isl.heightAt(x, z);
      if (h !== null && h <= y + 1.2 && (best === null || h > best)) best = h;
    }
    const b = this.bridgeHeight(x, z);
    if (b !== null && b <= y + 1.2 && (best === null || b > best)) best = b;
    return best;
  }

  slopeAt(x, z) {
    const e = 1.0;
    const h0 = this.heightAt(x, z), hx = this.heightAt(x + e, z), hz = this.heightAt(x, z + e);
    if (h0 === null || hx === null || hz === null) return 0;
    return Math.atan(Math.hypot(hx - h0, hz - h0) / e);
  }

  islandAt(x, z) {
    for (const isl of this.islands) if (isl.isInside(x, z)) return isl;
    return null;
  }
}

// Sérialise le relief de toutes les îles (outil de build).
export function bakeTerrain(terrain) {
  const islands = [];
  for (const isl of terrain.islands) {
    const id = isl === terrain.main ? 'main' : isl.def?.id;
    if (!id) continue;
    const b = bakeIsland(isl);
    islands.push({ id, cells: b.cells, n: b.h.length, b });
  }
  const head = { sig: terrainSignature(), islands: islands.map(({ id, cells, n }) => ({ id, cells, n, hOff: 0, cOff: 0 })) };
  const HL = new TextEncoder().encode(JSON.stringify(head)).length + 256; // place pour les décalages
  const al = (v) => Math.ceil(v / 4) * 4;
  let off = al(8 + HL);
  for (const it of head.islands) { it.hOff = off; off = al(off + it.n * 2); it.cOff = off; off = al(off + it.n * 3); }
  const bytes = new TextEncoder().encode(JSON.stringify(head).padEnd(HL, ' '));
  const buf = new ArrayBuffer(off), dv = new DataView(buf);
  dv.setUint32(0, 0x52544541, true); dv.setUint32(4, HL, true);
  new Uint8Array(buf, 8, HL).set(bytes);
  head.islands.forEach((it, k) => { new Int16Array(buf, it.hOff, it.n).set(islands[k].b.h); new Uint8Array(buf, it.cOff, it.n * 3).set(islands[k].b.c); });
  return buf;
}
