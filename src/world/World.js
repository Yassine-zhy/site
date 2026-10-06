import * as THREE from 'three';
import { Terrain } from './Terrain.js';
import { Sky } from './Sky.js';
import { Clouds } from './Clouds.js';
import { Water } from './Water.js';
import { Grass } from './Grass.js';
import { Maps, applyCorruption } from './Maps.js';
import { Vegetation } from './Vegetation.js';
import { Village } from './Village.js';
import { Colliders } from './Colliders.js';
import { EnvLight, updateRim } from '../engine/ModelLook.js';

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
    for (const isl of this.terrain.islands) {
      const top = new THREE.Mesh(isl.topGeometry, this.terrainMat);
      top.receiveShadow = true;
      top.castShadow = isl !== this.terrain.main;
      const under = new THREE.Mesh(isl.underGeometry, this.underMat);
      under.receiveShadow = false; under.castShadow = false;
      this.scene.add(top, under);
      this.islandMeshes.push(top, under);
    }

    await step('Le ciel s’éveille…');
    this.sky = new Sky(this.scene);
    this.sky.setShadowSize(quality.shadowSize, quality.shadowSize >= 2048 ? 75 : 60);
    // reflets et lumière ambiante des modèles 3D : le ciel courant, préfiltré
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
    await step('Havrelumière se construit…');
    this.village = new Village(this.scene, assets, this.terrain, this.colliders, this.maps);
    this.elapsed = 0;
    return this;
  }

  setQuality(q) {
    this.quality = q;
    this.grass.build(q.grass, q.grassRadius);
    this.sky.setShadowSize(q.shadowSize, q.shadowSize >= 2048 ? 75 : 60);
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
    this.vegetation.update(dt, e, this.playerFocus);
    this.village.update(dt, e, st.night);
    return st;
  }
}
