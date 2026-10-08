import { h } from '../ui/dom.js';
import { BEACONS, MOUNTAIN, RUINS, LAKE, FOREST, HAMLET, SPAWN_ZONES, ENEMIES, GIVRE, AMBRE, HANTEE, SYLVE, PLATEAUX, RECIFS, SAULES, FALAISES, LANTERN_PASS, WAYSTONES, UPDRAFTS, WORLD_BOSSES, W } from '../config.js';
import { BOSS_KITS } from './Boss.js';
import { ITEMS_GATHER, RING_SETS } from './Gathering.js';
import { EXP_PORTAL } from './Expedition.js';
import { TREASURE_SPOTS, CHEST_TIERS } from './Chests.js';
import { RARITY } from './Items.js';
import { generateItem } from './Items.js';
import { RUNE_SPELLS } from './Runes.js';
import { hasTutorial } from '../ui/Tutorials.js';
import { MAIN_TEXT } from './Lore.js';

const ROOM_LABEL = { tavern: 'à la taverne', forge: 'dans sa forge', guild: 'à la guilde', chapel: 'à la chapelle', home: 'chez lui', tower: 'dans sa tour' };

// Lieux à atteindre (les clés sont conservées pour les sauvegardes en cours)
export const PLACES = {
  nuees: { name: 'le Belvédère du Couchant', x: FALAISES.belvedere.x, z: FALAISES.belvedere.z, r: 40 },
  tresor: { name: 'la Pointe aux Coquillages', x: RECIFS.headland.x, z: RECIFS.headland.z, r: 45 },
  suspendu: { name: 'la Butte aux Vents', x: -110, z: -150, r: 26 },
  pelerin: { name: 'la Croisée du Pèlerin', x: -250, z: 80, r: 26 },
  eclat: { name: 'la Table du Vent', x: PLATEAUX.table.x, z: PLATEAUX.table.z, r: 55, minY: 48 },
  sommet: { name: 'le sommet du Pic du Silence', x: MOUNTAIN.x, z: MOUNTAIN.z + 2, r: 48, minY: 90 },
  ruines: { name: 'les Cendres', x: RUINS.x, z: RUINS.z, r: 45 },
  lac: { name: 'le Lac Miroir', x: LAKE.x, z: LAKE.z, r: 60 },
  foret: { name: 'le cœur du Bois-Murmure', x: FOREST.x, z: FOREST.z, r: 60 },
  relais: { name: 'le Relais des Plateaux', x: 630, z: -650, r: 40 },
  lanternes: { name: 'le Col des Lanternes', x: LANTERN_PASS.x, z: LANTERN_PASS.z, r: 34 },
  comptoir: { name: 'le Comptoir d’Ambre', x: AMBRE.camp.x, z: AMBRE.camp.z, r: 28 },
  mine: { name: 'la Mine de Kessa', x: AMBRE.mine.x, z: AMBRE.mine.z, r: 26 },
  cirque: { name: 'le Cirque d’Ambre', x: AMBRE.cirque.x, z: AMBRE.cirque.z, r: 34 },
  mesa: { name: 'le sommet de la Grande Mesa', x: 1058, z: -158, r: 40, minY: 42 },
  halte: { name: 'la Halte-du-Givre', x: GIVRE.camp.x, z: GIVRE.camp.z, r: 28 },
  cristal: { name: 'le Lac de Cristal', x: GIVRE.lake.x, z: GIVRE.lake.z, r: 70 },
  sanctuaire: { name: 'le Sanctuaire Gelé', x: GIVRE.sanctuary.x, z: GIVRE.sanctuary.z, r: 34 },
  givrecroc: { name: 'le sommet du Mont Givrecroc', x: GIVRE.peak.x, z: GIVRE.peak.z - 7, r: 48, minY: 128 },
  saules: { name: 'l’Étang des Saules', x: SAULES.lake.x, z: SAULES.lake.z, r: 90 },
  fanal: { name: 'le camp de la Côte des Récifs', x: 742, z: 668, r: 32 },
  fougeres: { name: 'la Lisière des Fougères', x: 150, z: 700, r: 40 },
  cascade: { name: 'les Falaises du Couchant', x: FALAISES.x, z: FALAISES.z, r: 120 },
  plateaux: { name: 'les Hauts-Plateaux du Vent', x: PLATEAUX.x, z: PLATEAUX.z, r: 130 },
  pres: { name: 'les Prés-Bas', x: HAMLET.x, z: HAMLET.z, r: 30 },
  falaises: { name: 'les Falaises du Couchant', x: FALAISES.x, z: FALAISES.z, r: 120 },
  prairie: { name: 'la Prairie du Sud', x: 120, z: 300, r: 60 },
  lianes: { name: 'le Refuge des Lianes', x: SYLVE.camp.x, z: SYLVE.camp.z, r: 28 },
  emeraude: { name: 'le Lac Émeraude', x: SYLVE.lake.x, z: SYLVE.lake.z, r: 70 },
  temple: { name: 'le Temple Englouti', x: SYLVE.temple.x, z: SYLVE.temple.z, r: 32 },
  feuillu: { name: 'le sommet du Mont Feuillu', x: SYLVE.peak.x, z: SYLVE.peak.z + 5, r: 48, minY: 86 },
  veille: { name: 'la Veille-des-Morts', x: HANTEE.camp.x, z: HANTEE.camp.z, r: 28 },
  cimetiere: { name: 'le Grand Cimetière', x: HANTEE.cemetery.x, z: HANTEE.cemetery.z, r: 50 },
  marais: { name: 'le Marais des Âmes', x: HANTEE.lake.x, z: HANTEE.lake.z, r: 70 },
  corbeaux: { name: 'le Mont des Corbeaux', x: HANTEE.peak.x, z: HANTEE.peak.z, r: 40, minY: 60 },
  crypte: { name: 'la Crypte du Fossoyeur', x: HANTEE.crypt.x, z: HANTEE.crypt.z, r: 34 },
};
export const ZONE_NAMES = Object.fromEntries(SPAWN_ZONES.map((z) => [z.id, {
  collines: 'les Collines Ambrées', aube: 'les abords du Phare de l’Aube', foret: 'le Bois-Murmure', cendres: 'les Cendres', montagne: 'le Pic du Silence', nuees: 'le Belvédère du Couchant', lac: 'les rives du Lac Miroir',
  ambre_plaines: 'les plaines d’Ambre', ambre_gorge: 'la Gorge Rouge', ambre_mesas: 'les Mesas', givre_bas: 'les contreforts du Givre', givre_lac: 'les rives du Lac de Cristal', givre_sanct: 'le Sanctuaire Gelé', givre_mont: 'les pentes du Mont Givrecroc',
  sud: 'la Prairie du Sud', falaises: 'les Falaises du Couchant', pres: 'les champs des Prés-Bas',
  foret_est: 'l’orée est du Bois-Murmure', ruines_sud: 'les ruines du sud', pic_haut: 'les hauteurs du Pic', plateaux: 'les Hauts-Plateaux du Vent', recifs: 'la Côte des Récifs', saules: 'le Marais des Saules',
  sylve_lisiere: 'la lisière de la Canopée', sylve_lac: 'les rives du Lac Émeraude', sylve_temple: 'le Temple Englouti', sylve_jungle: 'la jungle du Mont Feuillu',
  hantee_lande: 'les Landes Spectrales', hantee_cimetiere: 'le Grand Cimetière', hantee_marais: 'le Marais des Âmes', hantee_corbeaux: 'le Mont des Corbeaux',
}[z.id]]));
const BOSS_OF = Object.fromEntries(WORLD_BOSSES.map((b) => [b.id, b]));

// Texte d'un objectif
export function objectiveText(o) {
  switch (o.type) {
    case 'talk': return `Parler à ${o.npcName || o.npc}`;
    case 'kill': { const E = o.enemy && o.enemy !== 'any' ? ENEMIES[o.enemy] : null; const nm = E ? (o.count > 1 ? (E.plural || E.name + 's') : E.name) : (o.count > 1 ? 'monstres' : 'monstre'); return `Vaincre ${o.count} ${nm.charAt(0).toLowerCase() + nm.slice(1)}${o.zone ? ' dans ' + ZONE_NAMES[o.zone] : ''}`; }
    case 'light': return `Offrir ${o.count} % de lumière ${o.beacon && o.beacon !== 'any' ? 'au ' + BEACONS.find((b) => b.id === o.beacon).name : 'aux Phares'}`;
    case 'rune': return `Tracer ${o.rune && o.rune !== 'any' ? 'la rune ' + RUNE_SPELLS[o.rune].name : 'une rune'}${o.minScore ? ` (précision ≥ ${Math.round(o.minScore * 100)} %)` : ''}${o.count > 1 ? ' ' + o.count + ' fois' : ''}`;
    case 'visit': return `Atteindre ${PLACES[o.place].name}`;
    case 'glide': return 'Planer avec la paravoile (Espace deux fois)';
    case 'echo': return 'Graver un écho (touche T)';
    case 'loot': return o.minRarity ? `Obtenir ${o.count > 1 ? o.count + ' objets' : 'un objet'} ${RARITY[o.minRarity].name.toLowerCase()} ou mieux` : `Récupérer ${o.count} objet${o.count > 1 ? 's' : ''} sur les squelettes`;
    case 'treasure': { const sp = o.spot && TREASURE_SPOTS.find((t) => t.id === o.spot); return sp ? `Ouvrir le coffre caché : ${sp.name}` : `Trouver et ouvrir ${o.count} coffre${o.count > 1 ? 's' : ''} caché${o.count > 1 ? 's' : ''}`; }
    case 'openchest': return `Ouvrir ${o.count} coffre${o.count > 1 ? 's' : ''}${o.tier ? ' (' + CHEST_TIERS[o.tier].name.toLowerCase() + ' ou mieux)' : ''}`;
    case 'wave': return `Repousser ${o.count > 1 ? o.count + ' vagues' : 'une vague'} de la Brume`;
    case 'boss': return `Terrasser ${BOSS_KITS[o.boss || 'roi']?.name || 'le Roi Sans Lumière'}`;
    case 'collect': return `Récolter ${o.count} ${ITEMS_GATHER[o.item]?.plural || 'ressources'}`;
    case 'waystone': return `Éveiller ${o.count} pierre${o.count > 1 ? 's' : ''} de passage`;
    case 'updraft': return 'Monter dans une colonne de vent';
    case 'rings': return `Traverser ${o.count} anneaux de vent (${RING_SETS[o.set]?.name || 'en planant'})`;
    case 'elite': return `Vaincre ${o.count} squelette${o.count > 1 ? 's' : ''} d’élite (dorés)`;
    case 'expedition': return 'Réussir une expédition (Portail des Expéditions)';
    case 'level': return `Atteindre le niveau ${o.count}`;
    case 'ventus': return 'Se propulser avec la rune Ventus (spirale)';
    case 'beaconLit': return `Rallumer ${BEACONS.find((b) => b.id === o.beacon)?.name || 'un phare'} (100 %)`;
    default: return o.text || '…';
  }
}

// Quêtes principales (scénario)
const MAIN = [
  { id: 'm1', giver: 'elder', title: 'Le Réveil', desc: "Vous ouvrez les yeux au pied du Cœur de Lumière. Maëlis, l'Ancienne, vous attend près de l'église.", objectives: [{ type: 'talk', npc: 'elder', npcName: 'Maëlis' }], rewards: { xp: 40, gold: 10 } },
  { id: 'm2', giver: 'elder', title: 'Les os qui marchent', desc: "La Brume relève les morts autour du Phare de l'Aube, à l'est du village. Montrez-leur que les vivants ne reculent plus.", objectives: [{ type: 'kill', count: 4 }], rewards: { xp: 120, gold: 25, item: 1 } },
  { id: 'm3', giver: 'elder', title: 'La première flamme', desc: "Un phare ne brille que si on le nourrit. Tracez une rune, puis offrez de la lumière au Phare de l'Aube : vaincre des squelettes près de lui, tracer Lux (un trait vertical) ou le canaliser avec E.", objectives: [{ type: 'rune', count: 1 }, { type: 'light', beacon: 'aube', count: 8 }], rewards: { xp: 200, gold: 30 } },
  { id: 'm4', giver: 'guard', title: 'Les ailes du vent', desc: "Sir Aldric veut voir si vous savez voler. Sautez, puis appuyez à nouveau sur Espace pour ouvrir la paravoile. Rejoignez ensuite la Butte aux Vents, au nord-ouest du village, où souffle une colonne de vent.", objectives: [{ type: 'glide' }, { type: 'visit', place: 'suspendu' }], rewards: { xp: 260, gold: 40 } },
  { id: 'm5', giver: 'elder', title: 'Murmures dans le bois', desc: "Le Bois-Murmure ne chante plus. Purgez la forêt et ravivez le Phare des Murmures.", objectives: [{ type: 'kill', zone: 'foret', count: 8 }, { type: 'light', beacon: 'murmures', count: 10 }], rewards: { xp: 520, gold: 60, item: 1 } },
  { id: 'm6', giver: 'elder', title: 'La cité des cendres', desc: "Au sud, les ruines de l'ancienne cité grouillent de guerriers et de nécromanciens.", objectives: [{ type: 'kill', zone: 'cendres', count: 10 }, { type: 'light', beacon: 'cendres', count: 10 }], rewards: { xp: 900, gold: 90, item: 2 } },
  { id: 'm7', giver: 'guard', title: 'Le phare des falaises', desc: "À l'ouest du Pic, les Falaises du Couchant tombent à pic dans la mer. Grimpez jusqu'au Belvédère et ravivez le Phare du Couchant.", objectives: [{ type: 'visit', place: 'nuees' }, { type: 'light', beacon: 'nuees', count: 10 }], rewards: { xp: 1300, gold: 120, item: 2 } },
  { id: 'm8', giver: 'elder', title: 'Le Roi Sans Lumière', desc: "La route en lacets du Pic du Silence mène au Trône où le Roi Sans Lumière tient sa cour. Allez-y à plusieurs si vous le pouvez.", objectives: [{ type: 'visit', place: 'sommet' }, { type: 'boss', boss: 'roi' }], rewards: { xp: 3000, gold: 400, item: 3 } },
  { id: 'm9', giver: 'pip', title: 'Vers les Terres d’Ambre', desc: "Pip a terminé sa grande carte : le continent est immense ! À l'est, au-delà du Bois-Murmure, s'étendent les Terres d'Ambre. Suivez la grand-route jusqu'au Comptoir d'Ambre et présentez-vous à Kessa.", objectives: [{ type: 'visit', place: 'comptoir' }, { type: 'talk', npc: 'kessa', npcName: 'Kessa' }], rewards: { xp: 1400, gold: 120 } },
  { id: 'm10', giver: 'kessa', title: 'Le Comptoir assiégé', desc: "Les pillards d'ambre rôdent autour du Comptoir. Chassez-les et offrez de la lumière au Phare d'Ambre, au milieu des mesas.", objectives: [{ type: 'kill', zone: 'ambre_plaines', count: 8 }, { type: 'light', beacon: 'ambre', count: 10 }], rewards: { xp: 1800, gold: 160, item: 2 } },
  { id: 'm11', giver: 'tarek', title: 'Le cœur du Colosse', desc: "Le Colosse d'Ambre, gardien déchu du Cirque, a perdu son cœur dans la Brume. Libérez-le de sa malédiction. N'y allez pas seuls si vous le pouvez.", objectives: [{ type: 'visit', place: 'cirque' }, { type: 'boss', boss: 'colosse' }], rewards: { xp: 3200, gold: 420, item: 3 } },
  { id: 'm12', giver: 'elder', title: 'Vers les Cimes', desc: "Au nord, au-delà du Pic du Silence, la route du col mène aux Cimes de Givre. Rejoignez la Halte-du-Givre et parlez à Bjorn le trappeur.", objectives: [{ type: 'visit', place: 'halte' }, { type: 'talk', npc: 'bjorn', npcName: 'Bjorn' }], rewards: { xp: 2000, gold: 150 } },
  { id: 'm13', giver: 'neige', title: 'Le Sanctuaire Gelé', desc: "Les gardes de givre ont envahi le Sanctuaire. Repoussez-les, puis rallumez le Phare du Givre près du camp.", objectives: [{ type: 'kill', zone: 'givre_sanct', count: 10 }, { type: 'light', beacon: 'givre', count: 10 }], rewards: { xp: 2600, gold: 200, item: 2 } },
  { id: 'm14', giver: 'neige', title: 'La Reine de Givre', desc: "Au sommet du Mont Givrecroc, la Reine de Givre chante la colère de la glace. Montez, et apaisez-la.", objectives: [{ type: 'visit', place: 'givrecroc' }, { type: 'boss', boss: 'reine' }], rewards: { xp: 4200, gold: 520, item: 3 } },
  // Canopée d'Émeraude (sud)
  { id: 'm16', giver: 'pip', title: 'Les terres du sud', desc: "Pip a aperçu une jungle immense au sud, au-delà des Cendres. Passez la Lisière des Fougères, puis suivez la route jusqu'au Refuge des Lianes et présentez-vous à Liora.", objectives: [{ type: 'visit', place: 'fougeres' }, { type: 'visit', place: 'lianes' }, { type: 'talk', npc: 'liora', npcName: 'Liora' }], rewards: { xp: 2600, gold: 220 } },
  { id: 'm17', giver: 'liora', title: 'La sève corrompue', desc: "La Brume pourrit la sève de la Canopée. Abattez les squelettes moussus de la lisière et cueillez des orchidées célestes pour mes remèdes.", objectives: [{ type: 'kill', zone: 'sylve_lisiere', count: 10 }, { type: 'collect', item: 'orchidee', count: 5 }], rewards: { xp: 3200, gold: 260, item: 2 } },
  { id: 'm18', giver: 'liora', title: 'Le Phare d’Émeraude', desc: "Le Phare d'Émeraude s'est éteint sous les lianes. Rallumez sa flamme verte.", objectives: [{ type: 'light', beacon: 'emeraude', count: 12 }], rewards: { xp: 3400, gold: 280 } },
  { id: 'm19', giver: 'tiko', title: 'Le Temple Englouti', desc: "Tiko a trouvé l'entrée du Temple Englouti, à l'est du refuge. Des druides déchus y invoquent les morts : faites-les taire et ouvrez le coffre du temple.", objectives: [{ type: 'visit', place: 'temple' }, { type: 'kill', enemy: 'druide', count: 5 }, { type: 'treasure', spot: 'temple' }], rewards: { xp: 3800, gold: 320, item: 3 } },
  { id: 'm20', giver: 'liora', title: 'Le Gardien Sylvestre', desc: "Au sommet du Mont Feuillu, le Gardien Sylvestre a perdu la raison. Montez et libérez-le. Ses spores tombent du ciel : ne restez pas immobiles.", objectives: [{ type: 'visit', place: 'feuillu' }, { type: 'boss', boss: 'gardien' }], rewards: { xp: 5200, gold: 600, item: 3 } },
  // Landes Spectrales (ouest)
  { id: 'm21', giver: 'elder', title: 'Les Landes Spectrales', desc: "À l'ouest, au-delà du Lac Miroir et du Marais des Saules, s'étendent des landes où les morts ne dorment plus. Rejoignez la Veille-des-Morts et parlez à Morwen.", objectives: [{ type: 'visit', place: 'saules' }, { type: 'visit', place: 'veille' }, { type: 'talk', npc: 'morwen', npcName: 'Morwen' }], rewards: { xp: 4000, gold: 300 } },
  { id: 'm22', giver: 'morwen', title: 'Fleurs d’âme', desc: "Les fleurs d'âme poussent là où les morts ont trouvé la paix. Cueillez-en, et repoussez les goules qui rôdent dans la lande.", objectives: [{ type: 'collect', item: 'ame', count: 6 }, { type: 'kill', enemy: 'ghoul', count: 10 }], rewards: { xp: 4600, gold: 340, item: 2 } },
  { id: 'm23', giver: 'morwen', title: 'Le Phare des Âmes', desc: "Le Phare des Âmes guidait les morts hors des Landes. Rendez-lui sa lumière pâle.", objectives: [{ type: 'light', beacon: 'ames', count: 12 }], rewards: { xp: 4800, gold: 360 } },
  { id: 'm24', giver: 'silas', title: 'Le Grand Cimetière', desc: "Des revenants et des banshies tiennent le Grand Cimetière. Brisez leurs rangs, puis ouvrez le coffre des gardiens.", objectives: [{ type: 'kill', zone: 'hantee_cimetiere', count: 12 }, { type: 'treasure', spot: 'cimetiere' }], rewards: { xp: 5600, gold: 420, item: 3 } },
  { id: 'm25', giver: 'morwen', title: 'Le Fossoyeur', desc: "Dans la crypte, à l'ouest des Landes, le Fossoyeur creuse des tombes pour les vivants. Entrez dans son arène et mettez fin à son œuvre. N'y allez pas seuls si vous le pouvez.", objectives: [{ type: 'visit', place: 'crypte' }, { type: 'boss', boss: 'fossoyeur' }], rewards: { xp: 7000, gold: 800, item: 4 } },
  { id: 'm15', giver: 'elder', title: 'L’Aube Éternelle', desc: "Les cinq seigneurs de la Brume sont tombés, mais son cœur bat encore dans la Citadelle des Ombres. Réunissez vos amis au Portail des Expéditions et terrassez l'Avatar de la Brume.", objectives: [{ type: 'level', count: 18 }, { type: 'expedition' }], rewards: { xp: 6000, gold: 800, item: 3 } },
];

// Quêtes secondaires : plusieurs par habitant, débloquées par l'avancée (req = quêtes faites, lvl = niveau).
const SIDE_LIST = [
  // Havrelumière
  { id: 's_smith', giver: 'smith', title: 'Fer et os', desc: 'Brom refond les armes des squelettes. Rapportez-lui trois objets.', objectives: [{ type: 'loot', count: 3 }], rewards: { xp: 150, gold: 80 }, repeat: true },
  { id: 's_smith2', giver: 'smith', req: ['m10'], title: 'L’acier des légionnaires', desc: 'Les légionnaires d’ambre portent un acier rare. Brom en veut six échantillons.', objectives: [{ type: 'kill', enemy: 'amberwarrior', count: 6 }], rewards: { xp: 1100, gold: 180, item: 2 } },
  { id: 's_smith3', giver: 'smith', req: ['m13'], title: 'Forge de givre', desc: 'Une lame trempée dans le givre ne casse jamais. Rapportez trois objets des Cimes.', objectives: [{ type: 'loot', count: 3 }, { type: 'kill', zone: 'givre_bas', count: 6 }], rewards: { xp: 1500, gold: 220, item: 2 } },
  { id: 's_echo', giver: 'merchant', title: 'Laisser sa trace', desc: 'Lysa collectionne les échos des voyageurs. Gravez le vôtre quelque part dans le monde (touche T).', objectives: [{ type: 'echo' }], rewards: { xp: 120, gold: 40 } },
  { id: 's_rumeurs', giver: 'merchant', title: 'Les nouvelles du village', desc: 'Faites le tour des nouveaux venus de Havrelumière : Mère Ondine l’herboriste, Pip le cartographe et la Capitaine Rhéa.', objectives: [{ type: 'talk', npc: 'ondine', npcName: 'Mère Ondine' }, { type: 'talk', npc: 'pip', npcName: 'Pip' }, { type: 'talk', npc: 'rhea', npcName: 'la Capitaine Rhéa' }], rewards: { xp: 140, gold: 30, potions: 2 } },
  { id: 's_ronde', giver: 'guard', req: ['m2'], title: 'Ronde de nuit', desc: 'Les Collines Ambrées grouillent de serviteurs. Faites une ronde et nettoyez-les.', objectives: [{ type: 'kill', zone: 'collines', count: 8 }], rewards: { xp: 260, gold: 50 } },
  { id: 's_rodeurs', giver: 'guard', lvl: 4, title: 'Les arbalétriers', desc: 'Les rôdeurs squelettes tirent sur nos patrouilles depuis la forêt.', objectives: [{ type: 'kill', enemy: 'rogue', count: 6 }], rewards: { xp: 420, gold: 70, item: 1 } },
  { id: 's_elites', giver: 'guard', lvl: 7, title: 'Les champions dorés', desc: 'Certains squelettes brillent d’un éclat doré : ce sont des élites, plus forts et plus riches. Abattez-en trois.', objectives: [{ type: 'elite', count: 3 }], rewards: { xp: 900, gold: 160, item: 2 } },
  { id: 's_lumieres', giver: 'elder', req: ['m5'], title: 'Les cinq lumières', desc: 'Chaque phare nourri éloigne la Brume. Offrez de la lumière à n’importe quel phare du continent.', objectives: [{ type: 'light', beacon: 'any', count: 25 }], rewards: { xp: 700, gold: 90 }, repeat: true },
  { id: 's_aube', giver: 'ondine', title: 'Fleurs d’aube', desc: 'La Fleur d’aube pousse dans les prairies d’Aetheria, là où la lumière revient. Cueillez-en six pour mes élixirs.', objectives: [{ type: 'collect', item: 'aube', count: 6 }], rewards: { xp: 220, gold: 40, potions: 3 } },
  { id: 's_mousse', giver: 'ondine', lvl: 4, title: 'Mousse d’argent', desc: 'Une mousse argentée tapisse les rives du Lac Miroir et le Bois-Murmure. Il m’en faut cinq.', objectives: [{ type: 'collect', item: 'mousse', count: 5 }], rewards: { xp: 380, gold: 60, potions: 3 } },
  { id: 's_plumes', giver: 'ondine', req: ['m4'], title: 'Plumes des nuées', desc: 'Sur les hauteurs battues par les vents, des plumes lumineuses se posent au pied des colonnes de vent. Rapportez-en quatre, mon petit.', objectives: [{ type: 'collect', item: 'plume', count: 4 }], rewards: { xp: 700, gold: 90, potions: 4 } },
  { id: 's_ambre', giver: 'ondine', req: ['m9'], title: 'Éclats d’ambre', desc: 'L’ambre des mesas soigne les fièvres de Brume. Six éclats, je vous prie.', objectives: [{ type: 'collect', item: 'ambre', count: 6 }], rewards: { xp: 1300, gold: 140, potions: 5 } },
  { id: 's_givre', giver: 'ondine', req: ['m12'], title: 'Cristaux de givre', desc: 'Les cristaux du Lac de Cristal gardent le froid pour toujours. Six suffiront.', objectives: [{ type: 'collect', item: 'givre', count: 6 }], rewards: { xp: 1700, gold: 180, potions: 5 } },
  { id: 's_tour', giver: 'pip', title: 'Le tour des Prés', desc: 'Je dois vérifier ma carte ! Va voir le Lac Miroir, le Bois-Murmure et les Cendres pour moi.', objectives: [{ type: 'visit', place: 'lac' }, { type: 'visit', place: 'foret' }, { type: 'visit', place: 'ruines' }], rewards: { xp: 300, gold: 50 } },
  { id: 's_pierres', giver: 'pip', title: 'Les pierres de passage', desc: 'Les pierres de passage permettent de voyager d’un coup ! Éveille-en trois (approche-toi et appuie sur E).', objectives: [{ type: 'waystone', count: 3 }], rewards: { xp: 400, gold: 60 } },
  { id: 's_ilots', giver: 'pip', req: ['m4'], title: 'Les lieux oubliés', desc: 'Quatre lieux sont flous sur ma carte : le Belvédère du Couchant, la Pointe aux Coquillages, la Croisée du Pèlerin et la Table du Vent. Va les voir pour moi !', objectives: [{ type: 'visit', place: 'nuees' }, { type: 'visit', place: 'tresor' }, { type: 'visit', place: 'pelerin' }, { type: 'visit', place: 'eclat' }], rewards: { xp: 900, gold: 120, item: 2 } },
  { id: 's_confins', giver: 'pip', req: ['m12'], title: 'Cartographe des confins', desc: 'Les terres lointaines cachent des merveilles : la Mine de Kessa, le Cirque d’Ambre, le Lac de Cristal et le Sanctuaire Gelé. Visite-les tous !', objectives: [{ type: 'visit', place: 'mine' }, { type: 'visit', place: 'cirque' }, { type: 'visit', place: 'cristal' }, { type: 'visit', place: 'sanctuaire' }], rewards: { xp: 2400, gold: 260, item: 3 } },
  { id: 's_monture', giver: 'rhea', lvl: 8, req: ['m5'], title: 'L’éther apprivoisé', desc: 'Les montures d’éther naissent de la lumière des feux follets. Abattez-en quatre (autour du Lac Miroir, dans les ruines du sud des Cendres ou sur le Pic), puis offrez de la lumière à un phare : une monture viendra à vous.', objectives: [{ type: 'kill', enemy: 'wisp', count: 4 }, { type: 'light', beacon: 'any', count: 10 }], rewards: { xp: 900, gold: 100, mount: true } },
  { id: 's_bapteme', giver: 'rhea', title: 'Baptême de l’air', desc: 'Saute, ouvre ta paravoile, puis entre dans une colonne de vent : elle te portera vers les nuages.', objectives: [{ type: 'glide' }, { type: 'updraft' }], rewards: { xp: 200, gold: 40 } },
  { id: 's_anneaux', giver: 'rhea', lvl: 3, title: 'Les anneaux du vent', desc: 'Au-dessus du village flottent des anneaux de vent. Monte dans la colonne près du Pic, puis plane à travers eux.', objectives: [{ type: 'rings', set: 'village', count: 5 }], rewards: { xp: 600, gold: 90, item: 1 } },
  { id: 's_course', giver: 'rhea', req: ['m9'], title: 'La course des nuages', desc: 'Au-dessus des Terres d’Ambre, j’ai suspendu cinq anneaux de vent. Monte dans une colonne et traverse-les tous en planant !', objectives: [{ type: 'rings', set: 'ambre', count: 5 }], rewards: { xp: 1600, gold: 200, item: 2 } },
  // Créatures de la Brume
  { id: 's_gelees', giver: 'ondine', lvl: 2, title: 'Les gelées du lac', desc: 'Des gelées violettes rampent autour du Lac Miroir et dans les Collines. Leur cœur fait un excellent sirop… Rapportez-m’en six. Attention : les grosses se divisent !', objectives: [{ type: 'kill', enemy: 'slime', count: 6 }], rewards: { xp: 260, gold: 45, potions: 3 } },
  { id: 's_toiles', giver: 'pip', lvl: 4, title: 'Toiles dans les ruines', desc: 'Des araignées géantes ont tissé leurs toiles sur mes repères du Bois-Murmure et des Cendres ! Débarrasse-m’en.', objectives: [{ type: 'kill', enemy: 'spider', count: 6 }], rewards: { xp: 520, gold: 80, chest: 'bois' } },
  { id: 's_meute', giver: 'guard', lvl: 5, title: 'La meute de Brume', desc: 'Des loups aux yeux violets chassent sur les pentes du Pic et dans la forêt. Ils sont rapides : verrouillez-les (Tab ou bouton cible) et frappez fort.', objectives: [{ type: 'kill', enemy: 'wolf', count: 5 }], rewards: { xp: 650, gold: 90, item: 1 } },
  { id: 's_golems', giver: 'elder', lvl: 8, title: 'Les gardiens de pierre', desc: 'La Brume anime les pierres des Cendres et du Pic. Ces golems frappent le sol tout autour d’eux : reculez quand ils lèvent les poings.', objectives: [{ type: 'kill', enemy: 'golem', count: 3 }], rewards: { xp: 1200, gold: 150, chest: 'fer' } },
  { id: 's_follets', giver: 'ondine', req: ['m4'], title: 'Les feux follets', desc: 'Les feux follets attirent les voyageurs vers les eaux profondes. Éteignez-en cinq, près du Lac Miroir ou autour du Belvédère.', objectives: [{ type: 'kill', enemy: 'wisp', count: 5 }], rewards: { xp: 700, gold: 90, potions: 3 } },
  { id: 's_golems_ambre', giver: 'kessa', req: ['m10'], title: 'Golems d’ambre', desc: 'Des golems d’ambre bloquent la gorge. Il en faut trois de moins pour que mes chariots passent.', objectives: [{ type: 'kill', enemy: 'golem_ambre', count: 3 }], rewards: { xp: 1800, gold: 240, chest: 'fer' } },
  { id: 's_loups_neige', giver: 'bjorn', req: ['m12'], title: 'Loups des neiges', desc: 'Loups blancs. Ils volent mes pièges. Chasse-en six.', objectives: [{ type: 'kill', enemy: 'wolf_givre', count: 6 }], rewards: { xp: 2000, gold: 220, item: 2 } },
  // Trésors
  { id: 's_carte', giver: 'pip', lvl: 2, title: 'La carte au trésor', desc: 'J’ai dessiné une carte avec des croix partout : des coffres cachés dans tout le continent ! Trouve-en trois. La balise dorée te guidera vers le plus proche.', objectives: [{ type: 'treasure', count: 3 }], rewards: { xp: 450, gold: 80, chest: 'fer' } },
  { id: 's_celestes', giver: 'merchant', req: ['m4'], title: 'Les coffres oubliés', desc: 'On raconte que des coffres dorment aux quatre coins du continent. Celui de la Pointe aux Coquillages serait plein d’or ! Ouvrez-le, et celui de la Croisée du Pèlerin.', objectives: [{ type: 'treasure', spot: 'tresor' }, { type: 'treasure', spot: 'pelerin' }], rewards: { xp: 900, gold: 150, chest: 'or' } },
  { id: 's_chasseur', giver: 'merchant', lvl: 3, title: 'Chasseur de trésors', desc: 'Ouvrez cinq coffres, n’importe lesquels : ceux du monde, ceux des boss ou ceux de ma boutique. Je vous en offrirai un autre !', objectives: [{ type: 'openchest', count: 5 }], rewards: { xp: 500, gold: 60, chest: 'fer' }, repeat: true },
  { id: 's_collection', giver: 'smith', lvl: 6, title: 'Pièce de collection', desc: 'Montre-moi une arme digne de ce nom : un objet épique ou mieux. Les coffres dorés et les boss en donnent souvent.', objectives: [{ type: 'loot', minRarity: 2, count: 1 }], rewards: { xp: 800, gold: 120, chest: 'fer' } },
  { id: 's_legende', giver: 'smith', req: ['m8'], title: 'L’objet de légende', desc: 'Un objet légendaire… Je n’en ai vu que deux dans ma vie. Trouve-m’en un, et je te ferai un cadeau.', objectives: [{ type: 'loot', minRarity: 3, count: 1 }], rewards: { xp: 2000, gold: 300, chest: 'or' } },
  { id: 's_vagues', giver: 'guard', req: ['m3'], title: 'Repousser la Brume', desc: 'Parfois, la Brume se rassemble et lâche des vagues de monstres d’un coup. Quand une vague surgit près de vous, tenez bon jusqu’à la dernière !', objectives: [{ type: 'wave', count: 1 }], rewards: { xp: 700, gold: 100, chest: 'fer' }, repeat: true },
  // Terres d'Ambre
  { id: 's_pari', giver: 'kessa', req: ['m9'], title: 'Le pari de Kessa', desc: 'Je te parie que tu n’arriveras pas au sommet de la Grande Mesa. Il y a une rampe au sud-ouest… si tu la trouves.', objectives: [{ type: 'visit', place: 'mesa' }], rewards: { xp: 900, gold: 150 } },
  { id: 's_mine', giver: 'kessa', req: ['m10'], title: 'La mine hantée', desc: 'Ma mine est infestée ! Débarrasse la Gorge Rouge des squelettes et ramène ce qu’ils ont volé.', objectives: [{ type: 'kill', zone: 'ambre_gorge', count: 8 }, { type: 'loot', count: 2 }], rewards: { xp: 1700, gold: 240, item: 2 } },
  { id: 's_tarek', giver: 'tarek', req: ['m9'], title: 'La légende du feu', desc: 'Les anciens traçaient Ignis, le triangle de feu, pour éloigner la Brume. Montrez-moi votre main : un tracé net, au moins 60 %.', objectives: [{ type: 'rune', rune: 'ignis', minScore: 0.6, count: 1 }], rewards: { xp: 800, gold: 100 } },
  { id: 's_ambrephare', giver: 'tarek', req: ['m10'], title: 'Le miel des mesas', desc: 'Le Phare d’Ambre brillait comme du miel. Rendez-lui sa lumière.', objectives: [{ type: 'light', beacon: 'ambre', count: 20 }], rewards: { xp: 1600, gold: 200 }, repeat: true },
  { id: 's_mesa_tresor', giver: 'kessa', req: ['m10'], title: 'Le trésor de la mesa', desc: 'Mon grand-père a caché un coffre doré tout en haut de la Grande Mesa. Il est à toi si tu y arrives !', objectives: [{ type: 'treasure', spot: 'mesa' }], rewards: { xp: 1500, gold: 220 } },
  { id: 's_mages', giver: 'tarek', req: ['m10'], title: 'Les mages des sables', desc: 'Des mages squelettes invoquent des pillards dans les mesas. Taisez leurs chants.', objectives: [{ type: 'kill', enemy: 'ambermage', count: 5 }], rewards: { xp: 1500, gold: 180, item: 2 } },
  // Cimes de Givre
  { id: 's_chasse', giver: 'bjorn', req: ['m12'], title: 'La chasse', desc: 'Squelettes de givre. Trop nombreux. Chasse-en huit.', objectives: [{ type: 'kill', enemy: 'frostling', count: 8 }], rewards: { xp: 1600, gold: 160, item: 1 } },
  { id: 's_archers', giver: 'bjorn', req: ['m12'], title: 'Les archers des crêtes', desc: 'Des archers tirent depuis les crêtes. Leurs flèches gèlent. Abats-en cinq.', objectives: [{ type: 'kill', enemy: 'frostarcher', count: 5 }], rewards: { xp: 1800, gold: 180, item: 2 } },
  { id: 's_lanternes', giver: 'bjorn', req: ['m12'], title: 'Les lanternes du passage', desc: 'Les lanternes du Col des Lanternes guident les voyageurs entre le Pic et les Cimes. Va voir si elles brillent encore.', objectives: [{ type: 'visit', place: 'lanternes' }, { type: 'visit', place: 'cristal' }], rewards: { xp: 1300, gold: 120 } },
  { id: 's_prieres', giver: 'neige', req: ['m12'], title: 'Prières gelées', desc: 'Au Sanctuaire, on priait en traçant Vita, le cercle de vie. Tracez-le deux fois pour réchauffer les cœurs.', objectives: [{ type: 'rune', rune: 'vita', count: 2 }], rewards: { xp: 1200, gold: 120 } },
  { id: 's_flamme', giver: 'neige', req: ['m13'], title: 'La flamme bleue', desc: 'La flamme bleue du Phare du Givre doit grandir encore.', objectives: [{ type: 'light', beacon: 'givre', count: 20 }], rewards: { xp: 2000, gold: 220 }, repeat: true },
  { id: 's_cime', giver: 'neige', req: ['m13'], title: 'Le coffre de la Reine', desc: 'Au sommet du Mont Givrecroc repose le coffre mythique de la Reine de Givre. Peu en sont revenus… mais vous n’êtes pas « peu ».', objectives: [{ type: 'treasure', spot: 'cime' }], rewards: { xp: 3000, gold: 400 } },
  { id: 's_sorciers', giver: 'neige', req: ['m13'], title: 'Les sorciers de givre', desc: 'Les sorciers de givre gardent les pentes du Mont Givrecroc. Brisez leur cercle.', objectives: [{ type: 'kill', enemy: 'frostmage', count: 5 }, { type: 'elite', count: 1 }], rewards: { xp: 2600, gold: 260, item: 3 } },
];
// Agrandissement : nouvelles régions
SIDE_LIST.push(
  { id: 's_hameau', giver: 'merchant', lvl: 2, title: 'Le hameau des Prés-Bas', desc: 'Agathe, la fermière des Prés-Bas, cherche de l’aide. Le hameau est au nord-est, suivez le chemin après le Phare de l’Aube.', objectives: [{ type: 'visit', place: 'pres' }, { type: 'talk', npc: 'agathe', npcName: 'Agathe' }], rewards: { xp: 250, gold: 40 } },
  { id: 's_moutons', giver: 'agathe', req: ['s_hameau'], title: 'Les loups des Prés', desc: 'Les loups de Brume rôdent autour de mes champs, et les gelées mangent mes citrouilles. Chasse-les, veux-tu ?', objectives: [{ type: 'kill', zone: 'pres', count: 8 }], rewards: { xp: 520, gold: 80, potions: 3 } },
  { id: 's_bouquet', giver: 'agathe', req: ['s_hameau'], title: 'Un bouquet pour la fête', desc: 'C’est bientôt la fête des moissons ! Il me faut des fleurs d’aube pour les tables.', objectives: [{ type: 'collect', item: 'aube', count: 6 }], rewards: { xp: 380, gold: 60, chest: 'bois' }, repeat: true },
  { id: 's_grenier', giver: 'agathe', req: ['s_moutons'], title: 'Le coffre du grenier', desc: 'Mon défunt mari cachait ses économies dans un coffre, quelque part près des champs du hameau. Si tu le trouves, garde-le : tu l’as mérité.', objectives: [{ type: 'treasure', spot: 'pres' }], rewards: { xp: 600, gold: 90 } },
  { id: 's_vague_pres', giver: 'agathe', req: ['s_moutons'], lvl: 5, title: 'La Brume aux portes', desc: 'Quand la Brume se déchire, des vagues de monstres déferlent. Tiens bon face à l’une d’elles, où que tu sois.', objectives: [{ type: 'wave', count: 1 }], rewards: { xp: 900, gold: 120, chest: 'fer' } },
  { id: 's_nouvelles', giver: 'pip', req: ['m9'], title: 'Les terres sauvages', desc: 'Entre les grandes régions s’étendent quatre terres sauvages : le Marais des Saules, la Côte des Récifs, les Hauts-Plateaux et les Falaises du Couchant. Va les voir, je complète ma carte.', objectives: [{ type: 'visit', place: 'saules' }, { type: 'visit', place: 'fanal' }, { type: 'visit', place: 'plateaux' }, { type: 'visit', place: 'falaises' }], rewards: { xp: 1600, gold: 200, chest: 'fer' } },
  { id: 's_falaises', giver: 'guard', lvl: 6, title: 'Les Falaises du Couchant', desc: 'Des golems et des loups descendent des Falaises du Couchant, à l’ouest du Pic. Repoussez-les avant qu’ils n’atteignent le lac.', objectives: [{ type: 'kill', zone: 'falaises', count: 8 }], rewards: { xp: 900, gold: 130, item: 1 } },
  { id: 's_prairie', giver: 'ondine', lvl: 4, title: 'La Prairie du Sud', desc: 'Les loups et les araignées de la Prairie du Sud effraient les cueilleurs. Faites le ménage, puis cueillez quelques fleurs d’aube en chemin.', objectives: [{ type: 'kill', zone: 'sud', count: 6 }, { type: 'collect', item: 'aube', count: 3 }], rewards: { xp: 600, gold: 90, potions: 3 } },
  // Canopée d'Émeraude
  { id: 's_mygales', giver: 'tiko', req: ['m16'], title: 'Mygales géantes', desc: 'Des mygales grosses comme des chariots ! Elles ont mangé mon sac. Chasse-en six, je te paierai en or… quand j’aurai retrouvé mon sac.', objectives: [{ type: 'kill', enemy: 'mygale', count: 6 }], rewards: { xp: 2400, gold: 260, chest: 'fer' } },
  { id: 's_canopee', giver: 'tiko', req: ['m16'], title: 'Au-dessus de la Canopée', desc: 'J’ai accroché des anneaux de vent au-dessus des arbres. Monte dans la colonne près du refuge et plane à travers les cinq !', objectives: [{ type: 'rings', set: 'sylve', count: 5 }], rewards: { xp: 2600, gold: 280, item: 2 } },
  { id: 's_panthere', giver: 'liora', req: ['m17'], title: 'Les panthères d’émeraude', desc: 'Les panthères de la jungle sont devenues folles. Elles sont rapides : esquivez leurs bonds et abattez-en cinq.', objectives: [{ type: 'kill', enemy: 'panthere', count: 5 }], rewards: { xp: 2800, gold: 300, item: 2 } },
  { id: 's_orchidees', giver: 'liora', req: ['m17'], title: 'Orchidées célestes', desc: 'Il me faut encore des orchidées, autour du lac et du temple. Huit, je t’en prie.', objectives: [{ type: 'collect', item: 'orchidee', count: 8 }], rewards: { xp: 2500, gold: 240, potions: 6 }, repeat: true },
  { id: 's_golems_mousse', giver: 'tiko', req: ['m18'], title: 'Golems moussus', desc: 'Les golems moussus écrasent les ruines du temple. Il en faut trois de moins pour que je puisse dessiner les fresques.', objectives: [{ type: 'kill', enemy: 'golem_mousse', count: 3 }], rewards: { xp: 3000, gold: 320, chest: 'or' } },
  { id: 's_feuillu', giver: 'liora', req: ['m19'], title: 'La graine du Mont Feuillu', desc: 'Au sommet du Mont Feuillu dort un coffre mythique, scellé par les anciens druides.', objectives: [{ type: 'treasure', spot: 'feuillu' }], rewards: { xp: 3400, gold: 420 } },
  { id: 's_emeraude', giver: 'liora', req: ['m18'], title: 'La flamme verte', desc: 'La flamme du Phare d’Émeraude faiblit à chaque nuit. Nourrissez-la encore.', objectives: [{ type: 'light', beacon: 'emeraude', count: 20 }], rewards: { xp: 2600, gold: 260 }, repeat: true },
  // Landes Spectrales
  { id: 's_spectres', giver: 'silas', req: ['m21'], title: 'Chasse aux spectres', desc: 'Les spectres flottent au-dessus du marais et tirent des éclats d’âme. Éteins-en huit.', objectives: [{ type: 'kill', enemy: 'wraith', count: 8 }], rewards: { xp: 4200, gold: 380, item: 2 } },
  { id: 's_garous', giver: 'silas', req: ['m22'], title: 'La nuit des loups-garous', desc: 'Les loups-garous chassent autour du Marais des Âmes. Ils frappent fort : gardez vos esquives.', objectives: [{ type: 'kill', enemy: 'werewolf', count: 5 }], rewards: { xp: 4600, gold: 420, chest: 'or' } },
  { id: 's_veuves', giver: 'morwen', req: ['m21'], title: 'Les veuves des tombes', desc: 'Des araignées noires pondent dans les tombes ouvertes. Brûlez leurs nids en les abattant.', objectives: [{ type: 'kill', enemy: 'spider_tomb', count: 6 }], rewards: { xp: 4000, gold: 360, potions: 5 } },
  { id: 's_corbeaux', giver: 'silas', req: ['m23'], title: 'Le Mont des Corbeaux', desc: 'Au nord-ouest des Landes, le Mont des Corbeaux cache un coffre et des colosses d’os. Grimpe, ouvre le coffre, abats un colosse.', objectives: [{ type: 'treasure', spot: 'corbeaux' }, { type: 'kill', enemy: 'golem_os', count: 1 }], rewards: { xp: 5200, gold: 480, item: 3 } },
  { id: 's_ames', giver: 'morwen', req: ['m22'], title: 'Le jardin des âmes', desc: 'Chaque fleur d’âme apaise un mort. Cueillez-en huit autour du cimetière et du marais.', objectives: [{ type: 'collect', item: 'ame', count: 8 }], rewards: { xp: 4000, gold: 360, potions: 6 }, repeat: true },
  { id: 's_crypte', giver: 'silas', req: ['m24'], title: 'Le trésor du Fossoyeur', desc: 'Le Fossoyeur garde un coffre mythique au fond de sa crypte. Il est pour toi… si tu en reviens.', objectives: [{ type: 'treasure', spot: 'crypte' }], rewards: { xp: 5000, gold: 600 } },
  { id: 's_ameslumiere', giver: 'morwen', req: ['m23'], title: 'Lumière pour les morts', desc: 'Le Phare des Âmes doit briller chaque nuit pour guider les égarés.', objectives: [{ type: 'light', beacon: 'ames', count: 20 }], rewards: { xp: 4200, gold: 380 }, repeat: true },
);
// les quêtes principales racontent l'histoire de la Couronne Brisée (textes dans Lore.js)
for (const m of MAIN) Object.assign(m, MAIN_TEXT[m.id] || {});
export const MAIN_IDS = MAIN.map((m) => m.id);
const SIDE = Object.fromEntries(SIDE_LIST.map((q) => [q.id, q]));

export class Quests {
  constructor(game) {
    this.game = game;
    this.active = [];
    this.done = new Set();
    this.mainIdx = 0;
    this.trackedKey = '';
  }

  serialize() { return { active: this.active, done: [...this.done], mainIdx: this.mainIdx }; }
  reset() { this.active = []; this.done = new Set(); this.mainIdx = 0; this.changed(); }
  load(d) {
    if (!d) return;
    this.active = (d.active || []).filter((q) => q && q.objectives);
    this.done = new Set(d.done || []);
    // quêtes principales en cours : leur texte suit le récit actuel
    for (const q of this.active) if (MAIN_TEXT[q.id]) Object.assign(q, MAIN_TEXT[q.id]);
    // la chaîne principale reprend à la première quête non accomplie (de nouvelles quêtes ont pu s'insérer)
    const idx = MAIN.findIndex((m) => !this.done.has(m.id));
    this.mainIdx = idx < 0 ? MAIN.length : idx;
  }

  startIntro() {
    if (this.mainIdx === 0 && !this.active.length) this.offerMain(true);
  }

  offerMain(auto = false) {
    const def = MAIN[this.mainIdx];
    if (!def || this.active.some((q) => q.id === def.id)) return null;
    const q = this.instantiate(def);
    this.active.unshift(q);
    if (!auto) this.game.ui.toast(`Nouvelle quête : <b>${q.title}</b>`);
    if (this.mainIdx >= 1) this.tutorialHint();
    this.game.audio?.play('quest');
    this.changed();
    return q;
  }

  instantiate(def) {
    return { ...def, objectives: def.objectives.map((o) => ({ ...o, have: 0, count: o.count || 1, done: false, text: objectiveText({ ...o, count: o.count || 1 }) })), state: 'active', t: Date.now() };
  }

  // une quête en cours attend-elle de la lumière pour ce phare ?
  wantsLight(id) {
    return this.active.some((q) => q.state === 'active' && q.objectives.some((o) => !o.done && o.type === 'light' && (!o.beacon || o.beacon === 'any' || o.beacon === id)));
  }

  add(q) { this.active.push(q); this.changed(); this.game.audio?.play('quest'); this.game.ui.toast(`Nouvelle quête : <b>${escapeHtml(q.title)}</b>`); }

  mainFor(npc) {
    const def = MAIN[this.mainIdx];
    return def && def.giver === npc && !this.done.has(def.id) ? def : null;
  }

  // quêtes secondaires proposées par un habitant (débloquées et pas en cours)
  sidesFor(npc) {
    const lvl = this.game.hero?.level || 1;
    return SIDE_LIST.filter((def) => def.giver === npc
      && !this.active.some((q) => q.id === def.id)
      && (!this.done.has(def.id) || def.repeat)
      && (!def.req || def.req.every((r) => this.done.has(r)))
      && (!def.lvl || lvl >= def.lvl)).slice(0, 3);
  }

  sideFor(npc) { return this.sidesFor(npc)[0] || null; }

  // ------------------------------------------------------------------ progression
  onEvent(type, data = {}) {
    let changed = false;
    for (const q of this.active) {
      if (q.state !== 'active') continue;
      for (const o of q.objectives) {
        if (o.done) continue;
        if (this.matches(o, type, data)) {
          o.have = Math.min(o.count, o.have + (type === 'light' ? data.amount : 1));
          if (o.have >= o.count - 1e-6) { o.have = o.count; o.done = true; }
          changed = true;
        }
      }
      if (q.objectives.every((o) => o.done) && q.state === 'active') {
        q.state = 'ready';
        changed = true;
        if (q.objectives.length === 1 && q.objectives[0].type === 'talk') this.complete(q);
        else { this.game.ui.toast(`<b>${escapeHtml(q.title)}</b> — objectifs accomplis. Retournez voir ${this.npcName(q.giver)}.`, { time: 4 }); this.game.audio?.play('quest'); }
      }
    }
    if (changed) this.changed();
  }

  matches(o, type, d) {
    switch (o.type) {
      case 'kill': return type === 'kill' && (!o.enemy || o.enemy === 'any' || o.enemy === d.type) && (!o.zone || this.inZone(d, o.zone));
      case 'light': return type === 'light' && (!o.beacon || o.beacon === 'any' || o.beacon === d.id);
      case 'rune': return type === 'rune' && (!o.rune || o.rune === 'any' || o.rune === d.name) && (!o.minScore || d.score >= o.minScore);
      case 'visit': return type === 'visit' && d.place === o.place;
      case 'glide': return type === 'glide';
      case 'echo': return type === 'echo';
      case 'loot': return type === 'loot' && (!o.minRarity || (d.item?.rarity ?? 0) >= o.minRarity);
      case 'treasure': return type === 'treasure' && (!o.spot || o.spot === d.id);
      case 'openchest': return type === 'openchest' && (!o.tier || Object.keys(CHEST_TIERS).indexOf(d.tier) >= Object.keys(CHEST_TIERS).indexOf(o.tier));
      case 'wave': return type === 'wave';
      case 'boss': return type === 'kill' && d.boss && (!o.boss || ENEMIES[d.type]?.bossId === o.boss);
      case 'elite': return type === 'kill' && !!d.elite;
      case 'collect': return type === 'collect' && d.item === o.item;
      case 'waystone': return type === 'waystone';
      case 'updraft': return type === 'updraft';
      case 'rings': return type === 'ring' && d.set === o.set && !(o.passed || []).includes(d.id) && ((o.passed ||= []).push(d.id), true);
      case 'expedition': return type === 'expedition';
      case 'talk': return type === 'talk' && d.npc === o.npc;
      case 'ventus': return type === 'ventus';
      case 'beaconLit': return type === 'beaconLit' && d.id === o.beacon;
      case 'level': return type === 'level' && d.level >= o.count;
      default: return false;
    }
  }

  inZone(d, zoneId) {
    const z = SPAWN_ZONES.find((s) => s.id === zoneId);
    return z ? Math.hypot(d.x - z.x, d.z - z.z) < z.radius * 1.5 : true;
  }

  // vérifications continues (lieux, niveau)
  update(dt) {
    this.t = (this.t || 0) - dt;
    if (this.t > 0) return;
    this.t = 0.5;
    const p = this.game.player.position;
    for (const [id, pl] of Object.entries(PLACES)) {
      if (Math.hypot(p.x - pl.x, p.z - pl.z) < pl.r && (!pl.minY || p.y > pl.minY)) {
        if (!this.game.hero.discovered[id]) { this.game.hero.discovered[id] = true; this.game.ui.announce(pl.name.replace(/^l[’']|^le |^les /, (m) => m), 'Lieu découvert', 2.5); this.game.gainXp(60); this.game.audio?.play('quest'); }
        this.onEvent('visit', { place: id });
      }
    }
    for (const q of this.active) for (const o of q.objectives) if (o.type === 'level' && !o.done && this.game.hero.level >= o.count) this.onEvent('level', { level: this.game.hero.level });
    // pierres de passage éveillées avant d'avoir la quête : elles comptent
    const known = Object.keys(this.game.hero.discovered).filter((k) => k.startsWith('ws:')).length;
    for (const q of this.active) for (const o of q.objectives) if (o.type === 'waystone' && !o.done && o.have < Math.min(o.count, known)) { o.have = Math.min(o.count, known) - 1; this.onEvent('waystone', {}); }
  }

  complete(q) {
    const g = this.game;
    this.active = this.active.filter((x) => x !== q);
    this.done.add(q.id);
    const r = q.rewards || {};
    g.ui.announce('Quête accomplie', q.title, 3);
    g.audio?.play('levelup');
    if (r.gold) { g.hero.gold += r.gold; g.ui.toast(`+${r.gold} or`); }
    if (r.item !== undefined) {
      const it = generateItem(g.hero.classId, g.hero.level, { rarity: r.item });
      if (g.hero.addItem(it)) g.ui.toast(`Récompense : <span class="r${it.rarity}">${escapeHtml(it.name)}</span>`, { time: 4 });
    }
    if (r.potions) g.hero.potions.hp = (g.hero.potions.hp || 0) + r.potions;
    if (r.chest) { g.hero.chests[r.chest] = (g.hero.chests[r.chest] || 0) + 1; g.ui.toast(`Récompense : <b style="color:${CHEST_TIERS[r.chest].color}">${CHEST_TIERS[r.chest].name}</b> (à ouvrir dans le sac)`, { time: 4 }); }
    if (r.xp) g.gainXp(r.xp);
    if (r.mount) {
      g.hero.mount = true;
      g.touch?.refreshMenu?.();
      g.schedule?.(1.2, () => g.ui.announce('Monture d’éther apprivoisée', g.input?.isTouch ? 'Bouton monture du menu pour l’invoquer' : 'Touche N pour l’invoquer · Maj pour galoper', 4));
    }
    if (q.id.startsWith('m')) {
      // première quête principale pas encore accomplie (comme au chargement)
      this.done.add(q.id);
      const idx = MAIN.findIndex((m) => !this.done.has(m.id));
      this.mainIdx = idx < 0 ? MAIN.length : idx;
      // la suite est proposée par le prochain donneur
      const next = MAIN[this.mainIdx];
      if (next) g.ui.toast(`${this.npcName(next.giver)} a une nouvelle tâche pour vous.`, { time: 4 });
    }
    if (q.ai) g.hero.title = g.hero.title || 'Élu de l’Oracle';
    this.changed();
    g.save?.soon(1);
  }

  npcName(id) { return this.game.npcs?.byId(id)?.name || 'le donneur'; }

  returnObjective(q) { return { type: 'return', npc: q.giver, npcName: this.npcName(q.giver), text: `Retourner voir ${this.npcName(q.giver)}`, count: 1, have: 0, done: false }; }

  // ligne d'objectif cliquable : ouvre le tutoriel « Comment faire ? »
  objectiveRow(win, o, label) {
    if (!hasTutorial(o)) return h('div', { class: 'qo' + (o.done ? ' done' : '') }, label);
    return h('button', { class: 'qo qo-link' + (o.done ? ' done' : ''), type: 'button', title: 'Comment faire ?', onclick: () => win.openTutorial(o) },
      h('span', {}, label), h('span', { class: 'qhelp' }, '?'));
  }

  // une seule fois : signaler que les objectifs ouvrent un tutoriel
  tutorialHint() {
    try { if (localStorage.getItem('aetheria.tuthint')) return; localStorage.setItem('aetheria.tuthint', '1'); } catch { /* */ }
    setTimeout(() => this.game.ui.toast(`Astuce : touchez un objectif de quête (${this.game.input?.isTouch ? 'bouton quêtes' : 'touche J'}) pour savoir comment le réussir.`, { time: 6 }), 2500);
  }

  changed() { this.trackedKey = JSON.stringify(this.active.map((q) => [q.id, q.state, q.objectives.map((o) => Math.floor(o.have))])); }
  trackerKey() { const ex = this.game.expedition?.tracked(); return this.trackedKey + (ex ? JSON.stringify(ex) : ''); }
  tracked() {
    const ex = this.game.expedition?.tracked();
    const list = this.active.slice(0, ex ? 2 : 3).map((q) => ({
      title: q.title, ai: q.ai,
      objectives: q.state === 'ready' ? [{ text: `Retourner voir ${this.npcName(q.giver)}`, done: false, count: 1, have: 0, obj: this.returnObjective(q) }] : q.objectives.map((o) => ({ text: o.text, done: o.done, count: o.type === 'light' ? 1 : o.count, have: o.have, obj: o })),
    }));
    return ex ? [ex, ...list] : list;
  }

  readyFor(npc) { return this.active.find((q) => q.state === 'ready' && q.giver === npc); }

  // Position d'un objectif (balises de carte, flèche de guidage). null = pas de lieu précis.
  objectiveTarget(q, o) {
    const g = this.game, pos = g.player.position;
    const gold = '#ffe3a3', red = '#ff8a72';
    const nearest = (list, f = () => true) => {
      let best = null, bd = Infinity;
      for (const it of list) { if (!f(it)) continue; const d = Math.hypot(it.x - pos.x, it.z - pos.z); if (d < bd) { bd = d; best = it; } }
      return best;
    };
    const zoneTarget = (z) => z && { x: z.x, z: z.z, color: red, label: ZONE_NAMES[z.id] };
    switch (o.type) {
      case 'visit': { const pl = PLACES[o.place]; return { x: pl.x, z: pl.z, color: gold, label: pl.name, y: pl.minY }; }
      case 'light': case 'beaconLit': {
        const b = o.beacon && o.beacon !== 'any' ? BEACONS.find((x) => x.id === o.beacon) : nearest(BEACONS);
        return b && { x: b.x, z: b.z, color: gold, label: b.name };
      }
      case 'kill': {
        if (o.zone) return zoneTarget(SPAWN_ZONES.find((s) => s.id === o.zone));
        if (q.id === 'm2') { const b = BEACONS[0]; return { x: b.x, z: b.z, color: red, label: 'Squelettes' }; }
        if (o.enemy && o.enemy !== 'any') return zoneTarget(nearest(SPAWN_ZONES, (z) => z.types.includes(o.enemy)));
        return zoneTarget(nearest(SPAWN_ZONES, (z) => z.level[0] <= (g.hero?.level || 1) + 1));
      }
      case 'elite': return zoneTarget(nearest(SPAWN_ZONES, (z) => z.level[0] <= (g.hero?.level || 1) + 1 && z.level[1] >= (g.hero?.level || 1) - 3) || nearest(SPAWN_ZONES));
      case 'boss': { const b = BOSS_OF[o.boss || 'roi']; return b && { x: b.x, z: b.z, color: red, label: BOSS_KITS[b.id]?.name, y: b.minY }; }
      case 'talk': case 'return': { const n = g.npcs?.byId(o.npc); const w = n && g.npcs.where(n); return n && { x: w.x, z: w.z, color: gold, label: n.room ? `${n.name} (${ROOM_LABEL[n.room]})` : n.name, npc: true }; }
      case 'collect': { const n = g.gathering?.nearest(o.item, pos); return n && { x: n.x, z: n.z, color: ITEMS_GATHER[o.item].color, label: ITEMS_GATHER[o.item].name }; }
      case 'waystone': { const w = nearest(WAYSTONES, (w) => !g.waystones?.known(w.id)); return w && { x: w.x, z: w.z, color: '#9fe8ff', label: 'Pierre de passage' }; }
      case 'updraft': { const u = nearest(UPDRAFTS); return u && { x: u.x, z: u.z, color: '#bfe6ff', label: 'Colonne de vent' }; }
      case 'rings': {
        const r = g.gathering?.nextRing(o.set, o.passed || []), set = RING_SETS[o.set];
        if (!r || !set) return null;
        // trop bas ou trop loin : d'abord la colonne de vent qui mène aux anneaux
        const d = Math.hypot(r.x - pos.x, r.z - pos.z);
        if (!(o.passed || []).length && (pos.y < r.y - 6 || d > 90)) return { x: set.start.x, z: set.start.z, color: '#bfe6ff', label: 'Colonne de vent (départ)' };
        return { x: r.x, z: r.z, y: r.y, color: '#ffe08a', label: 'Anneau de vent', ring: true };
      }
      case 'expedition': return { x: EXP_PORTAL.x, z: EXP_PORTAL.z, color: '#c9a2ff', label: 'Portail des Expéditions' };
      case 'treasure': {
        const sp = o.spot ? g.chests?.spots.find((t) => t.id === o.spot) : g.chests?.nearestSpot(pos);
        return sp && { x: sp.x, z: sp.z, y: sp.minY, color: CHEST_TIERS[sp.tier].color, label: CHEST_TIERS[sp.tier].name };
      }
      case 'wave': { const w = g.waves?.current; return w && { x: w.x, z: w.z, color: '#c78bff', label: 'Vague de la Brume' }; }
      default: return null;
    }
  }

  // objectif suivi en priorité (flèche de guidage)
  primaryTarget() {
    for (const q of this.active) {
      if (q.state === 'ready') { const t = this.objectiveTarget(q, this.returnObjective(q)); if (t) return { ...t, quest: q.title }; continue; }
      for (const o of q.objectives) {
        if (o.done) continue;
        const t = this.objectiveTarget(q, o);
        if (t) return { ...t, quest: q.title, text: o.text };
      }
    }
    return null;
  }

  markers(out) {
    for (const q of this.active) {
      if (q.state === 'ready') { const n = this.game.npcs?.byId(q.giver); if (n) { const w = this.game.npcs.where(n); out.push({ x: w.x, z: w.z, color: '#ffe3a3', shape: 'star', edge: true, label: q.title }); } continue; }
      for (const o of q.objectives) {
        if (o.done) continue;
        const t = this.objectiveTarget(q, o);
        if (t) out.push({ x: t.x, z: t.z, color: t.color, shape: 'star', edge: true, label: t.label });
        break;
      }
    }
  }

  window(win) {
    const list = h('div');
    if (!this.active.length) list.appendChild(h('div', { class: 'istats' }, 'Aucune quête en cours. Parlez aux habitants de Havrelumière, ou consultez l’Oracle des Échos.'));
    for (const q of this.active) {
      list.appendChild(h('div', { style: { padding: '10px 0', borderBottom: '1px solid var(--line-soft)' } },
        h('div', { class: 'q' }, h('div', { class: 'qt' + (q.ai ? ' ai' : '') }, q.title)),
        h('div', { style: { fontFamily: 'var(--font-body)', fontSize: '15px', lineHeight: '1.45', margin: '4px 0 6px', color: 'var(--parch)' } }, q.desc || ''),
        ...q.objectives.map((o) => this.objectiveRow(win, o, '◆ ' + o.text + (o.count > 1 && o.type !== 'light' ? ` (${Math.floor(o.have)}/${o.count})` : o.type === 'light' ? ` (${o.have.toFixed(1)}/${o.count} %)` : ''))),
        q.state === 'ready' ? this.objectiveRow(win, this.returnObjective(q), '◆ Retourner voir ' + this.npcName(q.giver)) : null,
        h('div', { class: 'istats', style: { marginTop: '6px' } }, `Récompense : ${q.rewards?.xp || 0} xp · ${q.rewards?.gold || 0} or${q.rewards?.item !== undefined ? ' · un objet' : ''}${q.rewards?.chest ? ' · ' + CHEST_TIERS[q.rewards.chest].name.toLowerCase() : ''}`),
        q.state === 'ready' ? h('div', { class: 'istats', style: { color: 'var(--good)' } }, `Prêt à rendre à ${this.npcName(q.giver)}.`) : null,
      ));
    }
    if (this.active.length) list.prepend(h('div', { class: 'istats', style: { marginBottom: '4px' } }, 'Touchez un objectif pour savoir comment le réussir.'));
    // l'acte en cours du récit, et le chemin des Chroniques
    const st = this.game.story, A = st?.actInfo();
    if (A) list.prepend(h('div', { class: 'q-act' },
      h('div', { class: 'qa-h' }, `${A.title} · ${A.name}`),
      h('div', { class: 'qa-p' }, A.summary),
      h('button', { class: 'btn', type: 'button', onclick: () => win.open('chronicles') }, `Chroniques (${st.shardCount()}/5 Éclats)`)));
    const doneN = this.done.size;
    return win.frame('Journal de quêtes', list, h('div', { class: 'istats', style: { marginTop: '10px' } }, `${doneN} quête${doneN > 1 ? 's' : ''} accomplie${doneN > 1 ? 's' : ''}.`));
  }
}

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
