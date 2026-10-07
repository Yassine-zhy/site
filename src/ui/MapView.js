import { h } from './dom.js';
import { BEACONS, WAYSTONES, WORLD_BOSSES, ZONES } from '../config.js';
import { MAP_CX, MAP_CZ, MAP_RANGE } from './MapRender.js';
import { EXP_PORTAL } from '../game/Expedition.js';
import { BOSS_KITS } from '../game/Boss.js';

// Carte du monde interactive : molette / pincement pour zoomer, glisser pour se déplacer.
// Les noms s'affichent selon le zoom et ne se chevauchent pas (les plus importants d'abord).
// étiquettes des zones : numéro, nom et niveaux (les terres sauvages n'ont pas de numéro)
const ZCOL = { temperate: '#fff3d6', snow: '#e6f6ff', amber: '#ffe0b0', haunted: '#e2d6ff', jungle: '#c8ffc8', cliffs: '#f2ead8', highland: '#f0f0c0', beach: '#fff0c8', swamp: '#d8e8c0' };
const DOOR_NAMES = { tavern: 'Taverne', forge: 'Forge', guild: 'Guilde', chapel: 'Chapelle', tower: 'Tour de l’Archimage' };
const REGIONS = ZONES.map((zn) => ({ name: (zn.n ? zn.n + ' · ' : '') + zn.name.replace(/^(Les |Le |La )/, ''), sub: `niv. ${zn.level[0]}–${zn.level[1]}`, x: zn.x, z: zn.z - 30, color: ZCOL[zn.biome] || '#fff3d6' }));

export class MapView {
  constructor(game) {
    this.game = game;
    const st = game.mapViewState || (game.mapViewState = { zoom: 1, cx: MAP_CX, cz: MAP_CZ });
    this.st = st;
  }

  element() {
    const g = this.game;
    const size = Math.max(240, Math.min(720, innerWidth - 64, innerHeight - 250));
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.size = size;
    const c = h('canvas', { width: Math.round(size * dpr), height: Math.round(size * dpr), class: 'mapview', style: { width: size + 'px', height: size + 'px' } });
    this.canvas = c; this.ctx = c.getContext('2d'); this.dpr = dpr;
    const zoomBtn = (label, title, fn) => h('button', { class: 'btn ghost small', title, onclick: fn }, label);
    const tools = h('div', { class: 'map-tools' },
      zoomBtn('+', 'Zoomer', () => this.zoomAt(size / 2, size / 2, 1.6)),
      zoomBtn('−', 'Dézoomer', () => this.zoomAt(size / 2, size / 2, 1 / 1.6)),
      zoomBtn('◎', 'Centrer sur moi', () => { const p = g.player.position; this.st.cx = p.x; this.st.cz = p.z; this.st.zoom = Math.max(this.st.zoom, 2.5); this.clamp(); this.draw(); }),
      zoomBtn('⤢', 'Tout le continent', () => { Object.assign(this.st, { zoom: 1, cx: MAP_CX, cz: MAP_CZ }); this.draw(); }));
    this.bind(c);
    requestAnimationFrame(() => this.draw());
    this.draw();
    return h('div', { class: 'map-wrap', style: { width: size + 'px' } }, c, tools);
  }

  // monde -> pixels CSS du canevas
  k() { return this.size / (MAP_RANGE * 2) * this.st.zoom; }
  toScreen(x, z) { const k = this.k(); return [(x - this.st.cx) * k + this.size / 2, (z - this.st.cz) * k + this.size / 2]; }
  toWorld(sx, sy) { const k = this.k(); return [(sx - this.size / 2) / k + this.st.cx, (sy - this.size / 2) / k + this.st.cz]; }

  clamp() {
    const st = this.st;
    st.zoom = Math.max(1, Math.min(6, st.zoom));
    const half = MAP_RANGE * (1 - 1 / st.zoom);
    st.cx = Math.max(MAP_CX - half, Math.min(MAP_CX + half, st.cx));
    st.cz = Math.max(MAP_CZ - half, Math.min(MAP_CZ + half, st.cz));
  }

  zoomAt(sx, sy, f) {
    const [wx, wz] = this.toWorld(sx, sy);
    this.st.zoom *= f;
    this.clamp();
    // le point sous le curseur reste en place
    const [nx, nz] = this.toScreen(wx, wz);
    const k = this.k();
    this.st.cx += (nx - sx) / k; this.st.cz += (nz - sy) / k;
    this.clamp();
    this.draw();
  }

  bind(c) {
    const pts = new Map();
    let pinch = null, moved = 0, lastTap = 0;
    const local = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    c.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = local(e); this.zoomAt(x, y, e.deltaY < 0 ? 1.25 : 0.8); }, { passive: false });
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, local(e));
      moved = 0;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), zoom: this.st.zoom }; }
    });
    c.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId), cur = local(e);
      pts.set(e.pointerId, cur);
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        this.zoomAt(mx, my, (pinch.zoom * d / pinch.d) / this.st.zoom);
        moved += 10;
        return;
      }
      const k = this.k();
      this.st.cx -= (cur[0] - prev[0]) / k; this.st.cz -= (cur[1] - prev[1]) / k;
      moved += Math.abs(cur[0] - prev[0]) + Math.abs(cur[1] - prev[1]);
      this.clamp(); this.draw();
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      const p = pts.get(e.pointerId);
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      // double tape : zoom avant
      if (e.type === 'pointerup' && moved < 6) {
        const now = performance.now();
        if (now - lastTap < 320) this.zoomAt(p[0], p[1], 2);
        lastTap = now;
      }
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  }

  draw() {
    const g = this.game, ctx = this.ctx, S = this.size, st = this.st;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#2a3355'; ctx.fillRect(0, 0, S, S);
    // fond : portion de l'image de la carte
    const img = g.mapImage, N = img.width;
    const [x0, z0] = this.toWorld(0, 0), [x1, z1] = this.toWorld(S, S);
    const u = (x) => (x - MAP_CX + MAP_RANGE) / (MAP_RANGE * 2) * N, v = (z) => (z - MAP_CZ + MAP_RANGE) / (MAP_RANGE * 2) * N;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, u(x0), v(z0), u(x1) - u(x0), v(z1) - v(z0), 0, 0, S, S);
    const z = st.zoom;
    const placed = [];
    const fontPx = Math.round(Math.max(11, Math.min(15, S / 46)));
    const label = (txt, x, zz, color, dy, { size = fontPx, weight = 600, force = false } = {}) => {
      const [px, py] = this.toScreen(x, zz);
      ctx.font = `${weight} ${size}px Alegreya, Georgia, serif`;
      const w = ctx.measureText(txt).width, hgt = size;
      const r = [px - w / 2 - 3, py + dy - hgt, px + w / 2 + 3, py + dy + 4];
      if (r[2] < 0 || r[0] > S || r[3] < 0 || r[1] > S) return;
      if (!force && placed.some((q) => !(r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3]))) return;
      placed.push(r);
      ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(15,12,28,0.85)'; ctx.strokeText(txt, px, py + dy);
      ctx.fillStyle = color; ctx.fillText(txt, px, py + dy);
    };
    const diamond = (x, zz, s, fill) => { const [px, py] = this.toScreen(x, zz); ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI / 4); ctx.fillStyle = fill; ctx.strokeStyle = '#120f1f'; ctx.lineWidth = 2; ctx.fillRect(-s, -s, s * 2, s * 2); ctx.strokeRect(-s, -s, s * 2, s * 2); ctx.restore(); };
    const dot = (x, zz, r, fill) => { const [px, py] = this.toScreen(x, zz); ctx.fillStyle = fill; ctx.strokeStyle = '#120f1f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
    const star = (x, zz, r, fill) => {
      const [px, py] = this.toScreen(x, zz);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fillStyle = fill; ctx.strokeStyle = '#120f1f'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
    };
    // le joueur et ses objectifs passent en premier pour la place des étiquettes
    const p = g.player;
    const [ppx, ppy] = this.toScreen(p.position.x, p.position.z);
    placed.push([ppx - 12, ppy - 14, ppx + 12, ppy + 14]);
    const markers = g.mapMarkers();
    const quest = markers.filter((m) => m.edge), npcs = markers.filter((m) => !m.edge);
    // icônes (sans texte) d'abord
    BEACONS.forEach((b, i) => { const lv = g.worldState?.levels[i] || 0; diamond(b.x, b.z, z > 1.5 ? 7 : 5.5, lv >= 0.999 ? '#ffe3a3' : '#8e7cc3'); });
    for (const w of WAYSTONES) if (z >= 1.6) { const known = g.waystones?.known(w.id); dot(w.x, w.z, 4.5, known ? '#9fe8ff' : '#55708a'); }
    for (const b of WORLD_BOSSES) if (z >= 1.3) dot(b.x, b.z, 5, '#ff6b5e');
    if (z >= 1.3) dot(EXP_PORTAL.x, EXP_PORTAL.z, 5, '#c9a2ff');
    if (z >= 2.2) for (const m of npcs) dot(m.x, m.z, m.shape === 'star' ? 4.5 : 3, m.color);
    for (const rp of g.remotePlayers.values()) dot(rp.position.x, rp.position.z, 5, '#7fd4ff');
    for (const m of quest) star(m.x, m.z, 9, m.color);
    // étiquettes par ordre d'importance
    for (const m of quest) if (m.label) label(m.label, m.x, m.z, m.color, -12, { size: fontPx + 1 });
    for (const r of REGIONS) if (z < 2.4) { label(r.name, r.x, r.z, r.color, 0, { size: fontPx + 5, weight: 700 }); label(r.sub, r.x, r.z, r.color, 15, { size: fontPx - 1, weight: 500 }); }
    BEACONS.forEach((b, i) => { const lv = g.worldState?.levels[i] || 0; label(`${b.name} · ${Math.round(lv * 100)} %`, b.x, b.z, lv >= 0.999 ? '#ffe3a3' : '#d9ccff', -11); });
    if (z >= 1.3) label('Portail des Expéditions', EXP_PORTAL.x, EXP_PORTAL.z, '#e2ccff', 18, { size: fontPx - 1 });
    for (const b of WORLD_BOSSES) if (z >= 1.3) label(BOSS_KITS[b.id]?.name || 'Boss', b.x, b.z, '#ffb3a8', 18, { size: fontPx - 1 });
    if (z >= 1.6) for (const w of WAYSTONES) label(w.name, w.x, w.z, g.waystones?.known(w.id) ? '#bff0ff' : '#8aa0b4', 16, { size: fontPx - 1 });
    // bâtiments où l'on peut entrer (au zoom rapproché)
    if (z >= 3) for (const d of g.rooms?.doors || []) if (d.room !== 'home') { dot(d.x, d.z, 3.5, '#ffd9a0'); label(DOOR_NAMES[d.room], d.x, d.z, '#ffe3c0', 14, { size: fontPx - 2, weight: 500 }); }
    if (z >= 2.2) for (const m of npcs) if (m.label) label(m.label, m.x, m.z, m.color, -8, { size: fontPx - 2, weight: 500 });
    // le joueur
    ctx.save(); ctx.translate(ppx, ppy); ctx.rotate(Math.PI - p.facing);
    ctx.fillStyle = '#ffe3a3'; ctx.strokeStyle = '#120f1f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(9, 9); ctx.lineTo(0, 4); ctx.lineTo(-9, 9); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
    // échelle
    const meters = [50, 100, 200, 500].find((m) => m * this.k() > 60) || 500;
    const L = meters * this.k();
    ctx.fillStyle = 'rgba(15,12,28,0.6)'; ctx.fillRect(10, S - 26, L + 16, 18);
    ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(18, S - 13); ctx.lineTo(18 + L, S - 13); ctx.stroke();
    ctx.font = `500 ${fontPx - 2}px Alegreya, Georgia, serif`; ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'left'; ctx.fillText(`${meters} m`, 22 + L, S - 12);
  }
}
