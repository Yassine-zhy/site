import * as THREE from 'three';
import { h, svgIcon } from './dom.js';
import { CLASSES, VILLAGE } from '../config.js';
import { ABILITIES, ABILITY_ICONS } from '../game/Abilities.js';
import { Character } from '../entities/Character.js';

const NAMES = ['Aëlys', 'Brannoc', 'Céleste', 'Dorian', 'Elouan', 'Faëlle', 'Gaïus', 'Héliane', 'Isaure', 'Joran', 'Kaëlig', 'Lysandre', 'Maëlon', 'Nimue', 'Orsan', 'Perrine', 'Quentel', 'Rozenn', 'Soren', 'Tiphaine', 'Ulric', 'Vianne', 'Wenna', 'Ysolde'];

// Écrans : titre, création du héros, mort.
export class Screens {
  constructor(ui, game) {
    this.ui = ui; this.game = game;
  }

  // ------------------------------------------------------------ titre
  showTitle({ hasSave, saveInfo, online = 0, onPlay, onNew, onMulti }) {
    const g = this.game;
    g.world.sky.override = 0.71;
    g.menuMode = 'title';
    this.titleT = 0;
    const play = h('button', { class: 'btn', id: 'btn-play', onclick: () => { this.hideTitle(); onPlay(); } }, hasSave ? 'Reprendre l’aventure' : 'Commencer l’aventure');
    const neu = hasSave ? h('button', { class: 'btn ghost', id: 'btn-new', onclick: () => { this.hideTitle(); onNew(); } }, 'Nouveau héros') : null;
    const multi = onMulti ? h('button', { class: 'btn ghost', id: 'btn-multi', title: 'Héberger ou rejoindre une expédition entre amis (jusqu’à 4)', onclick: () => { this.hideTitle(); onMulti(); } }, '⚔ Multijoueur') : null;
    this.title = h('div', { id: 'title' },
      h('div', { class: 'left' },
        h('div', { class: 'logo' }, 'Aetheria'),
        h('div', { class: 'logo-sub' }, "l'archipel des échos"),
        h('div', { class: 'tagline' }, 'Au-dessus d’une mer de nuages, la Brume ramène les morts. Rallumez les Phares avec tous les héros du monde, tracez des runes pour lancer vos sorts, et parlez à des habitants qui pensent vraiment.'),
        hasSave && saveInfo ? h('div', { class: 'online', style: { marginTop: '-10px', marginBottom: '16px' } }, saveInfo) : null,
        h('div', { class: 'row' }, play, neu, multi),
        this.onlineEl = h('div', { class: 'online' }, online > 0 ? [h('b', {}, String(online)), ' héros en ligne en ce moment'] : 'Monde partagé · progression sauvegardée'),
      ),
      h('div', { class: 'credits' }, 'Modèles 3D : KayKit par Kay Lousberg (CC0) · Moteur : three.js'),
    );
    this.title.classList.add('interactive');
    this.ui.root.appendChild(this.title);
    setTimeout(() => play.focus(), 50);
    this.onKey = (e) => { if (e.code === 'Enter' && this.title?.isConnected && document.activeElement?.tagName !== 'INPUT') play.click(); };
    window.addEventListener('keydown', this.onKey);
  }

  setOnline(n) {
    if (!this.onlineEl?.isConnected) return;
    this.onlineEl.innerHTML = '';
    if (n > 1) this.onlineEl.append(h('b', {}, String(n)), ' héros en ligne en ce moment');
    else this.onlineEl.append('Monde partagé · progression sauvegardée');
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
  showCreate(onDone) {
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
    const side = h('div', { class: 'side panel ornate' },
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
    const finish = () => {
      const n = (input.value || '').replace(/[^\p{L}\p{N} '\-]/gu, '').trim().slice(0, 16) || name;
      this.create.remove();
      if (this.preview) { this.preview.dispose(); this.preview = null; }
      if (this.previewRing) { g.scene.remove(this.previewRing); this.previewRing = null; }
      g.menuMode = null;
      onDone(cls, n);
    };
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
