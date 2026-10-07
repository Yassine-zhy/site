import { clamp, lerp } from '../engine/math.js';
import { WORLD_HALF, SEA_LEVEL } from '../config.js';
import {
  RES, BRES, sampleHeights, bakeHeights, bakeSurface, unpackBaked, pathDistance, zoneAt, continentSignature, REGION_DEFS,
} from './Continent.js';

export { pathDistance, zoneAt };

// Le sol du monde : le continent (carte de hauteur cuite), plus les îles flottantes ajoutées
// en cours de partie (Citadelle des expéditions) et leurs ponts.
export class Terrain {
  // baked : [ArrayBuffer hauteurs, ArrayBuffer surface] (fichiers de tools/bake-terrain.mjs)
  constructor(baked = null) {
    const H = unpackBaked(baked?.[0]), C = unpackBaked(baked?.[1]);
    if (H && C) { this.h = H.h; this.color = C.color; this.mats = C.mats; this.biome = C.biome; }
    else {
      if (baked) console.warn('Relief pré-calculé absent ou périmé (' + continentSignature() + ') : calcul en direct');
      this.h = bakeHeights();
      const s = bakeSurface(this.h);
      this.color = s.color; this.mats = s.mats; this.biome = s.biome;
    }
    this.islands = []; // îles flottantes (Citadelle)
    this.bridges = [];
    this.big = [];
    const self = this;
    // (héritage) « l'île principale » : tout le continent émergé
    this.main = { name: 'Aetheria', cx: 0, cz: 0, radius: WORLD_HALF, isInside: (x, z) => self.continentHeight(x, z) > SEA_LEVEL + 0.05 };
  }

  continentHeight(x, z) { return sampleHeights(this.h, x, z); }
  // région (biome) dominante : le cœur tempéré ou l'une des REGIONS de la configuration
  regionAt(x, z) {
    const i = Math.floor((x + WORLD_HALF) / (2 * WORLD_HALF) * BRES), j = Math.floor((z + WORLD_HALF) / (2 * WORLD_HALF) * BRES);
    if (i < 0 || j < 0 || i >= BRES || j >= BRES) return REGION_DEFS[0];
    return REGION_DEFS[this.biome[j * BRES + i]];
  }
  // sol ferme (continent émergé ou île flottante) : les créatures n'apparaissent que là
  isLand(x, z) { return this.continentHeight(x, z) > SEA_LEVEL + 0.05 || (this.islands.length > 0 && this.islandHeight(x, z) !== null); }
  waterDepth(x, z) { return Math.max(0, SEA_LEVEL - this.continentHeight(x, z)); }

  makeBridgeDef(b) {
    const [ax, az] = b.from, [bx, bz] = b.to;
    const ha = this.heightAt(ax, az), hb = this.heightAt(bx, bz);
    const len = Math.hypot(bx - ax, bz - az);
    return { ax, az, bx, bz, ha: ha + 0.1, hb: hb + 0.1, len, width: 2.4, sag: Math.min(6, 1.2 + len * 0.025) };
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

  islandHeight(x, z) {
    let best = null;
    for (const isl of this.islands) {
      const h = isl.heightAt(x, z);
      if (h !== null && (best === null || h > best)) best = h;
    }
    return best;
  }

  // Hauteur du sol (fond marin compris : jamais null).
  heightAt(x, z) {
    let g = this.continentHeight(x, z);
    if (this.islands.length) { const i = this.islandHeight(x, z); if (i !== null && i > g) g = i; }
    if (this.bridges.length) { const b = this.bridgeHeight(x, z); if (b !== null && b > g - 0.5) g = Math.max(b, g); }
    return g;
  }

  // Le sol le plus haut sous une position donnée (îles flottantes et ponts au-dessus du continent).
  groundBelow(x, y, z) {
    const c = this.continentHeight(x, z);
    let best = c <= y + 1.2 ? c : null;
    for (const isl of this.islands) {
      const h = isl.heightAt(x, z);
      if (h !== null && h <= y + 1.2 && (best === null || h > best)) best = h;
    }
    const b = this.bridges.length ? this.bridgeHeight(x, z) : null;
    if (b !== null && b <= y + 1.2 && (best === null || b > best)) best = b;
    return best ?? c;
  }

  slopeAt(x, z) {
    const e = 1.0;
    const h0 = this.heightAt(x, z), hx = this.heightAt(x + e, z), hz = this.heightAt(x, z + e);
    return Math.atan(Math.hypot(hx - h0, hz - h0) / e);
  }

  // île flottante sous ce point, sinon le continent s'il est émergé
  islandAt(x, z) {
    for (const isl of this.islands) if (isl.isInside(x, z)) return isl;
    return this.isLand(x, z) ? this.main : null;
  }

  inMap(x, z) { return Math.abs(x) < WORLD_HALF && Math.abs(z) < WORLD_HALF; }
  get res() { return RES; }
}
