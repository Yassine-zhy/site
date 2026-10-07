import * as THREE from 'three';
import { GIVRE, AMBRE, HANTEE, SYLVE } from '../config.js';

// Particules d'ambiance autour de la caméra, animées entièrement par le GPU :
// lucioles la nuit, pollen le jour, neige aux Cimes, poussière dorée en Ambre,
// braises violettes dans la Citadelle, âmes errantes des Landes, spores de la Canopée. Les positions bouclent dans une boîte qui suit la caméra.
const MODES = {
  pollen: { color: '#fff3c4', size: 0.09, box: [44, 14, 44], fall: -0.05, sway: 0.6, flicker: 0.2, alpha: 0.55, additive: true, share: 0.45 },
  fireflies: { color: '#d8ff7a', size: 0.16, box: [46, 9, 46], fall: 0, sway: 1.2, flicker: 1, alpha: 0.95, additive: true, share: 0.7 },
  snow: { color: '#ffffff', size: 0.12, box: [40, 22, 40], fall: 1.4, sway: 0.7, flicker: 0, alpha: 0.85, additive: false, share: 1 },
  dust: { color: '#ffc27a', size: 0.08, box: [48, 12, 48], fall: -0.02, sway: 1.6, flicker: 0.3, alpha: 0.5, additive: true, share: 0.6, wind: 1.2 },
  embers: { color: '#c78bff', size: 0.13, box: [40, 18, 40], fall: -0.9, sway: 0.8, flicker: 0.7, alpha: 0.9, additive: true, share: 0.8 },
  // âmes errantes des Landes : lueurs pâles qui montent lentement
  souls: { color: '#bfaaff', size: 0.17, box: [46, 16, 46], fall: -0.45, sway: 1.4, flicker: 0.9, alpha: 0.8, additive: true, share: 0.55 },
  // spores et pollen de la Canopée, le jour
  spores: { color: '#d6ffa8', size: 0.11, box: [42, 14, 42], fall: 0.12, sway: 1.0, flicker: 0.4, alpha: 0.7, additive: true, share: 0.75 },
};

const VERT = `
  attribute vec4 seed;
  uniform float uTime, uSize, uFall, uSway, uFlicker, uWind, uShare, uScale;
  uniform vec3 uCam, uBox;
  varying float vA;
  void main() {
    vec3 p = seed.xyz;
    float t = uTime * (0.6 + seed.w * 0.8);
    vec3 drift = vec3(uWind * 0.05 * t, -uFall * t / uBox.y, 0.0);
    vec3 cell = fract(p + drift - uCam / uBox);
    vec3 wp = uCam + (cell - 0.5) * uBox;
    wp.x += sin(t * 0.9 + seed.w * 31.0) * uSway;
    wp.z += cos(t * 0.7 + seed.w * 17.0) * uSway;
    wp.y += sin(t * 1.3 + seed.w * 9.0) * uSway * 0.4;
    vec4 mv = viewMatrix * vec4(wp, 1.0);
    gl_Position = projectionMatrix * mv;
    // fondu aux bords de la boîte et près de la caméra
    vec3 e = abs(cell - 0.5) * 2.0;
    float edge = 1.0 - smoothstep(0.7, 1.0, max(e.x, max(e.y, e.z)));
    float near = smoothstep(0.6, 2.5, -mv.z);
    float flick = mix(1.0, 0.5 + 0.5 * sin(uTime * (2.0 + seed.w * 3.0) + seed.w * 40.0), uFlicker);
    vA = edge * near * flick * step(seed.w, uShare);
    gl_PointSize = uSize * uScale / -mv.z;
  }`;

const FRAG = `
  uniform vec3 uColor; uniform float uAlpha;
  varying float vA;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    float a = smoothstep(0.5, 0.0, r);
    a *= a;
    if (vA * a < 0.01) discard;
    gl_FragColor = vec4(uColor * (1.0 + a), vA * a * uAlpha);
  }`;

export class Ambient {
  constructor(scene, count = 700) {
    const geo = new THREE.BufferGeometry();
    this.build(geo, count);
    this.uniforms = {
      uTime: { value: 0 }, uSize: { value: 0.1 }, uFall: { value: 0 }, uSway: { value: 0.5 }, uFlicker: { value: 0 }, uWind: { value: 0 },
      uShare: { value: 0 }, uScale: { value: 600 }, uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(40, 12, 40) },
      uColor: { value: new THREE.Color('#ffffff') }, uAlpha: { value: 0 },
    };
    this.matAdd = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.matNorm = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, toneMapped: false });
    this.points = new THREE.Points(geo, this.matAdd);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.mode = null; this.fade = 0;
  }

  build(geo, count) {
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count * 4; i++) seed[i] = Math.random();
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setDrawRange(0, count);
  }

  setCount(n) { this.points.geometry.setDrawRange(0, Math.min(n, this.points.geometry.attributes.seed.count)); }

  pick(pos, night) {
    if (pos.x > 3500) return 'embers';
    if (Math.hypot(pos.x - GIVRE.x, pos.z - GIVRE.z) < GIVRE.radius * 1.25) return 'snow';
    if (Math.hypot(pos.x - AMBRE.x, pos.z - AMBRE.z) < AMBRE.radius * 1.25) return night ? 'fireflies' : 'dust';
    if (Math.hypot(pos.x - HANTEE.x, pos.z - HANTEE.z) < HANTEE.radius * 1.25) return 'souls';
    if (Math.hypot(pos.x - SYLVE.x, pos.z - SYLVE.z) < SYLVE.radius * 1.25) return night ? 'fireflies' : 'spores';
    return night ? 'fireflies' : 'pollen';
  }

  update(dt, elapsed, camera, focus, night, viewportH) {
    const u = this.uniforms;
    u.uTime.value = elapsed;
    u.uCam.value.copy(camera.position);
    u.uScale.value = viewportH / (2 * Math.tan((camera.fov * Math.PI) / 360));
    const want = focus ? this.pick(focus, night > 0.5) : 'pollen';
    // fondu enchaîné entre deux ambiances
    if (want !== this.mode) {
      this.fade = Math.max(0, this.fade - dt * 1.5);
      if (this.fade <= 0 || !this.mode) this.apply(want);
    } else this.fade = Math.min(1, this.fade + dt * 0.8);
    const m = MODES[this.mode];
    u.uAlpha.value = m.alpha * this.fade;
    this.points.visible = this.fade > 0.01;
  }

  apply(mode) {
    this.mode = mode;
    const m = MODES[mode], u = this.uniforms;
    u.uSize.value = m.size; u.uFall.value = m.fall; u.uSway.value = m.sway; u.uFlicker.value = m.flicker; u.uWind.value = m.wind || 0;
    u.uShare.value = m.share; u.uBox.value.set(...m.box); u.uColor.value.set(m.color);
    this.points.material = m.additive ? this.matAdd : this.matNorm;
  }
}
