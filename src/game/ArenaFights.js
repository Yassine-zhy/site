import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { ARENAS, arenaAt } from '../world/ArenaDefs.js';
import { BOSS_KITS } from './Boss.js';

// Combats d'arène : arrivée mise en scène (bandes noires, caméra qui tourne autour du seigneur,
// grand titre), barrière de brume qui se referme derrière le héros, seconde phase à mi-vie
// (le seigneur entre en fureur), victoire au ralenti avec fanfare et chrono du combat.
// Tout est local à chaque joueur : l'hôte décide seulement de l'apparition et de l'IA du boss.

const INTRO = 3.8;       // durée de la cinématique d'arrivée
const REPLAY = 6 * 60;   // on ne rejoue pas l'arrivée avant 6 minutes pour la même arène
const ESCAPE = 1.3;      // secondes à maintenir l'interaction pour traverser la brume

export class ArenaFights {
  constructor(game) {
    this.game = game;
    this.cur = null;
    this.lastIntro = new Map();
    this.escapeT = 0;
    this.cine = null;
    const ui = game.ui.root;
    this.bars = h('div', { class: 'cine-bars' }, h('div', { class: 'cb-top' }), h('div', { class: 'cb-bot' }));
    this.card = h('div', { class: 'arena-card' });
    this.bars.hidden = true; this.card.hidden = true;
    ui.append(this.bars, this.card);
  }

  get introActive() { return !!this.cine; }

  bossOf(A) {
    for (const e of this.game.enemies.map.values()) if (e.def.boss && e.def.bossId === A.boss && e.alive) return e;
    return null;
  }

  // ------------------------------------------------------------------ cinématique d'arrivée
  showCard(title, sub, extra = '', cls = '') {
    const c = this.card;
    c.className = 'arena-card ' + cls;
    c.innerHTML = '';
    c.append(h('div', { class: 'ac-sub' }, sub), h('div', { class: 'ac-title' }, title), h('div', { class: 'ac-line' }));
    if (extra) c.append(h('div', { class: 'ac-extra' }, extra));
    c.hidden = false;
    c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
  }
  hideCard() { this.card.classList.remove('show'); setTimeout(() => { if (!this.card.classList.contains('show')) this.card.hidden = true; }, 700); }

  startIntro(A, boss) {
    const g = this.game, kit = BOSS_KITS[A.boss] || BOSS_KITS.roi;
    this.lastIntro.set(A.id, g.elapsed);
    this.cine = { A, boss, t: 0, yaw0: Math.atan2(g.player.position.x - A.x, g.player.position.z - A.z) };
    this.bars.hidden = false; this.bars.classList.remove('off'); void this.bars.offsetWidth; this.bars.classList.add('on');
    g.ui.root.classList.add('cine-on');
    g.player.invulnerableT = Math.max(g.player.invulnerableT || 0, INTRO + 1.2);
    g.audio?.play('bossIntro', null);
    g.vibrate?.(120);
    g.schedule(0.7, () => this.showCard(kit.name, A.epithet, A.name, 'boss'));
    g.schedule(INTRO - 0.6, () => this.hideCard());
  }

  endIntro() {
    const g = this.game;
    this.cine = null;
    g.rig.cinematic = null;
    this.bars.classList.remove('on'); this.bars.classList.add('off');
    g.ui.root.classList.remove('cine-on');
    setTimeout(() => { if (!this.cine) this.bars.hidden = true; }, 600);
    // la caméra reprend derrière le héros, tournée vers le seigneur
    const p = g.player.position, b = this.cur?.boss?.position;
    if (b) g.rig.yaw = Math.atan2(p.x - b.x, p.z - b.z);
    g.rig.initialized = false;
  }

  updateIntro(dt) {
    const g = this.game, c = this.cine;
    c.t += dt;
    const b = c.boss?.alive ? c.boss.position : new THREE.Vector3(c.A.x, c.A.floor, c.A.z);
    const k = Math.min(1, c.t / INTRO), e = k * k * (3 - 2 * k);
    // travelling : de derrière le héros vers une contre-plongée face au seigneur
    const yaw = c.yaw0 + 0.9 - e * 1.5, dist = 17 - e * 7, hgt = 7 - e * 4.2;
    g.rig.cinematic = {
      pos: new THREE.Vector3(b.x + Math.sin(yaw) * dist, b.y + hgt, b.z + Math.cos(yaw) * dist),
      look: new THREE.Vector3(b.x, b.y + 2.6 + e * 1.4, b.z),
      fov: 52 - e * 8,
    };
    if (c.t >= INTRO || g.player.dead) this.endIntro();
  }

  // ------------------------------------------------------------------ boucle
  update(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    if (this.cine) this.updateIntro(dt);
    const pos = p.position;
    const A = this.cur?.A || arenaAt(pos.x, pos.z, 1);
    const inside = A && Math.hypot(pos.x - A.x, pos.z - A.z) < A.r + 1 && pos.y > A.floor - 6 && pos.y < A.floor + 30;
    const boss = A ? this.bossOf(A) : null;
    // début de rencontre : le héros est dans l'arène et le seigneur est là
    if (!this.cur && inside && boss && !p.dead) {
      this.cur = { A, boss, t0: g.elapsed, rage: false, escapeUntil: 0 };
      const last = this.lastIntro.get(A.id);
      if (last === undefined || g.elapsed - last > REPLAY) this.startIntro(A, boss);
      else { const kit = BOSS_KITS[A.boss]; this.showCard(kit?.name || '', A.name, '', 'boss short'); g.schedule(2.2, () => this.hideCard()); }
      g.audio?.play('gateClose', pos);
    }
    const cur = this.cur;
    if (!cur) return;
    const arenas = g.world.arenas;
    const d = Math.hypot(pos.x - cur.A.x, pos.z - cur.A.z);
    const alive = cur.boss.alive && g.enemies.map.has(cur.boss.id);
    // victoire
    if (!cur.boss.alive) { this.victory(cur); return; }
    if (!alive) { this.leave(); return; } // seigneur retiré sans être vaincu (changement d'hôte…)
    // le héros est parti (mort, téléporté, sorti par la brume)
    if (p.dead || d > cur.A.r + 14 || pos.y < cur.A.floor - 10) { this.leave(); return; }
    // seconde phase : fureur à mi-vie
    if (!cur.rage && cur.boss.hpPct < 0.5) {
      cur.rage = true;
      const kit = BOSS_KITS[cur.A.boss];
      g.ui.announce(`${kit?.name || 'Le seigneur'} entre en fureur !`, 'Ses coups redoublent : restez mobiles', 3);
      g.audio?.play('bossRage', cur.boss.position);
      g.shakeAt(cur.boss.position, 1);
      g.fx.shockwave(cur.boss.position, cur.A.theme.glow, cur.A.r * 0.8);
      if (g.enemies.isHost) cur.boss.enraged = true;
    }
    // barrière : le héros ne sort qu'en traversant volontairement la brume (même un bond ou
    // une téléportation le ramènent à l'intérieur)
    const sealed = cur.wasIn !== false && g.elapsed > cur.escapeUntil;
    arenas?.setState(cur.A.id, { fight: true, rage: cur.rage, seal: true, win: false });
    if (sealed && d > cur.A.r + 0.9) {
      const k = (cur.A.r + 0.9) / d;
      pos.x = cur.A.x + (pos.x - cur.A.x) * k; pos.z = cur.A.z + (pos.z - cur.A.z) * k;
      if (p.dodge) p.dodge = null;
      if (Math.random() < dt * 20) g.fx.sparkle(pos.clone().setY(pos.y + 1.2), cur.A.theme.glow, 0.8, 1, 0.3);
    }
    cur.wasIn = Math.hypot(pos.x - cur.A.x, pos.z - cur.A.z) < cur.A.r + 1.2;
    // traverser la brume : maintenir l'interaction contre la barrière
    const atWall = d > cur.A.r - 0.2;
    this.wallPrompt = atWall && sealed ? `Maintenir ${g.input.isTouch ? '✋' : 'E'} : traverser la brume` : '';
    if (atWall && sealed && g.input.is('interact')) {
      this.escapeT += dt;
      if (this.escapeT >= ESCAPE) { cur.escapeUntil = g.elapsed + 4; this.escapeT = 0; g.ui.toast('Vous traversez la brume…', { time: 1.5 }); g.audio?.play('blink', pos); }
    } else this.escapeT = Math.max(0, this.escapeT - dt * 2);
  }

  leave() {
    const g = this.game, cur = this.cur;
    this.cur = null; this.wallPrompt = ''; this.escapeT = 0;
    if (this.cine) this.endIntro();
    g.world.arenas?.setState(cur.A.id, { fight: false, rage: false, seal: false, win: false });
    if (cur.boss) cur.boss.enraged = false;
  }

  victory(cur) {
    const g = this.game, kit = BOSS_KITS[cur.A.boss];
    this.cur = null; this.wallPrompt = '';
    if (this.cine) this.endIntro();
    const secs = Math.max(1, Math.round(g.elapsed - cur.t0));
    const time = `${Math.floor(secs / 60)} min ${String(secs % 60).padStart(2, '0')} s`;
    const arenas = g.world.arenas;
    arenas?.setState(cur.A.id, { fight: false, rage: false, seal: false, win: true });
    g.slowMo?.(1.6, 0.3);
    g.audio?.play('victory', null);
    g.vibrate?.([60, 40, 120]);
    g.schedule(0.9, () => this.showCard('Victoire', `${kit?.name || 'Le seigneur'} est tombé`, `${cur.A.name} · combat de ${time}`, 'win'));
    g.schedule(5.5, () => this.hideCard());
    g.schedule(8, () => arenas?.setState(cur.A.id, { win: false }));
    // record personnel
    const best = g.hero.bossBest || (g.hero.bossBest = {});
    if (!best[cur.A.boss] || secs < best[cur.A.boss]) { best[cur.A.boss] = secs; if (Object.keys(best).length) g.schedule(2.5, () => g.ui.toast(`Nouveau record contre ${kit?.name || 'ce seigneur'} : <b>${time}</b>`, { time: 4 })); }
  }

  // marqueurs de carte : les arènes et leur seigneur
  static list() { return ARENAS; }
}
