import * as THREE from 'three';
import { RARITY } from './Items.js';

// Butin au sol : orbe lumineux + colonne colorée selon la rareté, ramassage automatique.
export class Loot {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.beamGeo = new THREE.CylinderGeometry(0.18, 0.4, 6, 10, 1, true);
    this.beamGeo.translate(0, 3, 0);
    this.orbGeo = new THREE.OctahedronGeometry(0.32, 0);
  }

  drop(pos, entry) {
    // entry : { item } | { gold } | { potion }
    const g = this.game;
    const color = entry.item ? RARITY[entry.item.rarity].color : entry.gold ? '#f2c46d' : '#ff7a6b';
    const group = new THREE.Group();
    const orb = new THREE.Mesh(this.orbGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5), toneMapped: false }));
    orb.position.y = 0.7;
    group.add(orb);
    if (entry.item && entry.item.model) {
      const m = g.assets.prop(entry.item.model);
      const box = new THREE.Box3().setFromObject(m);
      const s = 1.1 / Math.max(0.01, box.getSize(new THREE.Vector3()).length());
      m.scale.setScalar(s * 1.6);
      m.position.y = 0.9;
      group.add(m);
      group.userData.model = m;
      orb.visible = false;
    }
    const tall = entry.item ? 1 + entry.item.rarity * 0.6 : 0.5;
    const beam = new THREE.Mesh(this.beamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    beam.scale.y = tall;
    group.add(beam);
    const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 1.6;
    const x = pos.x + Math.cos(a) * r, z = pos.z + Math.sin(a) * r;
    const y = g.world.terrain.heightAt(x, z) ?? pos.y;
    group.position.set(x, y, z);
    g.scene.add(group);
    this.list.push({ group, orb, beam, entry, t: 0, color, y });
    g.fx.burst(new THREE.Vector3(x, y + 0.8, z), color, { count: 16, speed: 4, size: 0.3, life: 0.6 });
  }

  clear() {
    for (const L of this.list) this.game.scene.remove(L.group);
    this.list.length = 0;
  }

  update(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const L = this.list[i];
      L.t += dt;
      const bob = Math.sin(L.t * 3) * 0.15;
      L.orb.position.y = 0.8 + bob; L.orb.rotation.y += dt * 2;
      if (L.group.userData.model) { L.group.userData.model.rotation.y += dt * 1.5; L.group.userData.model.position.y = 0.9 + bob; }
      L.beam.material.opacity = 0.25 + Math.sin(L.t * 4) * 0.08;
      if (L.t > 0.6 && Math.random() < dt * 6) g.fx.sparkle(L.group.position, L.color, 0.6, 1, 0.18);
      const d = Math.hypot(L.group.position.x - p.position.x, L.group.position.z - p.position.z);
      // aimantation puis ramassage
      if (d < 4.5 && L.t > 0.5 && !p.dead) {
        L.group.position.x += (p.position.x - L.group.position.x) * Math.min(1, dt * 6);
        L.group.position.z += (p.position.z - L.group.position.z) * Math.min(1, dt * 6);
      }
      if ((d < 1.2 && L.t > 0.5) || L.t > 180) {
        if (L.t <= 180) this.collect(L);
        g.scene.remove(L.group);
        L.group.traverse((o) => { if (o.material && o !== L.group.userData.model) o.material.dispose?.(); });
        this.list.splice(i, 1);
      }
    }
  }

  collect(L) {
    const g = this.game, e = L.entry, hero = g.hero;
    if (e.gold) {
      hero.gold += e.gold;
      g.ui.floatText(g.player.position.clone().setY(g.player.position.y + 2.4), `+${e.gold} or`, 'gold');
      g.audio?.play('coin');
    } else if (e.potion) {
      hero.potions[e.potion] = (hero.potions[e.potion] || 0) + 1;
      g.ui.toast(`Ramassé : <b>${e.potion === 'hp' ? 'Élixir de vie' : 'Élixir d’éther'}</b>`);
      g.audio?.play('pickup');
    } else if (e.item) {
      const it = e.item;
      if (!hero.addItem(it)) { g.ui.toast('Sac plein : vendez des objets à Brom le forgeron.', { color: '#ff8a72' }); return; }
      const up = hero.isUpgrade(it);
      g.ui.toast(`<span class="r${it.rarity}">${it.name}</span>${up ? ' <b>▲ meilleur</b>' : ''}`, { cls: 'loot', color: RARITY[it.rarity].color, time: 4 });
      g.audio?.play(it.rarity >= 2 ? 'epic' : 'pickup');
      if (it.rarity >= 3) g.ui.announce('Butin légendaire', it.name, 3);
      g.quests?.onEvent('loot', { item: it });
      if (up && g.settings?.autoEquip) hero.equipItem(it.id);
      g.save?.soon();
    }
  }
}
