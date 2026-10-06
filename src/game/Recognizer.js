// Reconnaissance de gestes "$P Point-Cloud" (Vatavu, Anthony & Wobbrock, 2012),
// insensible au sens du tracé et au point de départ. Gabarits générés par code.
const N = 40;

function pathLength(pts) { let d = 0; for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return d; }

function resample(points, n) {
  const pts = points.map((p) => ({ x: p.x, y: p.y }));
  const I = pathLength(pts) / (n - 1);
  let D = 0;
  const out = [{ ...pts[0] }];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (D + d >= I && d > 0) {
      const t = (I - D) / d;
      const q = { x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x), y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y) };
      out.push(q);
      pts.splice(i, 0, q);
      D = 0;
    } else D += d;
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out.slice(0, n);
}

function normalize(points) {
  let pts = resample(points, N);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  const size = Math.max(maxX - minX, maxY - minY) || 1;
  pts = pts.map((p) => ({ x: (p.x - minX) / size, y: (p.y - minY) / size }));
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= pts.length; cy /= pts.length;
  return pts.map((p) => ({ x: p.x - cx, y: p.y - cy }));
}

function cloudDistance(a, b, start) {
  const matched = new Array(a.length).fill(false);
  let sum = 0, i = start;
  do {
    let idx = -1, min = Infinity;
    for (let j = 0; j < matched.length; j++) {
      if (matched[j]) continue;
      const d = Math.hypot(a[i].x - b[j].x, a[i].y - b[j].y);
      if (d < min) { min = d; idx = j; }
    }
    matched[idx] = true;
    const weight = 1 - ((i - start + a.length) % a.length) / a.length;
    sum += weight * min;
    i = (i + 1) % a.length;
  } while (i !== start);
  return sum;
}

function greedyMatch(pts, tmpl) {
  const e = 0.5;
  const step = Math.floor(Math.pow(pts.length, 1 - e));
  let min = Infinity;
  for (let i = 0; i < pts.length; i += step) {
    min = Math.min(min, cloudDistance(pts, tmpl, i), cloudDistance(tmpl, pts, i));
  }
  return min;
}

// ----------------------------------------------------------------- gabarits
function poly(...pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    for (let k = 0; k < 10; k++) out.push({ x: ax + (bx - ax) * k / 10, y: ay + (by - ay) * k / 10 });
  }
  out.push({ x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] });
  return out;
}

function circle(rx = 1, ry = 1, turns = 1, start = 0) {
  const out = [];
  for (let i = 0; i <= 48 * turns; i++) { const a = start + i / 48 * Math.PI * 2; out.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry }); }
  return out;
}

function spiral(turns = 2.2) {
  const out = [];
  const n = 90;
  for (let i = 0; i <= n; i++) { const t = i / n; const a = t * turns * Math.PI * 2; const r = 0.15 + t * 0.85; out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); }
  return out;
}

export const GLYPHS = {
  ignis: [poly([0, 1], [0.5, 0], [1, 1], [0, 1]), poly([0.5, 0], [1, 1], [0, 1], [0.5, 0]), poly([0, 0.95], [0.48, 0], [0.98, 1], [0.02, 0.98])],
  vita: [circle(), circle(1, 0.85), circle(0.9, 1)],
  fulgur: [poly([0.7, 0], [0.25, 0.5], [0.75, 0.5], [0.3, 1]), poly([0.65, 0], [0.2, 0.55], [0.7, 0.45], [0.25, 1]), poly([0.6, 0], [0.3, 0.45], [0.65, 0.55], [0.35, 1])],
  aegis: [poly([0, 0], [0.5, 1], [1, 0]), poly([0, 0.1], [0.45, 1], [1, 0])],
  ventus: [spiral(2.2), spiral(1.7), spiral(2.6)],
  lux: [poly([0.5, 1], [0.5, 0]), poly([0.5, 0], [0.48, 1])],
};

const TEMPLATES = [];
for (const [name, list] of Object.entries(GLYPHS)) for (const pts of list) TEMPLATES.push({ name, cloud: normalize(pts) });

// Renvoie { name, score (0..1) } ou null si le tracé est trop court.
export function recognize(points) {
  if (points.length < 6 || pathLength(points) < 30) return null;
  const pts = normalize(points);
  let best = null, bestD = Infinity;
  const perName = {};
  for (const t of TEMPLATES) {
    const d = greedyMatch(pts, t.cloud);
    if (!perName[t.name] || d < perName[t.name]) perName[t.name] = d;
    if (d < bestD) { bestD = d; best = t.name; }
  }
  // ligne verticale : $P ne voit pas bien la différence avec un V très fermé ; on vérifie le rapport d'aspect
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const aspect = (maxX - minX) / Math.max(1, maxY - minY);
  if (aspect < 0.18) { best = 'lux'; bestD = Math.min(bestD, perName.lux ?? bestD); }
  const score = Math.max(0, Math.min(1, (2.6 - bestD) / 2.1));
  return { name: best, score, d: bestD };
}

// chemin SVG d'un glyphe (pour l'aide et l'affichage)
export function glyphPath(name, size = 24, pad = 3) {
  const pts = GLYPHS[name][0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  const s = (size - pad * 2) / Math.max(maxX - minX, maxY - minY, 0.001);
  const ox = pad + ((size - pad * 2) - (maxX - minX) * s) / 2, oy = pad + ((size - pad * 2) - (maxY - minY) * s) / 2;
  return pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1).map((p, i) => (i ? 'L' : 'M') + ((p.x - minX) * s + ox).toFixed(1) + ' ' + ((p.y - minY) * s + oy).toFixed(1)).join(' ');
}
