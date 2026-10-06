import { h, svgIcon } from './dom.js';
import { ABILITIES, ABILITY_ICONS } from '../game/Abilities.js';

const ICON = {
  jump: 'M12 19V5M5 12l7-7 7 7', dodge: 'M4 12h12M12 6l6 6-6 6M4 6v12', interact: 'M8 12h8M12 8v8M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0',
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6ZM9 3v15M15 6v15', party: 'M7 21v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M4 21v-1a3 3 0 0 1 3-3M20 21v-1a3 3 0 0 0-3-3', bag: 'M5 8h14l-1 13H6L5 8ZM9 8V6a3 3 0 0 1 6 0v2', menu: 'M4 6h16M4 12h16M4 18h16', chat: 'M4 5h16v11H9l-5 4V5Z', quest: 'M6 3h12v18l-6-4-6 4V3Z',
};

// Commandes tactiles : joystick, caméra au doigt, boutons d'action.
export class TouchControls {
  constructor(game) {
    this.game = game;
    const input = game.input;
    this.root = h('div', { class: 'touch' });
    // joystick
    this.knob = h('div', { class: 'knob' });
    this.joy = h('div', { class: 'joy' }, this.knob);
    this.root.appendChild(this.joy);
    let joyId = null, cx = 0, cy = 0;
    this.joy.addEventListener('pointerdown', (e) => { joyId = e.pointerId; this.joy.setPointerCapture(e.pointerId); const r = this.joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); });
    const move = (e) => {
      if (e.pointerId !== joyId) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const max = 52, l = Math.hypot(dx, dy);
      if (l > max) { dx = dx / l * max; dy = dy / l * max; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      input.touch.move.x = dx / max; input.touch.move.y = -dy / max;
      if (l > max * 0.95) input.touch.buttons.add('sprint'); else input.touch.buttons.delete('sprint');
    };
    const end = (e) => { if (e.pointerId !== joyId) return; joyId = null; this.knob.style.transform = ''; input.touch.move.x = input.touch.move.y = 0; input.touch.buttons.delete('sprint'); };
    this.joy.addEventListener('pointermove', move);
    this.joy.addEventListener('pointerup', end);
    this.joy.addEventListener('pointercancel', end);
    // caméra : glisser sur le canevas
    const canvas = game.renderer.canvas;
    let lookId = null, lx = 0, ly = 0, lt = 0, travel = 0;
    canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch' || lookId !== null) return; lookId = e.pointerId; lx = e.clientX; ly = e.clientY; lt = performance.now(); travel = 0; });
    canvas.addEventListener('pointermove', (e) => { if (e.pointerId !== lookId) return; input.touch.look.dx += (e.clientX - lx) * 1.6; input.touch.look.dy += (e.clientY - ly) * 1.6; travel += Math.hypot(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; });
    const lend = (e) => {
      if (e.pointerId !== lookId) return;
      lookId = null;
      // une tape brève sur la scène attaque (comme un clic)
      if (e.type === 'pointerup' && travel < 10 && performance.now() - lt < 350) input.mouse.clicked = true;
    };
    canvas.addEventListener('pointerup', lend); canvas.addEventListener('pointercancel', lend);
    // boutons
    this.btns = h('div', { class: 'tbtns' });
    this.root.appendChild(this.btns);
    // appui long sur les boutons et le joystick : pas de loupe, de menu ni de surbrillance
    const noGesture = (e) => e.preventDefault();
    this.btns.addEventListener('touchstart', noGesture, { passive: false });
    this.joy.addEventListener('touchstart', noGesture, { passive: false });
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
    // bouton d'interaction (apparaît au besoin)
    this.interactBtn = h('button', { class: 'btn small interactive', style: { position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(250px + var(--safe-b))', pointerEvents: 'auto', maxWidth: '70%' } }, 'Interagir');
    this.interactBtn.addEventListener('click', () => game.interactions?.interact());
    this.root.appendChild(this.interactBtn);
    // petits boutons de menu
    const top = h('div', { style: { position: 'absolute', left: 'calc(14px + var(--safe-l))', top: 'calc(132px + var(--safe-t))', display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'auto' } });
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

  update() {
    const g = this.game;
    const set = (id, remain, total) => { const el = this.cdEls[id]; if (el) el.style.setProperty('--p', (remain > 0 ? Math.round(remain / total * 100) : 0) + '%'); };
    set('attack', g.cooldowns.attack || 0, g.basicCd);
    g.classDef.abilities.forEach((a) => set(a, g.cooldowns[a] || 0, ABILITIES[a].cd));
    set('potion', g.cooldowns.potion || 0, 8);
    this.interactBtn.hidden = !g.promptText;
    if (g.promptText) this.interactBtn.textContent = g.promptText.length > 26 ? g.promptText.slice(0, 24) + '…' : g.promptText;
    const hide = g.windowOpen || g.dialogueOpen;
    this.root.style.display = hide ? 'none' : '';
  }
}
