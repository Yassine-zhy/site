import * as THREE from 'three';
import { angleDiff } from '../engine/math.js';

// Formules de dégâts communes.
export function computeDamage(atk, mult, armor, { crit = 0, variance = 0.12 } = {}) {
  const isCrit = Math.random() * 100 < crit;
  const base = atk * mult * (1 - variance / 2 + Math.random() * variance);
  const reduced = base * (60 / (60 + Math.max(0, armor) * 2.2));
  return { amount: Math.max(1, Math.round(reduced * (isCrit ? 1.85 : 1))), crit: isCrit };
}

const _v = new THREE.Vector3();

// Projectiles (carreaux, orbes, éclats) avec traînée de particules.
export class Projectiles {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.geo = new THREE.IcosahedronGeometry(1, 1);
    this.boltGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 5);
    this.boltGeo.rotateX(Math.PI / 2);
  }

  // o: {x,y,z, dir(Vector3), speed, range, color, size, team:'player'|'enemy', owner, homing, target, onHit(target, pos), kind:'orb'|'bolt', gravity, pierce}
  spawn(o) {
    const fx = this.game.fx;
    let mesh;
    if (o.kind === 'bolt') {
      mesh = new THREE.Group();
      const shaft = new THREE.Mesh(this.boltGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(o.color).multiplyScalar(2.5), toneMapped: false }));
      shaft.scale.set(1, 1, 1.4);
      mesh.add(shaft);
    } else {
      mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(o.color).multiplyScalar(3), toneMapped: false }));
      mesh.scale.setScalar(o.size || 0.35);
    }
    mesh.position.set(o.x, o.y, o.z);
    this.game.scene.add(mesh);
    const p = { ...o, mesh, vel: o.dir.clone().normalize().multiplyScalar(o.speed), dist: 0, hits: new Set(), t: 0 };
    if (o.kind === 'bolt') mesh.lookAt(_v.copy(mesh.position).add(p.vel));
    this.list.push(p);
    fx.flashSphere(mesh.position, o.color, 0.6, 0.12);
    return p;
  }

  update(dt) {
    const g = this.game, fx = g.fx, terrain = g.world.terrain;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      // guidage léger
      if (p.homing && p.target && p.target.alive !== false) {
        const tp = p.target.position;
        _v.set(tp.x - p.mesh.position.x, tp.y + 1.3 - p.mesh.position.y, tp.z - p.mesh.position.z).normalize().multiplyScalar(p.speed);
        p.vel.lerp(_v, Math.min(1, p.homing * dt));
      }
      if (p.gravity) p.vel.y -= p.gravity * dt;
      const step = p.vel.length() * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.dist += step;
      if (p.kind === 'bolt') p.mesh.lookAt(_v.copy(p.mesh.position).add(p.vel));
      else p.mesh.rotation.y += dt * 6;
      fx.trail(p.mesh.position, p.color, (p.size || 0.35) * 1.4, 0.3);
      let dead = p.dist > p.range;
      const pos = p.mesh.position;
      const gy = terrain.heightAt(pos.x, pos.z);
      if (gy !== null && pos.y < gy + 0.1) dead = true;
      if (!dead && !p.visualOnly) {
        const targets = p.team === 'player' ? g.enemies.hittable() : g.playerTargets();
        for (const t of targets) {
          if (p.hits.has(t.id)) continue;
          const tp = t.position;
          const h = t.height || 2.4;
          const r = (t.radius || 0.6) + (p.hitRadius || 0.45);
          if (pos.y < tp.y - 0.3 || pos.y > tp.y + h + 0.3) continue;
          if ((pos.x - tp.x) ** 2 + (pos.z - tp.z) ** 2 < r * r) {
            p.hits.add(t.id);
            p.onHit?.(t, pos.clone());
            if (!p.pierce) { dead = true; break; }
          }
        }
      }
      if (dead) {
        if (!p.hits.size) p.onExpire?.(pos.clone());
        p.onEnd?.(pos.clone());
        fx.burst(pos, p.color, { count: 8, speed: 4, size: 0.3, life: 0.3 });
        g.scene.remove(p.mesh);
        // (matériaux non détruits : leur shader resterait à recompiler au prochain tir)
        this.list.splice(i, 1);
      }
    }
  }
}

// Sélection de cible "douce" : l'ennemi le mieux placé devant la caméra.
export function pickSoftTarget(origin, aimYaw, list, range, maxAngle = 0.6) {
  let best = null, bestScore = Infinity;
  for (const e of list) {
    const dx = e.position.x - origin.x, dz = e.position.z - origin.z;
    const d = Math.hypot(dx, dz);
    if (d > range) continue;
    const a = Math.abs(angleDiff(aimYaw, Math.atan2(dx, dz)));
    if (a > maxAngle && d > 3.5) continue;
    const score = d * (1 + a * 2.2);
    if (score < bestScore) { bestScore = score; best = e; }
  }
  return best;
}
