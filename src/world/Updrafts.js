import * as THREE from 'three';
import { UPDRAFTS } from '../config.js';

// Colonnes de vent ascendantes : tourbillons translucides visibles de loin.
export class Updrafts {
  constructor(scene, terrain, fx) {
    this.fx = fx;
    this.list = [];
    this.uniforms = { uTime: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: `varying vec2 vUv; varying float vH; void main(){ vUv = uv; vH = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        void main(){
          float s1 = sin((vUv.x * 6.0 + vUv.y * 9.0 - uTime * 1.6) * 6.2831);
          float s2 = sin((vUv.x * 3.0 - vUv.y * 5.0 - uTime * 0.9) * 6.2831);
          float streak = smoothstep(0.75, 1.0, s1) * 0.8 + smoothstep(0.85, 1.0, s2) * 0.5;
          float fade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
          vec3 col = mix(vec3(0.75, 0.95, 1.0), vec3(1.0, 0.95, 0.8), vUv.y);
          gl_FragColor = vec4(col * streak * 0.9, streak * fade * 0.5);
        }`,
    });
    for (const u of UPDRAFTS) {
      const base = terrain.heightAt(u.x, u.z) ?? (u.top - 60);
      const hgt = u.top - base + 6;
      const geo = new THREE.CylinderGeometry(u.radius, u.radius * 0.7, hgt, 28, 1, true);
      geo.translate(0, hgt / 2, 0);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(u.x, base, u.z);
      m.renderOrder = 14;
      scene.add(m);
      // anneau au sol
      const ring = new THREE.Mesh(new THREE.RingGeometry(u.radius * 0.8, u.radius, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color('#bff3ff').multiplyScalar(1.5), transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(u.x, base + 0.15, u.z);
      scene.add(ring);
      this.list.push({ def: u, mesh: m, ring, base });
    }
  }

  update(dt, elapsed, focus) {
    this.uniforms.uTime.value = elapsed;
    for (const u of this.list) {
      u.mesh.rotation.y += dt * 0.6;
      u.ring.rotation.z -= dt * 0.8;
      if (!focus || Math.hypot(focus.x - u.def.x, focus.z - u.def.z) > 120) continue;
      if (Math.random() < dt * 20) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * u.def.radius;
        const y = u.base + Math.random() * (u.def.top - u.base);
        this.fx.add.emit({ x: u.def.x + Math.cos(a) * r, y, z: u.def.z + Math.sin(a) * r, vx: -Math.sin(a) * 3, vy: 9 + Math.random() * 6, vz: Math.cos(a) * 3, color: new THREE.Color('#dff8ff'), size: 0.35, life: 2, gravity: 0, drag: 0.2, alpha: 0.8 });
      }
    }
  }
}
