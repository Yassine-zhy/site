import * as THREE from 'three';
import { mulberry32, smoothstep } from '../engine/math.js';
import { pathDistance } from './Terrain.js';
import { VILLAGE, LAKE, FOREST, MOUNTAIN, RUINS, HILLS, BEACONS, ISLETS, UPDRAFTS } from '../config.js';
import { applyCorruption } from './Maps.js';

// Arbres et rochers instanciés (modèles KayKit), avec balancement au vent.
export class Vegetation {
  constructor(scene, assets, terrain, colliders, maps, density = 1) {
    this.scene = scene; this.assets = assets; this.terrain = terrain; this.colliders = colliders;
    this.meshes = [];
    const rng = mulberry32(2024);
    const buckets = new Map();
    const add = (name, x, z, scale, rotY, opts = {}) => {
      const y = opts.y ?? terrain.heightAt(x, z);
      if (y === null) return false;
      if (!buckets.has(name)) buckets.set(name, []);
      buckets.get(name).push({ x, y: y - (opts.sink ?? 0.15), z, s: scale, r: rotY, sy: opts.sy ?? 1 });
      if (opts.collide) colliders.addCircle(x, z, opts.collide, y - 1, y + scale * 1.4, 'tree');
      return true;
    };
    const blocked = (x, z) => {
      const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
      if (dv < VILLAGE.radius + 6) return true;
      if (pathDistance(x, z) < 4.5) return true;
      if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius * 1.35) return true;
      for (const b of BEACONS) if (Math.hypot(x - b.x, z - b.z) < 12) return true;
      for (const u of UPDRAFTS) if (Math.hypot(x - u.x, z - u.z) < u.radius + 4) return true;
      if (Math.hypot(x - RUINS.x, z - RUINS.z) < RUINS.radius * 0.75) return true;
      if (Math.hypot(x - MOUNTAIN.x, z - (MOUNTAIN.z + 4)) < MOUNTAIN.summitRadius + 6) return true;
      return false;
    };
    const singles = ['tree_single_A', 'tree_single_B'];
    const clusters = ['trees_A_large', 'trees_A_medium', 'trees_B_large', 'trees_B_medium', 'trees_A_small', 'trees_B_small'];
    // Bois-Murmure : forêt dense
    const nForest = Math.round(340 * density);
    for (let i = 0, tries = 0; i < nForest && tries < nForest * 6; tries++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * FOREST.radius * 1.05;
      const x = FOREST.x + Math.cos(a) * r, z = FOREST.z + Math.sin(a) * r;
      if (blocked(x, z) || !terrain.main.isInside(x, z)) continue;
      if (terrain.slopeAt(x, z) > 0.75) continue;
      const cl = rng() < 0.3;
      const s = cl ? 6 + rng() * 2.5 : 6.5 + rng() * 3.5;
      if (add(cl ? rng.pick(clusters) : rng.pick(singles), x, z, s, rng() * Math.PI * 2, { collide: cl ? s * 0.32 : s * 0.09 })) i++;
    }
    // arbres épars sur toute l'île
    const nSparse = Math.round(260 * density);
    for (let i = 0, tries = 0; i < nSparse && tries < nSparse * 8; tries++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 205;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (blocked(x, z) || !terrain.main.isInside(x, z)) continue;
      const h = terrain.heightAt(x, z);
      if (h === null || h > 62 || terrain.slopeAt(x, z) > 0.7) continue;
      const near = Math.hypot(x - HILLS.x, z - HILLS.z) < HILLS.radius ? 0.5 : 1;
      if (rng() > near) continue;
      const cl = rng() < 0.18;
      const s = cl ? 5.5 + rng() * 2 : 6 + rng() * 3.5;
      if (add(cl ? rng.pick(clusters) : rng.pick(singles), x, z, s, rng() * Math.PI * 2, { collide: cl ? s * 0.3 : s * 0.09 })) i++;
    }
    // îlots
    for (const def of ISLETS) {
      const n = Math.round(def.radius * 0.45 * density);
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * def.radius * 0.8;
        const x = def.x + Math.cos(a) * r, z = def.z + Math.sin(a) * r;
        if (BEACONS.some((b) => Math.hypot(x - b.x, z - b.z) < 10)) continue;
        if (Math.hypot(x - def.x, z - def.z) < 6) continue;
        add(rng.pick(singles), x, z, 5.5 + rng() * 3, rng() * Math.PI * 2, { collide: 0.6 });
      }
    }
    // rochers
    const rocks = ['rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E'];
    const nRocks = Math.round(320 * density);
    for (let i = 0, tries = 0; i < nRocks && tries < nRocks * 5; tries++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 212;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.radius - 4) continue;
      if (pathDistance(x, z) < 3) continue;
      const mt = Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z) < MOUNTAIN.radius;
      const big = rng() < (mt ? 0.45 : 0.15);
      const s = big ? 14 + rng() * 16 : 6 + rng() * 8;
      add(rng.pick(rocks), x, z, s, rng() * Math.PI * 2, { collide: big ? s * 0.15 : 0, sink: s * 0.03, sy: 0.8 + rng() * 0.8 });
      i++;
    }
    // plantes du lac
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2, r = LAKE.radius * (0.35 + rng() * 0.75);
      const x = LAKE.x + Math.cos(a) * r, z = LAKE.z + Math.sin(a) * r;
      const h = terrain.heightAt(x, z);
      if (h === null) continue;
      if (h < LAKE.level - 0.6) add(rng.pick(['waterlily_A', 'waterlily_B']), x, z, 7 + rng() * 4, rng() * 6.28, { y: LAKE.level + 0.02, sink: 0 });
      else add(rng.pick(['waterplant_A', 'waterplant_B', 'waterplant_C']), x, z, 8 + rng() * 5, rng() * 6.28);
    }

    // matériaux : arbres (vent) / statiques
    const baseMat = assets.propGeometry('tree_single_A').material;
    this.treeMat = baseMat.clone();
    this.treeUniforms = { uTime: { value: 0 }, uWind: { value: 1 }, uPlayerPos: { value: new THREE.Vector3(0, -999, 0) } };
    const tu = this.treeUniforms;
    const maps2 = maps;
    this.treeMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = tu.uTime; shader.uniforms.uWind = tu.uWind; shader.uniforms.uPlayerPos = tu.uPlayerPos;
      shader.uniforms.uCorruption = { value: maps2.corruptionTex };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind; varying vec3 vWorldPosC;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
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
          varying vec3 vWorldPosC; uniform sampler2D uCorruption; uniform vec3 uPlayerPos;
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
            fade = max(fade, 1.0 - smoothstep(1.5, 4.0, length(cf)));
            if (fade * 0.85 > bayer4(gl_FragCoord.xy)) discard;
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            vec2 cuv = (vWorldPosC.xz + 250.0) / 500.0;
            float cor = texture2D(uCorruption, cuv).r;
            float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(0.72, 0.6, 0.95), cor * 0.65);
          }`);
    };
    this.treeMat.customProgramCacheKey = () => 'treewind';
    this.staticMat = baseMat.clone();
    applyCorruption(this.staticMat, maps, 0.8);

    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const [name, list] of buckets) {
      const g = assets.propGeometry(name);
      if (!g) continue;
      const isTree = /tree/.test(name);
      const mesh = new THREE.InstancedMesh(g.geometry, isTree ? this.treeMat : this.staticMat, list.length);
      list.forEach((it, i) => {
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, it.r);
        v.set(it.x, it.y, it.z); sc.set(it.s, it.s * it.sy, it.s);
        m.compose(v, q, sc);
        mesh.setMatrixAt(i, m);
      });
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      scene.add(mesh);
      this.meshes.push(mesh);
    }
    this.treePositions = [];
    for (const [name, list] of buckets) if (/tree/.test(name)) for (const it of list) this.treePositions.push(it);
  }

  update(dt, elapsed, focus) {
    this.treeUniforms.uTime.value = elapsed;
    if (focus) this.treeUniforms.uPlayerPos.value.copy(focus);
  }
}

export { smoothstep };
