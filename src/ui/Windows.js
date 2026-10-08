import { h, svgIcon } from './dom.js';
import { RARITY, STAT_LABELS, itemPower, levelFactor } from '../game/Items.js';
import { CHEST_TIERS, TIER_ORDER, chestPrice } from '../game/Chests.js';
import { CLASSES, BEACONS, xpForLevel } from '../config.js';
import { QUALITY } from '../engine/Renderer.js';
import { MapView } from './MapView.js';
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
    const builders = { inventory: () => this.inventory(), map: () => this.map(), help: () => this.help(), settings: () => this.settings(), quests: () => this.game.quests?.window(this) || this.help(), leaderboard: () => this.game.worldState?.leaderboardWindow(this) || this.help(), tutorial: () => this.tutorial(), custom: () => this.frame(this.customContent?.title || '', this.customContent?.content || ''), party: () => this.game.expedition?.window(this) || this.help(), grimoire: () => this.grimoire(), chronicles: () => this.game.story?.window(this) || this.help() };
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

  // ------------------------------------------------------------ grimoire des compétences
  // Les 10 compétences de la classe (débloquées au fil des niveaux) ; on en place 6 dans la barre.
  grimoire() {
    const g = this.game, hero = g.hero, cls = hero.cls;
    const touch = g.input.isTouch;
    const bar = hero.bar;
    const sel = this.grimSel && ABILITIES[this.grimSel] && ABILITIES[this.grimSel].level <= hero.level ? this.grimSel : null;
    const changed = () => { g.onBarChanged(); this.refresh(); };
    const place = (slot) => {
      if (!sel) {
        // emplacement occupé sans sélection : on le sélectionne pour le déplacer
        if (bar[slot]) { this.grimSel = bar[slot]; this.refresh(); }
        return;
      }
      const from = bar.indexOf(sel);
      if (from >= 0) bar[from] = bar[slot]; // échange
      bar[slot] = sel;
      this.grimSel = null;
      g.audio?.play('select');
      changed();
    };
    const slots = h('div', { class: 'grim-bar' }, ...bar.map((id, i) => {
      const ab = ABILITIES[id];
      return h('button', { class: 'grim-slot' + (sel ? ' target' : '') + (id && id === sel ? ' on' : ''), title: ab ? ab.name : 'Emplacement libre', onclick: () => place(i) },
        ab ? svgIcon(ABILITY_ICONS[ab.icon]) : h('span', { class: 'plus' }, '+'), h('span', { class: 'k' }, String(i + 1)),
        ab ? h('span', { class: 'x', title: 'Retirer', onclick: (e) => { e.stopPropagation(); bar[i] = null; changed(); } }, '×') : null);
    }));
    const cards = cls.abilities.map((id) => {
      const ab = ABILITIES[id];
      const locked = ab.level > hero.level, slot = bar.indexOf(id);
      return h('div', { class: 'grim-card' + (locked ? ' locked' : '') + (sel === id ? ' on' : ''), onclick: () => {
        if (locked) { g.ui.toast(`<b>${ab.name}</b> se débloque au niveau ${ab.level}.`, { time: 2 }); return; }
        this.grimSel = sel === id ? null : id; g.audio?.play('ui'); this.refresh();
      } },
        h('div', { class: 'ic' }, svgIcon(ABILITY_ICONS[ab.icon])),
        h('div', { class: 'tx' },
          h('div', { class: 'nm' }, ab.name, slot >= 0 ? h('span', { class: 'badge' }, 'barre ' + (slot + 1)) : null),
          h('div', { class: 'meta' }, locked ? `🔒 niveau ${ab.level}` : `niv. ${ab.level} · ${ab.mana ? ab.mana + ' éther' : 'gratuit'} · ${ab.cd} s`),
          h('div', { class: 'ds' }, ab.desc)));
    });
    const unlocked = hero.unlocked();
    const best = h('button', { class: 'btn small ghost', onclick: () => { const last = unlocked.slice(-6); for (let i = 0; i < 6; i++) bar[i] = last[i] || null; changed(); } }, 'Les plus puissantes');
    const hint = sel ? `« ${ABILITIES[sel].name} » sélectionnée : ${touch ? 'touchez' : 'cliquez'} un emplacement de la barre.`
      : `${touch ? 'Touchez' : 'Cliquez'} une compétence, puis l’emplacement où la ranger. ${unlocked.length}/10 apprises.`;
    return this.frame(`Grimoire — ${cls.name}`, h('div', { class: 'grim' }, slots, h('div', { class: 'grim-hint' }, hint, ' ', best), h('div', { class: 'grim-list' }, ...cards)));
  }

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
    const detail = h('div', { class: 'detail' });
    detail.hidden = true;
    // valeurs effectives : un objet de niveau supérieur est ramené au niveau du héros
    const statLine = (it) => { const f = levelFactor(it.level, hero.level); return Object.entries(it.stats).map(([k, v]) => `${STAT_LABELS[k] || k} +${k === 'leech' ? v : Math.round(v * f)}`).join(' · '); };
    const icon = (it) => {
      const ic = h('div', { class: 'ic r' + (it?.rarity ?? 0) });
      if (it?.model) { const url = g.icons.item(it.model); if (url) ic.appendChild(h('img', { src: url, alt: '' })); }
      return ic;
    };
    // équiper : bouton, double-touche, toucher l'emplacement, ou glisser l'objet dessus (souris)
    const equipNow = (it) => {
      if (!it || !hero.inventory.includes(it)) return;
      if (!hero.equipItem(it.id)) return;
      g.audio?.play('pickup'); g.vibrate?.(20);
      g.ui.toast(`Équipé : <b class="r${it.rarity}">${it.name}</b>`);
      g.save?.soon(); this.refresh();
    };
    const select = (it, el) => {
      grid.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel'));
      equipEl.querySelectorAll('.target').forEach((x) => x.classList.remove('target'));
      sel = it;
      if (el) el.classList.add('sel');
      if (it) equipEl.querySelector(`[data-slot="${it.slot}"]`)?.classList.add('target');
      showDetail(it, false);
    };
    const showDetail = (it, equipped) => {
      detail.innerHTML = '';
      detail.hidden = !it;
      if (!it) return;
      const cur = hero.equip[it.slot];
      const diff = equipped ? null : itemPower(it) * levelFactor(it.level, hero.level) - itemPower(cur) * levelFactor(cur?.level, hero.level);
      detail.append(
        h('div', { class: 'dhead' }, icon(it), h('div', {},
          h('div', { class: 'iname r' + it.rarity }, it.name),
          h('div', { class: 'istats' }, `${RARITY[it.rarity].name} · ${SLOT_NAMES[it.slot]} · niveau ${it.level}`),
          h('div', { class: 'istats' }, statLine(it)),
          it.level > hero.level ? h('div', { class: 'istats', style: { color: 'var(--muted)' } }, `Ramené à votre niveau (${hero.level}) : il gagnera en puissance avec vous.`) : null,
          diff !== null ? h('div', { class: 'istats', style: { color: diff >= 0 ? 'var(--good)' : 'var(--bad)' } }, diff >= 0 ? `▲ +${Math.round(diff)} puissance par rapport à l'équipement actuel` : `▼ ${Math.round(diff)} puissance`) : null),
          h('button', { class: 'xbtn', title: 'Fermer', onclick: () => select(null) }, '×')),
        equipped ? null : h('div', { class: 'row' },
          h('button', { class: 'btn small', id: 'btn-equip', onclick: () => equipNow(it) }, 'Équiper'),
          h('button', { class: 'btn small ghost', onclick: () => { const v = hero.sellItem(it.id); g.ui.toast(`Vendu pour <b>${v} or</b>`); g.audio?.play('coin'); g.save?.soon(); this.refresh(); } }, `Vendre (${Math.round(it.value * 0.5)} or)`)),
      );
    };
    // coffres : ouvrir ceux qu'on possède, en acheter d'autres
    const chests = h('div', { class: 'chest-shop' },
      h('div', { class: 'lab sc', style: { color: 'var(--muted)', fontSize: '12px', margin: '4px 0 4px' } }, `coffres · vous avez ${hero.gold} or`),
      ...TIER_ORDER.map((tier) => {
        const T = CHEST_TIERS[tier], n = hero.chests?.[tier] || 0, price = chestPrice(tier, hero.level);
        return h('div', { class: 'chest-row', style: { '--cc': T.color } },
          h('span', { class: 'chest-dot' }), h('span', { class: 'chest-name' }, T.name, h('small', {}, ` · ${n} en stock`)),
          h('button', { class: 'btn small', disabled: !n, onclick: () => g.chests.roll(tier, { fromStock: true }) }, 'Ouvrir'),
          h('button', { class: 'btn small ghost', onclick: () => { if (g.chests.buy(tier)) this.refresh(); } }, `Acheter · ${price} or`));
      }));
    const upgrades = hero.inventory.filter((it) => hero.isUpgrade(it));
    const equipEl = h('div', { class: 'eslots' },
      ...['weapon', 'armor', 'relic'].map((s) => {
        const it = hero.equip[s];
        const better = upgrades.some((u) => u.slot === s);
        return h('div', { class: 'eslot interactive' + (better ? ' up' : ''), 'data-slot': s, onclick: () => { if (sel && sel.slot === s) equipNow(sel); else if (it) showDetail(it, true); } },
          icon(it), h('div', {}, h('div', { class: 'lab' }, SLOT_NAMES[s]), it ? h('div', { class: 'iname r' + it.rarity }, it.name) : h('div', { class: 'istats' }, '— vide —'), it ? h('div', { class: 'istats' }, statLine(it)) : null));
      }));
    const best = () => {
      let n = 0;
      for (const slot of ['weapon', 'armor', 'relic']) {
        const pick = hero.inventory.filter((it) => it.slot === slot && hero.isUpgrade(it)).sort((a, b) => itemPower(b) * levelFactor(b.level, hero.level) - itemPower(a) * levelFactor(a.level, hero.level))[0];
        if (pick && hero.equipItem(pick.id)) n++;
      }
      if (n) { g.audio?.play('pickup'); g.ui.toast(`${n} objet${n > 1 ? 's' : ''} équipé${n > 1 ? 's' : ''}`); g.save?.soon(); this.refresh(); }
    };
    const equip = h('div', { class: 'equip' },
      equipEl,
      upgrades.length ? h('button', { class: 'btn small', id: 'btn-best', onclick: best }, '▲ Équiper le meilleur') : null,
      chests,
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
    for (let i = 0; i < 30; i++) {
      const it = hero.inventory[i];
      if (!it) { grid.appendChild(h('div', { class: 'item' }, h('div', { class: 'ic' }))); continue; }
      let last = 0;
      const el = h('div', { class: 'item interactive' + (hero.isUpgrade(it) ? ' up' : ''), title: it.name, onclick: () => {
        const now = performance.now();
        if (sel === it && now - last < 420) return equipNow(it);
        last = now;
        select(it, el);
      } }, icon(it));
      el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button === 0) this.dragItem(e, it, el, equipEl, equipNow); });
      grid.appendChild(el);
    }
    const potions = h('div', { class: 'row', style: { display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' } },
      h('button', { class: 'btn small ghost', onclick: () => { if ((hero.potions.mp || 0) > 0 && hero.mp < hero.stats.mp) { hero.potions.mp--; hero.mp = Math.min(hero.stats.mp, hero.mp + hero.stats.mp * 0.5); g.audio?.play('potion'); this.refresh(); } } }, `Boire un élixir d’éther (${hero.potions.mp || 0})`));
    return this.frame(`${hero.name} — ${cls.name}`, h('div', { class: 'inv' }, equip, h('div', {}, h('div', { class: 'lab sc', style: { color: 'var(--muted)', fontSize: '12px', marginBottom: '6px' } }, `sac · ${hero.inventory.length}/30 · touchez un objet, puis « Équiper »`), grid, potions)), detail);
  }

  // glisser un objet du sac sur l'emplacement d'équipement (souris)
  dragItem(e, it, el, equipEl, equipNow) {
    const x0 = e.clientX, y0 = e.clientY;
    let ghost = null;
    const slotAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('.eslot[data-slot]');
    const move = (ev) => {
      if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
      if (!ghost) {
        ghost = el.querySelector('.ic').cloneNode(true);
        ghost.className += ' drag-ghost';
        document.body.appendChild(ghost);
        equipEl.querySelector(`[data-slot="${it.slot}"]`)?.classList.add('target');
      }
      ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
      equipEl.querySelectorAll('.eslot').forEach((x) => x.classList.toggle('hover', x === slotAt(ev.clientX, ev.clientY)));
    };
    const up = (ev) => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up);
      if (!ghost) return;
      ghost.remove();
      equipEl.querySelectorAll('.hover').forEach((x) => x.classList.remove('hover'));
      if (slotAt(ev.clientX, ev.clientY)?.dataset.slot === it.slot) equipNow(it);
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  }

  // ------------------------------------------------------------ carte
  map() {
    const view = new MapView(this.game);
    const legend = h('div', { class: 'istats', style: { textAlign: 'center', marginTop: '8px' } },
      this.game.input.isTouch ? 'Pincez pour zoomer, glissez pour vous déplacer. ' : 'Molette pour zoomer, glisser pour vous déplacer. ',
      'Losanges : phares (dorés = allumés). Étoiles : objectifs de quête. Points bleus : pierres de passage.');
    return this.frame('Carte d’Aetheria', view.element(), legend);
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
          row(g.input.isTouch ? 'joystick' : 'ZQSD / WASD', 'Se déplacer'), row('Souris', 'Regarder (cliquez pour capturer la souris)'), row('Automatique', 'Attaque de base (clic gauche pour frapper vous-même)'),
          row('1 · 2 · 3 · 4', 'Compétences'), row('Clic droit maintenu / X', 'Tracer une rune'), row('Espace', 'Sauter · 2e appui en l’air : paravoile'),
          row('N', 'Monture d’éther (hors combat, après la quête de Rhéa)'), row('Maj', 'Sprint · galop'), row('C', 'Esquive'), row('R', 'Élixir de vie'), row('E', 'Parler · interagir'), row('Entrée', 'Discuter'), row('T', 'Laisser un écho'),
          row('G', 'Saluer'), row('Tab', 'Verrouiller une cible · suivante'), row('M · I · J · K', 'Carte · Sac · Quêtes · Classement'), row('P', 'Multijoueur · Expéditions'), row('Échap', 'Options'),
          h('h4', { class: 'sc', style: { color: 'var(--gold)', margin: '12px 0 6px' } }, 'bon à savoir'),
          h('div', { class: 'istats', style: { lineHeight: '1.5' } },
            'Le losange doré à l’écran mène à l’objectif de votre quête. Touchez un objectif dans le journal pour un tutoriel. ',
            'Votre héros frappe ou tire tout seul sur l’ennemi le plus proche : concentrez-vous sur les compétences et les runes. ',
            'Le continent est immense : dès le niveau 8, la Capitaine Rhéa vous apprend à apprivoiser une monture d’éther (N) pour galoper sur les routes. Les pierres de passage raccourcissent aussi les voyages. Les zones sont numérotées de 1 à 8 : plus le numéro est grand, plus les monstres sont forts. ',
            'Les pierres de passage (obélisques bleus) s’éveillent avec E et permettent de voyager. ',
            'Les fleurs, mousses, plumes et cristaux lumineux se récoltent en marchant dessus. ',
            'Expéditions : jusqu’à 4 amis avec un code de groupe, contre les boss de la Citadelle des Ombres.'),
        ),
        h('div', {},
          h('h4', { class: 'sc', style: { color: 'var(--gold)', margin: '0 0 6px' } }, 'les runes'),
          h('div', { class: 'istats', style: { lineHeight: '1.5', marginBottom: '8px' } }, 'Maintenez le clic droit puis tracez la forme d’un seul geste. La précision du tracé décide de la puissance.'),
          ...(g.runes?.legend() || []),
          h('h4', { class: 'sc', style: { color: 'var(--gold)', margin: '12px 0 6px' } }, 'vos compétences'),
          h('p', { style: { color: 'var(--muted)', margin: '0 0 6px' } }, 'Dix compétences par classe, apprises aux niveaux 1, 2, 4, 6, 8, 10, 13, 16, 20 et 24. Six d’entre elles tiennent dans la barre (touches 1 à 6) : choisissez-les dans le grimoire (touche K).'),
          h('button', { class: 'btn small', onclick: () => this.open('grimoire') }, 'Ouvrir le grimoire'),
        )));
    void KEY_LABELS;
  }

  // ------------------------------------------------------------ options
  settings() {
    const g = this.game, s = g.settings;
    const qsel = h('select', { id: 'opt-quality', style: { width: '100%', padding: '8px', background: 'rgba(0,0,0,0.35)', color: 'var(--parch)', border: '1px solid var(--line)', borderRadius: '4px', fontSize: '15px' } },
      ...Object.entries(QUALITY).map(([k, q]) => h('option', { value: k, selected: g.renderer.qualityName === k }, q.label)));
    qsel.addEventListener('change', () => { g.renderer.setQuality(qsel.value); g.world.setQuality(g.renderer.quality); g.prewarm(); s.quality = qsel.value; Save.saveSettings(s); });
    // plafond d'images par seconde : la première économie d'énergie (et de chaleur) sur téléphone
    const fsel = h('select', { id: 'opt-fpscap', style: { width: '100%', padding: '8px', background: 'rgba(0,0,0,0.35)', color: 'var(--parch)', border: '1px solid var(--line)', borderRadius: '4px', fontSize: '15px' } },
      ...[['auto', '60 i/s (recommandé)'], ['30', '30 i/s · économie de batterie'], ['0', 'Sans limite (écrans 90 / 120 Hz)']]
        .map(([v, l]) => h('option', { value: v, selected: String(s.fpsCap ?? 'auto') === v }, l)));
    fsel.addEventListener('change', () => { s.fpsCap = fsel.value; Save.saveSettings(s); });
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
    const touch = g.input.isTouch;
    const sec = (title) => h('h4', { class: 'opt-sec' }, title);
    const apply = () => g.applySettings();
    const buttons = h('div', { class: 'row opt-actions' },
      h('button', { class: 'btn', onclick: () => this.close() }, 'Reprendre'),
      h('button', { class: 'btn ghost', onclick: () => this.open('help') }, 'Guide du voyageur'),
      h('button', { class: 'btn ghost', onclick: () => { g.save.write(true); g.ui.toast(`Partie sauvegardée (emplacement ${(g.save.slot || 0) + 1}).`); } }, 'Sauvegarder'),
      h('button', { class: 'btn ghost', id: 'btn-home', title: 'Sauvegarde puis revient au menu (changer de héros, de sauvegarde…)', onclick: () => g.exitToTitle() }, '⌂ Retour à l’accueil'));
    return this.frame('Options',
      buttons,
      sec('Graphismes'),
      h('div', { class: 'field' }, h('label', { for: 'opt-quality' }, 'qualité graphique'), qsel),
      h('div', { class: 'field' }, h('label', { for: 'opt-fpscap' }, 'images par seconde'), fsel),
      h('div', { class: 'istats' }, `${Math.round(g.fps)} images/s · rendu à ${Math.round((g.renderer.dyn?.ratio || 1) * 100)} %`),
      check('opt-adaptive', 'Résolution adaptative (garde le jeu fluide)', s.adaptive !== false, (v) => { s.adaptive = v; if (!v) g.renderer.setRatio(g.renderer.baseRatio()); }),
      slider('opt-fov', 'champ de vision', s.fov || 60, 50, 85, 1, (v) => { s.fov = v; apply(); }),
      check('opt-fps', 'Afficher les images par seconde', !!s.showFps, (v) => { s.showFps = v; }),
      sec('Son'),
      slider('opt-vol', 'volume général', s.volume, 0, 1, 0.05, (v) => { s.volume = v; g.audio.setVolume(s.volume, s.music); }),
      slider('opt-music', 'musique', s.music, 0, 1, 0.05, (v) => { s.music = v; g.audio.setVolume(s.volume, s.music); }),
      sec('Caméra et commandes'),
      touch ? slider('opt-tsens', 'sensibilité tactile de la caméra', s.touchSens || 1, 0.4, 2.5, 0.1, (v) => { s.touchSens = v; })
        : slider('opt-sens', 'sensibilité de la souris', s.sensitivity || 1, 0.3, 2.5, 0.1, (v) => { s.sensitivity = v; apply(); }),
      touch ? null : check('opt-invert', 'Inverser l’axe vertical', !!s.invertY, (v) => { s.invertY = v; apply(); }),
      slider('opt-camdist', 'distance de la caméra', s.camDist || g.rig.targetDistance || 9, 4, 20, 0.5, (v) => { s.camDist = v; apply(); }),
      check('opt-shake', 'Secousses de la caméra', s.shake !== false, (v) => { s.shake = v; apply(); }),
      check('opt-lockcam', 'La caméra suit la cible verrouillée', s.lockCam !== false, (v) => { s.lockCam = v; }),
      touch ? check('opt-autocam', 'La caméra suit le héros quand il court', s.autoCam !== false, (v) => { s.autoCam = v; }) : null,
      sec('Combat'),
      h('div', { class: 'istats' }, touch ? 'Verrouiller une cible : bouton « cible » (appui long pour libérer) ou touchez l’ennemi.' : 'Verrouiller une cible : touche Tab (appuyez encore pour passer à la suivante).'),
      check('opt-relock', 'Verrouiller automatiquement l’ennemi suivant', s.autoRelock !== false, (v) => { s.autoRelock = v; }),
      check('opt-autoatk', 'Attaque de base automatique (le héros frappe seul l’ennemi le plus proche)', s.autoBasic !== false, (v) => { s.autoBasic = v; }),
      check('opt-dmg', 'Chiffres de dégâts', s.dmgNumbers !== false, (v) => { s.dmgNumbers = v; apply(); }),
      check('opt-plates', 'Noms et vie au-dessus des ennemis', s.plates !== false, (v) => { s.plates = v; apply(); }),
      check('opt-autoequip', 'Équiper automatiquement les meilleurs objets', !!s.autoEquip, (v) => { s.autoEquip = v; }),
      sec('Interface'),
      check('opt-waypoint', 'Afficher la balise de l’objectif de quête', s.waypoint !== false, (v) => { s.waypoint = v; }),
      touch ? slider('opt-tscale', 'taille des boutons tactiles', s.touchScale || 1, 0.75, 1.35, 0.05, (v) => { s.touchScale = v; apply(); }) : null,
      touch ? check('opt-vibrate', 'Vibrations (coups reçus, verrouillage)', s.vibrate !== false, (v) => { s.vibrate = v; }) : null,
    );
  }
}
