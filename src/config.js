// Configuration globale du monde d'Aetheria.
// Unités : 1 unité ≈ 0,75 m (un héros KayKit mesure ~2,4 unités).
//
// Le monde est un continent unique entouré d'océan (≈ 3,3 km de côté) : huit zones numérotées
// dont la difficulté grandit en s'éloignant de Havrelumière, et quatre terres sauvages entre elles.

export const WORLD_SEED = 1337;
export const GAME_VERSION = '2.0.0';
// (héritage : ancienne échelle « plan → monde »)
export const W = (v) => v;

// Emprise de la carte de hauteur (carré centré sur l'origine) et niveau de la mer.
export const WORLD_HALF = 1850;
export const SEA_LEVEL = 0;
export const WORLD_BOUNDS = { cx: 0, cz: 0, half: WORLD_HALF };

// Le continent : union de disques (centre, rayon des terres, côte à falaises 0..1).
export const LANDMASS = [
  { id: 'core', x: 0, z: 0, r: 660, cliff: 0.15 },
  { id: 'givre', x: -60, z: -1080, r: 540, cliff: 0.75 },
  { id: 'ambre', x: 1080, z: 40, r: 530, cliff: 0.5 },
  { id: 'sylve', x: 180, z: 1080, r: 530, cliff: 0.2 },
  { id: 'hantee', x: -1060, z: 260, r: 530, cliff: 0.6 },
  { id: 'plateaux', x: 650, z: -700, r: 420, cliff: 0.8 },
  { id: 'recifs', x: 780, z: 720, r: 400, cliff: 0.05 },
  { id: 'saules', x: -640, z: 860, r: 400, cliff: 0.1 },
  { id: 'falaises', x: -700, z: -640, r: 420, cliff: 0.95 },
];

// Zones : nom, niveaux, numéro (les terres sauvages n'en ont pas). Une zone couvre un disque.
export const ZONES = [
  { id: 'pres', n: 1, name: 'Les Prés d’Havrelumière', x: -40, z: 40, r: 330, level: [1, 5], biome: 'temperate' },
  { id: 'bois', n: 2, name: 'Le Bois-Murmure', x: 450, z: 40, r: 250, level: [4, 8], biome: 'temperate' },
  { id: 'cendres', n: 3, name: 'Les Cendres', x: 90, z: 500, r: 250, level: [7, 11], biome: 'temperate' },
  { id: 'pic', n: 4, name: 'Le Pic du Silence', x: -30, z: -480, r: 260, level: [10, 15], biome: 'temperate' },
  { id: 'ambre', n: 5, name: 'Les Terres d’Ambre', x: 1080, z: 40, r: 470, level: [12, 17], biome: 'amber' },
  { id: 'givre', n: 6, name: 'Les Cimes de Givre', x: -60, z: -1080, r: 480, level: [15, 20], biome: 'snow' },
  { id: 'canopee', n: 7, name: 'La Canopée d’Émeraude', x: 180, z: 1080, r: 470, level: [18, 23], biome: 'jungle' },
  { id: 'landes', n: 8, name: 'Les Landes Spectrales', x: -1060, z: 260, r: 470, level: [22, 28], biome: 'haunted' },
  { id: 'falaises', n: 0, name: 'Les Falaises du Couchant', x: -700, z: -640, r: 360, level: [11, 15], biome: 'cliffs' },
  { id: 'plateaux', n: 0, name: 'Les Hauts-Plateaux du Vent', x: 650, z: -700, r: 360, level: [10, 14], biome: 'highland' },
  { id: 'recifs', n: 0, name: 'La Côte des Récifs', x: 780, z: 720, r: 340, level: [16, 19], biome: 'beach' },
  { id: 'saules', n: 0, name: 'Le Marais des Saules', x: -640, z: 860, r: 340, level: [21, 24], biome: 'swamp' },
];

// ------------------------------------------------------------------ Zones 1 à 4 (cœur du continent)
export const VILLAGE = { x: 0, z: 0, radius: 52, height: 14, name: 'Havrelumière' };
export const HAMLET = { x: 300, z: -240, radius: 30, height: 13, name: 'Les Prés-Bas' };
export const LAKE = { x: -300, z: 90, radius: 60, level: 8.6, name: 'Lac Miroir' };
export const HILLS = { x: -280, z: 300, radius: 170, name: 'Collines Ambrées' };
export const FOREST = { x: 450, z: 40, radius: 240, name: 'Bois-Murmure' };
export const RUINS = { x: 90, z: 480, radius: 90, height: 11, name: 'Les Cendres' };
export const MOUNTAIN = { x: -30, z: -480, radius: 230, peak: 120, summitRadius: 22, summitHeight: 104, name: 'Pic du Silence' };
// (héritage) l'île principale n'existe plus : c'est le cœur du continent
export const MAIN_ISLAND = { x: 0, z: 0, radius: 660, coastNoise: 0, baseY: 0 };
// plus d'îlots flottants ni de ponts de corde
export const ISLETS = [];
export const BRIDGES = [];

// ------------------------------------------------------------------ régions (zones 5 à 8 et terres sauvages)
//   peak : montagne (+ plateau sommital) · plateau : terrain aplani · basin : cuvette (lac, arène)
//   mesa : plateau à falaises, avec rampe d'accès · canyon : gorge creusée le long d'une ligne
export const GIVRE = {
  id: 'givre', name: 'Les Cimes de Givre', biome: 'snow', x: -60, z: -1080, radius: 520, seed: 71, baseY: 34,
  camp: { x: -73, z: -761, radius: 30, name: 'Halte-du-Givre' },
  lake: { x: -302, z: -1014, radius: 79, level: 32.5, name: 'Lac de Cristal' },
  peak: { x: 72, z: -1267, radius: 202, peak: 130, summitRadius: 20, summitHeight: 140, name: 'Mont Givrecroc' },
  sanctuary: { x: 237, z: -970, radius: 42, height: 40, name: 'Sanctuaire Gelé' },
  features: [
    { type: 'plateau', x: -73, z: -761, radius: 30, height: 36 },
    { type: 'basin', x: -302, z: -1014, radius: 79, level: 32.5 },
    { type: 'peak', x: 72, z: -1267, radius: 202, height: 130, summitRadius: 20, summitHeight: 140 },
    { type: 'plateau', x: 237, z: -970, radius: 42, height: 40 },
    { type: 'peak', x: -258, z: -1256, radius: 110, height: 52 },
    { type: 'peak', x: 300, z: -800, radius: 80, height: 31 },
  ],
};
export const AMBRE = {
  id: 'ambre', name: 'Les Terres d’Ambre', biome: 'amber', x: 1080, z: 40, radius: 500, seed: 83, baseY: 18,
  camp: { x: 772, z: 66, radius: 30, name: 'Comptoir d’Ambre' },
  mine: { x: 948, z: 348, name: 'Mine de Kessa' },
  cirque: { x: 1322, z: 40, radius: 45, height: 16, name: 'Cirque d’Ambre' },
  features: [
    { type: 'plateau', x: 772, z: 66, radius: 30, height: 20 },
    { type: 'mesa', x: 1058, z: -158, radius: 70, height: 47, rampAngle: 1.7 },
    { type: 'mesa', x: 1234, z: 238, radius: 53, height: 39, rampAngle: -2.2 },
    { type: 'mesa', x: 904, z: -290, radius: 39, height: 36, rampAngle: 0.6 },
    { type: 'basin', x: 1322, z: 40, radius: 45, level: 16, wall: 16 },
    { type: 'canyon', pts: [[860, 282], [992, 194], [1124, 216], [1234, 84]], width: 25, depth: 17 },
    { type: 'plateau', x: 948, z: 348, radius: 23, height: 19 },
  ],
};
export const HANTEE = {
  id: 'hantee', name: 'Les Landes Spectrales', biome: 'haunted', x: -1060, z: 260, radius: 500, seed: 113, baseY: 22,
  camp: { x: -741, z: 238, radius: 30, name: 'Veille-des-Morts' },
  lake: { x: -950, z: 476, radius: 75, level: 21.5, name: 'Marais des Âmes' },
  cemetery: { x: -1038, z: 132, radius: 48, height: 25, name: 'Le Grand Cimetière' },
  crypt: { x: -1324, z: 337, radius: 36, height: 20, name: 'Crypte du Fossoyeur' },
  peak: { x: -1269, z: 7, radius: 123, peak: 57, name: 'Mont des Corbeaux' },
  features: [
    { type: 'plateau', x: -741, z: 238, radius: 30, height: 24 },
    { type: 'plateau', x: -1038, z: 132, radius: 48, height: 25 },
    { type: 'basin', x: -950, z: 476, radius: 75, level: 21.5 },
    { type: 'basin', x: -1324, z: 337, radius: 36, level: 20, wall: 14, gate: 0 },
    { type: 'peak', x: -1269, z: 7, radius: 123, height: 57 },
    { type: 'peak', x: -862, z: -26, radius: 70, height: 23 },
    { type: 'canyon', pts: [[-1170, 546], [-1093, 594], [-1005, 612]], width: 22, depth: 13 },
  ],
};
export const SYLVE = {
  id: 'sylve', name: 'La Canopée d’Émeraude', biome: 'jungle', x: 180, z: 1080, radius: 500, seed: 127, baseY: 16,
  camp: { x: 169, z: 772, radius: 30, name: 'Refuge des Lianes' },
  lake: { x: 26, z: 1124, radius: 84, level: 15.5, name: 'Lac Émeraude' },
  temple: { x: 352, z: 992, radius: 36, height: 22, name: 'Temple Englouti' },
  peak: { x: 290, z: 1282, radius: 128, peak: 81, summitRadius: 18, summitHeight: 96, name: 'Mont Feuillu' },
  features: [
    { type: 'plateau', x: 169, z: 772, radius: 30, height: 18 },
    { type: 'basin', x: 26, z: 1124, radius: 84, level: 15.5 },
    { type: 'plateau', x: 352, z: 992, radius: 36, height: 22 },
    { type: 'peak', x: 290, z: 1282, radius: 128, height: 81, summitRadius: 18, summitHeight: 96 },
    { type: 'peak', x: -18, z: 904, radius: 75, height: 31 },
    { type: 'peak', x: 455, z: 1157, radius: 84, height: 39 },
  ],
};
// terres sauvages entre les zones
export const PLATEAUX = {
  id: 'plateaux', name: 'Les Hauts-Plateaux du Vent', biome: 'highland', x: 650, z: -700, radius: 400, seed: 131, baseY: 30,
  table: { x: 700, z: -760, radius: 70, height: 58, name: 'La Table du Vent' },
  features: [
    { type: 'mesa', x: 700, z: -760, radius: 70, height: 58, rampAngle: 2.4 },
    { type: 'peak', x: 520, z: -880, radius: 100, height: 45 },
    { type: 'peak', x: 820, z: -560, radius: 70, height: 24 },
  ],
};
export const RECIFS = {
  id: 'recifs', name: 'La Côte des Récifs', biome: 'beach', x: 780, z: 720, radius: 380, seed: 137, baseY: 7,
  lake: { x: 760, z: 800, radius: 52, level: 3.2, name: 'Lagune des Récifs' },
  headland: { x: 920, z: 620, name: 'Pointe aux Coquillages' },
  features: [
    { type: 'basin', x: 760, z: 800, radius: 52, level: 3.2 },
    { type: 'peak', x: 920, z: 620, radius: 70, height: 20 },
  ],
};
export const SAULES = {
  id: 'saules', name: 'Le Marais des Saules', biome: 'swamp', x: -640, z: 860, radius: 380, seed: 139, baseY: 6,
  lake: { x: -620, z: 900, radius: 80, level: 4.2, name: 'Étang des Saules' },
  features: [
    { type: 'basin', x: -620, z: 900, radius: 80, level: 4.2 },
    { type: 'peak', x: -760, z: 760, radius: 60, height: 12 },
  ],
};
export const FALAISES = {
  id: 'falaises', name: 'Les Falaises du Couchant', biome: 'cliffs', x: -700, z: -640, radius: 400, seed: 149, baseY: 34,
  peak: { x: -780, z: -720, radius: 150, peak: 74, name: 'Mont du Couchant' },
  belvedere: { x: -560, z: -560, radius: 40, height: 50, name: 'Le Belvédère' },
  features: [
    { type: 'peak', x: -780, z: -720, radius: 150, height: 74 },
    { type: 'plateau', x: -560, z: -560, radius: 40, height: 50 },
    { type: 'peak', x: -620, z: -820, radius: 80, height: 40 },
  ],
};
export const BIG_ISLANDS = [GIVRE, AMBRE, HANTEE, SYLVE];
// col entre le Pic du Silence et les Cimes de Givre, jalonné de lanternes
export const LANTERN_PASS = { x: -150, z: -680, name: 'Col des Lanternes' };
export const REGIONS = [GIVRE, AMBRE, HANTEE, SYLVE, PLATEAUX, RECIFS, SAULES, FALAISES];

// Colonnes de vent ascendantes, au pied des reliefs : on y monte pour planer.
// lift : hauteur de la colonne au-dessus du sol.
export const UPDRAFTS = [
  { x: -110, z: -150, radius: 8, lift: 110 },
  { x: -190, z: -420, radius: 8, lift: 130 },
  { x: 100, z: -390, radius: 8, lift: 120 },
  { x: -560, z: -560, radius: 8, lift: 110 },
  { x: -830, z: -560, radius: 8, lift: 120 },
  { x: 620, z: -640, radius: 8, lift: 110 },
  { x: 770, z: -830, radius: 8, lift: 110 },
  { x: -150, z: -850, radius: 8, lift: 130 },
  { x: 60, z: -1120, radius: 8, lift: 140 },
  { x: 1000, z: -60, radius: 8, lift: 100 },
  { x: 1180, z: 200, radius: 8, lift: 100 },
  { x: 230, z: 850, radius: 8, lift: 130 },
  { x: 300, z: 1150, radius: 8, lift: 120 },
  { x: -860, z: 120, radius: 8, lift: 110 },
  { x: -1180, z: 280, radius: 8, lift: 110 },
  { x: 880, z: 600, radius: 8, lift: 90 },
  { x: -560, z: 780, radius: 8, lift: 90 },
];

// Les Phares : objectif partagé par tous les joueurs du monde (ids et ordre conservés).
export const BEACONS = [
  { id: 'aube', name: "Phare de l'Aube", x: 150, z: -120, radius: 150, decayHours: 18, lore: "Le premier phare, celui qui veille sur Havrelumière." },
  { id: 'murmures', name: 'Phare des Murmures', x: 480, z: 70, radius: 160, decayHours: 14, lore: 'Ses chants apaisent les arbres du Bois-Murmure.' },
  { id: 'cendres', name: 'Phare des Cendres', x: 100, z: 505, radius: 160, decayHours: 12, lore: 'Dressé sur les ruines de la vieille cité.' },
  { id: 'nuees', name: 'Phare du Couchant', x: -560, z: -545, radius: 170, decayHours: 12, lore: "Perché sur le Belvédère, il veille sur les Falaises du Couchant." },
  { id: 'silence', name: 'Phare du Silence', x: -30, z: -493, radius: 200, decayHours: 10, lore: 'Au sommet du pic, gardé par le Roi Sans Lumière.' },
  { id: 'givre', name: 'Phare du Givre', x: -218, z: -860, radius: 176, decayHours: 12, lore: 'Sa flamme bleue fait fondre la glace des Cimes.' },
  { id: 'ambre', name: 'Phare d’Ambre', x: 1080, z: 97, radius: 187, decayHours: 12, lore: 'Dressé au milieu des mesas, il brille comme du miel.' },
  { id: 'ames', name: 'Phare des Âmes', x: -976, z: 216, radius: 176, decayHours: 10, lore: 'Sa lueur pâle guide les morts égarés hors des Landes.' },
  { id: 'emeraude', name: 'Phare d’Émeraude', x: 228, z: 924, radius: 176, decayHours: 12, lore: 'Les lianes de la Canopée s’enroulent autour de sa flamme verte.' },
];

// Routes (polylignes XZ) : le relief s'y aplanit et la terre y est battue.
export const PATHS = [
  // vers l'est : Bois-Murmure, Comptoir d'Ambre, Cirque, Mine
  [[0, 0], [90, -20], [200, 10], [330, 30], [480, 60], [620, 66], [772, 66]],
  [[772, 66], [900, 80], [1080, 97], [1200, 60], [1290, 40]],
  [[1080, 97], [1040, 200], [948, 330]],
  // vers les Prés-Bas et les Hauts-Plateaux
  [[0, 0], [60, -60], [150, -120], [230, -180], [300, -240]],
  [[300, -240], [420, -380], [560, -560], [640, -660]],
  // vers le sud : les Cendres, la Canopée
  [[0, 0], [20, 120], [50, 260], [80, 400], [90, 480]],
  [[90, 480], [120, 620], [169, 772]],
  [[169, 772], [260, 880], [352, 992]],
  [[169, 772], [90, 950], [60, 1040]],
  [[352, 992], [330, 1120], [300, 1250]],
  [[90, 480], [300, 560], [520, 640], [760, 700]],
  // vers l'ouest : Lac Miroir, Landes Spectrales, Marais des Saules
  [[0, 0], [-90, 30], [-200, 60], [-250, 80]],
  [[-250, 80], [-420, 150], [-600, 220], [-741, 238]],
  [[-741, 238], [-880, 190], [-1000, 150], [-1038, 132]],
  [[-1038, 132], [-1180, 250], [-1290, 330]],
  [[-741, 238], [-850, 380], [-910, 450]],
  [[-741, 238], [-700, 500], [-660, 700], [-640, 830]],
  // vers le nord : contournement du Pic, Cimes de Givre
  [[0, 0], [-30, -90], [-110, -200], [-200, -300], [-250, -420]],
  [[-250, -420], [-230, -560], [-150, -680], [-73, -761]],
  [[-73, -761], [60, -860], [200, -950], [237, -970]],
  [[-73, -761], [-200, -900], [-260, -980]],
  [[237, -970], [160, -1100], [100, -1230]],
  // sentier du sommet du Pic
  [[-110, -200], [-60, -280], [-95, -340], [-25, -385], [-65, -435], [-30, -470]],
  // vers les Falaises du Couchant
  [[-250, -420], [-420, -500], [-560, -560], [-680, -620]],
];

// Zones d'apparition des monstres.
export const SPAWN_ZONES = [
  // 1 · Prés d'Havrelumière
  { id: 'collines', x: -280, z: 300, radius: 110, level: [1, 3], types: ['minion', 'slime', 'slime'], max: 11 },
  { id: 'aube', x: 175, z: -160, radius: 70, level: [1, 3], types: ['minion', 'minion', 'rogue', 'slime'], max: 9 },
  { id: 'lac', x: -340, z: 170, radius: 66, level: [2, 4], types: ['minion', 'rogue', 'slime', 'wisp'], max: 8 },
  { id: 'pres', x: 390, z: -330, radius: 60, level: [3, 5], types: ['wolf', 'slime', 'spider', 'minion'], max: 8 },
  { id: 'sud', x: 120, z: 300, radius: 70, level: [3, 5], types: ['wolf', 'spider', 'minion', 'rogue'], max: 8 },
  // 2 · Bois-Murmure
  { id: 'foret', x: 450, z: 40, radius: 170, level: [4, 7], types: ['minion', 'rogue', 'warrior', 'spider', 'wolf'], max: 16 },
  { id: 'foret_est', x: 620, z: -60, radius: 90, level: [6, 8], types: ['wolf', 'spider', 'warrior'], max: 8 },
  // 3 · Les Cendres
  { id: 'cendres', x: 90, z: 480, radius: 100, level: [7, 10], types: ['warrior', 'mage', 'minion', 'rogue', 'spider', 'golem'], max: 15 },
  { id: 'ruines_sud', x: 220, z: 580, radius: 80, level: [9, 11], types: ['warrior', 'mage', 'golem', 'wisp'], max: 9 },
  // 4 · Pic du Silence
  { id: 'montagne', x: -30, z: -380, radius: 110, level: [10, 13], types: ['warrior', 'rogue', 'mage', 'wolf', 'golem'], max: 12 },
  { id: 'pic_haut', x: -60, z: -540, radius: 90, level: [12, 15], types: ['warrior', 'mage', 'golem', 'wisp'], max: 9 },
  // terres sauvages
  { id: 'falaises', x: -700, z: -640, radius: 150, level: [11, 15], types: ['golem', 'wolf', 'warrior', 'rogue'], max: 12 },
  { id: 'nuees', x: -560, z: -540, radius: 60, level: [12, 15], types: ['mage', 'rogue', 'wisp'], max: 7 },
  { id: 'plateaux', x: 650, z: -700, radius: 150, level: [10, 14], types: ['wolf', 'golem', 'spider', 'wisp'], max: 12 },
  { id: 'recifs', x: 800, z: 720, radius: 150, level: [16, 19], types: ['mygale', 'slime_vert', 'luciole', 'spider'], max: 12 },
  { id: 'saules', x: -640, z: 860, radius: 150, level: [21, 24], types: ['slime_vert', 'wraith', 'spider_tomb', 'werewolf'], max: 12 },
  // 5 · Terres d'Ambre
  { id: 'ambre_plaines', x: 915, z: 106, radius: 110, level: [12, 14], types: ['amberminion', 'amberminion', 'amberrogue', 'spider_ambre'], max: 12 },
  { id: 'ambre_gorge', x: 1080, z: 227, radius: 92, level: [14, 16], types: ['amberwarrior', 'amberrogue', 'ambermage', 'spider_ambre', 'golem_ambre'], max: 12 },
  { id: 'ambre_mesas', x: 1036, z: -136, radius: 99, level: [15, 17], types: ['amberwarrior', 'ambermage', 'amberrogue', 'golem_ambre'], max: 11 },
  // 6 · Cimes de Givre
  { id: 'givre_bas', x: -16, z: -926, radius: 110, level: [15, 17], types: ['frostling', 'frostling', 'frostarcher', 'wolf_givre'], max: 12 },
  { id: 'givre_lac', x: -302, z: -1014, radius: 79, level: [16, 18], types: ['frostling', 'frostmage', 'frostarcher', 'wolf_givre', 'wisp'], max: 11 },
  { id: 'givre_sanct', x: 237, z: -970, radius: 79, level: [17, 19], types: ['frostguard', 'frostmage', 'frostling', 'golem_cristal'], max: 12 },
  { id: 'givre_mont', x: 61, z: -1135, radius: 88, level: [18, 20], types: ['frostguard', 'frostarcher', 'frostmage', 'golem_cristal', 'wolf_givre'], max: 11 },
  // 7 · Canopée d'Émeraude
  { id: 'sylve_lisiere', x: 169, z: 871, radius: 92, level: [18, 20], types: ['sylvain', 'sylvain', 'mygale', 'slime_vert', 'luciole'], max: 12 },
  { id: 'sylve_lac', x: 48, z: 1102, radius: 88, level: [19, 21], types: ['slime_vert', 'luciole', 'liane', 'mygale'], max: 11 },
  { id: 'sylve_temple', x: 352, z: 1003, radius: 84, level: [20, 22], types: ['druide', 'liane', 'sylvain', 'golem_mousse'], max: 12 },
  { id: 'sylve_jungle', x: 378, z: 1201, radius: 88, level: [21, 23], types: ['panthere', 'golem_mousse', 'druide', 'mygale'], max: 11 },
  // 8 · Landes Spectrales
  { id: 'hantee_lande', x: -829, z: 106, radius: 97, level: [22, 24], types: ['ghoul', 'ghoul', 'wraith', 'spider_tomb'], max: 12 },
  { id: 'hantee_cimetiere', x: -1038, z: 146, radius: 88, level: [23, 26], types: ['revenant', 'gravearcher', 'ghoul', 'banshee'], max: 14 },
  { id: 'hantee_marais', x: -961, z: 462, radius: 84, level: [24, 27], types: ['wraith', 'werewolf', 'ghoul', 'spider_tomb'], max: 11 },
  { id: 'hantee_corbeaux', x: -1236, z: 73, radius: 92, level: [25, 28], types: ['revenant', 'banshee', 'werewolf', 'golem_os'], max: 11 },
];

// Pierres de passage : voyage instantané entre celles que l'on a éveillées.
export const WAYSTONES = [
  { id: 'havre', name: 'Havrelumière', x: -9, z: 24 },
  { id: 'pres', name: 'Les Prés-Bas', x: 290, z: -226 },
  { id: 'cendres', name: 'Les Cendres', x: 60, z: 450 },
  { id: 'pic', name: 'Pied du Pic', x: -110, z: -260 },
  { id: 'givre', name: 'Halte-du-Givre', x: -47, z: -732 },
  { id: 'sanct', name: 'Sanctuaire Gelé', x: 182, z: -944 },
  { id: 'ambre', name: 'Comptoir d’Ambre', x: 798, z: 97 },
  { id: 'gorge', name: 'Gorge Rouge', x: 1027, z: 154 },
  { id: 'veille', name: 'Veille-des-Morts', x: -723, z: 264 },
  { id: 'cimetiere', name: 'Le Grand Cimetière', x: -976, z: 176 },
  { id: 'lianes', name: 'Refuge des Lianes', x: 193, z: 790 },
  { id: 'temple', name: 'Temple Englouti', x: 308, z: 961 },
  { id: 'plateaux', name: 'Hauts-Plateaux du Vent', x: 643, z: -616 },
  { id: 'recifs', name: 'Côte des Récifs', x: 740, z: 690 },
  { id: 'saules', name: 'Marais des Saules', x: -660, z: 820 },
  { id: 'falaises', name: 'Falaises du Couchant', x: -560, z: -580 },
];

export const BOSS = { id: 'roi', name: 'Le Roi Sans Lumière', x: -30, z: -480, level: 15, respawnMinutes: 8 };

// Boss du monde (un par région) : apparaissent quand des héros approchent de leur arène.
export const WORLD_BOSSES = [
  { id: 'roi', type: 'boss', x: -30, z: -478, minY: 85, level: 15, respawnMinutes: 8, region: 'Pic du Silence' },
  { id: 'colosse', type: 'boss_colosse', x: 1322, z: 40, minY: 10, level: 17, respawnMinutes: 8, region: 'Cirque d’Ambre' },
  { id: 'reine', type: 'boss_reine', x: 72, z: -1274, minY: 128, level: 20, respawnMinutes: 8, region: 'Mont Givrecroc' },
  { id: 'gardien', type: 'boss_gardien', x: 290, z: 1287, minY: 88, level: 23, respawnMinutes: 8, region: 'Mont Feuillu' },
  { id: 'fossoyeur', type: 'boss_fossoyeur', x: -1324, z: 337, minY: 10, level: 28, respawnMinutes: 8, region: 'Crypte du Fossoyeur' },
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
    abilities: ['shieldwall', 'charge', 'rally', 'judgement', 'shieldbash', 'holyblade', 'consecrate', 'divineshield', 'lances', 'avatar'],
  },
  barbarian: {
    id: 'barbarian', name: 'Barbare', model: 'barbarian', title: 'Tempête de fer',
    desc: "Hache à deux mains. Tourbillonne au cœur de la mêlée et puise sa force dans la rage.",
    color: '#ff9a62', role: 'Combattant · Mêlée',
    base: { hp: 140, mp: 50, atk: 15, def: 6, speed: 1.02 },
    perLevel: { hp: 15, mp: 3, atk: 2.8, def: 1.0 },
    weapons: { show: ['2H_Axe'], idle: '2H_Melee_Idle', combo: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Stab'] },
    attackRange: 3.8, attackArc: 1.8, runeBonus: 0.9,
    abilities: ['whirlwind', 'leap', 'rage', 'shatter', 'warcry', 'cleave', 'quake', 'axethrow', 'bloodlust', 'titan'],
  },
  mage: {
    id: 'mage', name: 'Mage', model: 'mage', title: 'Tisseuse d’arcanes',
    desc: "Bâton et grimoire. Maîtrise les runes mieux que quiconque et frappe de loin.",
    color: '#c69bff', role: 'Lanceur de sorts · Distance',
    base: { hp: 100, mp: 140, atk: 14, def: 4, speed: 1.0 },
    perLevel: { hp: 10, mp: 12, atk: 2.6, def: 0.7 },
    weapons: { show: ['2H_Staff'], idle: 'Idle', combo: ['Spellcast_Shoot', 'Spellcast_Shoot'] },
    attackRange: 26, ranged: true, runeBonus: 1.35,
    abilities: ['frostnova', 'blink', 'meteor', 'arcanestorm', 'fireball', 'chain', 'icelances', 'singularity', 'manashield', 'cataclysm'],
  },
  rogue: {
    id: 'rogue', name: 'Rôdeuse', model: 'rogue_hooded', title: 'Ombre des nuées',
    desc: "Arbalète et dagues. Insaisissable, elle crible ses cibles de carreaux à distance.",
    color: '#7ee0a8', role: 'Tireuse · Distance',
    base: { hp: 115, mp: 70, atk: 13, def: 5, speed: 1.08 },
    perLevel: { hp: 12, mp: 5, atk: 2.5, def: 0.9 },
    weapons: { show: ['1H_Crossbow', 'Knife_Offhand'], idle: 'Idle', combo: ['1H_Ranged_Shoot', '1H_Ranged_Shoot'] },
    attackRange: 30, ranged: true, runeBonus: 1.05,
    abilities: ['volley', 'roll', 'smoke', 'piercing', 'multishot', 'trap', 'shadowstep', 'poison', 'fan', 'arrowstorm'],
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

// Plans d'eau où l'on nage : l'océan tout autour, et les lacs (niveau fixe).
export const WATERS = [
  { ...LAKE, kind: 'clear' },
  { ...SYLVE.lake, kind: 'jungle' },
  { ...HANTEE.lake, kind: 'marsh' },
  { ...RECIFS.lake, kind: 'lagoon' },
  { ...SAULES.lake, kind: 'marsh' },
];
