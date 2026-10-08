import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export const QUALITY = {
  low: { label: 'Basse', direct: true, treeNear: 95, treeFar: 700, lights: 3, pixelRatio: 0.8, shadows: false, shadowSize: 1024, bloom: false, grass: 9000, grassRadius: 42, trees: 0.55, far: 1400, vegView: 300, terrainNear: 140, terrainMid: 340, decorView: 420, maxPixelRatio: 1.1, particles: 280 },
  medium: { label: 'Moyenne', treeNear: 150, treeFar: 1100, lights: 5, pixelRatio: 1, shadows: true, shadowSize: 1024, bloom: true, grass: 22000, grassRadius: 56, trees: 0.8, far: 2200, vegView: 650, terrainNear: 200, terrainMid: 480, decorView: 650, maxPixelRatio: 1.25, particles: 560 },
  high: { label: 'Haute', treeNear: 210, treeFar: 1500, lights: 7, pixelRatio: 1.5, shadows: true, shadowSize: 2048, bloom: true, grass: 42000, grassRadius: 70, trees: 1, far: 3200, vegView: 950, terrainNear: 260, terrainMid: 640, decorView: 950, particles: 800 },
  ultra: { label: 'Ultra', treeNear: 280, treeFar: 2000, lights: 9, pixelRatio: 2, shadows: true, shadowSize: 4096, bloom: true, grass: 64000, grassRadius: 84, trees: 1, far: 4000, vegView: 1300, terrainNear: 340, terrainMid: 820, decorView: 1300, particles: 900 },
};

export function detectQuality() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 700;
  if (coarse || small) return 'low';
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 4;
  if (mem <= 4 || cores <= 4) return 'medium';
  return 'high';
}

// Définition minimale de l'image, quelle que soit la qualité : 1080 lignes (ou la définition
// native de l'écran, si elle est plus petite). La qualité joue sur le reste (ombres, halo,
// distance de vue, herbe…), jamais sur la netteté.
export const MIN_LINES = 1080;

// Passe finale : tonemapping + espace sRGB (ex-OutputPass, une passe plein écran de moins),
// puis étalonnage : vignette + légère saturation + grain discret.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.32 }, uSat: { value: 1.08 }, uTime: { value: 0 }, uHurt: { value: 0 }, uWarm: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uVignette; uniform float uSat; uniform float uTime; uniform float uHurt; uniform float uWarm;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      gl_FragColor = texture2D(tDiffuse, vUv);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      vec4 c = gl_FragColor;
      float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb += vec3(0.02, 0.01, -0.01) * uWarm;
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.2, length(d * vec2(1.0, 0.85)));
      c.rgb *= mix(1.0 - uVignette, 1.0, v);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.25, 0.45, 0.4), uHurt * (1.0 - v) * 0.9);
      c.rgb += (hash(vUv * 731.0 + uTime) - 0.5) * 0.012;
      // jamais de pixel invalide ni transparent à l'écran
      bool bad = isnan(c.r) || isnan(c.g) || isnan(c.b);
      gl_FragColor = vec4(bad ? vec3(0.0) : clamp(c.rgb, 0.0, 1.0), 1.0);
    }`,
};

// Garde-fou : un pixel invalide (NaN ou infini, venu d'un shader au cas limite) serait étalé
// par le halo lumineux sur tout l'écran, qui deviendrait transparent (on verrait le fond bleu
// nuit de la page). Ces pixels sont remplacés avant le halo, et l'image finale est opaque.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      bool bad = isnan(c.r) || isnan(c.g) || isnan(c.b) || isinf(c.r) || isinf(c.g) || isinf(c.b);
      gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(clamp(c.rgb, 0.0, 64.0), 1.0);
    }`,
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 3000);
    this.composer = null;
    this.qualityName = 'high';
    this.quality = QUALITY.high;
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
  }

  // plus petit rapport de pixels qui garde MIN_LINES lignes (sans dépasser l'écran natif)
  floorRatio() {
    const dpr = window.devicePixelRatio || 1, short = Math.max(1, Math.min(window.innerWidth, window.innerHeight));
    return Math.min(dpr, Math.max(1, MIN_LINES / short));
  }

  baseRatio() { return Math.max(this.floorRatio(), Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio)); }

  setQuality(name) {
    this.qualityName = name;
    this.quality = QUALITY[name] || QUALITY.medium;
    const q = this.quality;
    const dpr = window.devicePixelRatio || 1;
    const base = this.baseRatio();
    // résolution adaptative : seulement au-dessus du plancher de netteté
    this.dyn = { ratio: base, min: this.floorRatio(), max: Math.max(base, Math.min(dpr, q.maxPixelRatio ?? q.pixelRatio)), t: 0, n: 0, good: 0, cool: 3, ceiling: Infinity };
    this.renderer.setPixelRatio(base);
    this.renderer.shadowMap.enabled = q.shadows;
    this.camera.far = q.far;
    this.camera.updateProjectionMatrix();
    this.buildComposer();
    this.resize();
    this.renderer.shadowMap.needsUpdate = true;
    this.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
  }

  buildComposer() {
    if (this.composer) { this.composer.dispose?.(); this.composer = null; }
    const q = this.quality;
    // qualité basse : rendu direct à l'écran, sans image intermédiaire ni passe plein écran
    // (deux à trois fois moins de mémoire graphique traversée à chaque image : le téléphone chauffe moins)
    this.grade = null; this.bloom = null;
    if (q.direct) return;
    const w = window.innerWidth, h = window.innerHeight;
    // anticrénelage : inutile (et très coûteux) sur les écrans denses des téléphones
    const pr = this.renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: pr >= 1.5 ? 0 : this.qualityName === 'low' ? 2 : 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (q.bloom) this.composer.addPass(new ShaderPass(SanitizeShader));
    if (q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.6, 0.5, 1.02);
      this.composer.addPass(this.bloom);
    } else this.bloom = null;
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    // rotation de l'écran, fenêtre agrandie : le plancher de netteté suit
    const d = this.dyn, floor = this.floorRatio();
    if (d) {
      d.min = floor; d.max = Math.max(d.max, floor);
      if (d.ratio < floor - 0.01) { d.ratio = floor; this.renderer.setPixelRatio(floor); }
    }
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
  }

  // Appelée à chaque image avec le temps réel écoulé : ajuste la résolution interne
  // pour garder une animation fluide (baisse rapide, remontée prudente).
  adapt(rawDt, enabled = true) {
    const d = this.dyn;
    if (!d || !enabled || document.hidden || rawDt > 0.25) return;
    d.cool -= rawDt;
    d.t += rawDt; d.n++;
    if (d.t < 2) return;
    const fps = d.n / d.t;
    d.t = 0; d.n = 0;
    if (d.cool > 0) return;
    const base = this.targetFps || (this.targetFps = matchMedia('(pointer: coarse)').matches ? 42 : 50);
    const target = this.fpsCap ? Math.min(base, this.fpsCap * 0.9) : base; // plafond d'images/s choisi
    if (fps < target && d.ratio > d.min + 0.01) {
      // jamais sous le plancher de netteté (1080 lignes)
      d.ceiling = d.ratio; // ce niveau était trop lourd : on n'y remonte pas tout de suite
      d.ceilingT = 40;
      this.setRatio(Math.max(d.min, d.ratio * (fps < target * 0.7 ? 0.75 : 0.87)));
      d.good = 0;
    } else if (fps > Math.min(57, target + 8)) {
      d.good++;
      if (d.ceilingT > 0) d.ceilingT -= 2; else d.ceiling = Infinity;
      const next = Math.min(d.max, d.ratio / 0.9);
      if (d.good >= 3 && next > d.ratio + 0.01 && next < d.ceiling - 0.01) { this.setRatio(next); d.good = 0; }
    } else d.good = 0;
  }

  setRatio(r) {
    const d = this.dyn;
    d.ratio = r; d.cool = 2.5;
    this.renderer.setPixelRatio(r);
    this.resize();
  }

  render(dt, elapsed) {
    this.renderer.info.autoReset = false;
    this.renderer.info.reset();
    if (this.grade) this.grade.uniforms.uTime.value = elapsed % 10;
    if (this.composer) { this.composer.render(dt); return; }
    const r = this.renderer;
    r.render(this.scene, this.camera);
    // image opaque : certains matériaux écrivent une transparence partielle, qui laisserait voir
    // le fond de la page (l'« écran bleu ») ; on remet seulement le canal alpha à 1
    const gl = r.getContext();
    gl.colorMask(false, false, false, true);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.colorMask(true, true, true, true);
    r.state.buffers.color.reset();
  }
}
