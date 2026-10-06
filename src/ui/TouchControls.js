import * as THREE from 'three';
import { h, svgIcon } from './dom.js';
import { ABILITIES, ABILITY_ICONS } from '../game/Abilities.js';

const ICON = {
  jump: 'M12 19V5M5 12l7-7 7 7', dodge: 'M4 12h12M12 6l6 6-6 6M4 6v12', interact: 'M8 12h8M12 8v8M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0',
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6ZM9 3v15M15 6v15', lock: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8', party: 'M7 21v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M4 21v-1a3 3 0 0 1 3-3M20 21v-1a3 3 0 0 0-3-3', bag: 'M5 8h14l-1 13H6L5 8ZM9 8V6a3 3 0 0 1 6 0v2', menu: 'M4 6h16M4 12h16M4 18h16', chat: 'M4 5h16v11H9l-5 4V5Z', quest: 'M6 3h12v18l-6-4-6 4V3Z',
};

// Commandes tactiles : joystick, caméra au doigt, boutons d'action.
export class TouchControls {
  constructor(game) {
    this.game = game;
    const input = game.input;
    this.root = h('div', { class: 'touch' });
    // joystick flottant : il apparaît sous le pouce, n'importe où dans la moitié gauche
    this.knob = h('div', { class: 'knob' });
    this.joy = h('div', { class: 'joy' }, this.knob);
    this.zone = h('div', { class: 'joyzone' });
    this.root.append(this.zone, this.joy);
    let joyId = null, cx = 0, cy = 0;
    const start = (e) => {
      if (joyId !== null) return;
      e.preventDefault();
      joyId = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      const r = this.joy.getBoundingClientRect();
      this.joyMax = Math.max(36, r.width * 0.38);
      if (e.currentTarget === this.zone) {
        // recentre le joystick sous le doigt (sans sortir de l'écran)
        const R = r.width / 2;
        cx = Math.max(R + 8, Math.min(innerWidth * 0.5, e.clientX));
        cy = Math.max(R + 8, Math.min(innerHeight - R - 8, e.clientY));
        this.joy.style.left = (cx - R) + 'px'; this.joy.style.top = (cy - R) + 'px'; this.joy.style.bottom = 'auto';
      } else { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
      this.joy.classList.add('active');
      move(e);
    };
    const move = (e) => {
      if (e.pointerId !== joyId) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const max = this.joyMax || 52, l = Math.hypot(dx, dy);
      if (l > max) { dx = dx / l * max; dy = dy / l * max; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      // petite zone morte, puis réponse progressive
      const m = Math.max(0, (Math.min(l, max) - 6) / (max - 6));
      const k = l > 0 ? m / (Math.min(l, max) / max) : 0;
      input.touch.move.x = dx / max * k; input.touch.move.y = -dy / max * k;
      if (l > max * 0.95) input.touch.buttons.add('sprint'); else input.touch.buttons.delete('sprint');
      this.lastMove = performance.now();
    };
    const end = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null; this.knob.style.transform = ''; input.touch.move.x = input.touch.move.y = 0; input.touch.buttons.delete('sprint');
      this.joy.classList.remove('active');
      this.joy.style.left = ''; this.joy.style.top = ''; this.joy.style.bottom = '';
    };
    for (const el of [this.joy, this.zone]) {
      el.addEventListener('pointerdown', start);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    }
    // caméra : glisser sur le canevas
    const canvas = game.renderer.canvas;
    let lookId = null, lx = 0, ly = 0, lt = 0, travel = 0;
    canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch' || lookId !== null) return; lookId = e.pointerId; lx = e.clientX; ly = e.clientY; lt = performance.now(); travel = 0; });
    canvas.addEventListener('pointermove', (e) => { if (e.pointerId !== lookId) return; const sens = 1.6 * (game.settings.touchSens || 1); input.touch.look.dx += (e.clientX - lx) * sens; input.touch.look.dy += (e.clientY - ly) * sens; travel += Math.hypot(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; if (travel > 10) this.lastLook = performance.now(); });
    const lend = (e) => {
      if (e.pointerId !== lookId) return;
      lookId = null;
      // une tape brève sur la scène attaque (comme un clic) ; sur un ennemi, elle le verrouille aussi
      if (e.type === 'pointerup' && travel < 10 && performance.now() - lt < 350) {
        const hit = this.enemyAt(e.clientX, e.clientY);
        if (hit && hit !== game.locked) game.lock(hit);
        input.mouse.clicked = true;
      }
    };
    canvas.addEventListener('pointerup', lend); canvas.addEventListener('pointercancel', lend);
    // boutons
    this.btns = h('div', { class: 'tbtns' });
    this.root.appendChild(this.btns);
    // appui long sur les boutons et le joystick : pas de loupe, de menu ni de surbrillance
    const noGesture = (e) => e.preventDefault();
    this.btns.addEventListener('touchstart', noGesture, { passive: false });
    this.joy.addEventListener('touchstart', noGesture, { passive: false });
    this.zone.addEventListener('touchstart', noGesture, { passive: false });
    const cls = game.classDef;
    this.cdEls = {};
    const btn = (id, icon, x, y, big = false, onPress, onRelease, label) => {
      const cd = h('div', { class: 'cd' });
      const b = h('div', { class: 'tb' + (big ? ' big' : ''), style: { right: x + 'px', bottom: y + 'px' } }, svgIcon(icon), cd, label ? h('div', { class: 'lab' }, label) : null);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('pressed'); onPress(); });
      const up = () => { b.classList.remove('pressed'); onRelease?.(); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      this.btns.appendChild(b);
      this.cdEls[id] = cd;
      return b;
    };
    // disposition en arcs autour du bouton d'attaque (coin inférieur droit)
    const C = 41, B = 27;
    const arc = (r, deg) => { const a = deg * Math.PI / 180; return [Math.round(C + r * Math.cos(a) - B), Math.round(C + r * Math.sin(a) - B)]; };
    btn('attack', ABILITY_ICONS.attack, 0, 0, true, () => input.touch.buttons.add('attack'), () => input.touch.buttons.delete('attack'));
    cls.abilities.forEach((a, i) => { const [x, y] = arc(96, i * 30); btn(a, ABILITY_ICONS[ABILITIES[a].icon], x, y, false, () => game.useAbility(i)); });
    { const [x, y] = arc(160, 0); btn('jump', ICON.jump, x, y, false, () => { input.touch.pressed.add('jump'); input.touch.buttons.add('jump'); }, () => input.touch.buttons.delete('jump'), 'saut'); }
    { const [x, y] = arc(160, 28); btn('dodge', ICON.dodge, x, y, false, () => input.touch.pressed.add('dodge'), null, 'esquive'); }
    { const [x, y] = arc(160, 58); btn('rune', ABILITY_ICONS.rune, x, y, false, () => game.runes?.beginTouch(), null, 'rune'); }
    { const [x, y] = arc(160, 88); btn('potion', ABILITY_ICONS.potion, x, y, false, () => game.usePotion(), null, 'élixir'); }
    // cible : appui = verrouiller / ennemi suivant, appui long = déverrouiller
    {
      let t0 = 0, held = null;
      const b = btn('lock', ICON.lock, 4, 214, false, () => { t0 = performance.now(); held = setTimeout(() => { held = null; game.unlock(); }, 450); }, () => { if (held) { clearTimeout(held); held = null; if (performance.now() - t0 < 450) game.lockNext(); } }, 'cible');
      b.classList.add('tb-lock');
      this.lockBtn = b;
    }
    // bouton d'interaction (apparaît au besoin)
    this.interactBtn = h('button', { class: 'btn small interactive tinteract', style: { position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(250px + var(--safe-b))', pointerEvents: 'auto', maxWidth: '70%' } }, 'Interagir');
    this.interactBtn.addEventListener('click', () => game.interactions?.interact());
    this.root.appendChild(this.interactBtn);
    // petits boutons de menu
    const top = h('div', { class: 'tmenu', style: { position: 'absolute', left: 'calc(14px + var(--safe-l))', top: 'calc(132px + var(--safe-t))', display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'auto' } });
    for (const [id, icon, fn] of [['map', ICON.map, () => game.toggleWindow('map')], ['bag', ICON.bag, () => game.toggleWindow('inventory')], ['quest', ICON.quest, () => game.toggleWindow('quests')], ['party', ICON.party, () => game.toggleWindow('party')], ['chat', ICON.chat, () => game.chat?.open()], ['menu', ICON.menu, () => game.toggleWindow('settings')]]) {
      const b = h('button', { class: 'tb', style: { position: 'relative', width: '40px', height: '40px' }, 'aria-label': id }, svgIcon(icon));
      b.addEventListener('click', fn);
      top.appendChild(b);
    }
    this.root.appendChild(top);
    game.ui.root.appendChild(this.root);
    // libère les appuis ponctuels
    this.joyHide = false;
  }

  // ennemi le plus proche d'un point de l'écran (tape pour verrouiller)
  enemyAt(cx, cy) {
    const g = this.game, cam = g.camera, v = this._v || (this._v = new THREE.Vector3());
    let best = null, bd = 56;
    for (const e of g.enemies.hittable()) {
      v.set(e.position.x, e.position.y + e.height * 0.5, e.position.z).project(cam);
      if (v.z > 1) continue;
      const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
      const d = Math.hypot(sx - cx, sy - cy);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  update(dt) {
    const g = this.game;
    this.autoCamera(dt);
    this.lockBtn?.classList.toggle('on', !!g.locked);
    const set = (id, remain, total) => { const el = this.cdEls[id]; if (el) el.style.setProperty('--p', (remain > 0 ? Math.round(remain / total * 100) : 0) + '%'); };
    set('attack', g.cooldowns.attack || 0, g.basicCd);
    g.classDef.abilities.forEach((a) => set(a, g.cooldowns[a] || 0, ABILITIES[a].cd));
    set('potion', g.cooldowns.potion || 0, 8);
    this.interactBtn.hidden = !g.promptText;
    if (g.promptText) this.interactBtn.textContent = g.promptText.length > 26 ? g.promptText.slice(0, 24) + '…' : g.promptText;
    const hide = g.windowOpen || g.dialogueOpen;
    this.root.style.display = hide ? 'none' : '';
  }

  // La caméra se replace doucement derrière le héros quand on court sans toucher à la vue.
  autoCamera(dt) {
    const g = this.game, p = g.player, rig = g.rig;
    if (!p || p.dead || g.settings.autoCam === false || g.runes?.drawing || g.locked) return;
    const now = performance.now();
    if (now - (this.lastLook || 0) < 1200) return;
    const mv = g.input.touch.move, mag = Math.hypot(mv.x, mv.y);
    if (mag < 0.3) return;
    const speed = Math.hypot(p.velocity.x, p.velocity.z);
    if (speed < 2) return;
    const want = Math.atan2(p.velocity.x, p.velocity.z) + Math.PI;
    let d = want - rig.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    // on ne fait pas demi-tour quand le héros revient vers la caméra
    if (Math.abs(d) > 2.3) return;
    rig.yaw += d * Math.min(1, dt * 1.6 * Math.min(1, mag)) * (p.gliding ? 0.6 : 1);
  }
}
