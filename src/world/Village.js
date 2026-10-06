import * as THREE from 'three';
import { mulberry32 } from '../engine/math.js';
import { VILLAGE, RUINS, BRIDGES } from '../config.js';
import { applyCorruption } from './Maps.js';

const BSCALE = 7;

// Disposition du village de Havrelumière (bâtiments KayKit "Medieval Hexagon").
export const BUILDINGS = [
  { name: 'building_castle', x: 0, z: -40, s: 7.5 },
  { name: 'building_church', x: -32, z: -22, s: 7.5 },
  { name: 'building_tavern', x: 27, z: 16, s: 8 },
  { name: 'building_market', x: -26, z: 18, s: 7 },
  { name: 'building_blacksmith', x: 30, z: -16, s: 7.5 },
  { name: 'building_windmill', x: -44, z: 36, s: 8 },
  { name: 'building_home_A', x: -12, z: 38, s: 7 },
  { name: 'building_home_B', x: 15, z: 39, s: 7 },
  { name: 'building_home_A', x: 42, z: 2, s: 7 },
  { name: 'building_home_B', x: -44, z: 4, s: 7 },
  { name: 'building_tower_A', x: 49, z: -12, s: 6.5 },
  { name: 'building_tower_B', x: 8, z: 52, s: 6 },
  { name: 'building_barracks', x: -26, z: -48, s: 7 },
  { name: 'building_archeryrange', x: 30, z: -44, s: 6.5 },
  { name: 'building_well', x: 11, z: 9, s: 6, face: [0, 0] },
  { name: 'building_lumbermill', x: 72, z: 26, s: 7, face: [118, 14] },
  { name: 'building_watermill', x: -98, z: 58, s: 7, face: [-122, 34] },
  { name: 'building_mine', x: -42, z: -86, s: 7, face: [0, 0] },
];

export const NPC_SPOTS = {
  elder: { x: -22, z: -10, face: [0, 0] },
  smith: { x: 22, z: -12, face: [0, 0] },
  oracle: { x: -62, z: -26, face: [-40, -10] },
  guard: { x: 6, z: 46, face: [8, 80] },
  merchant: { x: -18, z: 12, face: [0, 0] },
};

export class Village {
  constructor(scene, assets, terrain, colliders, maps) {
    this.scene = scene; this.assets = assets; this.terrain = terrain; this.colliders = colliders;
    this.group = new THREE.Group();
    this.group.name = 'village';
    scene.add(this.group);
    this.lights = [];
    this.flames = [];
    this.windmillBlades = null;
    const rng = mulberry32(555);

    for (const b of BUILDINGS) this.placeBuilding(b);

    // Props de la place et des échoppes
    const props = [
      ['tent', -30, 26, 7, 0.4], ['tent', -18, 28, 7, -0.3], ['tent', -34, 12, 7, 1.2],
      ['crate_A_big', 20, 22, 7, 0.3], ['crate_B_big', 21.5, 24, 7, 0.9], ['barrel', 34, 22, 7, 0], ['barrel', 35.5, 20.5, 7, 0], ['crate_long_A', 33, 9, 7, 1.5],
      ['weaponrack', 24, -24, 8, 0.2], ['resource_stone', 37, -20, 7, 0.5], ['crate_open', 24, -8, 7, 2.6],
      ['target', 34, -54, 9, 3.1], ['target', 26, -56, 9, 3.0], ['bucket_arrows', 37, -50, 8, 0],
      ['wheelbarrow', -12, 22, 7, 2.2], ['sack', -16, 20, 9, 0.4], ['sack', -15, 21, 9, 1.4], ['pallet', -40, 20, 7, 0.2],
      ['resource_lumber', 64, 30, 8, 0.6], ['resource_lumber', 66, 34, 8, 1.9],
      ['crate_A_small', -50, 28, 7, 0.4], ['barrel', -38, -56, 7, 0], ['weaponrack', -18, -56, 8, 0.1],
      ['bucket_water', 15, 12, 8, 0], ['flag_blue', 49, -12, 16, 0, 15], ['flag_blue', 8, 52, 16, 0, 15],
    ];
    for (const [name, x, z, s, r, yoff] of props) this.placeProp(name, x, z, s, r, yoff || 0, true);

    // palissade/clôtures autour des jardins
    for (let i = 0; i < 6; i++) this.placeProp('fence_wood_straight', -6 + i * 2.2 * 3.6, 46 + Math.sin(i) * 0.3, 3.6, Math.PI / 2, 0, false);

    // Lanternes (torches KayKit Dungeon sur poteaux)
    const lanterns = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      lanterns.push([Math.cos(a) * 19, Math.sin(a) * 19]);
    }
    lanterns.push([46, -4], [46, -20], [3, 48], [13, 48], [-10, 30], [20, 30], [-30, -32], [26, -30]);
    lanterns.forEach(([x, z], i) => this.placeLantern(x, z, i < 4));

    this.buildMonument(maps);
    this.buildRuins(rng);
    this.buildBridges();
  }

  ground(x, z) { return this.terrain.heightAt(x, z) ?? VILLAGE.height; }

  placeBuilding(b) {
    const obj = this.assets.prop(b.name);
    const y = this.ground(b.x, b.z);
    const face = b.face || [VILLAGE.x, VILLAGE.z];
    const rot = Math.atan2(face[0] - b.x, face[1] - b.z);
    obj.position.set(b.x, y - 0.2, b.z);
    obj.rotation.y = rot;
    obj.scale.setScalar(b.s || BSCALE);
    this.group.add(obj);
    const box = this.assets.propBox(b.name);
    const s = b.s || BSCALE;
    const cx = (box.min.x + box.max.x) / 2 * s, cz = (box.min.z + box.max.z) / 2 * s;
    const wx = b.x + cx * Math.cos(rot) + cz * Math.sin(rot), wz = b.z - cx * Math.sin(rot) + cz * Math.cos(rot);
    const hw = (box.max.x - box.min.x) / 2 * s * 0.86, hd = (box.max.z - box.min.z) / 2 * s * 0.86;
    if (b.name === 'building_well') this.colliders.addCircle(b.x, b.z, hw * 0.9, y - 2, y + 6, 'building');
    else this.colliders.addBox(wx, wz, hw, hd, rot, y - 2, y + (box.max.y * s), 'building');
    if (b.name === 'building_windmill') {
      obj.traverse((o) => { if (!this.windmillBlades && o.isMesh && /blade|wing|sail/i.test(o.name)) this.windmillBlades = o; });
    }
    return obj;
  }

  placeProp(name, x, z, s, r, yoff = 0, collide = true) {
    const obj = this.assets.prop(name);
    const y = this.ground(x, z);
    obj.position.set(x, y + yoff - 0.05, z);
    obj.rotation.y = r;
    obj.scale.setScalar(s);
    this.group.add(obj);
    if (collide) {
      const box = this.assets.propBox(name);
      const rad = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * s * 0.42;
      if (rad > 0.4) this.colliders.addCircle(x, z, rad, y - 1, y + box.max.y * s + yoff, 'prop');
    }
    return obj;
  }

  placeLantern(x, z, withLight) {
    const y = this.ground(x, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2, 6), new THREE.MeshStandardMaterial({ color: '#5b3d26', roughness: 0.9 }));
    post.position.set(x, y + 1.6, z);
    post.castShadow = true;
    this.group.add(post);
    const torch = this.assets.prop('torch_lit');
    torch.position.set(x, y + 3.35, z);
    torch.scale.setScalar(0.9);
    this.group.add(torch);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347').multiplyScalar(4), toneMapped: false }));
    glow.position.set(x, y + 3.9, z);
    this.group.add(glow);
    this.flames.push(glow);
    this.colliders.addCircle(x, z, 0.35, y - 1, y + 4, 'prop');
    if (withLight) {
      const l = new THREE.PointLight('#ffb35c', 0, 22, 1.6);
      l.position.set(x, y + 4.2, z);
      this.group.add(l);
      this.lights.push(l);
    }
  }

  // Le Cœur de Lumière : monument central, point de résurrection, protège le village.
  buildMonument(maps) {
    const y = this.ground(0, 0);
    const g = new THREE.Group();
    g.position.set(0, y, 0);
    const stone = new THREE.MeshStandardMaterial({ color: '#cfc6b4', roughness: 0.85, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: '#8f8778', roughness: 0.9, flatShading: true });
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7, 0.6, 8), dark); s1.position.y = 0.3;
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.2, 0.6, 8), stone); s2.position.y = 0.9;
    const s3 = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 3.2, 8), stone); s3.position.y = 2.8;
    [s1, s2, s3].forEach((m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const p = this.assets.prop('pillar');
      p.scale.set(0.7, 1.1, 0.7);
      p.position.set(Math.cos(a) * 4.2, 1.2, Math.sin(a) * 4.2);
      g.add(p);
    }
    const crystalMat = new THREE.MeshStandardMaterial({ color: '#fff2c8', emissive: new THREE.Color('#ffcf6b'), emissiveIntensity: 2.2, roughness: 0.2, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.95 });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), crystalMat);
    crystal.scale.set(1, 1.8, 1);
    crystal.position.y = 7.2;
    g.add(crystal);
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd98a').multiplyScalar(2.5), transparent: true, opacity: 0.55, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(2.6 + i * 0.7, 0.05, 6, 64), ringMat);
      r.position.y = 7.2;
      g.add(r);
      rings.push(r);
    }
    const light = new THREE.PointLight('#ffd27a', 18, 40, 1.4);
    light.position.y = 7.5;
    g.add(light);
    this.scene.add(g);
    this.monument = { group: g, crystal, rings, light, y };
    this.colliders.addCircle(0, 0, 5.4, y - 2, y + 3, 'monument');
  }

  // Les Cendres : ruines d'un ancien temple (KayKit Dungeon).
  buildRuins(rng) {
    const cx = RUINS.x, cz = RUINS.z;
    const S = 1.7;
    const g = this.group;
    const put = (name, x, z, rot, scale = S, collide = true, yoff = 0) => {
      const o = this.assets.prop(name);
      const y = this.ground(x, z);
      o.position.set(x, y - 0.1 + yoff, z); o.rotation.y = rot; o.scale.setScalar(scale);
      g.add(o);
      if (collide) {
        const box = this.assets.propBox(name);
        const hw = (box.max.x - box.min.x) / 2 * scale, hd = (box.max.z - box.min.z) / 2 * scale;
        const lx = (box.min.x + box.max.x) / 2 * scale, lz = (box.min.z + box.max.z) / 2 * scale;
        const wx = x + lx * Math.cos(rot) + lz * Math.sin(rot), wz = z - lx * Math.sin(rot) + lz * Math.cos(rot);
        this.colliders.addBox(wx, wz, hw * 0.9, hd * 0.9, rot, y - 1, y + box.max.y * scale, 'ruin');
      }
      return o;
    };
    // sol dallé
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      if (rng() < 0.25) continue;
      put(rng() < 0.3 ? 'floor_tile_large_rocks' : 'floor_tile_large', cx + i * 4 * 1.5, cz + j * 4 * 1.5, Math.floor(rng() * 4) * Math.PI / 2, 1.5, false, 0.05);
    }
    // enceinte
    const W = 4 * S;
    const walls = ['wall', 'wall_broken', 'wall_cracked', 'wall_arched', 'wall_broken', 'wall_pillar'];
    for (let k = -2; k <= 2; k++) {
      if (k === 0) continue;
      put(rng.pick(walls), cx + k * W, cz - 3 * W, 0);
      if (Math.abs(k) !== 1) put(rng.pick(walls), cx + k * W, cz + 3 * W, Math.PI);
      put(rng.pick(walls), cx - 3 * W, cz + k * W, Math.PI / 2);
      put(rng.pick(walls), cx + 3 * W, cz + k * W, -Math.PI / 2);
    }
    // colonnade centrale
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      put(i % 3 === 0 ? 'pillar' : 'pillar_decorated', cx + Math.cos(a) * 10, cz + Math.sin(a) * 10, a, 1.3);
    }
    put('rubble_large', cx - 14, cz + 6, 0.4, 1.3);
    put('rubble_half', cx + 15, cz - 8, 2.1, 1.3);
    put('stairs_wide', cx, cz - 3 * W - 5, 0, 1.2, false);
    put('banner_patternA_blue', cx - 6, cz - 3 * W + 1, 0, 1.4, false);
    put('banner_shield_red', cx + 6, cz - 3 * W + 1, 0, 1.4, false);
    put('sword_shield_broken', cx + 4, cz + 4, 0.7, 1.4, false, 0.8);
    put('trunk_large_A', cx - 5, cz + 12, 0.3, 1.5);
    put('barrel_small_stack', cx + 12, cz + 12, 1.2, 1.2);
    put('candle_triple', cx - 2, cz - 2, 0, 1.6, false);
  }

  buildBridges() {
    const plank = new THREE.MeshStandardMaterial({ color: '#8a5a34', roughness: 0.9, flatShading: true });
    const rope = new THREE.MeshStandardMaterial({ color: '#c9a777', roughness: 1 });
    for (const b of this.terrain.bridges) {
      const n = Math.ceil(b.len / 0.9);
      const dir = Math.atan2(b.bx - b.ax, b.bz - b.az);
      const geo = new THREE.BoxGeometry(b.width, 0.16, 0.7);
      const inst = new THREE.InstancedMesh(geo, plank, n);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
      const pts = [[], []];
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = b.ax + (b.bx - b.ax) * t, z = b.az + (b.bz - b.az) * t;
        const y = b.ha + (b.hb - b.ha) * t - Math.sin(t * Math.PI) * b.sag - 0.08;
        q.setFromEuler(new THREE.Euler(0, dir + (Math.random() - 0.5) * 0.05, 0));
        v.set(x, y, z); m.compose(v, q, sc); inst.setMatrixAt(i, m);
      }
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const x = b.ax + (b.bx - b.ax) * t, z = b.az + (b.bz - b.az) * t;
        const y = b.ha + (b.hb - b.ha) * t - Math.sin(t * Math.PI) * b.sag * 0.85 + 1.1;
        const ox = Math.cos(dir) * b.width * 0.5, oz = -Math.sin(dir) * b.width * 0.5;
        pts[0].push(new THREE.Vector3(x + ox, y, z + oz));
        pts[1].push(new THREE.Vector3(x - ox, y, z - oz));
      }
      inst.castShadow = true; inst.receiveShadow = true;
      this.group.add(inst);
      for (const p of pts) {
        const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p), 48, 0.06, 5, false), rope);
        this.group.add(tube);
      }
      // poteaux
      for (const [x, z, h] of [[b.ax, b.az, b.ha], [b.bx, b.bz, b.hb]]) {
        for (const sgn of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.4, 6), plank);
          post.position.set(x + Math.cos(dir) * b.width * 0.5 * sgn, h + 0.9, z - Math.sin(dir) * b.width * 0.5 * sgn);
          this.group.add(post);
        }
      }
    }
  }

  update(dt, elapsed, night) {
    if (this.monument) {
      const m = this.monument;
      m.crystal.rotation.y += dt * 0.6;
      m.crystal.position.y = 7.2 + Math.sin(elapsed * 1.3) * 0.35;
      m.rings.forEach((r, i) => { r.rotation.x = elapsed * (0.3 + i * 0.17) + i; r.rotation.y = elapsed * (0.21 + i * 0.11); r.position.y = m.crystal.position.y; });
      m.light.intensity = 10 + night * 30;
    }
    const flick = 0.85 + Math.sin(elapsed * 13.1) * 0.08 + Math.sin(elapsed * 7.3) * 0.07;
    for (const l of this.lights) l.intensity = night * 26 * flick;
    for (const f of this.flames) f.scale.setScalar(0.6 + night * 0.7 * flick);
    if (this.windmillBlades) this.windmillBlades.rotation.z += dt * 0.8;
  }
}
