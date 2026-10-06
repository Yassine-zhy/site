import * as THREE from 'three';
import { DAY_LENGTH_MS } from '../config.js';
import { clamp, smoothstep } from '../engine/math.js';

const vert = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const frag = /* glsl */`
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uBelow;
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uMoonDir;
uniform float uNight; uniform float uTime; uniform float uAurora;
varying vec3 vDir;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y), f.z);
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.5, h), 0.6));
  col = mix(col, uBelow, smoothstep(0.0, -0.35, h));
  // halo solaire
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(sd, 6.0) * 0.28 + pow(sd, 64.0) * 0.6) * (1.0 - uNight * 0.9);
  col += uSunColor * smoothstep(0.9992, 0.9996, sd) * 4.0 * step(-0.05, uSunDir.y);
  // lune
  float md = max(dot(d, normalize(uMoonDir)), 0.0);
  col += vec3(0.75, 0.82, 1.0) * (smoothstep(0.9990, 0.9994, md) * 1.6 + pow(md, 32.0) * 0.12) * uNight;
  // étoiles
  if (uNight > 0.01 && h > -0.05) {
    vec3 sp = d * 220.0;
    vec3 cell = floor(sp);
    float r = hash(cell);
    float star = step(0.985, r) * smoothstep(0.62, 0.0, length(fract(sp) - 0.5));
    float tw = 0.6 + 0.4 * sin(uTime * (1.5 + r * 4.0) + r * 60.0);
    col += vec3(0.85, 0.9, 1.0) * star * tw * uNight * smoothstep(-0.05, 0.25, h) * 1.4;
    // aurore boréale (les nuits d'Aetheria)
    float band = noise(vec3(d.x * 3.0 + uTime * 0.03, d.z * 3.0, uTime * 0.05)) * noise(vec3(d.x * 9.0, d.z * 9.0 - uTime * 0.04, 2.0));
    float ay = smoothstep(0.12, 0.35, h) * smoothstep(0.85, 0.4, h);
    vec3 aur = mix(vec3(0.2, 1.0, 0.65), vec3(0.55, 0.35, 1.0), noise(vec3(d.xz * 4.0, uTime * 0.02)));
    col += aur * pow(band, 2.0) * ay * uNight * uAurora * 0.9;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// Palette du ciel par moment de la journée (t : 0 minuit, 0.5 midi).
const KEYS = [
  { t: 0.00, zen: '#070b24', hor: '#1e2d58', below: '#1a2448', fog: '#1b2950', sun: '#ffb070', sunI: 0, hemiS: '#3d5aa0', hemiG: '#1d1d33', hemiI: 0.8, exp: 1.0 },
  { t: 0.20, zen: '#0d1236', hor: '#3a3a72', below: '#2a2b58', fog: '#2b2f5e', sun: '#ff9a5a', sunI: 0, hemiS: '#4d5aa0', hemiG: '#24203a', hemiI: 0.85, exp: 1.0 },
  { t: 0.26, zen: '#3b5aa6', hor: '#ff9e6e', below: '#a8728a', fog: '#c98d84', sun: '#ffa060', sunI: 1.4, hemiS: '#9aa8e0', hemiG: '#6a4a3a', hemiI: 1.0, exp: 1.0 },
  { t: 0.33, zen: '#3f82dc', hor: '#b4d8f6', below: '#a9c4e0', fog: '#b9d4ee', sun: '#fff0d8', sunI: 2.6, hemiS: '#bcd8ff', hemiG: '#6c7a4a', hemiI: 1.15, exp: 1.0 },
  { t: 0.50, zen: '#2f78e0', hor: '#b8dcfa', below: '#b4cfe8', fog: '#c4dcf2', sun: '#ffffff', sunI: 3.0, hemiS: '#c8e0ff', hemiG: '#70804c', hemiI: 1.2, exp: 1.0 },
  { t: 0.67, zen: '#3678d6', hor: '#c8def2', below: '#b8c8e0', fog: '#cfdcec', sun: '#fff1dc', sunI: 2.7, hemiS: '#c4d8ff', hemiG: '#74804a', hemiI: 1.15, exp: 1.0 },
  { t: 0.735, zen: '#4b5ba6', hor: '#ff9358', below: '#b06a78', fog: '#d6886e', sun: '#ff8048', sunI: 1.7, hemiS: '#a89ad8', hemiG: '#6e4838', hemiI: 1.0, exp: 1.0 },
  { t: 0.78, zen: '#222765', hor: '#b85476', below: '#5b3a68', fog: '#6a3f6e', sun: '#ff6a50', sunI: 0.35, hemiS: '#6a5aa8', hemiG: '#2c2038', hemiI: 0.9, exp: 1.0 },
  { t: 0.84, zen: '#0a0e2c', hor: '#26306a', below: '#1c2450', fog: '#202c58', sun: '#ffb070', sunI: 0, hemiS: '#4258a0', hemiG: '#1d1d33', hemiI: 0.8, exp: 1.0 },
  { t: 1.00, zen: '#070b24', hor: '#1e2d58', below: '#1a2448', fog: '#1b2950', sun: '#ffb070', sunI: 0, hemiS: '#3d5aa0', hemiG: '#1d1d33', hemiI: 0.8, exp: 1.0 },
];
for (const k of KEYS) for (const key of ['zen', 'hor', 'below', 'fog', 'sun', 'hemiS', 'hemiG']) k[key] = new THREE.Color(k[key]);

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.uniforms = {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBelow: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uNight: { value: 0 }, uTime: { value: 0 }, uAurora: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    scene.add(this.mesh);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.setShadowSize(2048, 70);
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    scene.add(this.hemi);

    this.fogColor = new THREE.Color();
    scene.fog = new THREE.Fog(0xcfe0f0, 260, 2000);
    this.state = { t: 0.5, night: 0, sunDir: new THREE.Vector3(), light: new THREE.Color(), sunI: 1 };
    this.override = null; // t forcé (écran titre)
    this.tmp = new THREE.Vector3();
  }

  setShadowSize(size, extent) {
    const s = this.sun.shadow;
    if (s.map) { s.map.dispose(); s.map = null; }
    s.mapSize.set(size, size);
    const c = s.camera;
    c.left = -extent; c.right = extent; c.top = extent; c.bottom = -extent; c.near = 1; c.far = 500;
    c.updateProjectionMatrix();
    this.shadowExtent = extent;
  }

  timeOfDay() {
    if (this.override !== null) return this.override;
    return (Date.now() % DAY_LENGTH_MS) / DAY_LENGTH_MS;
  }

  sample(t, key, out) {
    for (let i = 0; i < KEYS.length - 1; i++) {
      const a = KEYS[i], b = KEYS[i + 1];
      if (t >= a.t && t <= b.t) {
        const f = (t - a.t) / (b.t - a.t);
        if (out) return out.copy(a[key]).lerp(b[key], f);
        return a[key] + (b[key] - a[key]) * f;
      }
    }
    return out ? out.copy(KEYS[0][key]) : KEYS[0][key];
  }

  update(dt, focus, elapsed) {
    const t = this.timeOfDay();
    const st = this.state;
    st.t = t;
    const u = this.uniforms;
    u.uTime.value = elapsed;
    this.sample(t, 'zen', u.uZenith.value);
    this.sample(t, 'hor', u.uHorizon.value);
    this.sample(t, 'below', u.uBelow.value);
    this.sample(t, 'sun', u.uSunColor.value);
    // course du soleil
    const ang = (t - 0.25) * Math.PI * 2;
    const el = Math.sin(ang);
    const az = Math.cos(ang);
    const sunDir = this.tmp.set(az * 0.85, el, 0.45 + el * 0.1).normalize();
    u.uSunDir.value.copy(sunDir);
    u.uMoonDir.value.set(-sunDir.x, -sunDir.y, -sunDir.z * 0.6 + 0.3).normalize();
    const night = 1 - smoothstep(-0.18, 0.08, el);
    u.uNight.value = night;
    st.night = night;
    st.sunDir.copy(sunDir);

    // lumière directionnelle : soleil le jour, lune la nuit
    const sunI = this.sample(t, 'sunI');
    const lightDir = el > -0.02 ? sunDir : u.uMoonDir.value;
    if (el > -0.02) {
      this.sun.color.copy(u.uSunColor.value);
      this.sun.intensity = sunI;
    } else {
      this.sun.color.set('#9db4ff');
      this.sun.intensity = 0.55 * smoothstep(-0.02, -0.25, el);
    }
    st.sunI = this.sun.intensity;
    this.sample(t, 'hemiS', this.hemi.color);
    this.sample(t, 'hemiG', this.hemi.groundColor);
    this.hemi.intensity = this.sample(t, 'hemiI');
    this.sample(t, 'fog', this.fogColor);
    this.scene.fog.color.copy(this.fogColor);

    if (focus) {
      // suivi de l'ombre avec accrochage aux texels (évite le scintillement)
      const ext = this.shadowExtent;
      const texel = (ext * 2) / this.sun.shadow.mapSize.x;
      const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel, fy = Math.round(focus.y / texel) * texel;
      this.sun.target.position.set(fx, fy, fz);
      this.sun.position.set(fx + lightDir.x * 200, fy + Math.max(lightDir.y, 0.12) * 200, fz + lightDir.z * 200);
      this.sun.target.updateMatrixWorld();
      this.mesh.position.copy(focus);
    }
    return st;
  }
}

export function nightFactor(t) { return clamp(1 - smoothstep(-0.18, 0.08, Math.sin((t - 0.25) * Math.PI * 2)), 0, 1); }
