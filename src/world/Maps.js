import * as THREE from 'three';
import { pathDistance, mainColor } from './Terrain.js';
import { VILLAGE, LAKE, RUINS, FOREST, HILLS, BEACONS, BIG_ISLANDS } from '../config.js';
import { smoothstep, clamp, Simplex } from '../engine/math.js';

export const MAP_EXTENT = 250; // carte d'herbe de l'île principale : [-250, 250]²
// La Brume couvre tout l'archipel (île principale, îlots, Cimes de Givre, Terres d'Ambre).
export const CORR = { cx: 285, cz: -285, half: 640 };

// Textures « monde » d'une région, cuites au chargement : hauteur, densité d'herbe, couleur du sol.
// L'herbe (qui ne pousse qu'autour du joueur) lit celles de la région où il se trouve.
class RegionMap {
  constructor(terrain, island, { cx, cz, half, res, density, color }) {
    this.cx = cx; this.cz = cz; this.half = half; this.res = res; this.island = island;
    const size = res * res;
    const hdata = new Uint16Array(size * 4);
    const cdata = new Uint8Array(size * 4);
    const c = new THREE.Color();
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const x = cx - half + (i + 0.5) / res * half * 2;
        const z = cz - half + (j + 0.5) / res * half * 2;
        const idx = j * res + i;
        const h = island.heightAt(x, z);
        const inside = h !== null && island.isInside(x, z) ? 1 : 0;
        const hh = h ?? -100;
        let dens = 0;
        let slope = 0;
        if (inside) {
          slope = terrain.slopeAt(x, z) / (Math.PI / 2);
          dens = clamp(density(x, z, hh, slope), 0, 1);
        }
        hdata[idx * 4] = THREE.DataUtils.toHalfFloat(hh);
        hdata[idx * 4 + 1] = THREE.DataUtils.toHalfFloat(dens);
        hdata[idx * 4 + 2] = THREE.DataUtils.toHalfFloat(0);
        hdata[idx * 4 + 3] = THREE.DataUtils.toHalfFloat(inside);
        if (inside) color(c, x, hh, z, slope, false); else c.set('#000000');
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
  }

  contains(x, z, margin = 0) { return Math.abs(x - this.cx) < this.half - margin && Math.abs(z - this.cz) < this.half - margin; }
}

// Cartes du monde : herbe par région + carte de corruption (la Brume) mise à jour selon
// l'état partagé des Phares.
export class Maps {
  constructor(terrain, res = 384) {
    this.res = res;
    const n = new Simplex(4242);
    this.noise = n;
    const mainDensity = (x, z, hh, slope) => {
      let dens = 0.85;
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
      return dens * (0.7 + 0.3 * (n.noise2(x / 9, z / 9) * 0.5 + 0.5));
    };
    this.regions = [new RegionMap(terrain, terrain.main, { cx: 0, cz: 0, half: MAP_EXTENT, res, density: mainDensity, color: (o, x, y, z, sl, e) => mainColor(o, x, y, z, sl, e) })];
    const bres = Math.round(res * 0.86);
    terrain.big.forEach((isl) => {
      const def = isl.def, snow = def.biome === 'snow';
      const density = (x, z, hh, slope) => {
        let dens = snow ? 0.42 : 0.8;
        dens *= 1 - smoothstep(0.3, 0.46, slope);
        dens *= smoothstep(2.2, 4.5, pathDistance(x, z));
        if (def.camp) dens *= smoothstep(def.camp.radius * 0.35, def.camp.radius * 0.85, Math.hypot(x - def.camp.x, z - def.camp.z));
        if (def.lake && hh < def.lake.level + 1 && Math.hypot(x - def.lake.x, z - def.lake.z) < def.lake.radius * 1.6) dens = 0;
        if (snow) dens *= 1 - smoothstep(70, 90, hh);
        return dens * (0.55 + 0.45 * (n.noise2(x / 11, z / 11) * 0.5 + 0.5));
      };
      this.regions.push(new RegionMap(terrain, isl, { cx: def.x, cz: def.z, half: def.radius + def.coastNoise + 6, res: bres, density, color: isl.colorFn }));
    });
    this.main = this.regions[0];
    this.heightTex = this.main.heightTex; this.colorTex = this.main.colorTex;

    // Corruption (0 = purifié, 1 = Brume) — basse résolution, filtrage linéaire.
    this.cres = 192;
    this.cdata = new Uint8Array(this.cres * this.cres * 4);
    this.corruptionTex = new THREE.DataTexture(this.cdata, this.cres, this.cres, THREE.RGBAFormat);
    this.corruptionTex.magFilter = THREE.LinearFilter; this.corruptionTex.minFilter = THREE.LinearFilter;
    this.corruptionValues = new Float32Array(this.cres * this.cres);
    this.safe = [{ x: VILLAGE.x, z: VILLAGE.z, r0: VILLAGE.radius + 8, r1: VILLAGE.radius + 38 }];
    for (const def of BIG_ISLANDS) if (def.camp) this.safe.push({ x: def.camp.x, z: def.camp.z, r0: def.camp.radius + 4, r1: def.camp.radius + 26 });
    this.updateCorruption(BEACONS.map(() => 0));
  }

  regionAt(x, z) {
    for (const r of this.regions) if (r.contains(x, z, 8)) return r;
    return this.main;
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
export function applyCorruption(material, maps, strength = 1, extra = '') {
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
          vec2 cuv = ${CORR_UV_GLSL.replace(/WP/g, 'vWorldPosC.xz')};
          float cor = texture2D(uCorruption, cuv).r * uCorruptStrength;
          float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 mist = mix(diffuseColor.rgb, vec3(lum), 0.6) * vec3(0.8, 0.72, 0.95);
          diffuseColor.rgb = mix(diffuseColor.rgb, mist, cor * 0.55);
        }
        ${extra}`);
  };
  material.customProgramCacheKey = () => 'corrupt' + strength + extra.length;
  material.needsUpdate = true;
}
