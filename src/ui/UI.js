import * as THREE from 'three';
import { h } from './dom.js';

const TIPS = [
  "Les Phares sont partagés par tous les joueurs du monde : chaque squelette vaincu près d'un phare lui rend un peu de lumière.",
  'Maintenez le clic droit (ou X) et dessinez une rune : un triangle pour le feu, un cercle pour soigner, un éclair pour la foudre.',
  'Appuyez deux fois sur Espace en l’air pour déployer la paravoile. Les colonnes de vent vous portent vers les îlots.',
  'La Brume recule autour des phares allumés : la terre retrouve ses couleurs, les fleurs repoussent.',
  'Les Échos sont des messages laissés par d’autres aventuriers. Lisez-les, et laissez les vôtres avec T.',
  "L'Oracle de Havrelumière invente des quêtes que personne d'autre n'a jamais reçues.",
  'La nuit, les squelettes sont plus nombreux… et les aurores dansent au-dessus des nuages.',
  'Plus votre rune est tracée avec précision, plus le sort est puissant.',
];

// Gestion de l'interface : chargement, textes flottants, plaques, annonces.
export class UI {
  constructor(root) {
    this.root = root;
    this.loading = h('div', { id: 'loading' },
      h('div', { class: 'inner' },
        h('div', { class: 'logo' }, 'Aetheria'),
        h('div', { class: 'logo-sub' }, "l'archipel des échos"),
        h('div', { class: 'loadbar' }, this.loadFill = h('div')),
        this.loadStep = h('div', { class: 'loadstep' }, 'Ouverture du ciel…'),
        this.loadTip = h('div', { class: 'loadtip' }, TIPS[Math.floor(Math.random() * TIPS.length)]),
      ));
    this.floatLayer = h('div', { class: 'floats', style: { position: 'absolute', inset: '0', overflow: 'hidden' } });
    this.toastBox = h('div', { class: 'toasts' });
    this.announceBox = h('div');
    root.append(this.floatLayer, this.toastBox, this.announceBox, this.loading);
    this.floats = [];
    this.plates = new Map();
    this.v = new THREE.Vector3();
    this.tipTimer = setInterval(() => { this.loadTip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)]; }, 6000);
  }

  setProgress(p) { this.loadFill.style.width = Math.round(p * 100) + '%'; }
  setStep(s) { this.loadStep.textContent = s; }
  hideLoading() {
    clearInterval(this.tipTimer);
    this.loading.style.transition = 'opacity 0.8s';
    this.loading.style.opacity = '0';
    setTimeout(() => this.loading.remove(), 850);
  }
  showError(msg) {
    this.loadStep.textContent = msg;
    this.loadStep.style.color = '#ff8a72';
    this.loadStep.style.fontStyle = 'normal';
  }

  // ------------------------------------------------ textes flottants
  floatText(pos, text, cls = 'dmg', { rise = 1.6, life = 1.1, spread = 0.6, scale = 1 } = {}) {
    const el = h('div', { class: 'ft ' + cls }, text);
    this.floatLayer.appendChild(el);
    const f = { el, x: pos.x + (Math.random() - 0.5) * spread, y: pos.y, z: pos.z + (Math.random() - 0.5) * spread, t: 0, life, rise, scale, dx: (Math.random() - 0.5) * 30 };
    this.floats.push(f);
    if (this.floats.length > 60) { const o = this.floats.shift(); o.el.remove(); }
  }

  toast(html, { cls = '', time = 3.2, color } = {}) {
    const el = h('div', { class: 'toast panel ' + cls, html });
    if (color) el.style.color = color;
    this.toastBox.appendChild(el);
    while (this.toastBox.children.length > 5) this.toastBox.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 420); }, time * 1000);
  }

  // fondu au noir bref (voyage, téléportation)
  fade(t = 0.35) {
    if (!this.fadeEl) { this.fadeEl = h('div', { class: 'fade-veil' }); this.root.appendChild(this.fadeEl); }
    const el = this.fadeEl;
    el.style.transition = `opacity ${t}s ease`;
    el.style.opacity = '1';
    clearTimeout(this._fadeT);
    this._fadeT = setTimeout(() => { el.style.transition = 'opacity 0.6s ease'; el.style.opacity = '0'; }, t * 1000 + 120);
  }

  announce(title, sub = '', time = 3) {
    this.announceBox.innerHTML = '';
    const el = h('div', { class: 'announce' }, h('div', { class: 'a1' }, title), sub ? h('div', { class: 'a2' }, sub) : null);
    this.announceBox.appendChild(el);
    clearTimeout(this._annT);
    this._annT = setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 800); }, time * 1000);
  }

  // ------------------------------------------------ plaques au-dessus des têtes
  // ent : { id, position, height, name, kind: 'enemy'|'elite'|'player'|'npc', hpPct?, title?, bubble?, questMark? }
  setPlate(ent) {
    let p = this.plates.get(ent.id);
    if (!p) {
      const el = h('div', { class: 'plate' });
      const bubble = h('div', { class: 'bubble' }); bubble.hidden = true;
      const mark = h('div', { class: 'quest-mark' }); mark.hidden = true;
      const name = h('div', { class: 'pn' });
      const title = h('div', { class: 'pt' }); title.hidden = true;
      const bar = h('div', { class: 'pbar' }, h('div')); bar.hidden = true;
      el.append(bubble, mark, name, title, bar);
      this.floatLayer.appendChild(el);
      p = { el, bubble, mark, name, title, bar, fill: bar.firstChild, cache: {} };
      this.plates.set(ent.id, p);
    }
    p.ent = ent;
    p.seen = true;
    return p;
  }

  removePlate(id) { const p = this.plates.get(id); if (p) { p.el.remove(); this.plates.delete(id); } }

  update(dt, camera) {
    const w = this.root.clientWidth, hgt = this.root.clientHeight;
    const v = this.v;
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += dt;
      const k = f.t / f.life;
      if (k >= 1) { f.el.remove(); this.floats.splice(i, 1); continue; }
      v.set(f.x, f.y + f.rise * Math.sqrt(k) * 1.6, f.z).project(camera);
      if (v.z > 1) { f.el.style.opacity = '0'; continue; }
      const sx = (v.x * 0.5 + 0.5) * w + f.dx * k, sy = (-v.y * 0.5 + 0.5) * hgt;
      const pop = k < 0.12 ? 0.6 + k / 0.12 * 0.7 : 1.3 - Math.min(0.3, (k - 0.12) * 1.5);
      f.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(${pop * f.scale})`;
      f.el.style.opacity = k > 0.7 ? String(1 - (k - 0.7) / 0.3) : '1';
    }
    const cam = camera.position;
    for (const [id, p] of this.plates) {
      const e = p.ent;
      if (!p.seen) { p.el.remove(); this.plates.delete(id); continue; }
      p.seen = false;
      const d = Math.hypot(e.position.x - cam.x, e.position.y - cam.y, e.position.z - cam.z);
      const maxD = e.kind === 'npc' ? 60 : e.kind === 'player' ? 90 : 45;
      v.set(e.position.x, e.position.y + (e.height || 2.6) + 0.35, e.position.z).project(camera);
      if (v.z > 1 || d > maxD || e.hidden) { if (p.cache.vis !== false) { p.el.style.display = 'none'; p.cache.vis = false; } continue; }
      if (p.cache.vis !== true) { p.el.style.display = ''; p.cache.vis = true; }
      const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * hgt;
      const sc = Math.max(0.65, Math.min(1.05, 14 / Math.max(d, 1) + 0.55));
      p.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%) scale(${sc.toFixed(3)})`;
      if (p.cache.name !== e.name) { p.name.textContent = e.name; p.cache.name = e.name; }
      if (p.cache.kind !== e.kind) { p.name.className = 'pn ' + e.kind; p.el.dataset.kind = e.kind; p.cache.kind = e.kind; p.bar.className = 'pbar' + (e.kind === 'player' ? ' friend' : ''); }
      const showBar = e.hpPct !== undefined && e.hpPct < 0.999;
      if (p.cache.bar !== showBar) { p.bar.hidden = !showBar; p.cache.bar = showBar; }
      if (showBar) {
        const hp = Math.max(0, e.hpPct).toFixed(3);
        if (p.cache.hp !== hp) { p.fill.style.transform = `scaleX(${hp})`; p.cache.hp = hp; }
      }
      const title = e.title || '';
      if (p.cache.title !== title) { p.title.textContent = title; p.title.hidden = !title; p.cache.title = title; }
      const bubble = e.bubble || '';
      if (p.cache.bubble !== bubble) { p.bubble.textContent = bubble; p.bubble.hidden = !bubble; p.cache.bubble = bubble; }
      const mark = e.questMark || '';
      if (p.cache.mark !== mark) { p.mark.textContent = mark; p.mark.hidden = !mark; p.cache.mark = mark; }
    }
  }
}
