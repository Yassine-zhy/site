// Configuration globale du monde d'Aetheria.
// Unités : 1 unité ≈ 0,75 m (un héros KayKit mesure ~2,4 unités).
//
// Les positions des régions sont écrites sur un « plan » puis agrandies au chargement
// (voir grow() en bas du fichier) : distances ×WORLD_SCALE, îlots ×ISLET_SCALE, sommets
// ×PEAK_SCALE. Le village, les campements et les arènes gardent leur taille.
export const WORLD_SCALE = 2.2;
export const ISLET_SCALE = 2.6;
export const PEAK_SCALE = 1.3;
// plan -> monde (pour les rares positions écrites ailleurs que dans ce fichier)
export const W = (v) => Math.round(v * WORLD_SCALE);

export const WORLD_SEED = 1337;
export const GAME_VERSION = '1.0.0';

export const MAIN_ISLAND = { x: 0, z: 0, radius: 215, coastNoise: 22, baseY: 0 };

export const VILLAGE = { x: 0, z: 0, radius: 52, height: 14, name: 'Havrelumière' };
export const LAKE = { x: -122, z: 34, radius: 30, level: 8.6, name: 'Lac Miroir' };
export const MOUNTAIN = { x: -12, z: -140, radius: 78, peak: 78, summitRadius: 20, summitHeight: 70, name: 'Pic du Silence' };
export const FOREST = { x: 118, z: 14, radius: 72, name: 'Bois-Murmure' };
export const RUINS = { x: 34, z: 132, radius: 46, height: 11, name: 'Les Cendres' };
export const HILLS = { x: -95, z: 120, radius: 70, name: 'Collines Ambrées' };
// hameau agricole au nord-est de l'île (sûr, comme le village)
export const HAMLET = { x: 140, z: -105, radius: 30, height: 13, name: 'Les Prés-Bas' };

// Îlots flottants (relief propre + face inférieure rocheuse).
export const ISLETS = [
  { id: 'nuees', name: 'Îlot des Nuées', x: -300, z: -60, radius: 36, baseY: 42, relief: 7, seed: 11 },
  { id: 'tresor', name: 'Îlot du Trésor', x: 282, z: -96, radius: 23, baseY: 30, relief: 4, seed: 23 },
  { id: 'suspendu', name: 'Îlot Suspendu', x: 228, z: 196, radius: 20, baseY: 6, relief: 3, seed: 37 },
  { id: 'pelerin', name: 'Îlot du Pèlerin', x: -206, z: -244, radius: 21, baseY: 64, relief: 4, seed: 41 },
  { id: 'eclat', name: 'Éclat Errant', x: 96, z: -262, radius: 12, baseY: 22, relief: 2, seed: 53 },
  // îlots-relais vers les Cimes de Givre (nord) et les Terres d'Ambre (est)
  { id: 'passeur', name: 'Rocher du Passeur', x: -22, z: -300, radius: 19, baseY: 30, relief: 3, seed: 61, biome: 'snowy' },
  { id: 'lanternes', name: 'Îlot des Lanternes', x: -48, z: -398, radius: 21, baseY: 36, relief: 4, seed: 67, biome: 'snowy' },
  { id: 'relais', name: 'Îlot du Relais', x: 300, z: 44, radius: 20, baseY: 16, relief: 3, seed: 73, biome: 'dry' },
  { id: 'ventsec', name: 'Îlot du Vent Sec', x: 410, z: 30, radius: 19, baseY: 20, relief: 3, seed: 79, biome: 'dry' },
  // vers les Landes Spectrales (ouest) et la Canopée d'Émeraude (sud)
  { id: 'saules', name: 'Îlot des Saules', x: -290, z: 95, radius: 28, baseY: 12, relief: 3, seed: 89, biome: 'marsh' },
  { id: 'fanal', name: 'Îlot du Fanal', x: -415, z: 125, radius: 26, baseY: 16, relief: 4, seed: 97, biome: 'dusk' },
  { id: 'fougeres', name: 'Îlot des Fougères', x: 60, z: 300, radius: 26, baseY: 9, relief: 3, seed: 101, biome: 'lush' },
  { id: 'cascade', name: 'Îlot de la Cascade', x: 80, z: 430, radius: 28, baseY: 13, relief: 5, seed: 107, biome: 'lush' },
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
// Landes Spectrales : cimetières, marais et crypte (ouest). Niveaux 21-27.
export const HANTEE = {
  id: 'hantee', name: 'Les Landes Spectrales', biome: 'haunted', x: -650, z: 170, radius: 175, coastNoise: 22, seed: 113, depth: 150, baseY: 22,
  camp: { x: -505, z: 160, radius: 24, name: 'Veille-des-Morts' },
  lake: { x: -600, z: 268, radius: 34, level: 21.5, name: 'Marais des Âmes' },
  cemetery: { x: -640, z: 112, radius: 34, height: 25, name: 'Le Grand Cimetière' },
  crypt: { x: -770, z: 205, radius: 24, height: 20, name: 'Crypte du Fossoyeur' },
  peak: { x: -745, z: 55, radius: 56, peak: 44, name: 'Mont des Corbeaux' },
  features: [
    { type: 'plateau', x: -505, z: 160, radius: 24, height: 24 },
    { type: 'plateau', x: -640, z: 112, radius: 34, height: 25 },
    { type: 'basin', x: -600, z: 268, radius: 34, level: 21.5 },
    { type: 'basin', x: -770, z: 205, radius: 24, level: 20, wall: 14, gate: 0 },
    { type: 'peak', x: -745, z: 55, radius: 56, height: 44 },
    { type: 'peak', x: -560, z: 40, radius: 32, height: 18 },
    { type: 'canyon', pts: [[-700, 300], [-665, 322], [-625, 330]], width: 12, depth: 9 },
  ],
};
// Canopée d'Émeraude : jungle, lac et temple englouti (sud). Niveaux 16-22.
export const SYLVE = {
  id: 'sylve', name: 'La Canopée d’Émeraude', biome: 'jungle', x: 100, z: 680, radius: 175, coastNoise: 22, seed: 127, depth: 160, baseY: 16,
  camp: { x: 95, z: 540, radius: 24, name: 'Refuge des Lianes' },
  lake: { x: 30, z: 700, radius: 38, level: 15.5, name: 'Lac Émeraude' },
  temple: { x: 178, z: 640, radius: 26, height: 22, name: 'Temple Englouti' },
  peak: { x: 150, z: 772, radius: 58, peak: 62, summitRadius: 18, summitHeight: 74, name: 'Mont Feuillu' },
  features: [
    { type: 'plateau', x: 95, z: 540, radius: 24, height: 18 },
    { type: 'basin', x: 30, z: 700, radius: 38, level: 15.5 },
    { type: 'plateau', x: 178, z: 640, radius: 26, height: 22 },
    { type: 'peak', x: 150, z: 772, radius: 58, height: 62, summitRadius: 18, summitHeight: 74 },
    { type: 'peak', x: 10, z: 600, radius: 34, height: 24 },
    { type: 'peak', x: 225, z: 715, radius: 38, height: 30 },
  ],
};
export const BIG_ISLANDS = [GIVRE, AMBRE, HANTEE, SYLVE];

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
  { x: -300, z: 70, radius: 6, top: 80 },
  { x: -560, z: 190, radius: 6, top: 96 },
  { x: 70, z: 285, radius: 6, top: 70 },
  { x: 120, z: 560, radius: 6, top: 120 },
  { x: -180, z: 140, radius: 6, top: 90 },
];

// Ponts de corde entre deux îles (ids ; 'main' = île principale). Les extrémités sont
// calculées sur les côtes au chargement (Terrain.resolveBridges).
export const BRIDGES = [
  { a: 'main', b: 'suspendu' },
  { a: 'main', b: 'passeur' },
  { a: 'passeur', b: 'lanternes' },
  { a: 'lanternes', b: 'givre' },
  { a: 'main', b: 'relais' },
  { a: 'relais', b: 'ventsec' },
  { a: 'ventsec', b: 'ambre' },
  { a: 'main', b: 'saules' },
  { a: 'saules', b: 'fanal' },
  { a: 'fanal', b: 'hantee' },
  { a: 'main', b: 'fougeres' },
  { a: 'fougeres', b: 'cascade' },
  { a: 'cascade', b: 'sylve' },
]

// Les Phares : objectif partagé par tous les joueurs du monde.
export const BEACONS = [
  { id: 'aube', name: "Phare de l'Aube", x: 66, z: -52, radius: 70, decayHours: 18, lore: "Le premier phare, celui qui veille sur Havrelumière." },
  { id: 'murmures', name: 'Phare des Murmures', x: 140, z: 36, radius: 72, decayHours: 14, lore: 'Ses chants apaisent les arbres du Bois-Murmure.' },
  { id: 'cendres', name: 'Phare des Cendres', x: 40, z: 146, radius: 72, decayHours: 12, lore: 'Dressé sur les ruines de la vieille cité.' },
  { id: 'nuees', name: 'Phare des Nuées', x: -286, z: -50, radius: 60, decayHours: 12, islet: 'nuees', lore: "Perché au-dessus de la mer de nuages, seul le vent y mène." },
  { id: 'silence', name: 'Phare du Silence', x: -12, z: -146, radius: 90, decayHours: 10, lore: 'Au sommet du pic, gardé par le Roi Sans Lumière.' },
  { id: 'givre', name: 'Phare du Givre', x: -112, z: -590, radius: 80, decayHours: 12, lore: 'Sa flamme bleue fait fondre la glace des Cimes.' },
  { id: 'ambre', name: 'Phare d’Ambre', x: 700, z: 66, radius: 85, decayHours: 12, lore: 'Dressé au milieu des mesas, il brille comme du miel.' },
  { id: 'ames', name: 'Phare des Âmes', x: -612, z: 150, radius: 80, decayHours: 10, lore: 'Sa lueur pâle guide les morts égarés hors des Landes.' },
  { id: 'emeraude', name: 'Phare d’Émeraude', x: 128, z: 598, radius: 80, decayHours: 12, lore: 'Les lianes de la Canopée s’enroulent autour de sa flamme verte.' },
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
  // vers les Prés-Bas
  [[30, -50], [80, -70], [120, -95], [140, -105]],
  // vers les ponts de l'ouest et du sud
  [[-88, 24], [-150, 60], [-205, 70]],
  [[24, 96], [30, 160], [42, 205]],
  // Landes Spectrales
  [[-478, 150], [-505, 160], [-560, 140], [-612, 150], [-640, 112]],
  [[-612, 150], [-615, 215], [-600, 240]],
  [[-640, 112], [-700, 150], [-745, 195]],
  [[-640, 112], [-690, 80], [-730, 70]],
  // Canopée d'Émeraude
  [[95, 508], [95, 540], [128, 598], [178, 640]],
  [[95, 540], [50, 590], [30, 655]],
  [[178, 640], [175, 700], [158, 750]],
];

// Zones d'apparition des squelettes.
export const SPAWN_ZONES = [
  { id: 'collines', x: -95, z: 120, radius: 52, level: [1, 3], types: ['minion', 'slime', 'slime'], max: 7 },
  { id: 'aube', x: 78, z: -70, radius: 34, level: [1, 3], types: ['minion', 'minion', 'rogue', 'slime'], max: 6 },
  { id: 'foret', x: 125, z: 24, radius: 58, level: [3, 6], types: ['minion', 'rogue', 'warrior', 'spider', 'wolf'], max: 9 },
  { id: 'cendres', x: 38, z: 136, radius: 44, level: [5, 9], types: ['warrior', 'mage', 'minion', 'rogue', 'spider', 'golem'], max: 10 },
  { id: 'montagne', x: -10, z: -112, radius: 40, level: [8, 12], types: ['warrior', 'rogue', 'mage', 'wolf', 'golem'], max: 8 },
  { id: 'nuees', x: -282, z: -46, radius: 26, level: [7, 10], types: ['mage', 'rogue', 'wisp'], max: 5 },
  { id: 'lac', x: -150, z: 70, radius: 30, level: [2, 4], types: ['minion', 'rogue', 'slime', 'wisp'], max: 5 },
  { id: 'ambre_plaines', x: 625, z: 70, radius: 50, level: [9, 12], types: ['amberminion', 'amberminion', 'amberrogue', 'spider_ambre'], max: 8 },
  { id: 'ambre_gorge', x: 700, z: 125, radius: 42, level: [11, 14], types: ['amberwarrior', 'amberrogue', 'ambermage', 'spider_ambre', 'golem_ambre'], max: 8 },
  { id: 'ambre_mesas', x: 680, z: -40, radius: 45, level: [12, 15], types: ['amberwarrior', 'ambermage', 'amberrogue', 'golem_ambre'], max: 7 },
  { id: 'givre_bas', x: -20, z: -620, radius: 50, level: [13, 16], types: ['frostling', 'frostling', 'frostarcher', 'wolf_givre'], max: 8 },
  { id: 'givre_lac', x: -150, z: -660, radius: 36, level: [14, 17], types: ['frostling', 'frostmage', 'frostarcher', 'wolf_givre', 'wisp'], max: 7 },
  { id: 'givre_sanct', x: 95, z: -640, radius: 36, level: [15, 18], types: ['frostguard', 'frostmage', 'frostling', 'golem_cristal'], max: 8 },
  { id: 'givre_mont', x: 15, z: -715, radius: 40, level: [16, 19], types: ['frostguard', 'frostarcher', 'frostmage', 'golem_cristal', 'wolf_givre'], max: 7 },
  // île principale agrandie
  { id: 'sud', x: 40, z: 190, radius: 36, level: [4, 7], types: ['wolf', 'spider', 'minion', 'rogue'], max: 6 },
  { id: 'pres', x: 178, z: -150, radius: 34, level: [3, 6], types: ['wolf', 'slime', 'spider', 'minion'], max: 6 },
  { id: 'falaises', x: -175, z: -120, radius: 40, level: [6, 9], types: ['golem', 'wolf', 'warrior', 'rogue'], max: 6 },
  // Canopée d'Émeraude
  { id: 'sylve_lisiere', x: 95, z: 585, radius: 42, level: [16, 18], types: ['sylvain', 'sylvain', 'mygale', 'slime_vert', 'luciole'], max: 8 },
  { id: 'sylve_lac', x: 40, z: 690, radius: 40, level: [17, 19], types: ['slime_vert', 'luciole', 'liane', 'mygale'], max: 7 },
  { id: 'sylve_temple', x: 178, z: 645, radius: 38, level: [18, 21], types: ['druide', 'liane', 'sylvain', 'golem_mousse'], max: 8 },
  { id: 'sylve_jungle', x: 190, z: 735, radius: 40, level: [19, 22], types: ['panthere', 'golem_mousse', 'druide', 'mygale'], max: 7 },
  // Landes Spectrales
  { id: 'hantee_lande', x: -545, z: 100, radius: 44, level: [21, 23], types: ['ghoul', 'ghoul', 'wraith', 'spider_tomb'], max: 8 },
  { id: 'hantee_cimetiere', x: -640, z: 118, radius: 40, level: [22, 25], types: ['revenant', 'gravearcher', 'ghoul', 'banshee'], max: 9 },
  { id: 'hantee_marais', x: -605, z: 262, radius: 38, level: [23, 26], types: ['wraith', 'werewolf', 'ghoul', 'spider_tomb'], max: 7 },
  { id: 'hantee_corbeaux', x: -730, z: 85, radius: 42, level: [24, 27], types: ['revenant', 'banshee', 'werewolf', 'golem_os'], max: 7 },
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
  { id: 'pres', name: 'Les Prés-Bas', x: 132, z: -96 },
  { id: 'veille', name: 'Veille-des-Morts', x: -497, z: 172 },
  { id: 'cimetiere', name: 'Le Grand Cimetière', x: -612, z: 132 },
  { id: 'lianes', name: 'Refuge des Lianes', x: 106, z: 548 },
  { id: 'temple', name: 'Temple Englouti', x: 158, z: 626 },
];

export const BOSS = { id: 'roi', name: 'Le Roi Sans Lumière', x: -12, z: -136, level: 15, respawnMinutes: 8 };

// Boss du monde (un par région) : apparaissent quand des héros approchent de leur arène.
export const WORLD_BOSSES = [
  { id: 'roi', type: 'boss', x: -12, z: -136, minY: 45, level: 15, respawnMinutes: 8, region: 'Pic du Silence' },
  { id: 'colosse', type: 'boss_colosse', x: 810, z: 40, minY: 10, level: 17, respawnMinutes: 8, region: 'Cirque d’Ambre' },
  { id: 'reine', type: 'boss_reine', x: 20, z: -778, minY: 95, level: 20, respawnMinutes: 8, region: 'Mont Givrecroc' },
  { id: 'gardien', type: 'boss_gardien', x: 150, z: 774, minY: 75, level: 23, respawnMinutes: 8, region: 'Mont Feuillu' },
  { id: 'fossoyeur', type: 'boss_fossoyeur', x: -770, z: 205, minY: 10, level: 28, respawnMinutes: 8, region: 'Crypte du Fossoyeur' },
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
  frostguard: { name: 'Garde de givre', model: 'skel_warrior', tint: '#c4e8ff', hp: 190, atk: 21, def: 11, speed: 3.1, range: 3.0, cd: 2.0, xp: 62, chill: true, weapon: ['Skeleton_Axe', 'handslot.r'], shield: ['Skeleton_Shield_Large_A', 'handslot.l'], attack: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Jump_Chop'], walk: 'Walking_D_Skeletons', run: 'Running_A' },
  frostarcher: { name: 'Archer de givre', model: 'skel_rogue', tint: '#b8e4ff', hp: 98, atk: 18, def: 6, speed: 3.9, range: 24, ranged: true, cd: 2.2, xp: 46, chill: true, weapon: ['Skeleton_Crossbow', 'handslot.r'], attack: ['1H_Ranged_Shoot'], walk: 'Walking_B', run: 'Running_B' },
  frostmage: { name: 'Sorcier de givre', model: 'skel_mage', tint: '#9fd8ff', hp: 110, atk: 23, def: 5, speed: 3.0, range: 20, ranged: true, caster: true, cd: 2.5, xp: 56, chill: true, summons: 'frostling', weapon: ['Skeleton_Staff', 'handslot.r'], attack: ['Spellcast_Shoot', 'Spellcast_Long'], walk: 'Walking_A', run: 'Running_A' },
  boss_colosse: { name: 'Le Colosse d’Ambre', model: 'skel_warrior', tint: '#ff9a4a', hp: 3200, atk: 30, def: 12, speed: 3.6, range: 7, cd: 2.0, xp: 1200, scale: 3.0, weapon: ['Skeleton_Axe', 'handslot.r'], shield: ['Skeleton_Shield_Large_A', 'handslot.l'], attack: ['2H_Melee_Attack_Chop', '1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Spin'], walk: 'Walking_D_Skeletons', run: 'Running_A', boss: true, bossId: 'colosse' },
  boss_reine: { name: 'La Reine de Givre', model: 'skel_mage', tint: '#bfeaff', hp: 3800, atk: 34, def: 10, speed: 3.3, range: 18, ranged: true, caster: true, cd: 2.0, xp: 1600, scale: 2.5, chill: true, weapon: ['Skeleton_Staff', 'handslot.r'], attack: ['Spellcast_Shoot', 'Spellcast_Long', 'Spellcast_Summon'], walk: 'Walking_A', run: 'Running_A', boss: true, bossId: 'reine' },
  // boss des expéditions (Citadelle des Ombres)
  boss_sentinelle: { name: 'La Sentinelle d’Os', model: 'skel_warrior', tint: '#ffe2a0', hp: 2600, atk: 26, def: 12, speed: 3.5, range: 7, cd: 2.0, xp: 1000, scale: 2.7, weapon: ['Skeleton_Axe', 'handslot.r'], shield: ['Skeleton_Shield_Large_A', 'handslot.l'], attack: ['2H_Melee_Attack_Chop', '1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Spin'], walk: 'Walking_D_Skeletons', run: 'Running_A', boss: true, bossId: 'sentinelle' },
  boss_liche: { name: 'Morvhain, la Liche', model: 'skel_mage', tint: '#b8ffc8', hp: 3000, atk: 30, def: 9, speed: 3.2, range: 18, ranged: true, caster: true, cd: 1.9, xp: 1300, scale: 2.5, weapon: ['Skeleton_Staff', 'handslot.r'], attack: ['Spellcast_Shoot', 'Spellcast_Long', 'Spellcast_Summon'], walk: 'Walking_A', run: 'Running_A', boss: true, bossId: 'liche' },
  boss_avatar: { name: 'L’Avatar de la Brume', model: 'skel_warrior', tint: '#d9a8ff', hp: 4600, atk: 34, def: 14, speed: 3.7, range: 7.5, cd: 1.8, xp: 2200, scale: 3.4, weapon: ['Skeleton_Axe', 'handslot.r'], shield: ['Skeleton_Shield_Large_A', 'handslot.l'], attack: ['2H_Melee_Attack_Chop', '1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Spin'], walk: 'Walking_D_Skeletons', run: 'Running_A', boss: true, bossId: 'avatar' },
  // créatures de la Brume (modèles et animations générés par le jeu)
  slime: { name: 'Gelée de Brume', plural: 'Gelées de Brume', model: 'proc:slime', hp: 40, atk: 6, def: 1, speed: 3.3, range: 2.2, cd: 1.5, xp: 13, attack: ['attack'], walk: 'walk', run: 'run', radius: 0.8, height: 1.6, creature: true, splits: 'slime_small' },
  slime_small: { name: 'Gelée', model: 'proc:slime', hp: 16, atk: 4, def: 0, speed: 3.8, range: 1.8, cd: 1.3, xp: 5, attack: ['attack'], walk: 'walk', run: 'run', scale: 0.55, radius: 0.8, height: 1.6, creature: true },
  spider: { name: 'Araignée des ruines', plural: 'Araignées des ruines', model: 'proc:spider', hp: 48, atk: 9, def: 2, speed: 4.6, range: 2.4, cd: 1.25, xp: 18, attack: ['attack'], walk: 'walk', run: 'run', radius: 1.0, height: 1.4, creature: true },
  wolf: { name: 'Loup de Brume', plural: 'Loups de Brume', model: 'proc:wolf', hp: 70, atk: 12, def: 3, speed: 5.4, range: 2.5, cd: 1.35, xp: 24, attack: ['attack'], walk: 'walk', run: 'run', radius: 0.9, height: 1.7, creature: true },
  golem: { name: 'Golem de pierre', plural: 'Golems de pierre', model: 'proc:golem', hp: 230, atk: 21, def: 12, speed: 2.5, range: 3.4, cd: 2.6, xp: 64, attack: ['attack'], walk: 'walk', run: 'run', radius: 1.3, height: 3.0, creature: true, aoe: 4.2 },
  wisp: { name: 'Feu follet', plural: 'Feux follets', model: 'proc:wisp', hp: 40, atk: 12, def: 1, speed: 3.6, range: 18, ranged: true, caster: true, cd: 2.4, xp: 22, attack: ['attack'], walk: 'walk', run: 'run', radius: 0.6, height: 2.2, creature: true, projColor: '#7fd4ff' },
  wolf_givre: { name: 'Loup des neiges', plural: 'Loups des neiges', model: 'proc:wolf', tint: '#e8f4ff', hp: 120, atk: 18, def: 6, speed: 5.6, range: 2.5, cd: 1.3, xp: 48, chill: true, attack: ['attack'], walk: 'walk', run: 'run', radius: 0.9, height: 1.7, creature: true },
  golem_cristal: { name: 'Golem de cristal', plural: 'Golems de cristal', model: 'proc:golem', tint: '#bfe8ff', hp: 340, atk: 28, def: 13, speed: 2.6, range: 3.4, cd: 2.5, xp: 95, chill: true, attack: ['attack'], walk: 'walk', run: 'run', radius: 1.3, height: 3.0, creature: true, aoe: 4.4 },
  golem_ambre: { name: 'Golem d’ambre', plural: 'Golems d’ambre', model: 'proc:golem', tint: '#ffb066', hp: 300, atk: 25, def: 14, speed: 2.6, range: 3.4, cd: 2.5, xp: 82, attack: ['attack'], walk: 'walk', run: 'run', radius: 1.3, height: 3.0, creature: true, aoe: 4.3 },
  spider_ambre: { name: 'Scorpionne des sables', plural: 'Scorpionnes des sables', model: 'proc:spider', tint: '#d9894a', hp: 82, atk: 14, def: 4, speed: 4.8, range: 2.4, cd: 1.2, xp: 32, attack: ['attack'], walk: 'walk', run: 'run', radius: 1.0, height: 1.4, creature: true },
  // Canopée d'Émeraude
  sylvain: { name: 'Squelette moussu', model: 'skel_minion', tint: '#8fd88f', hp: 100, atk: 19, def: 7, speed: 3.8, range: 2.6, cd: 1.5, xp: 44, weapon: ['Skeleton_Blade', 'handslot.r'], attack: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Stab'], walk: 'Walking_D_Skeletons', run: 'Running_C' },
  liane: { name: 'Pillard des lianes', model: 'skel_rogue', tint: '#a6e07e', hp: 95, atk: 21, def: 6, speed: 4.0, range: 23, ranged: true, cd: 2.1, xp: 50, weapon: ['Skeleton_Crossbow', 'handslot.r'], attack: ['1H_Ranged_Shoot'], walk: 'Walking_B', run: 'Running_B' },
  druide: { name: 'Druide déchu', model: 'skel_mage', tint: '#7fe8a8', hp: 110, atk: 25, def: 6, speed: 3.0, range: 20, ranged: true, caster: true, cd: 2.5, xp: 60, summons: 'sylvain', weapon: ['Skeleton_Staff', 'handslot.r'], attack: ['Spellcast_Shoot', 'Spellcast_Long'], walk: 'Walking_A', run: 'Running_A' },
  panthere: { name: 'Panthère d’émeraude', plural: 'Panthères d’émeraude', model: 'proc:wolf', tint: '#3d5a40', hp: 125, atk: 23, def: 6, speed: 6.2, range: 2.5, cd: 1.2, xp: 58, attack: ['attack'], walk: 'walk', run: 'run', radius: 0.9, height: 1.7, creature: true, scale: 1.15 },
  mygale: { name: 'Mygale émeraude', plural: 'Mygales émeraude', model: 'proc:spider', tint: '#5fae52', hp: 88, atk: 19, def: 5, speed: 4.9, range: 2.4, cd: 1.2, xp: 45, attack: ['attack'], walk: 'walk', run: 'run', radius: 1.0, height: 1.4, creature: true, scale: 1.2 },
  slime_vert: { name: 'Gelée de sève', plural: 'Gelées de sève', model: 'proc:slime', tint: '#6cff8a', hp: 80, atk: 15, def: 3, speed: 3.4, range: 2.2, cd: 1.5, xp: 38, attack: ['attack'], walk: 'walk', run: 'run', radius: 0.8, height: 1.6, creature: true, splits: 'slime_small', scale: 1.25 },
  luciole: { name: 'Luciole géante', plural: 'Lucioles géantes', model: 'proc:wisp', tint: '#d4ff70', hp: 64, atk: 21, def: 3, speed: 3.8, range: 18, ranged: true, caster: true, cd: 2.2, xp: 42, attack: ['attack'], walk: 'walk', run: 'run', radius: 0.6, height: 2.2, creature: true, projColor: '#d8ff7a' },
  golem_mousse: { name: 'Golem moussu', plural: 'Golems moussus', model: 'proc:golem', tint: '#7da35a', hp: 290, atk: 31, def: 13, speed: 2.6, range: 3.4, cd: 2.5, xp: 106, attack: ['attack'], walk: 'walk', run: 'run', radius: 1.3, height: 3.0, creature: true, aoe: 4.4 },
  // Landes Spectrales
  ghoul: { name: 'Goule', model: 'skel_minion', tint: '#a9d39a', hp: 112, atk: 20, def: 8, speed: 4.1, range: 2.6, cd: 1.4, xp: 58, weapon: ['Skeleton_Blade', 'handslot.r'], attack: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Stab'], walk: 'Walking_D_Skeletons', run: 'Running_C' },
  revenant: { name: 'Revenant', model: 'skel_warrior', tint: '#9a8cc8', hp: 215, atk: 27, def: 12, speed: 3.3, range: 3.0, cd: 1.9, xp: 92, weapon: ['Skeleton_Axe', 'handslot.r'], shield: ['Skeleton_Shield_Large_A', 'handslot.l'], attack: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Jump_Chop'], walk: 'Walking_D_Skeletons', run: 'Running_A' },
  gravearcher: { name: 'Arbalétrier des tombes', model: 'skel_rogue', tint: '#b2a6d8', hp: 118, atk: 24, def: 8, speed: 4.0, range: 24, ranged: true, cd: 2.0, xp: 68, weapon: ['Skeleton_Crossbow', 'handslot.r'], attack: ['1H_Ranged_Shoot'], walk: 'Walking_B', run: 'Running_B' },
  banshee: { name: 'Banshie', model: 'skel_mage', tint: '#d8c4ff', hp: 128, atk: 28, def: 7, speed: 3.1, range: 20, ranged: true, caster: true, cd: 2.4, xp: 80, summons: 'ghoul', weapon: ['Skeleton_Staff', 'handslot.r'], attack: ['Spellcast_Shoot', 'Spellcast_Long'], walk: 'Walking_A', run: 'Running_A' },
  wraith: { name: 'Spectre', plural: 'Spectres', model: 'proc:wisp', tint: '#b384ff', hp: 82, atk: 23, def: 4, speed: 3.8, range: 19, ranged: true, caster: true, cd: 2.2, xp: 56, attack: ['attack'], walk: 'walk', run: 'run', radius: 0.6, height: 2.2, creature: true, projColor: '#c79bff' },
  werewolf: { name: 'Loup-garou', plural: 'Loups-garous', model: 'proc:wolf', tint: '#565067', hp: 175, atk: 28, def: 9, speed: 6.0, range: 2.6, cd: 1.25, xp: 88, attack: ['attack'], walk: 'walk', run: 'run', radius: 0.9, height: 1.7, creature: true, scale: 1.35 },
  spider_tomb: { name: 'Veuve des tombes', plural: 'Veuves des tombes', model: 'proc:spider', tint: '#4a4058', hp: 102, atk: 22, def: 7, speed: 5.0, range: 2.4, cd: 1.15, xp: 60, attack: ['attack'], walk: 'walk', run: 'run', radius: 1.0, height: 1.4, creature: true, scale: 1.15 },
  golem_os: { name: 'Colosse d’os', plural: 'Colosses d’os', model: 'proc:golem', tint: '#e2d8c4', hp: 320, atk: 33, def: 14, speed: 2.7, range: 3.5, cd: 2.4, xp: 130, attack: ['attack'], walk: 'walk', run: 'run', radius: 1.3, height: 3.0, creature: true, aoe: 4.6 },
  boss_gardien: { name: 'Le Gardien Sylvestre', model: 'skel_mage', tint: '#9cf08a', hp: 3800, atk: 36, def: 13, speed: 3.3, range: 18, ranged: true, caster: true, cd: 1.9, xp: 2000, scale: 2.7, weapon: ['Skeleton_Staff', 'handslot.r'], attack: ['Spellcast_Shoot', 'Spellcast_Long', 'Spellcast_Summon'], walk: 'Walking_A', run: 'Running_A', boss: true, bossId: 'gardien' },
  boss_fossoyeur: { name: 'Le Fossoyeur', model: 'skel_warrior', tint: '#8f7fd0', hp: 4600, atk: 38, def: 17, speed: 3.7, range: 7.5, cd: 1.8, xp: 2800, scale: 3.3, weapon: ['Skeleton_Axe', 'handslot.r'], shield: ['Skeleton_Shield_Large_A', 'handslot.l'], attack: ['2H_Melee_Attack_Chop', '1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Spin'], walk: 'Walking_D_Skeletons', run: 'Running_A', boss: true, bossId: 'fossoyeur' },
  boss: { name: 'Le Roi Sans Lumière', model: 'skel_warrior', hp: 2200, atk: 26, def: 10, speed: 3.4, range: 6.5, cd: 2.2, xp: 900, scale: 2.6, weapon: ['Skeleton_Axe', 'handslot.r'], shield: ['Skeleton_Shield_Large_A', 'handslot.l'], attack: ['2H_Melee_Attack_Chop', '1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Spin'], walk: 'Walking_D_Skeletons', run: 'Running_A', boss: true, bossId: 'roi' },
};

export function xpForLevel(l) { return Math.round(60 * Math.pow(l, 1.55) + 40 * l); }
export const MAX_LEVEL = 30;

// Plans d'eau où l'on nage (lac Miroir, lac Émeraude, marais des Âmes) ; remplis par grow().
export const WATERS = [];

// Emprise de tout l'archipel (carte du monde, Brume) : carré centré sur (cx, cz).
export const WORLD_BOUNDS = { cx: 0, cz: 0, half: 1000 };

// ------------------------------------------------------------------ agrandissement
// Toutes les positions ci-dessus sont sur le plan ; on les porte à l'échelle du monde.
function grow() {
  const S = WORLD_SCALE;
  const xz = (o) => { if (o) { o.x = W(o.x); o.z = W(o.z); } return o; };
  const r = (v, k) => Math.round(v * k);
  MAIN_ISLAND.radius = W(MAIN_ISLAND.radius); MAIN_ISLAND.coastNoise = W(MAIN_ISLAND.coastNoise);
  xz(LAKE); LAKE.radius = r(LAKE.radius, 1.8);
  xz(MOUNTAIN); MOUNTAIN.radius = W(MOUNTAIN.radius); MOUNTAIN.peak = r(MOUNTAIN.peak, 1.35); MOUNTAIN.summitHeight = r(MOUNTAIN.summitHeight, 1.35);
  for (const o of [FOREST, HILLS]) { xz(o); o.radius = W(o.radius); }
  xz(HAMLET);
  xz(RUINS); RUINS.radius = r(RUINS.radius, 1.6);
  for (const i of ISLETS) { xz(i); i.radius = r(i.radius, ISLET_SCALE); i.relief = Math.round(i.relief * 18) / 10; }
  for (const b of BIG_ISLANDS) {
    xz(b); b.radius = W(b.radius); b.coastNoise = W(b.coastNoise); b.depth = r(b.depth, 1.6);
    for (const k of ['camp', 'lake', 'peak', 'sanctuary', 'mine', 'cirque', 'cemetery', 'crypt', 'temple']) xz(b[k]);
    if (b.camp) b.camp.radius = r(b.camp.radius, 1.25);
    if (b.lake) b.lake.radius = W(b.lake.radius);
    if (b.peak) { b.peak.radius = W(b.peak.radius); if (b.peak.peak) b.peak.peak = r(b.peak.peak, PEAK_SCALE); if (b.peak.summitHeight) b.peak.summitHeight = r(b.peak.summitHeight, PEAK_SCALE); }
    for (const k of ['sanctuary', 'cemetery', 'temple']) if (b[k]) b[k].radius = r(b[k].radius, 1.4);
    if (b.cirque) b.cirque.radius = r(b.cirque.radius, 1.5);
    if (b.crypt) b.crypt.radius = r(b.crypt.radius, 1.5);
    for (const f of b.features) {
      if (f.type === 'canyon') { f.pts = f.pts.map(([x, z]) => [W(x), W(z)]); f.width = r(f.width, 1.8); f.depth = r(f.depth, 1.4); continue; }
      xz(f);
      if (f.type === 'plateau') f.radius = r(f.radius, f.radius >= 26 ? 1.4 : 1.25);
      else if (f.type === 'peak') { f.radius = W(f.radius); f.height = r(f.height, PEAK_SCALE); if (f.summitHeight) f.summitHeight = r(f.summitHeight, PEAK_SCALE); }
      else if (f.type === 'basin') f.radius = f.wall ? r(f.radius, 1.5) : W(f.radius);
      else if (f.type === 'mesa') { f.radius = r(f.radius, S * 0.8); f.height = r(f.height, 1.3); }
    }
  }
  for (const u of UPDRAFTS) { xz(u); u.radius = r(u.radius, 1.3); u.top = r(u.top, 1.3); }
  for (const b of BEACONS) { xz(b); b.radius = W(b.radius); }
  for (const p of PATHS) for (const pt of p) { pt[0] = W(pt[0]); pt[1] = W(pt[1]); }
  for (const z of SPAWN_ZONES) { xz(z); z.radius = W(z.radius); z.max = Math.round(z.max * 1.5); }
  for (const w of WAYSTONES) if (w.id !== 'havre') xz(w);
  for (const b of WORLD_BOSSES) xz(b);
  xz(BOSS);
  // altitudes des arènes après le relèvement des sommets
  const minY = { roi: 66, reine: 128, gardien: 88 };
  for (const b of WORLD_BOSSES) if (minY[b.id]) b.minY = minY[b.id];
  WATERS.push({ ...LAKE, kind: 'clear' }, { ...SYLVE.lake, kind: 'jungle' }, { ...HANTEE.lake, kind: 'marsh' });
  // emprise du monde
  const all = [{ x: MAIN_ISLAND.x, z: MAIN_ISLAND.z, r: MAIN_ISLAND.radius + MAIN_ISLAND.coastNoise }, ...ISLETS.map((i) => ({ x: i.x, z: i.z, r: i.radius * 1.25 })), ...BIG_ISLANDS.map((b) => ({ x: b.x, z: b.z, r: b.radius + b.coastNoise }))];
  const x0 = Math.min(...all.map((o) => o.x - o.r)), x1 = Math.max(...all.map((o) => o.x + o.r));
  const z0 = Math.min(...all.map((o) => o.z - o.r)), z1 = Math.max(...all.map((o) => o.z + o.r));
  WORLD_BOUNDS.cx = Math.round((x0 + x1) / 2); WORLD_BOUNDS.cz = Math.round((z0 + z1) / 2);
  WORLD_BOUNDS.half = Math.round(Math.max(x1 - x0, z1 - z0) / 2 + 60);
}
grow();

