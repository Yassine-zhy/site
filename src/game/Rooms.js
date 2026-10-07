import { h } from '../ui/dom.js';
import { ROOMS, roomAt, roomSpawn, roomExit, roomOrigin } from '../world/Interiors.js';
import { SPAWN_ZONES, ENEMIES } from '../config.js';
import { RARITY } from './Items.js';
import { ZONE_NAMES } from './Quests.js';
import { mulberry32 } from '../engine/math.js';

// Les intérieurs en jeu : portes des bâtiments, entrée et sortie (fondu), et ce qu'on y fait :
// s'asseoir (régénération), forger (amélioration du matériel), contrats de la guilde et rangs,
// prière à la chapelle (bénédiction), repos dans un lit, enchantement à la tour de l'archimage,
// repas de la taverne.

const ROOM_OF = { building_tavern: 'tavern', building_blacksmith: 'forge', building_castle: 'guild', building_church: 'chapel', building_home_A: 'home', building_home_B: 'home' };
const LABEL = { tavern: 'la taverne', forge: 'la forge', guild: 'la guilde des aventuriers', chapel: 'la chapelle', home: 'la maison', tower: 'la tour de l’archimage' };

export const GUILD_RANKS = [
  { rep: 0, name: 'Novice', color: '#c9c2b0' }, { rep: 60, name: 'Bronze', color: '#d8925a' }, { rep: 180, name: 'Argent', color: '#d6dde8' },
  { rep: 400, name: 'Or', color: '#f2c46d' }, { rep: 800, name: 'Platine', color: '#9fe8ff' }, { rep: 1500, name: 'Légende', color: '#ff9af0' },
];
export function guildRank(rep) { let r = GUILD_RANKS[0]; for (const k of GUILD_RANKS) if (rep >= k.rep) r = k; return r; }

export const MEALS = [
  { id: 'meal_stew', name: 'Ragoût du chasseur', price: 25, minutes: 20, stats: { 'hp%': 15 }, desc: '+15 % de vie maximale' },
  { id: 'meal_pie', name: 'Tourte aux champignons des bois', price: 30, minutes: 20, stats: { regen: 3, 'def%': 5 }, desc: '+3 régénération, +5 % défense' },
  { id: 'meal_mead', name: 'Hydromel d’Aetheria', price: 40, minutes: 15, stats: { 'atk%': 6 }, extra: { xpBonus: 0.1 }, desc: '+10 % d’expérience, +6 % attaque' },
];

export class Rooms {
  constructor(game) {
    this.game = game;
    this.doors = [];
    for (const b of game.scene.userData.buildings || []) {
      const room = b.room || ROOM_OF[b.name];
      if (!room || !ROOMS[room]) continue;
      // la porte est sur la face avant du modèle (tournée vers la place)
      const fx = Math.sin(b.rot), fz = Math.cos(b.rot), d = b.front + 1.1;
      const x = b.x + fx * d, z = b.z + fz * d;
      const y = game.world.terrain.heightAt(x, z);
      this.doors.push({ room, x, y, z, facing: b.rot, where: b.where, out: { x: b.x + fx * (d + 1.6), z: b.z + fz * (d + 1.6) } });
    }
    this.inside = null; // { room, door }
    this.seated = null;
    this.spots = game.world.interiors?.spots || {};
    this.contractT = 0;
  }

  current() { const p = this.game.player.position; return roomAt(p.x, p.z); }

  // porte d'Havrelumière menant à cette salle (sortie par défaut)
  homeDoor(room) { return this.doors.find((d) => d.room === room && d.where === 'Havrelumière') || this.doors.find((d) => d.room === room); }

  target(pos) {
    const room = roomAt(pos.x, pos.z);
    if (room) {
      const ex = roomExit(room);
      if (Math.hypot(pos.x - ex.x, pos.z - ex.z) < 2.6) return { kind: 'room', act: 'exit', room, text: 'Sortir' };
      let best = null, bd = 2.1;
      for (const s of this.spots[room] || []) {
        const d = Math.hypot(pos.x - s.x, pos.z - s.z);
        if (d < bd) { bd = d; best = s; }
      }
      if (best && !(this.seated && best.kind === 'sit')) return { kind: 'room', act: best.kind, spot: best, room, text: best.label };
      return null;
    }
    let best = null, bd = 3.4;
    for (const d of this.doors) {
      const dd = Math.hypot(pos.x - d.x, pos.z - d.z);
      if (dd < bd && Math.abs(pos.y - d.y) < 3) { bd = dd; best = d; }
    }
    return best ? { kind: 'room', act: 'enter', door: best, text: `Entrer · ${ROOMS[best.room].name.replace(/^(Taverne du Cœur Doré)$/, 'Taverne')}` } : null;
  }

  use(t) {
    const g = this.game;
    switch (t.act) {
      case 'enter': return this.enter(t.door);
      case 'exit': return this.exit();
      case 'sit': return this.sit(t.spot);
      case 'anvil': return this.forgeWindow();
      case 'board': return this.guildWindow();
      case 'altar': return g.interactions.startTask({ dur: 2.2, label: 'Prière', anim: 'Spellcasting', onDone: () => this.bless() });
      case 'bed': return this.rest(t.spot);
      case 'orb': return this.enchantWindow();
      default: return null;
    }
  }

  // ------------------------------------------------------------- entrer / sortir
  enter(door) {
    const g = this.game, p = g.player;
    if (p.mounted) g.mount?.dismount();
    g.ui.fade(0.35);
    g.audio?.play('unlock', p.position);
    g.schedule(0.3, () => {
      const sp = roomSpawn(door.room);
      p.spawn(sp.x, 0.2, sp.z, sp.facing);
      p.gliding = false;
      g.rig.yaw = sp.facing + Math.PI; g.rig.pitch = 0.28; g.rig.initialized = false;
      this.savedDist = g.rig.targetDistance;
      g.rig.targetDistance = Math.min(g.rig.targetDistance, 6.5); g.rig.maxDist = 7.5;
      this.inside = { room: door.room, door };
      g.ui.announce(ROOMS[door.room].name, door.where || '', 2.4);
      g.quests?.onEvent('visit', { room: door.room });
    });
  }

  exit() {
    const g = this.game, p = g.player;
    const room = this.current();
    const door = this.inside?.door || this.homeDoor(room);
    this.standUp();
    g.ui.fade(0.35);
    g.audio?.play('unlock', p.position);
    g.schedule(0.3, () => {
      if (door) {
        const y = g.world.terrain.heightAt(door.out.x, door.out.z);
        p.spawn(door.out.x, y + 0.2, door.out.z, door.facing);
        g.rig.yaw = door.facing + Math.PI; g.rig.initialized = false;
      }
      g.rig.maxDist = 22; if (this.savedDist) g.rig.targetDistance = this.savedDist;
      this.inside = null;
    });
  }

  // ------------------------------------------------------------- s'asseoir, se reposer, prier
  sit(spot) {
    const g = this.game, p = g.player;
    p.position.set(spot.x, p.position.y, spot.z);
    p.velocity.set(0, 0, 0);
    p.facing = spot.facing + Math.PI; p.object.rotation.y = p.facing;
    p.char.playLoop('Sit_Chair_Idle', { full: true });
    p.rooted = 1e9;
    this.seated = spot;
    g.ui.toast('Vous vous asseyez : vie et éther se régénèrent cinq fois plus vite. Bougez pour vous relever.', { time: 3 });
  }

  standUp() {
    if (!this.seated) return;
    const p = this.game.player;
    this.seated = null; p.rooted = 0; p.char.stopAction();
  }

  rest(spot) {
    const g = this.game, hero = g.hero;
    g.interactions.startTask({ dur: 2.5, label: 'Repos', anim: 'Lie_Idle', onDone: () => {
      hero.hp = hero.stats.hp; hero.mp = hero.stats.mp;
      hero.addBuff('rested', 600, {}, { xpBonus: 0.1, icon: 'heal', label: 'Bien reposé (+10 % d’expérience)' });
      g.ui.toast('Vous voilà reposé : vie et éther au maximum, +10 % d’expérience pendant 10 minutes.', { time: 4, color: '#9cf0b0' });
      g.audio?.play('heal');
      void spot;
    } });
  }

  bless() {
    const g = this.game, hero = g.hero;
    const now = Date.now();
    if (now - (hero.blessedAt || 0) < 8 * 60 * 1000) { g.ui.toast(`La lumière vous enveloppe encore. Revenez prier dans ${Math.ceil((8 * 60 * 1000 - (now - hero.blessedAt)) / 60000)} min.`); return; }
    hero.blessedAt = now;
    hero.addBuff('blessing', 900, { 'def%': 10, regen: 2 }, { icon: 'sun', label: 'Bénédiction de l’Aube' });
    g.fx.beam(g.player.position, '#ffe7a0', { height: 10, radius: 1.6, life: 1.4 });
    g.fx.aura(g.player, '#ffe7a0', { duration: 1.5, rate: 50 });
    g.audio?.play('holy', g.player.position);
    g.ui.toast('<b>Bénédiction de l’Aube</b> : +10 % de défense et +2 de régénération pendant 15 minutes.', { time: 4, color: '#ffe3a3' });
  }

  eat(meal) {
    const g = this.game, hero = g.hero;
    if (hero.gold < meal.price) return false;
    hero.gold -= meal.price;
    hero.addBuff(meal.id, meal.minutes * 60, meal.stats, { ...(meal.extra || {}), icon: 'potion', label: meal.name });
    hero.hp = Math.min(hero.stats.hp, hero.hp + hero.stats.hp * 0.25);
    g.audio?.play('potion'); g.audio?.play('coin');
    g.save?.soon();
    return true;
  }

  // ------------------------------------------------------------- forge : améliorer le matériel
  upgradeCost(it) { return Math.round((30 + this.game.hero.level * 12) * (1 + (it.upg || 0) * 0.55) * (1 + it.rarity * 0.25)); }
  upgrade(it) {
    const g = this.game, hero = g.hero, cost = this.upgradeCost(it);
    if ((it.upg || 0) >= 10 || hero.gold < cost) return false;
    hero.gold -= cost;
    it.upg = (it.upg || 0) + 1;
    for (const k of Object.keys(it.stats)) if (k !== 'leech') it.stats[k] = Math.round(it.stats[k] * 1.08 + (k === 'atk' || k === 'def' ? 1 : 0));
    it.name = it.name.replace(/ \+\d+$/, '') + ' +' + it.upg;
    hero.recompute();
    g.save?.soon();
    return true;
  }

  forgeWindow() {
    const g = this.game, hero = g.hero, win = g.windows;
    const smith = g.npcs?.byId('smith');
    smith?.char.playAction('2H_Melee_Attack_Chop', { timeScale: 1.2 });
    const rows = ['weapon', 'armor', 'relic'].map((slot) => {
      const it = hero.equip[slot];
      if (!it) return h('div', { class: 'forge-row empty' }, h('div', { class: 'nm' }, { weapon: 'Arme', armor: 'Armure', relic: 'Relique' }[slot] + ' : rien d’équipé'));
      const cost = this.upgradeCost(it), max = (it.upg || 0) >= 10;
      const stats = Object.entries(it.stats).map(([k, v]) => `${k} ${v}`).join(' · ');
      return h('div', { class: 'forge-row' },
        h('div', { class: 'nm', style: { color: RARITY[it.rarity].color } }, it.name),
        h('div', { class: 'st' }, stats + (max ? '' : '  →  +8 %')),
        h('button', { class: 'btn small', disabled: max || hero.gold < cost ? true : null, onclick: () => {
          if (!this.upgrade(it)) return;
          g.audio?.play('block'); g.audio?.play('coin');
          const p = g.world.interiors?.rooms?.forge;
          if (p) g.fx.burst({ x: p.o.x + 1, y: 1.6, z: p.o.z }, '#ffb347', { count: 40, speed: 7, size: 0.3, life: 0.7, gravity: 9 });
          smith?.char.playAction('2H_Melee_Attack_Chop', { timeScale: 1.4 });
          this.forgeWindow();
        } }, max ? 'Maximum (+10)' : `Améliorer (+${(it.upg || 0) + 1}) · ${cost} or`));
    });
    win.custom('Forge de Brom', h('div', { class: 'forge' },
      h('p', { class: 'forge-intro' }, `« Pose ça sur l’enclume. Chaque passage au feu renforce l’objet de 8 %, jusqu’à +10. » — Vous avez ${hero.gold} or.`), ...rows));
  }

  // ------------------------------------------------------------- tour : enchanter
  enchantCost(it) { return Math.round(60 + this.game.hero.level * 14 + it.rarity * 40); }
  enchant(it) {
    const g = this.game, hero = g.hero, cost = this.enchantCost(it);
    if (hero.gold < cost) return null;
    hero.gold -= cost;
    const rng = mulberry32(Date.now() & 0xffffffff);
    const pool = ['crit', 'haste', 'regen', 'rune', 'hp'];
    const main = { weapon: 'atk', armor: 'def', relic: 'mp' }[it.slot];
    const sec = Object.keys(it.stats).filter((k) => k !== main && k !== 'leech');
    const lv = it.level;
    const roll = { crit: () => Math.round(2 + lv * 0.3 + rng() * 4), haste: () => Math.round(3 + lv * 0.25 + rng() * 4), regen: () => Math.round(1 + lv * 0.15 + rng() * 2), rune: () => Math.round(3 + lv * 0.5 + rng() * 5), hp: () => Math.round(10 + lv * 6 * (0.6 + rng() * 0.8)) };
    let key;
    if (sec.length && rng() < 0.6) key = sec[Math.floor(rng() * sec.length)];
    else { const free = pool.filter((k) => !(k in it.stats)); key = (free.length ? free : pool)[Math.floor(rng() * (free.length || pool.length))]; }
    const before = it.stats[key] || 0;
    it.stats[key] = Math.max(before, roll[key]() + Math.round(before * 0.25));
    hero.recompute();
    g.save?.soon();
    return { key, before, after: it.stats[key] };
  }

  enchantWindow() {
    const g = this.game, hero = g.hero, win = g.windows;
    const rows = ['weapon', 'armor', 'relic'].map((slot) => {
      const it = hero.equip[slot];
      if (!it) return null;
      const cost = this.enchantCost(it);
      return h('div', { class: 'forge-row' },
        h('div', { class: 'nm', style: { color: RARITY[it.rarity].color } }, it.name),
        h('div', { class: 'st' }, Object.entries(it.stats).map(([k, v]) => `${k} ${v}`).join(' · ')),
        h('button', { class: 'btn small', disabled: hero.gold < cost ? true : null, onclick: () => {
          const r = this.enchant(it);
          if (!r) return;
          const p = g.world.interiors?.rooms?.tower;
          if (p) { g.fx.ring({ x: p.o.x, y: 0.2, z: p.o.z + 1 }, '#9fb8ff', { to: 4, life: 0.7 }); g.fx.burst({ x: p.o.x, y: 2.3, z: p.o.z + 1 }, '#c8b8ff', { count: 40, speed: 5, size: 0.35, life: 0.8, gravity: -1 }); }
          g.audio?.play('runeok');
          g.ui.toast(`Enchantement : <b>${r.key}</b> ${r.before} → ${r.after}`, { time: 3, color: '#c8b8ff' });
          this.enchantWindow();
        } }, `Enchanter · ${cost} or`));
    }).filter(Boolean);
    win.custom('Orbe d’enchantement', h('div', { class: 'forge' },
      h('p', { class: 'forge-intro' }, `L’orbe renforce une propriété secondaire de l’objet, ou lui en ajoute une nouvelle (critique, hâte, régénération, runes, vie). Vous avez ${hero.gold} or.`), ...rows));
  }

  // ------------------------------------------------------------- guilde des aventuriers
  guild() {
    const hero = this.game.hero;
    if (!hero.guild) hero.guild = { rep: 0, done: 0, contracts: [] };
    const G = hero.guild;
    if (!G.contracts.length) this.newContracts();
    return G;
  }

  newContracts() {
    const hero = this.game.hero, G = hero.guild;
    const L = hero.level;
    const rng = mulberry32((Date.now() / 1000) | 0);
    let zones = SPAWN_ZONES.filter((z) => z.level[0] <= L + 3 && z.level[1] >= L - 4);
    if (!zones.length) zones = SPAWN_ZONES.slice(0, 4);
    const out = [];
    for (let i = 0; i < 3; i++) {
      const z = zones[Math.floor(rng() * zones.length)];
      const type = z.types[Math.floor(rng() * z.types.length)];
      const count = 6 + Math.floor(rng() * 7) + i * 2;
      const lv = (z.level[0] + z.level[1]) / 2;
      out.push({ id: 'c' + Date.now() + i, type, zone: z.id, count, prog: 0, xp: Math.round(count * (20 + lv * 9) * (1 + i * 0.2)), gold: Math.round(count * (4 + lv * 1.6)), rep: 10 + i * 6 + Math.floor(rng() * 6) });
    }
    G.contracts = out;
  }

  // appelé à chaque monstre vaincu par le héros
  onKill(k) {
    const G = this.game.hero.guild;
    if (!G?.contracts?.length) return;
    for (const c of G.contracts) {
      if (c.prog >= c.count || c.type !== k.type) continue;
      const z = SPAWN_ZONES.find((s) => s.id === c.zone);
      if (z && Math.hypot(k.x - z.x, k.z - z.z) > z.radius * 1.6) continue;
      c.prog++;
      const name = ENEMIES[c.type]?.plural || ENEMIES[c.type]?.name || c.type;
      this.game.ui.toast(c.prog >= c.count ? `Contrat rempli : <b>${name}</b> — retournez au tableau de la guilde.` : `Contrat · ${name} ${c.prog}/${c.count}`, { time: c.prog >= c.count ? 4 : 1.6, color: c.prog >= c.count ? '#ffe3a3' : undefined });
    }
  }

  guildWindow() {
    const g = this.game, hero = g.hero, win = g.windows, G = this.guild();
    const rank = guildRank(G.rep), next = GUILD_RANKS.find((r) => r.rep > G.rep);
    const mult = 1 + GUILD_RANKS.indexOf(rank) * 0.1;
    const zoneName = (id) => ZONE_NAMES[id] || id;
    const rows = G.contracts.map((c) => {
      const E = ENEMIES[c.type], done = c.prog >= c.count;
      return h('div', { class: 'contract' + (done ? ' done' : '') },
        h('div', { class: 'nm' }, `Abattre ${c.count} ${(E?.plural || E?.name || c.type).toLowerCase()}`),
        h('div', { class: 'st' }, `${zoneName(c.zone)} · ${c.prog}/${c.count}`),
        h('div', { class: 'rw' }, `${Math.round(c.xp * mult)} xp · ${Math.round(c.gold * mult)} or · ${c.rep} réputation`),
        done ? h('button', { class: 'btn small', onclick: () => {
          hero.gold += Math.round(c.gold * mult); g.gainXp(Math.round(c.xp * mult));
          const before = guildRank(G.rep);
          G.rep += c.rep; G.done++;
          G.contracts = G.contracts.filter((x) => x !== c);
          const after = guildRank(G.rep);
          g.audio?.play('quest'); g.audio?.play('coin');
          if (after !== before) { g.ui.announce('Guilde des Aventuriers', `Nouveau rang : ${after.name}`, 3.5); hero.title = hero.title || ''; }
          if (!G.contracts.length) this.newContracts();
          g.save?.soon();
          this.guildWindow();
        } }, 'Recevoir la prime') : h('button', { class: 'btn small ghost', onclick: () => {
          if (hero.gold < 15) { g.ui.toast('Il faut 15 or pour changer de contrat.'); return; }
          hero.gold -= 15;
          const keep = G.contracts.filter((x) => x !== c);
          this.newContracts();
          G.contracts = [...keep, G.contracts[0]];
          this.guildWindow();
        } }, 'Changer (15 or)'));
    });
    const pct = next ? Math.round((G.rep - rank.rep) / (next.rep - rank.rep) * 100) : 100;
    win.custom('Guilde des Aventuriers', h('div', { class: 'forge' },
      h('div', { class: 'guild-rank' }, h('b', { style: { color: rank.color } }, `Rang ${rank.name}`), ` · ${G.rep} réputation · ${G.done} contrats remplis`,
        h('div', { class: 'gbar' }, h('div', { style: { width: pct + '%', background: rank.color } })),
        h('small', {}, next ? `Prochain rang : ${next.name} (${next.rep}). Chaque rang augmente les primes de 10 %.` : 'Vous êtes une légende de la guilde.')),
      ...rows));
  }

  update(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    // assis : régénération accélérée, on se relève en bougeant
    if (this.seated) {
      const hero = g.hero;
      hero.hp = Math.min(hero.stats.hp, hero.hp + (hero.stats.hp * 0.03 + hero.stats.regen) * dt);
      hero.mp = Math.min(hero.stats.mp, hero.mp + hero.stats.mp * 0.04 * dt);
      const mv = g.input.moveVector();
      if (Math.hypot(mv.x, mv.y) > 0.2 || g.input.pressed('jump') || p.dead) this.standUp();
    }
    // sortie de secours : un héros perdu hors des salles revient à la porte
    if (!this.inside) { const r = roomAt(p.position.x, p.position.z); if (r) this.inside = { room: r, door: this.homeDoor(r) }; }
    else if (!roomAt(p.position.x, p.position.z) && p.position.x < 8000) { this.inside = null; g.rig.maxDist = 22; }
  }

  // position « monde » d'un habitant d'intérieur (pour la balise et la carte) : la porte
  anchorFor(roomId) { return this.homeDoor(roomId); }
}

export { LABEL, roomOrigin };
