// Entrées clavier / souris / tactile, unifiées en "actions" de jeu.
// Les codes physiques (e.code) rendent ZQSD (AZERTY) et WASD (QWERTY) équivalents.
const BIND = {
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space'], sprint: ['ShiftLeft', 'ShiftRight'], interact: ['KeyE', 'KeyF'], dodge: ['KeyC', 'ControlLeft'],
  ability1: ['Digit1', 'Numpad1'], ability2: ['Digit2', 'Numpad2'], ability3: ['Digit3', 'Numpad3'], ability4: ['Digit4', 'Numpad4'],
  potion: ['KeyR'], rune: ['KeyX'], map: ['KeyM'], inventory: ['KeyI', 'KeyB'], quests: ['KeyJ', 'KeyL'], chat: ['Enter'], escape: ['Escape'],
  emote: ['KeyG'], echo: ['KeyT'], help: ['KeyH', 'F1'], leaderboard: ['KeyK'], walk: ['KeyV'],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressedSet = new Set();
    this.mouse = { dx: 0, dy: 0, wheel: 0, x: 0, y: 0, left: false, right: false, dragging: false, downX: 0, downY: 0, clicked: false, rightPressed: false, rightReleased: false };
    this.locked = false;
    this.enabled = true;
    this.touch = { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, buttons: new Set(), pressed: new Set() };
    this.isTouch = matchMedia('(pointer: coarse)').matches;
    this.listeners = {};
    this.layout = 'auto';

    const typing = (e) => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); };
    window.addEventListener('keydown', (e) => {
      if (typing(e)) { if (e.code === 'Escape') { e.target.blur(); } return; }
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'F1'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressedSet.add(e.code);
      this.down.add(e.code);
      this.emit('key', e.code);
    });
    window.addEventListener('keyup', (e) => { this.down.delete(e.code); });
    window.addEventListener('blur', () => { this.down.clear(); this.mouse.left = this.mouse.right = false; });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0) {
        this.mouse.left = true; this.mouse.downX = e.clientX; this.mouse.downY = e.clientY; this.mouse.dragging = false;
        if (this.wantLock && !this.locked) this.requestLock();
        else if (this.locked) this.mouse.clicked = true;
      }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; this.emit('rightdown', e); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        if (this.mouse.left && !this.locked && !this.mouse.dragging && e.target === canvas) this.mouse.clicked = true;
        this.mouse.left = false; this.mouse.dragging = false;
      }
      if (e.button === 2) { this.mouse.right = false; this.mouse.rightReleased = true; this.emit('rightup', e); }
    });
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (this.listeners.mousemove) this.emit('mousemove', e, this.locked);
      if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; return; }
      if (this.mouse.left) {
        if (!this.mouse.dragging && Math.hypot(e.clientX - this.mouse.downX, e.clientY - this.mouse.downY) > 6) this.mouse.dragging = true;
        if (this.mouse.dragging) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
      } else if (this.mouse.right) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
    });
    canvas.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; this.emit('lock', this.locked); });
    document.addEventListener('pointerlockerror', () => { this.locked = false; this.wantLock = false; });
    this.wantLock = !this.isTouch;
  }

  requestLock() {
    try {
      const p = this.canvas.requestPointerLock?.({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { this.canvas.requestPointerLock(); } catch { this.wantLock = false; } });
    } catch { this.wantLock = false; }
  }
  exitLock() { if (this.locked) document.exitPointerLock?.(); }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...a) { (this.listeners[ev] || []).forEach((f) => f(...a)); }

  is(action) {
    if (!this.enabled) return false;
    if (this.touch.buttons.has(action)) return true;
    return (BIND[action] || []).some((c) => this.down.has(c));
  }
  pressed(action) {
    if (!this.enabled) return false;
    if (this.touch.pressed.has(action)) return true;
    return (BIND[action] || []).some((c) => this.pressedSet.has(c));
  }

  moveVector() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0, y = 0;
    if (this.is('forward')) y += 1;
    if (this.is('back')) y -= 1;
    if (this.is('left')) x -= 1;
    if (this.is('right')) x += 1;
    x += this.touch.move.x; y += this.touch.move.y;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  consumeLook() {
    const r = { dx: this.mouse.dx + this.touch.look.dx, dy: this.mouse.dy + this.touch.look.dy, wheel: this.mouse.wheel };
    this.mouse.dx = this.mouse.dy = this.mouse.wheel = 0;
    this.touch.look.dx = this.touch.look.dy = 0;
    return r;
  }

  // efface les appuis ponctuels (après le premier sous-pas de simulation)
  clearPressed() {
    this.pressedSet.clear();
    this.touch.pressed.clear();
    this.mouse.clicked = false;
    this.mouse.rightPressed = false;
    this.mouse.rightReleased = false;
  }

  endFrame() {
    this.pressedSet.clear();
    this.touch.pressed.clear();
    this.mouse.clicked = false;
    this.mouse.rightPressed = false;
    this.mouse.rightReleased = false;
  }
}

export const KEY_LABELS = { forward: 'Z/W', back: 'S', left: 'Q/A', right: 'D', jump: 'Espace', sprint: 'Maj', interact: 'E', dodge: 'C', potion: 'R', rune: 'Clic droit / X', map: 'M', inventory: 'I', quests: 'J', chat: 'Entrée', emote: 'G', echo: 'T', help: 'H', leaderboard: 'K' };
