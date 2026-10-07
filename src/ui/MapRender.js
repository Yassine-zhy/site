import { WATERS, WORLD_BOUNDS } from '../config.js';
import { CRES } from '../world/Continent.js';

// La carte couvre tout le continent : carré de demi-côté MAP_RANGE centré sur (MAP_CX, MAP_CZ).
export const MAP_CX = WORLD_BOUNDS.cx, MAP_CZ = WORLD_BOUNDS.cz, MAP_RANGE = WORLD_BOUNDS.half;

const LAKE_COL = { clear: [61, 143, 176], jungle: [47, 159, 168], marsh: [74, 90, 74], lagoon: [70, 200, 196] };

// Rendu cartographique du continent (couleurs du sol, ombrage du relief, océan dégradé).
export function renderWorldMap(terrain, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const heights = new Float32Array(size * size);
  const W = MAP_RANGE * 2;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    heights[j * size + i] = terrain.continentHeight(MAP_CX - MAP_RANGE + (i + 0.5) / size * W, MAP_CZ - MAP_RANGE + (j + 0.5) / size * W);
  }
  const col = terrain.color;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = j * size + i, p = k * 4;
      const x = MAP_CX - MAP_RANGE + (i + 0.5) / size * W, z = MAP_CZ - MAP_RANGE + (j + 0.5) / size * W;
      const y = heights[k];
      if (y < 0) {
        // océan : turquoise près des côtes, bleu profond au large, légères vagues
        const d = Math.min(1, -y / 22), wv = (Math.sin(x * 0.045 + Math.sin(z * 0.02) * 2) + Math.sin(z * 0.05 + x * 0.012)) * 2.5;
        img.data[p] = 70 * (1 - d) + 26 * d + wv; img.data[p + 1] = 190 * (1 - d) + 64 * d + wv; img.data[p + 2] = 196 * (1 - d) + 120 * d + wv; img.data[p + 3] = 255;
        if (y > -0.6) { img.data[p] = 225; img.data[p + 1] = 240; img.data[p + 2] = 240; }
        continue;
      }
      const ci = Math.min(CRES - 1, Math.floor((i + 0.5) / size * CRES)), cj = Math.min(CRES - 1, Math.floor((j + 0.5) / size * CRES));
      const q = (cj * CRES + ci) * 4;
      let r = col[q], gg = col[q + 1], b = col[q + 2];
      for (const w of WATERS) if (y < w.level + 0.05 && Math.hypot(x - w.x, z - w.z) < w.radius * 1.8) [r, gg, b] = LAKE_COL[w.kind] || LAKE_COL.clear;
      // ombrage (lumière venant du nord-ouest)
      const hl = i > 0 ? heights[k - 1] : y, hu = j > 0 ? heights[k - size] : y;
      const shade = Math.max(0.55, Math.min(1.45, 1 + ((hl - y) + (hu - y)) * 0.05));
      const alt = 0.9 + Math.min(0.25, y / 300);
      img.data[p] = Math.min(255, r * shade * alt);
      img.data[p + 1] = Math.min(255, gg * shade * alt);
      img.data[p + 2] = Math.min(255, b * shade * alt);
      img.data[p + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function worldToMap(x, z, size) { return [(x - MAP_CX + MAP_RANGE) / (MAP_RANGE * 2) * size, (z - MAP_CZ + MAP_RANGE) / (MAP_RANGE * 2) * size]; }
