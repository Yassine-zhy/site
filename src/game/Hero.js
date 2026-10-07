import { CLASSES, xpForLevel, MAX_LEVEL } from '../config.js';
import { ABILITIES } from './Abilities.js';

export const BAR_SLOTS = 6;
import { generateItem, potion, itemPower, levelFactor } from './Items.js';

// Données persistantes du héros : niveau, statistiques, inventaire, équipement.
export class Hero {
  constructor(classId, name) {
    this.classId = classId;
    this.name = name;
    this.level = 1;
    this.xp = 0;
    this.gold = 25;
    this.inventory = [];
    this.equip = { weapon: null, armor: null, relic: null };
    this.potions = { hp: 3, mp: 2 };
    this.chests = {}; // coffres non ouverts, par type
    this.buffs = [];
    this.kills = 0;
    this.deaths = 0;
    this.light = 0; // lumière offerte aux phares
    this.runesCast = 0;
    this.bestRune = 0;
    this.title = '';
    this.discovered = {};
    this.created = Date.now();
    this.playTime = 0;
    this.bar = null; // compétences placées dans la barre (6 emplacements), voir fillBar()
    // équipement de départ
    this.equip.weapon = generateItem(classId, 1, { rarity: 0, slot: 'weapon' });
    this.recompute();
    this.hp = this.stats.hp; this.mp = this.stats.mp;
    this.fillBar();
  }

  get cls() { return CLASSES[this.classId]; }

  // compétences débloquées à ce niveau
  unlocked() { return this.cls.abilities.filter((id) => ABILITIES[id] && ABILITIES[id].level <= this.level); }

  // range les compétences débloquées dans les emplacements libres ; renvoie celles ajoutées
  fillBar() {
    if (!Array.isArray(this.bar)) this.bar = [];
    while (this.bar.length < BAR_SLOTS) this.bar.push(null);
    const ids = new Set(this.cls.abilities);
    this.bar = this.bar.slice(0, BAR_SLOTS).map((id) => (id && ids.has(id) && ABILITIES[id].level <= this.level ? id : null));
    const added = [];
    for (const id of this.unlocked()) {
      if (this.bar.includes(id)) continue;
      const free = this.bar.indexOf(null);
      if (free < 0) break;
      this.bar[free] = id; added.push(id);
    }
    return added;
  }

  recompute() {
    const c = this.cls, L = this.level - 1;
    const s = {
      hp: Math.round(c.base.hp + c.perLevel.hp * L),
      mp: Math.round(c.base.mp + c.perLevel.mp * L),
      atk: c.base.atk + c.perLevel.atk * L,
      def: c.base.def + c.perLevel.def * L,
      crit: 6, haste: 0, regen: 1 + L * 0.15, rune: 0,
    };
    for (const it of Object.values(this.equip)) {
      if (!it) continue;
      // un objet de niveau supérieur ne donne que la puissance de votre niveau (le vol de vie reste)
      const f = levelFactor(it.level, this.level);
      for (const [k, v] of Object.entries(it.stats)) s[k] = (s[k] || 0) + (k === 'leech' ? v : v * f);
    }
    // buffs temporaires
    for (const b of this.buffs) if (b.stats) for (const [k, v] of Object.entries(b.stats)) {
      if (k.endsWith('%')) s[k.slice(0, -1)] *= 1 + v / 100; else s[k] = (s[k] || 0) + v;
    }
    s.atk = Math.round(s.atk); s.def = Math.round(s.def);
    for (const k of ['hp', 'mp', 'crit', 'haste', 'regen', 'rune']) s[k] = Math.round(s[k] * 10) / 10;
    s.hp = Math.round(s.hp); s.mp = Math.round(s.mp);
    this.stats = s;
    if (this.hp !== undefined) { this.hp = Math.min(this.hp, s.hp); this.mp = Math.min(this.mp, s.mp); }
    return s;
  }

  get xpNeeded() { return xpForLevel(this.level); }

  // renvoie le nombre de niveaux gagnés
  addXp(n) {
    if (this.level >= MAX_LEVEL) return 0;
    this.xp += Math.round(n);
    let gained = 0;
    while (this.xp >= this.xpNeeded && this.level < MAX_LEVEL) {
      this.xp -= this.xpNeeded;
      this.level++;
      gained++;
    }
    if (gained) { this.recompute(); this.hp = this.stats.hp; this.mp = this.stats.mp; }
    return gained;
  }

  addBuff(id, duration, stats, extra = {}) {
    this.buffs = this.buffs.filter((b) => b.id !== id);
    this.buffs.push({ id, t: duration, max: duration, stats, ...extra });
    this.recompute();
  }

  hasBuff(id) { return this.buffs.find((b) => b.id === id); }

  updateBuffs(dt) {
    let changed = false;
    for (const b of this.buffs) b.t -= dt;
    const before = this.buffs.length;
    this.buffs = this.buffs.filter((b) => b.t > 0);
    if (this.buffs.length !== before) changed = true;
    if (changed) this.recompute();
  }

  addItem(it) {
    if (it.kind === 'potion') { this.potions[it.type] = (this.potions[it.type] || 0) + (it.count || 1); return true; }
    if (it.kind === 'chest') { this.chests[it.tier] = (this.chests[it.tier] || 0) + (it.count || 1); return true; }
    if (this.inventory.length >= 30) return false;
    this.inventory.push(it);
    return true;
  }

  equipItem(id) {
    const i = this.inventory.findIndex((x) => x.id === id);
    if (i < 0) return null;
    const it = this.inventory[i];
    if (it.kind !== 'gear') return null;
    const prev = this.equip[it.slot];
    this.equip[it.slot] = it;
    this.inventory.splice(i, 1);
    if (prev) this.inventory.push(prev);
    const hpRatio = this.hp / this.stats.hp, mpRatio = this.mp / this.stats.mp;
    this.recompute();
    this.hp = Math.round(this.stats.hp * hpRatio); this.mp = Math.round(this.stats.mp * mpRatio);
    return it;
  }

  isUpgrade(it) {
    if (!it || it.kind !== 'gear') return false;
    const cur = this.equip[it.slot];
    return itemPower(it) * levelFactor(it.level, this.level) > itemPower(cur) * levelFactor(cur?.level, this.level);
  }

  sellItem(id) {
    const i = this.inventory.findIndex((x) => x.id === id);
    if (i < 0) return 0;
    const v = Math.round(this.inventory[i].value * 0.5);
    this.inventory.splice(i, 1);
    this.gold += v;
    return v;
  }

  get gearScore() { return Math.round(Object.values(this.equip).reduce((s, it) => s + itemPower(it), 0)); }

  serialize() {
    return {
      v: 1, classId: this.classId, name: this.name, level: this.level, xp: this.xp, gold: this.gold,
      inventory: this.inventory, equip: this.equip, potions: this.potions, kills: this.kills, deaths: this.deaths,
      light: this.light, runesCast: this.runesCast, bestRune: this.bestRune, title: this.title, discovered: this.discovered,
      hp: this.hp, mp: this.mp, created: this.created, playTime: this.playTime, chests: this.chests, pity: this.pity || 0, bar: this.bar, guild: this.guild || null, blessedAt: this.blessedAt || 0,
    };
  }

  static deserialize(d) {
    const h = new Hero(d.classId, d.name);
    Object.assign(h, {
      level: d.level || 1, xp: d.xp || 0, gold: d.gold ?? 25, inventory: d.inventory || [], equip: d.equip || h.equip,
      potions: d.potions || h.potions, kills: d.kills || 0, deaths: d.deaths || 0, light: d.light || 0, runesCast: d.runesCast || 0,
      bestRune: d.bestRune || 0, title: d.title || '', discovered: d.discovered || {}, created: d.created || Date.now(), playTime: d.playTime || 0,
      chests: d.chests || {}, pity: d.pity || 0, bar: Array.isArray(d.bar) ? d.bar : null, guild: d.guild || null, blessedAt: d.blessedAt || 0,
    });
    h.buffs = [];
    h.fillBar();
    h.recompute();
    h.hp = Math.min(d.hp ?? h.stats.hp, h.stats.hp) || h.stats.hp;
    h.mp = Math.min(d.mp ?? h.stats.mp, h.stats.mp) || h.stats.mp;
    return h;
  }
}

export { potion };
