import { h } from './dom.js';
import { recognize, glyphPath } from '../game/Recognizer.js';
import { RUNE_SPELLS } from '../game/Runes.js';
import { BEACONS, WORLD_BOSSES } from '../config.js';
import { PLACES, ZONE_NAMES } from '../game/Quests.js';
import { BOSS_KITS } from '../game/Boss.js';
import { ITEMS_GATHER, RING_SETS } from '../game/Gathering.js';

// Tutoriels de quêtes : un clic sur un objectif (journal ou suivi) explique comment le
// réussir, avec les commandes de l'appareil utilisé. Les runes ont un tracé animé et une
// zone d'entraînement qui note la précision comme en jeu (sans dépenser d'éther).

const ADVICE = {
  lux: 'Un seul trait bien vertical, assez long, sans crochet au bout.',
  ignis: 'Un triangle fermé : terminez exactement là où vous avez commencé.',
  vita: 'Un cercle bien rond qui se referme sur lui-même.',
  aegis: 'Un V : descendez en diagonale, puis remontez, pointe en bas.',
  fulgur: 'Un éclair en Z : diagonale, petit trait horizontal, diagonale.',
  ventus: 'Une spirale qui s’enroule de l’intérieur vers l’extérieur (deux tours).',
};

const kbd = (k) => h('kbd', { class: 'tk' }, k);
const step = (...c) => h('li', {}, ...c);

function runeSteps(touch, spell) {
  const steps = touch
    ? [step('Touchez le bouton ', h('b', {}, 'rune'), ' (le triangle violet, à droite).'),
      step('Dessinez la forme avec le doigt, ', h('b', {}, 'd’un seul geste'), '.'),
      step('Levez le doigt : la rune est reconnue et lancée.')]
    : [step('Maintenez le ', h('b', {}, 'clic droit'), ' de la souris.'),
      step('Tracez la forme ', h('b', {}, 'd’un seul geste'), ', sans relâcher.'),
      step('Relâchez : la rune est reconnue et lancée.'),
      step('Autre méthode : ', kbd('X'), ' puis tracez, et ', kbd('X'), ' ou clic gauche pour finir.')];
  if (spell) steps.push(step(`Il faut ${spell.mana} points d’éther (barre bleue).`));
  return steps;
}

// Glyphe animé : le tracé se dessine, un point lumineux montre le sens du geste.
function glyphAnim(name, color, size = 150) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.classList.add('tut-glyph');
  const d = glyphPath(name, size, Math.round(size * 0.12));
  const ghost = document.createElementNS(ns, 'path');
  ghost.setAttribute('d', d); ghost.setAttribute('class', 'ghost');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d); path.setAttribute('class', 'ink'); path.style.stroke = color; path.style.color = color;
  const start = document.createElementNS(ns, 'circle');
  const m = /M\s*([\d.]+)\s+([\d.]+)/.exec(d);
  start.setAttribute('cx', m[1]); start.setAttribute('cy', m[2]); start.setAttribute('r', String(Math.max(3, size / 25))); start.setAttribute('class', 'start');
  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('r', String(Math.max(2.5, size / 30))); dot.setAttribute('class', 'dot'); dot.style.fill = color;
  const motion = document.createElementNS(ns, 'animateMotion');
  motion.setAttribute('dur', '2.4s'); motion.setAttribute('repeatCount', 'indefinite'); motion.setAttribute('path', d);
  motion.setAttribute('keyPoints', '0;1;1'); motion.setAttribute('keyTimes', '0;0.7;1'); motion.setAttribute('calcMode', 'linear');
  dot.appendChild(motion);
  svg.append(ghost, path, start, dot);
  // longueur du tracé pour l'animation de dessin
  requestAnimationFrame(() => { try { const L = path.getTotalLength(); path.style.strokeDasharray = L; path.style.setProperty('--len', L); } catch { /* */ } });
  return svg;
}

// Zone d'entraînement : même reconnaissance et même note qu'en jeu.
function practicePad(target, minScore, onSuccess) {
  const wrap = h('div', { class: 'tut-pad' });
  const canvas = h('canvas', { class: 'tut-canvas' });
  const result = h('div', { class: 'tut-result' }, 'Dessinez ici avec la souris (clic gauche) ou le doigt.');
  wrap.append(canvas, result);
  const ctx = canvas.getContext('2d');
  let pts = [], down = false, best = 0;
  const color = target ? RUNE_SPELLS[target].color : '#e2ccff';
  const fit = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.max(1, r.width * dpr); canvas.height = Math.max(1, r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (pts.length < 2) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, a] of [[12, 0.18], [5, 0.9]]) {
      ctx.strokeStyle = color; ctx.globalAlpha = a; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault(); fit();
    canvas.setPointerCapture(e.pointerId);
    down = true; pts = [pos(e)]; draw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!down) return;
    const p = pos(e), l = pts[pts.length - 1];
    if (Math.hypot(p.x - l.x, p.y - l.y) >= 2) { pts.push(p); draw(); }
  });
  const end = () => {
    if (!down) return;
    down = false;
    const r = recognize(pts);
    result.innerHTML = '';
    if (!r) { result.append(h('span', { class: 'bad' }, 'Tracé trop court : faites un geste plus grand.')); return; }
    const pct = Math.round(r.score * 100);
    const sp = RUNE_SPELLS[r.name];
    if (r.score < 0.38) { result.append(h('span', { class: 'bad' }, `La rune se brise (${pct} %). `), target ? ADVICE[target] : 'Tracez une forme plus nette.'); return; }
    if (target && r.name !== target) {
      result.append(h('span', { class: 'bad' }, `Reconnu : ${sp.name} (${pct} %), pas ${RUNE_SPELLS[target].name}. `), ADVICE[target]);
      return;
    }
    best = Math.max(best, r.score);
    const ok = !minScore || r.score >= minScore;
    result.append(h('b', { style: { color: sp.color } }, sp.name), ` · précision ${pct} %`);
    if (ok) { result.append(h('span', { class: 'good' }, ' ✓ Réussi ! Faites pareil en jeu.')); onSuccess?.(); }
    else result.append(h('span', { class: 'bad' }, ` — il faut ${Math.round(minScore * 100)} %. `), ADVICE[r.name]);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  requestAnimationFrame(fit);
  return wrap;
}

function runeTutorial(g, o, touch) {
  const target = o.rune && o.rune !== 'any' ? o.rune : (o.type === 'ventus' ? 'ventus' : null);
  const minScore = o.minScore || 0;
  const show = target || 'lux';
  const sp = RUNE_SPELLS[show];
  const intro = target
    ? `La rune ${sp.name} se trace en forme de ${sp.shape}. ${sp.desc}`
    : 'N’importe quelle rune compte. La plus simple est Lux : un trait vertical.';
  const precision = minScore
    ? h('p', { class: 'tut-note' }, `Précision demandée : au moins ${Math.round(minScore * 100)} %. Elle s’affiche sous le nom de la rune après le tracé. `, ADVICE[show])
    : h('p', { class: 'tut-note' }, 'Une rune est lancée dès 38 % de précision ; plus le tracé est net, plus elle est puissante. ', ADVICE[show]);
  const others = target ? null : h('div', { class: 'tut-runes' }, ...Object.entries(RUNE_SPELLS).map(([id, r]) =>
    h('div', { class: 'tut-rune', title: r.desc }, glyphAnim(id, r.color, 56), h('div', {}, h('b', { style: { color: r.color } }, r.name), h('br'), r.shape))));
  return {
    lead: intro,
    body: [
      h('div', { class: 'tut-row' },
        h('div', { class: 'tut-glyph-box' }, glyphAnim(show, sp.color), h('div', { class: 'tut-cap' }, 'Le point vert marque le départ. Le sens n’a pas d’importance.')),
        h('ol', { class: 'tut-steps' }, ...runeSteps(touch, sp))),
      precision,
      others,
      h('h4', { class: 'tut-h' }, 'Entraînez-vous'),
      practicePad(target, minScore, () => g.audio?.play('runeok')),
      show === 'lux' ? h('p', { class: 'tut-note' }, 'Astuce : tracé à moins de 18 m d’un Phare, Lux lui offre aussi de la lumière.') : null,
    ],
    actions: touch ? [['Tracer en jeu maintenant', () => { g.windows.close(); g.runes?.beginTouch(); }]] : [],
  };
}

function beaconOf(o) { return o.beacon && o.beacon !== 'any' ? BEACONS.find((b) => b.id === o.beacon) : null; }

function lightTutorial(g, o, touch) {
  const b = beaconOf(o);
  const where = b ? `le ${b.name}` : 'un Phare';
  return {
    lead: `Les Phares s’éteignent avec le temps. Chaque héros peut leur rendre de la lumière, et la Brume recule autour d’eux.${o.type === 'beaconLit' ? ' Il faut atteindre 100 % : tous les joueurs y contribuent ensemble.' : ''}`,
    body: [
      h('ol', { class: 'tut-steps' },
        step(`Rejoignez ${where} : il est marqué d’une étoile dorée sur la carte (`, touch ? 'bouton carte' : kbd('M'), ').'),
        step(h('b', {}, 'Canaliser : '), 'à moins de 9 m du phare, ', touch ? 'touchez « Interagir »' : ['appuyez sur ', kbd('E')], ' et restez immobile 2,6 s (puis 14 s de repos).'),
        step(h('b', {}, 'Combattre : '), 'chaque squelette vaincu près du phare lui donne de la lumière.'),
        step(h('b', {}, 'Rune Lux : '), 'un trait vertical tracé à moins de 18 m du phare (voir le tutoriel des runes).')),
      h('p', { class: 'tut-note' }, 'La jauge « Lumière du monde » en haut de l’écran montre l’état des cinq phares.'),
    ],
    actions: [['Voir sur la carte', () => g.windows.open('map')], ['Comment tracer Lux', () => g.windows.openTutorial({ type: 'rune', rune: 'lux', count: 1, text: 'Tracer la rune Lux' })]],
  };
}

function killTutorial(g, o, touch) {
  const zone = o.zone ? ZONE_NAMES[o.zone] : null;
  return {
    lead: `Les squelettes se relèvent dans la Brume violette, surtout autour des phares éteints${zone ? `. Ceux-ci doivent être vaincus dans ${zone}` : ''}.`,
    body: [
      h('ol', { class: 'tut-steps' },
        step('Allez vers ', zone ? h('b', {}, zone) : 'la Brume (zones violettes)', ' : une étoile rouge la signale sur la carte.'),
        step('Attaquez : ', touch ? ['bouton d’attaque (le grand, en bas à droite) ou une tape sur la scène'] : ['clic gauche (cliquez d’abord dans le jeu pour capturer la souris)']),
        step('Compétences : ', touch ? 'les boutons autour de l’attaque' : [kbd('1'), ' ', kbd('2'), ' ', kbd('3'), ' ', kbd('4')], ' — elles se débloquent avec les niveaux.'),
        step('Esquivez les cercles rouges : ', touch ? 'bouton « esquive »' : kbd('C'), '. Élixir de vie : ', touch ? 'bouton « élixir »' : kbd('R'), '.')),
      h('p', { class: 'tut-note' }, 'Les runes Ignis (triangle) et Fulgur (éclair) font de gros dégâts de zone.'),
    ],
    actions: [['Voir sur la carte', () => g.windows.open('map')]],
  };
}

function talkTutorial(g, o, touch) {
  const name = o.npcName || g.npcs?.byId(o.npc)?.name || 'le personnage';
  return {
    lead: `${name} vous attend. Les habitants avec une quête portent un « ! » doré au-dessus de la tête.`,
    body: [
      h('ol', { class: 'tut-steps' },
        step('Suivez l’étoile dorée sur la minicarte (en haut à droite) ou la carte (', touch ? 'bouton carte' : kbd('M'), ').'),
        step('Approchez-vous : le message « Parler » apparaît en bas de l’écran.'),
        step(touch ? 'Touchez le bouton « Interagir ».' : ['Appuyez sur ', kbd('E'), '.']),
        step('Vous pouvez aussi lui écrire librement : les habitants vous répondent.')),
    ],
    actions: [['Voir sur la carte', () => g.windows.open('map')]],
  };
}

function visitTutorial(g, o, touch) {
  const pl = PLACES[o.place];
  const islet = /Îlot|Éclat/.test(pl?.name || '');
  return {
    lead: `Rejoignez ${pl?.name || 'ce lieu'} : une étoile dorée le marque sur la carte.`,
    body: [
      h('ol', { class: 'tut-steps' },
        step('Ouvrez la carte (', touch ? 'bouton carte' : kbd('M'), ') et repérez l’étoile.'),
        islet
          ? step('C’est un îlot flottant : prenez un pont de corde, ou entrez dans une ', h('b', {}, 'colonne de vent'), ' (tourbillon lumineux) qui vous soulève, puis planez.')
          : step('Suivez les chemins de terre : ils relient les lieux importants.'),
        step('Pour planer : sautez puis appuyez encore sur ', touch ? 'le bouton « saut »' : kbd('Espace'), ' en l’air.'),
        o.place === 'sommet' ? step('Le sommet est haut : grimpez par les pentes douces, ou planez depuis une colonne de vent.') : null),
    ],
    actions: [['Voir sur la carte', () => g.windows.open('map')]],
  };
}

function glideTutorial(g, o, touch) {
  const jump = touch ? 'le bouton « saut »' : kbd('Espace');
  return {
    lead: 'La paravoile vous laisse planer d’île en île.',
    body: [
      h('ol', { class: 'tut-steps' },
        step('Sautez avec ', jump, '.'),
        step('En l’air, appuyez de nouveau sur ', jump, ' : la paravoile s’ouvre.'),
        step('Dirigez-vous normalement ; vous descendez doucement.'),
        step('Appuyez encore sur ', jump, ' pour la refermer.')),
      h('p', { class: 'tut-note' }, 'Les colonnes de vent (tourbillons près des rivages) vous font monter très haut quand vous planez dedans. Sautez d’un endroit élevé pour aller plus loin.'),
    ],
    actions: [],
  };
}

function echoTutorial(g, o, touch) {
  return {
    lead: 'Un écho est un message que vous gravez dans le monde : les autres joueurs le voient et peuvent le faire résonner.',
    body: [
      h('ol', { class: 'tut-steps' },
        step('Placez-vous à un endroit qui vous plaît.'),
        step(touch ? 'Touchez « Graver un écho » ci-dessous.' : ['Appuyez sur ', kbd('T'), ' (ou le bouton ci-dessous).']),
        step('Écrivez une courte phrase et validez.')),
    ],
    actions: [['Graver un écho maintenant', () => { g.windows.close(); g.echoes?.composeWindow(); }]],
  };
}

function lootTutorial(g, o, touch) {
  return {
    lead: 'Les squelettes laissent parfois tomber des armes, des reliques et de l’or.',
    body: [
      h('ol', { class: 'tut-steps' },
        step('Vainquez des squelettes (voir les commandes de combat).'),
        step('Marchez sur les objets lumineux au sol : ils sont ramassés automatiquement.'),
        step('Ouvrez le sac (', touch ? 'bouton sac' : kbd('I'), ') pour les équiper ; « ▲ meilleur » signale une amélioration.')),
      h('p', { class: 'tut-note' }, 'Sac plein ? Vendez vos objets à Brom le forgeron.'),
    ],
    actions: [],
  };
}

const BOSS_TIPS = {
  roi: 'Il appelle ses gardes à 70 %, 40 % et 15 % de vie : éliminez-les vite.',
  colosse: 'Ses charges traversent l’arène en ligne droite : écartez-vous sur le côté. Ses séismes frappent en anneaux.',
  reine: 'Le blizzard gèle le sol : quittez les zones bleues. Ses novas de givre vous ralentissent, gardez votre esquive.',
};

function bossTutorial(g, o, touch) {
  const id = o.boss || 'roi';
  const kit = BOSS_KITS[id] || BOSS_KITS.roi;
  const wb = WORLD_BOSSES.find((b) => b.id === id);
  const where = wb ? `${wb.region}` : 'son repaire';
  return {
    lead: `${kit.name} règne sur ${where}. C’est un combat difficile : venez avec un bon niveau (${wb?.level || 10} conseillé), ou à plusieurs.`,
    body: [
      h('ol', { class: 'tut-steps' },
        step('Suivez la balise rouge (losange à l’écran, étoile sur la carte).'),
        step('Ses coups sont annoncés par des zones rouges au sol : sortez-en, ou esquivez (', touch ? 'bouton « esquive »' : kbd('C'), ').'),
        step(BOSS_TIPS[id] || 'Observez ses attaques : chacune a un signe annonciateur.'),
        step('Runes utiles : Aegis (V) pour un bouclier, Vita (cercle) pour vous soigner.')),
      h('p', { class: 'tut-note' }, 'Gardez des élixirs de vie (', touch ? 'bouton « élixir »' : kbd('R'), '). Les autres joueurs proches combattent avec vous ; invitez des amis avec le menu Multijoueur (', touch ? 'bouton ⚔' : kbd('P'), ').'),
    ],
    actions: [['Voir sur la carte', () => g.windows.open('map')]],
  };
}

const GATHER_WHERE = {
  aube: 'dans les prairies autour de Havrelumière et dans les Collines',
  mousse: 'sur les rives du Lac Miroir et dans le Bois-Murmure',
  plume: 'sur les îlots flottants (Nuées, Trésor, Pèlerin, Éclat, Suspendu)',
  ambre: 'dans les Terres d’Ambre : mesas, mine de Kessa, Gorge Rouge',
  givre: 'aux Cimes de Givre : autour du Lac de Cristal et du Sanctuaire',
};

function collectTutorial(g, o) {
  const it = ITEMS_GATHER[o.item] || { name: 'ressource', plural: 'ressources', color: '#ffe3a3' };
  return {
    lead: `On trouve les ${it.plural.toLowerCase()} ${GATHER_WHERE[o.item] || 'dans le monde'}. Elles brillent et tournent sur elles-mêmes.`,
    body: [
      h('ol', { class: 'tut-steps' },
        step('Suivez la balise de couleur ', h('b', { style: { color: it.color } }, it.name), ' : elle indique la plus proche.'),
        step('Marchez simplement dessus : la récolte est automatique.'),
        step('Une ressource cueillie repousse au bout de deux minutes.')),
      h('p', { class: 'tut-note' }, 'Chaque récolte rapporte aussi un peu d’or et d’expérience.'),
    ],
    actions: [['Voir sur la carte', () => g.windows.open('map')]],
  };
}

function waystoneTutorial(g, o, touch) {
  return {
    lead: 'Les pierres de passage sont de hauts obélisques gravés. Une fois éveillées, elles permettent de voyager instantanément entre elles.',
    body: [
      h('ol', { class: 'tut-steps' },
        step('Suivez la balise bleue : elle mène à la pierre la plus proche que vous n’avez pas encore éveillée.'),
        step('Approchez-vous et ', touch ? 'touchez « Interagir »' : ['appuyez sur ', kbd('E')], ' : la pierre s’éveille.'),
        step('Ensuite, ', touch ? 'touchez « Interagir »' : [kbd('E')], ' près de n’importe quelle pierre pour choisir une destination.')),
      h('p', { class: 'tut-note' }, 'Il y en a une à Havrelumière, aux Cendres, au pied du Pic, et dans chaque grande île.'),
    ],
    actions: [['Voir sur la carte', () => g.windows.open('map')]],
  };
}

function updraftTutorial(g, o, touch) {
  const jump = touch ? 'le bouton « saut »' : kbd('Espace');
  return {
    lead: 'Les colonnes de vent sont des tourbillons lumineux qui montent vers le ciel, près des rivages et des falaises.',
    body: [
      h('ol', { class: 'tut-steps' },
        step('Suivez la balise bleu clair jusqu’à la colonne la plus proche.'),
        step('Entrez dedans et sautez (', jump, ') : le vent vous soulève.'),
        step('Ouvrez la paravoile (', jump, ' en l’air) pour monter encore plus haut, puis planez où vous voulez.')),
    ],
    actions: [['Voir sur la carte', () => g.windows.open('map')]],
  };
}

function ringsTutorial(g, o, touch) {
  const set = RING_SETS[o.set];
  const jump = touch ? 'le bouton « saut »' : kbd('Espace');
  return {
    lead: `Des anneaux dorés flottent ${set?.name || 'dans le ciel'}. Traversez-les en planant, dans l’ordre.`,
    body: [
      h('ol', { class: 'tut-steps' },
        step('Rejoignez la colonne de vent de départ (la balise vous y conduit).'),
        step('Montez jusqu’en haut en planant (', jump, ' deux fois).'),
        step('Planez droit vers le premier anneau : ils sont placés sur votre pente de vol, il suffit de garder le cap.'),
        step('Trop bas ? Refermez et rouvrez la paravoile ne fait pas remonter : retournez à la colonne.')),
      h('p', { class: 'tut-note' }, 'Un anneau traversé devient vert. La balise montre toujours le suivant.'),
    ],
    actions: [],
  };
}

function eliteTutorial(g, o, touch) {
  const k = killTutorial(g, { type: 'kill' }, touch);
  k.lead = 'Les élites sont des squelettes plus grands, à l’armure dorée, avec « Élite » devant leur nom. Ils apparaissent parfois parmi les autres, partout dans le monde.';
  k.body.unshift(h('p', { class: 'tut-note' }, 'Ils sont plus résistants mais lâchent presque toujours un bon objet. Battez-vous dans des zones de votre niveau.'));
  return k;
}

function expeditionTutorial(g, o, touch) {
  return {
    lead: 'Les expéditions se jouent jusqu’à 4 amis, dans la Citadelle des Ombres : épreuves, boss et grosses récompenses.',
    body: [
      h('ol', { class: 'tut-steps' },
        step('Ouvrez le menu Multijoueur (', touch ? 'bouton ⚔' : [kbd('P'), ' ou le bouton « Expéditions »'], ') ou approchez du portail violet près de la place du village.'),
        step(h('b', {}, 'Héberger'), ' crée un groupe et affiche un code à 5 lettres. Donnez-le à vos amis.'),
        step('Vos amis choisissent ', h('b', {}, 'Rejoindre'), ' et tapent le code.'),
        step('L’hôte lance une expédition : tout le groupe est téléporté.')),
      h('p', { class: 'tut-note' }, 'Seul, vous pouvez aussi lancer une expédition : elle s’adapte au nombre de joueurs.'),
    ],
    actions: [['Ouvrir le menu Multijoueur', () => g.windows.open('party')]],
  };
}

function levelTutorial(g, o) {
  return {
    lead: `Gagnez de l’expérience pour atteindre le niveau ${o.count}.`,
    body: [h('ol', { class: 'tut-steps' },
      step('Les quêtes donnent beaucoup d’expérience : parlez aux habitants et à l’Oracle des Échos.'),
      step('Chaque squelette vaincu en donne aussi ; les élites (dorés) davantage.'),
      step('Découvrir de nouveaux lieux rapporte de l’expérience.'))],
    actions: [],
  };
}

function returnTutorial(g, o, touch) {
  const t = talkTutorial(g, o, touch);
  t.lead = `Objectifs accomplis ! Retournez voir ${o.npcName || 'le donneur de quête'} pour recevoir la récompense.`;
  return t;
}

const BUILDERS = { rune: runeTutorial, ventus: runeTutorial, light: lightTutorial, beaconLit: lightTutorial, kill: killTutorial, talk: talkTutorial, visit: visitTutorial, glide: glideTutorial, echo: echoTutorial, loot: lootTutorial, boss: bossTutorial, level: levelTutorial, return: returnTutorial, collect: collectTutorial, waystone: waystoneTutorial, updraft: updraftTutorial, rings: ringsTutorial, elite: eliteTutorial, expedition: expeditionTutorial };

export function hasTutorial(o) { return !!(o && BUILDERS[o.type]); }

// Contenu de la fenêtre « Comment faire ? »
export function tutorialView(g, o, { onBack } = {}) {
  const touch = !!g.input?.isTouch;
  const t = (BUILDERS[o.type] || talkTutorial)(g, o, touch);
  const done = o.done ? h('span', { class: 'good' }, ' ✓ accompli') : null;
  return h('div', { class: 'tut' },
    h('div', { class: 'tut-obj' }, '◆ ', o.text || '', done),
    h('p', { class: 'tut-lead' }, t.lead),
    ...t.body.filter(Boolean),
    h('div', { class: 'tut-actions' },
      onBack ? h('button', { class: 'btn ghost small', onclick: onBack }, '← Journal de quêtes') : null,
      ...t.actions.map(([label, fn]) => h('button', { class: 'btn small', onclick: fn }, label))));
}
