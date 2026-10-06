import { h } from './dom.js';
import { CLASSES } from '../config.js';
import { cleanText } from '../net/Net.js';

// Discussion : messages des joueurs (bulles au-dessus des têtes) et annonces du monde.
export class Chat {
  constructor(game) {
    this.game = game;
    this.log = h('div', { class: 'chat-log' });
    this.input = h('input', { id: 'chat-input', class: 'chat-input', maxlength: '140', placeholder: 'Écrire au monde… (Entrée)', autocomplete: 'off', spellcheck: 'false' });
    this.input.hidden = true;
    this.root = h('div', { class: 'chat interactive' }, this.log, this.input);
    game.ui.root.appendChild(this.root);
    const style = h('style', {}, `
      .chat { position:absolute; left:calc(14px + var(--safe-l)); bottom:calc(96px + var(--safe-b)); width:min(380px, calc(100% - 32px)); pointer-events:none; }
      .chat-log { display:flex; flex-direction:column; gap:3px; max-height:190px; overflow:hidden; justify-content:flex-end; mask-image:linear-gradient(transparent, #000 30%); -webkit-mask-image:linear-gradient(transparent, #000 30%); }
      .chat-line { font-size:14px; line-height:1.35; text-shadow:0 1px 3px #000, 0 0 6px rgba(0,0,0,.7); color:var(--parch); transition:opacity 1s; }
      .chat-line b { font-family:var(--font-sc); letter-spacing:.03em; }
      .chat-line.sys { color:var(--gold-hi); font-style:italic; font-family:var(--font-body); }
      .chat-line.old { opacity:0; }
      .chat.open .chat-line.old { opacity:.85; }
      .chat-input { pointer-events:auto; width:100%; margin-top:6px; background:rgba(15,12,28,.85); border:1px solid var(--line); color:var(--parch); border-radius:4px; padding:8px 10px; font-size:15px; font-family:var(--font-ui); outline:none; user-select:text; -webkit-user-select:text; }
      .chat-input:focus { border-color:var(--gold); }
      @media (max-width:760px), (pointer:coarse) { .chat { bottom:calc(200px + var(--safe-b)); width:min(300px, 60%); } .chat-log { max-height:110px; } .chat-line { font-size:12.5px; } }
    `);
    document.head.appendChild(style);
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Enter') { this.send(); this.close(); }
      else if (e.code === 'Escape') this.close();
    });
    this.input.addEventListener('blur', () => setTimeout(() => this.close(), 50));
    game.input.on('key', (code) => {
      if (code === 'Enter' && game.inGame && this.input.hidden && !game.windowOpen && !game.dialogueOpen) this.open();
    });
  }

  open() {
    const g = this.game;
    this.input.hidden = false;
    this.root.classList.add('open');
    g.chatOpen = true;
    g.input.exitLock();
    setTimeout(() => this.input.focus(), 0);
  }

  close() {
    this.input.hidden = true;
    this.input.blur();
    this.root.classList.remove('open');
    this.game.chatOpen = false;
  }

  send() {
    const text = cleanText(this.input.value);
    this.input.value = '';
    if (!text) return;
    const g = this.game;
    if (text.startsWith('/')) return this.command(text);
    g.net?.sendChat(text);
    this.add(g.hero.name, text, { cls: g.hero.classId, me: true });
    this.myBubble = text; this.myBubbleT = 7;
    if (!g.net || g.net.peerCount() <= 1) this.system('Personne d’autre n’est connecté pour l’instant ; votre message flotte dans le vent.', 4);
  }

  command(text) {
    const g = this.game;
    const [cmd] = text.slice(1).split(/\s+/);
    if (cmd === 'aide' || cmd === 'help') this.system('Commandes : /salut, /assis, /qui');
    else if (cmd === 'salut') g.emote?.('wave');
    else if (cmd === 'assis') g.emote?.('sit');
    else if (cmd === 'qui') this.system(`${g.net ? g.net.peerCount() : 1} héros en ligne : ${[g.hero.name, ...[...g.remotePlayers.values()].map((r) => r.name)].join(', ')}`);
    else this.system('Commande inconnue. Tapez /aide.');
  }

  add(name, text, { cls, me = false } = {}) {
    const col = CLASSES[cls]?.color || 'var(--parch)';
    const line = h('div', { class: 'chat-line' }, h('b', { style: { color: col } }, name + (me ? ' (vous)' : '')), ' : ', text);
    this.push(line);
  }

  system(text, time) {
    this.push(h('div', { class: 'chat-line sys' }, text), time);
  }

  push(line, time = 14) {
    this.log.appendChild(line);
    while (this.log.children.length > 40) this.log.firstChild.remove();
    setTimeout(() => line.classList.add('old'), time * 1000);
  }

  update(dt) {
    if (this.myBubbleT > 0) { this.myBubbleT -= dt; if (this.myBubbleT <= 0) this.myBubble = ''; }
  }
}
