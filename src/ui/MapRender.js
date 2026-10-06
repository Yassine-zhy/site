import * as THREE from 'three';
import { mainColor, isletColorFn } from '../world/Terrain.js';
import { ISLETS, LAKE } from '../config.js';

export const MAP_RANGE = 330; // la carte couvre [-330, 330]²

// Rendu cartographique de l'archipel (style parchemin coloré + ombrage du relief).
export function renderWorldMap(terrain, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const col = new THREE.Color();
  const isletFns = new Map(ISLETS.map((d) => [d.id, isletColorFn(d)]));
  const heights = new Float32Array(size * size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = -MAP_RANGE + (i + 0.5) / size * MAP_RANGE * 2, z = -MAP_RANGE + (j + 0.5) / size * MAP_RANGE * 2;
      const isl = terrain.islandAt(x, z);
      const k = (j * size + i);
      if (!isl) { heights[k] = -999; continue; }
      const y = isl.heightAt(x, z) ?? 0;
      heights[k] = y;
    }
  }
  const sea = [ 0x2a, 0x33, 0x55 ];
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = j * size + i;
      const p = k * 4;
      const y = heights[k];
      const x = -MAP_RANGE + (i + 0.5) / size * MAP_RANGE * 2, z = -MAP_RANGE + (j + 0.5) / size * MAP_RANGE * 2;
      if (y === -999) {
        // mer de nuages : léger motif
        const n = (Math.sin(x * 0.05) + Math.sin(z * 0.043 + x * 0.01)) * 4;
        img.data[p] = sea[0] + n; img.data[p + 1] = sea[1] + n; img.data[p + 2] = sea[2] + n; img.data[p + 3] = 255;
        continue;
      }
      const isl = terrain.islandAt(x, z);
      const hl = heights[k - 1] > -999 ? heights[k - 1] : y, hu = heights[k - size] > -999 ? heights[k - size] : y;
      const slope = Math.min(1, Math.hypot(y - hl, y - hu) / 3);
      if (isl === terrain.main) mainColor(col, x, y, z, slope, false);
      else isletFns.get(isl.def.id)(col, x, y, z, slope, false);
      if (isl === terrain.main && y < LAKE.level - 0.2 && Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius * 1.6) col.set('#3d8fb0');
      col.convertLinearToSRGB();
      // ombrage (lumière venant du nord-ouest)
      const shade = 1 + ((hl - y) + (hu - y)) * 0.08;
      const alt = 0.85 + Math.min(0.3, y / 260);
      img.data[p] = Math.min(255, col.r * 255 * shade * alt);
      img.data[p + 1] = Math.min(255, col.g * 255 * shade * alt);
      img.data[p + 2] = Math.min(255, col.b * 255 * shade * alt);
      img.data[p + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // liseré des côtes
  g.globalCompositeOperation = 'source-over';
  return c;
}

export function worldToMap(x, z, size) { return [(x + MAP_RANGE) / (MAP_RANGE * 2) * size, (z + MAP_RANGE) / (MAP_RANGE * 2) * size]; }
