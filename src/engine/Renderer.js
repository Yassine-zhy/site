import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export const QUALITY = {
  low: { label: 'Basse', lights: 3, pixelRatio: 0.8, shadows: false, shadowSize: 1024, bloom: false, grass: 9000, grassRadius: 42, trees: 0.55, far: 1400, vegView: 300, maxPixelRatio: 1.1, particles: 280 },
  medium: { label: 'Moyenne', lights: 5, pixelRatio: 1, shadows: true, shadowSize: 1024, bloom: true, grass: 22000, grassRadius: 56, trees: 0.8, far: 2200, maxPixelRatio: 1.25, particles: 560 },
  high: { label: 'Haute', lights: 7, pixelRatio: 1.5, shadows: true, shadowSize: 2048, bloom: true, grass: 42000, grassRadius: 70, trees: 1, far: 3200, particles: 800 },
  ultra: { label: 'Ultra', lights: 9, pixelRatio: 2, shadows: true, shadowSize: 4096, bloom: true, grass: 64000, grassRadius: 84, trees: 1, far: 4000, particles: 900 },
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

// Étalonnage final : vignette + légère saturation + grain discret.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.32 }, uSat: { value: 1.08 }, uTime: { value: 0 }, uHurt: { value: 0 }, uWarm: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uVignette; uniform float uSat; uniform float uTime; uniform float uHurt; uniform float uWarm;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb += vec3(0.02, 0.01, -0.01) * uWarm;
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.2, length(d * vec2(1.0, 0.85)));
      c.rgb *= mix(1.0 - uVignette, 1.0, v);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.25, 0.45, 0.4), uHurt * (1.0 - v) * 0.9);
      c.rgb += (hash(vUv * 731.0 + uTime) - 0.5) * 0.012;
      gl_FragColor = c;
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

  setQuality(name) {
    this.qualityName = name;
    this.quality = QUALITY[name] || QUALITY.medium;
    const q = this.quality;
    const dpr = window.devicePixelRatio || 1;
    const base = Math.min(dpr, q.pixelRatio);
    // résolution adaptative : entre min et max selon les images/s mesurées
    this.dyn = { ratio: base, min: Math.max(0.5, base * 0.62), max: Math.min(dpr, q.maxPixelRatio ?? q.pixelRatio), t: 0, n: 0, good: 0, cool: 3, ceiling: Infinity };
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
    const w = window.innerWidth, h = window.innerHeight;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: q.pixelRatio >= 1 ? 4 : 0 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.6, 0.5, 1.02);
      this.composer.addPass(this.bloom);
    } else this.bloom = null;
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.grade);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
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
    const target = this.targetFps || (this.targetFps = matchMedia('(pointer: coarse)').matches ? 42 : 50);
    if (fps < target && d.ratio > d.min + 0.01) {
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
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}
