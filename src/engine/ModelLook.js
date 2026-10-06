import * as THREE from 'three';

// Rendu « premium » des modèles 3D (héros, squelettes, armes) :
//  - cartes métal / rugosité déduites des atlas KayKit (acier bleuté et or deviennent métalliques),
//  - éclairage d'environnement (le ciel courant, préfiltré) pour les reflets et la lumière ambiante,
//  - liseré de lumière (rim light) qui détache les silhouettes, teinté par le ciel et la lune.

export const RIM = { uRimColor: { value: new THREE.Color(0, 0, 0) }, uRimPower: { value: 3.0 }, uEnvDiffuse: { value: 0.35 } };

// la lumière ambiante du ciel est déjà donnée par la lampe hémisphérique : on ne garde
// qu'une fraction du diffus d'environnement, mais tous ses reflets (métal, brillances)
const mapsChunk = THREE.ShaderChunk.lights_fragment_maps.replace(
  'iblIrradiance += getIBLIrradiance( geometryNormal );',
  'iblIrradiance += getIBLIrradiance( geometryNormal ) * uEnvDiffuse;').replace(
  // reflets du ciel surtout sur le métal : les tissus et la peau gardent leurs couleurs franches
  'radiance += iblRadiance;',
  'radiance += iblRadiance * mix(0.25, 1.0, metalnessFactor);');

// Injecté dans MeshStandardMaterial : la même fonction partout => un seul programme partagé.
export function rimPatch(shader) {
  shader.uniforms.uRimColor = RIM.uRimColor;
  shader.uniforms.uRimPower = RIM.uRimPower;
  shader.uniforms.uEnvDiffuse = RIM.uEnvDiffuse;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimPower;\nuniform float uEnvDiffuse;')
    .replace('#include <lights_fragment_maps>', mapsChunk)
    .replace('#include <opaque_fragment>', `
      float rimF = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), uRimPower);
      outgoingLight += uRimColor * rimF;
      #include <opaque_fragment>`);
}

const mapCache = new WeakMap();
const ENV = { texture: null, intensity: 1.0, materials: new Set() };

// Carte combinée glTF : vert = rugosité, bleu = métal.
function metalRoughMap(map) {
  const img = map?.image;
  if (!img || !img.width) return null;
  if (mapCache.has(img)) return mapCache.get(img);
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255, gg = px[i + 1] / 255, b = px[i + 2] / 255;
    const max = Math.max(r, gg, b), min = Math.min(r, gg, b), l = (max + min) / 2;
    const s = max === min ? 0 : (l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min));
    let hue = 0;
    if (max !== min) {
      if (max === r) hue = ((gg - b) / (max - min) + (gg < b ? 6 : 0)) * 60;
      else if (max === gg) hue = ((b - r) / (max - min) + 2) * 60;
      else hue = ((r - gg) / (max - min) + 4) * 60;
    }
    let metal = 0, rough = 0.82;
    const steel = s < 0.22 && l > 0.2 && l < 0.8 && b - r > 0.012;
    const gold = hue >= 36 && hue <= 56 && s > 0.5 && l > 0.4 && l < 0.82;
    if (steel) { metal = 0.75; rough = 0.36; }
    else if (gold) { metal = 0.85; rough = 0.32; }
    px[i] = 255; px[i + 1] = Math.round(rough * 255); px[i + 2] = Math.round(metal * 255); px[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = map.flipY;
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = map.wrapS; tex.wrapT = map.wrapT;
  mapCache.set(img, tex);
  return tex;
}

// À appeler une fois sur les matériaux sources (chargés depuis les GLB).
export function enhanceModelMaterial(m) {
  if (!m?.isMeshStandardMaterial || m.userData.enhanced) return;
  m.userData.enhanced = true;
  const mr = metalRoughMap(m.map);
  if (mr) { m.metalnessMap = mr; m.roughnessMap = mr; m.metalness = 1; m.roughness = 1; }
  m.envMap = ENV.texture;
  m.envMapIntensity = ENV.intensity;
  m.onBeforeCompile = rimPatch;
  ENV.materials.add(m);
}

export function modelEnvTexture() { return ENV.texture; }

// onBeforeCompile n'est pas recopié par clone() : on le remet sur chaque copie.
export function cloneModelMaterial(m) {
  const c = m.clone();
  if (m.userData.enhanced) c.onBeforeCompile = rimPatch;
  return c;
}

// Le ciel préfiltré est disponible : toutes les copies créées ensuite en héritent.
export function setModelEnv(texture) {
  ENV.texture = texture;
  for (const m of ENV.materials) { m.envMap = texture; m.needsUpdate = true; }
}

// Liseré : lumière du ciel le jour, clair de lune bleuté la nuit.
const _moon = new THREE.Color(0.42, 0.52, 1.0), _tmp = new THREE.Color();
export function updateRim(sky) {
  const u = sky.uniforms, night = sky.state.night;
  RIM.uRimColor.value.copy(u.uSunColor.value).lerp(u.uHorizon.value, 0.5).multiplyScalar(0.16 * (1 - night)).add(_tmp.copy(_moon).multiplyScalar(0.55 * night));
}

// Éclairage d'environnement : le ciel courant est rendu dans une petite cubemap,
// puis préfiltré (PMREM) ; la même texture est réutilisée à chaque mise à jour.
const envFrag = /* glsl */`
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround;
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uMoonDir; uniform float uNight;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.5, h), 0.6));
  col = mix(col, uGround, smoothstep(0.02, -0.3, h));
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(sd, 8.0) * 0.45 + pow(sd, 180.0) * 5.0) * (1.0 - uNight * 0.95) * step(-0.05, uSunDir.y);
  float md = max(dot(d, normalize(uMoonDir)), 0.0);
  col += vec3(0.75, 0.82, 1.0) * (pow(md, 180.0) * 3.0 + pow(md, 6.0) * 0.12) * uNight;
  gl_FragColor = vec4(col, 1.0);
}`;
const envVert = /* glsl */`varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export class EnvLight {
  constructor(renderer, sky) {
    this.renderer = renderer;
    this.sky = sky;
    this.scene = new THREE.Scene();
    const u = sky.uniforms;
    this.uniforms = { uZenith: u.uZenith, uHorizon: u.uHorizon, uSunDir: u.uSunDir, uSunColor: u.uSunColor, uMoonDir: u.uMoonDir, uNight: u.uNight, uGround: { value: new THREE.Color() } };
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: envVert, fragmentShader: envFrag, side: THREE.BackSide, depthWrite: false })));
    this.cubeRT = new THREE.WebGLCubeRenderTarget(64, { type: THREE.HalfFloatType });
    this.cubeCam = new THREE.CubeCamera(0.5, 50, this.cubeRT);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.target = null;
    this.t = 0;
  }

  get texture() { return this.target?.texture || null; }

  refresh() {
    // le sol reflété : la teinte de l'île (lumière hémisphérique), un peu assombrie
    this.uniforms.uGround.value.copy(this.sky.hemi.groundColor).multiplyScalar(0.8);
    this.cubeCam.update(this.renderer, this.scene);
    this.target = this.pmrem.fromCubemap(this.cubeRT.texture, this.target);
  }

  update(dt) {
    this.t -= dt;
    if (this.t > 0 && this.target) return false;
    this.t = 2.5;
    const first = !this.target;
    this.refresh();
    if (first) setModelEnv(this.target.texture);
    return true;
  }
}
