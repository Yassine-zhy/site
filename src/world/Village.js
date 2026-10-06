import * as THREE from 'three';
import { mulberry32 } from '../engine/math.js';
import { VILLAGE, RUINS, BRIDGES } from '../config.js';
import { applyCorruption } from './Maps.js';
import { Decor } from './Decor.js';
import { VirtualLight } from './Lights.js';

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
  ondine: { x: -33, z: 27, face: [-20, 20] },
  pip: { x: 37, z: 7, face: [20, 10] },
  rhea: { x: 19, z: -33, face: [8, -20] },
};

export class Village extends Decor {
  constructor(scene, assets, terrain, colliders, maps) {
    super(scene, assets, terrain, colliders, 'village');
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
    for (let i = 0; i < 6; i++) this.placeProp('fence_wood_straight', -6 + i * 2.2 * 3.6, 46 + Math.sin(i) * 0.3, 3.6, Math.PI / 2, 0, true);

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
    this.buildBridges(this.terrain.bridges);
    this.mergeStatic();
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
    const crystalMat = new THREE.MeshStandardMaterial({ color: '#fff2c8', emissive: new THREE.Color('#ffcf6b'), emissiveIntensity: 1.5, roughness: 0.2, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.95 });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), crystalMat);
    crystal.scale.set(1, 1.8, 1);
    crystal.position.y = 7.2;
    g.add(crystal);
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd98a').multiplyScalar(1.6), transparent: true, opacity: 0.5, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(2.6 + i * 0.7, 0.05, 6, 64), ringMat);
      r.position.y = 7.2;
      g.add(r);
      rings.push(r);
    }
    const light = new VirtualLight('#ffd27a', 18, 40, 1.4);
    light.position.y = 7.5;
    g.add(light);
    this.scene.add(g);
    this.monument = { group: g, crystal, rings, light, y };
    // marches praticables, colonne centrale et piliers solides
    this.colliders.addCircle(0, 0, 6.8, y - 2, y + 0.6, 'prop', true);
    this.colliders.addCircle(0, 0, 4.95, y - 2, y + 1.2, 'prop', true);
    this.colliders.addCircle(0, 0, 2.1, y - 2, y + 9, 'monument');
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; this.colliders.addCircle(Math.cos(a) * 4.2, Math.sin(a) * 4.2, 0.55, y - 1, y + 5, 'monument'); }
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
        const top = y + yoff + box.max.y * scale;
        const low = top - y < 3.2;
        this.colliders.addFootprint(this.hulls(name, scale, 0.02, 0.6), x, z, rot, y - 1, top, low ? 'prop' : 'ruin', low);
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

  update(dt, elapsed, night) {
    if (this.monument) {
      const m = this.monument;
      m.crystal.rotation.y += dt * 0.6;
      m.crystal.position.y = 7.2 + Math.sin(elapsed * 1.3) * 0.35;
      m.rings.forEach((r, i) => { r.rotation.x = elapsed * (0.3 + i * 0.17) + i; r.rotation.y = elapsed * (0.21 + i * 0.11); r.position.y = m.crystal.position.y; });
      m.light.intensity = 6 + night * 16;
    }
    super.update(dt, elapsed, night);
    if (this.windmillBlades) this.windmillBlades.rotation.z += dt * 0.8;
  }
}
