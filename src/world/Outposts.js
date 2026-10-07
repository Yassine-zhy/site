import * as THREE from 'three';
import { Decor } from './Decor.js';
import { GIVRE, AMBRE, HANTEE, SYLVE, ISLETS } from '../config.js';
import { mulberry32 } from '../engine/math.js';
import { modelEnvTexture } from '../engine/ModelLook.js';

// Campements, sanctuaires et arènes des Cimes de Givre et des Terres d'Ambre.
const npcAt = (camp, dx, dz) => ({ x: camp.x + dx, z: camp.z + dz, face: [camp.x, camp.z] });
export const OUTPOST_NPCS = {
  bjorn: npcAt(GIVRE.camp, 6, 9),
  neige: npcAt(GIVRE.camp, -10, -6),
  kessa: npcAt(AMBRE.camp, 6, 9),
  tarek: npcAt(AMBRE.camp, -8, -8),
  morwen: npcAt(HANTEE.camp, 7, 8),
  silas: npcAt(HANTEE.camp, -9, -5),
  liora: npcAt(SYLVE.camp, 7, 8),
  tiko: npcAt(SYLVE.camp, -8, -7),
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
    // nouvelles îles
    this.buildHanteeCamp();
    this.buildCemetery();
    this.buildCrypt();
    this.buildMarsh();
    this.buildSylveCamp();
    this.buildTemple();
    this.buildFeuillu();
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

  // ------------------------------------------------------------------ Landes Spectrales
  // petits objets : posés, avec collision basse si demandé
  put(name, x, z, s, r, col = false, yoff = 0) { return this.placeProp(name, x, z, s, r, yoff, col); }

  buildHanteeCamp() {
    const c = HANTEE.camp, rng = this.rng;
    const B = (name, x, z, s) => this.placeBuilding({ name, x, z, s, cx: c.x, cz: c.z });
    B('building_tower_A', c.x + 17, c.z - 15, 6);
    B('building_home_A', c.x - 19, c.z + 14, 6.5);
    B('building_tavern', c.x - 18, c.z - 17, 6.5);
    this.placeBonfire(c.x, c.z, 1.1);
    const P = (name, dx, dz, s, r, col = true) => this.placeProp(name, c.x + dx, c.z + dz, s, r, 0, col);
    P('tent', 10, 5, 7, 2.2); P('tent', -9, 7, 7, 0.8); P('tent', 4, -11, 7, -0.4);
    P('c_table_medium_long', 13, -4, 1.6, 0.3); P('c_chair_A_wood', 11.6, -6.2, 1.6, 0.3); P('c_chair_B_wood', 14.6, -1.8, 1.6, 0.3 + Math.PI);
    P('c_food_stew', 13, -4, 1.4, 0, false).position.y += 1.6; P('c_pot_A_stew', -6, -6, 1.6, 0.4);
    P('hw_coffin', -13, 2, 1.3, 1.2); P('hw_bench_decorated', 6, 12, 1.6, 2.8);
    for (const [dx, dz] of [[15, 7], [-15, -5], [3, 17], [-3, -17], [20, -1], [-21, 3]]) this.placeLantern(c.x + dx, c.z + dz, true);
    for (const [dx, dz, r] of [[8, -2, 0.3], [-7, 3, 1.4], [2, 9, 2.2], [-4, -8, 3.1]]) P(rng() < 0.5 ? 'hw_pumpkin_orange_jackolantern' : 'hw_pumpkin_yellow_jackolantern', dx, dz, 1.5, r, false);
    // palissade ouest
    for (let i = 0; i < 6; i++) P(i === 3 ? 'hw_fence_gate' : 'hw_fence', -26, -14 + i * 5.6, 1.4, Math.PI / 2);
  }

  buildCemetery() {
    const C = HANTEE.cemetery, rng = this.rng;
    const half = Math.round(C.radius * 0.75), seg = 5.2;
    // clôture carrée, portail au nord-est (vers la Veille)
    for (let side = 0; side < 4; side++) {
      const n = Math.round((half * 2) / seg);
      for (let i = 0; i < n; i++) {
        const t = -half + (i + 0.5) * seg;
        const gate = side === 0 && Math.abs(t) < seg;
        const [x, z, r] = side === 0 ? [C.x + half, C.z + t, Math.PI / 2] : side === 1 ? [C.x - half, C.z + t, Math.PI / 2] : side === 2 ? [C.x + t, C.z + half, 0] : [C.x + t, C.z - half, 0];
        if (gate) { if (t < 0) this.put('hw_arch_gate', x, z + seg * 0.5, 1.5, r, true); continue; }
        this.put(rng() < 0.18 ? 'hw_fence_broken' : 'hw_fence', x, z, 1.3, r, true);
      }
      // piliers d'angle
    }
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) this.put('hw_pillar', C.x + sx * half, C.z + sz * half, 1.1, 0, true);
    // crypte centrale et rangées de tombes
    this.put('hw_crypt', C.x - 4, C.z, 1.7, Math.PI / 2, true);
    const graves = ['hw_grave_A', 'hw_grave_B', 'hw_gravestone', 'hw_gravemarker_A', 'hw_gravemarker_B', 'hw_grave_A_destroyed'];
    for (let gx = -half + 6; gx <= half - 6; gx += 6.5) {
      for (let gz = -half + 6; gz <= half - 6; gz += 7) {
        if (Math.abs(gx + 4) < 11 && Math.abs(gz) < 13) continue; // crypte
        if (Math.abs(gz) < 3) continue; // allée centrale
        if (rng() < 0.15) continue;
        const x = C.x + gx + (rng() - 0.5) * 1.2, z = C.z + gz + (rng() - 0.5) * 1.2;
        const name = rng.pick(graves);
        this.put(name, x, z, 1.25, Math.PI / 2 + (rng() - 0.5) * 0.25, /grave_|gravestone/.test(name));
        if (rng() < 0.2) this.put(rng.pick(['hw_candle', 'hw_candle_melted', 'hw_skull_candle']), x + 1.6, z + 0.6, 1.3, rng() * 6);
        if (rng() < 0.08) this.put('hw_floor_dirt_grave', x + 2.6, z, 1.0, 0, false, 0.02);
      }
    }
    // autels et lanternes le long de l'allée
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      this.put('hw_post_lantern', C.x + i * 9, C.z + 3.2, 1.3, Math.PI, true);
      this.put('hw_post_lantern', C.x + i * 9, C.z - 3.2, 1.3, 0, true);
    }
    this.put('hw_shrine_candles', C.x + half - 9, C.z + 8, 1.6, -Math.PI / 2, true);
    this.put('hw_shrine', C.x + half - 9, C.z - 8, 1.6, -Math.PI / 2, true);
    this.put('hw_coffin_decorated', C.x + 14, C.z + 12, 1.3, 0.4, true);
    this.put('hw_tree_dead_large_decorated', C.x + half - 3, C.z - half + 3, 2.2, 0.6, true);
    this.put('hw_tree_dead_large', C.x - half + 3, C.z + half - 3, 2.4, 2.1, true);
    this.placeLantern(C.x + half + 3, C.z - 6, true);
    this.placeLantern(C.x + half + 3, C.z + 6, true);
  }

  buildCrypt() {
    const A = HANTEE.crypt;
    // grande crypte au fond (ouest) de l'arène, ouverte vers l'est
    this.put('hw_crypt', A.x - A.radius * 0.85, A.z, 2.6, Math.PI / 2, true);
    this.ring(A.x, A.z, A.radius * 0.75, 12, (x, z, ang, i) => {
      if (Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) < 0.45) return; // entrée est
      if (Math.abs(Math.atan2(Math.sin(ang - Math.PI), Math.cos(ang - Math.PI))) < 0.35) return; // crypte
      this.put(i % 3 === 0 ? 'hw_pillar' : 'hw_post_skull', x, z, i % 3 === 0 ? 1.5 : 1.6, ang + Math.PI / 2, true);
    });
    for (const [dx, dz, r] of [[-6, 7, 0.3], [5, -8, 1.8], [8, 6, 2.6], [-4, -6, 4]]) this.put(this.rng() < 0.5 ? 'hw_coffin' : 'hw_floor_dirt_grave', A.x + dx, A.z + dz, 1.3, r, false, 0.02);
    for (const [dx, dz] of [[-2, 3], [3, -2], [0, -5], [-5, 0]]) this.put('hw_candle_triple', A.x + dx, A.z + dz, 1.6, dx);
    this.put('hw_skull_candle', A.x + A.radius * 0.95, A.z - 4, 1.6, -Math.PI / 2);
    this.put('hw_skull_candle', A.x + A.radius * 0.95, A.z + 4, 1.6, -Math.PI / 2);
    this.placeLantern(A.x + A.radius * 1.05, A.z - 7, true);
    this.placeLantern(A.x + A.radius * 1.05, A.z + 7, true);
  }

  buildMarsh() {
    const L = HANTEE.lake, rng = this.rng;
    this.ring(L.x, L.z, L.radius * 1.2, 10, (x, z, a, i) => { if (i % 2 === 0) this.put('hw_post_lantern', x, z, 1.4, a + Math.PI / 2, true); });
    for (let i = 0; i < 14; i++) {
      const a = rng() * Math.PI * 2, r = L.radius * (1.0 + rng() * 0.5);
      this.put(rng.pick(['hw_bone_A', 'hw_bone_B', 'hw_bone_C', 'hw_ribcage', 'hw_skull']), L.x + Math.cos(a) * r, L.z + Math.sin(a) * r, 1.3, rng() * 6);
    }
  }

  // ------------------------------------------------------------------ Canopée d'Émeraude
  buildSylveCamp() {
    const c = SYLVE.camp;
    const B = (name, x, z, s) => this.placeBuilding({ name, x, z, s, cx: c.x, cz: c.z });
    B('building_home_B', c.x + 18, c.z + 14, 6.5);
    B('building_market', c.x - 19, c.z - 14, 6.5);
    B('building_tower_B', c.x + 18, c.z - 16, 5.5);
    B('building_lumbermill', c.x - 20, c.z + 15, 6);
    this.placeBonfire(c.x, c.z, 1.1);
    const P = (name, dx, dz, s, r, col = true) => this.placeProp(name, c.x + dx, c.z + dz, s, r, 0, col);
    P('tent', 9, -6, 7, 0.4); P('tent', -9, 5, 7, 2.6); P('tent', 1, 11, 7, 1.6);
    P('c_table_round_A_decorated', -12, -2, 1.5, 0.3); P('c_kitchentable_A_large_decorated', 12, 4, 1.4, 1.2);
    P('c_crate_tomatoes', 13, -9, 1.5, 0.2); P('c_crate_carrots', 15, -7, 1.5, 0.9); P('c_crate_potatoes', 14.5, -11.5, 1.5, 0.4); P('c_crate_onions', -4, -13, 1.5, 1.1);
    P('c_jar_A_large', -14, 6, 1.8, 0); P('c_jar_C_large', -15, 7.5, 1.8, 0.6); P('c_pot_A_stew', 5, -4, 1.6, 0.3);
    P('resource_lumber', -6, 15, 8, 0.4); P('flag_green', 18, -16, 14, 0);
    for (const [dx, dz] of [[13, 1], [-13, -1], [1, 15], [-1, -15], [19, 5]]) this.placeLantern(c.x + dx, c.z + dz, true);
  }

  buildTemple() {
    const T = SYLVE.temple, rng = this.rng;
    const S = 1.8, W = 4 * S;
    const put = (name, x, z, rot, scale = S, col = true, yoff = 0) => {
      const o = this.assets.prop(name); const y = this.ground(x, z);
      o.position.set(x, y - 0.1 + yoff, z); o.rotation.y = rot; o.scale.setScalar(scale); this.group.add(o);
      if (col) { const box = this.assets.propBox(name); const top = y + yoff + box.max.y * scale; this.colliders.addFootprint(this.hulls(name, scale, 0.02, 0.6), x, z, rot, y - 1, top, top - y < 3.2 ? 'prop' : 'ruin', top - y < 3.2); }
      return o;
    };
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
      if (rng() < 0.3) continue;
      put(rng() < 0.4 ? 'floor_tile_large_rocks' : 'floor_tile_large', T.x + i * 6, T.z + j * 6, Math.floor(rng() * 4) * Math.PI / 2, 1.5, false, 0.05);
    }
    const walls = ['wall', 'wall_broken', 'wall_cracked', 'wall_arched', 'wall_broken', 'wall_pillar', 'wall_half'];
    for (let k = -3; k <= 3; k++) {
      if (Math.abs(k) <= 0) continue;
      if (rng() < 0.85) put(rng.pick(walls), T.x + k * W, T.z - 4 * W, 0);
      if (rng() < 0.85 && Math.abs(k) > 1) put(rng.pick(walls), T.x + k * W, T.z + 4 * W, Math.PI);
      if (rng() < 0.85) put(rng.pick(walls), T.x - 4 * W, T.z + k * W, Math.PI / 2);
      if (rng() < 0.85) put(rng.pick(walls), T.x + 4 * W, T.z + k * W, -Math.PI / 2);
    }
    // nef : deux rangées de colonnes vers l'autel
    for (let i = -2; i <= 2; i++) { put(i % 2 ? 'pillar_decorated' : 'column', T.x - 7, T.z + i * 8, 0, 1.6); put(i % 2 ? 'column' : 'pillar_decorated', T.x + 7, T.z + i * 8, 0, 1.6); }
    put('stairs_wide', T.x, T.z - 4 * W - 4, 0, 1.3, false);
    put('table_long_decorated_A', T.x, T.z + 3 * W - 7, 0, 1.4);
    put('shelf_small_candles', T.x - 6, T.z + 4 * W - 1.5, Math.PI, 1.6, false);
    put('shelf_small_candles', T.x + 6, T.z + 4 * W - 1.5, Math.PI, 1.6, false);
    put('rubble_large', T.x - 18, T.z + 9, 0.4, 1.5); put('rubble_half', T.x + 19, T.z - 12, 2.1, 1.5);
    put('trunk_large_A', T.x + 13, T.z + 16, 0.7, 1.6); put('sword_shield_broken', T.x - 3, T.z - 5, 0.3, 1.5, false, 0.8);
    for (const [dx, dz] of [[-10, -4 * W - 2], [10, -4 * W - 2]]) this.placeLantern(T.x + dx, T.z + dz, true);
  }

  buildFeuillu() {
    const p = SYLVE.peak;
    this.ring(p.x, p.z, 15, 8, (x, z, a, i) => {
      const o = this.assets.prop(i % 2 ? 'pillar_decorated' : 'column');
      const y = this.ground(x, z);
      o.position.set(x, y - 0.2, z); o.rotation.y = a; o.scale.setScalar(1.6);
      this.group.add(o);
      this.colliders.addCircle(x, z, 0.8, y - 1, y + 6, 'ruin');
      if (i % 2 === 0) this.placeLantern(x + Math.cos(a) * 2.2, z + Math.sin(a) * 2.2, i % 4 === 0);
    });
  }
}

