import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../engine/math.js';
import { VILLAGE, LAKE, FOREST, HILLS, GIVRE, AMBRE, HANTEE, SYLVE, UPDRAFTS } from '../config.js';
import { pathDistance } from '../world/Terrain.js';

// Ressources à récolter (on les ramasse en passant dessus) et anneaux de vent (défis de vol).
export const ITEMS_GATHER = {
  aube: { name: 'Fleur d’aube', plural: 'Fleurs d’aube', color: '#ffd36b' },
  mousse: { name: 'Mousse d’argent', plural: 'Mousses d’argent', color: '#c8f0e0' },
  plume: { name: 'Plume des nuées', plural: 'Plumes des nuées', color: '#bfe6ff' },
  ambre: { name: 'Éclat d’ambre', plural: 'Éclats d’ambre', color: '#ff9a3d' },
  givre: { name: 'Cristal de givre', plural: 'Cristaux de givre', color: '#9fe0ff' },
  orchidee: { name: 'Orchidée céleste', plural: 'Orchidées célestes', color: '#ff7ad9' },
  ame: { name: 'Fleur d’âme', plural: 'Fleurs d’âme', color: '#b9a0ff' },
};

// Anneaux [x, z] sur le plan. Leur hauteur suit la pente de vol de la paravoile
// (≈ 1 m perdu pour 4,8 m parcourus) depuis le sommet de la colonne de vent de départ :
// il suffit de suivre la ligne en planant.
const RING_PLAN = {
  village: { name: 'au-dessus du village', start: { x: -110, z: -150 }, rings: [[-80, -118], [-56, -88], [-34, -58], [-14, -28], [6, 4]] },
  ambre: { name: 'au-dessus des Terres d’Ambre', start: { x: 1000, z: -60 }, rings: [[1028, -24], [1056, 12], [1084, 48], [1112, 84], [1140, 120]] },
  sylve: { name: 'au-dessus de la Canopée', start: { x: 230, z: 850 }, rings: [[244, 884], [258, 918], [272, 952], [286, 986], [300, 1020]] },
};
export const RING_SETS = {};
function planRings() {
  for (const [id, def] of Object.entries(RING_PLAN)) {
    // colonne de vent la plus proche du départ (elle a pu être recalée sur un sol plat)
    let up = UPDRAFTS[0], bd = Infinity;
    for (const u of UPDRAFTS) { const d = Math.hypot(u.x - def.start.x, u.z - def.start.z); if (d < bd) { bd = d; up = u; } }
    let px = up.x, pz = up.z, y = up.top - 10;
    const rings = def.rings.map(([rx, rz]) => {
      const x = rx, z = rz, d = Math.hypot(x - px, z - pz);
      y -= d / 4.8;
      const yaw = Math.atan2(x - px, z - pz);
      px = x; pz = z;
      return [x, Math.round(y * 10) / 10, z, yaw];
    });
    RING_SETS[id] = { name: def.name, start: { x: up.x, z: up.z }, rings };
  }
}

const RESPAWN = 120;

function nodeGeometry(kind) {
  const parts = [];
  if (kind === 'aube' || kind === 'orchidee' || kind === 'ame') {
    const stem = new THREE.CylinderGeometry(0.03, 0.04, 0.7, 5); stem.translate(0, 0.35, 0); parts.push(stem);
    for (let i = 0; i < 5; i++) { const p = new THREE.SphereGeometry(0.16, 6, 4); p.scale(1, 0.45, 0.6); const a = i / 5 * Math.PI * 2; p.translate(Math.cos(a) * 0.17, 0.74, Math.sin(a) * 0.17); parts.push(p); }
    const c = new THREE.SphereGeometry(0.1, 6, 4); c.translate(0, 0.78, 0); parts.push(c);
  } else if (kind === 'mousse') {
    for (let i = 0; i < 4; i++) { const b = new THREE.DodecahedronGeometry(0.28, 0); b.scale(1, 0.45, 1); b.translate(Math.cos(i * 1.7) * 0.25, 0.08, Math.sin(i * 1.7) * 0.25); parts.push(b); }
  } else if (kind === 'plume') {
    const f = new THREE.OctahedronGeometry(0.35, 0); f.scale(0.35, 1.4, 0.08); f.rotateZ(0.5); f.translate(0, 0.7, 0); parts.push(f);
  } else {
    for (let i = 0; i < 3; i++) { const c = new THREE.OctahedronGeometry(0.28 - i * 0.05, 0); c.scale(1, 2.2, 1); c.rotateZ((i - 1) * 0.45); c.translate((i - 1) * 0.22, 0.45 - i * 0.05, (i % 2) * 0.15); parts.push(c); }
  }
  for (const p of parts) { p.deleteAttribute('uv'); if (p.index) { const q = p.toNonIndexed(); parts[parts.indexOf(p)] = q; } }
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false);
}

export class Gathering {
  constructor(game) {
    this.game = game;
    const g = game, terrain = g.world.terrain;
    planRings();
    const rng = mulberry32(31337);
    this.nodes = [];
    const ok = (x, z, opts = {}) => {
      if (!terrain.isLand(x, z)) return null;
      const h = terrain.heightAt(x, z);
      if (terrain.slopeAt(x, z) > 0.5) return null;
      if (!opts.paths && pathDistance(x, z) < 3) return null;
      for (const c of g.world.colliders.grid.get(g.world.colliders.key(Math.floor(x / 8), Math.floor(z / 8))) || []) if (c.tag !== 'npc' && g.world.colliders.contains(c, x, z, 1)) return null;
      return h;
    };
    const scatter = (item, n, gen, opts) => {
      for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
        const [x, z] = gen();
        const y = ok(x, z, opts);
        if (y === null) continue;
        if (this.nodes.some((o) => Math.hypot(o.x - x, o.z - z) < 6)) continue;
        this.nodes.push({ item, x, y, z, t: 0, phase: rng() * 6.28 });
        i++;
      }
    };
    const disc = (cx, cz, r0, r1) => () => { const a = rng() * Math.PI * 2, r = r0 + Math.sqrt(rng()) * (r1 - r0); return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; };
    // fleurs d'aube : prairies autour du village et dans les collines
    scatter('aube', 26, disc(VILLAGE.x, VILLAGE.z, VILLAGE.radius + 10, 260));
    scatter('aube', 16, disc(HILLS.x, HILLS.z, 0, HILLS.radius));
    // mousse d'argent : rives du lac et sous-bois
    scatter('mousse', 16, disc(LAKE.x, LAKE.z, LAKE.radius * 1.15, LAKE.radius * 2.4));
    scatter('mousse', 16, disc(FOREST.x, FOREST.z, 0, FOREST.radius));
    // plumes : au pied des colonnes de vent
    for (const u of UPDRAFTS) scatter('plume', 3, disc(u.x, u.z, u.radius + 6, u.radius + 40));
    // ambre : mesas, mine, gorge
    scatter('ambre', 16, disc(1058, -158, 0, 150), { paths: true });
    scatter('ambre', 10, disc(AMBRE.mine.x, AMBRE.mine.z, 8, 80), { paths: true });
    scatter('ambre', 12, disc(992, 200, 0, 110), { paths: true });
    // givre : lac de cristal, sanctuaire
    scatter('givre', 18, disc(GIVRE.lake.x, GIVRE.lake.z, GIVRE.lake.radius * 0.9, GIVRE.lake.radius * 2), { paths: true });
    scatter('givre', 14, disc(GIVRE.sanctuary.x, GIVRE.sanctuary.z, 10, 110), { paths: true });
    // orchidées : Canopée d'Émeraude ; fleurs d'âme : Landes Spectrales
    scatter('orchidee', 18, disc(SYLVE.lake.x, SYLVE.lake.z, SYLVE.lake.radius * 1.1, SYLVE.lake.radius * 2.6), { paths: true });
    scatter('orchidee', 14, disc(SYLVE.temple.x, SYLVE.temple.z, 20, 130), { paths: true });
    scatter('ame', 18, disc(HANTEE.cemetery.x, HANTEE.cemetery.z, 10, 140), { paths: true });
    scatter('ame', 14, disc(HANTEE.lake.x, HANTEE.lake.z, HANTEE.lake.radius, HANTEE.lake.radius * 2.4), { paths: true });

    // un maillage instancié par ressource
    this.meshes = {};
    const m = new THREE.Matrix4();
    for (const [kind, def] of Object.entries(ITEMS_GATHER)) {
      const list = this.nodes.filter((n) => n.item === kind);
      if (!list.length) continue;
      const mat = new THREE.MeshStandardMaterial({ color: def.color, emissive: new THREE.Color(def.color), emissiveIntensity: 1.1, roughness: 0.35, flatShading: true });
      const mesh = new THREE.InstancedMesh(nodeGeometry(kind), mat, list.length);
      list.forEach((n, i) => { n.mesh = mesh; n.index = i; m.makeTranslation(n.x, n.y, n.z); mesh.setMatrixAt(i, m); });
      mesh.castShadow = false; mesh.receiveShadow = false;
      mesh.computeBoundingSphere();
      g.scene.add(mesh);
      this.meshes[kind] = mesh;
    }
    this.buildRings();
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3();
    this.sparkT = 0;
  }

  buildRings() {
    const g = this.game;
    this.rings = [];
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe08a').multiplyScalar(2), toneMapped: false, transparent: true, opacity: 0.9 });
    const doneMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#7ee0a8').multiplyScalar(1.8), toneMapped: false, transparent: true, opacity: 0.7 });
    const geo = new THREE.TorusGeometry(4, 0.22, 8, 40);
    for (const [set, def] of Object.entries(RING_SETS)) {
      def.rings.forEach(([x, y, z, yaw], i) => {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.rotation.y = yaw;
        g.scene.add(mesh);
        this.rings.push({ set, id: i, x, y, z, yaw, mesh, mat, doneMat, passed: false });
      });
    }
  }

  // ressource la plus proche d'un type (balise de quête)
  nearest(item, pos) {
    let best = null, bd = Infinity;
    for (const n of this.nodes) { if (n.item !== item || n.t > 0) continue; const d = Math.hypot(n.x - pos.x, n.z - pos.z); if (d < bd) { bd = d; best = n; } }
    return best;
  }

  nextRing(set, passed = []) { return this.rings.find((r) => r.set === set && !passed.includes(r.id)) || null; }

  update(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    const pos = p.position, el = g.elapsed;
    const m = this._m, q = this._q, s = this._s, v = this._p;
    const dirty = new Set();
    for (const n of this.nodes) {
      if (n.t > 0) {
        n.t -= dt;
        if (n.t <= 0) { n.t = 0; dirty.add(n.mesh); }
        else continue;
      }
      const dx = n.x - pos.x, dz = n.z - pos.z;
      const d2 = dx * dx + dz * dz;
      // ne s'anime que près du joueur
      if (d2 > 90 * 90) continue;
      if (d2 < 2.2 * 2.2 && Math.abs(pos.y - n.y) < 2.5 && !p.dead) { this.collect(n); dirty.add(n.mesh); continue; }
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, el * 0.8 + n.phase);
      v.set(n.x, n.y + Math.sin(el * 2 + n.phase) * 0.08, n.z);
      s.setScalar(1 + Math.sin(el * 3 + n.phase) * 0.06);
      m.compose(v, q, s);
      n.mesh.setMatrixAt(n.index, m);
      dirty.add(n.mesh);
      if (d2 < 30 * 30 && Math.random() < dt * 1.5) g.fx.sparkle(v, ITEMS_GATHER[n.item].color, 0.5, 1, 0.18);
    }
    for (const mesh of dirty) mesh.instanceMatrix.needsUpdate = true;
    // anneaux : traversée près du plan de l'anneau
    for (const r of this.rings) {
      r.mesh.rotation.z = el * 0.4 + r.id;
      const dx = pos.x - r.x, dy = pos.y + 1.2 - r.y, dz = pos.z - r.z;
      if (dx * dx + dy * dy + dz * dz > 5.6 * 5.6) continue;
      const nx = Math.sin(r.yaw), nz = Math.cos(r.yaw);
      const along = dx * nx + dz * nz;
      if (Math.abs(along) < 2.2) this.passRing(r);
    }
  }

  collect(n) {
    const g = this.game, def = ITEMS_GATHER[n.item];
    n.t = RESPAWN;
    this._m.makeScale(0, 0, 0); n.mesh.setMatrixAt(n.index, this._m);
    const pos = new THREE.Vector3(n.x, n.y + 0.8, n.z);
    g.fx.burst(pos, def.color, { count: 18, speed: 3, size: 0.28, life: 0.7, gravity: -1, up: 2 });
    g.ui.floatText(pos.clone().setY(n.y + 2.2), `+1 ${def.name}`, 'gold', { rise: 1.6 });
    g.audio?.play('pickup', pos);
    g.hero.gold += 1 + Math.floor(Math.random() * 3);
    g.gainXp(6);
    g.quests?.onEvent('collect', { item: n.item });
  }

  passRing(r) {
    const g = this.game;
    const now = performance.now();
    if (r.lastPass && now - r.lastPass < 2500) return;
    r.lastPass = now;
    r.passed = true;
    r.mesh.material = r.doneMat;
    setTimeout(() => { r.mesh.material = r.mat; }, 6000);
    g.fx.ring(r.mesh.position, '#ffe08a', { from: 2, to: 7, life: 0.5, y: 0 });
    g.fx.burst(r.mesh.position, '#fff2c0', { count: 26, speed: 6, size: 0.3, life: 0.6, gravity: 0 });
    g.audio?.play('glide', r.mesh.position);
    g.quests?.onEvent('ring', { set: r.set, id: r.id });
  }
}
