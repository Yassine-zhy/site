import { h, svgIcon, fmtTime } from './dom.js';
import { ABILITIES, ABILITY_ICONS } from '../game/Abilities.js';
import { BEACONS, CLASSES } from '../config.js';
import { MAP_RANGE, worldToMap } from './MapRender.js';

const BEACON_SVG = (pct, lit) => `
<svg viewBox="0 0 20 26"><defs><linearGradient id="bg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#f2c46d"/><stop offset="1" stop-color="#fff3c4"/></linearGradient></defs>
<path d="M10 1 16 9 10 17 4 9Z" fill="${lit ? '#ffe3a3' : 'rgba(142,124,195,0.25)'}" stroke="${lit ? '#fff3c4' : '#8e7cc3'}" stroke-width="1" ${lit ? 'filter="drop-shadow(0 0 3px #f2c46d)"' : ''}/>
<rect x="3" y="20" width="14" height="4" rx="1" fill="rgba(0,0,0,0.5)" stroke="rgba(242,196,109,0.35)" stroke-width="0.6"/>
<rect class="fillpath" x="3.5" y="20.5" width="${(13 * pct).toFixed(2)}" height="3" rx="0.8" fill="url(#bg)"/></svg>`;

// HUD en jeu.
export class Hud {
  constructor(ui, game) {
    this.ui = ui; this.game = game;
    const root = h('div', { id: 'hud' });
    this.root = root;
    // cadre joueur
    this.portrait = h('img', { alt: '' });
    this.lvl = h('div', { class: 'lvl' }, '1');
    this.nameEl = h('div', { class: 'name' });
    this.hpFill = h('div', { class: 'fill' }); this.hpGhost = h('div', { class: 'ghost' }); this.hpTxt = h('span');
    this.mpFill = h('div', { class: 'fill' }); this.mpTxt = h('span');
    this.stFill = h('div', { class: 'fill' });
    this.buffBox = h('div', { class: 'buffs' });
    root.appendChild(h('div', { class: 'pframe panel interactive', title: 'Personnage (I)', onclick: () => game.toggleWindow?.('inventory') },
      h('div', { class: 'portrait' }, this.portrait), this.lvl, this.nameEl,
      h('div', { class: 'bar hp' }, this.hpGhost, this.hpFill, this.hpTxt),
      h('div', { class: 'bar mp' }, this.mpFill, this.mpTxt),
      h('div', { class: 'bar st' }, this.stFill),
      this.buffBox));
    // phares
    this.beaconEls = BEACONS.map((b) => h('div', { class: 'bcn', title: b.name }));
    this.worldLight = h('b', {}, '0 %');
    root.appendChild(h('div', { class: 'beacons panel interactive', onclick: () => game.toggleWindow?.('map') },
      h('div', { class: 'lbl' }, 'Lumière du monde ', this.worldLight), ...this.beaconEls));
    // cible
    this.tName = h('div', { class: 'tn' }); this.tLvl = h('div', { class: 'tl' });
    this.tFill = h('div', { class: 'fill' }); this.tTxt = h('span');
    this.tframe = h('div', { class: 'tframe panel' }, this.tName, this.tLvl, h('div', { class: 'bar hp' }, this.tFill, this.tTxt));
    this.tframe.hidden = true;
    root.appendChild(this.tframe);
    this.bossName = h('div', { class: 'bn' }); this.bossFill = h('div', { class: 'fill' }); this.bossTxt = h('span');
    this.bossbar = h('div', { class: 'bossbar' }, this.bossName, h('div', { class: 'bar' }, this.bossFill, this.bossTxt));
    this.bossbar.hidden = true;
    root.appendChild(this.bossbar);
    // minicarte
    this.mmCanvas = h('canvas', { width: 392, height: 392 });
    this.zoneEl = h('div', { class: 'zone' });
    this.clockEl = h('div', { class: 'clock' });
    root.appendChild(h('div', { class: 'minimap-wrap interactive' },
      h('div', { class: 'minimap', title: 'Carte (M)', onclick: () => game.toggleWindow?.('map') }, this.mmCanvas),
      this.zoneEl, this.clockEl));
    // quêtes
    this.trackBody = h('div');
    this.tracker = h('div', { class: 'tracker panel interactive', onclick: () => game.toggleWindow?.('quests') }, h('h4', {}, 'quêtes'), this.trackBody);
    root.appendChild(this.tracker);
    // centre
    this.cross = h('div', { class: 'crosshair' });
    this.stRing = h('div', { class: 'stamina-ring' });
    this.prompt = h('div', { class: 'prompt panel' }); this.prompt.hidden = true;
    root.append(this.cross, this.stRing, this.prompt);
    // barre d'action
    this.slots = {};
    const bar = h('div', { class: 'actionbar panel ornate desktop' });
    const mk = (id, key, icon, extra = '') => {
      const cd = h('div', { class: 'cd' }), cdt = h('div', { class: 'cdt' }), cnt = h('div', { class: 'cnt' });
      const el = h('div', { class: 'slot interactive ' + extra, title: '' }, svgIcon(icon), h('div', { class: 'key' }, key), cnt, cd, cdt);
      this.slots[id] = { el, cd, cdt, cnt, cache: {} };
      return el;
    };
    bar.append(mk('attack', 'Clic', ABILITY_ICONS.attack));
    const cls = CLASSES[game.hero.classId];
    cls.abilities.forEach((a, i) => {
      const el = mk(a, String(i + 1), ABILITY_ICONS[ABILITIES[a].icon]);
      el.title = `${ABILITIES[a].name} — ${ABILITIES[a].desc} (${ABILITIES[a].mana} éther, ${ABILITIES[a].cd} s)`;
      el.dataset.lvl = 'niv. ' + ABILITIES[a].level;
      el.addEventListener('click', () => game.useAbility(i));
      bar.append(el);
    });
    bar.append(h('div', { class: 'sep' }));
    const pot = mk('potion', 'R', ABILITY_ICONS.potion); pot.title = 'Élixir de vie (R)'; pot.addEventListener('click', () => game.usePotion());
    const rune = mk('rune', 'X', ABILITY_ICONS.rune, 'rune'); rune.title = 'Tracer une rune (clic droit maintenu ou X)';
    bar.append(pot, rune);
    root.appendChild(bar);
    this.xpFill = h('div');
    root.appendChild(h('div', { class: 'xpbar', title: 'Expérience' }, this.xpFill));
    ui.root.insertBefore(root, ui.floatLayer.nextSibling);
    this.cache = {};
    this.mmT = 0;
    this.buffCache = '';
  }

  set(key, val, fn) { if (this.cache[key] !== val) { this.cache[key] = val; fn(val); } }

  update(dt) {
    const g = this.game, hero = g.hero, p = g.player;
    if (!hero || !p) return;
    const s = hero.stats;
    this.set('name', hero.name + '|' + hero.title, () => { this.nameEl.textContent = hero.name; if (hero.title) this.nameEl.appendChild(h('small', {}, hero.title)); });
    this.set('lvl', hero.level, (v) => { this.lvl.textContent = v; });
    const hpP = Math.max(0, hero.hp / s.hp);
    this.set('hp', hpP.toFixed(3), (v) => { this.hpFill.style.transform = `scaleX(${v})`; this.hpGhost.style.transform = `scaleX(${v})`; });
    this.set('hpt', `${Math.ceil(hero.hp)} / ${s.hp}`, (v) => { this.hpTxt.textContent = v; });
    this.set('mp', (hero.mp / s.mp).toFixed(3), (v) => { this.mpFill.style.transform = `scaleX(${v})`; });
    this.set('mpt', `${Math.floor(hero.mp)} / ${s.mp}`, (v) => { this.mpTxt.textContent = v; });
    this.set('st', (p.stamina / 100).toFixed(2), (v) => { this.stFill.style.transform = `scaleX(${v})`; this.stRing.style.setProperty('--p', (v * 100) + '%'); this.stRing.classList.toggle('show', v < 0.99); });
    this.set('xp', (hero.xp / hero.xpNeeded).toFixed(3), (v) => { this.xpFill.style.width = (v * 100) + '%'; });
    // buffs
    const bk = hero.buffs.map((b) => b.id + Math.ceil(b.t)).join(',');
    if (bk !== this.buffCache) {
      this.buffCache = bk;
      this.buffBox.innerHTML = '';
      for (const b of hero.buffs) {
        const ab = ABILITIES[b.id];
        const icon = ab ? ABILITY_ICONS[ab.icon] : b.icon ? ABILITY_ICONS[b.icon] : ABILITY_ICONS.sun;
        const el = h('div', { class: 'buff', title: (ab?.name || b.label || b.id) + ' — ' + fmtTime(b.t) + ' s' }, svgIcon(icon), h('div', { class: 'sweep', style: { transform: `scaleY(${1 - b.t / b.max})` } }));
        this.buffBox.appendChild(el);
      }
    }
    // barre d'action : temps de recharge
    const cls = CLASSES[hero.classId];
    const upd = (id, remain, total, opts = {}) => {
      const sl = this.slots[id];
      if (!sl) return;
      const pct = remain > 0 ? Math.round(remain / total * 100) : 0;
      if (sl.cache.p !== pct) { sl.cd.style.setProperty('--p', pct + '%'); if (sl.cache.p > 0 && pct === 0) { sl.el.classList.remove('ready'); void sl.el.offsetWidth; sl.el.classList.add('ready'); } sl.cache.p = pct; }
      const txt = remain > 0.05 && total > 1.5 ? fmtTime(remain) : '';
      if (sl.cache.t !== txt) { sl.cdt.textContent = txt; sl.cache.t = txt; }
      if (sl.cache.locked !== !!opts.locked) { sl.el.classList.toggle('locked', !!opts.locked); sl.cache.locked = !!opts.locked; }
      if (sl.cache.nomana !== !!opts.nomana) { sl.el.classList.toggle('nomana', !!opts.nomana); sl.cache.nomana = !!opts.nomana; }
      if (opts.count !== undefined && sl.cache.c !== opts.count) { sl.cnt.textContent = opts.count; sl.cache.c = opts.count; }
    };
    upd('attack', g.cooldowns.attack || 0, g.basicCd);
    cls.abilities.forEach((a) => {
      const ab = ABILITIES[a];
      upd(a, g.cooldowns[a] || 0, ab.cd * g.cdMult(), { locked: hero.level < ab.level, nomana: hero.mp < ab.mana });
    });
    upd('potion', g.cooldowns.potion || 0, 8, { count: hero.potions.hp || 0 });
    upd('rune', g.cooldowns.rune || 0, g.runeCd || 2.5);
    // cible
    const t = g.target && g.target.alive ? g.target : null;
    const boss = g.bossEngaged;
    this.set('boss', boss ? boss.id : '', () => { this.bossbar.hidden = !boss; if (boss) this.bossName.textContent = boss.def.name; });
    if (boss) {
      this.set('bossHp', boss.hpPct.toFixed(3), (v) => { this.bossFill.style.transform = `scaleX(${v})`; this.bossTxt.textContent = Math.ceil(boss.hp) + ' / ' + boss.maxHp; });
    }
    const showT = !!t && !(boss && t === boss);
    this.set('tvis', showT, (v) => { this.tframe.hidden = !v; });
    if (showT) {
      this.set('tname', t.id, () => {
        this.tName.innerHTML = '';
        if (t.elite) this.tName.appendChild(h('span', { class: 'el' }, 'Élite · '));
        this.tName.appendChild(document.createTextNode(t.def.name));
        this.tLvl.textContent = 'Niveau ' + t.level + (t.level >= hero.level + 4 ? ' · redoutable' : '');
      });
      this.set('thp', t.hpPct.toFixed(3), (v) => { this.tFill.style.transform = `scaleX(${Math.max(0, v)})`; this.tTxt.textContent = Math.max(0, Math.ceil(t.hp)) + ' / ' + t.maxHp; });
    }
    this.cross.classList.toggle('target', !!t);
    this.cross.hidden = !g.input.locked;
    // phares
    const wl = g.worldState ? g.worldState.levels : BEACONS.map(() => 0);
    const total = wl.reduce((a, b) => a + b, 0) / BEACONS.length;
    this.set('wl', Math.round(total * 100), (v) => { this.worldLight.textContent = v + ' %'; });
    wl.forEach((lv, i) => this.set('b' + i, Math.round(lv * 40), () => { this.beaconEls[i].innerHTML = BEACON_SVG(Math.min(1, lv), lv >= 0.999); this.beaconEls[i].title = `${BEACONS[i].name} — ${Math.round(lv * 100)} %`; }));
    // zone, heure, joueurs en ligne
    const zone = g.currentZone?.() || { name: 'Aetheria', sub: '' };
    this.set('zone', zone.name + zone.sub, () => { this.zoneEl.innerHTML = ''; this.zoneEl.append(zone.name, h('small', {}, zone.sub)); });
    const tod = g.world.sky.state.t;
    const hh = Math.floor(tod * 24), mm = Math.floor((tod * 24 - hh) * 60);
    const online = g.net ? g.net.peerCount() : 1;
    this.set('clock', `${hh}:${mm}:${online}`, () => {
      this.clockEl.innerHTML = '';
      this.clockEl.append(h('span', {}, (tod > 0.25 && tod < 0.76 ? 'Jour ' : 'Nuit ') + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0')),
        h('span', { class: 'on' }, h('b', {}, String(online)), online > 1 ? ' en ligne' : ' en ligne'));
    });
    // invite d'interaction
    const pr = g.promptText;
    this.set('prompt', pr || '', (v) => { this.prompt.hidden = !v; if (v) { this.prompt.innerHTML = ''; this.prompt.append(h('kbd', {}, g.input.isTouch ? '✋' : 'E'), v); } });
    // quêtes
    const qk = g.quests ? g.quests.trackerKey() : '';
    this.set('quests', qk, () => this.renderTracker());
    // minicarte (10 fps)
    this.mmT -= dt;
    if (this.mmT <= 0) { this.mmT = 0.1; this.drawMinimap(); }
  }

  renderTracker() {
    const g = this.game;
    this.trackBody.innerHTML = '';
    const list = g.quests ? g.quests.tracked() : [];
    if (!list.length) { this.trackBody.appendChild(h('div', { class: 'qo' }, 'Parlez aux habitants de Havrelumière.')); return; }
    for (const q of list.slice(0, 3)) {
      const el = h('div', { class: 'q' }, h('div', { class: 'qt' + (q.ai ? ' ai' : '') }, q.title));
      for (const o of q.objectives) {
        const row = h('div', { class: 'qo' + (o.done ? ' done' : '') + (o.obj ? ' qo-tip' : ''), title: o.obj ? 'Comment faire ?' : '' }, o.text + (o.count > 1 ? ` (${Math.min(o.have, o.count)}/${o.count})` : ''), o.obj && !o.done ? h('span', { class: 'qhelp' }, '?') : null);
        if (o.obj) row.addEventListener('click', (e) => { e.stopPropagation(); g.windows?.openTutorial(o.obj); });
        el.appendChild(row);
      }
      this.trackBody.appendChild(el);
    }
  }

  drawMinimap() {
    const g = this.game;
    const base = g.mapImage;
    if (!base) return;
    const c = this.mmCanvas, ctx = c.getContext('2d');
    const S = c.width;
    const p = g.player.position;
    const zoom = 3.2; // pixels canvas par unité monde
    const yaw = g.rig.yaw;
    ctx.save();
    ctx.fillStyle = '#2a3355'; ctx.fillRect(0, 0, S, S);
    ctx.translate(S / 2, S / 2);
    ctx.rotate(yaw);
    const bs = base.width;
    const scale = (MAP_RANGE * 2) / bs * zoom;
    const [mx, my] = worldToMap(p.x, p.z, bs);
    ctx.drawImage(base, -mx * scale, -my * scale, bs * scale, bs * scale);
    const toMM = (x, z) => [(x - p.x) * zoom, (z - p.z) * zoom];
    // phares
    BEACONS.forEach((b, i) => {
      const [x, y] = toMM(b.x, b.z);
      const lv = g.worldState?.levels[i] || 0;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = lv >= 0.999 ? '#ffe3a3' : '#8e7cc3'; ctx.strokeStyle = '#120f1f'; ctx.lineWidth = 2;
      ctx.fillRect(-7, -7, 14, 14); ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();
    });
    // marqueurs (PNJ, quêtes, échos)
    for (const m of g.mapMarkers?.() || []) {
      const [x, y] = toMM(m.x, m.z);
      if (Math.hypot(x, y) > S / 2 + 10 && !m.edge) continue;
      let dx = x, dy = y;
      const dd = Math.hypot(x, y), lim = S / 2 - 14;
      if (m.edge && dd > lim) { dx = x / dd * lim; dy = y / dd * lim; }
      ctx.fillStyle = m.color; ctx.strokeStyle = '#120f1f'; ctx.lineWidth = 2;
      ctx.beginPath();
      if (m.shape === 'star') { for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, r = k % 2 ? 4 : 9; ctx.lineTo(dx + Math.cos(a) * r, dy + Math.sin(a) * r); } ctx.closePath(); }
      else ctx.arc(dx, dy, m.r || 5, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    // ennemis proches
    ctx.fillStyle = '#ff6b5e';
    for (const e of g.enemies.map.values()) {
      if (!e.alive) continue;
      const [x, y] = toMM(e.position.x, e.position.z);
      if (Math.hypot(x, y) > S / 2) continue;
      ctx.beginPath(); ctx.arc(x, y, e.def.boss ? 9 : 4, 0, Math.PI * 2); ctx.fill();
    }
    // autres joueurs
    for (const rp of g.remotePlayers?.values() || []) {
      const [x, y] = toMM(rp.position.x, rp.position.z);
      ctx.fillStyle = '#7fd4ff'; ctx.strokeStyle = '#0f0c1c';
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    // nord
    const vx = Math.sin(yaw), vy = -Math.cos(yaw); // direction du nord (-z) après rotation
    ctx.save();
    ctx.font = '800 22px "Alegreya Sans SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe3a3'; ctx.strokeStyle = '#120f1f'; ctx.lineWidth = 4;
    const R = S / 2 - 18;
    ctx.strokeText('N', S / 2 + vx * R, S / 2 + vy * R); ctx.fillText('N', S / 2 + vx * R, S / 2 + vy * R);
    ctx.restore();
    // joueur (flèche au centre, orientée par rapport à la caméra)
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(yaw - g.player.facing + Math.PI);
    ctx.fillStyle = '#ffe3a3'; ctx.strokeStyle = '#120f1f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 11); ctx.lineTo(0, 5); ctx.lineTo(-10, 11); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore();
  }
}
