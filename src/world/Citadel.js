import * as THREE from 'three';
import { Island } from './Island.js';
import { Decor } from './Decor.js';
import { VirtualLight } from './Lights.js';
import { Simplex, smoothstep } from '../engine/math.js';

// La Citadelle des Ombres : lieu des expéditions, loin au-delà des nuages.
// Cinq plateformes flottantes reliées par des ponts ; des barrières magiques ferment
// les ponts tant que l'épreuve en cours n'est pas réussie.
export const CITADEL = {
  platforms: [
    { id: 'seuil', name: 'Le Seuil', x: 4000, z: 0, r: 17, y: 60 },
    { id: 'porte', name: 'La Porte des Ombres', x: 4075, z: 0, r: 26, y: 63 },
    { id: 'nef', name: 'La Nef engloutie', x: 4160, z: 8, r: 28, y: 69 },
    { id: 'coeur', name: 'Le Cœur de la Brume', x: 4252, z: 0, r: 30, y: 78 },
    { id: 'arene', name: 'L’Arène des Champions', x: 4000, z: -78, r: 30, y: 62 },
  ],
  // ponts [plateforme A, plateforme B] ; la barrière se tient côté A
  bridges: [[0, 1], [1, 2], [2, 3], [0, 4]],
};

export function platformAt(x, z) {
  for (const p of CITADEL.platforms) if (Math.hypot(x - p.x, z - p.z) < p.r + 6) return p;
  return null;
}

function edge(a, b, inset = 2.5) {
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
  return [a.x + dx / d * (a.r - inset), a.z + dz / d * (a.r - inset)];
}

export class Citadel extends Decor {
  constructor(world, assets) {
    super(world.scene, assets, world.terrain, world.colliders, 'citadel');
    this.world = world;
    this.fallbackY = 60;
    const n = new Simplex(4040);
    // plateformes : dalles sombres veinées de violet
    const P = CITADEL.platforms;
    P.forEach((p, i) => {
      const isl = new Island({
        x: p.x, z: p.z, radius: p.r, coastNoise: p.r * 0.12, seed: 900 + i, cells: Math.round(p.r * 2.2), depth: p.r * 2.6, name: p.name,
        heightFn: (x, z) => {
          const d = Math.hypot(x - p.x, z - p.z) / p.r;
          let h = p.y + n.noise2(x / 9, z / 9) * 0.15;
          if (p.id === 'coeur') h += (1 - smoothstep(0.18, 0.3, d)) * 1.2; // estrade centrale
          return h;
        },
        colorFn: (out, x, y, z, slope, edgeV) => {
          const tile = (Math.floor((x + 1000) / 3) + Math.floor((z + 1000) / 3)) % 2 === 0 ? 1 : 0.86;
          const v = n.noise2(x / 7, z / 7) * 0.5 + 0.5;
          out.setRGB(0.24 * tile, 0.21 * tile, 0.3 * tile);
          if (v > 0.78) out.lerp(new THREE.Color('#6a3a9a'), (v - 0.78) * 2.5);
          if (edgeV) out.setRGB(0.18, 0.15, 0.22);
          return out;
        },
      }).build();
      isl.def = { id: 'cit-' + p.id, biome: 'shadow' };
      world.addIsland(isl);
    });
    // ponts
    const defs = CITADEL.bridges.map(([a, b]) => {
      const A = P[a], B = P[b];
      const [ax, az] = edge(A, B, 1.5), [bx, bz] = edge(B, A, 1.5);
      return this.terrain.makeBridgeDef({ from: [ax, az], to: [bx, bz] });
    });
    this.terrain.bridges.push(...defs);
    this.buildBridges(defs);
    // barrières (une par pont, côté départ)
    this.barrierMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#b06bff') } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
        void main(){ float w = sin(vUv.x * 40.0 + uTime * 3.0) * 0.5 + 0.5; float v = sin(vUv.y * 22.0 - uTime * 4.0 + vUv.x * 9.0) * 0.5 + 0.5;
          float edgeF = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
          float a = (0.25 + 0.5 * w * v) * edgeF; gl_FragColor = vec4(uColor * 1.8 * a, a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
    });
    this.barriers = CITADEL.bridges.map(([a, b], i) => {
      const A = P[a], B = P[b];
      const [x, z] = edge(A, B, 3.2);
      const rot = Math.atan2(B.x - A.x, B.z - A.z);
      const y = this.ground(x, z);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 7), this.barrierMat);
      mesh.position.set(x, y + 3.4, z);
      mesh.rotation.y = rot;
      this.scene.add(mesh);
      return { i, x, z, y, rot, mesh, col: null, open: false };
    });
    this.decorate(P);
    this.mergeStatic();
    this.setBarriers([true, false, false, false]);
  }

  // open[i] : le pont i est-il libre ?
  setBarriers(open) {
    for (const b of this.barriers) {
      const o = !!open[b.i];
      if (o === b.open && (o || b.col)) continue;
      b.open = o;
      b.mesh.visible = !o;
      if (o && b.col) { this.colliders.remove(b.col); b.col = null; }
      if (!o && !b.col) b.col = this.colliders.addBox(b.x, b.z, 3.4, 0.35, b.rot, b.y - 3, b.y + 8, 'ruin');
    }
  }

  decorate(P) {
    const put = (name, x, z, rot, scale, col = true, yoff = 0) => {
      const o = this.assets.prop(name);
      const y = this.ground(x, z);
      o.position.set(x, y - 0.1 + yoff, z); o.rotation.y = rot; o.scale.setScalar(scale);
      this.group.add(o);
      if (col) {
        const box = this.assets.propBox(name), top = y + box.max.y * scale;
        this.colliders.addFootprint(this.hulls(name, scale, 0.02, 0.6), x, z, rot, y - 1, top, top - y < 3.2 ? 'prop' : 'ruin', top - y < 3.2);
      }
      return o;
    };
    const ring = (p, r, n, fn) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; fn(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, a, i); } };
    const towardBridge = (p, a) => CITADEL.bridges.some(([x, y]) => {
      const o = P[x] === p ? P[y] : P[y] === p ? P[x] : null;
      if (!o) return false;
      const ba = Math.atan2(o.z - p.z, o.x - p.x);
      return Math.abs(Math.atan2(Math.sin(a - ba), Math.cos(a - ba))) < 0.42;
    });
    const [seuil, porte, nef, coeur, arene] = P;
    // le Seuil : portail de retour, bannières
    this.portal = this.buildPortal(seuil.x - 6, seuil.z);
    put('banner_triple_blue', seuil.x - 9, seuil.z - 5, Math.PI / 2, 1.5, false);
    put('banner_triple_blue', seuil.x - 9, seuil.z + 5, Math.PI / 2, 1.5, false);
    for (const [dx, dz] of [[4, 7], [4, -7], [-3, 10], [-3, -10]]) this.placeLantern(seuil.x + dx, seuil.z + dz, dx > 0);
    // la Porte des Ombres : remparts et colonnes
    ring(porte, porte.r - 2.5, 16, (x, z, a) => { if (!towardBridge(porte, a)) put(Math.random() < 0.3 ? 'wall_broken' : 'wall', x, z, -a + Math.PI / 2, 1.7); });
    ring(porte, 11, 6, (x, z, a, i) => put(i % 2 ? 'pillar_decorated' : 'column', x, z, a, 1.5));
    put('rubble_large', porte.x - 6, porte.z + 9, 0.4, 1.3); put('rubble_half', porte.x + 8, porte.z - 10, 2, 1.3);
    // la Nef engloutie : deux rangées de colonnes, autels
    for (let k = -2; k <= 2; k++) for (const s of [-1, 1]) put(Math.abs(k) === 2 ? 'pillar' : 'column', nef.x + k * 7, nef.z + s * 9, 0, 1.6);
    this.altars = [0, 1, 2].map((i) => this.buildAltar(nef.x + Math.cos(i / 3 * Math.PI * 2 + 0.5) * 15, nef.z + Math.sin(i / 3 * Math.PI * 2 + 0.5) * 15));
    put('candle_triple', nef.x, nef.z - 3, 0, 1.6, false); put('candle_triple', nef.x + 2, nef.z + 3, 1, 1.6, false);
    // le Cœur de la Brume : cristaux et braseros
    this.crystals = [];
    ring(coeur, coeur.r - 4, 9, (x, z, a) => { if (!towardBridge(coeur, a)) this.crystals.push(this.buildCrystal(x, z, 2.4 + Math.random() * 1.5)); });
    this.braziers = [0, 1, 2, 3].map((i) => this.buildBrazier(coeur.x + Math.cos(i / 4 * Math.PI * 2 + Math.PI / 4) * 16, coeur.z + Math.sin(i / 4 * Math.PI * 2 + Math.PI / 4) * 16));
    // l'Arène des Champions
    ring(arene, arene.r - 3, 12, (x, z, a, i) => { if (!towardBridge(arene, a)) put(i % 3 ? 'pillar' : 'pillar_decorated', x, z, a, 1.7); });
    ring(arene, 8, 4, (x, z) => this.placeBonfire(x, z, 0.9));
    put('banner_shield_red', arene.x - 6, arene.z - arene.r + 5, 0, 1.6, false);
    put('banner_patternA_blue', arene.x + 6, arene.z - arene.r + 5, 0, 1.6, false);
  }

  buildPortal(x, z) {
    const y = this.ground(x, z);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fd8ff').multiplyScalar(2.2), toneMapped: false });
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.18, 8, 48), mat);
    ringM.position.set(x, y + 3, z); ringM.rotation.y = Math.PI / 2;
    this.scene.add(ringM);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.45, 40), new THREE.MeshBasicMaterial({ color: '#6fb8ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    disc.position.copy(ringM.position); disc.rotation.y = Math.PI / 2;
    this.scene.add(disc);
    const l = new VirtualLight('#8fd0ff', 10, 18, 1.6);
    l.position.set(x, y + 3, z); this.group.add(l);
    this.colliders.addCircle(x, z, 0.6, y - 1, y + 6, 'monument');
    return { x, y, z, ringM, disc };
  }

  buildAltar(x, z) {
    const y = this.ground(x, z);
    const o = this.assets.prop('pillar_decorated');
    o.position.set(x, y - 0.1, z); o.scale.set(0.9, 0.7, 0.9);
    this.group.add(o);
    const mat = new THREE.MeshStandardMaterial({ color: '#cbb6ff', emissive: new THREE.Color('#7a3cff'), emissiveIntensity: 1.6, roughness: 0.25, flatShading: true });
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), mat);
    c.position.set(x, y + 3.6, z);
    this.scene.add(c);
    const l = new VirtualLight('#9a5cff', 6, 14, 1.6);
    l.position.set(x, y + 3.6, z); this.group.add(l);
    this.colliders.addCircle(x, z, 0.9, y - 1, y + 3, 'ruin');
    return { x, y, z, crystal: c, mat, light: l, done: false };
  }

  buildBrazier(x, z) {
    const y = this.ground(x, z);
    const o = this.assets.prop('pillar');
    o.position.set(x, y - 0.1, z); o.scale.set(0.8, 0.55, 0.8);
    this.group.add(o);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.6, 0.5, 10), new THREE.MeshStandardMaterial({ color: '#3a3240', roughness: 0.6, metalness: 0.5, flatShading: true }));
    bowl.position.set(x, y + 2.6, z);
    this.group.add(bowl);
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.8, 7, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb04a').multiplyScalar(3), transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    fire.position.set(x, y + 3.6, z); fire.visible = false;
    this.scene.add(fire);
    const l = new VirtualLight('#ffae5c', 0, 22, 1.5);
    l.position.set(x, y + 3.6, z); this.group.add(l);
    this.colliders.addCircle(x, z, 0.9, y - 1, y + 3, 'ruin');
    return { x, y, z, fire, light: l, done: false };
  }

  buildCrystal(x, z, s) {
    const y = this.ground(x, z);
    const mat = new THREE.MeshStandardMaterial({ color: '#b48cff', emissive: new THREE.Color('#6a2cd6'), emissiveIntensity: 1.2, roughness: 0.2, flatShading: true, transparent: true, opacity: 0.92 });
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mat);
    c.scale.set(s * 0.6, s * 1.6, s * 0.6);
    c.position.set(x, y + s * 1.2, z);
    c.rotation.set(Math.random() * 0.3, Math.random() * 3, Math.random() * 0.3);
    this.scene.add(c);
    this.colliders.addCircle(x, z, s * 0.5, y - 1, y + s * 3, 'ruin');
    return c;
  }

  // état des autels / braseros (bits) venant de l'hôte
  setObjects(altars, braziers) {
    this.altars.forEach((a, i) => {
      const on = !!altars[i];
      if (on === a.done) return;
      a.done = on;
      a.mat.emissive.set(on ? '#ffd36b' : '#7a3cff'); a.mat.color.set(on ? '#fff2c8' : '#cbb6ff');
      a.light.color.set(on ? '#ffd27a' : '#9a5cff');
    });
    this.braziers.forEach((b, i) => {
      const on = !!braziers[i];
      if (on === b.done) return;
      b.done = on; b.fire.visible = on;
    });
  }

  update(dt, elapsed, night) {
    super.update(dt, elapsed, night);
    this.barrierMat.uniforms.uTime.value = elapsed;
    if (this.portal) { this.portal.ringM.rotation.z += dt * 0.6; this.portal.disc.material.opacity = 0.3 + Math.sin(elapsed * 2) * 0.08; }
    for (const a of this.altars || []) { a.crystal.rotation.y += dt * (a.done ? 1.6 : 0.5); a.crystal.position.y = a.y + 3.6 + Math.sin(elapsed * 1.5 + a.x) * 0.2; }
    for (const b of this.braziers || []) if (b.done) { b.fire.scale.set(1, 1 + Math.sin(elapsed * 11 + b.x) * 0.12, 1); b.light.intensity = 16 + Math.sin(elapsed * 13 + b.z) * 2; } else b.light.intensity = 0;
    for (const c of this.crystals || []) c.rotation.y += dt * 0.2;
  }
}
