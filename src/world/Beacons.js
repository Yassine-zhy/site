import * as THREE from 'three';
import { VirtualLight } from './Lights.js';
import { BEACONS } from '../config.js';

const ringVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const ringFrag = `uniform float uFill; uniform vec3 uColor; uniform vec3 uEmpty; uniform float uTime; varying vec2 vUv;
  void main(){
    vec2 d = vUv - 0.5; float r = length(d) * 2.0;
    if (r < 0.78 || r > 1.0) discard;
    float a = atan(d.x, -d.y) / 6.2831853 + 0.5;
    float on = step(a, uFill);
    float edge = smoothstep(0.78, 0.82, r) * smoothstep(1.0, 0.95, r);
    float tick = step(0.5, fract(a * 40.0));
    vec3 c = mix(uEmpty * (0.6 + 0.2 * tick), uColor * (1.6 + 0.4 * sin(uTime * 3.0 + a * 20.0)), on);
    gl_FragColor = vec4(c, edge * (0.55 + on * 0.45));
  }`;

// Les Phares : monuments partagés. Leur cristal s'allume selon la lumière offerte par tous.
export class Beacons {
  constructor(scene, assets, terrain, colliders, fx) {
    this.scene = scene; this.fx = fx;
    this.list = [];
    const stone = new THREE.MeshStandardMaterial({ color: '#b9b0a0', roughness: 0.9, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: '#77706a', roughness: 0.95, flatShading: true });
    const beamGeo = new THREE.CylinderGeometry(1, 1.6, 1, 24, 1, true); beamGeo.translate(0, 0.5, 0);
    for (const b of BEACONS) {
      const y = terrain.heightAt(b.x, b.z) ?? 0;
      const g = new THREE.Group();
      g.position.set(b.x, y, b.z);
      const t1 = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.2, 0.8, 8), dark); t1.position.y = 0.2;
      const t2 = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.6, 8), stone); t2.position.y = 0.9;
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.5, 2.6, 8), stone); ped.position.y = 2.4;
      [t1, t2, ped].forEach((m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        const p = assets.prop('pillar_decorated');
        p.scale.set(0.55, 0.9, 0.55);
        p.position.set(Math.cos(a) * 3.6, 1.1, Math.sin(a) * 3.6);
        p.rotation.y = -a;
        g.add(p);
        colliders.addCircle(b.x + Math.cos(a) * 3.6, b.z + Math.sin(a) * 3.6, 0.85, y - 1, y + 5, 'ruin');
      }
      const crystalMat = new THREE.MeshStandardMaterial({ color: '#d9ccff', emissive: new THREE.Color('#6a4bd6'), emissiveIntensity: 0.4, roughness: 0.25, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.92 });
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.3, 0), crystalMat);
      crystal.scale.set(1, 1.9, 1);
      crystal.position.y = 6;
      g.add(crystal);
      const ringMat = new THREE.ShaderMaterial({ uniforms: { uFill: { value: 0 }, uColor: { value: new THREE.Color('#ffd36b') }, uEmpty: { value: new THREE.Color('#5b4a8a') }, uTime: { value: 0 } }, vertexShader: ringVert, fragmentShader: ringFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 8.2), ringMat);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 1.25;
      g.add(ring);
      const beamMat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color('#ffe7a8') }, uAlpha: { value: 0 }, uTime: { value: 0 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uAlpha; uniform float uTime; varying vec2 vUv;
          void main(){ float f = pow(1.0 - vUv.y, 1.6) * (0.75 + 0.25 * sin(vUv.x * 30.0 + uTime * 2.0 - vUv.y * 20.0)); gl_FragColor = vec4(uColor * 1.4 * f, uAlpha * f); }`,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.scale.set(1.1, 260, 1.1); beam.position.y = 6;
      beam.visible = false;
      beam.renderOrder = 15;
      g.add(beam);
      const light = new VirtualLight('#ffd27a', 0, 45, 1.5);
      light.position.y = 6.5;
      g.add(light);
      scene.add(g);
      colliders.addCircle(b.x, b.z, 1.6, y - 1, y + 9, 'monument');
      colliders.addCircle(b.x, b.z, 6.0, y - 2, y + 0.6, 'prop', true);
      colliders.addCircle(b.x, b.z, 4.45, y - 2, y + 1.2, 'prop', true);
      this.list.push({ def: b, group: g, crystal, crystalMat, ringMat, beam, beamMat, light, y, level: 0, shown: 0, lit: false });
    }
  }

  setLevels(levels) { levels.forEach((lv, i) => { if (this.list[i]) this.list[i].level = lv; }); }

  update(dt, elapsed, night) {
    for (const b of this.list) {
      b.shown += (b.level - b.shown) * Math.min(1, dt * 1.5);
      const lv = b.shown;
      const lit = b.level >= 0.999;
      b.crystal.rotation.y += dt * (0.3 + lv);
      b.crystal.position.y = 6 + Math.sin(elapsed * 1.1 + b.def.x) * 0.3;
      b.crystalMat.emissive.set(lit ? '#ffc64a' : '#6a4bd6').lerp(new THREE.Color('#ffc64a'), lit ? 1 : lv * 0.6);
      b.crystalMat.emissiveIntensity = lit ? 2.6 + night * 1.5 : 0.3 + lv * 1.4;
      b.ringMat.uniforms.uFill.value = lv;
      b.ringMat.uniforms.uTime.value = elapsed;
      b.beam.visible = lv > 0.98;
      b.beamMat.uniforms.uAlpha.value = lit ? 0.42 + night * 0.25 : 0.15;
      b.beamMat.uniforms.uTime.value = elapsed;
      b.light.intensity = lit ? 25 + night * 40 : lv * 8;
      // brume violette autour des phares éteints, étincelles dorées autour des phares allumés
      if (Math.random() < dt * (lit ? 10 : 6)) {
        const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 5;
        const p = { x: b.def.x + Math.cos(a) * r, y: b.y + 0.5 + Math.random() * 3, z: b.def.z + Math.sin(a) * r };
        if (lit) this.fx.sparkle(p, '#ffe08a', 0.5, 1, 0.22);
        else this.fx.sparkle(p, '#8a5cff', 0.5, 1, 0.3);
      }
    }
  }

  nearest(pos, maxD = 14) {
    let best = null, bd = maxD;
    for (const b of this.list) { const d = Math.hypot(pos.x - b.def.x, pos.z - b.def.z); if (d < bd) { bd = d; best = b; } }
    return best;
  }
}
