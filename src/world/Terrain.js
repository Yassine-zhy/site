import * as THREE from 'three';
import { Island } from './Island.js';
import { Simplex, smoothstep, lerp, clamp, distToSegment } from '../engine/math.js';
import { WORLD_SEED, MAIN_ISLAND, VILLAGE, LAKE, MOUNTAIN, FOREST, RUINS, HILLS, PATHS, ISLETS, BRIDGES } from '../config.js';

const N = new Simplex(WORLD_SEED);
const N2 = new Simplex(WORLD_SEED + 99);

function radial(x, z, c) { return Math.hypot(x - c.x, z - c.z); }

export function pathDistance(x, z) {
  let best = 1e9;
  for (const p of PATHS) {
    for (let i = 0; i < p.length - 1; i++) {
      const d = distToSegment(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]);
      if (d < best) best = d;
    }
  }
  // léger méandre
  return best + N.noise2(x * 0.05, z * 0.05) * 1.4;
}

// Relief de l'île principale (hauteur absolue).
export function mainHeight(x, z) {
  let h = 11 + N.fbm2(x / 150, z / 150, 4) * 7 + N.fbm2(x / 40, z / 40, 3) * 1.6;
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
  // place du village
  const dv = radial(x, z, VILLAGE);
  if (dv < 18) out.lerp(C.plaza, (1 - smoothstep(12, 18, dv)) * 0.9);
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
    if (slope > 0.45) out.lerp(C.rock, smoothstep(0.45, 0.65, slope));
    if (edge) out.lerp(C.moss, 0.6);
    return out;
  };
}

// Construit les îles (principale + îlots) et expose la requête de sol.
export class Terrain {
  constructor() {
    this.islands = [];
    this.main = new Island({
      x: MAIN_ISLAND.x, z: MAIN_ISLAND.z, radius: MAIN_ISLAND.radius, coastNoise: MAIN_ISLAND.coastNoise,
      seed: WORLD_SEED, cells: 260, heightFn: mainHeight, colorFn: mainColor, depth: 165, name: 'Aetheria',
    }).build();
    this.islands.push(this.main);
    for (const def of ISLETS) {
      const isl = new Island({
        x: def.x, z: def.z, radius: def.radius, coastNoise: def.radius * 0.22, seed: def.seed,
        cells: Math.max(32, Math.round(def.radius * 1.6)), heightFn: isletHeightFn(def), colorFn: isletColorFn(def),
        depth: def.radius * 2.2, name: def.name,
      }).build();
      isl.def = def;
      this.islands.push(isl);
    }
    this.bridges = BRIDGES.map((b) => this.makeBridgeDef(b));
  }

  makeBridgeDef(b) {
    const [ax, az] = b.from, [bx, bz] = b.to;
    const ha = this.groundIsland(ax, az) ?? 0, hb = this.groundIsland(bx, bz) ?? 0;
    return { ax, az, bx, bz, ha: ha + 0.1, hb: hb + 0.1, len: Math.hypot(bx - ax, bz - az), width: 2.2, sag: 2.2 };
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
