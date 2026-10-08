import * as THREE from 'three';
import { WORLD_HALF } from '../config.js';
import { RES, CRES } from './Continent.js';
import { makeDetailTexture, makeNoiseTexture } from './TerrainTextures.js';
import { CORR_UV_GLSL } from './Maps.js';
import { SHARED } from './SurfaceDetail.js';

// Rendu du continent : une seule grille instanciée, posée sur un quadtree (niveaux de détail
// continus façon CDLOD). Le relief est lu dans la carte de hauteur sur le GPU ; les sommets
// impairs glissent vers la grille deux fois plus grossière avant chaque changement de niveau,
// ce qui évite fentes et sauts. Les détails du sol (herbe, terre, roche, sable, neige) viennent
// des textures procédurales, mêlées selon les poids de matières cuits avec le relief.

const T = (WORLD_HALF * 2) / (RES - 1); // pas de la carte de hauteur

// GLSL commun (terrain, herbe) : hauteur exacte du maillage en un point du monde
export const TERRAIN_HEIGHT_GLSL = /* glsl */`
  uniform highp sampler2D uHeightMap;
  uniform vec3 uTerr; // origine, pas, résolution
  float terrTexel(ivec2 c) {
    c = clamp(c, ivec2(0), ivec2(int(uTerr.z) - 1));
    vec2 v = floor(texelFetch(uHeightMap, c, 0).rg * 255.0 + 0.5);
    float u = v.x + v.y * 256.0;
    if (u >= 32768.0) u -= 65536.0;
    return u / 50.0;
  }
  float terrHeight(vec2 p) {
    vec2 f = (p - vec2(uTerr.x)) / uTerr.y;
    vec2 fl = floor(f);
    ivec2 i = ivec2(fl);
    vec2 u = f - fl;
    float a = terrTexel(i), b = terrTexel(i + ivec2(1, 0)), c = terrTexel(i + ivec2(0, 1)), d = terrTexel(i + ivec2(1, 1));
    return (u.x + u.y <= 1.0) ? a + (b - a) * u.x + (c - a) * u.y : d + (c - d) * (1.0 - u.x) + (b - d) * (1.0 - u.y);
  }
`;

// Textures partagées du relief (hauteur exacte, normales, couleurs, matières)
export function makeTerrainTextures(terrain, quality) {
  const h = terrain.h;
  const heightTex = new THREE.DataTexture(new Uint8Array(h.buffer, h.byteOffset, h.byteLength), RES, RES, THREE.RGFormat, THREE.UnsignedByteType);
  heightTex.unpackAlignment = 2;
  heightTex.magFilter = heightTex.minFilter = THREE.NearestFilter;
  heightTex.generateMipmaps = false;
  heightTex.needsUpdate = true;
  // normales (xz encodés, y reconstruit), filtrées linéairement : éclairage net quel que soit le niveau de détail
  const step = quality === 'low' ? 2 : 1;
  const NR = (RES - 1) / step + 1;
  const nd = new Uint8Array(NR * NR * 2);
  for (let j = 0; j < NR; j++) {
    const jj = j * step, jm = Math.max(0, jj - step) * RES, jp = Math.min(RES - 1, jj + step) * RES, jr = jj * RES;
    for (let i = 0; i < NR; i++) {
      const ii = i * step, im = Math.max(0, ii - step), ip = Math.min(RES - 1, ii + step);
      const gx = (h[jr + ip] - h[jr + im]) / (50 * 2 * T * step), gz = (h[jp + ii] - h[jm + ii]) / (50 * 2 * T * step);
      const l = Math.sqrt(gx * gx + gz * gz + 1);
      const k = (j * NR + i) * 2;
      nd[k] = Math.round((-gx / l * 0.5 + 0.5) * 255); nd[k + 1] = Math.round((-gz / l * 0.5 + 0.5) * 255);
    }
  }
  const normalTex = new THREE.DataTexture(nd, NR, NR, THREE.RGFormat, THREE.UnsignedByteType);
  normalTex.unpackAlignment = 2;
  normalTex.magFilter = normalTex.minFilter = THREE.LinearFilter;
  normalTex.generateMipmaps = false;
  normalTex.needsUpdate = true;
  const colorTex = new THREE.DataTexture(terrain.color, CRES, CRES, THREE.RGBAFormat, THREE.UnsignedByteType);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.magFilter = THREE.LinearFilter; colorTex.minFilter = THREE.LinearMipmapLinearFilter; colorTex.generateMipmaps = true;
  colorTex.needsUpdate = true;
  const matTex = new THREE.DataTexture(terrain.mats, CRES, CRES, THREE.RGBAFormat, THREE.UnsignedByteType);
  matTex.magFilter = THREE.LinearFilter; matTex.minFilter = THREE.LinearMipmapLinearFilter; matTex.generateMipmaps = true;
  matTex.needsUpdate = true;
  return { heightTex, normalTex, colorTex, matTex, noiseTex: makeNoiseTexture(), uTerr: new THREE.Vector3(-WORLD_HALF, T, RES) };
}

function gridGeometry(n, max) {
  const g = new THREE.InstancedBufferGeometry();
  const pos = new Float32Array((n + 1) * (n + 1) * 3);
  for (let j = 0, k = 0; j <= n; j++) for (let i = 0; i <= n; i++, k += 3) { pos[k] = i; pos[k + 1] = 0; pos[k + 2] = j; }
  const idx = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
    idx.push(a, c, b, c, d, b); // diagonale b-c : mêmes triangles que la requête de hauteur
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  const node = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
  node.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aNode', node);
  g.instanceCount = 0;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return g;
}

export class TerrainRenderer {
  constructor(scene, terrain, textures, maps, { quality = 'high', detail = 1 } = {}) {
    this.terrain = terrain;
    this.tex = textures;
    // grille de chaque nœud : 16×16 quads (8×8 en qualité basse) ; une feuille = un texel par quad
    const G = quality === 'low' ? 8 : 16;
    this.G = G;
    this.levels = Math.round(Math.log2((RES - 1) / G)) + 1;
    const leaf = G * T;
    // portée de chaque niveau (≥ 3 × la taille du nœud : jamais deux niveaux d'écart entre voisins)
    this.ranges = [];
    for (let l = 0; l < this.levels; l++) this.ranges.push(leaf * 3.1 * detail * Math.pow(2, l));
    this.morph = [];
    for (let l = 0; l < 10; l++) {
      const r = this.ranges[Math.min(l, this.levels - 1)], prev = l ? this.ranges[l - 1] : 0;
      this.morph.push(new THREE.Vector2(prev + (r - prev) * 0.62, r * 0.97));
    }
    this.buildMinMax();

    const MAX = 1200;
    this.full = gridGeometry(G, MAX);
    this.half = gridGeometry(G / 2, MAX);
    this.uniforms = {
      uHeightMap: { value: textures.heightTex }, uNormalMap: { value: textures.normalTex }, uColorMap: { value: textures.colorTex },
      uMatMap: { value: textures.matTex }, uDetail: { value: makeDetailTexture(512) }, uNoise: { value: textures.noiseTex },
      uTerr: { value: textures.uTerr }, uTerrHalf: { value: WORLD_HALF }, uCamPos: { value: new THREE.Vector3() },
      uMorph: { value: this.morph }, uCorruption: { value: maps.corruptionTex },
    };
    SHARED.uDetail.value = this.uniforms.uDetail.value; SHARED.uNoise.value = textures.noiseTex;
    SHARED.uHeightMap.value = textures.heightTex; SHARED.uTerr.value = textures.uTerr;
    this.mats = [G, G / 2].map((n) => this.makeMaterial(n, quality));
    this.meshes = [this.full, this.half].map((g, k) => {
      const m = new THREE.Mesh(g, this.mats[k]);
      m.frustumCulled = false; m.receiveShadow = true; m.castShadow = false;
      m.matrixAutoUpdate = false;
      scene.add(m);
      return m;
    });
    this.frustum = new THREE.Frustum();
    this.box = new THREE.Box3();
    this.pm = new THREE.Matrix4();
  }

  // hauteurs mini/maxi de chaque nœud du quadtree (pour l'intersection avec les portées)
  buildMinMax() {
    const h = this.terrain.h, G = this.G;
    this.mm = [];
    let n = (RES - 1) / G;
    const leafMM = new Float32Array(n * n * 2);
    for (let nj = 0; nj < n; nj++) for (let ni = 0; ni < n; ni++) {
      let lo = 1e9, hi = -1e9;
      for (let j = nj * G; j <= nj * G + G; j++) for (let i = ni * G; i <= ni * G + G; i++) {
        const v = h[j * RES + i];
        if (v < lo) lo = v; if (v > hi) hi = v;
      }
      leafMM[(nj * n + ni) * 2] = lo / 50; leafMM[(nj * n + ni) * 2 + 1] = hi / 50;
    }
    this.mm.push(leafMM);
    while (n > 1) {
      const p = this.mm[this.mm.length - 1], m = n / 2, out = new Float32Array(m * m * 2);
      for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
        let lo = 1e9, hi = -1e9;
        for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const k = ((j * 2 + dj) * n + i * 2 + di) * 2;
          lo = Math.min(lo, p[k]); hi = Math.max(hi, p[k + 1]);
        }
        out[(j * m + i) * 2] = lo; out[(j * m + i) * 2 + 1] = hi;
      }
      this.mm.push(out); n = m;
    }
  }

  makeMaterial(n, quality) {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.94, metalness: 0 });
    const u = this.uniforms, hi = quality !== 'low';
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 aNode;
          uniform vec3 uCamPos; uniform vec2 uMorph[10];
          varying vec3 vTerrWorld;
          ${TERRAIN_HEIGHT_GLSL}`)
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
        .replace('#include <begin_vertex>', `
          vec2 gp = position.xz;
          vec2 wp0 = aNode.xy + gp / ${n.toFixed(1)} * aNode.z;
          float dist = distance(uCamPos, vec3(wp0.x, terrHeight(wp0), wp0.y));
          vec2 mr = uMorph[int(aNode.w + 0.5)];
          float mk = clamp((dist - mr.x) / (mr.y - mr.x), 0.0, 1.0);
          gp -= fract(gp * 0.5) * 2.0 * mk;
          vec2 wp = aNode.xy + gp / ${n.toFixed(1)} * aNode.z;
          vec3 transformed = vec3(wp.x, terrHeight(wp), wp.y);
          vTerrWorld = transformed;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D uNormalMap; uniform sampler2D uColorMap; uniform sampler2D uMatMap; uniform sampler2D uDetail; uniform sampler2D uCorruption; uniform sampler2D uNoise;
          uniform float uTerrHalf;
          varying vec3 vTerrWorld;
          // (normalize d'un vecteur nul = NaN : un seul pixel NaN, étalé par le halo, effacerait l'écran)
          vec3 safeNorm(vec3 v, vec3 fb) { float l = length(v); return l > 1e-10 ? v / l : fb; }
          vec3 perturbTerr(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy) {
            vec3 dx = dFdx(surf_pos), dy = dFdy(surf_pos);
            if (dot(dx, dx) < 1e-14 || dot(dy, dy) < 1e-14) return surf_norm;
            vec3 vSigmaX = normalize(dx), vSigmaY = normalize(dy);
            vec3 R1 = cross(vSigmaY, surf_norm), R2 = cross(surf_norm, vSigmaX);
            float fDet = dot(vSigmaX, R1);
            vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
            return safeNorm(abs(fDet) * surf_norm - vGrad, surf_norm);
          }`)
        .replace('#include <color_fragment>', `
          vec2 tuv = (vTerrWorld.xz + uTerrHalf) / (2.0 * uTerrHalf);
          vec2 tnr = texture2D(uNormalMap, tuv).rg * 2.0 - 1.0;
          vec3 wN = vec3(tnr.x, sqrt(max(0.05, 1.0 - dot(tnr, tnr))), tnr.y);
          vec3 macro = texture2D(uColorMap, tuv).rgb;
          vec4 mw = texture2D(uMatMap, tuv);
          // détail : deux échelles pour casser la répétition
          vec2 duv = vTerrWorld.xz * 0.15;
          vec4 d1 = texture2D(uDetail, duv), d2 = texture2D(uDetail, duv * 0.29 + vec2(0.37, 0.71));
          vec4 dd = mix(d1, d2, 0.3);
          // de près, une troisième échelle plus fine : un sol net, même en 1080p et plus
          float camD = length(vViewPosition);
          if (camD < 40.0) {
            vec4 d3 = texture2D(uDetail, duv * 3.7 + vec2(0.13, 0.57));
            dd = mix(dd, mix(dd, d3, 0.45), 1.0 - smoothstep(12.0, 40.0, camD));
          }
          // roche en projection triplanaire sur les pentes
          float rk = dd.b;
          ${hi ? `{
            vec3 bw = abs(wN); bw = pow(bw, vec3(4.0)); bw /= max(bw.x + bw.y + bw.z, 1e-5);
            float rx = texture2D(uDetail, vTerrWorld.zy * 0.12).b, rz = texture2D(uDetail, vTerrWorld.xy * 0.12).b;
            rk = rx * bw.x + dd.b * bw.y + rz * bw.z;
          }` : ''}
          float wd = max(0.0, 1.0 - mw.r - mw.g - mw.b - mw.a);
          // mélange par hauteur : la roche et les cailloux percent l'herbe, l'herbe envahit la terre
          vec4 wv = vec4(mw.r, wd, mw.g, mw.b);
          vec4 hv = vec4(dd.r, dd.g, rk, dd.a);
          vec4 bl = max(wv + (hv - 0.5) * 0.55 * step(0.02, wv), 0.0) * step(0.02, wv);
          float wn = mw.a;
          float bs = bl.x + bl.y + bl.z + bl.w + wn + 1e-4;
          float snowD = 0.5 + (dd.a - 0.5) * 0.35;
          float det = (dot(bl, hv) + wn * snowD) / bs;
          float fade = 1.0 - smoothstep(70.0, 260.0, camD) * 0.65;
          // teintes propres aux matières : brins d'herbe plus jaunes, joints de roche plus froids
          vec3 tint = vec3(1.0);
          tint = mix(tint, mix(vec3(0.82, 0.9, 0.78), vec3(1.12, 1.1, 0.92), dd.r), bl.x / bs);
          tint = mix(tint, mix(vec3(0.86, 0.88, 0.95), vec3(1.08, 1.04, 1.0), rk), bl.z / bs);
          diffuseColor.rgb = macro * mix(vec3(1.0), tint * (1.0 + (det - 0.5) * 0.95), fade);
          // variations lentes : prairies plus jaunes ou plus vertes, plaques plus sombres
          vec4 nz = texture2D(uNoise, vTerrWorld.xz * 0.0045);
          vec4 nz2 = texture2D(uNoise, vTerrWorld.xz * 0.019 + vec2(0.31, 0.77));
          diffuseColor.rgb *= 0.88 + nz.r * 0.18 + (nz2.g - 0.5) * 0.1;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.04, 0.74), smoothstep(0.45, 0.85, nz.b) * 0.55 * bl.x / bs);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.84, 1.0, 0.86), smoothstep(0.5, 0.9, nz2.a) * 0.4 * bl.x / bs);
          // sable mouillé au ras de l'eau
          float wet = (1.0 - smoothstep(0.12, 1.0, vTerrWorld.y)) * step(-0.6, vTerrWorld.y);
          diffuseColor.rgb *= 1.0 - wet * 0.3;
          // neige qui scintille quand on se déplace
          float spk = step(0.972, fract(sin(dot(floor(vTerrWorld.xz * 7.0) + floor(cameraPosition.xz * 0.5), vec2(12.9898, 78.233))) * 43758.5453));
          diffuseColor.rgb += spk * (wn / bs) * 0.55 * (1.0 - smoothstep(10.0, 45.0, camD));
          {
            vec2 cuv = ${CORR_UV_GLSL.replace(/WP/g, 'vTerrWorld.xz')};
            float cor = texture2D(uCorruption, cuv).r;
            float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
            vec3 mist = mix(diffuseColor.rgb, vec3(lum), 0.6) * vec3(0.8, 0.72, 0.95);
            diffuseColor.rgb = mix(diffuseColor.rgb, mist, cor * 0.55);
          }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.62, wn / bs * 0.8);
          roughnessFactor = mix(roughnessFactor, 0.38, wet);`)
        .replace('#include <normal_fragment_begin>', `
          float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
          vec3 normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
          normal = perturbTerr(-vViewPosition, normal, vec2(dFdx(det), dFdy(det)) * 0.9 * fade); // relief du détail (toutes qualités)
          vec3 nonPerturbedNormal = normal;`);
    };
    mat.customProgramCacheKey = () => 'terrain' + n + hi;
    return mat;
  }

  // nœuds à dessiner pour la caméra courante
  update(camera) {
    camera.updateMatrixWorld();
    const cp = camera.position;
    this.uniforms.uCamPos.value.copy(cp);
    this.pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.pm);
    const full = this.full.attributes.aNode, half = this.half.attributes.aNode;
    this.nf = 0; this.nh = 0;
    const top = this.levels - 1;
    this.select(top, 0, 0, cp);
    this.full.instanceCount = this.nf; this.half.instanceCount = this.nh;
    for (const [a, n] of [[full, this.nf], [half, this.nh]]) { a.clearUpdateRanges(); a.addUpdateRange(0, n * 4); a.needsUpdate = true; }
  }

  nodeBox(l, i, j) {
    const n = ((RES - 1) / this.G) >> l, S = (RES - 1) / n * T, mm = this.mm[l], k = (j * n + i) * 2;
    const x0 = -WORLD_HALF + i * S, z0 = -WORLD_HALF + j * S;
    this.box.min.set(x0, mm[k], z0); this.box.max.set(x0 + S, mm[k + 1], z0 + S);
    return S;
  }

  push(geo, x, z, s, l) {
    const a = geo === 0 ? this.full.attributes.aNode.array : this.half.attributes.aNode.array;
    const k = (geo === 0 ? this.nf++ : this.nh++) * 4;
    if (k >= a.length) { if (geo === 0) this.nf--; else this.nh--; return; }
    a[k] = x; a[k + 1] = z; a[k + 2] = s; a[k + 3] = l;
  }

  // sélection CDLOD : renvoie false si le nœud est hors de sa portée (le parent le dessine alors)
  select(l, i, j, cp) {
    const S = this.nodeBox(l, i, j);
    if (this.box.distanceToPoint(cp) > this.ranges[l]) return false;
    if (this.box.max.y < -13 || !this.frustum.intersectsBox(this.box)) return true; // fond marin caché par l'océan, ou hors champ
    const x0 = this.box.min.x, z0 = this.box.min.z;
    if (l === 0) { this.push(0, x0, z0, S, 0); return true; }
    if (this.box.distanceToPoint(cp) > this.ranges[l - 1]) { this.push(0, x0, z0, S, l); return true; }
    for (let c = 0; c < 4; c++) {
      const ci = i * 2 + (c & 1), cj = j * 2 + (c >> 1);
      if (!this.select(l - 1, ci, cj, cp)) {
        // quart du nœud, dessiné au niveau courant (grille deux fois moins fine)
        const cs = this.nodeBox(l - 1, ci, cj);
        if (this.box.max.y >= -13 && this.frustum.intersectsBox(this.box)) this.push(1, this.box.min.x, this.box.min.z, cs, l);
      }
    }
    return true;
  }
}
