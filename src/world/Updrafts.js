import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { UPDRAFTS } from '../config.js';

// Colonnes de vent ascendantes : tourbillons translucides visibles de loin.
export class Updrafts {
  constructor(scene, terrain, fx) {
    this.fx = fx;
    this.list = [];
    this.uniforms = { uTime: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: `varying vec2 vUv; varying float vDist; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv; varying float vDist;
        void main(){
          float s1 = sin((vUv.x * 6.0 + vUv.y * 9.0 - uTime * 1.6) * 6.2831);
          float s2 = sin((vUv.x * 3.0 - vUv.y * 5.0 - uTime * 0.9) * 6.2831);
          float streak = smoothstep(0.75, 1.0, s1) * 0.8 + smoothstep(0.85, 1.0, s2) * 0.5;
          float fade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
          vec3 col = mix(vec3(0.75, 0.95, 1.0), vec3(1.0, 0.95, 0.8), vUv.y);
          float near = 0.35 + 0.65 * smoothstep(2.0, 20.0, vDist);
          gl_FragColor = vec4(col * streak * 0.9 * near, streak * fade * 0.5 * near);
        }`,
    });
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#8f8a9c', roughness: 0.9, flatShading: true });
    const runeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#bff3ff').multiplyScalar(1.6), toneMapped: false });
    // tous les socles sont fusionnés en deux maillages (pierre, runes) : deux appels de rendu en tout
    const stoneGeos = [], runeGeos = [];
    const bake = (list, geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.applyMatrix4(m);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
      list.push(g);
    };
    for (const u of UPDRAFTS) {
      // une colonne naît toujours d'un sol plat : on la déplace sur la terre ferme la plus proche
      Updrafts.anchor(u, terrain);
      const base = terrain.heightAt(u.x, u.z) ?? 0;
      u.top = Math.max(u.top ?? 0, base + 30);
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
      // socle : dalle circulaire et pierres levées runiques, la source du vent
      bake(stoneGeos, new THREE.CylinderGeometry(u.radius + 1.6, u.radius + 2.2, 0.8, 32, 1, true), u.x, base - 0.1, u.z);
      bake(stoneGeos, new THREE.RingGeometry(u.radius + 0.4, u.radius + 1.6, 32), u.x, base + 0.3, u.z, -Math.PI / 2);
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.2, r = u.radius + 1.0;
        const hh = 1.8 + (i % 2) * 1.2;
        const gx = u.x + Math.cos(a) * r, gz = u.z + Math.sin(a) * r;
        const sy = (terrain.heightAt(gx, gz) ?? base) + hh / 2 - 0.25;
        bake(stoneGeos, new THREE.BoxGeometry(0.8, hh, 0.6), gx, sy, gz, 0, -a, (((i * 13) % 5) - 2) * 0.05);
        const rg = new THREE.PlaneGeometry(0.42, 0.42); rg.rotateZ(Math.PI / 4); rg.rotateY(-a - Math.PI / 2);
        bake(runeGeos, rg, gx - Math.cos(a) * 0.42, sy + hh * 0.15, gz - Math.sin(a) * 0.42);
      }
      this.list.push({ def: u, mesh: m, ring, base });
    }
    const stones = new THREE.Mesh(mergeGeometries(stoneGeos, false), stoneMat);
    stones.castShadow = true; stones.receiveShadow = true;
    const runes = new THREE.Mesh(mergeGeometries(runeGeos, false), runeMat);
    scene.add(stones, runes);
  }

  // Déplace la colonne sur un sol plat (dans un rayon de 80 unités) si elle est au-dessus du vide ou d'une pente.
  static anchor(u, terrain) {
    const ok = (x, z) => {
      for (let k = 0; k <= 8; k++) {
        const a = (k / 8) * Math.PI * 2, r = k ? u.radius + 1.5 : 0;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (!terrain.isLand(px, pz) || terrain.slopeAt(px, pz) > 0.45) return false;
      }
      return true;
    };
    // sommet de la colonne : « lift » unités au-dessus du sol
    const done = () => { if (u.lift) u.top = terrain.heightAt(u.x, u.z) + u.lift; return u; };
    if (ok(u.x, u.z)) return done();
    for (let r = 3; r <= 80; r += 3) {
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const x = u.x + Math.cos(a) * r, z = u.z + Math.sin(a) * r;
        if (ok(x, z)) { u.x = Math.round(x); u.z = Math.round(z); return done(); }
      }
    }
    return done();
  }

  update(dt, elapsed, focus) {
    this.uniforms.uTime.value = elapsed;
    for (const u of this.list) {
      const d = focus ? Math.hypot(focus.x - u.def.x, focus.z - u.def.z) : 0;
      u.mesh.visible = u.ring.visible = d < 1100;
      if (!u.mesh.visible) continue;
      u.mesh.rotation.y += dt * 0.6;
      u.ring.rotation.z -= dt * 0.8;
      if (d > 120) continue;
      if (Math.random() < dt * 20) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * u.def.radius;
        const y = u.base + Math.random() * (u.def.top - u.base);
        this.fx.add.emit({ x: u.def.x + Math.cos(a) * r, y, z: u.def.z + Math.sin(a) * r, vx: -Math.sin(a) * 3, vy: 9 + Math.random() * 6, vz: Math.cos(a) * 3, color: new THREE.Color('#dff8ff'), size: 0.35, life: 2, gravity: 0, drag: 0.2, alpha: 0.8 });
      }
    }
  }
}
