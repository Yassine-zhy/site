import * as THREE from 'three';
import { mulberry32, smoothstep, Simplex } from '../engine/math.js';
import { pathDistance } from './Terrain.js';
import { VILLAGE, FOREST, MOUNTAIN, RUINS, HILLS, HAMLET, BEACONS, UPDRAFTS, WAYSTONES, WORLD_BOSSES, REGIONS, WATERS, WORLD_HALF } from '../config.js';

// taille des tuiles de végétation (une tuile hors de vue n'est pas parcourue)
const TILE = 600;
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
      const key = `${opts.look || 'base'}|${name}|${Math.floor(x / TILE)},${Math.floor(z / TILE)}`;
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
    // lieux où rien ne pousse : villages, routes, eaux, monuments, arènes
    const POIS = [];
    const poi = (o, r) => { if (o) POIS.push([o.x, o.z, r]); };
    poi(VILLAGE, VILLAGE.radius + 6); poi(HAMLET, HAMLET.radius + 10); poi(RUINS, RUINS.radius * 0.75);
    poi({ x: MOUNTAIN.x, z: MOUNTAIN.z + 4 }, MOUNTAIN.summitRadius + 6);
    for (const b of BEACONS) poi(b, 13);
    for (const u of UPDRAFTS) poi(u, u.radius + 4);
    for (const w of WAYSTONES) poi(w, 8);
    for (const wb of WORLD_BOSSES) poi(wb, 28);
    for (const def of REGIONS) {
      poi(def.camp, (def.camp?.radius || 0) + 10);
      for (const k of ['sanctuary', 'temple', 'cemetery', 'table', 'belvedere']) poi(def[k], (def[k]?.radius || 0) + 6);
      poi(def.crypt, (def.crypt?.radius || 0) * 1.6); poi(def.cirque, (def.cirque?.radius || 0) * 1.2); poi(def.mine, 30);
    }
    const blocked = (x, z, path = 4.5) => {
      for (const [px, pz, r] of POIS) if (Math.abs(x - px) < r && Math.abs(z - pz) < r && Math.hypot(x - px, z - pz) < r) return true;
      for (const w of WATERS) if (Math.hypot(x - w.x, z - w.z) < w.radius * (w.kind === 'marsh' ? 1.05 : 1.3)) return true;
      return pathDistance(x, z) < path;
    };
    const singles = ['tree_single_A', 'tree_single_B'];
    const rocks = ['rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E'];
    const clustersA = ['trees_A_large', 'trees_A_medium', 'trees_A_small'], clustersB = ['trees_B_large', 'trees_B_medium', 'trees_B_small'];
    const clusters = [...clustersA, ...clustersB];
    const graves = [['hw_gravestone', 1.3], ['hw_grave_A', 1.2], ['hw_grave_B', 1.2], ['hw_gravemarker_A', 1.4], ['hw_gravemarker_B', 1.4], ['hw_grave_A_destroyed', 1.2], ['hw_skull', 1.1], ['hw_bone_C', 1.5], ['hw_pumpkin_orange', 1.4], ['hw_pumpkin_yellow_small', 1.6]];
    const nz = new Simplex(777);
    const R = () => rng() * Math.PI * 2;
    const tree = (name, x, z, s, look) => add(name, x, z, s, R(), { col: 'tree', look });
    const rock = (x, z, big, look, tall = 0.8) => {
      const s = big ? 14 + rng() * 18 : 6 + rng() * 8;
      add(rng.pick(rocks), x, z, s, R(), { col: 'rock', sink: s * 0.03, sy: 0.8 + rng() * tall, look });
    };
    // une case de la grille → au plus un élément, selon le biome dominant
    const PLACE = {
      temperate(x, z, h, sl, grove) {
        const ft = 1 - smoothstep(FOREST.radius * 0.55, FOREST.radius * 1.05, Math.hypot(x - FOREST.x, z - FOREST.z));
        const mt = Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z) < MOUNTAIN.radius * 1.1;
        const hills = Math.hypot(x - HILLS.x, z - HILLS.z) < HILLS.radius ? 0.5 : 1;
        const clearing = Math.sin(x * 0.031) * Math.cos(z * 0.027) > 0.55 ? 0.15 : 1;
        if (h < 85 && sl < 0.7) {
          const p = (ft * 0.4 * clearing + grove * 0.16 * hills + (mt ? 0.06 : 0.008)) * density;
          if (rng() < p) {
            const cl = rng() < 0.28;
            return tree(cl ? rng.pick(mt ? clustersA : clusters) : mt ? 'tree_single_A' : rng.pick(singles), x, z, cl ? 6 + rng() * 2.5 : 6.5 + rng() * 3.5, 'base');
          }
        }
        if (rng() < (mt ? 0.05 : 0.011) * density) rock(x, z, rng() < (mt ? 0.5 : 0.15), 'base');
      },
      snow(x, z, h, sl, grove) {
        if (h < 125 && sl < 0.62 && rng() < (0.04 + grove * 0.3) * density) {
          const cl = rng() < 0.3;
          return tree(cl ? rng.pick(clustersA) : 'tree_single_A', x, z, cl ? 5.5 + rng() * 2.5 : 6 + rng() * 3.5, 'snow');
        }
        if (rng() < 0.026 * density) rock(x, z, rng() < 0.3, 'snow', 0.6);
      },
      amber(x, z, h, sl, grove) {
        const r = rng();
        if (sl < 0.6 && r < (0.012 + grove * 0.04) * density) {
          const cl = rng() < 0.12;
          return tree(cl ? rng.pick(['trees_B_medium', 'trees_B_small']) : 'tree_single_B', x, z, cl ? 5.5 + rng() * 2.5 : 6 + rng() * 3.5, 'autumn');
        }
        if (sl < 0.45 && r < 0.05 * density) {
          const big = rng() < 0.55;
          return add(big ? rng.pick(['c_cactus_medium_A', 'c_cactus_medium_B']) : rng.pick(['c_cactus_small_A', 'c_cactus_small_B']), x, z, (big ? 4.5 : 4) + rng() * 2.5, R(), { col: big ? 'rock' : null, look: 'cactus', sink: 0.05 });
        }
        if (r < 0.08 * density) rock(x, z, rng() < 0.4, 'red', 1.2);
      },
      jungle(x, z, h, sl, grove, def) {
        const r = rng();
        if (sl < 0.62 && r < (0.2 + grove * 0.25) * density) {
          const nearWater = h < 7 || (def.lake && Math.hypot(x - def.lake.x, z - def.lake.z) < def.lake.radius * 2.4);
          const r2 = rng();
          if (r2 < (nearWater ? 0.7 : 0.35)) return tree(rng() < 0.5 ? 'proc_palm_A' : 'proc_palm_B', x, z, 7.5 + rng() * 3, 'jungle');
          return tree('proc_kapok', x, z, r2 < 0.85 ? 9 + rng() * 4.5 : 5.5 + rng() * 2.5, 'jungle');
        }
        if (sl < 0.5 && r < 0.6 * density && rng() < 0.3) return add('proc_fern', x, z, 5 + rng() * 4, R(), { look: 'jungle', sink: 0.05 });
        if (rng() < 0.012 * density) rock(x, z, rng() < 0.4, 'moss', 1.2);
      },
      haunted(x, z, h, sl, grove) {
        const r = rng();
        if (sl < 0.62 && r < (0.04 + grove * 0.13) * density) {
          const pine = grove > 0.55 && rng() < 0.6;
          const name = pine ? rng.pick(['hw_tree_pine_orange_large', 'hw_tree_pine_yellow_large', 'hw_tree_pine_orange_medium', 'hw_tree_pine_yellow_medium'])
            : rng.pick(['hw_tree_dead_large', 'hw_tree_dead_large', 'hw_tree_dead_medium', 'hw_tree_dead_small', 'hw_tree_dead_large_decorated']);
          return add(name, x, z, (pine ? 1.5 : 2.0) + rng() * 0.9, R(), { col: 'tree', look: 'hw' });
        }
        if (sl < 0.4 && r < 0.2 * density) {
          const [name, sc] = rng.pick(graves);
          return add(name, x, z, sc * (0.9 + rng() * 0.3), R(), { col: /grave|stone/.test(name) ? 'rock' : null, look: 'hw', sink: 0.05 });
        }
        if (r < 0.22 * density) rock(x, z, rng() < 0.4, 'dark', 1.2);
      },
      highland(x, z, h, sl, grove) {
        const r = rng();
        if (sl < 0.55 && r < (0.006 + grove * 0.035) * density) {
          const cl = rng() < 0.4;
          return tree(cl ? rng.pick(['trees_B_small', 'trees_A_small']) : rng.pick(singles), x, z, cl ? 5 + rng() * 2 : 5.5 + rng() * 3, 'base');
        }
        if (r < 0.06 * density) rock(x, z, rng() < 0.45, 'base', 1.4);
      },
      beach(x, z, h, sl, grove) {
        const r = rng();
        if (sl < 0.5 && r < (0.025 + (h < 5 ? 0.06 : 0) + grove * 0.04) * density) {
          if (rng() < 0.82) return tree(rng() < 0.5 ? 'proc_palm_A' : 'proc_palm_B', x, z, 7 + rng() * 3.5, 'jungle');
          return tree('proc_kapok', x, z, 5.5 + rng() * 3, 'jungle');
        }
        if (h > 3 && sl < 0.5 && r < 0.12 * density && rng() < 0.3) return add('proc_fern', x, z, 4 + rng() * 3, R(), { look: 'jungle', sink: 0.05 });
        if (r < 0.14 * density && rng() < 0.05) rock(x, z, rng() < 0.3, 'base', 0.6);
      },
      swamp(x, z, h, sl, grove) {
        const r = rng();
        if (sl < 0.55 && r < (0.05 + grove * 0.12) * density) {
          if (rng() < 0.45) return add(rng.pick(['hw_tree_dead_large', 'hw_tree_dead_medium', 'hw_tree_dead_small']), x, z, 2 + rng() * 0.9, R(), { col: 'tree', look: 'hw' });
          const cl = rng() < 0.3;
          return tree(cl ? rng.pick(['trees_B_medium', 'trees_B_small']) : 'tree_single_B', x, z, cl ? 5.5 + rng() * 2 : 6 + rng() * 3, 'swamp');
        }
        if (r < 0.2 * density && rng() < 0.06) rock(x, z, false, 'moss', 0.5);
      },
      cliffs(x, z, h, sl, grove) {
        const r = rng();
        if (sl < 0.58 && r < (0.015 + grove * 0.1) * density) {
          const cl = rng() < 0.25;
          return tree(cl ? rng.pick(clustersA) : 'tree_single_A', x, z, cl ? 5.5 + rng() * 2.5 : 6 + rng() * 3.5, 'base');
        }
        if (r < 0.07 * density) rock(x, z, rng() < 0.5, 'base', 1.6);
      },
    };
    // grille légèrement désordonnée sur tout le continent
    const CELL = 7;
    for (let gz = -WORLD_HALF; gz < WORLD_HALF; gz += CELL) {
      for (let gx = -WORLD_HALF; gx < WORLD_HALF; gx += CELL) {
        const x = gx + rng() * CELL, z = gz + rng() * CELL;
        const h = terrain.continentHeight(x, z);
        if (h < 0.9) { rng(); rng(); continue; }
        if (blocked(x, z)) continue;
        const def = terrain.regionAt(x, z);
        const sl = terrain.slopeAt(x, z);
        // bosquets : le bruit regroupe les arbres en forêts
        const grove = smoothstep(-0.1, 0.6, nz.fbm2(x / 150 + (def.seed || 0), z / 150, 3));
        (PLACE[def.biome] || PLACE.temperate)(x, z, h, sl, grove, def);
      }
    }
    // plantes des lacs
    for (const w of WATERS) {
      const look = w.kind === 'jungle' || w.kind === 'lagoon' ? 'jungle' : 'base';
      for (let i = 0; i < Math.round(w.radius * 1.4); i++) {
        const a = R(), r = w.radius * (0.3 + rng() * 0.95);
        const x = w.x + Math.cos(a) * r, z = w.z + Math.sin(a) * r;
        const h = terrain.heightAt(x, z);
        if (h < w.level - 0.6) { if (w.kind !== 'marsh' || rng() < 0.4) add(rng.pick(['waterlily_A', 'waterlily_B']), x, z, 7 + rng() * 5, R(), { y: w.level + 0.02, sink: 0, look }); }
        else add(rng.pick(['waterplant_A', 'waterplant_B', 'waterplant_C']), x, z, 8 + rng() * 6, R(), { look });
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
    const SWAMP_GLSL = `{
      float greenness = diffuseColor.g - max(diffuseColor.r, diffuseColor.b);
      float lumS = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
      vec3 murk = mix(vec3(lumS), diffuseColor.rgb, 0.45) * vec3(0.78, 0.86, 0.6);
      diffuseColor.rgb = mix(diffuseColor.rgb, murk, smoothstep(-0.02, 0.06, greenness));
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
            ${mode === 'snow' ? SNOW_GLSL : mode === 'autumn' ? AUTUMN_GLSL : mode === 'jungle' ? JUNGLE_GLSL : mode === 'swamp' ? SWAMP_GLSL : ''}
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
    this.treeMats = { base: makeTreeMat('base'), snow: makeTreeMat('snow'), autumn: makeTreeMat('autumn'), jungle: makeTreeMat('jungle'), swamp: makeTreeMat('swamp') };
    // modèles d'un autre pack (texture propre) : matériaux construits à la demande
    const extraMats = new Map();
    const matFor = (name, isTree, look) => {
      const src = assets.propGeometry(name).material;
      if (src === baseMat || src.map === baseMat.map) return isTree ? (this.treeMats[look] || this.treeMats.base) : (this.staticMats[look] || this.staticMats.base);
      const key = src.uuid + (isTree ? '|t' : '|s');
      if (!extraMats.has(key)) extraMats.set(key, isTree ? makeTreeMat('base', src) : makeStaticMat('base', src));
      return extraMats.get(key);
    };
    this.staticMats = { base: makeStaticMat('base'), snow: makeStaticMat('snow'), red: makeStaticMat('red'), autumn: makeStaticMat('base'), dark: makeStaticMat('dark'), moss: makeStaticMat('moss'), jungle: makeStaticMat('base'), swamp: makeStaticMat('moss') };
    this.treeMat = this.treeMats.base; this.staticMat = this.staticMats.base;

    // un maillage instancié par (région, rendu, modèle) : chaque île est écartée si hors champ
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const [key, list] of buckets) {
      const [look, name] = key.split('|');
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
      // petits objets (fougères, plantes, tombes, cactus nains) : seulement à courte distance
      const small = /fern|waterplant|waterlily|cactus_small|hw_(?!tree)|rock_single_[CDE]/.test(name);
      mesh.userData = { mats, sph, n, near: n, small };
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
    const SR2 = SHADOW_RADIUS * SHADOW_RADIUS, VR = Math.min(this.viewDist ?? Infinity, 2400), VR2 = VR * VR;
    // au loin, on n'affiche qu'un arbre sur deux, puis un sur quatre (la brume masque la différence)
    const T1 = (VR * 0.38) ** 2, T2 = (VR * 0.66) ** 2, SM2 = Math.min(VR, 240) ** 2;
    const far = this._far || (this._far = new Uint32Array(4096));
    for (const mesh of this.meshes) {
      const u = mesh.userData, bs = mesh.boundingSphere, n = u.n;
      const dc = Math.hypot(bs.center.x - focus.x, bs.center.z - focus.z);
      const nearAny = dc - bs.radius < SHADOW_RADIUS;
      if (!nearAny && (dc - bs.radius > VR || !fr.intersectsSphere(bs))) { mesh.count = 0; u.near = 0; mesh.castShadow = false; continue; }
      const { sph, mats } = u, arr = mesh.instanceMatrix.array, lim2 = u.small ? SM2 : VR2;
      let k = 0, nf = 0;
      for (let i = 0; i < n; i++) {
        const x = sph[i * 4], y = sph[i * 4 + 1], z = sph[i * 4 + 2];
        const dx = x - focus.x, dz = z - focus.z, d2 = dx * dx + dz * dz;
        if (d2 < SR2) { arr.set(mats.subarray(i * 16, i * 16 + 16), k * 16); k++; continue; }
        if (d2 > lim2 || (d2 > T1 && (i & 1)) || (d2 > T2 && (i & 3))) continue;
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
