import * as THREE from 'three';
import { WATERS } from '../config.js';

const TINTS = { clear: ['#5fd3c6', '#1d5e8c'], jungle: ['#5fe0b0', '#0f6a6a'], marsh: ['#6f8a5a', '#1e2a24'] };

// Lacs stylisés : couleur selon la profondeur, écume sur les rives, reflets du ciel.
export class Water {
  constructor(scene, terrain) {
    this.meshes = [];
    for (const lake of WATERS) this.meshes.push(this.makeLake(scene, terrain, lake));
  }

  makeLake(scene, terrain, LAKE) {
    const R = LAKE.radius * 1.85;
    // subdivision radiale pour avoir des profondeurs par sommet
    const ring = new THREE.RingGeometry(0.001, R, 128, 24);
    ring.rotateX(-Math.PI / 2);
    const pos = ring.attributes.position;
    const depth = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + LAKE.x, z = pos.getZ(i) + LAKE.z;
      const h = terrain.heightAt(x, z);
      depth[i] = h === null ? 4 : LAKE.level - h;
    }
    ring.setAttribute('depth', new THREE.BufferAttribute(depth, 1));
    if (!this.uniforms) this.uniforms = {
      uTime: { value: 0 }, uSky: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() },
      uNight: { value: 0 }, uLight: { value: 1 },
      fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 1000 },
    };
    const [sh, dp] = TINTS[LAKE.kind] || TINTS.clear;
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...this.uniforms, uShallow: { value: new THREE.Color(sh) }, uDeep: { value: new THREE.Color(dp) } }, transparent: true, depthWrite: false, fog: true,
      vertexShader: /* glsl */`
        attribute float depth; varying float vDepth; varying vec3 vWorld; varying vec3 vView;
        #include <fog_pars_vertex>
        void main(){ vDepth = depth; vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; vec4 mvPosition = viewMatrix * w; vView = -mvPosition.xyz; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime; uniform vec3 uSky; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uShallow; uniform vec3 uDeep; uniform float uNight; uniform float uLight;
        varying float vDepth; varying vec3 vWorld; varying vec3 vView;
        #include <fog_pars_fragment>
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        void main(){
          vec2 p = vWorld.xz * 0.35;
          float w1 = n(p + vec2(uTime*0.35, uTime*0.2)), w2 = n(p*1.9 - vec2(uTime*0.25, -uTime*0.3));
          vec3 nrm = normalize(vec3((w1 - 0.5) * 0.35 + (w2-0.5)*0.2, 1.0, (w2 - 0.5) * 0.35));
          vec3 V = normalize(vView);
          float fres = pow(1.0 - max(dot(nrm, V), 0.0), 3.0);
          float d = clamp(vDepth / 4.5, 0.0, 1.0);
          vec3 col = mix(uShallow, uDeep, d);
          col = mix(col, uSky, fres * 0.55);
          vec3 R = reflect(-V, nrm);
          float spec = pow(max(dot(R, normalize(uSunDir)), 0.0), 120.0);
          col += uSunColor * spec * 1.6 * (1.0 - uNight);
          float foam = smoothstep(0.55, 0.0, vDepth) * (0.6 + 0.4 * sin(uTime * 2.0 + vWorld.x * 0.8 + vWorld.z * 0.6));
          col = mix(col, vec3(0.95), foam * 0.7);
          col *= mix(1.0, 0.45, uNight) * uLight;
          float alpha = mix(0.72, 0.94, d) * smoothstep(-0.2, 0.15, vDepth);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(ring, mat);
    mesh.position.set(LAKE.x, LAKE.level, LAKE.z);
    mesh.renderOrder = 2;
    scene.add(mesh);
    return mesh;
  }
  update(dt, elapsed, sky) {
    const u = this.uniforms;
    u.uTime.value = elapsed;
    u.uSky.value.copy(sky.uniforms.uHorizon.value).lerp(sky.uniforms.uZenith.value, 0.4);
    u.uSunDir.value.copy(sky.state.sunDir);
    u.uSunColor.value.copy(sky.uniforms.uSunColor.value);
    u.uNight.value = sky.state.night;
    u.uLight.value = Math.min(1.1, 0.35 + sky.sun.intensity * 0.22 + sky.hemi.intensity * 0.2);
  }
}
