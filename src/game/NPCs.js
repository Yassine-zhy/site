import * as THREE from 'three';
import { Character } from '../entities/Character.js';
import { NPC_SPOTS } from '../world/Village.js';
import { OUTPOST_NPCS } from '../world/Outposts.js';
import { INTERIOR_NPCS } from '../world/Interiors.js';

// le forgeron travaille désormais dans sa forge ; nouveaux habitants des intérieurs
const SPOTS = { ...NPC_SPOTS, ...OUTPOST_NPCS, ...INTERIOR_NPCS };
import { dampAngle } from '../engine/math.js';
import { SHARED } from '../world/SurfaceDetail.js';

const DEFS = [
  { id: 'elder', name: 'Maëlis', title: 'l’Ancienne', model: 'mage', show: ['2H_Staff'], idle: 'Idle', gestures: ['Spellcast_Raise', 'Interact'] },
  { id: 'smith', name: 'Brom', title: 'le forgeron', model: 'barbarian', show: ['2H_Axe'], idle: '2H_Melee_Idle', gestures: ['Cheer', 'Interact', '2H_Melee_Attack_Chop'] },
  { id: 'guard', name: 'Sir Aldric', title: 'la sentinelle', model: 'knight', show: ['1H_Sword', 'Round_Shield'], idle: 'Idle', gestures: ['Blocking', 'Cheer'] },
  { id: 'merchant', name: 'Lysa', title: 'la marchande', model: 'rogue', show: ['Knife'], idle: 'Idle', gestures: ['Interact', 'Cheer', 'PickUp'] },
  { id: 'oracle', name: 'L’Oracle des Échos', title: 'voix des voyageurs', model: 'rogue_hooded', show: [], idle: 'Idle', gestures: ['Spellcasting', 'Spellcast_Long'] },
  { id: 'ondine', name: 'Mère Ondine', title: 'l’herboriste', model: 'mage', tint: '#c8f0c0', show: [], idle: 'Idle', gestures: ['Interact', 'PickUp'] },
  { id: 'pip', name: 'Pip', title: 'l’apprenti cartographe', model: 'rogue', tint: '#ffe0b0', show: [], idle: 'Idle', gestures: ['Cheer', 'Interact'] },
  { id: 'rhea', name: 'Capitaine Rhéa', title: 'maîtresse des vents', model: 'knight', tint: '#c8dcff', show: ['1H_Sword'], idle: 'Idle', gestures: ['Cheer', 'Interact'] },
  { id: 'bjorn', name: 'Bjorn', title: 'le trappeur des Cimes', model: 'barbarian', tint: '#dde8ff', show: ['2H_Axe'], idle: '2H_Melee_Idle', gestures: ['Cheer', 'Interact'] },
  { id: 'neige', name: 'Sœur Neige', title: 'gardienne du Givre', model: 'mage', tint: '#e2f0ff', show: ['2H_Staff'], idle: 'Idle', gestures: ['Spellcast_Raise', 'Interact'] },
  { id: 'kessa', name: 'Kessa', title: 'la prospectrice', model: 'rogue', tint: '#ffd6a8', show: ['Knife'], idle: 'Idle', gestures: ['Interact', 'PickUp', 'Cheer'] },
  { id: 'tarek', name: 'Vieux Tarek', title: 'le conteur des sables', model: 'rogue_hooded', tint: '#ffd09a', show: [], idle: 'Idle', gestures: ['Spellcasting', 'Interact'] },
  { id: 'agathe', name: 'Agathe', title: 'la fermière des Prés-Bas', model: 'rogue', tint: '#ffe0c4', show: [], idle: 'Idle', gestures: ['PickUp', 'Interact', 'Cheer'] },
  { id: 'liora', name: 'Liora', title: 'la druidesse', model: 'mage', tint: '#c8f5c4', show: ['2H_Staff'], idle: 'Idle', gestures: ['Spellcast_Raise', 'Interact'] },
  { id: 'tiko', name: 'Tiko', title: 'l’explorateur', model: 'rogue', tint: '#e2ffb8', show: ['Knife'], idle: 'Idle', gestures: ['Cheer', 'Interact', 'PickUp'] },
  { id: 'morwen', name: 'Morwen', title: 'la veilleuse des morts', model: 'mage', tint: '#d9ccff', show: ['2H_Staff'], idle: 'Idle', gestures: ['Spellcasting', 'Interact'] },
  { id: 'innkeeper', name: 'Gaspard', title: 'l’aubergiste', model: 'barbarian', tint: '#ffe2c8', show: [], idle: 'Idle', gestures: ['Interact', 'Cheer', 'PickUp'] },
  { id: 'guildmaster', name: 'Dame Ysolde', title: 'maîtresse de la guilde', model: 'knight', tint: '#f0d8ff', show: ['1H_Sword'], idle: 'Idle', gestures: ['Interact', 'Cheer'] },
  { id: 'priestess', name: 'Sœur Aube', title: 'la prêtresse', model: 'mage', tint: '#fff2d0', show: ['2H_Staff'], idle: 'Idle', gestures: ['Spellcast_Raise', 'Interact'] },
  { id: 'archmage', name: 'Archimage Elric', title: 'gardien de la tour', model: 'mage', tint: '#c8d0ff', show: ['2H_Staff'], idle: 'Idle', gestures: ['Spellcasting', 'Spellcast_Raise'] },
  { id: 'silas', name: 'Silas', title: 'le chasseur de spectres', model: 'rogue_hooded', tint: '#c4bcd8', show: ['1H_Crossbow'], idle: 'Idle', gestures: ['Interact', 'Cheer'] },
];

// Habitants de Havrelumière.
export class NPCs {
  constructor(game) {
    this.game = game;
    this.list = [];
    for (const d of DEFS) {
      const spot = SPOTS[d.id];
      if (!spot) continue;
      const ch = new Character(game.assets, d.model, { show: d.show, tint: d.tint || null });
      const y = (spot.y ?? 0) + (game.world.terrain.heightAt(spot.x, spot.z) ?? 14);
      ch.object.position.set(spot.x, y, spot.z);
      const face = Math.atan2(spot.face[0] - spot.x, spot.face[1] - spot.z);
      ch.object.rotation.y = face;
      ch.setLocomotion(d.idle);
      game.scene.add(ch.object);
      game.world.cullFar(ch.object, 0.55);
      game.world.colliders.addCircle(spot.x, spot.z, 0.6, y - 1, y + 3, 'npc');
      const npc = { ...d, char: ch, spot: { x: spot.x, y, z: spot.z }, room: spot.room || null, baseFace: face, facing: face, gestureT: 3 + Math.random() * 6, position: ch.object.position };
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

  // où guider le joueur pour rejoindre cet habitant (la porte du bâtiment s'il est à l'intérieur)
  where(n) {
    if (!n.room) return n.spot;
    const p = this.game.player?.position;
    if (p && Math.abs(p.x - n.spot.x) < 60 && Math.abs(p.z - n.spot.z) < 60) return n.spot;
    const d = this.game.rooms?.homeDoor(n.room);
    return d ? { x: d.x, z: d.z } : n.spot;
  }

  markers(out) {
    for (const n of this.list) {
      const m = this.questMark(n);
      const w = this.where(n);
      out.push({ x: w.x, z: w.z, color: m === '?' || m === '!' ? '#ffe3a3' : '#d7c9a6', r: m ? 5 : 3.5, shape: m === '!' || m === '?' ? 'star' : 'dot', label: n.name });
    }
  }

  update(dt) {
    const p = this.game.player?.position;
    for (const n of this.list) {
      const d = p ? Math.hypot(p.x - n.spot.x, p.z - n.spot.z) : 99;
      // au loin, les habitants ne sont pas dessinés (leurs noms ne s'affichent de toute façon pas)
      if (p) n.char.object.visible = d < (SHARED.lite ? 140 : 320) || !!n.talking;
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
      if (d < 70 && n.char.object.visible) n.char.update(dt);
    }
  }
}
