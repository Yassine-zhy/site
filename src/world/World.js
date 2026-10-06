import * as THREE from 'three';
import { Terrain } from './Terrain.js';
import { Sky } from './Sky.js';
import { Clouds } from './Clouds.js';
import { Water } from './Water.js';
import { Grass } from './Grass.js';
import { Maps, applyCorruption } from './Maps.js';
import { Vegetation } from './Vegetation.js';
import { Village } from './Village.js';
import { Outposts } from './Outposts.js';
import { Colliders } from './Colliders.js';
import { EnvLight, updateRim } from '../engine/ModelLook.js';
import { LightPool } from './Lights.js';

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
    const step = async (s) => { onStep?.(s); await yieldFrame(); };
    await step('Façonnage des îles flottantes…');
    this.terrain = new Terrain();
    this.colliders = new Colliders();
    await step('Cartographie de la Brume…');
    this.maps = new Maps(this.terrain, quality.grass > 20000 ? 384 : 256);

    await step('Élévation de l’archipel…');
    this.terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.95, metalness: 0 });
    applyCorruption(this.terrainMat, this.maps, 1);
    this.underMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 });
    this.islandMeshes = [];
    for (const isl of this.terrain.islands) this.addIslandMeshes(isl);

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
    await step('Les herbes poussent…');
    this.grass = new Grass(this.scene, this.maps, quality.grass, quality.grassRadius);
    await step('Les forêts murmurent…');
    this.vegetation = new Vegetation(this.scene, assets, this.terrain, this.colliders, this.maps, quality.trees);
    this.vegetation.setViewDistance(quality.vegView);
    await step('Havrelumière se construit…');
    this.village = new Village(this.scene, assets, this.terrain, this.colliders, this.maps);
    await step('Les campements s’allument…');
    this.outposts = new Outposts(this.scene, assets, this.terrain, this.colliders);
    this.elapsed = 0;
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
    for (const g of isl.chunkGeometries()) {
      const top = new THREE.Mesh(g, this.terrainMat);
      top.receiveShadow = true; top.castShadow = true;
      this.scene.add(top);
      this.islandMeshes.push(top);
    }
    const under = new THREE.Mesh(isl.underGeometry, this.underMat);
    under.receiveShadow = false; under.castShadow = false;
    this.scene.add(under);
    this.islandMeshes.push(under);
  }

  setQuality(q) {
    this.quality = q;
    this.vegetation.setViewDistance(q.vegView);
    this.grass.build(q.grass, q.grassRadius);
    this.sky.setShadowSize(q.shadowSize, q.shadowSize >= 2048 ? 75 : 60);
    this.lightPool.setSize(q.lights ?? 6);
  }

  update(dt, focus, camera, pushers) {
    this.elapsed += dt;
    const e = this.elapsed;
    const st = this.sky.update(dt, focus, e);
    this.env.update(dt);
    updateRim(this.sky);
    this.clouds.update(dt, e, this.sky, camera);
    this.water.update(dt, e, this.sky);
    this.grass.update(dt, e, focus, pushers, this.sky);
    this.vegetation.update(dt, e, this.playerFocus || focus, camera);
    this.village.update(dt, e, st.night);
    this.outposts?.update(dt, e, st.night);
    if (focus) this.lightPool.update(focus);
    return st;
  }
}
