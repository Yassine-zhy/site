import * as THREE from 'three';
import { Simplex, clamp, smoothstep, lerp, TAU } from '../engine/math.js';

// Une île flottante : surface supérieure (grille projetée sur le littoral)
// + face inférieure rocheuse en stalactite. Fournit une requête de hauteur exacte.
export class Island {
  constructor({ x, z, radius, coastNoise = 8, seed = 1, cells = 96, heightFn, colorFn, depth, name = 'île', lipY }) {
    this.cx = x; this.cz = z; this.radius = radius; this.coastNoise = coastNoise;
    this.noise = new Simplex(seed);
    this.heightFn = heightFn; this.colorFn = colorFn; this.name = name;
    this.depth = depth ?? radius * 1.3;
    this.lipYFn = lipY;
    this.half = radius + coastNoise + 3;
    this.cells = cells;
    this.cellSize = (this.half * 2) / cells;
    this.minX = x - this.half; this.minZ = z - this.half;
    this.heights = new Float32Array((cells + 1) * (cells + 1));
    this.projected = new Uint8Array((cells + 1) * (cells + 1));
  }

  coastR(theta) {
    const n = this.noise;
    const c = Math.cos(theta), s = Math.sin(theta);
    const v = n.noise2(c * 1.3 + 7.1, s * 1.3 + 3.3) * 0.6 + n.noise2(c * 3.1 + 1.7, s * 3.1 - 4.2) * 0.3 + n.noise2(c * 7 + 9, s * 7 + 2) * 0.1;
    return this.radius + v * this.coastNoise;
  }

  // Hauteur "analytique" (avant facettage) avec rebord côtier.
  rawHeight(x, z) {
    const dx = x - this.cx, dz = z - this.cz;
    const rho = Math.hypot(dx, dz);
    const th = Math.atan2(dz, dx);
    const rc = this.coastR(th);
    const toCoast = rc - rho;
    const h = this.heightFn(x, z);
    const lip = this.lipY(th);
    const t = smoothstep(0, 10, toCoast);
    return lerp(lip, h, t);
  }

  lipY(theta) {
    if (this.lipYFn) return this.lipYFn(theta);
    const px = this.cx + Math.cos(theta) * this.radius, pz = this.cz + Math.sin(theta) * this.radius;
    return this.heightFn(px, pz) - 1.5;
  }

  isInside(x, z) {
    const dx = x - this.cx, dz = z - this.cz;
    const rho = Math.hypot(dx, dz);
    if (rho > this.radius + this.coastNoise + 2) return false;
    return rho <= this.coastR(Math.atan2(dz, dx));
  }

  build() {
    const N = this.cells, S = this.cellSize;
    const vcount = (N + 1) * (N + 1);
    const pos = new Float32Array(vcount * 3);
    const col = new Float32Array(vcount * 3);
    const tmp = new THREE.Color();
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const idx = j * (N + 1) + i;
        let x = this.minX + i * S, z = this.minZ + j * S;
        const dx = x - this.cx, dz = z - this.cz;
        const rho = Math.hypot(dx, dz), th = Math.atan2(dz, dx);
        const rc = this.coastR(th);
        let y;
        if (rho > rc - 0.01) {
          x = this.cx + Math.cos(th) * rc; z = this.cz + Math.sin(th) * rc;
          y = this.lipY(th) - 1.2;
          this.projected[idx] = 1;
        } else {
          y = this.rawHeight(x, z);
        }
        this.heights[idx] = y;
        pos[idx * 3] = x; pos[idx * 3 + 1] = y; pos[idx * 3 + 2] = z;
      }
    }
    // couleurs (pente calculée sur la grille)
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const idx = j * (N + 1) + i;
        const x = pos[idx * 3], y = pos[idx * 3 + 1], z = pos[idx * 3 + 2];
        const hl = this.heights[j * (N + 1) + Math.max(0, i - 1)], hr = this.heights[j * (N + 1) + Math.min(N, i + 1)];
        const hd = this.heights[Math.max(0, j - 1) * (N + 1) + i], hu = this.heights[Math.min(N, j + 1) * (N + 1) + i];
        const gx = (hr - hl) / (2 * S), gz = (hu - hd) / (2 * S);
        const slope = Math.atan(Math.hypot(gx, gz)) / (Math.PI / 2);
        this.colorFn(tmp, x, y, z, slope, this.projected[idx] === 1);
        col[idx * 3] = tmp.r; col[idx * 3 + 1] = tmp.g; col[idx * 3 + 2] = tmp.b;
      }
    }
    const index = [];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i, b = a + 1, c = a + (N + 1), d = c + 1;
        // a=(i,j) b=(i+1,j) c=(i,j+1) d=(i+1,j+1)
        if (this.projected[a] && this.projected[b] && this.projected[c] && this.projected[d]) continue;
        index.push(a, c, b, c, d, b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    this.topGeometry = geo;
    this.underGeometry = this.buildUnderside();
    return this;
  }

  // Tuiles de la surface (mêmes sommets partagés, index propre) : seules les tuiles
  // visibles sont dessinées, et l'ombre portée ne concerne que celles proches du joueur.
  chunkGeometries(target = 48) {
    const N = this.cells, geo = this.topGeometry;
    const C = Math.max(16, Math.ceil(N / Math.max(1, Math.round(N / target))));
    if (C >= N) return [geo];
    const pos = geo.attributes.position.array, P = this.projected;
    const out = [], v = new THREE.Vector3();
    for (let cj = 0; cj < N; cj += C) for (let ci = 0; ci < N; ci += C) {
      const idx = [];
      const j1 = Math.min(N, cj + C), i1 = Math.min(N, ci + C);
      for (let j = cj; j < j1; j++) for (let i = ci; i < i1; i++) {
        const a = j * (N + 1) + i, b = a + 1, c = a + (N + 1), d = c + 1;
        if (P[a] && P[b] && P[c] && P[d]) continue;
        idx.push(a, c, b, c, d, b);
      }
      if (!idx.length) continue;
      const g = new THREE.BufferGeometry();
      for (const k of ['position', 'normal', 'color']) g.setAttribute(k, geo.attributes[k]);
      g.setIndex(idx);
      const box = new THREE.Box3();
      for (let j = cj; j <= j1; j++) for (let i = ci; i <= i1; i++) box.expandByPoint(v.fromArray(pos, (j * (N + 1) + i) * 3));
      g.boundingBox = box;
      g.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
      out.push(g);
    }
    return out;
  }

  buildUnderside() {
    const segs = Math.max(48, Math.round(this.radius * 1.1));
    const rings = Math.max(10, Math.round(this.depth / 7));
    const n = this.noise;
    const pos = [], col = [];
    const cTop = new THREE.Color('#7b5a3c'), cMid = new THREE.Color('#6d625c'), cDeep = new THREE.Color('#463f58'), cMoss = new THREE.Color('#5f7d44');
    const tmp = new THREE.Color();
    const ringPts = [];
    for (let k = 0; k <= rings; k++) {
      const t = k / rings;
      const row = [];
      for (let s = 0; s < segs; s++) {
        const th = (s / segs) * TAU;
        const rc = this.coastR(th) + 0.6;
        const lip = this.lipY(th) - 0.4;
        const nn = n.noise3(Math.cos(th) * 2.2, Math.sin(th) * 2.2, t * 3.5) * 0.5 + n.noise3(Math.cos(th) * 6, Math.sin(th) * 6, t * 9 + 4) * 0.22;
        let sc = Math.pow(1 - t, 0.75) * (1 + nn * (0.28 + t * 0.3));
        if (k === 0) sc = 1;
        if (k === 1) sc = Math.min(sc, 1.0) * 0.98;
        const depth = Math.pow(t, 1.25) * this.depth * (1 + nn * 0.15);
        const x = this.cx + Math.cos(th) * rc * sc;
        const z = this.cz + Math.sin(th) * rc * sc;
        const y = lip - depth - (k === 0 ? 0 : 1.5);
        row.push([x, y, z, t, nn]);
      }
      ringPts.push(row);
    }
    const tip = [this.cx + n.noise2(3, 4) * 3, ringPts[rings][0][1] - this.depth * 0.08, this.cz + n.noise2(5, 1) * 3];
    const pushV = (p, t, nn) => {
      pos.push(p[0], p[1], p[2]);
      if (t < 0.08) tmp.copy(cMoss).lerp(cTop, t / 0.08);
      else if (t < 0.45) tmp.copy(cTop).lerp(cMid, (t - 0.08) / 0.37);
      else tmp.copy(cMid).lerp(cDeep, (t - 0.45) / 0.55);
      const v = 0.9 + nn * 0.25;
      col.push(tmp.r * v, tmp.g * v, tmp.b * v);
    };
    for (let k = 0; k < rings; k++) {
      for (let s = 0; s < segs; s++) {
        const s2 = (s + 1) % segs;
        const a = ringPts[k][s], b = ringPts[k][s2], c = ringPts[k + 1][s], d = ringPts[k + 1][s2];
        pushV(a, a[3], a[4]); pushV(b, b[3], b[4]); pushV(c, c[3], c[4]);
        pushV(b, b[3], b[4]); pushV(d, d[3], d[4]); pushV(c, c[3], c[4]);
      }
    }
    for (let s = 0; s < segs; s++) {
      const s2 = (s + 1) % segs;
      const a = ringPts[rings][s], b = ringPts[rings][s2];
      pushV(a, 1, a[4]); pushV(b, 1, b[4]); pushV(tip, 1, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }

  // Hauteur exacte du maillage (null si hors de l'île).
  heightAt(x, z) {
    const N = this.cells, S = this.cellSize;
    const fx = (x - this.minX) / S, fz = (z - this.minZ) / S;
    if (fx < 0 || fz < 0 || fx >= N || fz >= N) return null;
    if (!this.isInside(x, z)) return null;
    const i = Math.floor(fx), j = Math.floor(fz);
    const a = j * (N + 1) + i, b = a + 1, c = a + (N + 1), d = c + 1;
    if (this.projected[a] || this.projected[b] || this.projected[c] || this.projected[d]) return this.rawHeight(x, z);
    const u = fx - i, v = fz - j;
    const H = this.heights;
    if (u + v <= 1) return H[a] + (H[b] - H[a]) * u + (H[c] - H[a]) * v;
    return H[d] + (H[c] - H[d]) * (1 - u) + (H[b] - H[d]) * (1 - v);
  }

  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 0.8;
    const h0 = this.heightAt(x, z) ?? 0;
    const hx = this.heightAt(x + e, z) ?? h0, hz = this.heightAt(x, z + e) ?? h0;
    return out.set(h0 - hx, e, h0 - hz).normalize();
  }
}

export function clamp01(v) { return clamp(v, 0, 1); }
