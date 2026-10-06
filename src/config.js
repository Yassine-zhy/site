// Configuration globale du monde d'Aetheria.
// Unités : 1 unité ≈ 0,75 m (un héros KayKit mesure ~2,4 unités).

export const WORLD_SEED = 1337;
export const GAME_VERSION = '1.0.0';

export const MAIN_ISLAND = { x: 0, z: 0, radius: 215, coastNoise: 22, baseY: 0 };

export const VILLAGE = { x: 0, z: 0, radius: 52, height: 14, name: 'Havrelumière' };
export const LAKE = { x: -122, z: 34, radius: 30, level: 8.6, name: 'Lac Miroir' };
export const MOUNTAIN = { x: -12, z: -140, radius: 78, peak: 78, summitRadius: 20, summitHeight: 70, name: 'Pic du Silence' };
export const FOREST = { x: 118, z: 14, radius: 72, name: 'Bois-Murmure' };
export const RUINS = { x: 34, z: 132, radius: 46, height: 11, name: 'Les Cendres' };
export const HILLS = { x: -95, z: 120, radius: 70, name: 'Collines Ambrées' };

// Îlots flottants (relief propre + face inférieure rocheuse).
export const ISLETS = [
  { id: 'nuees', name: 'Îlot des Nuées', x: -282, z: -46, radius: 36, baseY: 42, relief: 7, seed: 11 },
  { id: 'tresor', name: 'Îlot du Trésor', x: 282, z: -96, radius: 23, baseY: 30, relief: 4, seed: 23 },
  { id: 'suspendu', name: 'Îlot Suspendu', x: 228, z: 196, radius: 20, baseY: 6, relief: 3, seed: 37 },
  { id: 'pelerin', name: 'Îlot du Pèlerin', x: -206, z: -244, radius: 21, baseY: 64, relief: 4, seed: 41 },
  { id: 'eclat', name: 'Éclat Errant', x: 96, z: -262, radius: 12, baseY: 22, relief: 2, seed: 53 },
];

// Colonnes de vent ascendantes : permettent de planer vers les îlots.
export const UPDRAFTS = [
  { x: -206, z: -22, radius: 7, top: 96 },
  { x: 205, z: -66, radius: 6, top: 74 },
  { x: -126, z: -186, radius: 6, top: 118 },
  { x: 168, z: 160, radius: 6, top: 48 },
  { x: 60, z: -200, radius: 6, top: 64 },
  { x: -20, z: -88, radius: 5, top: 96 },
];

// Pont de corde (main island -> Îlot Suspendu)
export const BRIDGES = [
  { from: [176, 158], to: [216, 186] },
];

// Les Phares : objectif partagé par tous les joueurs du monde.
export const BEACONS = [
  { id: 'aube', name: "Phare de l'Aube", x: 66, z: -52, radius: 70, decayHours: 18, lore: "Le premier phare, celui qui veille sur Havrelumière." },
  { id: 'murmures', name: 'Phare des Murmures', x: 140, z: 36, radius: 72, decayHours: 14, lore: 'Ses chants apaisent les arbres du Bois-Murmure.' },
  { id: 'cendres', name: 'Phare des Cendres', x: 40, z: 146, radius: 72, decayHours: 12, lore: 'Dressé sur les ruines de la vieille cité.' },
  { id: 'nuees', name: 'Phare des Nuées', x: -286, z: -50, radius: 60, decayHours: 12, islet: 'nuees', lore: "Perché au-dessus de la mer de nuages, seul le vent y mène." },
  { id: 'silence', name: 'Phare du Silence', x: -12, z: -146, radius: 90, decayHours: 10, lore: 'Au sommet du pic, gardé par le Roi Sans Lumière.' },
];

// Chemins de terre (polylignes XZ).
export const PATHS = [
  [[0, 0], [40, -10], [80, 4], [118, 14], [140, 36]],
  [[0, 0], [10, 50], [24, 96], [34, 132], [40, 146]],
  [[0, 0], [-46, 12], [-88, 24], [-100, 30]],
  [[0, 0], [8, -46], [30, -50], [66, -52]],
  [[0, 0], [-8, -50], [-6, -80], [10, -100], [-30, -112], [6, -128], [-12, -146]],
  [[-88, 24], [-120, 70], [-95, 120]],
  [[118, 14], [150, 90], [176, 158]],
  [[-100, 30], [-170, 0], [-206, -22]],
];

// Zones d'apparition des squelettes.
export const SPAWN_ZONES = [
  { id: 'collines', x: -95, z: 120, radius: 52, level: [1, 3], types: ['minion'], max: 7 },
  { id: 'aube', x: 78, z: -70, radius: 34, level: [1, 3], types: ['minion', 'minion', 'rogue'], max: 6 },
  { id: 'foret', x: 125, z: 24, radius: 58, level: [3, 6], types: ['minion', 'rogue', 'warrior'], max: 9 },
  { id: 'cendres', x: 38, z: 136, radius: 44, level: [5, 9], types: ['warrior', 'mage', 'minion', 'rogue'], max: 10 },
  { id: 'montagne', x: -10, z: -112, radius: 40, level: [8, 12], types: ['warrior', 'rogue', 'mage'], max: 8 },
  { id: 'nuees', x: -282, z: -46, radius: 26, level: [7, 10], types: ['mage', 'rogue'], max: 5 },
  { id: 'lac', x: -150, z: 70, radius: 30, level: [2, 4], types: ['minion', 'rogue'], max: 5 },
];

export const BOSS = { id: 'roi', name: 'Le Roi Sans Lumière', x: -12, z: -136, level: 15, respawnMinutes: 8 };

// Cycle jour/nuit partagé : synchronisé sur l'horloge réelle.
export const DAY_LENGTH_MS = 24 * 60 * 1000;

export const CLASSES = {
  knight: {
    id: 'knight', name: 'Chevalier', model: 'knight', title: 'Rempart de lumière',
    desc: "Épée et bouclier. Encaisse les coups, protège ses alliés et fend les rangs ennemis.",
    color: '#7fb2ff', role: 'Tank · Mêlée',
    base: { hp: 160, mp: 60, atk: 12, def: 10, speed: 1.0 },
    perLevel: { hp: 18, mp: 4, atk: 2.2, def: 1.6 },
    weapons: { show: ['1H_Sword', 'Round_Shield'], idle: 'Idle', combo: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal'] },
    attackRange: 3.4, attackArc: 1.4, runeBonus: 1.0,
    abilities: ['shieldwall', 'charge', 'rally', 'judgement'],
  },
  barbarian: {
    id: 'barbarian', name: 'Barbare', model: 'barbarian', title: 'Tempête de fer',
    desc: "Hache à deux mains. Tourbillonne au cœur de la mêlée et puise sa force dans la rage.",
    color: '#ff9a62', role: 'Combattant · Mêlée',
    base: { hp: 140, mp: 50, atk: 15, def: 6, speed: 1.02 },
    perLevel: { hp: 15, mp: 3, atk: 2.8, def: 1.0 },
    weapons: { show: ['2H_Axe'], idle: '2H_Melee_Idle', combo: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Stab'] },
    attackRange: 3.8, attackArc: 1.8, runeBonus: 0.9,
    abilities: ['whirlwind', 'leap', 'rage', 'shatter'],
  },
  mage: {
    id: 'mage', name: 'Mage', model: 'mage', title: 'Tisseuse d’arcanes',
    desc: "Bâton et grimoire. Maîtrise les runes mieux que quiconque et frappe de loin.",
    color: '#c69bff', role: 'Lanceur de sorts · Distance',
    base: { hp: 100, mp: 140, atk: 14, def: 4, speed: 1.0 },
    perLevel: { hp: 10, mp: 12, atk: 2.6, def: 0.7 },
    weapons: { show: ['2H_Staff'], idle: 'Idle', combo: ['Spellcast_Shoot', 'Spellcast_Shoot'] },
    attackRange: 26, ranged: true, runeBonus: 1.35,
    abilities: ['frostnova', 'blink', 'meteor', 'arcanestorm'],
  },
  rogue: {
    id: 'rogue', name: 'Rôdeuse', model: 'rogue_hooded', title: 'Ombre des nuées',
    desc: "Arbalète et dagues. Insaisissable, elle crible ses cibles de carreaux à distance.",
    color: '#7ee0a8', role: 'Tireuse · Distance',
    base: { hp: 115, mp: 70, atk: 13, def: 5, speed: 1.08 },
    perLevel: { hp: 12, mp: 5, atk: 2.5, def: 0.9 },
    weapons: { show: ['1H_Crossbow', 'Knife_Offhand'], idle: 'Idle', combo: ['1H_Ranged_Shoot', '1H_Ranged_Shoot'] },
    attackRange: 30, ranged: true, runeBonus: 1.05,
    abilities: ['volley', 'roll', 'smoke', 'piercing'],
  },
};

export const ENEMIES = {
  minion: { name: 'Serviteur squelette', model: 'skel_minion', hp: 42, atk: 7, def: 2, speed: 3.6, range: 2.6, cd: 1.6, xp: 14, weapon: ['Skeleton_Blade', 'handslot.r'], attack: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Stab'], walk: 'Walking_D_Skeletons', run: 'Running_C' },
  warrior: { name: 'Guerrier squelette', model: 'skel_warrior', hp: 90, atk: 11, def: 6, speed: 3.1, range: 3.0, cd: 2.1, xp: 26, weapon: ['Skeleton_Axe', 'handslot.r'], shield: ['Skeleton_Shield_Large_A', 'handslot.l'], attack: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Jump_Chop'], walk: 'Walking_D_Skeletons', run: 'Running_A' },
  rogue: { name: 'Rôdeur squelette', model: 'skel_rogue', hp: 50, atk: 9, def: 3, speed: 3.8, range: 22, ranged: true, cd: 2.4, xp: 20, weapon: ['Skeleton_Crossbow', 'handslot.r'], attack: ['1H_Ranged_Shoot'], walk: 'Walking_B', run: 'Running_B' },
  mage: { name: 'Nécromancien', model: 'skel_mage', hp: 58, atk: 13, def: 2, speed: 3.0, range: 20, ranged: true, caster: true, cd: 2.8, xp: 28, weapon: ['Skeleton_Staff', 'handslot.r'], attack: ['Spellcast_Shoot', 'Spellcast_Long'], walk: 'Walking_A', run: 'Running_A' },
  boss: { name: 'Le Roi Sans Lumière', model: 'skel_warrior', hp: 3200, atk: 28, def: 14, speed: 3.4, range: 6.5, cd: 2.2, xp: 900, scale: 2.6, weapon: ['Skeleton_Axe', 'handslot.r'], shield: ['Skeleton_Shield_Large_A', 'handslot.l'], attack: ['2H_Melee_Attack_Chop', '1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Spin'], walk: 'Walking_D_Skeletons', run: 'Running_A', boss: true },
};

export function xpForLevel(l) { return Math.round(60 * Math.pow(l, 1.55) + 40 * l); }
export const MAX_LEVEL = 30;
