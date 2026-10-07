import * as THREE from 'three';
import { h, svgIcon } from './dom.js';
import { CLASSES, VILLAGE } from '../config.js';
import { ABILITIES, ABILITY_ICONS } from '../game/Abilities.js';
import { Character } from '../entities/Character.js';

// application Android (hors-ligne) : pas de monde partagé ni d'expéditions en ligne
const APP = typeof navigator !== 'undefined' && /AetheriaApp/.test(navigator.userAgent);
const TAGLINE = APP ? 'Aventure hors-ligne · progression sauvegardée sur le téléphone' : 'Monde partagé · progression sauvegardée';
const NAMES = ['Aëlys', 'Brannoc', 'Céleste', 'Dorian', 'Elouan', 'Faëlle', 'Gaïus', 'Héliane', 'Isaure', 'Joran', 'Kaëlig', 'Lysandre', 'Maëlon', 'Nimue', 'Orsan', 'Perrine', 'Quentel', 'Rozenn', 'Soren', 'Tiphaine', 'Ulric', 'Vianne', 'Wenna', 'Ysolde'];

// Écrans : titre, création du héros, mort.
export class Screens {
  constructor(ui, game) {
    this.ui = ui; this.game = game;
  }

  // ------------------------------------------------------------ titre
  // save : gestionnaire des emplacements ; onPlay(i) reprend un héros, onCreate(i) en crée un,
  // onMulti(i) entre puis ouvre le menu des expéditions.
  showTitle({ save, online = 0, onPlay, onCreate, onMulti }) {
    const g = this.game;
    g.world.sky.override = 0.71;
    g.menuMode = 'title';
    this.titleT = 0;
    this.titleOpts = { save, onPlay, onCreate, onMulti };
    this.menuBox = h('div', { class: 'title-menu' });
    this.title = h('div', { id: 'title' },
      h('div', { class: 'left' },
        h('div', { class: 'logo' }, 'Aetheria'),
        h('div', { class: 'logo-sub' }, "le continent des échos"),
        h('div', { class: 'tagline' }, 'Sur un continent immense, la Brume ramène les morts. Rallumez les Phares avec tous les héros du monde, tracez des runes pour lancer vos sorts, et parlez à des habitants qui pensent vraiment.'),
        this.menuBox,
        this.onlineEl = h('div', { class: 'online' }, online > 0 ? [h('b', {}, String(online)), ' héros en ligne en ce moment'] : TAGLINE),
      ),
      h('div', { class: 'credits' }, 'Modèles 3D : KayKit par Kay Lousberg (CC0) · Moteur : three.js'),
    );
    this.title.classList.add('interactive');
    this.ui.root.appendChild(this.title);
    this.showMainButtons();
    this.onKey = (e) => { if (e.code === 'Enter' && this.title?.isConnected && document.activeElement?.tagName !== 'INPUT') this.menuBox.querySelector('.btn:not(.ghost)')?.click(); };
    window.addEventListener('keydown', this.onKey);
  }

  slotLabel(sum) {
    const c = CLASSES[sum.classId];
    return `${sum.name} · ${c?.name || ''} niv. ${sum.level}`;
  }

  showMainButtons() {
    const { save, onPlay, onCreate, onMulti } = this.titleOpts;
    const box = this.menuBox;
    box.innerHTML = '';
    const cur = save.summary(save.slot);
    const firstEmpty = () => { for (let i = 0; i < save.data.length; i++) if (!save.data[i]) return i; return -1; };
    const go = (fn) => () => { this.hideTitle(); fn(); };
    let main;
    if (cur) {
      main = h('button', { class: 'btn', id: 'btn-play', onclick: go(() => onPlay(save.slot)) }, 'Reprendre l’aventure');
      box.append(h('div', { class: 'online', style: { marginTop: '-10px', marginBottom: '14px' } }, this.slotLabel(cur)));
    } else {
      const i = firstEmpty() < 0 ? save.slot : firstEmpty();
      main = h('button', { class: 'btn', id: 'btn-play', onclick: go(() => onCreate(i)) }, 'Commencer l’aventure');
    }
    const saves = h('button', { class: 'btn ghost', id: 'btn-saves', onclick: () => this.showSlots() }, '💾 Sauvegardes');
    const multi = h('button', { class: 'btn ghost', id: 'btn-multi', title: 'Héberger ou rejoindre une expédition entre amis (jusqu’à 4)', onclick: () => {
      if (cur) { this.hideTitle(); onMulti(save.slot); } else this.showSlots('multi');
    } }, '⚔ Multijoueur');
    box.append(h('div', { class: 'row' }, main, saves, APP ? null : multi));
    setTimeout(() => main.focus(), 50);
  }

  // Les quatre emplacements de sauvegarde
  showSlots(mode = 'play') {
    const { save, onPlay, onCreate, onMulti } = this.titleOpts;
    const box = this.menuBox;
    box.innerHTML = '';
    const list = h('div', { class: 'slots' });
    const fmtTime = (s) => { const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60); return hh ? `${hh} h ${String(mm).padStart(2, '0')}` : `${mm} min`; };
    const fmtDate = (t) => { if (!t) return ''; const d = new Date(t); return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
    for (let i = 0; i < save.data.length; i++) {
      const sum = save.summary(i);
      const enter = () => { this.hideTitle(); if (mode === 'multi') onMulti(i); else onPlay(i); };
      const card = h('div', { class: 'slot-card' + (sum ? '' : ' empty') + (i === save.slot && sum ? ' cur' : '') });
      if (sum) {
        const c = CLASSES[sum.classId];
        const del = h('button', { class: 'btn ghost small slot-del', title: 'Supprimer ce héros' }, 'Supprimer');
        del.addEventListener('click', () => {
          if (!del.classList.contains('confirm')) { del.classList.add('confirm'); del.textContent = 'Confirmer ?'; setTimeout(() => { if (del.isConnected) { del.classList.remove('confirm'); del.textContent = 'Supprimer'; } }, 3000); return; }
          save.wipe(i);
          this.game.audio?.play('error');
          this.showSlots(mode);
        });
        card.append(
          h('div', { class: 'slot-n' }, `Emplacement ${i + 1}`),
          h('div', { class: 'slot-name', style: { color: c?.color } }, sum.name),
          h('div', { class: 'slot-info' }, `${c?.name || ''} · niveau ${sum.level}${sum.title ? ' · ' + sum.title : ''}`),
          h('div', { class: 'slot-info dim' }, `${fmtTime(sum.playTime)} de jeu · ${sum.gold} or · ${fmtDate(sum.savedAt)}`),
          h('div', { class: 'slot-actions' }, h('button', { class: 'btn small', onclick: enter }, mode === 'multi' ? 'Jouer en groupe' : 'Jouer'), del));
      } else {
        card.append(
          h('div', { class: 'slot-n' }, `Emplacement ${i + 1}`),
          h('div', { class: 'slot-name dim' }, '— vide —'),
          h('div', { class: 'slot-actions' }, h('button', { class: 'btn ghost small', onclick: () => { this.hideTitle(); onCreate(i, mode === 'multi'); } }, '+ Nouveau héros')));
      }
      list.appendChild(card);
    }
    box.append(list, h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn ghost small', id: 'btn-back', onclick: () => this.showMainButtons() }, '← Retour')));
  }

  setOnline(n) {
    if (!this.onlineEl?.isConnected) return;
    this.onlineEl.innerHTML = '';
    if (n > 1) this.onlineEl.append(h('b', {}, String(n)), ' héros en ligne en ce moment');
    else this.onlineEl.append(TAGLINE);
  }

  hideTitle() { this.title?.remove(); window.removeEventListener('keydown', this.onKey); }

  updateMenu(dt) {
    const g = this.game;
    this.titleT = (this.titleT || 0) + dt;
    const cam = g.camera;
    if (g.menuMode === 'title') {
      const t = this.titleT * 0.035 + 0.6;
      const R = 210;
      cam.position.set(Math.cos(t) * R, 92 + Math.sin(this.titleT * 0.05) * 8, Math.sin(t) * R);
      cam.lookAt(0, 22, 0);
      g.menuFocus = new THREE.Vector3(cam.position.x * 0.3, 20, cam.position.z * 0.3);
    } else if (g.menuMode === 'create' && this.preview) {
      const p = this.preview.object.position;
      const a = 0.35 + Math.sin(this.titleT * 0.25) * 0.15;
      const wide = innerWidth > 760;
      cam.position.set(p.x + Math.sin(a) * 6.2 + (wide ? 1.8 : 0), p.y + 2.2, p.z + Math.cos(a) * 6.2);
      cam.lookAt(p.x + (wide ? 1.4 : 0), p.y + (wide ? 1.35 : 0.7), p.z);
      this.preview.update(dt);
      if (this.previewRing) this.previewRing.rotation.z += dt * 0.4;
      g.menuFocus = p;
    }
  }

  // ------------------------------------------------------------ création
  showCreate(onDone, onBack = null) {
    const g = this.game;
    g.menuMode = 'create';
    g.world.sky.override = 0.68;
    const spot = { x: VILLAGE.x - 9, z: VILLAGE.z + 9 };
    const y = g.world.terrain.heightAt(spot.x, spot.z) ?? 14;
    this.spot = new THREE.Vector3(spot.x, y, spot.z);
    if (!this.previewRing) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.32, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#f2c46d').multiplyScalar(2.2), transparent: true, opacity: 0.8, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(spot.x, y + 0.08, spot.z);
      g.scene.add(ring); this.previewRing = ring;
    }
    let cls = 'knight';
    const name = (g.platform?.firstName() || '').replace(/[^\p{L}\p{N} '\-]/gu, '').slice(0, 16) || NAMES[Math.floor(Math.random() * NAMES.length)];
    const info = h('div', { class: 'clsinfo' });
    const buttons = Object.values(CLASSES).map((c) => h('button', { class: 'cls' + (c.id === cls ? ' on' : ''), 'data-cls': c.id, onclick: () => select(c.id) },
      h('div', { class: 'n', style: { color: c.color } }, c.name), h('div', { class: 'r' }, c.role)));
    const input = h('input', { id: 'hero-name', maxlength: '16', value: name, autocomplete: 'off', spellcheck: 'false' });
    const go = h('button', { class: 'btn', id: 'btn-create', onclick: () => finish() }, 'Entrer dans Aetheria');
    const back = onBack ? h('button', { class: 'btn ghost small', id: 'btn-create-back', style: { float: 'right' }, onclick: () => cancel() }, '← Retour') : null;
    const side = h('div', { class: 'side panel ornate' },
      back,
      h('h2', {}, 'Votre héros'),
      h('div', { class: 'hint' }, 'Choisissez une vocation. Chacune maîtrise les runes à sa manière.'),
      h('div', { class: 'classes' }, buttons),
      h('div', { class: 'field namerow' }, h('label', { for: 'hero-name' }, 'nom du héros'),
        h('div', { style: { display: 'flex', gap: '8px' } }, input, h('button', { class: 'btn ghost small', title: 'Autre nom', onclick: () => { input.value = NAMES[Math.floor(Math.random() * NAMES.length)]; } }, '↻'))),
      go,
      info);
    this.create = h('div', { id: 'create' }, h('div'), side);
    this.ui.root.appendChild(this.create);
    const select = (id) => {
      cls = id;
      buttons.forEach((b) => b.classList.toggle('on', b.dataset.cls === id));
      const c = CLASSES[id];
      info.innerHTML = '';
      info.append(
        h('div', { class: 't' }, c.title),
        h('p', {}, c.desc),
        h('div', { class: 'stats' }, ...[['vie', c.base.hp], ['éther', c.base.mp], ['attaque', c.base.atk], ['défense', c.base.def]].map(([k, v]) => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, String(v))))),
        h('div', { class: 'abil-list' }, ...c.abilities.map((a) => h('div', { class: 'abil' }, svgIcon(ABILITY_ICONS[ABILITIES[a].icon]), h('div', {}, h('b', {}, ABILITIES[a].name), ' — ', ABILITIES[a].desc)))),
      );
      this.setPreview(id);
      g.audio?.play('select');
    };
    const close = () => {
      this.create.remove();
      if (this.preview) { this.preview.dispose(); this.preview = null; }
      if (this.previewRing) { g.scene.remove(this.previewRing); this.previewRing = null; }
      g.menuMode = null;
    };
    const finish = () => {
      const n = (input.value || '').replace(/[^\p{L}\p{N} '\-]/gu, '').trim().slice(0, 16) || name;
      close();
      onDone(cls, n);
    };
    const cancel = () => { close(); onBack?.(); };
    input.addEventListener('keydown', (e) => { if (e.code === 'Enter') finish(); e.stopPropagation(); });
    select(cls);
  }

  setPreview(id) {
    const g = this.game;
    if (this.preview) this.preview.dispose();
    const c = CLASSES[id];
    const ch = new Character(g.assets, c.model, { show: c.weapons.show });
    ch.object.position.copy(this.spot);
    ch.object.rotation.y = 0.5;
    g.scene.add(ch.object);
    ch.setLocomotion(c.weapons.idle);
    ch.playAction(id === 'knight' ? 'Cheer' : id === 'barbarian' ? 'Taunt' : id === 'mage' ? 'Spellcast_Raise' : '1H_Ranged_Shoot', { full: true, timeScale: 1.2 });
    g.fx.ring(this.spot, c.color, { from: 0.5, to: 3.5, life: 0.7 });
    g.fx.burst(this.spot.clone().setY(this.spot.y + 1), c.color, { count: 30, speed: 5, size: 0.3, life: 0.8 });
    this.preview = ch;
  }

  // ------------------------------------------------------------ mort
  showDeath(text) {
    const g = this.game;
    let n = 5;
    const btn = h('button', { class: 'btn', id: 'btn-respawn', disabled: true }, 'Revenir à la lumière (5)');
    this.death = h('div', { id: 'death' }, h('div', { style: { textAlign: 'center', padding: '16px' } },
      h('div', { class: 't' }, 'Vous êtes tombé'),
      h('p', {}, text + ' Votre écho restera ici, pour avertir les autres voyageurs.'),
      btn));
    this.ui.root.appendChild(this.death);
    g.input.exitLock();
    const tick = () => {
      n--;
      if (n <= 0) { btn.disabled = false; btn.textContent = 'Revenir à la lumière'; btn.focus(); return; }
      btn.textContent = `Revenir à la lumière (${n})`;
      g.schedule(1, tick);
    };
    g.schedule(1, tick);
    btn.addEventListener('click', () => { this.death.remove(); this.death = null; g.respawn(); });
  }
}
