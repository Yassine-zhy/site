import * as THREE from 'three';
import { h } from './dom.js';

const TIPS = [
  "Les Phares sont partagés par tous les joueurs du monde : chaque squelette vaincu près d'un phare lui rend un peu de lumière.",
  'Maintenez le clic droit (ou X) et dessinez une rune : un triangle pour le feu, un cercle pour soigner, un éclair pour la foudre.',
  'Appuyez deux fois sur Espace en l’air pour déployer la paravoile. Les colonnes de vent vous portent jusqu’aux nuages.',
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
        h('div', { class: 'logo-sub' }, "le continent des échos"),
        h('div', { class: 'loadbar' }, this.loadFill = h('div')),
        this.loadStep = h('div', { class: 'loadstep' }, 'Ouverture du ciel…'),
        this.loadTip = h('div', { class: 'loadtip' }, TIPS[Math.floor(Math.random() * TIPS.length)]),
      ));
    this.floatLayer = h('div', { class: 'floats', style: { position: 'absolute', inset: '0', overflow: 'hidden' } });
    // colonne du haut : boss, cible, vague, annonce puis notifications, empilés sans se chevaucher
    this.topStack = h('div', { class: 'topstack' });
    this.toastBox = h('div', { class: 'toasts' });
    this.announceBox = h('div', { class: 'announce-box' });
    this.topStack.append(this.announceBox, this.toastBox);
    root.append(this.floatLayer, this.topStack, this.loading);
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
    // pas plus de 3 notifications à la fois (2 sur téléphone à l'horizontale)
    const max = innerHeight < 500 ? 2 : 3;
    while (this.toastBox.children.length > max) this.toastBox.firstChild.remove();
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

  // grandes annonces : elles se succèdent au lieu de s'écraser (titre identique ignoré)
  announce(title, sub = '', time = 3) {
    const q = this._annQ || (this._annQ = []);
    if (this._annCur === title || q.some((a) => a[0] === title)) return;
    q.push([title, sub, time]);
    if (!this._annBusy) this.nextAnnounce();
  }

  nextAnnounce() {
    const a = this._annQ.shift();
    if (!a) { this._annBusy = false; this._annCur = null; return; }
    const [title, sub, time] = a;
    this._annBusy = true; this._annCur = title;
    this.announceBox.innerHTML = '';
    const el = h('div', { class: 'announce' }, h('div', { class: 'a1' }, title), sub ? h('div', { class: 'a2' }, sub) : null);
    this.announceBox.appendChild(el);
    clearTimeout(this._annT);
    // s'il en attend une autre, celle-ci s'efface plus tôt
    const t = this._annQ.length ? Math.min(time, 2) : time;
    this._annT = setTimeout(() => { el.classList.add('fade'); setTimeout(() => { el.remove(); this.nextAnnounce(); }, 650); }, t * 1000);
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

  // Zones de l'écran occupées par l'interface fixe : les noms et chiffres flottants les évitent.
  refreshHudRects() {
    const sel = '.topstack > :not(:empty), .minimap-wrap, .tracker, .pframe, .beacons, .actionbar, .prompt, .tinteract, .tmenu, .tb, .joy, .wave-banner';
    const rects = [];
    for (const e of this.root.querySelectorAll(sel)) {
      if (!e.offsetWidth || !e.offsetHeight || e.closest('[hidden]')) continue;
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const r = e.getBoundingClientRect();
      rects.push({ l: r.left - 4, r: r.right + 4, t: r.top - 4, b: r.bottom + 4 });
    }
    const log = this.root.querySelector('.chat-log');
    if (log && [...log.children].some((l) => !l.classList.contains('old'))) {
      // seulement la hauteur réellement occupée par les lignes visibles
      const lines = [...log.children].filter((l) => !l.classList.contains('old'));
      const a = lines[0].getBoundingClientRect(), b = lines[lines.length - 1].getBoundingClientRect(), lr = log.getBoundingClientRect();
      rects.push({ l: lr.left - 4, r: lr.right + 4, t: Math.max(lr.top, a.top) - 4, b: b.bottom + 4 });
    }
    this.hudRects = rects;
    this.fitTopStack();
  }

  // La colonne du haut ne descend jamais sur l'invite d'interaction, le chat ou les boutons :
  // les notifications les plus anciennes s'effacent d'abord, puis le sous-titre de l'annonce.
  fitTopStack() {
    const st = this.topStack;
    if (!st.offsetHeight) return;
    let limit = this.root.clientHeight;
    const sr = st.getBoundingClientRect();
    for (const sel of ['.prompt', '.tinteract', '.chat-log', '.tbtns .tb', '.joy', '.window', '.dlg']) {
      for (const e of this.root.querySelectorAll(sel)) {
        if (!e.offsetWidth || getComputedStyle(e).visibility === 'hidden') continue;
        let r = e.getBoundingClientRect();
        if (sel === '.chat-log') {
          // la hauteur occupée commence à la première ligne encore affichée
          const first = [...e.children].find((l) => !l.classList.contains('old'));
          if (!first) continue;
          r = { left: r.left, right: r.right, top: Math.max(r.top, first.getBoundingClientRect().top) };
        }
        if (r.right < sr.left || r.left > sr.right || r.top < sr.top) continue;
        limit = Math.min(limit, r.top);
      }
    }
    const a2 = st.querySelector('.announce .a2');
    if (a2) a2.style.display = '';
    for (const t of this.toastBox.children) t.style.display = '';
    let guard = 0;
    while (st.getBoundingClientRect().bottom > limit - 6 && guard++ < 8) {
      const visible = [...this.toastBox.children].filter((t) => t.style.display !== 'none');
      if (visible.length) { visible[0].style.display = 'none'; continue; }
      if (a2 && a2.style.display !== 'none') { a2.style.display = 'none'; continue; }
      break;
    }
  }

  overHud(x, y, w = 0, hh = 0) {
    for (const r of this.hudRects || []) if (x + w / 2 > r.l && x - w / 2 < r.r && y > r.t && y - hh < r.b) return true;
    return false;
  }

  update(dt, camera) {
    // dimensions de la fenêtre (innerWidth ne force pas le recalcul de la mise en page, contrairement
    // à clientWidth lu après des modifications du DOM : une mise en page complète à chaque image)
    const w = innerWidth, hgt = innerHeight;
    const v = this.v;
    this.rectT = (this.rectT || 0) - dt;
    if (this.rectT <= 0) { this.rectT = 1; this.refreshHudRects(); }
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
      f.el.style.opacity = this.overHud(sx, sy + 10, 60, 20) ? '0' : k > 0.7 ? String(1 - (k - 0.7) / 0.3) : '1';
    }
    const cam = camera.position;
    const vis = [];
    for (const [id, p] of this.plates) {
      const e = p.ent;
      if (!p.seen) { p.el.remove(); this.plates.delete(id); continue; }
      p.seen = false;
      const d = Math.hypot(e.position.x - cam.x, e.position.y - cam.y, e.position.z - cam.z);
      const maxD = e.kind === 'npc' ? 60 : e.kind === 'player' ? 90 : 45;
      v.set(e.position.x, e.position.y + (e.height || 2.6) + 0.35, e.position.z).project(camera);
      if (v.z > 1 || d > maxD || e.hidden) { if (p.cache.vis !== false) { p.el.style.display = 'none'; p.cache.vis = false; } continue; }
      if (p.cache.vis !== true) { p.el.style.display = ''; p.cache.vis = true; p.dirty = true; }
      p.sx = (v.x * 0.5 + 0.5) * w; p.sy = (-v.y * 0.5 + 0.5) * hgt;
      p.sc = Math.max(0.65, Math.min(1.05, 14 / Math.max(d, 1) + 0.55));
      p.d = d;
      if (p.cache.name !== e.name) { p.name.textContent = e.name; p.cache.name = e.name; p.dirty = true; }
      if (p.cache.kind !== e.kind) { p.name.className = 'pn ' + e.kind; p.el.dataset.kind = e.kind; p.cache.kind = e.kind; p.bar.className = 'pbar' + (e.kind === 'player' ? ' friend' : ''); }
      const showBar = e.hpPct !== undefined && e.hpPct < 0.999;
      if (p.cache.bar !== showBar) { p.bar.hidden = !showBar; p.cache.bar = showBar; p.dirty = true; }
      if (showBar) {
        const hp = Math.max(0, e.hpPct).toFixed(3);
        if (p.cache.hp !== hp) { p.fill.style.transform = `scaleX(${hp})`; p.cache.hp = hp; }
      }
      const title = e.title || '';
      if (p.cache.title !== title) { p.title.textContent = title; p.title.hidden = !title; p.cache.title = title; p.dirty = true; }
      const bubble = e.bubble || '';
      if (p.cache.bubble !== bubble) { p.bubble.textContent = bubble; p.bubble.hidden = !bubble; p.cache.bubble = bubble; p.dirty = true; }
      const mark = e.questMark || '';
      if (p.cache.mark !== mark) { p.mark.textContent = mark; p.mark.hidden = !mark; p.cache.mark = mark; p.dirty = true; }
      // taille mesurée seulement quand le contenu change
      if (p.dirty) { p.w = p.el.offsetWidth; p.h = p.el.offsetHeight; p.dirty = false; }
      // priorité : cible, bulle de dialogue, quête, joueurs, élites/boss, habitants, ennemis
      p.prio = (e.focus ? 100 : 0) + (bubble ? 50 : 0) + (mark ? 40 : 0) + (e.kind === 'player' ? 30 : e.kind === 'elite' ? 25 : e.kind === 'npc' ? 20 : 10);
      vis.push(p);
    }
    // placement sans chevauchement : les noms moins importants montent d'un cran ou s'estompent
    vis.sort((a, b) => b.prio - a.prio || a.d - b.d);
    const placed = (this.hudRects || []).slice();
    for (const p of vis) {
      const pw = p.w * p.sc, ph = p.h * p.sc;
      let l = p.sx - pw / 2, r = p.sx + pw / 2, bot = p.sy, top = bot - ph;
      let ok = false;
      for (let k = 0; k < 3; k++) {
        const hit = placed.find((q) => l < q.r && r > q.l && top < q.b && bot > q.t);
        if (!hit) { ok = true; break; }
        const shift = bot - hit.t + 2;
        if (p.sy - (bot - shift) > 70) break;
        bot -= shift; top -= shift;
      }
      const off = ok ? bot - p.sy : (p.off || 0);
      p.off = p.off === undefined ? off : p.off + (off - p.off) * Math.min(1, dt * 12);
      const op = ok ? '1' : '0';
      if (p.cache.op !== op) { p.el.style.opacity = op; p.cache.op = op; }
      if (ok) placed.push({ l, r, t: top, b: bot });
      p.el.style.transform = `translate(${p.sx.toFixed(1)}px, ${(p.sy + p.off).toFixed(1)}px) translate(-50%, -100%) scale(${p.sc.toFixed(3)})`;
    }
  }
}
