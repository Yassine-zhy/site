import * as THREE from 'three';
import { CORR_UV_GLSL } from './Maps.js';
import { mulberry32 } from '../engine/math.js';

// Herbe GPU : une seule instance de brins qui "s'enroule" autour du joueur.
// Hauteur, densité et couleur viennent des textures du monde ; le vent et le
// passage des personnages courbent les brins dans le vertex shader.
export class Grass {
  constructor(scene, maps, count, radius) {
    this.scene = scene; this.maps = maps;
    this.build(count, radius);
  }

  build(count, radius) {
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); }
    this.radius = radius;
    const blade = new THREE.InstancedBufferGeometry();
    const w = 0.09;
    const verts = new Float32Array([
      -w, 0, 0, w, 0, 0,
      -w * 0.8, 0.38, 0, w * 0.8, 0.38, 0,
      -w * 0.5, 0.72, 0, w * 0.5, 0.72, 0,
      0, 1, 0,
    ]);
    blade.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]);
    const rng = mulberry32(9001);
    const offs = new Float32Array(count * 4);
    const side = radius * 2;
    for (let i = 0; i < count; i++) {
      offs[i * 4] = rng() * side - radius;
      offs[i * 4 + 1] = rng() * side - radius;
      offs[i * 4 + 2] = rng() * Math.PI * 2;
      offs[i * 4 + 3] = rng();
    }
    blade.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offs, 4));
    blade.instanceCount = count;
    this.uniforms = {
      uHeight: { value: this.maps.heightTex }, uColor: { value: this.maps.colorTex }, uCorruption: { value: this.maps.corruptionTex },
      uCenter: { value: new THREE.Vector2() }, uRadius: { value: radius }, uTime: { value: 0 }, uExtent: { value: this.maps.main.half }, uMapCenter: { value: new THREE.Vector2(0, 0) },
      uPushers: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -1, 0)) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uAmbient: { value: new THREE.Color() },
      uNight: { value: 0 }, uWind: { value: 1 },
      fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 1000 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.DoubleSide, fog: true,
      vertexShader: /* glsl */`
        attribute vec4 aOffset;
        uniform sampler2D uHeight; uniform sampler2D uColor; uniform sampler2D uCorruption;
        uniform vec2 uCenter; uniform float uRadius; uniform float uTime; uniform float uExtent; uniform vec2 uMapCenter; uniform vec4 uPushers[8]; uniform float uWind;
        varying vec3 vColor; varying float vY; varying float vFlower; varying float vCor;
        #include <fog_pars_vertex>
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        void main(){
          vec2 o = aOffset.xy;
          vec2 p = mod(o - uCenter + uRadius, 2.0 * uRadius) - uRadius + uCenter;
          vec2 uv = (p - uMapCenter + uExtent) / (2.0 * uExtent);
          vec4 hm = texture2D(uHeight, uv);
          float dist = length(p - uCenter);
          float fade = 1.0 - smoothstep(uRadius * 0.7, uRadius, dist);
          float rnd = aOffset.w;
          float keep = step(rnd, hm.g) * hm.a * fade;
          float cor = texture2D(uCorruption, ${CORR_UV_GLSL.replace(/WP/g, 'p')}).r;
          float hgt = (0.55 + rnd * 0.7) * (0.6 + hm.g * 0.6) * keep * (1.0 - cor * 0.35);
          float flower = step(0.965, hash(o * 3.1)) * (1.0 - cor);
          vFlower = flower;
          vec3 pos = position;
          pos.x *= 1.0 + flower * 1.6;
          float c = cos(aOffset.z), s = sin(aOffset.z);
          pos.xz = mat2(c, -s, s, c) * pos.xz;
          pos.y *= hgt;
          float t = position.y;
          // vent
          float gust = sin(uTime * 1.7 + p.x * 0.12 + p.y * 0.08) * 0.5 + sin(uTime * 3.1 + p.x * 0.4) * 0.2;
          vec2 bend = vec2(gust * 0.32, gust * 0.18) * uWind;
          // personnages qui écrasent l'herbe
          for (int i = 0; i < 8; i++) {
            vec4 pu = uPushers[i];
            if (pu.z < 0.0) continue;
            vec2 d = p - pu.xy;
            float l = length(d);
            float f = 1.0 - smoothstep(0.0, pu.z, l);
            bend += normalize(d + 0.0001) * f * 0.9;
          }
          pos.xz += bend * t * t * hgt;
          pos.y -= length(bend) * t * t * hgt * 0.35;
          vec3 world = vec3(p.x, hm.r, p.y) + pos;
          vY = t;
          vCor = cor;
          vColor = texture2D(uColor, uv).rgb;
          vec4 mv = viewMatrix * vec4(world, 1.0);
          gl_Position = projectionMatrix * mv;
          vec4 mvPosition = mv;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSunColor; uniform vec3 uAmbient; uniform vec3 uSunDir; uniform float uNight;
        varying vec3 vColor; varying float vY; varying float vFlower; varying float vCor;
        #include <fog_pars_fragment>
        void main(){
          vec3 base = vColor * 0.62;
          vec3 tip = vColor * 1.25 + vec3(0.05, 0.08, 0.0);
          vec3 col = mix(base, tip, vY);
          vec3 fl = mix(vec3(1.0, 0.85, 0.35), vec3(0.95, 0.55, 0.85), fract(vColor.r * 37.0));
          col = mix(col, fl * 1.2, vFlower * smoothstep(0.75, 0.95, vY));
          float lum = dot(col, vec3(0.299,0.587,0.114));
          col = mix(col, mix(col, vec3(lum), 0.6) * vec3(0.78,0.68,0.94), vCor * 0.55);
          vec3 light = uAmbient + uSunColor * max(uSunDir.y, 0.0) * 0.55;
          col *= light;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(blade, mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  update(dt, elapsed, center, pushers, sky) {
    const u = this.uniforms;
    u.uTime.value = elapsed;
    u.uCenter.value.set(center.x, center.z);
    // région de l'archipel sous le joueur : ses textures de hauteur et de couleur
    const reg = this.maps.regionAt(center.x, center.z);
    if (reg !== this.region) {
      this.region = reg;
      u.uHeight.value = reg.heightTex; u.uColor.value = reg.colorTex;
      u.uExtent.value = reg.half; u.uMapCenter.value.set(reg.cx, reg.cz);
    }
    for (let i = 0; i < 8; i++) {
      const p = pushers[i];
      if (p) u.uPushers.value[i].set(p.x, p.z, p.r, 0); else u.uPushers.value[i].set(0, 0, -1, 0);
    }
    u.uSunDir.value.copy(sky.state.sunDir);
    u.uSunColor.value.copy(sky.sun.color).multiplyScalar(sky.sun.intensity * 0.45);
    u.uAmbient.value.copy(sky.hemi.color).multiplyScalar(sky.hemi.intensity * 0.55);
    u.uNight.value = sky.state.night;
  }
}
