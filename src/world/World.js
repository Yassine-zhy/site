import * as THREE from 'three';
import { Terrain } from './Terrain.js';
import { TerrainRenderer, makeTerrainTextures } from './TerrainRenderer.js';
import { Ocean } from './Ocean.js';
import { Sky } from './Sky.js';
import { Clouds } from './Clouds.js';
import { Water } from './Water.js';
import { Grass } from './Grass.js';
import { Maps, applyCorruption } from './Maps.js';
import { Vegetation } from './Vegetation.js';
import { Village } from './Village.js';
import { Outposts } from './Outposts.js';
import { Interiors } from './Interiors.js';
import { Colliders } from './Colliders.js';
import { EnvLight, updateRim } from '../engine/ModelLook.js';
import { LightPool } from './Lights.js';
import { Ambient } from '../fx/Ambient.js';
import { Updrafts } from './Updrafts.js';
import { UPDRAFTS } from '../config.js';

// Le monde d'Aetheria : îles, ciel, eau, végétation, village.
export class World {
  constructor(renderer, assets, quality) {
    this.renderer = renderer;
    this.scene = renderer.scene;
    this.assets = assets;
    this.quality = quality;
  }

  async init(onStep) {
    const { renderer, assets, quality } = this;
    const yieldFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const perf = new URLSearchParams(location.search).has('perf');
    let tPrev = performance.now(), sPrev = 'début';
    const step = async (s) => {
      if (perf) { const t = performance.now(); console.log(`[perf] ${sPrev} : ${Math.round(t - tPrev)} ms`); tPrev = t; sPrev = s; }
      onStep?.(s); await yieldFrame();
    };
    this.perfDone = () => { if (perf) console.log(`[perf] ${sPrev} : ${Math.round(performance.now() - tPrev)} ms`); };
    await step('Façonnage du continent…');
    this.terrain = new Terrain(assets.bakedTerrain);
    assets.bakedTerrain = null;
    for (const u of UPDRAFTS) Updrafts.anchor(u, this.terrain); // avant la végétation et les quêtes
    this.colliders = new Colliders();
    await step('Cartographie de la Brume…');
    this.maps = new Maps();

    await step('Les montagnes se dressent…');
    this.terrainTex = makeTerrainTextures(this.terrain, renderer.qualityName);
    this.terrainRenderer = new TerrainRenderer(this.scene, this.terrain, this.terrainTex, this.maps, { quality: renderer.qualityName, detail: quality.terrainDetail ?? 1 });
    // îles flottantes ajoutées ensuite (Citadelle) : maillages classiques
    this.terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.95, metalness: 0 });
    applyCorruption(this.terrainMat, this.maps, 1);
    this.underMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 });
    this.islandMeshes = [];
    this.farCull = [];

    await step('Le ciel s’éveille…');
    this.sky = new Sky(this.scene);
    this.sky.setShadowSize(quality.shadowSize, quality.shadowSize >= 2048 ? 75 : 60);
    // reflets et lumière ambiante des modèles 3D : le ciel courant, préfiltré
    this.lightPool = new LightPool(this.scene, quality.lights ?? 6);
    this.sky.update(0, null, 0);
    this.env = new EnvLight(renderer.renderer, this.sky);
    this.env.update(0);
    updateRim(this.sky);
    this.clouds = new Clouds(this.scene, assets, renderer.qualityName);
    this.water = new Water(this.scene, this.terrain);
    this.ocean = new Ocean(this.scene, this.terrainTex);
    this.ambient = new Ambient(this.scene, 900);
    this.ambient.setCount(quality.particles ?? 600);
    await step('Les herbes poussent…');
    this.grass = new Grass(this.scene, this.maps, this.terrainTex, quality.grass, quality.grassRadius);
    await step('Les forêts murmurent…');
    this.vegetation = new Vegetation(this.scene, assets, this.terrain, this.colliders, this.maps, quality.trees);
    this.vegetation.setViewDistance(quality.vegView);
    await step('Havrelumière se construit…');
    this.village = new Village(this.scene, assets, this.terrain, this.colliders, this.maps);
    await step('Les campements s’allument…');
    this.outposts = new Outposts(this.scene, assets, this.terrain, this.colliders);
    await step('On allume les cheminées…');
    this.interiors = new Interiors(this.scene, assets, this.terrain, this.colliders);
    // flammes, lumières et pales restés hors fusion : masqués au loin
    this.cullFar(this.village.group, 1, true);
    this.cullFar(this.outposts.group, 1, true);
    this.elapsed = 0;
    this.perfDone();
    if (new URLSearchParams(location.search).get('colliders')) this.debugColliders();
    return this;
  }

  // ?colliders=1 : affiche les contours de collision (mise au point)
  debugColliders() {
    const pts = [];
    for (const c of this.colliders.all) {
      const gy = (this.terrain.heightAt(c.x, c.z) ?? 0) + 0.6;
      const ring = [];
      if (c.type === 'circle') for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; ring.push([c.x + Math.cos(a) * c.r, c.z + Math.sin(a) * c.r]); }
      else for (let i = 0; i < c.n; i++) ring.push([c.xs[i], c.zs[i]]);
      for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; pts.push(a[0], gy, a[1], b[0], gy, b[1]); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xff2266, depthTest: false, toneMapped: false }));
    lines.renderOrder = 99;
    this.scene.add(lines);
  }

  // île ajoutée après le chargement (Citadelle des expéditions)
  addIsland(isl) {
    this.terrain.islands.push(isl);
    this.addIslandMeshes(isl);
  }

  addIslandMeshes(isl) {
    this.terrainChunks = this.terrainChunks || [];
    for (const ch of isl.chunkGeometries()) {
      const top = new THREE.Mesh(ch.lods[0], this.terrainMat);
      top.receiveShadow = true; top.castShadow = true;
      this.scene.add(top);
      this.islandMeshes.push(top);
      this.terrainChunks.push({ mesh: top, lods: ch.lods, c: ch.sphere.center, r: ch.sphere.radius, lod: 0 });
    }
    const under = new THREE.Mesh(isl.underGeometry, this.underMat);
    under.receiveShadow = false; under.castShadow = false;
    this.scene.add(under);
    this.islandMeshes.push(under);
  }

  setQuality(q) {
    this.quality = q;
    this.vegetation.setViewDistance(q.vegView);
    this.ambient.setCount(q.particles ?? 600);
    this.grass.build(q.grass, q.grassRadius);
    this.sky.setShadowSize(q.shadowSize, q.shadowSize >= 2048 ? 75 : 60);
    this.lightPool.setSize(q.lights ?? 6);
  }

  // Niveau de détail du relief et visibilité des décors lointains, selon la distance à la caméra.
  updateLod(camera) {
    const cp = camera.position;
    const q = this.quality || {};
    const near = q.terrainNear ?? 180, mid = q.terrainMid ?? 420;
    for (const ch of this.terrainChunks || []) {
      const d = Math.max(0, Math.hypot(ch.c.x - cp.x, ch.c.z - cp.z) - ch.r);
      const lod = d < near ? 0 : d < mid ? 1 : 2;
      if (lod !== ch.lod) { ch.lod = lod; ch.mesh.geometry = ch.lods[lod]; ch.mesh.castShadow = lod === 0; }
    }
    const far = q.decorView ?? 650;
    for (const m of this.scene.userData.staticMeshes || []) {
      const s = m.geometry.boundingSphere;
      m.visible = Math.hypot(s.center.x - cp.x, s.center.z - cp.z) - s.radius < far;
    }
    // objets inscrits pour disparaître au loin : [objet, facteur de la distance des décors]
    for (const [o, k] of this.farCull) {
      const wp = o.userData.cullPos || o.position;
      o.visible = Math.hypot(wp.x - cp.x, wp.z - cp.z) < far * k;
    }
  }

  // inscrit un objet (ou ses enfants) pour qu'il soit masqué au-delà de k × distance des décors
  cullFar(o, k = 1, children = false) {
    if (children) { o.updateMatrixWorld(true); for (const c of [...o.children]) { c.userData.cullPos = c.getWorldPosition(new THREE.Vector3()); this.farCull.push([c, k]); } return; }
    this.farCull.push([o, k]);
  }

  update(dt, focus, camera, pushers) {
    this.elapsed += dt;
    const e = this.elapsed;
    this.lodT = (this.lodT || 0) - dt;
    if (camera && this.lodT <= 0) { this.lodT = 0.25; this.updateLod(camera); }
    if (camera) this.terrainRenderer.update(camera);
    if (focus) {
      // ambiance régionale (brume des Landes et du Marais, moiteur de la Canopée et des Récifs)
      const b = focus.x < 3000 ? this.terrain.regionAt(focus.x, focus.z).biome : null;
      this.sky.region.haunted = b === 'haunted' ? 1 : b === 'swamp' ? 0.5 : 0;
      this.sky.region.jungle = b === 'jungle' ? 1 : b === 'beach' ? 0.25 : 0;
      this.region = b;
      this.ambient.biome = b;
    }
    const st = this.sky.update(dt, focus, e);
    this.env.update(dt);
    updateRim(this.sky);
    this.clouds.update(dt, e, this.sky, camera);
    this.water.update(dt, e, this.sky);
    this.ocean.update(dt, e, this.sky, camera);
    this.grass.update(dt, e, focus, pushers, this.sky);
    this.vegetation.update(dt, e, this.playerFocus || focus, camera);
    this.village.update(dt, e, st.night);
    this.outposts?.update(dt, e, st.night);
    this.interiors?.update(dt, e);
    if (focus) this.lightPool.update(focus);
    if (camera) this.ambient.update(dt, e, camera, this.playerFocus || focus, st.night, this.renderer.renderer.domElement.height);
    return st;
  }
}
