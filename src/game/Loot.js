import * as THREE from 'three';
import { RARITY } from './Items.js';
import { CHEST_TIERS } from './Chests.js';

// Butin au sol. Chaque type a son modèle : piles de pièces d'or, fioles, petits coffres,
// et pour l'équipement le vrai modèle de l'objet qui tourne au-dessus d'un halo et d'une
// colonne de lumière à la couleur de sa rareté (plus haute et plus vive quand c'est rare).
// Ramassage automatique en passant dessus.

function gradientTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.55, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.55)'); grd.addColorStop(0.7, 'rgba(255,255,255,0.12)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Loot {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.beamTex = gradientTexture();
    this.glowTex = glowTexture();
    // colonne : deux plans croisés (plus doux qu'un cylindre), dégradé vers le haut
    const p1 = new THREE.PlaneGeometry(0.9, 6); p1.translate(0, 3, 0);
    const p2 = p1.clone(); p2.rotateY(Math.PI / 2);
    const p3 = p1.clone(); p3.rotateY(Math.PI / 4); const p4 = p1.clone(); p4.rotateY(-Math.PI / 4);
    this.beamGeo = mergePlanes([p1, p2, p3, p4]);
    this.glowGeo = new THREE.PlaneGeometry(1, 1); this.glowGeo.rotateX(-Math.PI / 2);
    this.ringGeo = new THREE.RingGeometry(0.62, 0.72, 40); this.ringGeo.rotateX(-Math.PI / 2);
    this.orbGeo = new THREE.OctahedronGeometry(0.32, 0);
  }

  // entry : { item } | { gold } | { potion } | { chest: 'bois' | 'fer' | 'or' | 'mythique' }
  drop(pos, entry) {
    const g = this.game;
    const rar = entry.item ? entry.item.rarity : entry.chest ? CHEST_TIERS[entry.chest]?.rarity ?? 1 : -1;
    const color = entry.item ? RARITY[entry.item.rarity].color : entry.chest ? CHEST_TIERS[entry.chest]?.color || '#ffd36b' : entry.gold ? '#f2c46d' : entry.potion === 'mp' ? '#6fb8ff' : '#ff7a6b';
    const group = new THREE.Group();
    const add = (o) => { group.add(o); return o; };
    // halo au sol
    const glow = add(new THREE.Mesh(this.glowGeo, new THREE.MeshBasicMaterial({ map: this.glowTex, color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
    glow.position.y = 0.06;
    glow.scale.setScalar(entry.gold ? 1.4 : 2 + Math.max(0, rar) * 0.35);
    let ring = null, beam = null, model = null;
    if (rar >= 0) {
      ring = add(new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })));
      ring.position.y = 0.08;
      ring.scale.setScalar(1 + rar * 0.12);
      beam = add(new THREE.Mesh(this.beamGeo, new THREE.MeshBasicMaterial({ map: this.beamTex, color: new THREE.Color(color).multiplyScalar(1.4), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })));
      beam.scale.set(0.6 + rar * 0.12, 0.6 + rar * 0.55, 0.6 + rar * 0.12);
    }
    if (entry.item && entry.item.model) model = this.fit(g.assets.prop(entry.item.model), 1.25, 0.95);
    else if (entry.gold) model = this.fit(g.assets.prop(entry.gold >= 60 ? 'coin_stack_large' : 'coin_stack_small'), entry.gold >= 60 ? 0.9 : 0.7, 0.05, true);
    else if (entry.potion) {
      model = this.fit(g.assets.prop('bottle_A_green'), 0.75, 0.5);
      model.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(entry.potion === 'mp' ? '#7fb6ff' : '#ff8a7a'); o.material.emissive?.set(entry.potion === 'mp' ? '#1d4fa0' : '#8a1d1d'); } });
    } else if (entry.chest) model = this.fit(g.assets.prop(entry.chest === 'or' || entry.chest === 'mythique' ? 'chest_gold' : 'chest'), 1.1, 0.05, true);
    if (model) add(model);
    else { const orb = add(new THREE.Mesh(this.orbGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5), toneMapped: false }))); orb.position.y = 0.7; model = orb; }
    // pièces qui tournent autour d'une grosse somme
    const coins = [];
    if (entry.gold && entry.gold >= 25) for (let i = 0; i < 3; i++) { const c = this.fit(g.assets.prop('coin'), 0.32, 0.6); c.userData.a = i / 3 * Math.PI * 2; add(c); coins.push(c); }
    const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 1.6;
    const x = pos.x + Math.cos(a) * r, z = pos.z + Math.sin(a) * r;
    const y = g.world.terrain.heightAt(x, z) ?? pos.y;
    group.position.set(x, y, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    g.scene.add(group);
    const L = { group, glow, ring, beam, model, coins, entry, t: 0, color, y, rar, spin: !(entry.gold || entry.chest) };
    this.list.push(L);
    // jaillissement : l'objet saute en arc depuis l'ennemi
    L.jump = { from: new THREE.Vector3(pos.x - x, (pos.y ?? y) - y + 1.2, pos.z - z), t: 0 };
    g.fx.burst(new THREE.Vector3(x, y + 0.8, z), color, { count: 10 + Math.max(0, rar) * 8, speed: 3 + Math.max(0, rar), size: 0.3, life: 0.6 });
    if (rar >= 3) { g.fx.beam(new THREE.Vector3(x, y, z), color, { height: 14 + rar * 4, radius: 0.9, life: 1.1 }); g.audio?.play('epic', group.position); }
  }

  // met un modèle à l'échelle (taille visée) et le pose à une hauteur donnée
  fit(m, size, y, ground = false) {
    const box = new THREE.Box3().setFromObject(m);
    const s = size / Math.max(0.01, box.getSize(new THREE.Vector3()).length());
    m.scale.setScalar(s);
    m.position.y = ground ? y - box.min.y * s : y;
    m.userData.baseY = m.position.y;
    return m;
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
      const bob = Math.sin(L.t * 3) * 0.12;
      if (L.jump) {
        // arc de chute avec rebond
        const j = L.jump; j.t += dt;
        const f = Math.min(1, j.t / 0.45);
        L.model.position.set(j.from.x * (1 - f), (L.model.userData.baseY ?? 0.8) + j.from.y * (1 - f) + Math.sin(f * Math.PI) * 1.4, j.from.z * (1 - f));
        if (f >= 1) { L.jump = null; L.model.position.set(0, L.model.userData.baseY ?? 0.8, 0); }
      } else if (L.spin) {
        L.model.rotation.y += dt * 1.6;
        L.model.position.y = (L.model.userData.baseY ?? 0.8) + bob;
      }
      for (const c of L.coins) { c.userData.a += dt * 2.2; c.position.set(Math.cos(c.userData.a) * 0.55, 0.55 + Math.sin(L.t * 4 + c.userData.a) * 0.1, Math.sin(c.userData.a) * 0.55); c.rotation.y += dt * 6; }
      const pulse = 0.5 + Math.sin(L.t * 4) * 0.5;
      L.glow.material.opacity = 0.45 + pulse * 0.3;
      if (L.ring) { L.ring.rotation.y += dt * 0.8; L.ring.material.opacity = 0.55 + pulse * 0.35; }
      if (L.beam) L.beam.material.opacity = 0.35 + pulse * 0.2 + (L.rar >= 4 ? 0.15 : 0);
      if (L.t > 0.6 && Math.random() < dt * (3 + Math.max(0, L.rar) * 3)) g.fx.sparkle(L.group.position, L.color, 0.7, 1, 0.16 + Math.max(0, L.rar) * 0.03);
      // mythique : double spirale d'étincelles
      if (L.rar >= 4 && Math.random() < dt * 20) {
        const a = L.t * 5, k = (L.t * 1.3) % 1;
        for (const sgn of [1, -1]) g.fx.sparkle(new THREE.Vector3(L.group.position.x + Math.cos(a * sgn) * 0.7, L.group.position.y + k * 3, L.group.position.z + Math.sin(a * sgn) * 0.7), sgn > 0 ? '#ff4f7b' : '#ffb35c', 0.1, 1, 0.2);
      }
      const d = Math.hypot(L.group.position.x - p.position.x, L.group.position.z - p.position.z);
      // aimantation puis ramassage
      if (d < 4.5 && L.t > 0.6 && !p.dead) {
        L.group.position.x += (p.position.x - L.group.position.x) * Math.min(1, dt * 6);
        L.group.position.z += (p.position.z - L.group.position.z) * Math.min(1, dt * 6);
      }
      if ((d < 1.2 && L.t > 0.6) || L.t > 180) {
        if (L.t <= 180 && !this.collect(L)) { L.t = Math.min(L.t, 170); continue; }
        g.scene.remove(L.group);
        this.list.splice(i, 1);
      }
    }
  }

  // renvoie false si l'objet ne peut pas être pris (sac plein) : il reste au sol
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
    } else if (e.chest) {
      const T = CHEST_TIERS[e.chest];
      hero.chests[e.chest] = (hero.chests[e.chest] || 0) + 1;
      g.ui.toast(`<b style="color:${T.color}">${T.name}</b> obtenu ! Ouvrez-le depuis le sac (${g.input.isTouch ? 'bouton sac' : 'touche I'}).`, { time: 4 });
      g.audio?.play('epic');
      g.save?.soon();
    } else if (e.item) {
      const it = e.item;
      if (!hero.addItem(it)) {
        if (!L.warned) { L.warned = true; g.ui.toast('Sac plein : vendez des objets à Brom le forgeron ou à Lysa.', { color: '#ff8a72' }); }
        return false;
      }
      const up = hero.isUpgrade(it);
      g.ui.toast(`<span class="r${it.rarity}">${it.name}</span>${up ? ' <b>▲ meilleur</b>' : ''}`, { cls: 'loot', color: RARITY[it.rarity].color, time: 4 });
      g.audio?.play(it.rarity >= 2 ? 'epic' : 'pickup');
      if (it.rarity >= 3) g.ui.announce(it.rarity >= 4 ? 'Butin mythique !' : 'Butin légendaire', it.name, 3);
      g.quests?.onEvent('loot', { item: it });
      if (up && g.settings?.autoEquip) hero.equipItem(it.id);
      g.save?.soon();
    }
    return true;
  }
}

function mergePlanes(list) {
  const pos = [], uv = [], idx = [];
  let base = 0;
  for (const g of list) {
    const p = g.attributes.position.array, u = g.attributes.uv.array, ix = g.index.array;
    pos.push(...p); uv.push(...u);
    for (const k of ix) idx.push(k + base);
    base += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}
