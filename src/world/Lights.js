import * as THREE from 'three';

// Lumières « virtuelles » : chaque lanterne, feu, phare ou aura en déclare une, mais seules
// les plus proches du joueur deviennent de vraies lumières (un petit réservoir fixe).
// Le coût d'éclairage reste constant quel que soit le nombre de sources, et le nombre de
// lumières ne change jamais (pas de recompilation des shaders).
const ALL = new Set();

export class VirtualLight extends THREE.Object3D {
  constructor(color = '#ffffff', intensity = 1, distance = 20, decay = 1.5) {
    super();
    this.isVirtualLight = true;
    this.color = new THREE.Color(color);
    this.intensity = intensity;
    this.distance = distance;
    this.decay = decay;
    ALL.add(this);
  }
  dispose() { ALL.delete(this); this.removeFromParent(); }
}

const _p = new THREE.Vector3();

export class LightPool {
  constructor(scene, size = 6) {
    this.scene = scene;
    this.lights = [];
    this.setSize(size);
    this.cand = [];
  }

  setSize(n) {
    for (const l of this.lights) l.removeFromParent();
    this.lights = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight('#ffffff', 0, 20, 1.5);
      l.castShadow = false;
      this.scene.add(l);
      this.lights.push(l);
    }
  }

  update(focus) {
    const cand = this.cand;
    cand.length = 0;
    for (const v of ALL) {
      if (v.intensity <= 0.01 || !v.parent) continue;
      v.getWorldPosition(_p);
      const d = Math.hypot(_p.x - focus.x, _p.y - focus.y, _p.z - focus.z);
      // au-delà de sa portée (plus une marge de vue), une source n'éclaire rien d'utile
      if (d > v.distance + 70) continue;
      cand.push({ v, d, x: _p.x, y: _p.y, z: _p.z });
    }
    cand.sort((a, b) => a.d - b.d);
    const n = this.lights.length;
    const cut = cand.length > n ? cand[n].d : Infinity;
    for (let i = 0; i < n; i++) {
      const l = this.lights[i], c = cand[i];
      if (!c) { l.intensity = 0; continue; }
      // fondu près du rang limite : pas de saut quand une source entre ou sort du réservoir
      const fade = cut === Infinity ? 1 : Math.min(1, Math.max(0, (cut - c.d) / 12));
      l.position.set(c.x, c.y, c.z);
      l.color.copy(c.v.color);
      l.intensity = c.v.intensity * fade;
      l.distance = c.v.distance;
      l.decay = c.v.decay;
    }
  }
}
