import * as THREE from 'three';
import { Decor } from './Decor.js';
import { GIVRE, AMBRE, ISLETS } from '../config.js';
import { mulberry32 } from '../engine/math.js';
import { modelEnvTexture } from '../engine/ModelLook.js';

// Campements, sanctuaires et arènes des Cimes de Givre et des Terres d'Ambre.
export const OUTPOST_NPCS = {
  bjorn: { x: -40, z: -536, face: [-46, -545] },
  neige: { x: -56, z: -551, face: [-46, -545] },
  kessa: { x: 566, z: 61, face: [560, 52] },
  tarek: { x: 552, z: 44, face: [560, 52] },
};

export class Outposts extends Decor {
  constructor(scene, assets, terrain, colliders) {
    super(scene, assets, terrain, colliders, 'outposts');
    this.fallbackY = 30;
    this.rng = mulberry32(777);
    this.buildGivreCamp();
    this.buildSanctuary();
    this.buildSummit();
    this.buildAmbreCamp();
    this.buildMine();
    this.buildCirque();
    this.buildIslets();
    this.buildIce();
    this.mergeStatic();
  }

  ring(cx, cz, r, n, fn) { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; fn(cx + Math.cos(a) * r, cz + Math.sin(a) * r, a, i); } }

  buildGivreCamp() {
    const c = GIVRE.camp;
    const B = (name, x, z, s) => this.placeBuilding({ name, x, z, s, cx: c.x, cz: c.z });
    B('building_tower_A', c.x + 16, c.z - 14, 6);
    B('building_home_A', c.x - 20, c.z + 13, 6.5);
    B('building_tavern', c.x - 18, c.z - 16, 6.5);
    B('building_scaffolding', c.x + 18, c.z + 14, 5.5);
    this.placeBonfire(c.x, c.z, 1.1);
    const P = (name, dx, dz, s, r, col = true) => this.placeProp(name, c.x + dx, c.z + dz, s, r, 0, col);
    P('tent', 9, 4, 7, 2.2); P('tent', -8, 6, 7, 0.9); P('tent', 4, -9, 7, -0.3);
    P('crate_A_big', 12, -4, 7, 0.4); P('crate_B_big', 13.5, -2, 7, 1.3); P('barrel', 11, 9, 7, 0); P('sack', -12, -2, 9, 0.6);
    P('resource_lumber', -4, 15, 8, 0.4); P('weaponrack', 6, 13, 8, 2.6); P('flag_blue', 16, -14, 15, 0);
    for (let i = 0; i < 5; i++) P('fence_stone_straight', -24 + i * 6.4, 22, 4, Math.PI / 2);
    for (const [dx, dz] of [[14, 6], [-14, -6], [2, 16], [-2, -16], [20, -2], [-22, 2]]) this.placeLantern(c.x + dx, c.z + dz, true);
  }

  buildSanctuary() {
    const s = GIVRE.sanctuary, rng = this.rng;
    const S = 1.7, W = 4 * S;
    const put = (name, x, z, rot, scale = S, col = true) => { const o = this.assets.prop(name); const y = this.ground(x, z); o.position.set(x, y - 0.1, z); o.rotation.y = rot; o.scale.setScalar(scale); this.group.add(o); if (col) { const box = this.assets.propBox(name); const top = y + box.max.y * scale; this.colliders.addFootprint(this.hulls(name, scale, 0.02, 0.6), x, z, rot, y - 1, top, top - y < 3.2 ? 'prop' : 'ruin', top - y < 3.2); } return o; };
    const walls = ['wall', 'wall_broken', 'wall_cracked', 'wall_arched', 'wall_pillar', 'wall_half'];
    for (let k = -2; k <= 2; k++) {
      if (k !== 0) { put(rng.pick(walls), s.x + k * W, s.z - 3 * W, 0); put(rng.pick(walls), s.x + k * W, s.z + 3 * W, Math.PI); }
      if (Math.abs(k) !== 0) { put(rng.pick(walls), s.x - 3 * W, s.z + k * W, Math.PI / 2); put(rng.pick(walls), s.x + 3 * W, s.z + k * W, -Math.PI / 2); }
    }
    this.ring(s.x, s.z, 9, 8, (x, z, a, i) => put(i % 2 ? 'pillar_decorated' : 'column', x, z, a, 1.4));
    put('rubble_large', s.x - 12, s.z + 7, 0.6, 1.3); put('rubble_half', s.x + 11, s.z - 9, 2.4, 1.3);
    put('banner_triple_blue', s.x, s.z - 3 * W + 1, 0, 1.5, false);
    put('candle_triple', s.x - 2, s.z, 0, 1.7, false); put('candle_triple', s.x + 2, s.z + 1, 1, 1.6, false);
    put('chest', s.x, s.z + 3, Math.PI, 1.6);
  }

  buildSummit() {
    const p = GIVRE.peak;
    this.ring(p.x, p.z, 16, 8, (x, z, a, i) => {
      const o = this.assets.prop(i % 2 ? 'pillar_decorated' : 'pillar');
      const y = this.ground(x, z);
      o.position.set(x, y - 0.2, z); o.rotation.y = a; o.scale.setScalar(1.6);
      this.group.add(o);
      this.colliders.addCircle(x, z, 0.8, y - 1, y + 6, 'ruin');
      if (i % 2 === 0) this.placeLantern(x + Math.cos(a) * 2.2, z + Math.sin(a) * 2.2, i % 4 === 0);
    });
  }

  buildAmbreCamp() {
    const c = AMBRE.camp;
    const B = (name, x, z, s) => this.placeBuilding({ name, x, z, s, cx: c.x, cz: c.z });
    B('building_market', c.x + 17, c.z + 15, 6.5);
    B('building_home_B', c.x - 19, c.z - 13, 6.5);
    B('building_tower_B', c.x + 18, c.z - 16, 5.5);
    B('building_grain', c.x - 20, c.z + 14, 6);
    this.placeBonfire(c.x, c.z, 1.1);
    const P = (name, dx, dz, s, r, col = true) => this.placeProp(name, c.x + dx, c.z + dz, s, r, 0, col);
    P('tent', 9, -6, 7, 0.4); P('tent', -9, 4, 7, 2.6); P('tent', 2, 11, 7, 1.6); P('tent', -3, -12, 7, -0.6);
    P('wheelbarrow', 12, 4, 7, 1.1); P('crate_long_A', -13, -3, 7, 0.2); P('crate_A_small', -12, 7, 7, 1); P('barrel', 14, -10, 7, 0); P('barrel', 15.4, -8.8, 7, 0);
    P('sack', 6, 14, 9, 0.3); P('sack', 7.2, 15, 9, 1.4); P('resource_stone', -6, 16, 7, 0.8);
    P('flag_yellow', 18, -16, 14, 0); P('flag_red', -20, 14, 13, 0);
    for (const [dx, dz] of [[13, 0], [-13, 1], [0, 15], [1, -15], [19, 4]]) this.placeLantern(c.x + dx, c.z + dz, true);
  }

  buildMine() {
    const m = AMBRE.mine;
    this.placeBuilding({ name: 'building_mine', x: m.x, z: m.z + 6, s: 7, cx: m.x - 10, cz: m.z - 30 });
    const P = (name, dx, dz, s, r) => this.placeProp(name, m.x + dx, m.z + dz, s, r, 0, true);
    P('resource_stone', -8, -6, 8, 0.4); P('resource_stone', -10, -3, 7, 1.7); P('crate_open', 7, -7, 7, 2.2); P('wheelbarrow', 9, -3, 7, 0.3); P('resource_lumber', -4, -12, 8, 1.2);
    this.placeLantern(m.x - 5, m.z - 2, true); this.placeLantern(m.x + 5, m.z - 2, false);
  }

  buildCirque() {
    const a = AMBRE.cirque;
    this.ring(a.x, a.z, a.radius * 0.72, 10, (x, z, ang, i) => {
      if (Math.abs(Math.atan2(Math.sin(ang - Math.PI), Math.cos(ang - Math.PI))) < 0.5) return; // entrée ouest
      const o = this.assets.prop(i % 3 === 0 ? 'pillar_decorated' : 'pillar');
      const y = this.ground(x, z);
      o.position.set(x, y - 0.2, z); o.rotation.y = ang; o.scale.setScalar(1.7);
      this.group.add(o);
      this.colliders.addCircle(x, z, 0.85, y - 1, y + 6, 'ruin');
    });
    for (const [dx, dz, r] of [[-8, 9, 0.4], [9, -7, 2], [11, 10, 1.2]]) {
      const o = this.assets.prop('rubble_large'); const x = a.x + dx, z = a.z + dz, y = this.ground(x, z);
      o.position.set(x, y - 0.1, z); o.rotation.y = r; o.scale.setScalar(1.4); this.group.add(o);
      const box = this.assets.propBox('rubble_large');
      this.colliders.addFootprint(this.hulls('rubble_large', 1.4, 0.02, 0.6), x, z, r, y - 1, y + box.max.y * 1.4, 'prop', true);
    }
    this.placeLantern(a.x - a.radius * 0.95, a.z - 5, true); this.placeLantern(a.x - a.radius * 0.95, a.z + 5, true);
  }

  // l'Îlot des Lanternes porte bien son nom
  buildIslets() {
    const isl = ISLETS.find((i) => i.id === 'lanternes');
    if (isl) this.ring(isl.x, isl.z, isl.radius * 0.55, 6, (x, z, a, i) => this.placeLantern(x, z, i % 2 === 0));
    const relais = ISLETS.find((i) => i.id === 'relais');
    if (relais) { this.placeProp('tent', relais.x + 4, relais.z - 3, 7, 1.2); this.placeLantern(relais.x - 3, relais.z + 2, true); }
  }

  // le Lac de Cristal : une glace lisse qui reflète le ciel
  buildIce() {
    const L = GIVRE.lake;
    const mat = new THREE.MeshStandardMaterial({ color: '#cfeefa', roughness: 0.12, metalness: 0.0, transparent: true, opacity: 0.55, envMap: modelEnvTexture(), envMapIntensity: 1.3, depthWrite: false });
    const ice = new THREE.Mesh(new THREE.CircleGeometry(L.radius * 1.18, 48), mat);
    ice.rotation.x = -Math.PI / 2;
    ice.position.set(L.x, L.level + 0.28, L.z);
    ice.renderOrder = 2;
    this.scene.add(ice);
    this.ice = ice;
  }
}
