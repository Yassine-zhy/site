import * as THREE from 'three';
import { World } from '../world/World.js';
import { Player } from '../entities/Player.js';
import { CameraRig } from '../entities/CameraRig.js';
import { VILLAGE } from '../config.js';

// Orchestrateur principal (version de base, étendue par les autres systèmes).
export class Game {
  constructor({ renderer, assets, input, ui, platform, audio }) {
    this.renderer = renderer; this.assets = assets; this.input = input; this.ui = ui; this.platform = platform; this.audio = audio;
    this.scene = renderer.scene; this.camera = renderer.camera;
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.systems = [];
    this.running = false;
  }

  buildWorld(onStep) {
    this.world = new World(this.renderer, this.assets, this.renderer.quality, onStep);
    this.rig = new CameraRig(this.camera, this.world.terrain);
  }

  spawnPlayer(classId, name) {
    this.player = new Player(this, classId, name);
    this.scene.add(this.player.object);
    const y = this.world.terrain.heightAt(VILLAGE.x + 4, VILLAGE.z + 14) ?? 20;
    this.player.spawn(VILLAGE.x + 4, y, VILLAGE.z + 14, Math.PI);
    this.rig.yaw = 0;
  }

  start() {
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 1 / 20);
      this.update(dt);
    };
    loop();
  }

  update(dt) {
    this.elapsed += dt;
    const look = this.input.consumeLook();
    this.rig.handleLook(look);
    if (this.player) this.player.update(dt, this.input, this.rig);
    const focus = this.player ? this.player.position : new THREE.Vector3(0, 20, 0);
    this.rig.update(dt, focus, this.player ? Math.max(0, Math.hypot(this.player.velocity.x, this.player.velocity.z) - 8) / 4 : 0);
    const pushers = this.player ? [{ x: this.player.position.x, z: this.player.position.z, r: 1.2 }] : [];
    this.world.update(dt, focus, this.camera, pushers);
    for (const s of this.systems) s.update?.(dt);
    this.renderer.render(dt, this.elapsed);
    this.input.endFrame();
  }
}
