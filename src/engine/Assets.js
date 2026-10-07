import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { enhanceModelMaterial, cloneModelMaterial } from './ModelLook.js';

const BASE = './assets/';

const FILES = {
  anims: 'chars/anims.glb',
  knight: 'chars/knight.glb', barbarian: 'chars/barbarian.glb', mage: 'chars/mage.glb', rogue: 'chars/rogue.glb', rogue_hooded: 'chars/rogue_hooded.glb',
  skel_minion: 'chars/skel_minion.glb', skel_warrior: 'chars/skel_warrior.glb', skel_rogue: 'chars/skel_rogue.glb', skel_mage: 'chars/skel_mage.glb',
  nature: 'nature.glb', village: 'village.glb', dungeon: 'dungeon.glb', items: 'items.glb', halloween: 'halloween.glb', camp: 'camp.glb',
};
// Tailles approximatives (octets) pour une barre de progression fluide.
const SIZES = { anims: 1285444, knight: 268612, barbarian: 240248, mage: 218800, rogue: 239372, rogue_hooded: 228508, skel_minion: 226448, skel_warrior: 257908, skel_rogue: 231944, skel_mage: 194104, nature: 283888, village: 1921048, dungeon: 1014748, items: 421176, halloween: 740200, camp: 715392 };

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

  // Fichier binaire annexe (relief pré-calculé…) : ArrayBuffer, ou null s'il est absent.
  async loadBinary(file) {
    const b64 = typeof window !== 'undefined' && window.__AETHERIA_B64;
    try {
      const res = await fetch(BASE + file + (b64 ? '.txt' : ''));
      if (!res.ok) return null;
      if (!b64) return await res.arrayBuffer();
      const bin = atob((await res.text()).replace(/\s+/g, ''));
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out.buffer;
    } catch { return null; }
  }

  prepare() {
    for (const clip of this.gltf.anims.animations) {
      // animations sur place : on retire le déplacement racine des esquives
      if (/^Dodge_/.test(clip.name)) clip.tracks = clip.tracks.filter((t) => !/^root\.position/.test(t.name));
      clip.optimize();
      this.clips.set(clip.name, clip);
    }
    // les packs ajoutés portent un préfixe (hw_ : landes hantées, c_ : campements) pour éviter les homonymes
    const PREFIX = { halloween: 'hw_', camp: 'c_' };
    for (const lib of ['nature', 'village', 'dungeon', 'items', 'halloween', 'camp']) {
      const scene = this.gltf[lib].scene;
      for (const child of scene.children) {
        child.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true; o.receiveShadow = true;
            const m = o.material;
            if (m && m.map) { m.map.anisotropy = 4; }
            if (m) { m.roughness = Math.max(0.6, m.roughness ?? 1); m.metalness = Math.min(0.2, m.metalness ?? 0); }
            // armes et accessoires : reflets métalliques et liseré comme les personnages
            if (lib === 'items') for (const mm of [].concat(o.material)) enhanceModelMaterial(mm);
          }
        });
        this.props.set((PREFIX[lib] || '') + child.name, child);
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
            enhanceModelMaterial(m);
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
        const cl = (m) => { const c = cloneModelMaterial(m); c.userData.baseEmissive = c.emissive.clone(); c.userData.baseEmissiveIntensity = c.emissiveIntensity; return c; };
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

  // Contours au sol d'un modèle, en repère local (sans échelle) : enveloppes convexes des sommets
  // situés dans une tranche de hauteur [lo, hi] (fractions de la hauteur du modèle), regroupés
  // par amas (un bosquet de trois arbres donne trois troncs, pas un gros polygone).
  footprints(name, lo = 0.02, hi = 0.5, gapFrac = 0.07) {
    const key = `${name}|${lo}|${hi}|${gapFrac}`;
    this.hullCache ||= new Map();
    if (this.hullCache.has(key)) return this.hullCache.get(key);
    const g = this.propGeometry(name);
    let hulls = [];
    if (g) {
      const pos = g.geometry.attributes.position, box = g.box;
      const H = Math.max(1e-4, box.max.y - box.min.y);
      const ext = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, 1e-4);
      const y0 = box.min.y + H * lo, y1 = box.min.y + H * hi;
      // coupe des triangles dans la tranche : sommets inclus + croisements des arêtes avec ses plans
      // (un tronc low-poly n'a de sommets qu'à ses extrémités)
      let pts = [];
      const vx = [0, 0, 0], vy = [0, 0, 0], vz = [0, 0, 0];
      for (let t = 0; t + 2 < pos.count; t += 3) {
        for (let k = 0; k < 3; k++) { vx[k] = pos.getX(t + k); vy[k] = pos.getY(t + k); vz[k] = pos.getZ(t + k); }
        if (Math.max(vy[0], vy[1], vy[2]) < y0 || Math.min(vy[0], vy[1], vy[2]) > y1) continue;
        for (let k = 0; k < 3; k++) {
          const a = k, b = (k + 1) % 3;
          if (vy[a] >= y0 && vy[a] <= y1) pts.push([vx[a], vz[a]]);
          for (const yc of [y0, y1]) {
            if ((vy[a] - yc) * (vy[b] - yc) < 0) {
              const f = (yc - vy[a]) / (vy[b] - vy[a]);
              pts.push([vx[a] + (vx[b] - vx[a]) * f, vz[a] + (vz[b] - vz[a]) * f]);
            }
          }
        }
      }
      if (pts.length < 3) { pts = []; for (let i = 0; i < pos.count; i++) pts.push([pos.getX(i), pos.getZ(i)]); }
      // amas : cases occupées connexes
      const cell = ext * gapFrac;
      const cells = new Map();
      for (const p of pts) {
        const k = Math.floor(p[0] / cell) + ',' + Math.floor(p[1] / cell);
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(p);
      }
      const seen = new Set();
      for (const k of cells.keys()) {
        if (seen.has(k)) continue;
        const stack = [k], group = [];
        seen.add(k);
        while (stack.length) {
          const c = stack.pop();
          group.push(...cells.get(c));
          const [ci, cj] = c.split(',').map(Number);
          for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
            const nk = (ci + di) + ',' + (cj + dj);
            if (cells.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(nk); }
          }
        }
        const hull = simplifyHull(convexHull(group), 12);
        if (hull.length >= 3 && polyArea(hull) > ext * ext * 0.0015) hulls.push(hull);
      }
      if (!hulls.length) hulls = [simplifyHull(convexHull(pts), 12)];
    }
    this.hullCache.set(key, hulls);
    return hulls;
  }

  propBox(name) {
    const g = this.propGeometry(name);
    return g ? g.box : new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
  }
}

// Enveloppe convexe 2D (chaîne monotone d'Andrew), sens trigonométrique.
function convexHull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

function polyArea(h) {
  let a = 0;
  for (let i = 0; i < h.length; i++) { const p = h[i], q = h[(i + 1) % h.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a) / 2;
}

// Réduit le nombre de sommets en retirant ceux qui comptent le moins (aire du triangle).
function simplifyHull(h, max) {
  h = h.slice();
  while (h.length > max) {
    let bi = 0, ba = Infinity;
    for (let i = 0; i < h.length; i++) {
      const a = h[(i - 1 + h.length) % h.length], b = h[i], c = h[(i + 1) % h.length];
      const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]));
      if (area < ba) { ba = area; bi = i; }
    }
    h.splice(bi, 1);
  }
  return h;
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
