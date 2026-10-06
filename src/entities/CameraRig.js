import * as THREE from 'three';
import { clamp, damp } from '../engine/math.js';

const CLEAR_PROBES = [[0, 0], [0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]];

// Caméra à la troisième personne : orbite, zoom, évitement du relief, tremblements.
export class CameraRig {
  constructor(camera, terrain, colliders) {
    this.camera = camera; this.terrain = terrain; this.colliders = colliders;
    this.yaw = Math.PI; this.pitch = 0.32;
    this.distance = 9; this.targetDistance = 9;
    this.minDist = 3; this.maxDist = 22;
    this.focus = new THREE.Vector3();
    this.smoothFocus = new THREE.Vector3();
    this.shakeAmt = 0; this.shakeT = 0;
    this.sensitivity = 0.0023;
    this.invertY = false;
    this.fovKick = 0;
    this.baseFov = 60;
    this.tmp = new THREE.Vector3();
    this.initialized = false;
  }

  handleLook(look) {
    this.yaw -= look.dx * this.sensitivity;
    this.pitch += look.dy * this.sensitivity * (this.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -0.55, 1.25);
    if (look.wheel) this.targetDistance = clamp(this.targetDistance + look.wheel * 1.4, this.minDist, this.maxDist);
  }

  shake(amount) { this.shakeAmt = Math.min(1.2, this.shakeAmt + amount * (this.shakeMult ?? 1)); }

  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  // direction de visée 3D (centre de l'écran)
  aimDir(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch) + 0.18, -Math.cos(this.yaw) * Math.cos(this.pitch)).normalize();
  }

  update(dt, target, speedFactor = 0) {
    this.focus.set(target.x, target.y + 2.0, target.z);
    if (!this.initialized) { this.smoothFocus.copy(this.focus); this.initialized = true; }
    this.smoothFocus.x = damp(this.smoothFocus.x, this.focus.x, 14, dt);
    this.smoothFocus.y = damp(this.smoothFocus.y, this.focus.y, 9, dt);
    this.smoothFocus.z = damp(this.smoothFocus.z, this.focus.z, 14, dt);
    this.distance = damp(this.distance, this.targetDistance, 8, dt);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = this.tmp.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    let d = this.distance;
    // évite de traverser le relief et les bâtiments
    for (let i = 0; i < 6; i++) {
      const px = this.smoothFocus.x + dir.x * d, pz = this.smoothFocus.z + dir.z * d, py = this.smoothFocus.y + dir.y * d;
      const g = this.terrain.heightAt(px, pz);
      if (g !== null && py < g + 0.8 && this.smoothFocus.y > g - 2) d *= 0.8; else break;
    }
    if (this.colliders) {
      const steps = Math.ceil(d / 0.6);
      for (let s = 1; s <= steps; s++) {
        const k = (s / steps) * d;
        if (this.colliders.insideSolid(this.smoothFocus.x + dir.x * k, this.smoothFocus.z + dir.z * k, this.smoothFocus.y + dir.y * k)) { d = Math.max(1.2, k - 0.7); break; }
      }
    }
    this.solidD = this.solidD === undefined ? d : (d < this.solidD ? d : this.solidD + (d - this.solidD) * Math.min(1, dt * 3));
    d = this.solidD;
    // caméra très proche : on estompe le héros pour ne pas voir l'intérieur de son casque
    this.closeFade = d < 2.8 ? Math.max(0.15, (d - 1.2) / 1.6) : 1;
    const pos = this.camera.position;
    pos.set(this.smoothFocus.x + dir.x * d, this.smoothFocus.y + dir.y * d, this.smoothFocus.z + dir.z * d);
    const g = this.terrain.heightAt(pos.x, pos.z);
    if (g !== null && pos.y < g + 0.6 && this.smoothFocus.y > g - 2) pos.y = g + 0.6;
    // épaule droite légère
    const side = 0.9 * clamp(d / 9, 0.3, 1);
    pos.x += Math.cos(this.yaw) * side; pos.z -= Math.sin(this.yaw) * side;
    const look = new THREE.Vector3(this.smoothFocus.x + Math.cos(this.yaw) * side, this.smoothFocus.y, this.smoothFocus.z - Math.sin(this.yaw) * side);
    if (this.shakeAmt > 0) {
      this.shakeT += dt * 40;
      const s = this.shakeAmt * 0.35;
      pos.x += Math.sin(this.shakeT * 1.3) * s; pos.y += Math.sin(this.shakeT * 1.7 + 1) * s; pos.z += Math.cos(this.shakeT * 1.1) * s;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.5);
    }
    // l'épaule et les secousses ne doivent jamais faire passer la caméra sous le relief
    // (on verrait le ciel à travers le sol) : on vérifie la position finale et ses abords
    let gMax = -Infinity;
    for (const [ox, oz] of CLEAR_PROBES) {
      const gh = this.terrain.heightAt(pos.x + ox, pos.z + oz);
      if (gh !== null && gh > gMax) gMax = gh;
    }
    if (gMax > -Infinity && this.smoothFocus.y > gMax - 2 && pos.y < gMax + 0.55) pos.y = gMax + 0.55;
    this.camera.lookAt(look);
    const aspect = this.camera.aspect;
    const portrait = aspect < 1 ? Math.min(18, (1 - aspect) * 30) : 0; // téléphone en portrait : champ plus large
    const fov = this.baseFov + portrait + speedFactor * 8 + this.fovKick;
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov = damp(this.camera.fov, fov, 5, dt); this.camera.updateProjectionMatrix(); }
    this.fovKick = damp(this.fovKick, 0, 6, dt);
  }
}
