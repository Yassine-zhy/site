// Collisions horizontales (cercles et polygones convexes) rangées dans une grille spatiale.
// Les polygones sont les contours au sol calculés depuis la géométrie réelle des modèles
// (voir Assets.footprints), ce qui colle aux murs, troncs, rochers et clôtures.
// Les obstacles bas marqués « walk » peuvent être enjambés ou servir de plateforme.
const CELL = 8;
export const STEP_UP = 0.65;

export class Colliders {
  constructor() { this.grid = new Map(); this.all = []; this.stamp = 0; }

  key(i, j) { return i * 73856093 ^ j * 19349663; }

  insert(c) {
    this.all.push(c);
    c.id = this.all.length;
    const r = c.r;
    const i0 = Math.floor((c.x - r) / CELL), i1 = Math.floor((c.x + r) / CELL);
    const j0 = Math.floor((c.z - r) / CELL), j1 = Math.floor((c.z + r) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this.key(i, j);
      let list = this.grid.get(k);
      if (!list) { list = []; this.grid.set(k, list); }
      list.push(c);
    }
    return c;
  }

  remove(c) {
    if (!c) return;
    const i = this.all.indexOf(c);
    if (i >= 0) this.all.splice(i, 1);
    for (const list of this.grid.values()) { const k = list.indexOf(c); if (k >= 0) list.splice(k, 1); }
  }

  addCircle(x, z, r, y0 = -1e9, y1 = 1e9, tag, walk = false) { return this.insert({ type: 'circle', x, z, r, y0, y1, tag, walk }); }

  // Boîte orientée = polygone à 4 côtés (conservé pour les anciens appels).
  addBox(x, z, hw, hd, rot, y0 = -1e9, y1 = 1e9, tag, walk = false) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => [x + lx * c + lz * s, z - lx * s + lz * c]);
    return this.addPoly(pts, y0, y1, tag, walk);
  }

  // Polygone convexe en coordonnées monde [[x, z], ...] (n'importe quel sens).
  addPoly(pts, y0 = -1e9, y1 = 1e9, tag, walk = false) {
    const n = pts.length;
    if (n < 3) return null;
    let cx = 0, cz = 0;
    for (const p of pts) { cx += p[0]; cz += p[1]; }
    cx /= n; cz /= n;
    let r = 0;
    for (const p of pts) r = Math.max(r, Math.hypot(p[0] - cx, p[1] - cz));
    const xs = new Float64Array(n), zs = new Float64Array(n), nx = new Float64Array(n), nz = new Float64Array(n), off = new Float64Array(n);
    for (let i = 0; i < n; i++) { xs[i] = pts[i][0]; zs[i] = pts[i][1]; }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ex = xs[j] - xs[i], ez = zs[j] - zs[i];
      const l = Math.hypot(ex, ez) || 1;
      let ux = ez / l, uz = -ex / l;
      // normale tournée vers l'extérieur
      if (ux * (xs[i] - cx) + uz * (zs[i] - cz) < 0) { ux = -ux; uz = -uz; }
      nx[i] = ux; nz[i] = uz; off[i] = ux * xs[i] + uz * zs[i];
    }
    return this.insert({ type: 'poly', x: cx, z: cz, r, n, xs, zs, nx, nz, off, y0, y1, tag, walk });
  }

  // Contours d'un modèle (repère local, déjà à l'échelle) posés à (x, z) avec rotation rot.
  addFootprint(hulls, x, z, rot, y0, y1, tag, walk = false) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const out = [];
    for (const h of hulls) {
      const pts = h.map(([lx, lz]) => [x + lx * c + lz * s, z - lx * s + lz * c]);
      const col = this.addPoly(pts, y0, y1, tag, walk);
      if (col) out.push(col);
    }
    return out;
  }

  // L'obstacle gêne-t-il un corps dont les pieds sont à y ?
  blocks(c, y) {
    if (y + 2.2 < c.y0) return false;
    return y <= c.y1 - (c.walk ? STEP_UP : 0);
  }

  // Repousse un cercle (pos.x, pos.z, rayon) hors des obstacles ; glisse le long des parois.
  resolve(pos, radius, y) {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      let moved = false;
      const i = Math.floor(pos.x / CELL), j = Math.floor(pos.z / CELL);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const list = this.grid.get(this.key(i + di, j + dj));
        if (!list) continue;
        for (const c of list) {
          if (!this.blocks(c, y)) continue;
          const dx = pos.x - c.x, dz = pos.z - c.z;
          if (dx * dx + dz * dz > (c.r + radius) * (c.r + radius)) continue;
          if (c.type === 'circle') {
            const d = Math.hypot(dx, dz), m = c.r + radius;
            if (d < m) {
              if (d > 1e-5) { pos.x = c.x + dx / d * m; pos.z = c.z + dz / d * m; } else pos.x = c.x + m;
              hit = moved = true;
            }
          } else if (this.pushPoly(c, pos, radius)) hit = moved = true;
        }
      }
      if (!moved) break;
    }
    return hit;
  }

  pushPoly(c, pos, radius) {
    const px = pos.x, pz = pos.z, n = c.n;
    let maxD = -Infinity, maxI = 0;
    for (let k = 0; k < n; k++) {
      const d = c.nx[k] * px + c.nz[k] * pz - c.off[k];
      if (d > maxD) { maxD = d; maxI = k; }
    }
    if (maxD >= radius) return false;
    if (maxD <= 0) {
      // centre à l'intérieur : sortie par la paroi la plus proche
      const push = radius - maxD;
      pos.x += c.nx[maxI] * push; pos.z += c.nz[maxI] * push;
      return true;
    }
    // centre à l'extérieur : point le plus proche du contour
    let best = Infinity, bx = 0, bz = 0;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      const ax = c.xs[k], az = c.zs[k], ex = c.xs[k2] - ax, ez = c.zs[k2] - az;
      const l2 = ex * ex + ez * ez || 1;
      let t = ((px - ax) * ex + (pz - az) * ez) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + ex * t, qz = az + ez * t;
      const d2 = (px - qx) * (px - qx) + (pz - qz) * (pz - qz);
      if (d2 < best) { best = d2; bx = qx; bz = qz; }
    }
    const d = Math.sqrt(best);
    if (d >= radius || d < 1e-6) return false;
    const push = radius - d;
    pos.x += (px - bx) / d * push; pos.z += (pz - bz) / d * push;
    return true;
  }

  // Déplacement par petits pas (pas de traversée des parois fines à grande vitesse).
  moveAndCollide(pos, dx, dz, radius, y) {
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / Math.max(0.2, radius * 0.6)));
    let hit = false;
    for (let s = 0; s < steps; s++) {
      pos.x += dx / steps; pos.z += dz / steps;
      if (this.resolve(pos, radius, y)) hit = true;
    }
    return hit;
  }

  // un obstacle quelconque (arbre, rocher, mur…) recouvre-t-il ce point ?
  occupied(x, z, margin = 0) {
    const list = this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) return false;
    for (const c of list) if (c.tag !== 'npc' && this.contains(c, x, z, margin)) return true;
    return false;
  }

  contains(c, x, z, margin = 0) {
    if (c.type === 'circle') return Math.hypot(x - c.x, z - c.z) < c.r + margin;
    for (let k = 0; k < c.n; k++) if (c.nx[k] * x + c.nz[k] * z - c.off[k] > margin) return false;
    return true;
  }

  // Dessus d'obstacle praticable sous (x, z), au plus à maxY (ou null).
  surfaceAt(x, z, maxY, margin = 0.15) {
    const list = this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) return null;
    let best = null;
    for (const c of list) {
      if (!c.walk || c.y1 > maxY || (best !== null && c.y1 <= best)) continue;
      if (this.contains(c, x, z, margin)) best = c.y1;
    }
    return best;
  }

  // un point est-il à l'intérieur d'un bâtiment, d'une ruine ou d'un gros rocher ?
  insideSolid(x, z, y) {
    const list = this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) return false;
    for (const c of list) {
      if (c.tag !== 'building' && c.tag !== 'ruin' && c.tag !== 'monument' && c.tag !== 'rock') continue;
      if (y < c.y0 || y > c.y1) continue;
      if (this.contains(c, x, z)) return true;
    }
    return false;
  }

  // Test de ligne de vue grossier (projectiles) : renvoie true si un obstacle coupe le segment.
  segmentBlocked(ax, az, bx, bz, y) {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5);
    const p = { x: 0, z: 0 };
    for (let s = 1; s < steps; s++) {
      p.x = ax + (bx - ax) * s / steps; p.z = az + (bz - az) * s / steps;
      const ox = p.x, oz = p.z;
      if (this.resolve(p, 0.05, y)) return true;
      p.x = ox; p.z = oz;
    }
    return false;
  }
}
