import * as THREE from 'three';
import { mulberry32, smoothstep } from '../engine/math.js';
import { pathDistance } from './Terrain.js';
import { VILLAGE, LAKE, FOREST, MOUNTAIN, RUINS, HILLS, HAMLET, BEACONS, ISLETS, UPDRAFTS, WAYSTONES, WORLD_BOSSES, MAIN_ISLAND, W } from '../config.js';

// taille des tuiles de végétation (une tuile hors de vue n'est pas parcourue)
const TILE = 300;
import { applyCorruption, CORR_UV_GLSL } from './Maps.js';
import { registerJungleTrees } from './JungleTrees.js';

// Arbres et rochers instanciés (modèles KayKit), avec balancement au vent.
export class Vegetation {
  constructor(scene, assets, terrain, colliders, maps, density = 1) {
    this.scene = scene; this.assets = assets; this.terrain = terrain; this.colliders = colliders;
    this.meshes = [];
    registerJungleTrees(assets);
    const rng = mulberry32(2024);
    const buckets = new Map();
    const add = (name, x, z, scale, rotY, opts = {}) => {
      const y = opts.y ?? terrain.heightAt(x, z);
      if (y === null) return false;
      const key = `${opts.region || 'main'}|${opts.look || 'base'}|${name}|${Math.floor(x / TILE)},${Math.floor(z / TILE)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({ x, y: y - (opts.sink ?? 0.15), z, s: scale, r: rotY, sy: opts.sy ?? 1 });
      if (opts.col) {
        // tronc (bas de l'arbre) ou masse du rocher, d'après la géométrie du modèle
        const box = assets.propBox(name), sy = opts.sy ?? 1;
        const hulls = opts.col === 'tree' ? assets.footprints(name, 0, 0.09, 0.05) : assets.footprints(name, 0.03, 0.5);
        const top = y - (opts.sink ?? 0.15) + box.max.y * scale * sy;
        const low = opts.col === 'rock' && top - y < 3.0;
        colliders.addFootprint(hulls.map((h) => h.map(([hx, hz]) => [hx * scale, hz * scale])), x, z, rotY, y - 1, top, opts.col === 'tree' ? 'tree' : 'rock', low);
      }
      return true;
    };
    const blocked = (x, z) => {
      const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
      if (dv < VILLAGE.radius + 6) return true;
      if (Math.hypot(x - HAMLET.x, z - HAMLET.z) < HAMLET.radius + 10) return true;
      if (pathDistance(x, z) < 4.5) return true;
      if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius * 1.35) return true;
      for (const b of BEACONS) if (Math.hypot(x - b.x, z - b.z) < 12) return true;
      for (const u of UPDRAFTS) if (Math.hypot(x - u.x, z - u.z) < u.radius + 4) return true;
      if (Math.hypot(x - RUINS.x, z - RUINS.z) < RUINS.radius * 0.75) return true;
      if (Math.hypot(x - MOUNTAIN.x, z - (MOUNTAIN.z + 4)) < MOUNTAIN.summitRadius + 6) return true;
      return false;
    };
    const singles = ['tree_single_A', 'tree_single_B'];
    const rocks = ['rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E'];
    const clusters = ['trees_A_large', 'trees_A_medium', 'trees_B_large', 'trees_B_medium', 'trees_A_small', 'trees_B_small'];
    const MR = MAIN_ISLAND.radius;
    // Bois-Murmure : forêt dense
    const nForest = Math.round(1400 * density);
    for (let i = 0, tries = 0; i < nForest && tries < nForest * 6; tries++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * FOREST.radius * 1.05;
      const x = FOREST.x + Math.cos(a) * r, z = FOREST.z + Math.sin(a) * r;
      if (blocked(x, z) || !terrain.main.isInside(x, z)) continue;
      if (terrain.slopeAt(x, z) > 0.75) continue;
      // clairières
      if (Math.sin(x * 0.031) * Math.cos(z * 0.027) > 0.55) continue;
      const cl = rng() < 0.3;
      const s = cl ? 6 + rng() * 2.5 : 6.5 + rng() * 3.5;
      if (add(cl ? rng.pick(clusters) : rng.pick(singles), x, z, s, rng() * Math.PI * 2, { col: 'tree' })) i++;
    }
    // arbres épars et bosquets sur toute l'île
    const nSparse = Math.round(1100 * density);
    for (let i = 0, tries = 0; i < nSparse && tries < nSparse * 8; tries++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * MR * 0.96;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (blocked(x, z) || !terrain.main.isInside(x, z)) continue;
      const h = terrain.heightAt(x, z);
      if (h === null || h > 80 || terrain.slopeAt(x, z) > 0.7) continue;
      const grove = Math.sin(x * 0.017 + 1.3) * Math.cos(z * 0.021 - 0.7) * 0.5 + 0.5;
      const near = Math.hypot(x - HILLS.x, z - HILLS.z) < HILLS.radius ? 0.5 : 1;
      if (rng() > near * (0.2 + grove * 0.8)) continue;
      const cl = rng() < 0.22;
      const s = cl ? 5.5 + rng() * 2 : 6 + rng() * 3.5;
      if (add(cl ? rng.pick(clusters) : rng.pick(singles), x, z, s, rng() * Math.PI * 2, { col: 'tree' })) i++;
    }
    // îlots (biomes propres)
    for (const def of ISLETS) {
      const n = Math.round(def.radius * 0.5 * density);
      const look = def.biome === 'snowy' ? 'snow' : def.biome === 'dry' ? 'autumn' : def.biome === 'lush' ? 'jungle' : 'base';
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * def.radius * 0.85;
        const x = def.x + Math.cos(a) * r, z = def.z + Math.sin(a) * r;
        if (BEACONS.some((b) => Math.hypot(x - b.x, z - b.z) < 12)) continue;
        if (UPDRAFTS.some((u) => Math.hypot(x - u.x, z - u.z) < u.radius + 4)) continue;
        if (Math.hypot(x - def.x, z - def.z) < 9) continue;
        if (def.biome === 'dusk') { add(rng.pick(['hw_tree_dead_large', 'hw_tree_dead_medium', 'hw_tree_pine_orange_medium']), x, z, 1.7 + rng() * 0.8, rng() * Math.PI * 2, { col: 'tree', look: 'hw', region: def.id }); continue; }
        if (def.biome === 'lush') { const p = rng() < 0.55; add(p ? rng.pick(['proc_palm_A', 'proc_palm_B']) : 'proc_kapok', x, z, p ? 7 + rng() * 2.5 : 8 + rng() * 3, rng() * Math.PI * 2, { col: 'tree', look: 'jungle', region: def.id }); continue; }
        const cl = rng() < 0.25;
        add(cl ? rng.pick(clusters) : rng.pick(singles), x, z, (cl ? 5.5 : 6) + rng() * 3, rng() * Math.PI * 2, { col: 'tree', look, region: def.id });
      }
      for (let i = 0; i < Math.round(def.radius * 0.18); i++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * def.radius * 0.85;
        const x = def.x + Math.cos(a) * r, z = def.z + Math.sin(a) * r;
        const s = 6 + rng() * 9;
        add(rng.pick(rocks), x, z, s, rng() * Math.PI * 2, { col: 'rock', sink: s * 0.03, sy: 0.8 + rng() * 0.7, region: def.id, look: def.biome === 'snowy' ? 'snow' : def.biome === 'dusk' ? 'dark' : def.biome === 'dry' ? 'red' : 'base' });
      }
    }
    // rochers
    const nRocks = Math.round(1000 * density);
    for (let i = 0, tries = 0; i < nRocks && tries < nRocks * 5; tries++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * MR * 0.98;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!terrain.main.isInside(x, z)) continue;
      if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.radius - 4) continue;
      if (Math.hypot(x - HAMLET.x, z - HAMLET.z) < HAMLET.radius + 4) continue;
      if (pathDistance(x, z) < 3) continue;
      if (UPDRAFTS.some((u) => Math.hypot(x - u.x, z - u.z) < u.radius + 4)) continue;
      const mt = Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z) < MOUNTAIN.radius;
      const cliffs = Math.hypot(x - W(-175), z - W(-120)) < W(48);
      const big = rng() < (mt || cliffs ? 0.5 : 0.15);
      const s = big ? 14 + rng() * 18 : 6 + rng() * 8;
      add(rng.pick(rocks), x, z, s, rng() * Math.PI * 2, { col: 'rock', sink: s * 0.03, sy: 0.8 + rng() * (cliffs ? 1.6 : 0.8) });
      i++;
    }
    // plantes du lac
    for (let i = 0; i < 90; i++) {
      const a = rng() * Math.PI * 2, r = LAKE.radius * (0.35 + rng() * 0.75);
      const x = LAKE.x + Math.cos(a) * r, z = LAKE.z + Math.sin(a) * r;
      const h = terrain.heightAt(x, z);
      if (h === null) continue;
      if (h < LAKE.level - 0.6) add(rng.pick(['waterlily_A', 'waterlily_B']), x, z, 7 + rng() * 4, rng() * 6.28, { y: LAKE.level + 0.02, sink: 0 });
      else add(rng.pick(['waterplant_A', 'waterplant_B', 'waterplant_C']), x, z, 8 + rng() * 5, rng() * 6.28);
    }

    // grandes îles : sapins enneigés au nord, arbres d'automne à l'est, jungle au sud, landes mortes à l'ouest
    for (const isl of terrain.big) {
      const def = isl.def, biome = def.biome, region = def.id;
      const snow = biome === 'snow', jungle = biome === 'jungle', haunted = biome === 'haunted';
      const avoid = (x, z) => {
        if (pathDistance(x, z) < 4.5) return true;
        if (def.camp && Math.hypot(x - def.camp.x, z - def.camp.z) < def.camp.radius + 10) return true;
        if (def.lake && Math.hypot(x - def.lake.x, z - def.lake.z) < def.lake.radius * (haunted ? 1.05 : 1.35)) return true;
        for (const k of ['sanctuary', 'temple', 'cemetery']) if (def[k] && Math.hypot(x - def[k].x, z - def[k].z) < def[k].radius + 6) return true;
        if (def.crypt && Math.hypot(x - def.crypt.x, z - def.crypt.z) < def.crypt.radius * 1.6) return true;
        if (def.cirque && Math.hypot(x - def.cirque.x, z - def.cirque.z) < def.cirque.radius * 1.2) return true;
        if (def.mine && Math.hypot(x - def.mine.x, z - def.mine.z) < 30) return true;
        for (const b of BEACONS) if (Math.hypot(x - b.x, z - b.z) < 13) return true;
        for (const w of WAYSTONES) if (Math.hypot(x - w.x, z - w.z) < 7) return true;
        for (const u of UPDRAFTS) if (Math.hypot(x - u.x, z - u.z) < u.radius + 4) return true;
        for (const wb of WORLD_BOSSES) if (Math.hypot(x - wb.x, z - wb.z) < 28) return true;
        return false;
      };
      const nT = Math.round((snow ? 2000 : jungle ? 2600 : haunted ? 1500 : 1000) * density);
      for (let i = 0, tries = 0; i < nT && tries < nT * 6; tries++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * def.radius;
        const x = def.x + Math.cos(a) * r, z = def.z + Math.sin(a) * r;
        if (!isl.isInside(x, z) || avoid(x, z)) continue;
        const h = isl.heightAt(x, z);
        if (h === null || terrain.slopeAt(x, z) > 0.62 || (snow && h > 150)) continue;
        // bosquets : le bruit regroupe les arbres en forêts
        const grove = Math.sin(x * 0.011 + def.seed) * Math.cos(z * 0.009 - def.seed) * 0.5 + 0.5;
        if (rng() > (snow ? 0.25 + grove * 0.75 : jungle ? 0.45 + grove * 0.55 : 0.15 + grove * 0.6)) continue;
        if (haunted) {
          const pine = grove > 0.55 && rng() < 0.6;
          const name = pine ? rng.pick(['hw_tree_pine_orange_large', 'hw_tree_pine_yellow_large', 'hw_tree_pine_orange_medium', 'hw_tree_pine_yellow_medium'])
            : rng.pick(['hw_tree_dead_large', 'hw_tree_dead_large', 'hw_tree_dead_medium', 'hw_tree_dead_small', 'hw_tree_dead_large_decorated']);
          if (add(name, x, z, (pine ? 1.5 : 2.0) + rng() * 0.9, rng() * Math.PI * 2, { col: 'tree', region, look: 'hw' })) i++;
          continue;
        }
        if (jungle) {
          // fromagers géants et palmiers (plus nombreux près de l'eau), quelques bosquets
          const nearWater = def.lake && Math.hypot(x - def.lake.x, z - def.lake.z) < def.lake.radius * 2.4;
          const r2 = rng();
          const [name, s] = r2 < (nearWater ? 0.7 : 0.35) ? [rng() < 0.5 ? 'proc_palm_A' : 'proc_palm_B', 7.5 + rng() * 3]
            : r2 < 0.85 ? ['proc_kapok', 9 + rng() * 4.5] : ['proc_kapok', 5.5 + rng() * 2.5]; // jeunes fromagers
          if (add(name, x, z, s, rng() * Math.PI * 2, { col: 'tree', region, look: 'jungle' })) i++;
          continue;
        }
        const cl = rng() < (snow ? 0.3 : 0.12);
        const s = cl ? 5.5 + rng() * 2.5 : 6 + rng() * 3.5;
        const name = snow ? (cl ? rng.pick(['trees_A_large', 'trees_A_medium', 'trees_A_small']) : 'tree_single_A')
          : (cl ? rng.pick(['trees_B_medium', 'trees_B_small']) : 'tree_single_B');
        if (add(name, x, z, s, rng() * Math.PI * 2, { col: 'tree', region, look: snow ? 'snow' : 'autumn' })) i++;
      }
      const nR = Math.round((snow ? 650 : jungle ? 500 : haunted ? 600 : 900) * density);
      for (let i = 0, tries = 0; i < nR && tries < nR * 5; tries++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * def.radius;
        const x = def.x + Math.cos(a) * r, z = def.z + Math.sin(a) * r;
        if (!isl.isInside(x, z) || pathDistance(x, z) < 3 || avoid(x, z)) continue;
        const big = rng() < (snow ? 0.3 : 0.4);
        const s = big ? 14 + rng() * 18 : 6 + rng() * 8;
        add(rng.pick(rocks), x, z, s, rng() * Math.PI * 2, { col: 'rock', sink: s * 0.03, sy: snow ? 0.7 + rng() * 0.6 : 0.9 + rng() * 1.2, region, look: snow ? 'snow' : jungle ? 'moss' : haunted ? 'dark' : 'red' });
        i++;
      }
      // terres d'ambre : cactus
      if (biome === 'amber') {
        for (let i = 0, tries = 0; i < Math.round(320 * density) && tries < 3000; tries++) {
          const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * def.radius;
          const x = def.x + Math.cos(a) * r, z = def.z + Math.sin(a) * r;
          if (!isl.isInside(x, z) || avoid(x, z) || terrain.slopeAt(x, z) > 0.45) continue;
          const big = rng() < 0.55;
          add(big ? rng.pick(['c_cactus_medium_A', 'c_cactus_medium_B']) : rng.pick(['c_cactus_small_A', 'c_cactus_small_B']), x, z, (big ? 4.5 : 4) + rng() * 2.5, rng() * Math.PI * 2, { col: big ? 'rock' : null, region, look: 'cactus', sink: 0.05 });
          i++;
        }
      }
      // landes : tombes éparses, citrouilles et ossements ; jungle : plantes d'eau
      if (haunted) {
        const props = [['hw_gravestone', 1.3], ['hw_grave_A', 1.2], ['hw_grave_B', 1.2], ['hw_gravemarker_A', 1.4], ['hw_gravemarker_B', 1.4], ['hw_grave_A_destroyed', 1.2], ['hw_skull', 1.1], ['hw_bone_C', 1.5], ['hw_pumpkin_orange', 1.4], ['hw_pumpkin_yellow_small', 1.6]];
        for (let i = 0, tries = 0; i < Math.round(320 * density) && tries < 3000; tries++) {
          const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * def.radius;
          const x = def.x + Math.cos(a) * r, z = def.z + Math.sin(a) * r;
          if (!isl.isInside(x, z) || avoid(x, z) || terrain.slopeAt(x, z) > 0.4) continue;
          const [name, sc] = rng.pick(props);
          add(name, x, z, sc * (0.9 + rng() * 0.3), rng() * Math.PI * 2, { col: /grave|stone/.test(name) ? 'rock' : null, region, look: 'hw', sink: 0.05 });
          i++;
        }
      }
      if (jungle) {
        for (let i = 0, tries = 0; i < Math.round(900 * density) && tries < 6000; tries++) {
          const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * def.radius;
          const x = def.x + Math.cos(a) * r, z = def.z + Math.sin(a) * r;
          if (!isl.isInside(x, z) || pathDistance(x, z) < 2.5 || terrain.slopeAt(x, z) > 0.5) continue;
          if (def.camp && Math.hypot(x - def.camp.x, z - def.camp.z) < def.camp.radius) continue;
          if (def.lake && Math.hypot(x - def.lake.x, z - def.lake.z) < def.lake.radius * 1.05) continue;
          add('proc_fern', x, z, 5 + rng() * 4, rng() * Math.PI * 2, { region, look: 'jungle', sink: 0.05 });
          i++;
        }
      }
      if (jungle && def.lake) {
        for (let i = 0; i < 120; i++) {
          const a = rng() * Math.PI * 2, r = def.lake.radius * (0.3 + rng() * 0.95);
          const x = def.lake.x + Math.cos(a) * r, z = def.lake.z + Math.sin(a) * r;
          const h = terrain.heightAt(x, z);
          if (h === null) continue;
          if (h < def.lake.level - 0.6) add(rng.pick(['waterlily_A', 'waterlily_B']), x, z, 8 + rng() * 5, rng() * 6.28, { y: def.lake.level + 0.02, sink: 0, region, look: 'jungle' });
          else add(rng.pick(['waterplant_A', 'waterplant_B', 'waterplant_C']), x, z, 9 + rng() * 6, rng() * 6.28, { region, look: 'jungle' });
        }
      }
    }

    // matériaux : arbres (vent, tramage près de la caméra, Brume) / décors statiques
    const baseMat = assets.propGeometry('tree_single_A').material;
    this.treeUniforms = { uTime: { value: 0 }, uWind: { value: 1 }, uPlayerPos: { value: new THREE.Vector3(0, -999, 0) } };
    const tu = this.treeUniforms;
    const SNOW_GLSL = `{
      vec3 wnS = normalize(inverseTransformDirection(vNormal, viewMatrix));
      float snowF = smoothstep(0.22, 0.65, wnS.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.94, 1.0), snowF * 0.92);
    }`;
    const AUTUMN_GLSL = `{
      float greenness = diffuseColor.g - max(diffuseColor.r, diffuseColor.b);
      vec3 autumn = mix(vec3(0.92, 0.36, 0.1), vec3(1.0, 0.74, 0.2), vInstR);
      float lumA = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
      diffuseColor.rgb = mix(diffuseColor.rgb, autumn * (0.45 + lumA * 1.5), smoothstep(-0.01, 0.07, greenness));
    }`;
    const JUNGLE_GLSL = `{
      float greenness = diffuseColor.g - max(diffuseColor.r, diffuseColor.b);
      vec3 lush = diffuseColor.rgb * vec3(0.62, 1.12, 0.7);
      diffuseColor.rgb = mix(diffuseColor.rgb, lush, smoothstep(-0.02, 0.06, greenness));
    }`;
    const makeTreeMat = (mode, base = baseMat) => {
      const mat = base.clone();
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = tu.uTime; shader.uniforms.uWind = tu.uWind; shader.uniforms.uPlayerPos = tu.uPlayerPos;
        shader.uniforms.uCorruption = { value: maps.corruptionTex };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind; varying vec3 vWorldPosC; varying float vInstR;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            {
              vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
              vInstR = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
              float h = max(position.y, 0.0);
              float ph = ip.x * 0.07 + ip.z * 0.05;
              float sway = (sin(uTime * 1.3 + ph) * 0.6 + sin(uTime * 2.7 + ph * 1.7) * 0.25) * uWind;
              transformed.x += sway * h * h * 0.05;
              transformed.z += sway * h * h * 0.03;
            }`)
          .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
            vWorldPosC = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>
            varying vec3 vWorldPosC; varying float vInstR; uniform sampler2D uCorruption; uniform vec3 uPlayerPos;
            float bayer4(vec2 p) { vec2 q = mod(floor(p), 4.0); int i = int(q.x) + int(q.y) * 4;
              int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5); return (float(m[i]) + 0.5) / 16.0; }`)
          .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
            {
              // feuillage translucide entre la caméra et le héros (tramage)
              vec3 seg = uPlayerPos + vec3(0.0, 1.4, 0.0) - cameraPosition;
              float segL = length(seg);
              vec3 sd = seg / max(segL, 0.001);
              vec3 cf = vWorldPosC - cameraPosition;
              float tt = clamp(dot(cf, sd), 0.0, segL);
              float dseg = length(cameraPosition + sd * tt - vWorldPosC);
              float fade = (tt < segL - 0.8) ? 1.0 - smoothstep(1.2, 3.2, dseg) : 0.0;
              fade = max(fade, 1.0 - smoothstep(2.5, 6.5, length(cf)));
              if (fade * 0.85 > bayer4(gl_FragCoord.xy)) discard;
            }`)
          .replace('#include <color_fragment>', `#include <color_fragment>
            ${mode === 'snow' ? SNOW_GLSL : mode === 'autumn' ? AUTUMN_GLSL : mode === 'jungle' ? JUNGLE_GLSL : ''}
            {
              vec2 cuv = ${CORR_UV_GLSL.replace(/WP/g, 'vWorldPosC.xz')};
              float cor = texture2D(uCorruption, cuv).r;
              float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
              diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, vec3(lum), 0.6) * vec3(0.8, 0.7, 0.95), cor * 0.58);
            }`);
      };
      mat.customProgramCacheKey = () => 'treewind-' + mode;
      return mat;
    };
    const makeStaticMat = (mode, base = baseMat) => {
      const mat = base.clone();
      if (mode === 'red') mat.color.set('#ffab80');
      if (mode === 'dark') mat.color.set('#a59cbb');
      if (mode === 'moss') mat.color.set('#a9d39a');
      applyCorruption(mat, maps, 0.8, mode === 'snow' ? SNOW_GLSL : '');
      return mat;
    };
    this.treeMats = { base: makeTreeMat('base'), snow: makeTreeMat('snow'), autumn: makeTreeMat('autumn'), jungle: makeTreeMat('jungle') };
    // modèles d'un autre pack (texture propre) : matériaux construits à la demande
    const extraMats = new Map();
    const matFor = (name, isTree, look) => {
      const src = assets.propGeometry(name).material;
      if (src === baseMat || src.map === baseMat.map) return isTree ? (this.treeMats[look] || this.treeMats.base) : (this.staticMats[look] || this.staticMats.base);
      const key = src.uuid + (isTree ? '|t' : '|s');
      if (!extraMats.has(key)) extraMats.set(key, isTree ? makeTreeMat('base', src) : makeStaticMat('base', src));
      return extraMats.get(key);
    };
    this.staticMats = { base: makeStaticMat('base'), snow: makeStaticMat('snow'), red: makeStaticMat('red'), autumn: makeStaticMat('base'), dark: makeStaticMat('dark'), moss: makeStaticMat('moss'), jungle: makeStaticMat('base') };
    this.treeMat = this.treeMats.base; this.staticMat = this.staticMats.base;

    // un maillage instancié par (région, rendu, modèle) : chaque île est écartée si hors champ
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const [key, list] of buckets) {
      const [, look, name] = key.split('|');
      const g = assets.propGeometry(name);
      if (!g) continue;
      const isTree = /tree/.test(name);
      const mat = matFor(name, isTree, look);
      const mesh = new THREE.InstancedMesh(g.geometry, mat, list.length);
      const n = list.length;
      if (!g.geometry.boundingSphere) g.geometry.computeBoundingSphere();
      const gs = g.geometry.boundingSphere;
      // par instance : matrice + sphère englobante (tri au plus près / hors champ)
      const mats = new Float32Array(n * 16), sph = new Float32Array(n * 4);
      list.forEach((it, i) => {
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, it.r);
        v.set(it.x, it.y, it.z); sc.set(it.s, it.s * it.sy, it.s);
        m.compose(v, q, sc);
        mesh.setMatrixAt(i, m);
        m.toArray(mats, i * 16);
        sph[i * 4] = it.x; sph[i * 4 + 1] = it.y + gs.center.y * it.s * it.sy; sph[i * 4 + 2] = it.z;
        sph[i * 4 + 3] = (gs.radius + Math.hypot(gs.center.x, gs.center.z)) * it.s * Math.max(1, it.sy);
      });
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.userData = { mats, sph, n, near: n };
      mesh.onBeforeShadow = shadowBefore; mesh.onAfterShadow = shadowAfter;
      scene.add(mesh);
      this.meshes.push(mesh);
    }
    this.treePositions = [];
    for (const [key, list] of buckets) if (/tree/.test(key)) for (const it of list) this.treePositions.push(it);
  }

  update(dt, elapsed, focus, camera) {
    this.treeUniforms.uTime.value = elapsed;
    if (!focus) return;
    this.treeUniforms.uPlayerPos.value.copy(focus);
    if (!camera) return;
    // on ne refait le tri que si la caméra a bougé ou tourné sensiblement (marge de 4,5°)
    const cs = this._cs || (this._cs = { p: new THREE.Vector3(1e9, 0, 0), d: new THREE.Vector3(), f: new THREE.Vector3(), fx: 1e9, fz: 1e9 });
    camera.getWorldDirection(cs.d);
    const moved = camera.position.distanceToSquared(cs.p) > 1.5 * 1.5 || cs.d.dot(cs.f) < 0.9986
      || Math.hypot(focus.x - cs.fx, focus.z - cs.fz) > 4 || this.dirty;
    if (!moved) return;
    cs.p.copy(camera.position); cs.f.copy(cs.d); cs.fx = focus.x; cs.fz = focus.z; this.dirty = false;
    this.cull(focus, camera);
  }

  // viewDist : au-delà, les instances ne sont plus dessinées (qualité basse)
  setViewDistance(d) { this.viewDist = d || Infinity; this.dirty = true; }

  // Instances dessinées : proches du héros (elles portent les ombres) puis celles dans le champ.
  cull(focus, camera) {
    const fr = this._fr || (this._fr = new THREE.Frustum()), pm = this._pm || (this._pm = new THREE.Matrix4());
    camera.updateMatrixWorld();
    fr.setFromProjectionMatrix(pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const planes = fr.planes, cp = camera.position;
    const SR2 = SHADOW_RADIUS * SHADOW_RADIUS, VR = this.viewDist ?? Infinity, VR2 = VR * VR;
    const far = this._far || (this._far = new Uint32Array(4096));
    for (const mesh of this.meshes) {
      const u = mesh.userData, bs = mesh.boundingSphere, n = u.n;
      const dc = Math.hypot(bs.center.x - focus.x, bs.center.z - focus.z);
      const nearAny = dc - bs.radius < SHADOW_RADIUS;
      if (!nearAny && (dc - bs.radius > VR || !fr.intersectsSphere(bs))) { mesh.count = 0; u.near = 0; mesh.castShadow = false; continue; }
      const { sph, mats } = u, arr = mesh.instanceMatrix.array;
      let k = 0, nf = 0;
      for (let i = 0; i < n; i++) {
        const x = sph[i * 4], y = sph[i * 4 + 1], z = sph[i * 4 + 2];
        const dx = x - focus.x, dz = z - focus.z, d2 = dx * dx + dz * dz;
        if (d2 < SR2) { arr.set(mats.subarray(i * 16, i * 16 + 16), k * 16); k++; continue; }
        if (d2 > VR2) continue;
        // test de la sphère contre le cône de vue, élargi avec la distance
        const r = sph[i * 4 + 3] + Math.hypot(x - cp.x, z - cp.z) * 0.08;
        let inside = true;
        for (let p = 0; p < 6; p++) { const pl = planes[p]; if (pl.normal.x * x + pl.normal.y * y + pl.normal.z * z + pl.constant < -r) { inside = false; break; } }
        if (inside) { if (nf >= far.length) break; far[nf++] = i; }
      }
      u.near = k;
      for (let j = 0; j < nf; j++) { const i = far[j]; arr.set(mats.subarray(i * 16, i * 16 + 16), k * 16); k++; }
      mesh.count = k;
      mesh.castShadow = u.near > 0;
      if (k) { mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, k * 16); mesh.instanceMatrix.needsUpdate = true; }
    }
  }
}

const SHADOW_RADIUS = 85;
function shadowBefore() { this.userData.cnt = this.count; this.count = this.userData.near; }
function shadowAfter() { this.count = this.userData.cnt; }

export { smoothstep };
