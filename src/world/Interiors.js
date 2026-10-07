import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Decor } from './Decor.js';
import { VirtualLight } from './Lights.js';
import { decorMaterial } from './SurfaceDetail.js';
import { mulberry32 } from '../engine/math.js';

// Intérieurs des bâtiments : de vraies salles à l'échelle des héros (plafonds à 7 m, portes de
// 4 m), construites à l'écart du continent. On y entre par la porte d'un bâtiment (le monde
// s'efface en fondu) et on en ressort au même endroit.
//
//   taverne · forge · guilde des aventuriers · chapelle · maison · tour de l'archimage

export const ROOM_X = 9000, ROOM_STEP = 160;
export const ROOMS = {
  tavern: { i: 0, name: 'Taverne du Cœur Doré', w: 26, d: 18, h: 7, floor: 'plank', wall: 'timber' },
  forge: { i: 1, name: 'Forge de Brom', w: 22, d: 16, h: 7.5, floor: 'stone', wall: 'stone' },
  guild: { i: 2, name: 'Guilde des Aventuriers', w: 30, d: 22, h: 9, floor: 'stone', wall: 'hall' },
  chapel: { i: 3, name: 'Chapelle de l’Aube', w: 16, d: 28, h: 10, floor: 'stone', wall: 'chapel' },
  home: { i: 4, name: 'Maison', w: 14, d: 12, h: 6, floor: 'plank', wall: 'timber' },
  tower: { i: 5, name: 'Tour de l’Archimage', w: 18, d: 18, h: 11, floor: 'stone', wall: 'tower' },
};
export const FLOOR_Y = 0.12;
export function roomOrigin(id) { return { x: ROOM_X + ROOMS[id].i * ROOM_STEP, z: 0 }; }
// quel intérieur à cette position ?
export function roomAt(x, z) {
  if (x < ROOM_X - 40) return null;
  for (const [id, r] of Object.entries(ROOMS)) {
    const o = roomOrigin(id);
    if (Math.abs(x - o.x) < r.w / 2 + 2 && Math.abs(z - o.z) < r.d / 2 + 2) return id;
  }
  return null;
}
// point d'arrivée (juste derrière la porte, au sud) et sortie
export function roomSpawn(id) { const o = roomOrigin(id), r = ROOMS[id]; return { x: o.x, z: o.z + r.d / 2 - Math.min(5.5, r.d * 0.4), facing: Math.PI }; }
export function roomExit(id) { const o = roomOrigin(id), r = ROOMS[id]; return { x: o.x, z: o.z + r.d / 2 - 0.9 }; }

// habitants des intérieurs (positions fixes dans les salles)
const at = (id, dx, dz, fx, fz) => { const o = roomOrigin(id); return { x: o.x + dx, z: o.z + dz, face: [o.x + fx, o.z + fz], room: id }; };
export const INTERIOR_NPCS = {
  smith: at('forge', 3.5, -2.5, 0, 6),
  innkeeper: at('tavern', 8.5, -3, 0, 4),
  guildmaster: at('guild', 0, -7.5, 0, 6),
  priestess: at('chapel', 0, -10, 0, 0),
  archmage: at('tower', -3, -3, 0, 5),
};

// --------------------------------------------------------------- géométrie colorée (boîtes)
const _c = new THREE.Color();
class Shapes {
  constructor(seed) { this.parts = []; this.rng = mulberry32(seed); }
  box(x, y, z, w, h, d, color, ry = 0, jitter = 0.05) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    this.paint(g, color, jitter);
    return g;
  }
  cyl(x, y, z, r0, r1, h, color, seg = 8) {
    const g = new THREE.CylinderGeometry(r1, r0, h, seg).toNonIndexed();
    g.translate(x, y, z);
    this.paint(g, color, 0.04);
    return g;
  }
  paint(g, color, jitter) {
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    g.computeVertexNormals();
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    const base = new THREE.Color(color);
    for (let f = 0; f < n; f += 6) {
      _c.copy(base).offsetHSL(0, 0, (this.rng() - 0.5) * jitter);
      for (let v = 0; v < 6 && f + v < n; v++) col.set([_c.r, _c.g, _c.b], (f + v) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(g);
  }
  mesh(material) {
    const geo = mergeGeometries(this.parts, false);
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
}

const COL = {
  plank: ['#8a5a36', '#7a4e2e', '#946240', '#6e4529'], beam: '#4f3420', plaster: '#e6d8bc', plasterB: '#d8c7a6',
  stone: ['#7d7a74', '#6f6c67', '#888479', '#75716a'], stoneWall: '#8f897d', stoneDark: '#5d5952', hall: '#9a9182',
  chapelWall: '#ece4d4', tower: '#7a7488', rug: '#8a2f2f',
};

export class Interiors extends Decor {
  constructor(scene, assets, terrain, colliders) {
    super(scene, assets, terrain, colliders, 'interiors');
    this.fallbackY = FLOOR_Y;
    this.terrain = terrain;
    this.mat = decorMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: true }));
    this.shells = [];
    this.glassMats = {};
    this.rooms = {};
    this.spots = {}; // objets interactifs par salle : chaises, lits, enclume…
    // sols : des « îles » plates pour la requête de hauteur
    for (const id of Object.keys(ROOMS)) {
      const o = roomOrigin(id), r = ROOMS[id];
      terrain.islands.push({
        def: { id: 'room-' + id, biome: 'interior' }, name: r.name, interior: id,
        heightAt: (x, z) => (Math.abs(x - o.x) <= r.w / 2 + 0.6 && Math.abs(z - o.z) <= r.d / 2 + 0.6 ? FLOOR_Y : null),
        isInside: (x, z) => Math.abs(x - o.x) <= r.w / 2 && Math.abs(z - o.z) <= r.d / 2,
      });
    }
    for (const id of Object.keys(ROOMS)) this.build(id);
    this.mergeStatic(200);
  }

  // ------------------------------------------------------------- enveloppe d'une salle
  build(id) {
    const r = ROOMS[id], o = roomOrigin(id), S = new Shapes(31 + r.i * 7);
    const W = r.w, D = r.d, H = r.h, x0 = o.x - W / 2, x1 = o.x + W / 2, z0 = o.z - D / 2, z1 = o.z + D / 2;
    this.spots[id] = [];
    // sol
    if (r.floor === 'plank') {
      for (let z = z0; z < z1 - 0.01; z += 0.9) {
        let x = x0;
        while (x < x1 - 0.01) {
          const L = Math.min(x1 - x, 2.5 + S.rng() * 3.5);
          S.box(x + L / 2, 0.06, z + 0.45, L - 0.03, 0.12, 0.86, COL.plank[Math.floor(S.rng() * 4)], 0, 0.08);
          x += L;
        }
      }
    } else {
      for (let z = z0; z < z1 - 0.01; z += 2) for (let x = x0; x < x1 - 0.01; x += 2) {
        const w = Math.min(2, x1 - x), d = Math.min(2, z1 - z);
        S.box(x + w / 2, 0.06, z + d / 2, w - 0.07, 0.12, d - 0.07, COL.stone[Math.floor(S.rng() * 4)], 0, 0.1);
      }
      S.box(o.x, 0.02, o.z, W, 0.04, D, '#2e2b28', 0, 0);
    }
    // murs (porte au sud), plafond, poutres
    const wallCol = r.wall === 'timber' ? COL.plaster : r.wall === 'chapel' ? COL.chapelWall : r.wall === 'tower' ? COL.tower : r.wall === 'hall' ? COL.hall : COL.stoneWall;
    const T = 0.6;
    const wall = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2, ry = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
      S.box(cx, H / 2, cz, len, H, T, wallCol, ry, 0.03);
      // soubassement de pierre et colombages
      S.box(cx, 0.55, cz, len, 1.1, T + 0.12, r.wall === 'timber' ? COL.stoneDark : COL.stoneDark, ry, 0.06);
      if (r.wall === 'timber' || r.wall === 'hall') {
        const n = Math.max(1, Math.round(len / 3.2)), dx = (bx - ax) / len, dz = (bz - az) / len;
        for (let i = 0; i <= n; i++) S.box(cx + dx * len * (i / n - 0.5), H / 2, cz + dz * len * (i / n - 0.5), 0.35, H, T + 0.16, COL.beam, ry, 0.04);
        S.box(cx, H * 0.48, cz, len, 0.3, T + 0.14, COL.beam, ry, 0.03);
        S.box(cx, H - 0.25, cz, len, 0.5, T + 0.18, COL.beam, ry, 0.03);
      } else {
        // pilastres de pierre
        const n = Math.max(1, Math.round(len / 5));
        const dx = (bx - ax) / len, dz = (bz - az) / len;
        for (let i = 1; i < n; i++) S.box(cx + dx * len * (i / n - 0.5), H / 2, cz + dz * len * (i / n - 0.5), 0.9, H, T + 0.4, COL.stoneDark, ry, 0.05);
      }
      this.colliders.addBox(cx, cz, len / 2, T / 2 + 0.05, ry, -5, H + 2, 'building');
    };
    wall(x0, z0, x1, z0); // nord
    wall(x0, z0, x0, z1); // ouest
    wall(x1, z0, x1, z1); // est
    const gap = 3.4;
    wall(x0, z1, o.x - gap / 2, z1); wall(o.x + gap / 2, z1, x1, z1);
    // linteau et porte de sortie (fermée derrière l'ouverture)
    S.box(o.x, (4.3 + H) / 2, z1, gap + 0.2, H - 4.3, T, wallCol, 0, 0.03);
    S.box(o.x, 4.45, z1 - 0.05, gap + 0.8, 0.4, T + 0.3, COL.beam);
    for (const sx of [-1, 1]) S.box(o.x + sx * (gap / 2 + 0.15), 2.2, z1 - 0.05, 0.35, 4.4, T + 0.3, COL.beam);
    for (let k = 0; k < 4; k++) S.box(o.x - gap / 2 + 0.42 + k * 0.85, 2.15, z1 + 0.42, 0.8, 4.1, 0.16, k % 2 ? '#6b4428' : '#5e3b22', 0, 0.06);
    S.box(o.x + 1.0, 2.1, z1 + 0.3, 0.12, 0.35, 0.12, '#c9a24a');
    this.colliders.addBox(o.x, z1 + 0.45, gap / 2, 0.3, 0, -5, H + 2, 'building');
    // plafond et poutres maîtresses
    S.box(o.x, H + 0.3, o.z, W + T * 2, 0.6, D + T * 2, r.wall === 'chapel' ? '#d9cfba' : '#6a4a30', 0, 0.02);
    for (let z = z0 + 2.5; z < z1 - 1; z += 4) S.box(o.x, H - 0.35, z, W, 0.55, 0.55, COL.beam, 0, 0.04);
    this.colliders.addBox(o.x, o.z, W / 2 + 1, D / 2 + 1, 0, H - 0.2, H + 3, 'building');
    // fenêtres lumineuses (lumière du jour qui filtre)
    const win = (x, z, ry, color = '#fff1c8', w = 2.2, hh = 2.6, y = H * 0.55) => {
      S.box(x, y, z, w + 0.4, hh + 0.4, 0.25, COL.beam, ry);
      S.box(x, y, z, 0.14, hh, 0.32, COL.beam, ry);
      S.box(x, y, z, w, 0.14, 0.32, COL.beam, ry);
      const glass = this.glassMats[color] || (this.glassMats[color] = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.7), toneMapped: false }));
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), glass);
      pane.position.set(x, y, z); pane.rotation.y = ry;
      this.group.add(pane); this.keep.add(pane);
      const l = new VirtualLight(color, 6, 12, 1.4);
      l.position.set(x + Math.sin(ry) * 2.5, y, z + Math.cos(ry) * 2.5);
      this.group.add(l); this.lights.push(l);
    };
    this.rooms[id] = { r, o, S, win, x0, x1, z0, z1, W, D, H };
    this['furnish_' + id]?.(this.rooms[id]);
    // l'enveloppe garde ses couleurs : hors de la fusion des décors
    const shell = S.mesh(this.mat);
    this.scene.add(shell);
    (this.scene.userData.staticMeshes = this.scene.userData.staticMeshes || []).push(shell);
  }

  P(name, x, z, s, r = 0, yoff = 0, col = true) { return this.placeProp(name, x, z, s, r, yoff, col); }

  // lampe suspendue à une chaîne : lumière chaude permanente
  hangLamp(x, z, y, color = '#ffb35c', inten = 18) {
    const L = this.assets.prop('hw_lantern_hanging');
    if (L) { L.position.set(x, y, z); L.scale.setScalar(1.3); this.group.add(L); }
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(4), toneMapped: false }));
    glow.position.set(x, y - 1.3, z); this.group.add(glow); this.keep.add(glow);
    const l = new VirtualLight(color, inten, 16, 1.5);
    l.position.set(x, y - 1.5, z); this.group.add(l); this.lights.push(l);
  }

  // cheminée de pierre contre le mur nord, avec un vrai feu
  fireplace(R, x, z) {
    const S = R.S;
    S.box(x, 1.6, z + 0.2, 4.4, 3.2, 1.4, COL.stoneDark, 0, 0.1);
    S.box(x, 1.2, z + 0.95, 2.6, 2.0, 0.2, '#1f1a16', 0, 0);
    S.box(x, 3.35, z + 0.6, 4.8, 0.4, 2.0, '#5a4a3a', 0, 0.06);
    S.box(x, (3.5 + R.H) / 2, z, 2.4, R.H - 3.5, 1.0, COL.stoneDark, 0, 0.08);
    const f = this.placeBonfire(x, z + 1.15, 0.55);
    void f;
    this.colliders.addBox(x, z + 0.5, 2.3, 1.0, 0, -1, 4, 'prop');
  }

  // ------------------------------------------------------------- mobilier de chaque salle
  furnish_tavern(R) {
    const { o, S, x0, x1, z0, H } = R;
    this.fireplace(R, o.x - 6, z0 + 0.3);
    // comptoir (est) avec tonneaux et bouteilles
    S.box(x1 - 4.2, 0.85, o.z - 1, 1.2, 1.7, 9, '#6b4428');
    S.box(x1 - 4.2, 1.76, o.z - 1, 1.6, 0.14, 9.4, '#8a5a36');
    this.colliders.addBox(x1 - 4.2, o.z - 1, 0.8, 4.7, 0, -1, 1.8, 'prop');
    for (let k = 0; k < 3; k++) this.P('keg', x1 - 1.4, o.z - 5 + k * 2.6, 0.95, -Math.PI / 2);
    S.box(x1 - 0.45, 3.2, o.z - 1, 0.5, 0.12, 8, '#7a4e2e');
    for (let k = 0; k < 8; k++) this.P('bottle_A_green', x1 - 0.5, o.z - 4.6 + k * 1.0, 0.8, 0, 3.27, false);
    for (let k = 0; k < 3; k++) this.P('chair', x1 - 5.6, o.z - 4 + k * 2.5, 1.3, Math.PI / 2);
    // tables et chaises
    const tables = [[o.x - 6, o.z + 1], [o.x - 1, o.z - 3], [o.x + 3, o.z + 3], [o.x - 7, o.z + 6]];
    for (const [tx, tz] of tables) {
      this.P('c_table_medium', tx, tz, 1.4, 0);
      this.P(['c_food_stew', 'plate_food_A', 'c_stew_pot'][Math.floor(S.rng() * 3)], tx, tz, 1.1, S.rng() * 6, 1.4, false);
      for (const [cx, cz, rr] of [[-1.9, 0, Math.PI / 2], [1.9, 0, -Math.PI / 2], [0, -1.9, 0], [0, 1.9, Math.PI]]) {
        this.P('c_chair_A_wood', tx + cx, tz + cz, 1.4, rr);
        this.spots.tavern.push({ kind: 'sit', x: tx + cx, z: tz + cz, facing: rr, label: 'S’asseoir' });
      }
    }
    this.P('c_rug_rectangle_stripes_A', o.x - 6, z0 + 4.2, 1.6, 0, 0, false);
    this.P('c_shelf_B_large_decorated', o.x + 2, z0 + 0.6, 1.5, 0, 1.6, false);
    this.P('barrel_small_stack', x0 + 1.6, z0 + 2, 1, 0.3);
    this.P('crates_stacked', x0 + 1.6, o.z + 6, 0.9, 0.6);
    this.P('c_stew_pot', o.x - 6, z0 + 1.45, 1.3, 0, 0.2, false);
    for (const [lx, lz] of [[o.x - 6, o.z - 3], [o.x + 1, o.z], [o.x - 6, o.z + 4], [o.x + 6, o.z - 4]]) this.hangLamp(lx, lz, H - 0.6);
    R.win(x0 + 0.05, o.z - 2, Math.PI / 2); R.win(x0 + 0.05, o.z + 4, Math.PI / 2); R.win(o.x + 4, z0 + 0.05, 0);
  }

  furnish_forge(R) {
    const { o, S, x0, x1, z0, z1, H } = R;
    // grand foyer de forge (charbons ardents)
    S.box(o.x - 5, 1.1, z0 + 2, 5, 2.2, 3.4, COL.stoneDark, 0, 0.1);
    S.box(o.x - 5, 2.25, z0 + 2, 4.2, 0.14, 2.6, '#2a1a12', 0, 0);
    S.box(o.x - 5, (2.4 + H) / 2 + 0.6, z0 + 1, 2.2, H - 2.4, 1.6, COL.stoneDark, 0, 0.06);
    const coals = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.2, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6a1a').multiplyScalar(2.6), toneMapped: false }));
    coals.position.set(o.x - 5, 2.36, z0 + 2); this.group.add(coals); this.keep.add(coals);
    this.forgeGlow = coals;
    const l = new VirtualLight('#ff7a2a', 26, 18, 1.4); l.position.set(o.x - 5, 3.5, z0 + 3.5); this.group.add(l); this.lights.push(l);
    this.colliders.addBox(o.x - 5, z0 + 2, 2.6, 1.8, 0, -1, 2.3, 'prop');
    // enclume (on y forge)
    const ax = o.x + 1, az = o.z;
    S.box(ax, 0.55, az, 1.0, 1.1, 1.4, '#3a3632');
    S.box(ax, 1.25, az, 1.1, 0.35, 2.2, '#4a4642', 0, 0.04);
    S.box(ax, 1.25, az - 1.35, 0.5, 0.25, 0.6, '#4a4642');
    this.colliders.addBox(ax, az, 0.6, 1.1, 0, -1, 1.45, 'prop');
    this.spots.forge.push({ kind: 'anvil', x: ax + 1.7, z: az, facing: -Math.PI / 2, label: 'Forger à l’enclume' });
    // meule, établis, râteliers d'armes
    S.cyl(o.x + 6, 1.2, z0 + 2.2, 0.9, 0.9, 0.35, '#8d8a84', 16);
    S.box(o.x + 6, 0.5, z0 + 2.2, 0.4, 1.0, 1.4, '#5a3a22');
    S.box(x1 - 1.2, 0.85, o.z + 2, 1.6, 1.7, 5, '#6b4428');
    for (const [wx, wz, rr] of [[x1 - 0.5, o.z - 4, -Math.PI / 2], [x0 + 0.5, o.z - 1, Math.PI / 2], [x0 + 0.5, o.z + 3, Math.PI / 2]]) this.P('weaponrack', wx, wz, 8, rr);
    this.P('sword_shield', x1 - 0.45, o.z + 2, 1.1, -Math.PI / 2, 3.2, false);
    this.P('sword_shield', o.x + 4, z0 + 0.45, 1.1, 0, 3.4, false);
    this.P('barrel_large', x0 + 1.6, z0 + 1.8, 0.8, 0);
    this.P('barrel_large', x0 + 1.6, z1 - 3, 0.8, 1);
    this.P('crates_stacked', o.x + 7.5, z1 - 2.5, 0.9, 0.4);
    this.P('chest', o.x + 6, o.z + 4.5, 1, Math.PI);
    for (const [lx, lz] of [[o.x + 2, o.z - 3], [o.x - 4, o.z + 3], [o.x + 6, o.z + 2]]) this.hangLamp(lx, lz, H - 0.6, '#ffb35c', 14);
    R.win(x1 - 0.05, o.z - 3, -Math.PI / 2, '#ffe2b8');
  }

  furnish_guild(R) {
    const { o, S, x0, x1, z0, z1, H } = R;
    // estrade du maître de guilde, bureau et tableau des contrats
    S.box(o.x, 0.3, z0 + 3.2, 12, 0.6, 5.4, '#6a5a48', 0, 0.05);
    this.colliders.addBox(o.x, z0 + 3.2, 6, 2.7, 0, -1, 0.62, 'prop', true);
    S.box(o.x, 1.2, z0 + 4.4, 5, 1.2, 1.6, '#5a3a22');
    S.box(o.x, 1.86, z0 + 4.4, 5.4, 0.14, 2, '#7a4e2e');
    this.colliders.addBox(o.x, z0 + 4.4, 2.7, 1, 0, -1, 1.9, 'prop');
    this.P('coin_stack_large', o.x - 1.5, z0 + 4.4, 0.7, 0.4, 1.9, false);
    this.P('c_book_set', o.x + 1.4, z0 + 4.4, 1.4, 0.2, 1.95, false);
    // tableau des contrats (mur est)
    const bx = x1 - 0.4, bz = o.z;
    S.box(bx, 3.3, bz, 0.25, 3.4, 5.4, '#5e3b22');
    S.box(bx - 0.08, 3.3, bz, 0.12, 3.0, 5.0, '#a5784a', 0, 0.04);
    for (let k = 0; k < 9; k++) S.box(bx - 0.18, 2.4 + (k % 3) * 0.95, bz - 1.8 + Math.floor(k / 3) * 1.8 + (S.rng() - 0.5) * 0.3, 0.04, 0.8, 0.95, k % 4 === 0 ? '#f3e2b0' : '#efe6d2', (S.rng() - 0.5) * 0.12, 0.06);
    this.spots.guild.push({ kind: 'board', x: bx - 2, z: bz, facing: Math.PI / 2, label: 'Tableau des contrats' });
    // longues tables, bannières, piliers
    for (const tx of [o.x - 7, o.x + 5]) {
      this.P('table_long_decorated_A', tx, o.z + 3, 0.85, 0);
      for (let k = 0; k < 3; k++) for (const sx of [-1, 1]) this.P('chair', tx + sx * 1.6, o.z + 1.2 + k * 1.6, 1.25, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
    for (const [px, pz] of [[x0 + 4, z0 + 6], [x1 - 4, z0 + 6], [x0 + 4, z1 - 5], [x1 - 4, z1 - 5]]) this.P('pillar_decorated', px, pz, 1.25 * H / 5, 0);
    for (const [bxx, name] of [[o.x - 9, 'banner_patternA_blue'], [o.x - 3, 'banner_triple_blue'], [o.x + 3, 'banner_shield_red'], [o.x + 9, 'banner_thin_yellow']]) this.P(name, bxx, z0 + 0.5, 1.4, 0, 1.5, false);
    for (const [cx, cz] of [[x0 + 1.4, o.z - 4], [x0 + 1.4, o.z + 1], [x0 + 1.4, o.z + 6]]) this.P(cx === x0 + 1.4 && cz === o.z + 1 ? 'chest_gold' : 'chest', cx, cz, 1, Math.PI / 2);
    this.P('c_rug_rectangle_stripes_A', o.x, o.z + 3, 2.2, Math.PI / 2, 0, false);
    for (const [lx, lz] of [[o.x - 6, o.z - 3], [o.x + 6, o.z - 3], [o.x - 6, o.z + 5], [o.x + 6, o.z + 5], [o.x, o.z]]) this.hangLamp(lx, lz, H - 0.6, '#ffc078', 16);
    R.win(x0 + 0.05, o.z - 2, Math.PI / 2, '#fff1c8', 2.6, 3.4); R.win(x0 + 0.05, o.z + 5, Math.PI / 2, '#fff1c8', 2.6, 3.4);
  }

  furnish_chapel(R) {
    const { o, S, x0, x1, z0, H } = R;
    // chœur surélevé, autel et cierges
    S.box(o.x, 0.35, z0 + 4, W2(R), 0.7, 6, '#bdb4a4', 0, 0.04);
    this.colliders.addBox(o.x, z0 + 4, W2(R) / 2, 3, 0, -1, 0.72, 'prop', true);
    S.box(o.x, 1.4, z0 + 3.2, 4, 1.4, 1.6, '#e8e0cc');
    S.box(o.x, 2.15, z0 + 3.2, 4.4, 0.14, 1.9, '#c9a24a');
    this.colliders.addBox(o.x, z0 + 3.2, 2.2, 1, 0, -1, 2.2, 'prop');
    for (const sx of [-1.5, 0, 1.5]) this.P('candle_triple', o.x + sx, z0 + 3.2, 1.3, 0, 2.2, false);
    this.P('hw_shrine_candles', o.x - 5, z0 + 2.4, 1.4, 0.4);
    this.P('hw_shrine_candles', o.x + 5, z0 + 2.4, 1.4, -0.4);
    this.spots.chapel.push({ kind: 'altar', x: o.x, z: z0 + 5.6, facing: Math.PI, label: 'Prier à l’autel' });
    // bancs
    for (let k = 0; k < 6; k++) for (const sx of [-1, 1]) this.P('hw_bench', o.x + sx * 3.6, o.z - 4 + k * 3, 1.6, 0);
    // vitraux colorés
    const glassC = ['#ffcf6b', '#8fc6ff', '#ff8fb8', '#9cf0b0'];
    for (let k = 0; k < 4; k++) { R.win(x0 + 0.05, z0 + 6 + k * 5.5, Math.PI / 2, glassC[k], 1.8, 4, H * 0.55); R.win(x1 - 0.05, z0 + 6 + k * 5.5, -Math.PI / 2, glassC[(k + 2) % 4], 1.8, 4, H * 0.55); }
    R.win(o.x, z0 + 0.05, 0, '#fff1c8', 3, 4.5, H * 0.62);
    for (const lz of [o.z - 6, o.z + 2, o.z + 9]) this.hangLamp(o.x, lz, H - 0.6, '#ffe2a0', 12);
  }

  furnish_home(R) {
    const { o, S, x0, x1, z0, H } = R;
    this.fireplace(R, o.x + 2.5, z0 + 0.3);
    this.P('c_bed_single_A', x0 + 2.2, o.z - 2, 1.4, 0);
    this.spots.home.push({ kind: 'bed', x: x0 + 2.2 + 2.2, z: o.z - 2, facing: -Math.PI / 2, label: 'Se reposer' });
    this.P('c_table_medium', o.x + 2, o.z + 1.5, 1.4, 0);
    this.P('c_food_stew', o.x + 2, o.z + 1.5, 1.1, 0.4, 1.4, false);
    for (const [cx, cz, rr] of [[-2, 0, Math.PI / 2], [2, 0, -Math.PI / 2]]) {
      this.P('c_chair_A_wood', o.x + 2 + cx, o.z + 1.5 + cz, 1.4, rr);
      this.spots.home.push({ kind: 'sit', x: o.x + 2 + cx, z: o.z + 1.5 + cz, facing: rr, label: 'S’asseoir' });
    }
    this.P('c_cabinet_medium_decorated', x1 - 1.1, o.z - 3, 1.3, -Math.PI / 2);
    this.P('c_shelf_B_large_decorated', x0 + 0.6, o.z + 3, 1.4, Math.PI / 2, 1.8, false);
    this.P('c_rug_oval_A', o.x, o.z + 1, 1.6, 0, 0, false);
    this.P('c_lamp_standing', x0 + 1, z0 + 1, 1.3, 0);
    this.hangLamp(o.x, o.z, H - 0.5, '#ffb35c', 14);
    R.win(x1 - 0.05, o.z + 1, -Math.PI / 2); R.win(x0 + 0.05, o.z - 3.5, Math.PI / 2, '#fff1c8', 1.6, 2);
  }

  furnish_tower(R) {
    const { o, S, x0, x1, z0, H } = R;
    // bibliothèques sur trois murs
    for (let k = 0; k < 4; k++) {
      this.P('c_shelf_B_large_decorated', o.x - 6 + k * 4, z0 + 0.6, 1.6, 0, 0.4, false);
      this.P('c_shelf_B_large_decorated', o.x - 6 + k * 4, z0 + 0.6, 1.6, 0, 2.2, false);
      this.P('c_book_set', o.x - 6 + k * 4, z0 + 0.7, 1.5, 0, 3.3, false);
    }
    for (let k = 0; k < 3; k++) { this.P('c_shelf_B_large_decorated', x0 + 0.6, o.z - 4 + k * 4, 1.6, Math.PI / 2, 1.2, false); this.P('c_shelf_B_large_decorated', x1 - 0.6, o.z - 4 + k * 4, 1.6, -Math.PI / 2, 1.2, false); }
    S.box(o.x - 6, 1.75, z0 + 0.65, 14, 0.12, 0.6, '#5e3b22');
    // orbe de l'archimage sur son piédestal, cercle runique
    S.cyl(o.x, 0.6, o.z - 1, 0.9, 0.7, 1.2, '#4a4458', 10);
    S.cyl(o.x, 1.3, o.z - 1, 0.8, 1.0, 0.2, '#6a6478', 10);
    this.colliders.addCircle(o.x, o.z - 1, 1.0, -1, 1.5, 'prop');
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fb8ff').multiplyScalar(1.15), toneMapped: false }));
    orb.position.set(o.x, 2.25, o.z - 1); this.group.add(orb); this.keep.add(orb);
    this.orb = orb;
    const l = new VirtualLight('#8fa8ff', 12, 14, 1.6); l.position.set(o.x, 3, o.z - 1); this.group.add(l); this.lights.push(l);
    this.spots.tower.push({ kind: 'orb', x: o.x, z: o.z + 1.2, facing: Math.PI, label: 'Toucher l’orbe d’enchantement' });
    this.P('c_table_medium_long', o.x + 4.5, o.z - 3, 1.4, 0);
    this.P('c_book_set', o.x + 4, o.z - 3, 1.4, 0.3, 1.45, false);
    this.P('candle_triple', o.x + 5.5, o.z - 3, 1.1, 0, 1.4, false);
    this.P('chest_gold', x1 - 2, o.z + 5, 1, -Math.PI / 2);
    for (const [cx, cz] of [[o.x - 4, o.z + 5], [o.x + 4, o.z + 5]]) this.P('candle_triple', cx, cz, 1.4, 0);
    this.P('c_rug_oval_A', o.x, o.z - 1, 2.4, 0, 0, false);
    for (const [lx, lz] of [[o.x - 4, o.z - 2], [o.x + 4, o.z - 2], [o.x, o.z + 5]]) this.hangLamp(lx, lz, H - 0.6, '#c8b8ff', 12);
    R.win(x1 - 0.05, o.z - 3, -Math.PI / 2, '#d8d0ff', 1.6, 3.2); R.win(x0 + 0.05, o.z - 3, Math.PI / 2, '#d8d0ff', 1.6, 3.2);
  }

  update(dt, elapsed) {
    // feux et lampes toujours allumés à l'intérieur
    if (this.fires) for (const f of this.fires) f.flames.forEach((m, i) => { const k = 1 + Math.sin(elapsed * (9 + i * 3) + i) * 0.12; m.scale.set(f.scale * (1 - i * 0.18), f.scale * (1 - i * 0.18) * k, f.scale * (1 - i * 0.18)); m.rotation.y = elapsed * (1 + i); });
    for (const l of this.fireLights || []) l.intensity = 22 * (0.85 + Math.sin(elapsed * 11.3) * 0.1);
    if (this.forgeGlow) this.forgeGlow.material.color.setRGB(2.6, 0.7 + Math.sin(elapsed * 3) * 0.12, 0.08);
    if (this.orb) { this.orb.rotation.y = elapsed * 0.6; this.orb.position.y = 2.25 + Math.sin(elapsed * 1.5) * 0.12; }
  }
}

function W2(R) { return R.W - 1.2; }
