import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PATHS, VILLAGE, HAMLET, LAKE, FOREST, RUINS, MOUNTAIN, HILLS, LANTERN_PASS, REGIONS, SEA_LEVEL } from '../config.js';
import { zoneAt } from './Terrain.js';
import { decorMaterial } from './SurfaceDetail.js';

// Panneaux indicateurs en bois aux carrefours des chemins et aux sorties des villages et des camps :
// une flèche par direction, avec le nom de la destination et les niveaux de sa zone.
// Tous les panneaux tiennent en deux appels de dessin (bois fusionné + textes dans un atlas).

const BOARD_L = 1.9, BOARD_H = 0.44, TIP = 0.32, DEPTH = 0.07;
const CELL_W = 512, CELL_H = 112, COLS = 4;

// lieux nommés du continent (pour savoir où mène un chemin)
function namedPlaces() {
  const out = [];
  const add = (o, r = 60) => { if (o && o.name && Number.isFinite(o.x) && Number.isFinite(o.z)) out.push({ name: o.name, x: o.x, z: o.z, r: Math.max(r, (o.radius || 0) + 10) }); };
  add(VILLAGE, 80); add(HAMLET, 50); add(LAKE); add(FOREST); add(RUINS); add(MOUNTAIN); add(HILLS); add(LANTERN_PASS, 40);
  for (const def of REGIONS) for (const v of Object.values(def)) if (v && typeof v === 'object' && !Array.isArray(v)) add(v, 50);
  return out;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export class Signposts {
  constructor(scene, terrain, colliders) {
    this.terrain = terrain; this.colliders = colliders;
    this.places = namedPlaces();
    this.labels = new Map(); // texte -> indice dans l'atlas
    this.posts = [];
    this.plan();
    this.build(scene);
  }

  nameAt(x, z, maxD = 90) {
    let best = null, bd = maxD;
    for (const p of this.places) { const d = Math.hypot(p.x - x, p.z - z); if (d < Math.max(bd, 0) && d < p.r + 40) { bd = d; best = p; } }
    return best?.name || null;
  }

  // texte du panneau : nom du lieu (ou de la zone) et niveaux conseillés
  labelFor(x, z) {
    const zn = zoneAt(x, z);
    const name = this.nameAt(x, z) || zn?.name || 'Terres sauvages';
    const safe = Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 90 || Math.hypot(x - HAMLET.x, z - HAMLET.z) < 50;
    const sub = safe ? 'Lieu sûr' : zn ? `Niveaux ${zn.level[0]}–${zn.level[1]}` : '';
    return { name: cap(name), sub };
  }

  labelIndex(l) {
    const key = l.name + '|' + l.sub;
    if (!this.labels.has(key)) this.labels.set(key, { i: this.labels.size, ...l });
    return this.labels.get(key).i;
  }

  // point à une distance donnée le long d'un chemin (depuis son début ou sa fin)
  static along(path, from, dist) {
    const pts = from === 0 ? path : [...path].reverse();
    let left = dist;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      if (left <= L) { const f = left / L; return { x: ax + (bx - ax) * f, z: az + (bz - az) * f, dx: (bx - ax) / L, dz: (bz - az) / L }; }
      left -= L;
    }
    return null;
  }

  blocked(x, z) {
    const t = this.terrain, cols = this.colliders;
    if (t.continentHeight(x, z) < SEA_LEVEL + 0.4 || t.slopeAt(x, z) > 0.55) return true;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const c of cols.grid.get(cols.key(Math.floor(x / 8) + i, Math.floor(z / 8) + j)) || []) if (cols.contains(c, x, z, 0.9)) return true;
    }
    return false;
  }

  // un poteau au départ de chaque chemin qui quitte un carrefour, un village ou un camp
  plan() {
    const key = (pt) => pt[0] + ',' + pt[1];
    const count = new Map();
    for (const p of PATHS) for (const pt of p) count.set(key(pt), (count.get(key(pt)) || 0) + 1);
    // départs de chemins : chaque extrémité de chemin qui touche un autre chemin (ou un lieu nommé)
    for (const path of PATHS) {
      for (const from of [0, 1]) {
        const start = from === 0 ? path[0] : path[path.length - 1];
        const end = from === 0 ? path[path.length - 1] : path[0];
        const isHub = count.get(key(start)) > 1 || this.nameAt(start[0], start[1], 45);
        if (!isHub) continue;
        // on s'écarte du centre du lieu : hors de la place du village ou du camp
        const here = this.places.find((p) => Math.hypot(p.x - start[0], p.z - start[1]) < 30);
        const clear = start[0] === VILLAGE.x && start[1] === VILLAGE.z ? VILLAGE.radius + 8 : here ? Math.min(46, (here.r - 10) + 6) : 7;
        let spot = null;
        for (let d = clear; d < clear + 30 && !spot; d += 4) {
          const a = Signposts.along(path, from, d);
          if (!a) break;
          // à droite du chemin, en regardant vers la destination
          const x = a.x - a.dz * 2.8, z = a.z + a.dx * 2.8;
          if (!this.blocked(x, z)) spot = { x, z, dx: a.dx, dz: a.dz };
        }
        if (!spot) continue;
        const boards = [];
        // vers la destination (le bout du chemin)
        boards.push({ dx: spot.dx, dz: spot.dz, label: this.labelIndex(this.labelFor(end[0], end[1])) });
        // vers le lieu qu'on quitte, s'il a un nom
        const back = this.nameAt(start[0], start[1], 45);
        if (back) boards.push({ dx: -spot.dx, dz: -spot.dz, label: this.labelIndex(this.labelFor(start[0], start[1])) });
        this.posts.push({ x: spot.x, z: spot.z, boards });
      }
    }
  }

  // atlas des textes : lettres brûlées dans le bois
  makeAtlas() {
    const n = this.labels.size, rows = Math.max(1, Math.ceil(n / COLS));
    const cv = document.createElement('canvas');
    cv.width = CELL_W * COLS; cv.height = CELL_H * rows;
    const ctx = cv.getContext('2d');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const l of this.labels.values()) {
      const cx = (l.i % COLS) * CELL_W + CELL_W / 2, cy = Math.floor(l.i / COLS) * CELL_H;
      let size = 44;
      ctx.font = `bold ${size}px Georgia, 'Times New Roman', serif`;
      while (ctx.measureText(l.name).width > CELL_W - 36 && size > 22) { size -= 2; ctx.font = `bold ${size}px Georgia, 'Times New Roman', serif`; }
      const y1 = cy + (l.sub ? CELL_H * 0.38 : CELL_H * 0.5);
      ctx.fillStyle = 'rgba(255,236,196,0.55)'; ctx.fillText(l.name, cx + 1.5, y1 + 1.5);
      ctx.fillStyle = '#2e1a0c'; ctx.fillText(l.name, cx, y1);
      if (l.sub) {
        ctx.font = `600 28px Georgia, 'Times New Roman', serif`;
        ctx.fillStyle = l.sub === 'Lieu sûr' ? '#1f4a22' : '#6a1d12';
        ctx.fillText(l.sub, cx, cy + CELL_H * 0.78);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { tex, rows };
  }

  build(scene) {
    if (!this.posts.length) return;
    const { tex, rows } = this.makeAtlas();
    const wood = [], text = [];
    const postGeo = new THREE.CylinderGeometry(0.11, 0.14, 3.1, 7); postGeo.translate(0, 1.45, 0);
    const capGeo = new THREE.ConeGeometry(0.2, 0.22, 7); capGeo.translate(0, 3.1, 0);
    const shape = new THREE.Shape();
    shape.moveTo(0, -BOARD_H / 2); shape.lineTo(BOARD_L - TIP, -BOARD_H / 2); shape.lineTo(BOARD_L, 0);
    shape.lineTo(BOARD_L - TIP, BOARD_H / 2); shape.lineTo(0, BOARD_H / 2); shape.lineTo(0, -BOARD_H / 2);
    const boardGeo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false });
    boardGeo.translate(0.08, 0, -DEPTH / 2);
    const tw = BOARD_L - TIP - 0.16, thh = BOARD_H * 0.9;
    const color = (g, c) => { const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s1 = new THREE.Vector3(1, 1, 1);
    for (const p of this.posts) {
      const y = this.terrain.heightAt(p.x, p.z) - 0.15;
      const tilt = (Math.sin(p.x * 0.13 + p.z * 0.07)) * 0.03;
      m.compose(new THREE.Vector3(p.x, y, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, 0, -tilt)), s1);
      wood.push(color(postGeo.clone().applyMatrix4(m), '#6b4a2e'), color(capGeo.clone().applyMatrix4(m), '#4f3420'));
      p.boards.forEach((b, k) => {
        const yaw = Math.atan2(-b.dz, b.dx);
        q.setFromAxisAngle(up, yaw);
        const by = y + 2.55 - k * 0.56;
        m.compose(new THREE.Vector3(p.x, by, p.z), q, s1);
        wood.push(color(boardGeo.clone().applyMatrix4(m), k % 2 ? '#a07a4c' : '#b08655'));
        // textes des deux faces (le dos est retourné pour se lire à l'endroit)
        const u0 = (b.label % COLS) / COLS, v0 = 1 - (Math.floor(b.label / COLS) + 1) / rows;
        for (const side of [1, -1]) {
          const pg = new THREE.PlaneGeometry(tw, thh);
          const uv = pg.attributes.uv;
          for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / COLS, v0 + uv.getY(i) / rows);
          if (side < 0) pg.rotateY(Math.PI);
          pg.translate(0.08 + (BOARD_L - TIP) / 2, 0, side * (DEPTH / 2 + 0.004));
          text.push(pg.applyMatrix4(m));
        }
      });
      this.colliders.addCircle(p.x, p.z, 0.3, y - 1, y + 3.2, 'prop');
    }
    const woodGeo = mergeGeometries(wood.map((g) => g.index ? g.toNonIndexed() : g).map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) g.deleteAttribute(k); return g; }));
    const woodMat = decorMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }));
    this.wood = new THREE.Mesh(woodGeo, woodMat);
    this.wood.castShadow = true; this.wood.receiveShadow = true;
    this.text = new THREE.Mesh(mergeGeometries(text), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.text.renderOrder = 2;
    this.group = new THREE.Group();
    this.group.add(this.wood, this.text);
    this.group.name = 'signposts';
    scene.add(this.group);
  }
}
