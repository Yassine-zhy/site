import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VirtualLight } from './Lights.js';
import { decorMaterial } from './SurfaceDetail.js';

const BSCALE = 7;

// Décors posés à la main (bâtiments, objets, lanternes) avec leurs contours de collision.
// Une fois tout placé, mergeStatic() fusionne les maillages immobiles par matériau.
const _wp = new THREE.Vector3();

export class Decor {
  constructor(scene, assets, terrain, colliders, name = 'decor') {
    this.scene = scene; this.assets = assets; this.terrain = terrain; this.colliders = colliders;
    this.group = new THREE.Group();
    this.group.name = name;
    scene.add(this.group);
    this.lights = [];
    this.flames = [];
    this.keep = new Set();
    this.fallbackY = 14;
  }

  // Fusionne les décors immobiles par matériau et par case de 64 m : peu d'appels de rendu,
  // et les cases hors champ (ou loin de l'ombre du joueur) ne sont pas dessinées.
  mergeStatic(cell = 64) {
    const g = this.group;
    g.updateMatrixWorld(true);
    const keep = new Set();
    if (this.windmillBlades) keep.add(this.windmillBlades);
    for (const f of this.flames) keep.add(f);
    for (const k of this.keep) keep.add(k);
    const byMat = new Map();
    const remove = [];
    g.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || keep.has(o)) return;
      if (Array.isArray(o.material)) return;
      const geo = o.geometry.clone();
      for (const key of Object.keys(geo.attributes)) {
        const a = geo.attributes[key];
        if (a.isInterleavedBufferAttribute || a.normalized || !(a.array instanceof Float32Array)) {
          const arr = new Float32Array(a.count * a.itemSize);
          for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = a.getComponent(i, k);
          geo.setAttribute(key, new THREE.BufferAttribute(arr, a.itemSize));
        }
      }
      for (const key of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(key)) geo.deleteAttribute(key);
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      if (!geo.attributes.normal) geo.computeVertexNormals();
      geo.applyMatrix4(o.matrixWorld);
      const ng = geo.index ? geo.toNonIndexed() : geo;
      const wp = o.getWorldPosition(_wp);
      const key = o.material.uuid + '|' + Math.floor(wp.x / cell) + ',' + Math.floor(wp.z / cell);
      if (!byMat.has(key)) byMat.set(key, { mat: o.material, list: [] });
      byMat.get(key).list.push(ng);
      remove.push(o);
    });
    for (const o of remove) o.removeFromParent();
    for (const { mat, list } of byMat.values()) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, decorMaterial(mat));
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
      // liste partagée : le monde masque les décors trop lointains
      (this.scene.userData.staticMeshes = this.scene.userData.staticMeshes || []).push(m);
    }
    // les objets restants (pales, flammes, lumières) restent dans le groupe
  }

  ground(x, z) { return this.terrain.heightAt(x, z) ?? this.fallbackY; }

  // contours au sol d'un modèle à l'échelle s
  hulls(name, s, lo, hi, gap) { return this.assets.footprints(name, lo, hi, gap).map((h) => h.map(([x, z]) => [x * s, z * s])); }

  placeBuilding(b) {
    const obj = this.assets.prop(b.name);
    const y = this.ground(b.x, b.z);
    const face = b.face || [b.cx ?? 0, b.cz ?? 0];
    const rot = Math.atan2(face[0] - b.x, face[1] - b.z);
    obj.position.set(b.x, y - 0.2, b.z);
    obj.rotation.y = rot;
    obj.scale.setScalar(b.s || BSCALE);
    this.group.add(obj);
    const box = this.assets.propBox(b.name);
    const s = b.s || BSCALE;
    // contour réel des murs (tranche basse du modèle, sans les débords de toit)
    this.colliders.addFootprint(this.hulls(b.name, s, 0.02, 0.4, 3), b.x, b.z, rot, y - 2, y + box.max.y * s, 'building');
    if (b.name === 'building_windmill') {
      obj.traverse((o) => { if (!this.windmillBlades && o.isMesh && /blade|wing|sail/i.test(o.name)) this.windmillBlades = o; });
    }
    return obj;
  }

  placeProp(name, x, z, s, r, yoff = 0, collide = true) {
    const obj = this.assets.prop(name);
    const y = this.ground(x, z);
    obj.position.set(x, y + yoff - 0.05, z);
    obj.rotation.y = r;
    obj.scale.setScalar(s);
    this.group.add(obj);
    if (collide) {
      const box = this.assets.propBox(name);
      const top = y + yoff + box.max.y * s;
      // objets bas (caisses, tonneaux...) : on peut monter dessus
      this.colliders.addFootprint(this.hulls(name, s, 0.02, 0.8, 3), x, z, r, y - 1, top, 'prop', top - y < 3.2 && !/tent|rack|target|flag/.test(name));
    }
    return obj;
  }

  placeLantern(x, z, withLight) {
    const y = this.ground(x, z);
    this.postMat = this.postMat || new THREE.MeshStandardMaterial({ color: '#5b3d26', roughness: 0.9 });
    this.postGeo = this.postGeo || new THREE.CylinderGeometry(0.12, 0.16, 3.2, 6);
    const post = new THREE.Mesh(this.postGeo, this.postMat);
    post.position.set(x, y + 1.6, z);
    post.castShadow = true;
    this.group.add(post);
    const torch = this.assets.prop('torch_lit');
    torch.position.set(x, y + 3.35, z);
    torch.scale.setScalar(0.9);
    this.group.add(torch);
    this.glowMat = this.glowMat || new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347').multiplyScalar(4), toneMapped: false });
    this.glowGeo = this.glowGeo || new THREE.SphereGeometry(0.28, 10, 8);
    const glow = new THREE.Mesh(this.glowGeo, this.glowMat);
    glow.position.set(x, y + 3.9, z);
    this.group.add(glow);
    this.flames.push(glow);
    this.colliders.addCircle(x, z, 0.35, y - 1, y + 4, 'prop');
    if (withLight) {
      const l = new VirtualLight('#ffb35c', 0, 22, 1.6);
      l.position.set(x, y + 4.2, z);
      this.group.add(l);
      this.lights.push(l);
    }
  }

  // ponts de corde (planches instanciées, cordes, poteaux, rambardes)
  buildBridges(list) {
    const plank = new THREE.MeshStandardMaterial({ color: '#8a5a34', roughness: 0.9, flatShading: true });
    const rope = new THREE.MeshStandardMaterial({ color: '#c9a777', roughness: 1 });
    for (const b of list) {
      const n = Math.ceil(b.len / 0.9);
      const dir = Math.atan2(b.bx - b.ax, b.bz - b.az);
      const geo = new THREE.BoxGeometry(b.width, 0.16, 0.7);
      const inst = new THREE.InstancedMesh(geo, plank, n);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
      const pts = [[], []];
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = b.ax + (b.bx - b.ax) * t, z = b.az + (b.bz - b.az) * t;
        const y = b.ha + (b.hb - b.ha) * t - Math.sin(t * Math.PI) * b.sag - 0.08;
        q.setFromEuler(new THREE.Euler(0, dir + (Math.random() - 0.5) * 0.05, 0));
        v.set(x, y, z); m.compose(v, q, sc); inst.setMatrixAt(i, m);
      }
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const x = b.ax + (b.bx - b.ax) * t, z = b.az + (b.bz - b.az) * t;
        const y = b.ha + (b.hb - b.ha) * t - Math.sin(t * Math.PI) * b.sag * 0.85 + 1.1;
        const ox = Math.cos(dir) * b.width * 0.5, oz = -Math.sin(dir) * b.width * 0.5;
        pts[0].push(new THREE.Vector3(x + ox, y, z + oz));
        pts[1].push(new THREE.Vector3(x - ox, y, z - oz));
      }
      inst.castShadow = true; inst.receiveShadow = true;
      this.group.add(inst);
      // rambardes : on ne tombe pas du pont par mégarde
      const cx = (b.ax + b.bx) / 2, cz = (b.az + b.bz) / 2;
      for (const sgn of [-1, 1]) {
        const ox = Math.cos(dir) * (b.width * 0.5 + 0.1) * sgn, oz = -Math.sin(dir) * (b.width * 0.5 + 0.1) * sgn;
        this.colliders.addBox(cx + ox, cz + oz, 0.1, b.len / 2, dir, Math.min(b.ha, b.hb) - b.sag - 1, Math.max(b.ha, b.hb) + 2.5, 'rail');
      }
      for (const p of pts) {
        const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p), 48, 0.06, 5, false), rope);
        this.group.add(tube);
      }
      // poteaux
      for (const [x, z, h] of [[b.ax, b.az, b.ha], [b.bx, b.bz, b.hb]]) {
        for (const sgn of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.4, 6), plank);
          post.position.set(x + Math.cos(dir) * b.width * 0.5 * sgn, h + 0.9, z - Math.sin(dir) * b.width * 0.5 * sgn);
          this.group.add(post);
        }
      }
    }
  }

  // Feu de camp : bûches, flammes vivantes et une lumière chaude (toujours un peu allumée).
  placeBonfire(x, z, scale = 1) {
    const y = this.ground(x, z);
    this.logMat = this.logMat || new THREE.MeshStandardMaterial({ color: '#5b3a22', roughness: 0.95, flatShading: true });
    this.logGeo = this.logGeo || new THREE.CylinderGeometry(0.16, 0.2, 2.1, 6);
    for (let i = 0; i < 5; i++) {
      const log = new THREE.Mesh(this.logGeo, this.logMat);
      const a = i / 5 * Math.PI * 2;
      log.position.set(x + Math.cos(a) * 0.5 * scale, y + 0.35, z + Math.sin(a) * 0.5 * scale);
      log.rotation.set(Math.PI / 2 - 0.5, 0, 0); log.rotation.y = a + Math.PI / 2;
      log.scale.setScalar(scale);
      log.castShadow = true;
      this.group.add(log);
    }
    this.stoneGeo = this.stoneGeo || new THREE.DodecahedronGeometry(0.32, 0);
    this.stoneMat = this.stoneMat || new THREE.MeshStandardMaterial({ color: '#8b857c', roughness: 0.9, flatShading: true });
    for (let i = 0; i < 9; i++) {
      const st = new THREE.Mesh(this.stoneGeo, this.stoneMat);
      const a = i / 9 * Math.PI * 2;
      st.position.set(x + Math.cos(a) * 1.25 * scale, y + 0.1, z + Math.sin(a) * 1.25 * scale);
      st.scale.set(scale, scale * 0.7, scale);
      this.group.add(st);
    }
    this.fireMat = this.fireMat || new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a3c').multiplyScalar(3), transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
    this.fireGeo = this.fireGeo || new THREE.ConeGeometry(0.45, 1.6, 7, 1, true);
    const flames = [];
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(this.fireGeo, this.fireMat);
      f.position.set(x + (i - 1) * 0.22 * scale, y + 0.9 * scale, z + ((i % 2) - 0.5) * 0.2 * scale);
      f.scale.setScalar(scale * (1 - i * 0.18));
      this.group.add(f);
      this.keep.add(f);
      flames.push(f);
    }
    (this.fires ||= []).push({ flames, x, y, z, scale });
    const l = new VirtualLight('#ff9a4c', 14, 26, 1.5);
    l.position.set(x, y + 2, z);
    this.group.add(l);
    (this.fireLights ||= []).push(l);
    this.colliders.addCircle(x, z, 1.2 * scale, y - 1, y + 0.6, 'prop', true);
    return { x, y, z };
  }

  update(dt, elapsed, night) {
    if (this.fires) {
      for (const f of this.fires) f.flames.forEach((m, i) => { const k = 1 + Math.sin(elapsed * (9 + i * 3) + i) * 0.12 + Math.sin(elapsed * 17 + i) * 0.06; m.scale.set(f.scale * (1 - i * 0.18), f.scale * (1 - i * 0.18) * k, f.scale * (1 - i * 0.18)); m.rotation.y = elapsed * (1 + i); });
      for (const l of this.fireLights) l.intensity = (8 + night * 22) * (0.85 + Math.sin(elapsed * 11.3) * 0.1 + Math.sin(elapsed * 23.1) * 0.05);
    }
    const flick = 0.85 + Math.sin(elapsed * 13.1) * 0.08 + Math.sin(elapsed * 7.3) * 0.07;
    for (const l of this.lights) l.intensity = night * 26 * flick;
    for (const f of this.flames) f.scale.setScalar(0.6 + night * 0.7 * flick);
  }
}
