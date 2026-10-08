import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { LAKE, FOREST, RUINS, HILLS, MOUNTAIN, GIVRE, AMBRE, HANTEE, SYLVE, HAMLET, PLATEAUX, RECIFS, SAULES, FALAISES, LANTERN_PASS } from '../config.js';
import { RARITY, generateItem, rollFromTable, STAT_LABELS, levelFactor } from './Items.js';

// Coffres : quatre qualités, chacune avec sa table de probabilités par rareté
// [commun, rare, épique, légendaire, mythique]. Plus le coffre est précieux, plus les
// raretés hautes sont probables. L'objet obtenu est toujours au niveau du héros.
export const CHEST_TIERS = {
  bois: { name: 'Coffre en bois', color: '#c8955a', price: 90, rarity: 0, table: [0.62, 0.27, 0.085, 0.022, 0.003], gold: [8, 30] },
  fer: { name: 'Coffre de fer', color: '#a9c4dc', price: 280, rarity: 1, table: [0.33, 0.39, 0.2, 0.065, 0.015], gold: [20, 70] },
  or: { name: 'Coffre doré', color: '#ffcf5a', price: 750, rarity: 3, table: [0.06, 0.34, 0.38, 0.18, 0.04], gold: [60, 160] },
  mythique: { name: 'Coffre mythique', color: '#ff4f7b', price: 2200, rarity: 4, table: [0, 0.1, 0.42, 0.34, 0.14], gold: [150, 400] },
};
export const TIER_ORDER = ['bois', 'fer', 'or', 'mythique'];
// garantie : au plus tard au 35e coffre sans légendaire, le suivant en donne un
const PITY = 35;

// Coffres cachés dans le monde : ils réapparaissent (pour chaque héros) après un moment.
export const TREASURE_SPOTS = [
  { id: 'bois', name: 'le cœur du Bois-Murmure', x: FOREST.x + 24, z: FOREST.z - 26, tier: 'fer' },
  { id: 'cendres', name: 'les ruines des Cendres', x: RUINS.x - 20, z: RUINS.z + 16, tier: 'fer' },
  { id: 'lac', name: 'la rive du Lac Miroir', x: LAKE.x - 34, z: LAKE.z - 22, tier: 'bois' },
  { id: 'collines', name: 'les Collines Ambrées', x: HILLS.x - 34, z: HILLS.z + 24, tier: 'bois' },
  { id: 'pic', name: 'une corniche du Pic du Silence', x: MOUNTAIN.x + 60, z: MOUNTAIN.z - 47, tier: 'or' },
  { id: 'tresor', name: 'la Pointe aux Coquillages', x: RECIFS.headland.x + 6, z: RECIFS.headland.z - 8, tier: 'or' },
  { id: 'suspendu', name: 'la Butte aux Vents', x: -96, z: -168, tier: 'bois' },
  { id: 'pelerin', name: 'la Croisée du Pèlerin', x: -262, z: 98, tier: 'fer' },
  { id: 'eclat', name: 'la Table du Vent', x: PLATEAUX.table.x + 10, z: PLATEAUX.table.z + 8, tier: 'fer', minY: 48 },
  { id: 'nuees', name: 'le Belvédère du Couchant', x: FALAISES.belvedere.x - 14, z: FALAISES.belvedere.z + 12, tier: 'fer' },
  { id: 'passeur', name: 'le Gué du Passeur', x: 548, z: -548, tier: 'bois' },
  { id: 'lanternes', name: 'le Col des Lanternes', x: LANTERN_PASS.x - 8, z: LANTERN_PASS.z + 14, tier: 'fer' },
  { id: 'relais', name: 'le Relais des Plateaux', x: 618, z: -642, tier: 'bois' },
  { id: 'ventsec', name: 'le Tertre du Vent Sec', x: 826, z: -552, tier: 'fer' },
  { id: 'mine', name: 'la Mine de Kessa', x: AMBRE.mine.x + 14, z: AMBRE.mine.z - 10, tier: 'fer' },
  { id: 'gorge', name: 'le fond de la Gorge Rouge', x: 992, z: 200, tier: 'fer' },
  { id: 'mesa', name: 'le sommet de la Grande Mesa', x: 1058, z: -158, tier: 'or', minY: 42 },
  { id: 'cirque', name: 'le Cirque d’Ambre', x: AMBRE.cirque.x + 34, z: AMBRE.cirque.z + 12, tier: 'or' },
  { id: 'cristal', name: 'le Lac de Cristal', x: GIVRE.lake.x + 30, z: GIVRE.lake.z + 26, tier: 'fer' },
  { id: 'sanctuaire', name: 'le Sanctuaire Gelé', x: GIVRE.sanctuary.x + 16, z: GIVRE.sanctuary.z + 12, tier: 'or' },
  { id: 'cime', name: 'la cime du Mont Givrecroc', x: GIVRE.peak.x - 36, z: GIVRE.peak.z - 19, tier: 'mythique', minY: 120 },
  // nouvelles îles et îles agrandies
  { id: 'saules', name: 'l’Étang des Saules', x: SAULES.lake.x + 96, z: SAULES.lake.z - 24, tier: 'bois' },
  { id: 'fanal', name: 'le camp des Récifs', x: 754, z: 659, tier: 'fer' },
  { id: 'fougeres', name: 'la Lisière des Fougères', x: 160, z: 706, tier: 'bois' },
  { id: 'cascade', name: 'le pied du Mont du Couchant', x: -820, z: -600, tier: 'fer' },
  { id: 'pres', name: 'les champs des Prés-Bas', x: HAMLET.x + 34, z: HAMLET.z + 30, tier: 'bois' },
  { id: 'falaises', name: 'les Falaises du Couchant', x: -650, z: -700, tier: 'fer' },
  { id: 'prairie', name: 'la Prairie du Sud', x: 130, z: 290, tier: 'bois' },
  { id: 'emeraude', name: 'la rive du Lac Émeraude', x: SYLVE.lake.x + 30, z: SYLVE.lake.z - 82, tier: 'fer' },
  { id: 'temple', name: 'l’autel du Temple Englouti', x: SYLVE.temple.x, z: SYLVE.temple.z + 19, tier: 'or' },
  { id: 'feuillu', name: 'la cime du Mont Feuillu', x: SYLVE.peak.x - 28, z: SYLVE.peak.z - 21, tier: 'mythique', minY: 88 },
  { id: 'cimetiere', name: 'le Grand Cimetière', x: HANTEE.cemetery.x - 14, z: HANTEE.cemetery.z + 10, tier: 'or' },
  { id: 'marais', name: 'le Marais des Âmes', x: HANTEE.lake.x + 90, z: HANTEE.lake.z - 10, tier: 'fer' },
  { id: 'corbeaux', name: 'le Mont des Corbeaux', x: HANTEE.peak.x + 10, z: HANTEE.peak.z + 6, tier: 'or' },
  { id: 'crypte', name: 'la Crypte du Fossoyeur', x: HANTEE.crypt.x + 6, z: HANTEE.crypt.z - 8, tier: 'mythique' },
];
const OPEN_ANGLE = -1.9;
const RESPAWN_MIN = { bois: 15, fer: 25, or: 45, mythique: 90 };

export function chestPrice(tier, level) { return Math.round(CHEST_TIERS[tier].price * (1 + (Math.max(1, level) - 1) * 0.05)); }

export class Chests {
  constructor(game) {
    this.game = game;
    const g = game, terrain = g.world.terrain, cols = g.world.colliders;
    this.spots = [];
    for (const def of TREASURE_SPOTS) {
      let x = def.x, z = def.z;
      // cherche un sol libre et plat près de l'endroit voulu
      let spot = null;
      for (let k = 0; k < 40 && !spot; k++) {
        const a = k * 2.4, r = k * 0.9;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        const y = terrain.heightAt(px, pz);
        if (!terrain.isLand(px, pz) || terrain.slopeAt(px, pz) > 0.45 || (def.minY && y < def.minY)) continue;
        let blocked = false;
        for (const c of cols.grid.get(cols.key(Math.floor(px / 8), Math.floor(pz / 8))) || []) if (cols.contains(c, px, pz, 1.4)) { blocked = true; break; }
        if (!blocked) spot = { x: px, y, z: pz };
      }
      if (!spot) continue;
      const obj = this.makeChest(def.tier);
      obj.position.set(spot.x, spot.y, spot.z);
      obj.rotation.y = Math.atan2(-spot.x + x, -spot.z + z) || Math.random() * 6.28;
      g.scene.add(obj);
      g.world.cullFar(obj, 0.8);
      cols.addCircle(spot.x, spot.z, 0.9, spot.y - 1, spot.y + 1.1, 'prop', true);
      this.spots.push({ ...def, ...spot, obj, lid: obj.userData.lid });
    }
    this.v = new THREE.Vector3();
  }

  // petit coffre : bois, fer (bois teinté d'acier), doré, mythique (doré rose et lumineux)
  makeChest(tier) {
    const g = this.game;
    const gold = tier === 'or' || tier === 'mythique';
    const group = new THREE.Group();
    const base = g.assets.prop(gold ? 'chest_gold' : 'chest');
    // le couvercle est un enfant du coffre KayKit, avec son pivot sur la charnière
    const lid = base.getObjectByName(gold ? 'chest_gold_lid' : 'chest_lid') || new THREE.Object3D();
    const tint = tier === 'fer' ? '#9fb4cc' : tier === 'mythique' ? '#ff9db5' : null;
    base.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      if (tint) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(tint)); if (tier === 'mythique') { o.material.emissive = new THREE.Color('#ff2f6b'); o.material.emissiveIntensity = 0.35; } }
    });
    const box = new THREE.Box3().setFromObject(base);
    const s = 1.3 / Math.max(0.01, box.getSize(new THREE.Vector3()).x);
    base.scale.setScalar(s); base.position.y = -box.min.y * s;
    group.add(base);
    lid.userData.rest = lid.rotation.x;
    group.userData.lid = lid;
    group.userData.tier = tier;
    return group;
  }

  // une quête en cours réclame ce coffre précis : il est disponible même s'il a été pillé avant
  questWants(sp) {
    return !!this.game.quests?.active.some((q) => q.objectives.some((o) => o.type === 'treasure' && o.spot === sp.id && !o.done));
  }

  available(sp) {
    if (this.questWants(sp)) return true;
    const t = this.game.hero?.discovered['tc:' + sp.id];
    return !t || Date.now() - t > RESPAWN_MIN[sp.tier] * 60000;
  }

  // coffre du monde le plus proche (balise de quête)
  nearestSpot(pos, filter = () => true) {
    let best = null, bd = Infinity;
    for (const sp of this.spots) { if (!filter(sp) || !this.available(sp)) continue; const d = Math.hypot(sp.x - pos.x, sp.z - pos.z); if (d < bd) { bd = d; best = sp; } }
    return best;
  }

  spotNear(pos, r = 2.8) {
    for (const sp of this.spots) if (this.available(sp) && Math.hypot(sp.x - pos.x, sp.z - pos.z) < r && Math.abs(sp.y - pos.y) < 3) return sp;
    return null;
  }

  update(dt) {
    const g = this.game, el = g.elapsed;
    for (const sp of this.spots) {
      const av = this.available(sp);
      // couvercle : ouvert quand le coffre a été pillé, il se referme à la réapparition
      const rest = sp.lid.userData.rest || 0, want = rest + (av ? 0 : OPEN_ANGLE);
      sp.lid.rotation.x += (want - sp.lid.rotation.x) * Math.min(1, dt * (av ? 2 : 5));
      if (!av) continue;
      const d = g.player ? Math.hypot(sp.x - g.player.position.x, sp.z - g.player.position.z) : 999;
      if (d > 70) continue;
      const T = CHEST_TIERS[sp.tier];
      if (Math.random() < dt * (sp.tier === 'mythique' ? 14 : 4)) g.fx.sparkle(this.v.set(sp.x, sp.y + 0.8 + Math.sin(el * 2) * 0.1, sp.z), T.color, 0.9, 1, 0.2);
    }
  }

  // ouverture d'un coffre posé dans le monde
  openSpot(sp) {
    const g = this.game, hero = g.hero;
    hero.discovered['tc:' + sp.id] = Date.now();
    const T = CHEST_TIERS[sp.tier];
    const p = new THREE.Vector3(sp.x, sp.y, sp.z);
    g.fx.beam(p, T.color, { height: 16, radius: 1.2, life: 1.1 });
    g.fx.burst(p.clone().setY(sp.y + 1), T.color, { count: 40, speed: 6, size: 0.32, life: 0.9, gravity: 6, up: 5 });
    g.audio?.play('unlock', p);
    const [a, b] = T.gold;
    g.loot.drop(p, { gold: Math.round((a + Math.random() * (b - a)) * (1 + hero.level * 0.08)) });
    if (Math.random() < 0.4) g.loot.drop(p, { potion: Math.random() < 0.6 ? 'hp' : 'mp' });
    g.quests?.onEvent('treasure', { id: sp.id, tier: sp.tier });
    g.schedule(0.5, () => this.roll(sp.tier, { source: sp.name }));
    g.save?.soon();
  }

  // ------------------------------------------------------------------ tirage
  // L'objet est donné tout de suite (même si on ferme la fenêtre), la roulette le révèle.
  roll(tier, { source = null, fromStock = false } = {}) {
    const g = this.game, hero = g.hero, T = CHEST_TIERS[tier];
    if (!T || !hero) return;
    if (fromStock) {
      if (!(hero.chests[tier] > 0)) return;
      hero.chests[tier]--;
    }
    let rarity = rollFromTable(T.table);
    hero.pity = (hero.pity || 0) + 1;
    if (hero.pity >= PITY && rarity < 3) rarity = 3;
    if (rarity >= 3) hero.pity = 0;
    const item = generateItem(hero.classId, hero.level, { rarity });
    const stored = hero.addItem(item);
    if (!stored) g.loot.drop(g.player.position, { item });
    g.quests?.onEvent('openchest', { tier, rarity });
    g.save?.soon(1);
    this.showRoll(tier, item, { source, stored });
  }

  // Roulette façon « caisse » : une bande d'objets défile puis ralentit sur le gain.
  showRoll(tier, item, { source, stored }) {
    const g = this.game, hero = g.hero, T = CHEST_TIERS[tier];
    const N = 58, WIN = 50;
    let CARD = 112;
    const strip = h('div', { class: 'case-strip' });
    const cards = [];
    for (let i = 0; i < N; i++) {
      let it;
      if (i === WIN) it = item;
      else {
        // de temps en temps, un objet rare frôle le gain (suspense)
        const near = (i === WIN + 1 || i === WIN - 1) && Math.random() < 0.45;
        const r = near ? Math.min(4, Math.max(item.rarity + 1, 3)) : rollFromTable(T.table);
        it = generateItem(hero.classId, hero.level, { rarity: r });
      }
      const icon = g.icons.item(it.model);
      const c = h('div', { class: 'case-card r' + it.rarity, style: { '--rc': RARITY[it.rarity].color } },
        icon ? h('img', { src: icon, alt: '' }) : h('div', { class: 'case-noimg' }),
        h('div', { class: 'case-cname' }, RARITY[it.rarity].name));
      strip.appendChild(c); cards.push(c);
    }
    const viewport = h('div', { class: 'case-view' }, strip, h('div', { class: 'case-marker' }));
    const odds = h('div', { class: 'case-odds' }, ...T.table.map((p, r) => p > 0 ? h('div', { class: 'case-odd', style: { '--rc': RARITY[r].color } },
      h('span', { class: 'dot' }), h('span', {}, RARITY[r].name), h('b', {}, fmtPct(p))) : null));
    const result = h('div', { class: 'case-result' });
    const actions = h('div', { class: 'row case-actions' });
    const pityLeft = Math.max(0, PITY - (hero.pity || 0));
    const content = h('div', { class: 'case' },
      h('div', { class: 'case-head', style: { color: T.color } }, T.name, source ? h('span', { class: 'case-src' }, ' · ' + source) : null),
      viewport,
      odds,
      h('div', { class: 'istats case-pity' }, `Légendaire garanti au plus tard dans ${pityLeft} coffre${pityLeft > 1 ? 's' : ''}. Les objets sont au niveau de votre héros (${hero.level}).`),
      result, actions);
    g.windows.custom('Ouverture du coffre', content);
    const win = content.closest('.window');
    win?.classList.add('case-window');
    // position finale : la carte gagnante sous le repère, avec un léger décalage aléatoire
    const vw = () => viewport.clientWidth || 600;
    const jitter = (Math.random() - 0.5) * 0.7;
    let target = 0;
    // largeur réelle d'une carte (elle change sur petit écran)
    const measure = () => { const w = cards[1].offsetLeft - cards[0].offsetLeft; if (w > 20) CARD = w; target = WIN * CARD + CARD / 2 - vw() / 2 + jitter * CARD; };
    measure();
    const DUR = 5600;
    const t0 = performance.now();
    let last = -1, done = false;
    const ease = (t) => 1 - Math.pow(1 - t, 4.2);
    const finish = () => {
      if (done) return;
      done = true;
      strip.style.transform = `translateX(${-target}px)`;
      cards[WIN].classList.add('win');
      this.reveal(tier, item, result, actions, stored);
    };
    let measured = false;
    const step = () => {
      if (done || !strip.isConnected) return;
      if (!measured) { measured = true; measure(); }
      const t = Math.min(1, (performance.now() - t0) / DUR);
      const x = target * ease(t);
      strip.style.transform = `translateX(${-x}px)`;
      const idx = Math.floor((x + vw() / 2) / CARD);
      if (idx !== last) { last = idx; g.audio?.play('tick'); }
      if (t >= 1) finish(); else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    actions.appendChild(h('button', { class: 'btn ghost small', onclick: () => finish() }, 'Passer l’animation'));
    g.audio?.play('unlock');
  }

  reveal(tier, item, result, actions, stored) {
    const g = this.game, hero = g.hero, R = RARITY[item.rarity];
    result.innerHTML = '';
    actions.innerHTML = '';
    const f = levelFactor(item.level, hero.level);
    result.append(
      h('div', { class: 'case-win-name r' + item.rarity }, item.name),
      h('div', { class: 'istats' }, `${R.name} · ${{ weapon: 'Arme', armor: 'Bouclier', relic: 'Relique' }[item.slot]} · niveau ${item.level}`),
      h('div', { class: 'istats' }, Object.entries(item.stats).map(([k, v]) => `${STAT_LABELS[k] || k} +${Math.round(v * (k === 'leech' ? 1 : f))}`).join(' · ')),
      h('div', { class: 'istats', style: { color: hero.isUpgrade(item) ? 'var(--good)' : 'var(--muted)' } }, hero.isUpgrade(item) ? '▲ Meilleur que votre équipement actuel' : stored ? 'Rangé dans votre sac.' : 'Sac plein : l’objet est tombé à vos pieds.'),
    );
    if (item.rarity >= 3) {
      g.ui.announce(item.rarity >= 4 ? 'MYTHIQUE !' : 'Légendaire !', item.name, 3);
      g.audio?.play(item.rarity >= 4 ? 'mythic' : 'epic');
      const p = g.player.position;
      g.fx.beam(p, R.color, { height: 24, radius: 1.6, life: 1.4 });
      g.fx.burst(p.clone().setY(p.y + 1.5), R.color, { count: 60, speed: 8, size: 0.35, life: 1, gravity: 4, up: 6 });
    } else g.audio?.play(item.rarity >= 2 ? 'epic' : 'pickup');
    if (stored && hero.isUpgrade(item)) actions.appendChild(h('button', { class: 'btn small', onclick: () => { hero.equipItem(item.id); g.audio?.play('pickup'); g.save?.soon(); g.windows.close(); } }, 'Équiper'));
    const left = hero.chests[tier] || 0;
    if (left > 0) actions.appendChild(h('button', { class: 'btn small', onclick: () => this.roll(tier, { fromStock: true }) }, `Ouvrir un autre (${left})`));
    actions.appendChild(h('button', { class: 'btn ghost small', onclick: () => g.windows.open('inventory') }, 'Voir le sac'));
    actions.appendChild(h('button', { class: 'btn ghost small', onclick: () => g.windows.close() }, 'Fermer'));
  }

  // achat (boutique du sac ou chez Lysa)
  buy(tier) {
    const g = this.game, hero = g.hero, price = chestPrice(tier, hero.level);
    if (hero.gold < price) { g.ui.toast(`Il vous manque ${price - hero.gold} or.`, { color: '#ff8a72' }); g.audio?.play('error'); return false; }
    hero.gold -= price;
    hero.chests[tier] = (hero.chests[tier] || 0) + 1;
    g.audio?.play('coin');
    g.save?.soon();
    return true;
  }

  clearRoll() { /* la roulette vit dans une fenêtre : fermée avec elle */ }
}

function fmtPct(p) { const v = p * 100; return (v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(1)).replace('.', ',') + ' %'; }
