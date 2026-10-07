import * as THREE from 'three';
import { VILLAGE, HAMLET, BEACONS, REGIONS, WORLD_BOUNDS } from '../config.js';
import { smoothstep, clamp, Simplex } from '../engine/math.js';
import { bindShared } from './SurfaceDetail.js';

// La Brume couvre tout le continent.
export const CORR = { cx: WORLD_BOUNDS.cx, cz: WORLD_BOUNDS.cz, half: WORLD_BOUNDS.half };

// Carte de corruption (la Brume), mise à jour selon l'état partagé des Phares.
export class Maps {
  constructor() {
    this.noise = new Simplex(4242);
    // Corruption (0 = purifié, 1 = Brume) — basse résolution, filtrage linéaire.
    this.cres = 256;
    this.cdata = new Uint8Array(this.cres * this.cres * 4);
    this.corruptionTex = new THREE.DataTexture(this.cdata, this.cres, this.cres, THREE.RGBAFormat);
    this.corruptionTex.magFilter = THREE.LinearFilter; this.corruptionTex.minFilter = THREE.LinearFilter;
    this.corruptionValues = new Float32Array(this.cres * this.cres);
    this.safe = [{ x: VILLAGE.x, z: VILLAGE.z, r0: VILLAGE.radius + 8, r1: VILLAGE.radius + 38 }, { x: HAMLET.x, z: HAMLET.z, r0: HAMLET.radius + 6, r1: HAMLET.radius + 30 }];
    for (const def of REGIONS) if (def.camp) this.safe.push({ x: def.camp.x, z: def.camp.z, r0: def.camp.radius + 4, r1: def.camp.radius + 26 });
    this.updateCorruption(BEACONS.map(() => 0));
  }

  // levels : lumière de chaque phare (0..1)
  updateCorruption(levels) {
    const R = this.cres, n = this.noise;
    for (let j = 0; j < R; j++) {
      for (let i = 0; i < R; i++) {
        const x = CORR.cx - CORR.half + (i + 0.5) / R * CORR.half * 2;
        const z = CORR.cz - CORR.half + (j + 0.5) / R * CORR.half * 2;
        let pur = 0;
        for (const s of this.safe) pur = Math.max(pur, 1 - smoothstep(s.r0, s.r1, Math.hypot(x - s.x, z - s.z)));
        BEACONS.forEach((b, bi) => {
          const lv = levels[bi] || 0;
          if (lv <= 0) return;
          const d = Math.hypot(x - b.x, z - b.z);
          const r = b.radius * (0.35 + 0.65 * lv);
          pur = Math.max(pur, (1 - smoothstep(r * 0.55, r, d)) * Math.min(1, 0.4 + lv));
        });
        let cor = clamp(1 - pur, 0, 1);
        cor *= 0.75 + 0.25 * (n.noise2(x / 30, z / 30) * 0.5 + 0.5);
        const idx = j * R + i;
        this.corruptionValues[idx] = cor;
        this.cdata[idx * 4] = cor * 255; this.cdata[idx * 4 + 1] = 0; this.cdata[idx * 4 + 2] = 0; this.cdata[idx * 4 + 3] = 255;
      }
    }
    this.corruptionTex.needsUpdate = true;
  }

  corruptionAt(x, z) {
    const R = this.cres;
    const i = Math.floor((x - CORR.cx + CORR.half) / (CORR.half * 2) * R), j = Math.floor((z - CORR.cz + CORR.half) / (CORR.half * 2) * R);
    if (i < 0 || j < 0 || i >= R || j >= R) return 0.6;
    return this.corruptionValues[j * R + i];
  }
}

// coordonnées de texture de la Brume (GLSL) à partir d'une position monde xz
export const CORR_UV_GLSL = `((WP - vec2(${CORR.cx.toFixed(1)}, ${CORR.cz.toFixed(1)}) + ${CORR.half.toFixed(1)}) / ${(CORR.half * 2).toFixed(1)})`;

// Injecte la teinte de Brume dans un matériau standard (terrain, arbres...).
export function applyCorruption(material, maps, strength = 1, extra = '', before = '') {
  material.onBeforeCompile = (shader) => {
    bindShared(shader);
    shader.uniforms.uCorruption = { value: maps.corruptionTex };
    shader.uniforms.uCorruptStrength = { value: strength };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPosC;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 wpc = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wpc = instanceMatrix * wpc;
        #endif
        vWorldPosC = (modelMatrix * wpc).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWorldPosC; uniform sampler2D uCorruption; uniform float uCorruptStrength; uniform sampler2D uDetail; uniform sampler2D uNoise;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${before}
        {
          vec2 cuv = ${CORR_UV_GLSL.replace(/WP/g, 'vWorldPosC.xz')};
          float cor = texture2D(uCorruption, cuv).r * uCorruptStrength;
          float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 mist = mix(diffuseColor.rgb, vec3(lum), 0.6) * vec3(0.8, 0.72, 0.95);
          diffuseColor.rgb = mix(diffuseColor.rgb, mist, cor * 0.55);
        }
        ${extra}`);
  };
  material.customProgramCacheKey = () => 'corrupt' + strength + extra.length + '-' + before.length;
  material.needsUpdate = true;
}
