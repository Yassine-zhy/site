import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export const QUALITY = {
  low: { label: 'Basse', pixelRatio: 0.8, shadows: false, shadowSize: 1024, bloom: false, grass: 9000, grassRadius: 42, trees: 0.55, far: 1400 },
  medium: { label: 'Moyenne', pixelRatio: 1, shadows: true, shadowSize: 1024, bloom: true, grass: 22000, grassRadius: 56, trees: 0.8, far: 2200 },
  high: { label: 'Haute', pixelRatio: 1.5, shadows: true, shadowSize: 2048, bloom: true, grass: 42000, grassRadius: 70, trees: 1, far: 3200 },
  ultra: { label: 'Ultra', pixelRatio: 2, shadows: true, shadowSize: 4096, bloom: true, grass: 64000, grassRadius: 84, trees: 1, far: 4000 },
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
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

  render(dt, elapsed) {
    if (this.grade) this.grade.uniforms.uTime.value = elapsed % 10;
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}
