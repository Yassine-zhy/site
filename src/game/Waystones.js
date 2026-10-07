import * as THREE from 'three';
import { WAYSTONES } from '../config.js';
import { h } from '../ui/dom.js';
import { VirtualLight } from '../world/Lights.js';

const REGION_OF = { havre: 'Aetheria', cendres: 'Aetheria', pic: 'Aetheria', givre: 'Cimes de Givre', sanct: 'Cimes de Givre', ambre: 'Terres d’Ambre', gorge: 'Terres d’Ambre' };

// Pierres de passage : une fois éveillées (touche E), elles permettent de voyager
// instantanément de l'une à l'autre. Indispensable sur un continent aussi vaste.
export class Waystones {
  constructor(game) {
    this.game = game;
    const g = game;
    const runeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fd8ff').multiplyScalar(2.2), toneMapped: false });
    this.crystalMat = new THREE.MeshStandardMaterial({ color: '#cfe9ff', emissive: new THREE.Color('#4fa8ff'), emissiveIntensity: 1.4, roughness: 0.2, flatShading: true });
    this.dimMat = new THREE.MeshStandardMaterial({ color: '#8d97a8', emissive: new THREE.Color('#203048'), emissiveIntensity: 0.4, roughness: 0.4, flatShading: true });
    this.list = WAYSTONES.map((w) => {
      const y = g.world.terrain.heightAt(w.x, w.z) ?? 20;
      const grp = new THREE.Group();
      grp.position.set(w.x, y, w.z);
      const stone = g.assets.prop('pillar_decorated');
      stone.scale.set(0.9, 1.25, 0.9);
      grp.add(stone);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.4, 0.4, 8), new THREE.MeshStandardMaterial({ color: '#9b958a', roughness: 0.9, flatShading: true }));
      base.position.y = 0.15; base.receiveShadow = true;
      grp.add(base);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), this.dimMat);
      crystal.position.y = 5.2;
      grp.add(crystal);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.04, 6, 40), runeMat);
      ring.position.y = 5.2; ring.visible = false;
      grp.add(ring);
      const light = new VirtualLight('#7fc4ff', 0, 16, 1.6);
      light.position.y = 5.2;
      grp.add(light);
      g.scene.add(grp);
      g.world.cullFar(grp, 1.2);
      g.world.colliders.addCircle(w.x, w.z, 0.9, y - 1, y + 5, 'monument');
      g.world.colliders.addCircle(w.x, w.z, 2.3, y - 1, y + 0.35, 'prop', true);
      return { ...w, y, grp, crystal, ring, light };
    });
  }

  known(id) { return !!this.game.hero?.discovered['ws:' + id]; }

  nearest(pos, maxD = 3.6) {
    let best = null, bd = maxD;
    for (const w of this.list) { const d = Math.hypot(pos.x - w.x, pos.z - w.z); if (d < bd) { bd = d; best = w; } }
    return best;
  }

  update(dt) {
    const elapsed = this.game.elapsed;
    for (const w of this.list) {
      const on = this.known(w.id);
      w.crystal.material = on ? this.crystalMat : this.dimMat;
      w.crystal.rotation.y += dt * (on ? 1.4 : 0.3);
      w.crystal.position.y = 5.2 + Math.sin(elapsed * 1.6 + w.x) * (on ? 0.18 : 0.05);
      w.ring.visible = on;
      w.ring.rotation.x = elapsed * 0.9; w.ring.rotation.y = elapsed * 0.6;
      w.light.intensity = on ? 6 + Math.sin(elapsed * 2 + w.z) : 0;
    }
  }

  awaken(w) {
    const g = this.game;
    g.hero.discovered['ws:' + w.id] = true;
    const p = new THREE.Vector3(w.x, w.y, w.z);
    g.fx.beam(p, '#9fd8ff', { height: 30, radius: 1.6, life: 1.4 });
    g.fx.ring(p, '#9fd8ff', { from: 1, to: 9, life: 0.9, intensity: 3 });
    g.audio?.play('beacon', p);
    g.ui.announce('Pierre de passage éveillée', `${w.name} · voyagez d’ici vers toutes les pierres éveillées.`, 3);
    g.gainXp?.(40);
    g.quests?.onEvent('waystone', { id: w.id });
    g.save?.soon();
  }

  // fenêtre de voyage
  open(from) {
    const g = this.game, win = g.windows;
    if (from && !this.known(from.id)) this.awaken(from);
    const rows = [];
    let region = '';
    for (const w of this.list) {
      if (REGION_OF[w.id] !== region) { region = REGION_OF[w.id]; rows.push(h('div', { class: 'sc', style: { color: 'var(--gold)', fontSize: '12px', margin: '10px 0 4px' } }, region)); }
      const known = this.known(w.id), here = from && from.id === w.id;
      rows.push(h('button', {
        class: 'qo-link', type: 'button', disabled: !known || here,
        style: { opacity: known ? 1 : 0.5 },
        onclick: () => { if (known && !here) { win.close(); this.travel(w); } },
      }, h('span', {}, (known ? '◆ ' : '◇ ') + w.name), h('span', { class: 'istats' }, here ? 'vous êtes ici' : known ? 'voyager' : 'à découvrir')));
    }
    win.custom('Pierres de passage', h('div', {},
      h('div', { class: 'istats' }, 'Touchez une pierre éveillée pour y voyager. Les autres s’éveillent quand vous les approchez (E).'),
      ...rows));
  }

  travel(w) {
    const g = this.game, p = g.player;
    if (!p || p.dead) return;
    const from = p.position.clone();
    g.fx.beam(from, '#9fd8ff', { height: 26, radius: 1.4, life: 0.9 });
    g.audio?.play('blink', from);
    g.ui.fade?.(0.35);
    g.schedule(0.3, () => {
      const a = Math.random() * Math.PI * 2;
      const x = w.x + Math.cos(a) * 3.4, z = w.z + Math.sin(a) * 3.4;
      const y = g.world.terrain.heightAt(x, z) ?? w.y;
      p.spawn(x, y + 0.2, z, Math.atan2(w.x - x, w.z - z) + Math.PI);
      g.rig.yaw = p.facing + Math.PI; g.rig.initialized = false;
      g.fx.beam(p.position, '#9fd8ff', { height: 26, radius: 1.4, life: 1.1 });
      g.fx.ring(p.position, '#9fd8ff', { from: 1, to: 6, life: 0.7 });
      g.ui.announce(w.name, REGION_OF[w.id], 2);
    });
  }
}
