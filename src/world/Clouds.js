import * as THREE from 'three';
import { mulberry32 } from '../engine/math.js';
import { ISLETS } from '../config.js';

export const CLOUD_SEA_Y = -78;

// Mer de nuages sous l'archipel + nuages flottants (modèles KayKit).
export class Clouds {
  constructor(scene, assets, quality) {
    this.scene = scene;
    this.uniforms = {
      uTime: { value: 0 }, uTop: { value: new THREE.Color('#ffffff') }, uShade: { value: new THREE.Color('#9fb0d8') },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uFog: { value: new THREE.Color() },
      uCam: { value: new THREE.Vector3() }, uNight: { value: 0 }, uOct: { value: quality === 'low' ? 2 : 4 },
    };
    const geo = new THREE.PlaneGeometry(9000, 9000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: false, depthWrite: true, fog: false,
      vertexShader: /* glsl */`varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`
        uniform float uTime; uniform vec3 uTop; uniform vec3 uShade; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uFog; uniform vec3 uCam; uniform float uNight; uniform int uOct;
        varying vec3 vWorld;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
        float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ if(i>=uOct) break; s += a*noise(p); p = p*2.03 + vec2(1.7,9.2); a*=0.5; } return s; }
        void main(){
          vec2 p = vWorld.xz * 0.0045 + vec2(uTime * 0.004, uTime * 0.002);
          float h = fbm(p);
          float hx = fbm(p + vec2(0.02, 0.0)), hz = fbm(p + vec2(0.0, 0.02));
          vec3 n = normalize(vec3((h - hx) * 6.0, 0.25, (h - hz) * 6.0));
          float diff = clamp(dot(n, normalize(uSunDir + vec3(0.0, 0.35, 0.0))), 0.0, 1.0);
          vec3 col = mix(uShade, uTop, smoothstep(0.25, 0.75, h) * 0.6 + diff * 0.5);
          col += uSunColor * pow(diff, 6.0) * 0.18 * (1.0 - uNight);
          col *= mix(1.0, 0.42, uNight);
          float dist = length(vWorld.xz - uCam.xz);
          float f = smoothstep(500.0, 3800.0, dist);
          col = mix(col, uFog, f);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.sea = new THREE.Mesh(geo, mat);
    this.sea.position.y = CLOUD_SEA_Y;
    this.sea.renderOrder = -5;
    scene.add(this.sea);

    // nuages flottants instanciés
    this.puffs = [];
    const rng = mulberry32(77);
    const names = ['cloud_big', 'cloud_small'];
    const counts = quality === 'low' ? [14, 10] : [34, 26];
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, emissive: new THREE.Color('#d6dcf5'), emissiveIntensity: 0.25 });
    this.cloudMat = whiteMat;
    names.forEach((name, ni) => {
      const g = assets.propGeometry(name);
      if (!g) return;
      const n = counts[ni];
      const mesh = new THREE.InstancedMesh(g.geometry, whiteMat, n);
      mesh.castShadow = false; mesh.receiveShadow = false;
      const size = g.box.getSize(new THREE.Vector3());
      const norm = 1 / Math.max(size.x, size.z);
      for (let i = 0; i < n; i++) {
        let x, z, y;
        if (rng() < 0.35) {
          const isl = rng.pick(ISLETS);
          const a = rng() * Math.PI * 2, r = isl.radius + 10 + rng() * 40;
          x = isl.x + Math.cos(a) * r; z = isl.z + Math.sin(a) * r; y = isl.baseY - 30 + rng() * 60;
        } else {
          const a = rng() * Math.PI * 2, r = 230 + rng() * 520;
          x = Math.cos(a) * r; z = Math.sin(a) * r; y = -40 + rng() * 130;
        }
        const s = (ni === 0 ? 34 : 20) * (0.6 + rng() * 0.9) * norm;
        this.puffs.push({ mesh, i, x, y, z, s, sy: s * (0.5 + rng() * 0.4), rot: rng() * Math.PI * 2, speed: 0.6 + rng() * 1.6 });
      }
      this.scene.add(mesh);
    });
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.sc = new THREE.Vector3();
    this.updatePuffs(0);
  }

  updatePuffs(elapsed) {
    const meshes = new Set();
    for (const p of this.puffs) {
      const drift = (elapsed * p.speed) % 1600;
      let x = p.x + drift;
      if (x > 900) x -= 1600;
      this.v.set(x, p.y + Math.sin(elapsed * 0.1 + p.rot) * 1.5, p.z);
      this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.rot);
      this.sc.set(p.s, p.sy, p.s);
      this.m.compose(this.v, this.q, this.sc);
      p.mesh.setMatrixAt(p.i, this.m);
      meshes.add(p.mesh);
    }
    for (const m of meshes) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
  }

  update(dt, elapsed, sky, camera) {
    const u = this.uniforms;
    u.uTime.value = elapsed;
    u.uSunDir.value.copy(sky.state.sunDir);
    u.uSunColor.value.copy(sky.uniforms.uSunColor.value);
    u.uFog.value.copy(sky.uniforms.uBelow.value).lerp(sky.fogColor, 0.5);
    u.uTop.value.set('#ffffff').lerp(sky.uniforms.uHorizon.value, 0.25);
    u.uShade.value.copy(sky.uniforms.uZenith.value).lerp(new THREE.Color('#c8cfe8'), 0.55);
    u.uNight.value = sky.state.night;
    u.uCam.value.copy(camera.position);
    this.sea.position.x = Math.round(camera.position.x / 100) * 100;
    this.sea.position.z = Math.round(camera.position.z / 100) * 100;
    this.cloudMat.emissive.copy(sky.uniforms.uHorizon.value).multiplyScalar(0.35);
    this._acc = (this._acc || 0) + dt;
    if (this._acc > 0.1) { this._acc = 0; this.updatePuffs(elapsed); }
  }
}
