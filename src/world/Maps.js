import * as THREE from 'three';
import { pathDistance, mainColor } from './Terrain.js';
import { VILLAGE, LAKE, RUINS, FOREST, HILLS, BEACONS } from '../config.js';
import { smoothstep, clamp, Simplex } from '../engine/math.js';

export const MAP_EXTENT = 250; // carte couvrant [-250, 250]² (île principale)

// Textures "monde" cuites au chargement : hauteur, densité d'herbe, couleur du sol,
// + carte de corruption (la Brume) mise à jour selon l'état partagé des Phares.
export class Maps {
  constructor(terrain, res = 384) {
    this.res = res;
    const n = new Simplex(4242);
    const size = res * res;
    const hdata = new Uint16Array(size * 4);
    const cdata = new Uint8Array(size * 4);
    const c = new THREE.Color();
    this.heights = new Float32Array(size);
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const x = -MAP_EXTENT + (i + 0.5) / res * MAP_EXTENT * 2;
        const z = -MAP_EXTENT + (j + 0.5) / res * MAP_EXTENT * 2;
        const idx = j * res + i;
        const h = terrain.main.heightAt(x, z);
        const inside = h !== null && terrain.main.isInside(x, z) ? 1 : 0;
        const hh = h ?? -100;
        this.heights[idx] = hh;
        let dens = 0;
        if (inside) {
          const slope = terrain.slopeAt(x, z) / (Math.PI / 2);
          dens = 0.85;
          dens *= 1 - smoothstep(0.32, 0.48, slope);
          dens *= smoothstep(2.2, 4.5, pathDistance(x, z));
          const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
          dens *= smoothstep(14, 22, dv) * (dv < VILLAGE.radius ? 0.55 : 1);
          if (hh < LAKE.level + 1.2 && Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius * 1.7) dens = 0;
          dens *= 1 - smoothstep(52, 62, hh);
          const dr = Math.hypot(x - RUINS.x, z - RUINS.z);
          dens *= 0.45 + 0.55 * smoothstep(RUINS.radius * 0.3, RUINS.radius, dr);
          const dh = Math.hypot(x - HILLS.x, z - HILLS.z);
          if (dh < HILLS.radius) dens = Math.min(1, dens * 1.15);
          const df = Math.hypot(x - FOREST.x, z - FOREST.z);
          if (df < FOREST.radius) dens *= 0.8;
          dens *= 0.7 + 0.3 * (n.noise2(x / 9, z / 9) * 0.5 + 0.5);
          dens = clamp(dens, 0, 1);
        }
        hdata[idx * 4] = THREE.DataUtils.toHalfFloat(hh);
        hdata[idx * 4 + 1] = THREE.DataUtils.toHalfFloat(dens);
        hdata[idx * 4 + 2] = THREE.DataUtils.toHalfFloat(0);
        hdata[idx * 4 + 3] = THREE.DataUtils.toHalfFloat(inside);
        if (inside) mainColor(c, x, hh, z, terrain.slopeAt(x, z) / (Math.PI / 2), false);
        else c.set('#000000');
        c.convertLinearToSRGB();
        cdata[idx * 4] = c.r * 255; cdata[idx * 4 + 1] = c.g * 255; cdata[idx * 4 + 2] = c.b * 255; cdata[idx * 4 + 3] = 255;
      }
    }
    this.heightTex = new THREE.DataTexture(hdata, res, res, THREE.RGBAFormat, THREE.HalfFloatType);
    this.heightTex.magFilter = THREE.LinearFilter; this.heightTex.minFilter = THREE.LinearFilter;
    this.heightTex.needsUpdate = true;
    this.colorTex = new THREE.DataTexture(cdata, res, res, THREE.RGBAFormat);
    this.colorTex.colorSpace = THREE.SRGBColorSpace;
    this.colorTex.magFilter = THREE.LinearFilter; this.colorTex.minFilter = THREE.LinearFilter;
    this.colorTex.needsUpdate = true;

    // Corruption (0 = purifié, 1 = Brume) — 128² suffit, filtrage linéaire.
    this.cres = 128;
    this.cdata = new Uint8Array(this.cres * this.cres * 4);
    this.corruptionTex = new THREE.DataTexture(this.cdata, this.cres, this.cres, THREE.RGBAFormat);
    this.corruptionTex.magFilter = THREE.LinearFilter; this.corruptionTex.minFilter = THREE.LinearFilter;
    this.corruptionValues = new Float32Array(this.cres * this.cres);
    this.noise = n;
    this.updateCorruption(BEACONS.map(() => 0));
  }

  // levels : lumière de chaque phare (0..1)
  updateCorruption(levels) {
    const R = this.cres, n = this.noise;
    for (let j = 0; j < R; j++) {
      for (let i = 0; i < R; i++) {
        const x = -MAP_EXTENT + (i + 0.5) / R * MAP_EXTENT * 2;
        const z = -MAP_EXTENT + (j + 0.5) / R * MAP_EXTENT * 2;
        let pur = 0;
        const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
        pur = Math.max(pur, 1 - smoothstep(VILLAGE.radius + 8, VILLAGE.radius + 38, dv));
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
    const i = Math.floor((x + MAP_EXTENT) / (MAP_EXTENT * 2) * R), j = Math.floor((z + MAP_EXTENT) / (MAP_EXTENT * 2) * R);
    if (i < 0 || j < 0 || i >= R || j >= R) return 0.6;
    return this.corruptionValues[j * R + i];
  }
}

// Injecte la teinte de Brume dans un matériau standard (terrain, arbres...).
export function applyCorruption(material, maps, strength = 1) {
  material.onBeforeCompile = (shader) => {
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
        varying vec3 vWorldPosC; uniform sampler2D uCorruption; uniform float uCorruptStrength;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 cuv = (vWorldPosC.xz + ${MAP_EXTENT.toFixed(1)}) / ${(MAP_EXTENT * 2).toFixed(1)};
          float cor = texture2D(uCorruption, cuv).r * uCorruptStrength;
          float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 mist = vec3(lum) * vec3(0.78, 0.66, 0.98);
          diffuseColor.rgb = mix(diffuseColor.rgb, mist, cor * 0.72);
        }`);
  };
  material.customProgramCacheKey = () => 'corrupt' + strength;
  material.needsUpdate = true;
}
