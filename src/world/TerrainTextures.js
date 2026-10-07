import * as THREE from 'three';
import { mulberry32 } from '../engine/math.js';

// Textures de détail du sol, dessinées en code (motifs stylisés qui se répètent sans couture) :
//   R herbe (brins, touffes) · G terre (cailloux, mottes) · B roche (fissures, strates) · A sable (rides, grains)
// Chaque canal est une « hauteur » de détail autour de 0,5 : le shader du terrain s'en sert pour
// moduler la couleur de la carte, mêler les matières (la roche perce l'herbe…) et créer du relief.

// bruit de valeur périodique (période P en cellules)
function valueNoise(rng, P) {
  const g = new Float32Array(P * P);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const x0 = ((xi % P) + P) % P, y0 = ((yi % P) + P) % P, x1 = (x0 + 1) % P, y1 = (y0 + 1) % P;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = g[y0 * P + x0], b = g[y0 * P + x1], c = g[y1 * P + x0], d = g[y1 * P + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

function fbm(rng, S, base, oct) {
  const layers = [];
  for (let o = 0; o < oct; o++) layers.push(valueNoise(rng, base << o));
  return (u, v) => { // u, v en pixels
    let s = 0, a = 0.5, n = 0;
    for (let o = 0; o < oct; o++) { const f = (base << o) / S; s += a * layers[o](u * f, v * f); n += a; a *= 0.5; }
    return s / n;
  };
}

// cellules de Voronoï périodiques : distances au plus proche et au second point
function voronoi(rng, S, cells) {
  const pts = new Float32Array(cells * cells * 2);
  for (let i = 0; i < cells * cells; i++) { pts[i * 2] = rng(); pts[i * 2 + 1] = rng(); }
  const cs = S / cells;
  return (u, v, out) => {
    const cx = Math.floor(u / cs), cy = Math.floor(v / cs);
    let d1 = 1e9, d2 = 1e9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const gx = cx + i, gy = cy + j;
      const wx = ((gx % cells) + cells) % cells, wy = ((gy % cells) + cells) % cells;
      const k = (wy * cells + wx) * 2;
      const px = (gx + pts[k]) * cs, py = (gy + pts[k + 1]) * cs;
      const d = Math.hypot(u - px, v - py);
      if (d < d1) { d2 = d1; d1 = d; id = wy * cells + wx; } else if (d < d2) d2 = d;
    }
    out[0] = d1 / cs; out[1] = d2 / cs; out[2] = id;
    return out;
  };
}

// tampon périodique : dépose une forme (fonction de distance) en enveloppant les bords
function stamp(buf, S, cx, cy, r, fn) {
  const r0 = Math.ceil(r);
  for (let y = -r0; y <= r0; y++) for (let x = -r0; x <= r0; x++) {
    const v = fn(x, y);
    if (v === null) continue;
    const px = (((Math.round(cx) + x) % S) + S) % S, py = (((Math.round(cy) + y) % S) + S) % S;
    const k = py * S + px;
    buf[k] = Math.max(buf[k], v);
  }
}

function normalize(a, lo = 0.12, hi = 0.88) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  const mean = s / a.length;
  let dev = 0;
  for (let i = 0; i < a.length; i++) dev += (a[i] - mean) * (a[i] - mean);
  dev = Math.sqrt(dev / a.length) || 1;
  for (let i = 0; i < a.length; i++) a[i] = Math.min(hi, Math.max(lo, 0.5 + (a[i] - mean) / dev * 0.17));
}

export function makeDetailTexture(S = 512) {
  const rng = mulberry32(2024);
  const R = new Float32Array(S * S), G = new Float32Array(S * S), B = new Float32Array(S * S), A = new Float32Array(S * S);
  const k = S / 512;

  // --- herbe : fond moucheté + milliers de brins (traits courts, plus clairs au bout)
  const gn = fbm(rng, S, 8, 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) R[y * S + x] = gn(x, y) * 0.45;
  const blades = Math.round(9000 * k * k);
  for (let b = 0; b < blades; b++) {
    const x0 = rng() * S, y0 = rng() * S, len = (3 + rng() * 7) * k, ang = -Math.PI / 2 + (rng() - 0.5) * 1.6;
    const bright = 0.45 + rng() * 0.55;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    for (let t = 0; t <= len; t += 0.5) {
      const v = bright * (0.55 + 0.45 * t / len);
      const px = ((Math.round(x0 + dx * t) % S) + S) % S, py = ((Math.round(y0 + dy * t) % S) + S) % S;
      const i = py * S + px;
      R[i] = Math.max(R[i], v);
    }
  }
  // touffes plus sombres
  for (let c = 0; c < 140 * k * k; c++) {
    const cx = rng() * S, cy = rng() * S, r = (5 + rng() * 9) * k;
    for (let y = -Math.ceil(r); y <= r; y++) for (let x = -Math.ceil(r); x <= r; x++) {
      const d = Math.hypot(x, y) / r;
      if (d > 1) continue;
      const px = (((Math.round(cx) + x) % S) + S) % S, py = (((Math.round(cy) + y) % S) + S) % S;
      R[py * S + px] *= 0.75 + 0.25 * d;
    }
  }
  normalize(R);

  // --- terre : mottes + cailloux arrondis (ombrés en bas à droite)
  const dn = fbm(rng, S, 6, 5);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) G[y * S + x] = dn(x, y) * 0.5;
  const pebbles = Math.round(1300 * k * k);
  for (let p = 0; p < pebbles; p++) {
    const cx = rng() * S, cy = rng() * S, r = (1.2 + Math.pow(rng(), 2.5) * 6) * k, lv = 0.5 + rng() * 0.45;
    stamp(G, S, cx, cy, r + 1, (x, y) => {
      const d = Math.hypot(x / r, y / (r * 0.8));
      if (d > 1) return null;
      return lv * (0.7 + 0.3 * Math.sqrt(1 - d * d)) - (x + y) / (r * 6);
    });
  }
  normalize(G);

  // --- roche : blocs irréguliers (Voronoï déformé), fissures fines, strates et grain
  const vo = voronoi(rng, S, 5), rn = fbm(rng, S, 4, 5), warp = fbm(rng, S, 3, 3), crk = fbm(rng, S, 16, 3), vv = [0, 0, 0];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const wx = x + (warp(x, y) - 0.5) * S * 0.12, wy = y + (warp(y + 71, x + 13) - 0.5) * S * 0.12;
    vo(((wx % S) + S) % S, ((wy % S) + S) % S, vv);
    const joint = Math.min(1, (vv[1] - vv[0]) * 6); // 0 sur les joints
    const facet = ((vv[2] * 0.6180339) % 1) * 0.22 + (1 - vv[0]) * 0.12;
    const c = crk(x, y), crack = Math.max(0, 1 - Math.abs(c - 0.5) * 22); // fissures fines et sinueuses
    const strata = Math.sin((y / S) * Math.PI * 2 * 6 + rn(x, y) * 7) * 0.07;
    B[y * S + x] = 0.3 + facet + rn(x, y) * 0.5 + strata - Math.pow(1 - joint, 2) * 0.42 - crack * 0.22;
  }
  normalize(B);

  // --- sable : rides ondulées + grain fin
  const sn = fbm(rng, S, 4, 3), grain = valueNoise(rng, 256);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const w = sn(x, y);
    const ripple = Math.sin(((x + y * 0.35) / S) * Math.PI * 2 * 14 + w * 9);
    A[y * S + x] = 0.5 + ripple * 0.22 + (grain(x * 256 / S * 1.0, y * 256 / S * 1.0) - 0.5) * 0.35 + (w - 0.5) * 0.3;
  }
  normalize(A);

  const data = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    data[i * 4] = R[i] * 255; data[i * 4 + 1] = G[i] * 255; data[i * 4 + 2] = B[i] * 255; data[i * 4 + 3] = A[i] * 255;
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// Bruit doux (4 canaux indépendants, sans couture) : variations de teinte à grande échelle,
// écume de l'océan, nuages au sol…
export function makeNoiseTexture(S = 256) {
  const rng = mulberry32(99);
  const data = new Uint8Array(S * S * 4);
  const chans = [fbm(rng, S, 4, 4), fbm(rng, S, 6, 4), fbm(rng, S, 3, 5), fbm(rng, S, 8, 3)];
  const tmp = chans.map(() => new Float32Array(S * S));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) for (let c = 0; c < 4; c++) tmp[c][y * S + x] = chans[c](x, y);
  tmp.forEach((a) => normalize(a, 0.02, 0.98));
  for (let i = 0; i < S * S; i++) for (let c = 0; c < 4; c++) data[i * 4 + c] = tmp[c][i] * 255;
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
