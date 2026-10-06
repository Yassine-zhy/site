import { h } from '../ui/dom.js';
import { BEACONS, ISLETS, MOUNTAIN, RUINS, LAKE, FOREST, SPAWN_ZONES, ENEMIES } from '../config.js';
import { generateItem } from './Items.js';
import { RUNE_SPELLS } from './Runes.js';

export const PLACES = {
  nuees: { name: 'l’Îlot des Nuées', x: ISLETS[0].x, z: ISLETS[0].z, r: 30 },
  tresor: { name: 'l’Îlot du Trésor', x: ISLETS[1].x, z: ISLETS[1].z, r: 20 },
  suspendu: { name: 'l’Îlot Suspendu', x: ISLETS[2].x, z: ISLETS[2].z, r: 18 },
  pelerin: { name: 'l’Îlot du Pèlerin', x: ISLETS[3].x, z: ISLETS[3].z, r: 18 },
  eclat: { name: 'l’Éclat Errant', x: ISLETS[4].x, z: ISLETS[4].z, r: 11 },
  sommet: { name: 'le sommet du Pic du Silence', x: MOUNTAIN.x, z: MOUNTAIN.z - 4, r: 18, minY: 55 },
  ruines: { name: 'les Cendres', x: RUINS.x, z: RUINS.z, r: 30 },
  lac: { name: 'le Lac Miroir', x: LAKE.x, z: LAKE.z, r: 34 },
  foret: { name: 'le cœur du Bois-Murmure', x: FOREST.x, z: FOREST.z, r: 30 },
};
export const ZONE_NAMES = Object.fromEntries(SPAWN_ZONES.map((z) => [z.id, { collines: 'les Collines Ambrées', aube: 'les abords du Phare de l’Aube', foret: 'le Bois-Murmure', cendres: 'les Cendres', montagne: 'le Pic du Silence', nuees: 'l’Îlot des Nuées', lac: 'les rives du Lac Miroir' }[z.id]]));

// Texte d'un objectif
export function objectiveText(o) {
  switch (o.type) {
    case 'talk': return `Parler à ${o.npcName || o.npc}`;
    case 'kill': return `Vaincre ${o.count} ${o.enemy && o.enemy !== 'any' ? ENEMIES[o.enemy].name.toLowerCase() + (o.count > 1 ? 's' : '') : 'squelette' + (o.count > 1 ? 's' : '')}${o.zone ? ' dans ' + ZONE_NAMES[o.zone] : ''}`;
    case 'light': return `Offrir ${o.count} % de lumière ${o.beacon && o.beacon !== 'any' ? 'au ' + BEACONS.find((b) => b.id === o.beacon).name : 'aux Phares'}`;
    case 'rune': return `Tracer ${o.rune && o.rune !== 'any' ? 'la rune ' + RUNE_SPELLS[o.rune].name : 'une rune'}${o.minScore ? ` (précision ≥ ${Math.round(o.minScore * 100)} %)` : ''}${o.count > 1 ? ' ' + o.count + ' fois' : ''}`;
    case 'visit': return `Atteindre ${PLACES[o.place].name}`;
    case 'glide': return 'Planer avec la paravoile (Espace deux fois)';
    case 'echo': return 'Graver un écho (touche T)';
    case 'loot': return `Récupérer ${o.count} objet${o.count > 1 ? 's' : ''} sur les squelettes`;
    case 'boss': return 'Terrasser le Roi Sans Lumière';
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
  { id: 'm4', giver: 'guard', title: 'Les ailes du vent', desc: "Sir Aldric veut voir si vous savez voler. Sautez, puis appuyez à nouveau sur Espace pour ouvrir la paravoile. Le pont de corde mène à l'Îlot Suspendu, au sud-est.", objectives: [{ type: 'glide' }, { type: 'visit', place: 'suspendu' }], rewards: { xp: 260, gold: 40 } },
  { id: 'm5', giver: 'elder', title: 'Murmures dans le bois', desc: "Le Bois-Murmure ne chante plus. Purgez la forêt et ravivez le Phare des Murmures.", objectives: [{ type: 'kill', zone: 'foret', count: 8 }, { type: 'light', beacon: 'murmures', count: 10 }], rewards: { xp: 520, gold: 60, item: 1 } },
  { id: 'm6', giver: 'elder', title: 'La cité des cendres', desc: "Au sud, les ruines de l'ancienne cité grouillent de guerriers et de nécromanciens.", objectives: [{ type: 'kill', zone: 'cendres', count: 10 }, { type: 'light', beacon: 'cendres', count: 10 }], rewards: { xp: 900, gold: 90, item: 2 } },
  { id: 'm7', giver: 'guard', title: 'Au-dessus des nuages', desc: "L'Îlot des Nuées flotte à l'ouest. Les colonnes de vent près du rivage vous y porteront : entrez dans le courant, planez, et ravivez le Phare des Nuées.", objectives: [{ type: 'visit', place: 'nuees' }, { type: 'light', beacon: 'nuees', count: 10 }], rewards: { xp: 1300, gold: 120, item: 2 } },
  { id: 'm8', giver: 'elder', title: 'Le Roi Sans Lumière', desc: "Au sommet du Pic du Silence, le Roi Sans Lumière garde le dernier phare. Allez-y à plusieurs si vous le pouvez.", objectives: [{ type: 'visit', place: 'sommet' }, { type: 'boss' }], rewards: { xp: 3000, gold: 400, item: 3 } },
  { id: 'm9', giver: 'elder', title: 'L’Aube Éternelle', desc: "Tant que les cinq phares brillent ensemble, la Brume ne peut revenir. Unissez les héros d'Aetheria.", objectives: [{ type: 'level', count: 15 }], rewards: { xp: 2000, gold: 300, item: 3 } },
];

const SIDE = {
  smith: { id: 's_smith', giver: 'smith', title: 'Fer et os', desc: 'Brom refond les armes des squelettes. Rapportez-lui trois objets.', objectives: [{ type: 'loot', count: 3 }], rewards: { xp: 150, gold: 80 }, repeat: true },
  merchant: { id: 's_echo', giver: 'merchant', title: 'Laisser sa trace', desc: 'Lysa collectionne les échos des voyageurs. Gravez le vôtre quelque part dans le monde (touche T).', objectives: [{ type: 'echo' }], rewards: { xp: 120, gold: 40 } },
};

export class Quests {
  constructor(game) {
    this.game = game;
    this.active = [];
    this.done = new Set();
    this.mainIdx = 0;
    this.trackedKey = '';
  }

  serialize() { return { active: this.active, done: [...this.done], mainIdx: this.mainIdx }; }
  load(d) {
    if (!d) return;
    this.active = (d.active || []).filter((q) => q && q.objectives);
    this.done = new Set(d.done || []);
    this.mainIdx = d.mainIdx || 0;
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
    this.game.audio?.play('quest');
    this.changed();
    return q;
  }

  instantiate(def) {
    return { ...def, objectives: def.objectives.map((o) => ({ ...o, have: 0, count: o.count || 1, done: false, text: objectiveText({ ...o, count: o.count || 1 }) })), state: 'active', t: Date.now() };
  }

  add(q) { this.active.push(q); this.changed(); this.game.audio?.play('quest'); this.game.ui.toast(`Nouvelle quête : <b>${escapeHtml(q.title)}</b>`); }

  mainFor(npc) {
    const def = MAIN[this.mainIdx];
    return def && def.giver === npc ? def : null;
  }

  sideFor(npc) {
    const def = SIDE[npc];
    if (!def) return null;
    if (this.active.some((q) => q.id === def.id)) return null;
    if (this.done.has(def.id) && !def.repeat) return null;
    return def;
  }

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
      case 'loot': return type === 'loot';
      case 'boss': return type === 'kill' && d.boss;
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
    if (r.xp) g.gainXp(r.xp);
    if (q.id.startsWith('m')) {
      const idx = MAIN.findIndex((m) => m.id === q.id);
      if (idx >= this.mainIdx) this.mainIdx = idx + 1;
      // la suite est proposée par le prochain donneur
      const next = MAIN[this.mainIdx];
      if (next) g.ui.toast(`${this.npcName(next.giver)} a une nouvelle tâche pour vous.`, { time: 4 });
    }
    if (q.ai) g.hero.title = g.hero.title || 'Élu de l’Oracle';
    this.changed();
    g.save?.soon(1);
  }

  npcName(id) { return this.game.npcs?.byId(id)?.name || 'le donneur'; }

  changed() { this.trackedKey = JSON.stringify(this.active.map((q) => [q.id, q.state, q.objectives.map((o) => Math.floor(o.have))])); }
  trackerKey() { return this.trackedKey; }
  tracked() {
    return this.active.slice(0, 3).map((q) => ({
      title: q.title, ai: q.ai,
      objectives: q.state === 'ready' ? [{ text: `Retourner voir ${this.npcName(q.giver)}`, done: false, count: 1, have: 0 }] : q.objectives.map((o) => ({ text: o.text, done: o.done, count: o.type === 'light' ? 1 : o.count, have: o.have })),
    }));
  }

  readyFor(npc) { return this.active.find((q) => q.state === 'ready' && q.giver === npc); }

  markers(out) {
    for (const q of this.active) {
      if (q.state === 'ready') { const n = this.game.npcs?.byId(q.giver); if (n) out.push({ x: n.spot.x, z: n.spot.z, color: '#ffe3a3', shape: 'star', edge: true, label: q.title }); continue; }
      for (const o of q.objectives) {
        if (o.done) continue;
        if (o.type === 'visit') out.push({ x: PLACES[o.place].x, z: PLACES[o.place].z, color: '#ffe3a3', shape: 'star', edge: true, label: PLACES[o.place].name });
        else if (o.type === 'light' && o.beacon && o.beacon !== 'any') { const b = BEACONS.find((x) => x.id === o.beacon); out.push({ x: b.x, z: b.z, color: '#ffe3a3', shape: 'star', edge: true }); }
        else if (o.type === 'kill' && o.zone) { const z = SPAWN_ZONES.find((s) => s.id === o.zone); if (z) out.push({ x: z.x, z: z.z, color: '#ff8a72', shape: 'star', edge: true }); }
        else if (o.type === 'boss') out.push({ x: MOUNTAIN.x, z: MOUNTAIN.z, color: '#ff8a72', shape: 'star', edge: true });
        else if (o.type === 'kill' && q.id === 'm2') { const b = BEACONS[0]; out.push({ x: b.x, z: b.z, color: '#ff8a72', shape: 'star', edge: true }); }
        else if (o.type === 'talk') { const n = this.game.npcs?.byId(o.npc); if (n) out.push({ x: n.spot.x, z: n.spot.z, color: '#ffe3a3', shape: 'star', edge: true }); }
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
        ...q.objectives.map((o) => h('div', { class: 'qo' + (o.done ? ' done' : '') }, '◆ ' + o.text + (o.count > 1 && o.type !== 'light' ? ` (${Math.floor(o.have)}/${o.count})` : o.type === 'light' ? ` (${o.have.toFixed(1)}/${o.count} %)` : ''))),
        h('div', { class: 'istats', style: { marginTop: '6px' } }, `Récompense : ${q.rewards?.xp || 0} xp · ${q.rewards?.gold || 0} or${q.rewards?.item !== undefined ? ' · un objet' : ''}`),
        q.state === 'ready' ? h('div', { class: 'istats', style: { color: 'var(--good)' } }, `Prêt à rendre à ${this.npcName(q.giver)}.`) : null,
      ));
    }
    const doneN = this.done.size;
    return win.frame('Journal de quêtes', list, h('div', { class: 'istats', style: { marginTop: '10px' } }, `${doneN} quête${doneN > 1 ? 's' : ''} accomplie${doneN > 1 ? 's' : ''}.`));
  }
}

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
