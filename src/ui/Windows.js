import { h, svgIcon } from './dom.js';
import { RARITY, STAT_LABELS, itemPower } from '../game/Items.js';
import { CLASSES, BEACONS, ISLETS, xpForLevel } from '../config.js';
import { QUALITY } from '../engine/Renderer.js';
import { MAP_RANGE, worldToMap } from './MapRender.js';
import { ABILITIES, ABILITY_ICONS } from '../game/Abilities.js';
import { KEY_LABELS } from '../engine/Input.js';
import { Save } from '../game/Save.js';
import { tutorialView } from './Tutorials.js';

const SLOT_NAMES = { weapon: 'Arme', armor: 'Protection', relic: 'Relique' };

// Fenêtres : personnage & sac, carte du monde, aide, options.
export class Windows {
  constructor(game) {
    this.game = game;
    this.ui = game.ui;
    this.current = null;
    this.el = null;
  }

  toggle(name) {
    if (this.current === name) return this.close();
    this.open(name);
  }

  close() {
    if (this.el) this.el.remove();
    this.el = null; this.current = null;
    this.game.windowOpen = false;
    this.game.audio?.play('ui');
  }

  open(name) {
    if (this.el) this.el.remove();
    this.current = name;
    this.game.windowOpen = true;
    this.game.input.exitLock();
    const builders = { inventory: () => this.inventory(), map: () => this.map(), help: () => this.help(), settings: () => this.settings(), quests: () => this.game.quests?.window(this) || this.help(), leaderboard: () => this.game.worldState?.leaderboardWindow(this) || this.help(), tutorial: () => this.tutorial(), custom: () => this.frame(this.customContent?.title || '', this.customContent?.content || ''), party: () => this.game.expedition?.window(this) || this.help() };
    const body = (builders[name] || builders.help)();
    this.el = body;
    this.ui.root.appendChild(body);
    this.game.audio?.play('ui');
  }

  frame(title, ...content) {
    return h('div', { class: 'window panel ornate', role: 'dialog', 'aria-label': title },
      h('div', { class: 'wh' }, h('h3', {}, title), h('button', { class: 'xbtn', title: 'Fermer (Échap)', onclick: () => this.close() }, '×')),
      h('div', { class: 'wb' }, ...content));
  }

  refresh() { if (this.current) this.open(this.current); }

  // fenêtre quelconque (contenu fourni par un autre système)
  custom(title, content) { this.customContent = { title, content }; this.open('custom'); }

  // ------------------------------------------------------------ tutoriel d'un objectif de quête
  openTutorial(objective) {
    this.tut = objective;
    this.open('tutorial');
  }

  tutorial() {
    const o = this.tut || { type: 'talk', text: '' };
    return this.frame('Comment faire ?', tutorialView(this.game, o, { onBack: () => this.open('quests') }));
  }

  // ------------------------------------------------------------ personnage & sac
  inventory() {
    const g = this.game, hero = g.hero;
    const cls = CLASSES[hero.classId];
    let sel = null;
    const detail = h('div', { class: 'detail' }, h('div', { class: 'istats' }, 'Choisissez un objet pour le comparer.'));
    const statLine = (it) => Object.entries(it.stats).map(([k, v]) => `${STAT_LABELS[k] || k} +${v}`).join(' · ');
    const icon = (it) => {
      const ic = h('div', { class: 'ic r' + (it?.rarity ?? 0) });
      if (it?.model) { const url = g.icons.item(it.model); if (url) ic.appendChild(h('img', { src: url, alt: '' })); }
      return ic;
    };
    const showDetail = (it, equipped) => {
      detail.innerHTML = '';
      if (!it) return;
      const cur = hero.equip[it.slot];
      const diff = equipped ? null : itemPower(it) - itemPower(cur);
      detail.append(
        h('div', { class: 'iname r' + it.rarity }, it.name),
        h('div', { class: 'istats' }, `${RARITY[it.rarity].name} · ${SLOT_NAMES[it.slot]} · niveau ${it.level}`),
        h('div', { class: 'istats', style: { marginTop: '4px' } }, statLine(it)),
        diff !== null ? h('div', { class: 'istats', style: { color: diff >= 0 ? 'var(--good)' : 'var(--bad)', marginTop: '4px' } }, diff >= 0 ? `▲ +${Math.round(diff)} puissance par rapport à l'équipement actuel` : `▼ ${Math.round(diff)} puissance`) : null,
        equipped ? null : h('div', { class: 'row' },
          h('button', { class: 'btn small', onclick: () => { hero.equipItem(it.id); g.audio?.play('pickup'); g.save?.soon(); this.refresh(); } }, 'Équiper'),
          g.npcs?.nearMerchant?.() ? h('button', { class: 'btn small ghost', onclick: () => { const v = hero.sellItem(it.id); g.ui.toast(`Vendu pour <b>${v} or</b>`); g.audio?.play('coin'); g.save?.soon(); this.refresh(); } }, `Vendre (${Math.round(it.value * 0.5)} or)`) : h('span', { class: 'istats', style: { alignSelf: 'center' } }, 'Vente possible auprès de Brom le forgeron.')),
      );
    };
    const equip = h('div', { class: 'equip' },
      ...['weapon', 'armor', 'relic'].map((s) => {
        const it = hero.equip[s];
        const el = h('div', { class: 'eslot interactive', onclick: () => it && showDetail(it, true) }, icon(it), h('div', {}, h('div', { class: 'lab' }, SLOT_NAMES[s]), it ? h('div', { class: 'iname r' + it.rarity }, it.name) : h('div', { class: 'istats' }, '— vide —'), it ? h('div', { class: 'istats' }, statLine(it)) : null));
        return el;
      }),
      h('div', { class: 'charstats' },
        h('span', {}, 'Niveau'), h('span', {}, `${hero.level} (${hero.xp}/${xpForLevel(hero.level)} xp)`),
        h('span', {}, 'Vie'), h('span', {}, String(hero.stats.hp)), h('span', {}, 'Éther'), h('span', {}, String(hero.stats.mp)),
        h('span', {}, 'Attaque'), h('span', {}, String(hero.stats.atk)), h('span', {}, 'Défense'), h('span', {}, String(hero.stats.def)),
        h('span', {}, 'Critique'), h('span', {}, hero.stats.crit + ' %'), h('span', {}, 'Célérité'), h('span', {}, (hero.stats.haste || 0) + ' %'),
        h('span', {}, 'Puissance runique'), h('span', {}, '+' + Math.round((hero.stats.rune || 0) + (cls.runeBonus - 1) * 100) + ' %'),
        h('span', {}, 'Or'), h('span', { class: 'gold' }, String(hero.gold)),
        h('span', {}, 'Élixirs'), h('span', {}, `${hero.potions.hp || 0} vie · ${hero.potions.mp || 0} éther`),
        h('span', {}, 'Squelettes vaincus'), h('span', {}, String(hero.kills)),
        h('span', {}, 'Lumière offerte'), h('span', {}, String(Math.round(hero.light))),
      ));
    const grid = h('div', { class: 'grid' });
    for (let i = 0; i < 24; i++) {
      const it = hero.inventory[i];
      if (!it) { grid.appendChild(h('div', { class: 'item' }, h('div', { class: 'ic' }))); continue; }
      const el = h('div', { class: 'item interactive' + (hero.isUpgrade(it) ? ' up' : ''), title: it.name, onclick: () => { grid.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); el.classList.add('sel'); sel = it; showDetail(it, false); } }, icon(it));
      grid.appendChild(el);
    }
    const potions = h('div', { class: 'row', style: { display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' } },
      h('button', { class: 'btn small ghost', onclick: () => { if ((hero.potions.mp || 0) > 0 && hero.mp < hero.stats.mp) { hero.potions.mp--; hero.mp = Math.min(hero.stats.mp, hero.mp + hero.stats.mp * 0.5); g.audio?.play('potion'); this.refresh(); } } }, `Boire un élixir d’éther (${hero.potions.mp || 0})`));
    void sel;
    return this.frame(`${hero.name} — ${cls.name}`, h('div', { class: 'inv' }, equip, h('div', {}, h('div', { class: 'lab sc', style: { color: 'var(--muted)', fontSize: '12px', marginBottom: '6px' } }, `sac · ${hero.inventory.length}/24`), grid, detail, potions)));
  }

  // ------------------------------------------------------------ carte
  map() {
    const g = this.game;
    const size = Math.min(620, innerWidth - 64, innerHeight - 190);
    const c = h('canvas', { width: 1024, height: 1024, style: { width: size + 'px', height: size + 'px', borderRadius: '6px', display: 'block', margin: '0 auto', border: '1px solid var(--line)' } });
    const ctx = c.getContext('2d');
    ctx.drawImage(g.mapImage, 0, 0, 1024, 1024);
    const P = (x, z) => worldToMap(x, z, 1024);
    ctx.font = '600 22px Alegreya, Georgia, serif';
    ctx.textAlign = 'center';
    const label = (txt, x, z, color = '#fff3d6', dy = -18) => { const [px, py] = P(x, z); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(15,12,28,0.85)'; ctx.strokeText(txt, px, py + dy); ctx.fillStyle = color; ctx.fillText(txt, px, py + dy); };
    BEACONS.forEach((b, i) => {
      const lv = g.worldState?.levels[i] || 0;
      const [x, y] = P(b.x, b.z);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = lv >= 0.999 ? '#ffe3a3' : '#8e7cc3'; ctx.strokeStyle = '#120f1f'; ctx.lineWidth = 3;
      ctx.fillRect(-11, -11, 22, 22); ctx.strokeRect(-11, -11, 22, 22); ctx.restore();
      label(`${b.name} · ${Math.round(lv * 100)} %`, b.x, b.z, lv >= 0.999 ? '#ffe3a3' : '#d9ccff', -22);
    });
    label('Havrelumière', 0, 0, '#ffe3a3', 34);
    for (const isl of ISLETS) label(isl.name, isl.x, isl.z + isl.radius, '#cfe6ff', 26);
    const markers = g.mapMarkers();
    for (const m of markers) {
      const [x, y] = P(m.x, m.z);
      ctx.fillStyle = m.color; ctx.strokeStyle = '#120f1f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (m.label) label(m.label, m.x, m.z, m.color, -14);
    }
    for (const rp of g.remotePlayers.values()) { const [x, y] = P(rp.position.x, rp.position.z); ctx.fillStyle = '#7fd4ff'; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); }
    const p = g.player;
    const [px, py] = P(p.position.x, p.position.z);
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI - p.facing);
    ctx.fillStyle = '#ffe3a3'; ctx.strokeStyle = '#120f1f'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(13, 14); ctx.lineTo(0, 7); ctx.lineTo(-13, 14); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
    const legend = h('div', { class: 'istats', style: { textAlign: 'center', marginTop: '10px' } }, 'Losanges dorés : phares allumés par la communauté. Violets : phares éteints, à rallumer ensemble.');
    void MAP_RANGE;
    return this.frame('Carte de l’archipel', c, legend);
  }

  // ------------------------------------------------------------ aide
  help() {
    const g = this.game;
    const cls = CLASSES[g.hero.classId];
    const row = (k, v) => h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '4px 0', borderBottom: '1px solid var(--line-soft)' } }, h('span', {}, v), h('b', { class: 'sc', style: { color: 'var(--gold-hi)' } }, k));
    return this.frame('Guide du voyageur',
      h('div', { class: 'inv' },
        h('div', {},
          h('h4', { class: 'sc', style: { color: 'var(--gold)', margin: '0 0 6px' } }, 'commandes'),
          row(g.input.isTouch ? 'joystick' : 'ZQSD / WASD', 'Se déplacer'), row('Souris', 'Regarder (cliquez pour capturer la souris)'), row('Clic gauche', 'Attaquer'),
          row('1 · 2 · 3 · 4', 'Compétences'), row('Clic droit maintenu / X', 'Tracer une rune'), row('Espace', 'Sauter · 2e appui en l’air : paravoile'),
          row('Maj', 'Sprint'), row('C', 'Esquive'), row('R', 'Élixir de vie'), row('E', 'Parler · interagir'), row('Entrée', 'Discuter'), row('T', 'Laisser un écho'),
          row('G', 'Saluer'), row('M · I · J · K', 'Carte · Sac · Quêtes · Classement'), row('Échap', 'Options'),
        ),
        h('div', {},
          h('h4', { class: 'sc', style: { color: 'var(--gold)', margin: '0 0 6px' } }, 'les runes'),
          h('div', { class: 'istats', style: { lineHeight: '1.5', marginBottom: '8px' } }, 'Maintenez le clic droit puis tracez la forme d’un seul geste. La précision du tracé décide de la puissance.'),
          ...(g.runes?.legend() || []),
          h('h4', { class: 'sc', style: { color: 'var(--gold)', margin: '12px 0 6px' } }, 'vos compétences'),
          h('div', { class: 'abil-list' }, ...cls.abilities.map((a, i) => h('div', { class: 'abil' }, svgIcon(ABILITY_ICONS[ABILITIES[a].icon]), h('div', {}, h('b', {}, `${i + 1}. ${ABILITIES[a].name}`), ` (niv. ${ABILITIES[a].level}) — ${ABILITIES[a].desc}`)))),
        )));
    void KEY_LABELS;
  }

  // ------------------------------------------------------------ options
  settings() {
    const g = this.game, s = g.settings;
    const qsel = h('select', { id: 'opt-quality', style: { width: '100%', padding: '8px', background: 'rgba(0,0,0,0.35)', color: 'var(--parch)', border: '1px solid var(--line)', borderRadius: '4px', fontSize: '15px' } },
      ...Object.entries(QUALITY).map(([k, q]) => h('option', { value: k, selected: g.renderer.qualityName === k }, q.label)));
    qsel.addEventListener('change', () => { g.renderer.setQuality(qsel.value); g.world.setQuality(g.renderer.quality); g.prewarm(); s.quality = qsel.value; Save.saveSettings(s); });
    const slider = (id, label, val, min, max, step, on) => {
      const out = h('span', { class: 'num' }, String(val));
      const inp = h('input', { id, type: 'range', min, max, step, value: val, style: { width: '100%' } });
      inp.addEventListener('input', () => { out.textContent = inp.value; on(parseFloat(inp.value)); Save.saveSettings(s); });
      return h('div', { class: 'field' }, h('label', { for: id }, label, ' · ', out), inp);
    };
    const check = (id, label, val, on) => {
      const inp = h('input', { id, type: 'checkbox', checked: val });
      inp.addEventListener('change', () => { on(inp.checked); Save.saveSettings(s); });
      return h('label', { for: id, style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '8px 0', fontSize: '15px' } }, inp, label);
    };
    return this.frame('Options',
      h('div', { class: 'field' }, h('label', { for: 'opt-quality' }, 'qualité graphique'), qsel),
      h('div', { class: 'istats' }, `${Math.round(g.fps)} images/s · rendu à ${Math.round((g.renderer.dyn?.ratio || 1) * 100)} %`),
      check('opt-adaptive', 'Résolution adaptative (garde le jeu fluide)', s.adaptive !== false, (v) => { s.adaptive = v; if (!v) g.renderer.setRatio(Math.min(devicePixelRatio || 1, g.renderer.quality.pixelRatio)); }),
      slider('opt-vol', 'volume général', s.volume, 0, 1, 0.05, (v) => { s.volume = v; g.audio.setVolume(s.volume, s.music); }),
      slider('opt-music', 'musique', s.music, 0, 1, 0.05, (v) => { s.music = v; g.audio.setVolume(s.volume, s.music); }),
      g.input.isTouch ? null : slider('opt-sens', 'sensibilité de la souris', s.sensitivity, 0.3, 2.5, 0.1, (v) => { s.sensitivity = v; g.rig.sensitivity = 0.0023 * v; }),
      g.input.isTouch ? null : check('opt-invert', 'Inverser l’axe vertical', !!s.invertY, (v) => { s.invertY = v; g.rig.invertY = v; }),
      g.input.isTouch ? slider('opt-tsens', 'sensibilité tactile de la caméra', s.touchSens || 1, 0.4, 2.5, 0.1, (v) => { s.touchSens = v; }) : null,
      g.input.isTouch ? check('opt-autocam', 'La caméra suit le héros quand il court', s.autoCam !== false, (v) => { s.autoCam = v; }) : null,
      check('opt-autoequip', 'Équiper automatiquement les meilleurs objets', !!s.autoEquip, (v) => { s.autoEquip = v; }),
      check('opt-waypoint', 'Afficher la balise de l’objectif de quête', s.waypoint !== false, (v) => { s.waypoint = v; }),
      h('div', { class: 'row', style: { display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' } },
        h('button', { class: 'btn', onclick: () => this.close() }, 'Reprendre'),
        h('button', { class: 'btn ghost', onclick: () => this.open('help') }, 'Guide du voyageur'),
        h('button', { class: 'btn ghost', onclick: () => { g.save.write(true); g.ui.toast('Partie sauvegardée.'); } }, 'Sauvegarder')),
    );
  }
}
