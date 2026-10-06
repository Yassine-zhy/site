import { mulberry32 } from '../engine/math.js';

// Plus c'est rare, plus c'est fort… mais avec mesure : un objet mythique donne environ
// +30 % de dégâts totaux par rapport à un commun du même niveau (le niveau compte davantage).
export const RARITY = [
  { id: 0, name: 'Commun', color: '#d9d2c3', mult: 1.0 },
  { id: 1, name: 'Rare', color: '#5fa8ff', mult: 1.15 },
  { id: 2, name: 'Épique', color: '#b67bff', mult: 1.32 },
  { id: 3, name: 'Légendaire', color: '#ffa53d', mult: 1.52 },
  { id: 4, name: 'Mythique', color: '#ff4f7b', mult: 1.75 },
];
export const MAX_RARITY = RARITY.length - 1;

// Modèle 3D utilisé pour l'icône et l'objet au sol, par classe.
export const WEAPON_MODELS = {
  knight: ['sword_1handed', 'sword_2handed'],
  barbarian: ['axe_2handed', 'axe_1handed'],
  mage: ['staff', 'wand'],
  rogue: ['crossbow_1handed', 'dagger', 'crossbow_2handed'],
};
const ARMOR_MODELS = ['shield_round', 'shield_square', 'shield_badge', 'shield_spikes'];
const RELIC_MODELS = ['spellbook_open', 'smokebomb', 'quiver', 'mug_full'];

const WEAPON_NAMES = {
  knight: ['Lame', 'Épée', 'Estoc', 'Claymore'], barbarian: ['Hache', 'Fendoir', 'Tranche-Crâne', 'Couperet'],
  mage: ['Bâton', 'Sceptre', 'Baguette', 'Férule'], rogue: ['Arbalète', 'Dague', 'Carreleuse', 'Stylet'],
};
const ARMOR_NAMES = ['Bouclier', 'Pavois', 'Égide', 'Rondache'];
const RELIC_NAMES = ['Grimoire', 'Talisman', 'Reliquaire', 'Amulette'];
const SUFFIX = [
  ["de l'Aube", "du Crépuscule", 'des Nuées', 'du Vent', 'des Murmures', 'de Cendre'],
  ['du Phare', "de l'Écho", 'des Étoiles', 'de Havrelumière', 'du Silence'],
  ['de la Brume Vaincue', "de l'Aurore Éternelle", 'du Roi Déchu', 'des Mille Runes'],
  ['d’Aetheria', 'de la Dernière Lumière', 'du Ciel Fendu'],
  ['de l’Origine', 'des Dieux Oubliés', 'de l’Éternité', 'du Premier Phare'],
];
const PREFIX = ['', 'Fidèle ', 'Ardente ', 'Ancienne ', 'Céleste ', 'Sublime '];

let uid = 1;
export function newItemId() { return Date.now().toString(36) + (uid++).toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

export function rollRarity(rng = Math.random, luck = 0) {
  const r = rng();
  if (r < 0.002 + luck * 0.002) return 4;
  if (r < 0.014 + luck * 0.01) return 3;
  if (r < 0.07 + luck * 0.04) return 2;
  if (r < 0.28 + luck * 0.08) return 1;
  return 0;
}

// Tirage selon une table de probabilités [commun, rare, épique, légendaire, mythique] (somme = 1).
export function rollFromTable(table, rng = Math.random) {
  let r = rng();
  for (let i = 0; i < table.length; i++) { if (r < table[i]) return i; r -= table[i]; }
  return 0;
}

// Les objets d'un niveau supérieur au héros sont ramenés à son niveau (pas de triche par le butin).
export function levelFactor(itemLevel, heroLevel) {
  if (!itemLevel || itemLevel <= heroLevel) return 1;
  return (4 + heroLevel * 2.2) / (4 + itemLevel * 2.2);
}

// Génère un équipement pour une classe et un niveau.
export function generateItem(classId, level, { rarity = null, slot = null, rng = Math.random } = {}) {
  const r = rarity ?? rollRarity(rng);
  const R = RARITY[r];
  const s = slot || (rng() < 0.5 ? 'weapon' : rng() < 0.55 ? 'armor' : 'relic');
  const lv = Math.max(1, level);
  const pickFrom = (arr) => arr[Math.floor(rng() * arr.length)];
  let name, model, stats = {};
  const suffix = pickFrom(SUFFIX[Math.min(r, SUFFIX.length - 1)]);
  if (s === 'weapon') {
    const base = pickFrom(WEAPON_NAMES[classId]);
    name = `${base} ${suffix}`;
    model = pickFrom(WEAPON_MODELS[classId]);
    stats.atk = Math.round((4 + lv * 2.2) * R.mult * (0.85 + rng() * 0.3));
    if (r >= 1) stats.crit = Math.round((2 + lv * 0.3) * R.mult);
    if (r >= 2) stats.haste = Math.round(3 + lv * 0.25 * R.mult);
  } else if (s === 'armor') {
    name = `${pickFrom(ARMOR_NAMES)} ${suffix}`;
    model = pickFrom(ARMOR_MODELS);
    stats.def = Math.round((3 + lv * 1.5) * R.mult * (0.85 + rng() * 0.3));
    stats.hp = Math.round((10 + lv * 8) * R.mult);
    if (r >= 2) stats.regen = Math.round(1 + lv * 0.15 * R.mult);
  } else {
    name = `${pickFrom(RELIC_NAMES)} ${suffix}`;
    model = pickFrom(RELIC_MODELS);
    stats.mp = Math.round((10 + lv * 5) * R.mult);
    stats.rune = Math.round((4 + lv * 0.6) * R.mult);
    if (r >= 1) stats.crit = Math.round((1 + lv * 0.2) * R.mult);
    if (r >= 3) stats.haste = Math.round(4 + lv * 0.3);
  }
  // mythique : vol de vie (une part des dégâts infligés soigne)
  if (r >= 4) stats.leech = s === 'weapon' ? 4 : 2;
  if (r === 3) name = PREFIX[1 + Math.floor(rng() * (PREFIX.length - 1))] + name;
  if (r === 4) name = name + ' ✦';
  const value = Math.round((8 + lv * 6) * Math.pow(R.mult, 2));
  return { id: newItemId(), kind: 'gear', slot: s, name, rarity: r, level: lv, stats, model, value, cls: classId };
}

export function potion(type = 'hp', n = 1) {
  return type === 'hp'
    ? { id: 'potion_hp', kind: 'potion', type: 'hp', name: 'Élixir de vie', count: n, value: 12, model: 'bottle_A_green' }
    : { id: 'potion_mp', kind: 'potion', type: 'mp', name: 'Élixir d’éther', count: n, value: 12, model: 'bottle_A_green' };
}

export const STAT_LABELS = { atk: 'Attaque', def: 'Défense', hp: 'Vie', mp: 'Éther', crit: 'Critique %', haste: 'Célérité %', regen: 'Régénération', rune: 'Puissance runique %', leech: 'Vol de vie %' };

export function itemPower(it) {
  if (!it || it.kind !== 'gear') return 0;
  const s = it.stats;
  return (s.atk || 0) * 3 + (s.def || 0) * 2.5 + (s.hp || 0) * 0.25 + (s.mp || 0) * 0.2 + (s.crit || 0) * 2 + (s.haste || 0) * 2 + (s.rune || 0) * 1.5 + (s.regen || 0) * 3 + (s.leech || 0) * 6;
}

export function seededItem(seed, classId, level, rarity) { return generateItem(classId, level, { rarity, rng: mulberry32(seed) }); }
