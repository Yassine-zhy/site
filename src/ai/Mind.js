import { BEACONS, CLASSES, SPAWN_ZONES } from '../config.js';
import { PLACES, objectiveText } from '../game/Quests.js';
import { RUNE_SPELLS } from '../game/Runes.js';

// Ce que tous les habitants savent du monde (pour des conseils exacts).
const LORE = `MONDE : Aetheria est un archipel d'îles flottantes au-dessus d'une mer de nuages. Il y a un siècle, le Roi Sans Lumière a éteint les cinq Phares ; depuis, la Brume violette relève les morts en squelettes. Le village de Havrelumière est protégé par le Cœur de Lumière (cristal doré sur la place).
PHARES (partagés par tous les héros du monde, ils s'éteignent lentement avec le temps réel) : Phare de l'Aube (est du village), Phare des Murmures (forêt Bois-Murmure, à l'est), Phare des Cendres (ruines au sud), Phare des Nuées (sur l'Îlot des Nuées à l'ouest, accessible en planant depuis la colonne de vent près du rivage ouest), Phare du Silence (sommet du Pic du Silence au nord, gardé par le boss Le Roi Sans Lumière).
COMMENT AIDER UN PHARE : vaincre des squelettes près de lui, tracer la rune Lux près de lui, ou le canaliser avec la touche E.
RUNES (clic droit maintenu puis tracer d'un seul geste ; précision = puissance) : Ignis = triangle (boule de feu), Fulgur = éclair en zigzag (foudre en chaîne), Vita = cercle (soin de groupe), Aegis = V (bouclier), Ventus = spirale (propulsion dans les airs), Lux = trait vertical (rayon sacré qui nourrit les phares).
DÉPLACEMENT : Espace pour sauter, Espace à nouveau en l'air pour la paravoile ; les colonnes de vent font monter. Maj = sprint, C = esquive, R = élixir, T = graver un écho (message laissé aux autres joueurs), G = saluer.
ZONES : Collines Ambrées (sud-ouest, niv. 1-3), abords du Phare de l'Aube (niv. 1-3), Bois-Murmure (niv. 3-6), les Cendres (niv. 5-9), Pic du Silence (niv. 8-15), Îlot des Nuées (niv. 7-10), Lac Miroir (ouest, niv. 2-4).
ENNEMIS : Serviteurs squelettes (faibles), Guerriers squelettes (boucliers, coups lourds), Rôdeurs squelettes (arbalètes), Nécromanciens (orbes d'ombre, zones violettes à éviter, invoquent des serviteurs). Les élites (dorées) sont plus fortes et plus riches.
GRANDES ÎLES : à l'est, les Terres d'Ambre (mesas, Gorge Rouge, Mine de Kessa, Comptoir d'Ambre tenu par Kessa et le vieux Tarek, Cirque d'Ambre où dort le Colosse d'Ambre, niv. 9-17) ; au nord, les Cimes de Givre (Halte-du-Givre de Bjorn le trappeur, Lac de Cristal, Sanctuaire Gelé de Sœur Neige, Mont Givrecroc où règne la Reine de Givre, niv. 13-20). On y va par les ponts de corde et les îlots-relais (Îlot du Relais, Îlot du Vent Sec à l'est ; Rocher du Passeur, Îlot des Lanternes au nord).
VOYAGE : les pierres de passage (obélisques) s'éveillent avec E et permettent ensuite de voyager instantanément entre elles. Un losange doré à l'écran indique toujours l'objectif de la quête suivie.
EXPÉDITIONS : près de la place, le Portail des Expéditions (violet) ouvre la Citadelle des Ombres. Avec la touche P (ou le menu Multijoueur), un héros héberge un groupe et donne un code à 5 lettres à jusqu'à trois amis ; ensemble ils affrontent la Sentinelle, la Liche et l'Avatar de la Brume, ou l'Arène des Seigneurs.
RÉCOLTE : Fleurs d'aube (prairies), Mousse d'argent (lac, forêt), Plumes des nuées (îlots), Éclats d'ambre (Ambre), Cristaux de givre (Givre) : on les ramasse en marchant dessus. Des anneaux de vent dorés se traversent en planant.`;

const PERSONAS = {
  elder: "Tu es Maëlis, l'Ancienne de Havrelumière, gardienne des Phares depuis trois siècles. Sage, douce, un brin malicieuse, tu parles par images (lumière, vent, nuages) et tu vouvoies le héros. Tu as connu le monde avant le Grand Silence.",
  smith: "Tu es Brom, le forgeron de Havrelumière. Bourru au grand cœur, ancien soldat, tu adores les blagues sur les squelettes (« ils n'ont rien dans le ventre »). Tu parles franchement, tu tutoies, tu vends l'amélioration d'armes et tu rachètes le butin.",
  guard: "Tu es Sir Aldric, chevalier sentinelle à la porte sud de Havrelumière. Protocolaire, loyal, un peu solennel, tu donnes volontiers des conseils de combat précis (esquive, bouclier, paravoile, colonnes de vent).",
  merchant: "Tu es Lysa, marchande voyageuse installée sur la place du marché. Curieuse, rapide, enthousiaste, tu collectionnes les rumeurs et les échos laissés par les voyageurs. Tu vends des élixirs.",
  oracle: "Tu es l'Oracle des Échos, une voix très ancienne sous un capuchon, qui entend les échos de tous les voyageurs d'Aetheria. Tu parles en phrases brèves et énigmatiques, parfois en vers libres, et tu tutoies. Tu donnes des quêtes que personne d'autre n'a reçues.",
  ondine: "Tu es Mère Ondine, herboriste de Havrelumière. Chaleureuse, un peu gourmande, tu connais toutes les plantes de l'archipel (Fleur d'aube, Mousse d'argent, Cristaux de givre, Éclats d'ambre) et tu vouvoies le héros en l'appelant « mon petit ».",
  pip: "Tu es Pip, apprenti cartographe de Havrelumière, quinze ans, enthousiaste et bavard. Tu rêves de cartographier tout l'archipel, tu parles vite, tu tutoies et tu t'émerveilles de tout.",
  rhea: "Tu es la Capitaine Rhéa, ancienne pilote de dirigeable, maîtresse des vents. Directe, sportive, tu adores les défis de vol (anneaux de vent, colonnes ascendantes, paravoile) et tu tutoies.",
  bjorn: "Tu es Bjorn, trappeur des Cimes de Givre, colosse taciturne au cœur tendre. Tu parles peu, avec des phrases courtes et imagées sur le froid, la neige et les squelettes de givre. Tu tutoies.",
  neige: "Tu es Sœur Neige, gardienne du Sanctuaire Gelé, prêtresse calme et mélancolique. Tu parles de la Reine de Givre avec crainte et pitié, et tu vouvoies le héros.",
  kessa: "Tu es Kessa, prospectrice des Terres d'Ambre, intrépide et moqueuse. Tu cherches de l'ambre ancien dans la Mine de Kessa et les mesas. Tu tutoies et tu fais des paris.",
  tarek: "Tu es Vieux Tarek, conteur des sables du Comptoir d'Ambre. Tu racontes la légende du Colosse d'Ambre, gardien déchu du Cirque, en phrases lentes et poétiques. Tu vouvoies.",
};

const PERMANENT = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);

export class Mind {
  constructor(game) {
    this.game = game;
    this.reset();
    this.disabled = false;
    this.busy = false;
  }

  // mémoire des conversations, propre à chaque emplacement de sauvegarde
  memKey() { const s = this.game.save?.slot || 0; return 'aetheria.npcmem.v1' + (s ? '.s' + s : ''); }
  reset() {
    this.history = {};
    try { this.history = JSON.parse(localStorage.getItem(this.memKey()) || '{}'); } catch { /* */ }
  }

  available() { return !!this.game.platform.sample && !this.disabled; }

  remember(npc, role, text) {
    const h = (this.history[npc] ||= []);
    h.push({ role, text: String(text).slice(0, 400) });
    while (h.length > 10) h.shift();
    try { localStorage.setItem(this.memKey(), JSON.stringify(this.history)); } catch { /* */ }
  }

  context() {
    const g = this.game, hero = g.hero;
    const ws = g.worldState;
    const beacons = BEACONS.map((b, i) => `${b.name} : ${Math.round((ws?.levels[i] || 0) * 100)} %`).join(', ');
    const t = g.world.sky.state.t;
    const quests = g.quests?.active.map((q) => `« ${q.title} » (${q.objectives.filter((o) => !o.done).map((o) => o.text).join(' ; ') || 'à rendre'})`).join(' | ') || 'aucune';
    const online = g.net ? g.net.peerCount() : 1;
    return `ÉTAT ACTUEL : ${t > 0.25 && t < 0.76 ? 'jour' : 'nuit'} ; lumière des phares : ${beacons} ; ${online} héros en ligne.
LE HÉROS : ${hero.name}, ${CLASSES[hero.classId].name} de niveau ${hero.level}, ${hero.kills} squelettes vaincus, ${Math.round(hero.light)} points de lumière offerts aux phares, ${hero.deaths} chutes. Quêtes en cours : ${quests}. Zone actuelle : ${g.currentZone().name}.`;
  }

  // ------------------------------------------------------------------ dialogue libre
  async chat(npc, line, onText) {
    const s = this.game.platform.sample;
    if (!s || this.disabled) throw { code: 'unavailable' };
    if (this.busy) throw { code: 'busy' };
    this.busy = true;
    const hist = (this.history[npc] || []).slice(-8);
    const instructions = `${PERSONAS[npc]}
Tu es un personnage du jeu vidéo Aetheria. Reste toujours dans ton rôle, ne mentionne jamais être une IA ni un jeu. Réponds dans la langue du joueur (français par défaut), en 1 à 3 phrases courtes et vivantes, sans liste ni mise en forme. Si le joueur demande de l'aide, donne un conseil exact tiré des connaissances ci-dessous. Si on te demande quelque chose hors de l'univers, détourne la conversation avec humour et dans ton rôle.
${LORE}
${this.context()}`;
    const turns = [{ role: 'user', content: instructions + '\n\nLe héros s’approche de toi.' }, { role: 'assistant', content: '…' }];
    for (const m of hist) turns.push({ role: m.role === 'npc' ? 'assistant' : 'user', content: m.text });
    turns.push({ role: 'user', content: line });
    // les tours doivent alterner : on fusionne les doublons
    const merged = [];
    for (const t of turns) { const last = merged[merged.length - 1]; if (last && last.role === t.role) last.content += '\n' + t.content; else merged.push({ ...t }); }
    try {
      const res = await s(merged, { onText: ({ text }) => onText?.(clean(text)), cache: false, modelTier: 'quick' });
      const text = clean(res.text);
      this.remember(npc, 'player', line);
      this.remember(npc, 'npc', text);
      return text;
    } catch (e) {
      if (PERMANENT.has(e?.code)) this.disabled = true;
      throw e;
    } finally { this.busy = false; }
  }

  // ------------------------------------------------------------------ quêtes de l'Oracle
  async generateQuest() {
    const s = this.game.platform.sample;
    if (!s || this.disabled) return fallbackQuest(this.game);
    if (this.busy) throw { code: 'busy' };
    this.busy = true;
    const g = this.game, lvl = g.hero.level;
    const zones = SPAWN_ZONES.filter((z) => z.level[0] <= lvl + 2).map((z) => `${z.id} (niv. ${z.level[0]}-${z.level[1]})`).join(', ');
    const prompt = `${PERSONAS.oracle}
Invente UNE quête courte et unique pour ce héros, adaptée à son niveau, qui raconte une petite histoire liée à l'état du monde.
${LORE}
${this.context()}
Réponds UNIQUEMENT avec un objet JSON de la forme :
{"title": "titre poétique de 2 à 6 mots", "story": "2 ou 3 phrases énigmatiques adressées au héros (tutoiement)", "objectives": [ ... 1 à 3 objectifs ... ], "farewell": "une phrase d'adieu de l'Oracle"}
Chaque objectif est l'un de ces objets (respecte exactement les valeurs permises) :
{"type":"kill","enemy":"minion|warrior|rogue|mage|any","zone":"<une zone parmi : ${zones}>","count":3-12}
{"type":"light","beacon":"aube|murmures|cendres|nuees|silence|any","count":5-20}
{"type":"rune","rune":"ignis|fulgur|vita|aegis|ventus|lux|any","count":1-5,"minScore":0.5-0.9}
{"type":"visit","place":"nuees|tresor|suspendu|pelerin|eclat|sommet|ruines|lac|foret"}
{"type":"glide"} {"type":"echo"} {"type":"loot","count":1-4} {"type":"ventus"}`;
    try {
      const out = await s.json(prompt, { cache: false });
      const q = validateQuest(out, g);
      this.remember('oracle', 'npc', `${q.title} — ${q.desc}`);
      return q;
    } catch (e) {
      if (PERMANENT.has(e?.code)) this.disabled = true;
      if (e?.code === 'rate_limited') throw e;
      return fallbackQuest(g);
    } finally { this.busy = false; }
  }
}

function clean(t) { return String(t || '').replace(/[*#_`>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 600); }

const ENEMY_IDS = ['minion', 'warrior', 'rogue', 'mage', 'any'];
const BEACON_IDS = BEACONS.map((b) => b.id).concat('any');
const RUNE_IDS = Object.keys(RUNE_SPELLS).concat('any');
const clampN = (v, a, b, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d; };

export function validateQuest(o, g) {
  if (!o || typeof o !== 'object' || !Array.isArray(o.objectives)) throw new Error('quête invalide');
  const lvl = g.hero.level;
  const objs = [];
  for (const raw of o.objectives.slice(0, 3)) {
    if (!raw || typeof raw !== 'object') continue;
    const t = raw.type;
    if (t === 'kill') {
      const zone = SPAWN_ZONES.find((z) => z.id === raw.zone && z.level[0] <= lvl + 3) ? raw.zone : undefined;
      objs.push({ type: 'kill', enemy: ENEMY_IDS.includes(raw.enemy) ? raw.enemy : 'any', zone, count: clampN(raw.count, 2, 12, 5) });
    } else if (t === 'light') objs.push({ type: 'light', beacon: BEACON_IDS.includes(raw.beacon) ? raw.beacon : 'any', count: clampN(raw.count, 3, 20, 8) });
    else if (t === 'rune') objs.push({ type: 'rune', rune: RUNE_IDS.includes(raw.rune) ? raw.rune : 'any', count: clampN(raw.count, 1, 5, 2), minScore: Math.max(0, Math.min(0.9, Number(raw.minScore) || 0)) || undefined });
    else if (t === 'visit' && PLACES[raw.place]) objs.push({ type: 'visit', place: raw.place });
    else if (t === 'glide' || t === 'echo' || t === 'ventus') objs.push({ type: t });
    else if (t === 'loot') objs.push({ type: 'loot', count: clampN(raw.count, 1, 4, 2) });
  }
  if (!objs.length) throw new Error('aucun objectif');
  // mêmes contraintes que la génération de base : on évite les doublons de visite déjà faite
  const difficulty = objs.reduce((s, x) => s + (x.type === 'kill' ? x.count * 1.2 : x.type === 'light' ? x.count : x.type === 'visit' ? 8 : x.type === 'rune' ? x.count * 2 + (x.minScore || 0) * 6 : 4), 0);
  const title = String(o.title || 'Murmure de l’Oracle').replace(/[\u0000-\u001f]/g, '').slice(0, 48);
  const desc = String(o.story || '').replace(/[\u0000-\u001f]/g, '').slice(0, 420);
  return {
    id: 'ai_' + Date.now().toString(36), giver: 'oracle', ai: true, title, desc, farewell: String(o.farewell || '').slice(0, 200),
    objectives: objs.map((x) => ({ ...x, have: 0, done: false, text: objectiveText(x) })), state: 'active',
    rewards: { xp: Math.round((40 + lvl * 25) * (1 + difficulty / 12)), gold: Math.round(10 + lvl * 4 + difficulty * 2), item: difficulty > 14 ? 2 : 1 },
  };
}

// Quêtes de secours (sans IA) : générées par gabarits.
const FB_TITLES = ['Le chant des os', 'Une lueur dans la Brume', 'Les vents contraires', 'L’écho perdu', 'Sous la peau des nuages', 'La rune oubliée', 'Ceux qui ne dorment pas', 'Le souffle de l’Aube'];
const FB_STORY = [
  'J’entends un écho qui se brise près d’ici. Les morts y dansent trop fort. Va, et rends-leur le silence.',
  'Une lumière tremble, prête à s’éteindre. Ta main peut la retenir, si ton geste est juste.',
  'Le vent m’a parlé de toi. Il veut te porter là où les autres n’osent pas aller.',
  'Les runes se souviennent de ceux qui les tracent avec soin. Montre-leur ta précision.',
];
export function fallbackQuest(g) {
  const lvl = g.hero.level;
  const zones = SPAWN_ZONES.filter((z) => z.level[0] <= lvl + 1);
  const z = zones[Math.floor(Math.random() * zones.length)] || SPAWN_ZONES[0];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const kinds = [
    () => ({ type: 'kill', enemy: pick(z.types), zone: z.id, count: 4 + Math.floor(Math.random() * 5) }),
    () => ({ type: 'rune', rune: pick(Object.keys(RUNE_SPELLS)), count: 1 + Math.floor(Math.random() * 3), minScore: Math.random() < 0.4 ? 0.7 : undefined }),
    () => ({ type: 'light', beacon: pick(BEACONS.slice(0, lvl > 6 ? 5 : 3)).id, count: 6 + Math.floor(Math.random() * 6) }),
    () => ({ type: 'visit', place: pick(lvl > 5 ? Object.keys(PLACES) : ['suspendu', 'lac', 'foret', 'ruines']) }),
    () => ({ type: 'loot', count: 2 }),
  ];
  const n = 1 + (Math.random() < 0.6 ? 1 : 0);
  const objs = [];
  while (objs.length < n) { const o = pick(kinds)(); if (!objs.some((x) => x.type === o.type)) objs.push(o); }
  return validateQuest({ title: pick(FB_TITLES), story: pick(FB_STORY), objectives: objs, farewell: 'Va. Les échos te regardent.' }, g);
}

// Répliques de secours, quand on ne peut pas parler librement.
export const FALLBACK_LINES = {
  elder: ['La lumière ne se donne pas : elle se partage. Chaque héros qui passe nourrit un peu les Phares.', 'Avez-vous remarqué ? Là où les Phares brillent, les fleurs reviennent.', 'Le Roi Sans Lumière n’aime pas le vent. Peut-être est-ce pour cela qu’il vit si haut.'],
  smith: ['Les squelettes ? Ils n’ont rien dans le ventre, ha ! Mais leurs haches, elles, coupent bien.', 'Rapporte-moi du butin, je t’en donne un bon prix. Et fais-moi briller cette arme.', 'Un conseil de vieux soldat : esquive avec C, et ne reste jamais dans une zone violette.'],
  guard: ['Gardez votre endurance pour l’esquive, héros. Un pas de côté vaut mieux qu’un bouclier brisé.', 'Les colonnes de vent, près des rivages, vous porteront jusqu’aux îlots. Ouvrez la paravoile dans le courant.', 'La nuit, les morts sont plus nombreux. Mais les aurores, elles, valent le détour.'],
  ondine: ['Mon petit, la Fleur d’aube ne pousse que là où la Brume recule.', 'Rapportez-moi des herbes, je vous ferai des élixirs à vous réveiller un squelette… enfin, façon de parler.'],
  pip: ['Tu as vu la nouvelle carte ? Deux îles immenses ! Les Cimes de Givre au nord, les Terres d’Ambre à l’est !', 'Les pierres de passage, c’est magique : tu en éveilles une et hop, tu voyages !'],
  rhea: ['Les anneaux de vent, ça se prend en planant, pas en marchant !', 'Une colonne de vent, la paravoile ouverte, et tu montes jusqu’aux nuages.'],
  bjorn: ['Froid. Squelettes. Encore du froid.', 'La Reine… elle chante, là-haut. N’écoute pas.'],
  neige: ['Le Sanctuaire était un lieu de paix, avant que la glace ne se souvienne de la colère.', 'Rallumez le Phare du Givre, et la Reine perdra un peu de sa force.'],
  kessa: ['Tu parles d’un trésor : la mine regorge d’ambre, et de squelettes aussi.', 'Je te parie dix pièces que tu n’arriveras pas au sommet de la grande mesa !'],
  tarek: ['Le Colosse veillait sur le Cirque… avant que la Brume ne lui vole son cœur.', 'Le sable se souvient de tout, voyageur.'],
  merchant: ['Des élixirs ! Frais du matin, ou presque. Vous en voulez ?', 'On raconte qu’un trésor dort sur l’Îlot du Trésor, à l’est. Il paraît qu’il faut planer longtemps.', 'J’adore lire les échos des voyageurs. Laissez-en un, vous aussi : touche T !'],
  oracle: ['Je t’entends, voyageur. Ton écho est encore jeune.', 'Trace la spirale, et le ciel s’ouvrira.', 'Cinq lumières. Une seule Brume. Combien de mains ?'],
};
