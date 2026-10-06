// Collisions horizontales simples (cercles et boîtes orientées) dans une grille spatiale.
const CELL = 8;

export class Colliders {
  constructor() { this.grid = new Map(); this.all = []; }

  key(i, j) { return i * 73856093 ^ j * 19349663; }

  insert(c) {
    this.all.push(c);
    const r = c.type === 'circle' ? c.r : Math.hypot(c.hw, c.hd);
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

  addCircle(x, z, r, y0 = -1e9, y1 = 1e9, tag) { return this.insert({ type: 'circle', x, z, r, y0, y1, tag }); }
  addBox(x, z, hw, hd, rot, y0 = -1e9, y1 = 1e9, tag) {
    return this.insert({ type: 'box', x, z, hw, hd, rot, cos: Math.cos(rot), sin: Math.sin(rot), y0, y1, tag });
  }

  // Repousse un cercle (px,pz,rayon) hors des obstacles. Modifie et renvoie pos.
  resolve(pos, radius, y) {
    const i = Math.floor(pos.x / CELL), j = Math.floor(pos.z / CELL);
    let hit = false;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const list = this.grid.get(this.key(i + di, j + dj));
      if (!list) continue;
      for (const c of list) {
        if (y + 2.2 < c.y0 || y > c.y1) continue;
        if (c.type === 'circle') {
          const dx = pos.x - c.x, dz = pos.z - c.z;
          const d = Math.hypot(dx, dz), m = c.r + radius;
          if (d < m && d > 1e-5) { pos.x = c.x + dx / d * m; pos.z = c.z + dz / d * m; hit = true; }
        } else {
          // repère local de la boîte
          const dx = pos.x - c.x, dz = pos.z - c.z;
          const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
          const cx = Math.max(-c.hw, Math.min(c.hw, lx)), cz = Math.max(-c.hd, Math.min(c.hd, lz));
          let ox = lx - cx, oz = lz - cz;
          let d = Math.hypot(ox, oz);
          if (d < radius) {
            let nx, nz;
            if (d < 1e-5) {
              // centre dans la boîte : sortie par l'axe le plus proche
              const px = c.hw - Math.abs(lx), pz = c.hd - Math.abs(lz);
              if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; d = -px; } else { nx = 0; nz = Math.sign(lz) || 1; d = -pz; }
            } else { nx = ox / d; nz = oz / d; }
            const push = radius - d;
            const lx2 = lx + nx * push, lz2 = lz + nz * push;
            pos.x = c.x + lx2 * c.cos + lz2 * c.sin;
            pos.z = c.z - lx2 * c.sin + lz2 * c.cos;
            hit = true;
          }
        }
      }
    }
    return hit;
  }

  // un point est-il à l'intérieur d'un bâtiment / d'une ruine ?
  insideSolid(x, z, y) {
    const list = this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) return false;
    for (const c of list) {
      if (c.tag !== 'building' && c.tag !== 'ruin' && c.tag !== 'monument') continue;
      if (y < c.y0 || y > c.y1) continue;
      if (c.type === 'circle') { if (Math.hypot(x - c.x, z - c.z) < c.r) return true; }
      else {
        const dx = x - c.x, dz = z - c.z;
        const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
        if (Math.abs(lx) < c.hw && Math.abs(lz) < c.hd) return true;
      }
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
