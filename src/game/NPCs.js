import * as THREE from 'three';
import { Character } from '../entities/Character.js';
import { NPC_SPOTS } from '../world/Village.js';
import { dampAngle } from '../engine/math.js';

const DEFS = [
  { id: 'elder', name: 'Maëlis', title: 'l’Ancienne', model: 'mage', show: ['2H_Staff'], idle: 'Idle', gestures: ['Spellcast_Raise', 'Interact'] },
  { id: 'smith', name: 'Brom', title: 'le forgeron', model: 'barbarian', show: ['2H_Axe'], idle: '2H_Melee_Idle', gestures: ['Cheer', 'Interact', '2H_Melee_Attack_Chop'] },
  { id: 'guard', name: 'Sir Aldric', title: 'la sentinelle', model: 'knight', show: ['1H_Sword', 'Round_Shield'], idle: 'Idle', gestures: ['Blocking', 'Cheer'] },
  { id: 'merchant', name: 'Lysa', title: 'la marchande', model: 'rogue', show: ['Knife'], idle: 'Idle', gestures: ['Interact', 'Cheer', 'PickUp'] },
  { id: 'oracle', name: 'L’Oracle des Échos', title: 'voix des voyageurs', model: 'rogue_hooded', show: [], idle: 'Idle', gestures: ['Spellcasting', 'Spellcast_Long'] },
];

// Habitants de Havrelumière.
export class NPCs {
  constructor(game) {
    this.game = game;
    this.list = [];
    for (const d of DEFS) {
      const spot = NPC_SPOTS[d.id];
      const ch = new Character(game.assets, d.model, { show: d.show });
      const y = game.world.terrain.heightAt(spot.x, spot.z) ?? 14;
      ch.object.position.set(spot.x, y, spot.z);
      const face = Math.atan2(spot.face[0] - spot.x, spot.face[1] - spot.z);
      ch.object.rotation.y = face;
      ch.setLocomotion(d.idle);
      game.scene.add(ch.object);
      game.world.colliders.addCircle(spot.x, spot.z, 0.6, y - 1, y + 3, 'npc');
      const npc = { ...d, char: ch, spot: { x: spot.x, y, z: spot.z }, baseFace: face, facing: face, gestureT: 3 + Math.random() * 6, position: ch.object.position };
      if (d.id === 'oracle') {
        // sanctuaire de l'Oracle : cercle runique permanent
        const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.35, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#c9b6ff').multiplyScalar(2), transparent: true, opacity: 0.7, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(spot.x, y + 0.08, spot.z);
        game.scene.add(ring);
        npc.ring = ring;
        for (const m of ch.materials) { if (m.emissive) { m.emissive.set('#3a2a6a'); m.emissiveIntensity = 0.5; m.userData.baseEmissive = m.emissive.clone(); m.userData.baseEmissiveIntensity = 0.5; } }
      }
      this.list.push(npc);
    }
  }

  byId(id) { return this.list.find((n) => n.id === id); }

  nearest(pos, maxD = 4) {
    let best = null, bd = maxD;
    for (const n of this.list) { const d = Math.hypot(pos.x - n.spot.x, pos.z - n.spot.z); if (d < bd) { bd = d; best = n; } }
    return best;
  }

  nearMerchant() { const p = this.game.player?.position; return p && (this.nearest(p, 6)?.id === 'smith' || this.nearest(p, 6)?.id === 'merchant'); }

  questMark(n) {
    const q = this.game.quests;
    if (!q) return '';
    if (q.readyFor(n.id)) return '?';
    if (q.mainFor(n.id) || q.sideFor(n.id)) return '!';
    if (n.id === 'oracle' && !q.active.some((x) => x.ai)) return '✦';
    return '';
  }

  plates(ui) {
    for (const n of this.list) ui.setPlate({ id: 'npc:' + n.id, position: n.position, height: 2.6, name: n.name, title: n.title, kind: 'npc', questMark: this.questMark(n), bubble: n.bubble || '' });
  }

  markers(out) {
    for (const n of this.list) {
      const m = this.questMark(n);
      out.push({ x: n.spot.x, z: n.spot.z, color: m === '?' || m === '!' ? '#ffe3a3' : '#d7c9a6', r: m ? 5 : 3.5, shape: m === '!' || m === '?' ? 'star' : 'dot', label: n.name });
    }
  }

  update(dt) {
    const p = this.game.player?.position;
    for (const n of this.list) {
      const d = p ? Math.hypot(p.x - n.spot.x, p.z - n.spot.z) : 99;
      const target = d < 9 ? Math.atan2(p.x - n.spot.x, p.z - n.spot.z) : n.baseFace;
      n.facing = dampAngle(n.facing, target, 4, dt);
      n.char.object.rotation.y = n.facing;
      n.gestureT -= dt;
      if (n.gestureT <= 0 && !n.talking) {
        n.gestureT = 6 + Math.random() * 10;
        if (d < 30) n.char.playAction(n.gestures[Math.floor(Math.random() * n.gestures.length)], { timeScale: 1, full: false });
      }
      if (n.ring) n.ring.rotation.z += dt * 0.5;
      if (n.bubbleT > 0) { n.bubbleT -= dt; if (n.bubbleT <= 0) n.bubble = ''; }
      if (d < 70) n.char.update(dt);
    }
  }
}
