import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const BASE = './assets/';

const FILES = {
  anims: 'chars/anims.glb',
  knight: 'chars/knight.glb', barbarian: 'chars/barbarian.glb', mage: 'chars/mage.glb', rogue: 'chars/rogue.glb', rogue_hooded: 'chars/rogue_hooded.glb',
  skel_minion: 'chars/skel_minion.glb', skel_warrior: 'chars/skel_warrior.glb', skel_rogue: 'chars/skel_rogue.glb', skel_mage: 'chars/skel_mage.glb',
  nature: 'nature.glb', village: 'village.glb', dungeon: 'dungeon.glb', items: 'items.glb',
};
// Tailles approximatives (octets) pour une barre de progression fluide.
const SIZES = { anims: 1285444, knight: 268612, barbarian: 240248, mage: 218800, rogue: 239372, rogue_hooded: 228508, skel_minion: 226448, skel_warrior: 257908, skel_rogue: 231944, skel_mage: 194104, nature: 283888, village: 1921048, dungeon: 1014748, items: 421176 };

// Chargement et registre des modèles 3D (KayKit, CC0).
export class Assets {
  constructor() {
    this.loader = new GLTFLoader();
    // Images décodées via <img> (plus robuste que createImageBitmap sur certains navigateurs)
    this.loader.register((parser) => {
      parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
      parser.textureLoader.setCrossOrigin('anonymous');
      return { name: 'aetheria_texture_loader' };
    });
    this.gltf = {};
    this.clips = new Map();
    this.props = new Map();
    this.geoCache = new Map();
    this.charMaterials = new Map();
  }

  async load(onProgress) {
    const keys = Object.keys(FILES);
    const loaded = {};
    const total = keys.reduce((s, k) => s + SIZES[k], 0);
    const report = () => {
      const sum = keys.reduce((s, k) => s + Math.min(loaded[k] || 0, SIZES[k]), 0);
      onProgress?.(sum / total);
    };
    // Hébergement en page unique : les modèles sont publiés en base64 (.glb.txt) puis décodés ici.
    const b64 = typeof window !== 'undefined' && window.__AETHERIA_B64;
    const fetchBinary = async (url, onBytes) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (!res.body || !res.body.getReader) return new Uint8Array(await res.arrayBuffer());
      const reader = res.body.getReader();
      const chunks = []; let n = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); n += value.length; onBytes(n); }
      const out = new Uint8Array(n); let o = 0;
      for (const c of chunks) { out.set(c, o); o += c.length; }
      return out;
    };
    const decodeB64 = (bytes) => {
      const text = new TextDecoder().decode(bytes).replace(/\s+/g, '');
      const bin = atob(text);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out.buffer;
    };
    const accept = (k, g, attempt, resolve, reject) => {
      // vérifie que les textures sont bien décodées, sinon on recharge
      let missing = false;
      g.scene.traverse((o) => { if (o.isMesh && o.material && o.material.map === null && /texture|skeleton|hexagon|dungeon/i.test(o.material.name)) missing = true; });
      if (missing && attempt < 3) { setTimeout(() => loadOne(k, attempt + 1).then(resolve, reject), 300); return; }
      loaded[k] = SIZES[k]; report(); this.gltf[k] = g; resolve();
    };
    const loadOne = (k, attempt = 0) => new Promise((resolve, reject) => {
      const fail = (err) => {
        if (attempt < 3) setTimeout(() => loadOne(k, attempt + 1).then(resolve, reject), 400 * (attempt + 1));
        else reject(new Error('Impossible de charger ' + FILES[k] + ' : ' + (err?.message || err)));
      };
      if (b64) {
        fetchBinary(BASE + FILES[k] + '.txt', (n) => { loaded[k] = Math.min(SIZES[k], n * 0.75); report(); })
          .then((bytes) => this.loader.parse(decodeB64(bytes), BASE, (g) => accept(k, g, attempt, resolve, reject), fail))
          .catch(fail);
        return;
      }
      this.loader.load(BASE + FILES[k], (g) => accept(k, g, attempt, resolve, reject),
        (e) => { loaded[k] = e.loaded; report(); }, fail);
    });
    await Promise.all(keys.map((k) => loadOne(k)));
    this.prepare();
  }

  prepare() {
    for (const clip of this.gltf.anims.animations) {
      // animations sur place : on retire le déplacement racine des esquives
      if (/^Dodge_/.test(clip.name)) clip.tracks = clip.tracks.filter((t) => !/^root\.position/.test(t.name));
      clip.optimize();
      this.clips.set(clip.name, clip);
    }
    for (const lib of ['nature', 'village', 'dungeon', 'items']) {
      const scene = this.gltf[lib].scene;
      for (const child of scene.children) {
        child.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true; o.receiveShadow = true;
            const m = o.material;
            if (m && m.map) { m.map.anisotropy = 4; }
            if (m) { m.roughness = Math.max(0.6, m.roughness ?? 1); m.metalness = Math.min(0.2, m.metalness ?? 0); }
          }
        });
        this.props.set(child.name, child);
      }
    }
    for (const k of ['knight', 'barbarian', 'mage', 'rogue', 'rogue_hooded', 'skel_minion', 'skel_warrior', 'skel_rogue', 'skel_mage']) {
      const scene = this.gltf[k].scene;
      mergeSkinned(scene);
      scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true; o.receiveShadow = false;
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of ms) {
            if (!m) continue;
            m.roughness = 0.85; m.metalness = 0; if (m.map) m.map.anisotropy = 4;
            if (m.name === 'Glow') { m.emissive = new THREE.Color('#7af0ff'); m.emissiveIntensity = 3.0; }
          }
        }
      });
    }
  }

  clip(name) { return this.clips.get(name); }

  // Clone indépendant d'un personnage animé (squelette inclus).
  character(model) {
    const src = this.gltf[model].scene;
    const obj = skeletonClone(src);
    obj.traverse((o) => {
      if (o.isMesh) {
        const cl = (m) => { const c = m.clone(); c.userData.baseEmissive = c.emissive.clone(); c.userData.baseEmissiveIntensity = c.emissiveIntensity; return c; };
        o.material = Array.isArray(o.material) ? o.material.map(cl) : cl(o.material);
      }
    });
    return obj;
  }

  prop(name) {
    const src = this.props.get(name);
    if (!src) { console.warn('Prop inconnu', name); return new THREE.Object3D(); }
    return src.clone(true);
  }

  // Géométrie fusionnée (coordonnées locales du prop) + matériau pour l'instanciation.
  propGeometry(name) {
    if (this.geoCache.has(name)) return this.geoCache.get(name);
    const src = this.props.get(name);
    if (!src) return null;
    src.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(src.matrixWorld).invert();
    const groups = new Map();
    src.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone();
      // dé-quantification éventuelle : on travaille en Float32
      for (const key of Object.keys(g.attributes)) {
        const a = g.attributes[key];
        if (a.isInterleavedBufferAttribute || a.normalized || !(a.array instanceof Float32Array)) {
          const arr = new Float32Array(a.count * a.itemSize);
          for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = a.getComponent ? a.getComponent(i, k) : a.array[i * a.itemSize + k];
          g.setAttribute(key, new THREE.BufferAttribute(arr, a.itemSize));
        }
      }
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      g.applyMatrix4(m);
      for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      const mat = o.material;
      if (!groups.has(mat)) groups.set(mat, []);
      groups.get(mat).push(g.index ? g.toNonIndexed() : g);
    });
    const entries = [...groups.entries()];
    const geos = entries.map(([, list]) => mergeGeometries(list, false));
    const geometry = geos.length === 1 ? geos[0] : mergeGeometries(geos, true);
    const materials = entries.map(([m]) => m);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const res = { geometry, material: materials.length === 1 ? materials[0] : materials, box: geometry.boundingBox };
    this.geoCache.set(name, res);
    return res;
  }

  propBox(name) {
    const g = this.propGeometry(name);
    return g ? g.box : new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
  }
}

// Fusionne les morceaux d'un personnage (bras, corps, tête, jambes...) en un seul maillage
// animé partageant un squelette unique : beaucoup moins d'appels de rendu et de squelettes.
function toFloat(attr) {
  const arr = new Float32Array(attr.count * attr.itemSize);
  for (let i = 0; i < attr.count; i++) for (let k = 0; k < attr.itemSize; k++) arr[i * attr.itemSize + k] = attr.getComponent(i, k);
  return arr;
}

export function mergeSkinned(scene) {
  scene.updateMatrixWorld(true);
  const skinned = [];
  scene.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
  if (skinned.length < 2) return;
  const boneSet = new Map();
  const bones = [];
  for (const m of skinned) for (const b of m.skeleton.bones) if (!boneSet.has(b)) { boneSet.set(b, bones.length); bones.push(b); }
  const inverses = bones.map((b) => new THREE.Matrix4().copy(b.matrixWorld).invert());
  const byMat = new Map();
  const Q = new THREE.Matrix4(), N = new THREE.Matrix3(), v = new THREE.Vector3();
  for (const m of skinned) {
    const sk = m.skeleton;
    Q.multiplyMatrices(sk.bones[0].matrixWorld, sk.boneInverses[0]).multiply(m.bindMatrix);
    N.getNormalMatrix(Q);
    const g = m.geometry;
    const pos = toFloat(g.attributes.position);
    for (let i = 0; i < pos.length; i += 3) { v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(Q); pos[i] = v.x; pos[i + 1] = v.y; pos[i + 2] = v.z; }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    if (g.attributes.normal) {
      const nor = toFloat(g.attributes.normal);
      for (let i = 0; i < nor.length; i += 3) { v.set(nor[i], nor[i + 1], nor[i + 2]).applyMatrix3(N).normalize(); nor[i] = v.x; nor[i + 1] = v.y; nor[i + 2] = v.z; }
      out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    }
    out.setAttribute('uv', new THREE.BufferAttribute(g.attributes.uv ? toFloat(g.attributes.uv) : new Float32Array(pos.length / 3 * 2), 2));
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const idx = new Uint16Array(si.count * 4), wts = new Float32Array(si.count * 4);
    for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) { idx[i * 4 + k] = boneSet.get(sk.bones[si.getComponent(i, k)]) ?? 0; wts[i * 4 + k] = sw.getComponent(i, k); }
    out.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
    out.setAttribute('skinWeight', new THREE.BufferAttribute(wts, 4));
    if (g.index) out.setIndex(Array.from(g.index.array));
    const key = m.material;
    if (!byMat.has(key)) byMat.set(key, []);
    byMat.get(key).push(out.index ? out.toNonIndexed() : out);
  }
  const mats = [...byMat.keys()];
  const merged = mats.map((mat) => mergeGeometries(byMat.get(mat), false));
  const geo = merged.length === 1 ? merged[0] : mergeGeometries(merged, true);
  const parent = skinned[0].parent;
  const mesh = new THREE.SkinnedMesh(geo, mats.length === 1 ? mats[0] : mats);
  mesh.name = 'Body';
  parent.add(mesh);
  for (const m of skinned) m.removeFromParent();
  const skeleton = new THREE.Skeleton(bones, inverses);
  mesh.bind(skeleton, new THREE.Matrix4());
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.2, 0), 2.4);
  mesh.frustumCulled = true;
}
