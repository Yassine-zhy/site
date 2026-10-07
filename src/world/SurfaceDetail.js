import * as THREE from 'three';
import { rimPatch } from '../engine/ModelLook.js';
import { TERRAIN_HEIGHT_GLSL } from './TerrainRenderer.js';

// Détails de surface des modèles 3D (bâtiments, rochers, feuillages), dessinés dans le shader
// avec les textures de détail du terrain : grain de la pierre, fissures des rochers, mousse ou
// neige sur leurs faces supérieures, texture des feuillages, salissures au pied des murs.
// Les modèles KayKit n'ont qu'une palette de couleurs : ce relief de matière les rend vivants.

// textures partagées, renseignées par le rendu du terrain
export const SHARED = {
  uDetail: { value: null }, uNoise: { value: null }, uHeightMap: { value: null }, uTerr: { value: new THREE.Vector3() },
};

export function bindShared(shader) {
  shader.uniforms.uDetail = SHARED.uDetail; shader.uniforms.uNoise = SHARED.uNoise;
}

// normale « à facettes » et poids triplanaires depuis la position monde (marche pour tout matériau)
const TRI = (P) => `
  vec3 wnS = normalize(cross(dFdx(${P}), dFdy(${P})));
  vec3 bwS = pow(abs(wnS), vec3(4.0)); bwS /= dot(bwS, vec3(1.0));`;

// rochers : fissures en projection triplanaire, mousse (ou neige, sable…) sur le dessus
export function rockGLSL(top = null, amount = 0) {
  return `{
    ${TRI('vWorldPosC')}
    vec3 PR = vWorldPosC * 0.22;
    float rr = texture2D(uDetail, PR.zy).b * bwS.x + texture2D(uDetail, PR.xz).b * bwS.y + texture2D(uDetail, PR.xy).b * bwS.z;
    float fadeR = 1.0 - smoothstep(40.0, 170.0, length(vViewPosition));
    diffuseColor.rgb *= 1.0 + (rr - 0.5) * 0.8 * fadeR;
    ${top ? `
    float topR = smoothstep(0.42, 0.8, wnS.y) * smoothstep(0.32, 0.62, texture2D(uNoise, vWorldPosC.xz * 0.05).r + (rr - 0.5) * 0.4);
    vec3 topC = vec3(${top.r.toFixed(3)}, ${top.g.toFixed(3)}, ${top.b.toFixed(3)}) * (0.8 + 0.4 * texture2D(uDetail, PR.xz * 2.3).r);
    diffuseColor.rgb = mix(diffuseColor.rgb, topC, topR * ${amount.toFixed(2)});` : ''}
  }`;
}

// feuillages : texture de feuilles triplanaire et teinte propre à chaque arbre (vInstR)
export const FOLIAGE_GLSL = `{
  ${TRI('vWorldPosC')}
  float greenF = diffuseColor.g - max(diffuseColor.r, diffuseColor.b) * 0.92;
  float leafy = smoothstep(-0.03, 0.05, greenF);
  vec3 PF = vWorldPosC * 0.55;
  float lf = texture2D(uDetail, PF.zy).r * bwS.x + texture2D(uDetail, PF.xz).r * bwS.y + texture2D(uDetail, PF.xy).r * bwS.z;
  float bark = texture2D(uDetail, vec2(PF.x + PF.z, PF.y * 0.25)).g;
  float fadeF = 1.0 - smoothstep(30.0, 130.0, length(vViewPosition));
  diffuseColor.rgb *= 1.0 + mix((bark - 0.5) * 0.35, (lf - 0.5) * 0.7, leafy) * fadeF;
  diffuseColor.rgb *= mix(vec3(0.88, 0.95, 0.84), vec3(1.1, 1.06, 0.94), vInstR);
}`;

// bâtiments et objets posés : grain, ombre de contact et terre au pied des murs
const DECOR_GLSL = `{
  ${TRI('vWPD')}
  vec3 PD = vWPD * 0.42;
  float gr = texture2D(uDetail, PD.zy).b * bwS.x + texture2D(uDetail, PD.xz).g * bwS.y + texture2D(uDetail, PD.xy).b * bwS.z;
  float fadeD = 1.0 - smoothstep(25.0, 110.0, length(vViewPosition));
  diffuseColor.rgb *= 1.0 + (gr - 0.5) * 0.32 * fadeD;
  float above = vWPD.y - terrHeight(vWPD.xz);
  diffuseColor.rgb *= mix(0.6, 1.0, smoothstep(-0.2, 1.4, above));
  float dirt = (1.0 - smoothstep(0.0, 1.1, above)) * smoothstep(0.35, 0.7, texture2D(uNoise, vWPD.xz * 0.25 + vWPD.y * 0.1).r);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.74, 0.66, 0.55), dirt * 0.6);
}`;

const decorCache = new Map();
// Matériau des décors fusionnés : celui du modèle + détails de surface (copie partagée par source)
export function decorMaterial(src) {
  if (!src?.isMeshStandardMaterial || !SHARED.uDetail.value) return src;
  if (decorCache.has(src)) return decorCache.get(src);
  const m = src.clone();
  m.onBeforeCompile = (shader) => {
    if (src.userData.enhanced) rimPatch(shader);
    bindShared(shader);
    shader.uniforms.uHeightMap = SHARED.uHeightMap; shader.uniforms.uTerr = SHARED.uTerr;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPD;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPD = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPD; uniform sampler2D uDetail; uniform sampler2D uNoise;
        ${TERRAIN_HEIGHT_GLSL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + DECOR_GLSL);
  };
  m.customProgramCacheKey = () => 'decor-detail' + (src.userData.enhanced ? 'e' : '');
  decorCache.set(src, m);
  return m;
}
