import * as THREE from 'three';
import { WORLD_HALF, SEA_LEVEL } from '../config.js';

// L'océan autour du continent : couleur selon la profondeur (lue dans la carte du relief),
// vagues, écume qui roule vers les plages, reflets du ciel et du soleil.
// (Au-delà de x = 3000, c'est le domaine de la Citadelle et de sa mer de nuages.)
export class Ocean {
  constructor(scene, textures) {
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.uniforms = {
      uColorMap: { value: textures.colorTex }, uNoise: { value: textures.noiseTex }, uHalf: { value: WORLD_HALF }, uTime: { value: 0 },
      uSky: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() },
      uNight: { value: 0 }, uLight: { value: 1 },
      uShallow: { value: new THREE.Color('#3fe0cc') }, uMid: { value: new THREE.Color('#1689b8') }, uDeep: { value: new THREE.Color('#0d3668') },
      fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 1000 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, fog: true,
      vertexShader: /* glsl */`
        varying vec3 vWorld; varying vec3 vView;
        #include <fog_pars_vertex>
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          vec4 mvPosition = viewMatrix * w;
          vView = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uColorMap; uniform sampler2D uNoise; uniform float uHalf; uniform float uTime;
        uniform vec3 uSky; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uNight; uniform float uLight;
        uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep;
        varying vec3 vWorld; varying vec3 vView;
        #include <fog_pars_fragment>
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
        // houle : somme de vagues directionnelles (pente analytique) + ondulations fines
        vec2 swell(vec2 p, float t){
          vec2 g = vec2(0.0);
          vec4 dirs[4];
          dirs[0] = vec4(normalize(vec2(1.0, 0.35)), 0.055, 1.1);
          dirs[1] = vec4(normalize(vec2(-0.6, 1.0)), 0.083, 1.4);
          dirs[2] = vec4(normalize(vec2(0.2, -1.0)), 0.13, 1.9);
          dirs[3] = vec4(normalize(vec2(-1.0, -0.25)), 0.21, 2.4);
          for (int i = 0; i < 4; i++) {
            vec4 d = dirs[i];
            float ph = dot(p, d.xy) * d.z + t * d.w;
            g += d.xy * cos(ph) * (0.42 / (1.0 + float(i)));
          }
          return g;
        }
        void main(){
          if (vWorld.x > 2900.0) discard;
          vec2 tuv = (vWorld.xz + uHalf) / (2.0 * uHalf);
          bool inMap = all(greaterThan(tuv, vec2(0.0))) && all(lessThan(tuv, vec2(1.0)));
          float depth = inMap ? texture2D(uColorMap, tuv).a * 24.0 : 24.0;
          vec2 p = vWorld.xz;
          // vaguelettes : deux couches de bruit qui dérivent, pente par différences finies
          vec2 uv1 = p * 0.045 + vec2(uTime * 0.012, uTime * 0.007), uv2 = p * 0.13 + vec2(-uTime * 0.02, uTime * 0.017);
          const float e = 0.006;
          float a1 = texture2D(uNoise, uv1).r, a2 = texture2D(uNoise, uv2).g;
          vec2 g1 = vec2(texture2D(uNoise, uv1 + vec2(e, 0.0)).r - a1, texture2D(uNoise, uv1 + vec2(0.0, e)).r - a1);
          vec2 g2 = vec2(texture2D(uNoise, uv2 + vec2(e, 0.0)).g - a2, texture2D(uNoise, uv2 + vec2(0.0, e)).g - a2);
          float viewD = length(vView);
          vec2 g = swell(p, uTime) * smoothstep(0.0, 4.0, depth) + (g1 * 9.0 + g2 * 6.0) * (1.0 - smoothstep(60.0, 600.0, viewD) * 0.7);
          vec3 nrm = normalize(vec3(-g.x * 0.5, 1.0, -g.y * 0.5));
          vec3 V = normalize(vView);
          float fres = pow(1.0 - max(dot(nrm, V), 0.0), 4.0);
          vec3 col = mix(uShallow, uMid, smoothstep(0.4, 5.0, depth));
          col = mix(col, uDeep, smoothstep(5.0, 22.0, depth));
          // reflet du ciel et éclat du soleil
          col = mix(col, uSky, clamp(fres * 0.75 + 0.06, 0.0, 0.85));
          vec3 R = reflect(-V, nrm);
          float spec = pow(max(dot(R, normalize(uSunDir)), 0.0), 220.0) * 2.4 + pow(max(dot(R, normalize(uSunDir)), 0.0), 18.0) * 0.12;
          col += uSunColor * spec * (1.0 - uNight);
          // écume : bord de plage + rouleaux qui avancent vers le rivage
          float fn = texture2D(uNoise, p * 0.09 + vec2(uTime * 0.02, 0.0)).b * 0.6 + texture2D(uNoise, p * 0.27 - vec2(0.0, uTime * 0.03)).a * 0.4;
          float edge = 1.0 - smoothstep(0.05, 0.55 + fn * 0.4, depth);
          float roll = smoothstep(0.72, 0.95, sin(depth * 2.4 - uTime * 1.5 + fn * 2.0) * 0.5 + 0.5) * (1.0 - smoothstep(0.4, 3.2, depth)) * step(0.45, fn);
          float foam = clamp(edge * 0.9 + roll * 0.75, 0.0, 1.0);
          // crêtes plus claires et turquoise translucide sur les hauts-fonds
          col += vec3(0.05, 0.12, 0.11) * smoothstep(0.55, 0.8, a1) * (1.0 - smoothstep(2.0, 14.0, depth));
          col = mix(col, vec3(0.96, 0.98, 1.0), foam);
          col *= mix(1.0, 0.42, uNight) * uLight;
          float alpha = mix(0.42, 0.97, smoothstep(0.15, 6.5, depth));
          alpha = max(alpha, foam * 0.95);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.scale.set(9000, 1, 9000);
    this.mesh.position.y = SEA_LEVEL;
    this.mesh.renderOrder = 1;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(dt, elapsed, sky, camera) {
    const u = this.uniforms;
    u.uTime.value = elapsed;
    u.uSky.value.copy(sky.uniforms.uHorizon.value).lerp(sky.uniforms.uZenith.value, 0.35);
    u.uSunDir.value.copy(sky.state.sunDir);
    u.uSunColor.value.copy(sky.uniforms.uSunColor.value);
    u.uNight.value = sky.state.night;
    u.uLight.value = Math.min(1.1, 0.35 + sky.sun.intensity * 0.22 + sky.hemi.intensity * 0.2);
    if (camera) this.mesh.position.set(Math.round(camera.position.x / 64) * 64, SEA_LEVEL, Math.round(camera.position.z / 64) * 64);
  }
}
