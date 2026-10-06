import * as THREE from 'three';
import { Island } from './Island.js';
import { Simplex, smoothstep, lerp, clamp, distToSegment } from '../engine/math.js';
import { WORLD_SEED, MAIN_ISLAND, VILLAGE, LAKE, MOUNTAIN, FOREST, RUINS, HILLS, PATHS, ISLETS, BRIDGES, BIG_ISLANDS } from '../config.js';

const N = new Simplex(WORLD_SEED);
const N2 = new Simplex(WORLD_SEED + 99);

function radial(x, z, c) { return Math.hypot(x - c.x, z - c.z); }

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
    if (def.biome === 'snowy') out.lerp(tmpA.set('#e9f0f6'), 0.55 + n * 0.3);
    if (def.biome === 'dry') out.lerp(tmpA.set('#cfa252'), 0.55 + n * 0.2);
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
  const snow = def.biome === 'snow';
  return (x, z) => {
    let h = def.baseY + nz.fbm2(x / 130, z / 130, 4) * (snow ? 9 : 5) + nz.fbm2(x / 36, z / 36, 3) * (snow ? 2.2 : 1.4);
    if (!snow) h += Math.max(0, nz2.noise2(x / 22, z / 60)) * 1.6; // dunes allongées
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
          // arène : fond plat entouré d'un rempart rocheux (ouvert vers l'ouest)
          const a = Math.atan2(z - f.z, x - f.x);
          const gate = 1 - smoothstep(0.25, 0.55, Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))));
          const rim = (1 - smoothstep(f.radius * 0.9, f.radius * 1.5, d)) * smoothstep(f.radius * 0.75, f.radius * 1.05, d) * f.wall * (1 - gate);
          h = lerp(h, f.level, 1 - smoothstep(f.radius * 0.8, f.radius * 1.3, d)) + rim;
        } else {
          const dl = d + nz.noise2(x / 18, z / 18) * 5;
          if (snow && dl < f.radius * 1.6) { h = lerp(h, f.level, 1 - smoothstep(f.radius, f.radius * 1.6, dl)); continue; }
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
};

export function bigColorFn(def) {
  const nz = new Simplex(def.seed + 3);
  const snow = def.biome === 'snow';
  const lake = def.lake, camp = def.camp;
  return (out, x, y, z, slope, edge) => {
    const n = nz.noise2(x / 14, z / 14) * 0.5 + 0.5, n2 = nz.noise2(x / 5, z / 5) * 0.5 + 0.5;
    const pd = pathDistance(x, z);
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
    this.big = [];
    for (const def of BIG_ISLANDS) {
      const isl = new Island({
        x: def.x, z: def.z, radius: def.radius, coastNoise: def.coastNoise, seed: def.seed,
        cells: Math.round(def.radius * 1.15), heightFn: bigHeightFn(def), colorFn: bigColorFn(def), depth: def.depth, name: def.name,
      }).build();
      isl.def = def; isl.big = true;
      this.islands.push(isl);
      this.big.push(isl);
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
