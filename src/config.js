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
  // îlots-relais vers les Cimes de Givre (nord) et les Terres d'Ambre (est)
  { id: 'passeur', name: 'Rocher du Passeur', x: -22, z: -300, radius: 19, baseY: 30, relief: 3, seed: 61, biome: 'snowy' },
  { id: 'lanternes', name: 'Îlot des Lanternes', x: -48, z: -398, radius: 21, baseY: 36, relief: 4, seed: 67, biome: 'snowy' },
  { id: 'relais', name: 'Îlot du Relais', x: 300, z: 44, radius: 20, baseY: 16, relief: 3, seed: 73, biome: 'dry' },
  { id: 'ventsec', name: 'Îlot du Vent Sec', x: 410, z: 30, radius: 19, baseY: 20, relief: 3, seed: 79, biome: 'dry' },
];

// Grandes îles (biomes propres). Les reliefs sont décrits par des « traits » combinés.
//   peak : montagne (+ plateau sommital) · plateau : terrain aplani · basin : cuvette (lac, arène)
//   mesa : plateau à falaises, avec rampe d'accès · canyon : gorge creusée le long d'une ligne
export const GIVRE = {
  id: 'givre', name: 'Les Cimes de Givre', biome: 'snow', x: -40, z: -690, radius: 190, coastNoise: 24, seed: 71, depth: 170, baseY: 34,
  camp: { x: -46, z: -545, radius: 24, name: 'Halte-du-Givre' },
  lake: { x: -150, z: -660, radius: 36, level: 32.5, name: 'Lac de Cristal' },
  peak: { x: 20, z: -775, radius: 92, peak: 100, summitRadius: 20, summitHeight: 108, name: 'Mont Givrecroc' },
  sanctuary: { x: 95, z: -640, radius: 30, height: 40, name: 'Sanctuaire Gelé' },
  features: [
    { type: 'plateau', x: -46, z: -545, radius: 24, height: 36 },
    { type: 'basin', x: -150, z: -660, radius: 36, level: 32.5 },
    { type: 'peak', x: 20, z: -775, radius: 92, height: 100, summitRadius: 20, summitHeight: 108 },
    { type: 'plateau', x: 95, z: -640, radius: 30, height: 40 },
    { type: 'peak', x: -130, z: -770, radius: 50, height: 40 },
    { type: 'peak', x: 120, z: -560, radius: 40, height: 24 },
  ],
};
export const AMBRE = {
  id: 'ambre', name: 'Les Terres d’Ambre', biome: 'amber', x: 700, z: 40, radius: 185, coastNoise: 24, seed: 83, depth: 150, baseY: 18,
  camp: { x: 560, z: 52, radius: 24, name: 'Comptoir d’Ambre' },
  mine: { x: 640, z: 180, name: 'Mine de Kessa' },
  cirque: { x: 810, z: 40, radius: 30, height: 16, name: 'Cirque d’Ambre' },
  features: [
    { type: 'plateau', x: 560, z: 52, radius: 24, height: 20 },
    { type: 'mesa', x: 690, z: -50, radius: 40, height: 36, rampAngle: 1.7 },
    { type: 'mesa', x: 770, z: 130, radius: 30, height: 30, rampAngle: -2.2 },
    { type: 'mesa', x: 620, z: -110, radius: 22, height: 28, rampAngle: 0.6 },
    { type: 'basin', x: 810, z: 40, radius: 30, level: 16, wall: 16 },
    { type: 'canyon', pts: [[600, 150], [660, 110], [720, 120], [770, 60]], width: 14, depth: 12 },
    { type: 'plateau', x: 640, z: 180, radius: 18, height: 19 },
  ],
};
export const BIG_ISLANDS = [GIVRE, AMBRE];

// Colonnes de vent ascendantes : permettent de planer vers les îlots.
export const UPDRAFTS = [
  { x: -206, z: -22, radius: 7, top: 96 },
  { x: 205, z: -66, radius: 6, top: 74 },
  { x: -126, z: -186, radius: 6, top: 118 },
  { x: 168, z: 160, radius: 6, top: 48 },
  { x: 60, z: -200, radius: 6, top: 64 },
  { x: -20, z: -88, radius: 5, top: 96 },
  { x: -10, z: -308, radius: 5, top: 88 },
  { x: -60, z: -410, radius: 5, top: 96 },
  { x: 296, z: 58, radius: 5, top: 70 },
  { x: 418, z: 42, radius: 5, top: 76 },
  { x: -10, z: -560, radius: 6, top: 120 },
  { x: 600, z: -20, radius: 6, top: 84 },
];

// Pont de corde (main island -> Îlot Suspendu)
export const BRIDGES = [
  { from: [176, 158], to: [216, 186] },
  { from: [-14, -206], to: [-20, -286] },
  { from: [-28, -316], to: [-44, -382] },
  { from: [-52, -414], to: [-50, -506] },
  { from: [206, 34], to: [285, 42] },
  { from: [317, 44], to: [395, 32] },
  { from: [426, 30], to: [528, 46] },
];

// Les Phares : objectif partagé par tous les joueurs du monde.
export const BEACONS = [
  { id: 'aube', name: "Phare de l'Aube", x: 66, z: -52, radius: 70, decayHours: 18, lore: "Le premier phare, celui qui veille sur Havrelumière." },
  { id: 'murmures', name: 'Phare des Murmures', x: 140, z: 36, radius: 72, decayHours: 14, lore: 'Ses chants apaisent les arbres du Bois-Murmure.' },
  { id: 'cendres', name: 'Phare des Cendres', x: 40, z: 146, radius: 72, decayHours: 12, lore: 'Dressé sur les ruines de la vieille cité.' },
  { id: 'nuees', name: 'Phare des Nuées', x: -286, z: -50, radius: 60, decayHours: 12, islet: 'nuees', lore: "Perché au-dessus de la mer de nuages, seul le vent y mène." },
  { id: 'silence', name: 'Phare du Silence', x: -12, z: -146, radius: 90, decayHours: 10, lore: 'Au sommet du pic, gardé par le Roi Sans Lumière.' },
  { id: 'givre', name: 'Phare du Givre', x: -112, z: -590, radius: 80, decayHours: 12, lore: 'Sa flamme bleue fait fondre la glace des Cimes.' },
  { id: 'ambre', name: 'Phare d’Ambre', x: 700, z: 66, radius: 85, decayHours: 12, lore: 'Dressé au milieu des mesas, il brille comme du miel.' },
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
  [[-12, -146], [-10, -180], [-14, -206]],
  [[-50, -506], [-46, -545], [-80, -570], [-112, -590]],
  [[-46, -545], [-10, -580], [20, -640], [95, -640]],
  [[-46, -545], [-120, -620], [-150, -660]],
  [[95, -640], [60, -700], [30, -740], [20, -775]],
  [[528, 46], [560, 52], [640, 60], [700, 66]],
  [[640, 60], [650, 120], [640, 180]],
  [[700, 66], [760, 50], [810, 40]],
  [[700, 66], [690, 10], [700, -10]],
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
  { id: 'ambre_plaines', x: 625, z: 70, radius: 50, level: [9, 12], types: ['amberminion', 'amberminion', 'amberrogue'], max: 8 },
  { id: 'ambre_gorge', x: 700, z: 125, radius: 42, level: [11, 14], types: ['amberwarrior', 'amberrogue', 'ambermage'], max: 8 },
  { id: 'ambre_mesas', x: 680, z: -40, radius: 45, level: [12, 15], types: ['amberwarrior', 'ambermage', 'amberrogue'], max: 7 },
  { id: 'givre_bas', x: -20, z: -620, radius: 50, level: [13, 16], types: ['frostling', 'frostling', 'frostarcher'], max: 8 },
  { id: 'givre_lac', x: -150, z: -660, radius: 36, level: [14, 17], types: ['frostling', 'frostmage', 'frostarcher'], max: 7 },
  { id: 'givre_sanct', x: 95, z: -640, radius: 36, level: [15, 18], types: ['frostguard', 'frostmage', 'frostling'], max: 8 },
  { id: 'givre_mont', x: 15, z: -715, radius: 40, level: [16, 19], types: ['frostguard', 'frostarcher', 'frostmage'], max: 7 },
];

// Pierres de passage : voyage instantané entre celles que l'on a éveillées.
export const WAYSTONES = [
  { id: 'havre', name: 'Havrelumière', x: -9, z: 24 },
  { id: 'cendres', name: 'Les Cendres', x: 14, z: 118 },
  { id: 'pic', name: 'Pied du Pic', x: -36, z: -96 },
  { id: 'givre', name: 'Halte-du-Givre', x: -34, z: -532 },
  { id: 'sanct', name: 'Sanctuaire Gelé', x: 70, z: -628 },
  { id: 'ambre', name: 'Comptoir d’Ambre', x: 572, z: 66 },
  { id: 'gorge', name: 'Gorge Rouge', x: 676, z: 92 },
];

export const BOSS = { id: 'roi', name: 'Le Roi Sans Lumière', x: -12, z: -136, level: 15, respawnMinutes: 8 };

// Boss du monde (un par région) : apparaissent quand des héros approchent de leur arène.
export const WORLD_BOSSES = [
  { id: 'roi', type: 'boss', x: -12, z: -136, minY: 45, level: 15, respawnMinutes: 8, region: 'Pic du Silence' },
  { id: 'colosse', type: 'boss_colosse', x: 810, z: 40, minY: 10, level: 17, respawnMinutes: 8, region: 'Cirque d’Ambre' },
  { id: 'reine', type: 'boss_reine', x: 20, z: -778, minY: 95, level: 20, respawnMinutes: 8, region: 'Mont Givrecroc' },
];

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
  // Terres d'Ambre : os brûlés par le soleil
  amberminion: { name: 'Pillard d’ambre', model: 'skel_minion', tint: '#ffbe7a', hp: 64, atk: 11, def: 4, speed: 3.8, range: 2.6, cd: 1.5, xp: 26, weapon: ['Skeleton_Blade', 'handslot.r'], attack: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Stab'], walk: 'Walking_D_Skeletons', run: 'Running_C' },
  amberwarrior: { name: 'Légionnaire d’ambre', model: 'skel_warrior', tint: '#ffb066', hp: 130, atk: 16, def: 9, speed: 3.2, range: 3.0, cd: 2.0, xp: 44, weapon: ['Skeleton_Axe', 'handslot.r'], shield: ['Skeleton_Shield_Large_A', 'handslot.l'], attack: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Jump_Chop'], walk: 'Walking_D_Skeletons', run: 'Running_A' },
  amberrogue: { name: 'Arbalétrier des sables', model: 'skel_rogue', tint: '#ffcf96', hp: 72, atk: 14, def: 4, speed: 3.9, range: 22, ranged: true, cd: 2.2, xp: 34, weapon: ['Skeleton_Crossbow', 'handslot.r'], attack: ['1H_Ranged_Shoot'], walk: 'Walking_B', run: 'Running_B' },
  ambermage: { name: 'Mage des sables', model: 'skel_mage', tint: '#ffaa6e', hp: 84, atk: 18, def: 3, speed: 3.0, range: 20, ranged: true, caster: true, cd: 2.6, xp: 42, summons: 'amberminion', weapon: ['Skeleton_Staff', 'handslot.r'], attack: ['Spellcast_Shoot', 'Spellcast_Long'], walk: 'Walking_A', run: 'Running_A' },
  // Cimes de Givre : squelettes pris dans la glace (leurs coups ralentissent)
  frostling: { name: 'Squelette de givre', model: 'skel_minion', tint: '#aee0ff', hp: 92, atk: 15, def: 6, speed: 3.7, range: 2.6, cd: 1.5, xp: 38, chill: true, weapon: ['Skeleton_Blade', 'handslot.r'], attack: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Stab'], walk: 'Walking_D_Skeletons', run: 'Running_C' },
  frostguard: { name: 'Garde de givre', model: 'skel_warrior', tint: '#c4e8ff', hp: 190, atk: 21, def: 13, speed: 3.1, range: 3.0, cd: 2.0, xp: 62, chill: true, weapon: ['Skeleton_Axe', 'handslot.r'], shield: ['Skeleton_Shield_Large_A', 'handslot.l'], attack: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Jump_Chop'], walk: 'Walking_D_Skeletons', run: 'Running_A' },
  frostarcher: { name: 'Archer de givre', model: 'skel_rogue', tint: '#b8e4ff', hp: 98, atk: 18, def: 6, speed: 3.9, range: 24, ranged: true, cd: 2.2, xp: 46, chill: true, weapon: ['Skeleton_Crossbow', 'handslot.r'], attack: ['1H_Ranged_Shoot'], walk: 'Walking_B', run: 'Running_B' },
  frostmage: { name: 'Sorcier de givre', model: 'skel_mage', tint: '#9fd8ff', hp: 110, atk: 23, def: 5, speed: 3.0, range: 20, ranged: true, caster: true, cd: 2.5, xp: 56, chill: true, summons: 'frostling', weapon: ['Skeleton_Staff', 'handslot.r'], attack: ['Spellcast_Shoot', 'Spellcast_Long'], walk: 'Walking_A', run: 'Running_A' },
  boss_colosse: { name: 'Le Colosse d’Ambre', model: 'skel_warrior', tint: '#ff9a4a', hp: 3200, atk: 30, def: 12, speed: 3.6, range: 7, cd: 2.0, xp: 1200, scale: 3.0, weapon: ['Skeleton_Axe', 'handslot.r'], shield: ['Skeleton_Shield_Large_A', 'handslot.l'], attack: ['2H_Melee_Attack_Chop', '1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Spin'], walk: 'Walking_D_Skeletons', run: 'Running_A', boss: true, bossId: 'colosse' },
  boss_reine: { name: 'La Reine de Givre', model: 'skel_mage', tint: '#bfeaff', hp: 3800, atk: 34, def: 10, speed: 3.3, range: 18, ranged: true, caster: true, cd: 2.0, xp: 1600, scale: 2.5, chill: true, weapon: ['Skeleton_Staff', 'handslot.r'], attack: ['Spellcast_Shoot', 'Spellcast_Long', 'Spellcast_Summon'], walk: 'Walking_A', run: 'Running_A', boss: true, bossId: 'reine' },
  // boss des expéditions (Citadelle des Ombres)
  boss_sentinelle: { name: 'La Sentinelle d’Os', model: 'skel_warrior', tint: '#ffe2a0', hp: 2600, atk: 26, def: 12, speed: 3.5, range: 7, cd: 2.0, xp: 1000, scale: 2.7, weapon: ['Skeleton_Axe', 'handslot.r'], shield: ['Skeleton_Shield_Large_A', 'handslot.l'], attack: ['2H_Melee_Attack_Chop', '1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Spin'], walk: 'Walking_D_Skeletons', run: 'Running_A', boss: true, bossId: 'sentinelle' },
  boss_liche: { name: 'Morvhain, la Liche', model: 'skel_mage', tint: '#b8ffc8', hp: 3000, atk: 30, def: 9, speed: 3.2, range: 18, ranged: true, caster: true, cd: 1.9, xp: 1300, scale: 2.5, weapon: ['Skeleton_Staff', 'handslot.r'], attack: ['Spellcast_Shoot', 'Spellcast_Long', 'Spellcast_Summon'], walk: 'Walking_A', run: 'Running_A', boss: true, bossId: 'liche' },
  boss_avatar: { name: 'L’Avatar de la Brume', model: 'skel_warrior', tint: '#d9a8ff', hp: 4600, atk: 34, def: 14, speed: 3.7, range: 7.5, cd: 1.8, xp: 2200, scale: 3.4, weapon: ['Skeleton_Axe', 'handslot.r'], shield: ['Skeleton_Shield_Large_A', 'handslot.l'], attack: ['2H_Melee_Attack_Chop', '1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Spin'], walk: 'Walking_D_Skeletons', run: 'Running_A', boss: true, bossId: 'avatar' },
  boss: { name: 'Le Roi Sans Lumière', model: 'skel_warrior', hp: 2200, atk: 26, def: 10, speed: 3.4, range: 6.5, cd: 2.2, xp: 900, scale: 2.6, weapon: ['Skeleton_Axe', 'handslot.r'], shield: ['Skeleton_Shield_Large_A', 'handslot.l'], attack: ['2H_Melee_Attack_Chop', '1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Spin'], walk: 'Walking_D_Skeletons', run: 'Running_A', boss: true, bossId: 'roi' },
};

export function xpForLevel(l) { return Math.round(60 * Math.pow(l, 1.55) + 40 * l); }
export const MAX_LEVEL = 30;
