import { h } from './dom.js';
import { FALLBACK_LINES } from '../ai/Mind.js';
import { cleanText } from '../net/Net.js';

const GREET = {
  elder: ['Ah, vous voilà. La lumière vous a ramené jusqu’à moi.', 'Approchez, voyageur. Le vent m’a parlé de vous.'],
  smith: ['Hé ! Encore vivant ? Bien. Qu’est-ce que je forge pour toi ?', 'Pose ton arme là, on va voir ce qu’elle a dans le ventre.'],
  guard: ['Halte… Ah, c’est vous. Havrelumière est sous bonne garde.', 'Héros. Les routes sont dangereuses, mais vous l’êtes davantage.'],
  merchant: ['Bienvenue, bienvenue ! Élixirs, rumeurs, échos : tout s’échange ici.', 'Vous avez l’air assoiffé. Un élixir ?'],
  oracle: ['…je t’entendais venir. Tes pas ont un écho particulier.', 'Assieds-toi dans le cercle. Écoute.'],
  ondine: ['Mon petit ! Entrez, entrez, ça sent bon la menthe et la fleur d’aube.', 'Encore une égratignure ? Venez par ici.'],
  pip: ['Salut ! Tu veux voir mes cartes ? Elles sont presque finies !', 'Oh, un explorateur ! Tu as découvert quoi aujourd’hui ?'],
  rhea: ['Prêt à voler ? Le vent est bon aujourd’hui.', 'Toi ! Tu as l’air d’avoir des ailes dans le dos.'],
  bjorn: ['…Froid, hein ?', 'Assieds-toi près du feu. Les squelettes n’aiment pas la chaleur.'],
  neige: ['Que la flamme bleue vous garde, voyageur.', 'Le Sanctuaire a besoin de mains courageuses.'],
  kessa: ['Tiens, un nouveau ! Tu veux faire fortune ou juste te faire mordre par un squelette ?', 'L’ambre n’attend pas, partenaire.'],
  tarek: ['Asseyez-vous, voyageur. Le sable a une histoire à vous conter.', 'Ah… les étoiles m’avaient prévenu de votre venue.'],
};

// Fenêtre de dialogue avec les habitants (choix + conversation libre propulsée par Claude).
export class Dialogue {
  constructor(game) {
    this.game = game;
    this.el = null;
    const style = h('style', {}, `
      .dlg { position:absolute; left:50%; bottom:calc(96px + var(--safe-b)); transform:translateX(-50%); width:min(720px, calc(100% - 32px)); z-index:9; pointer-events:auto; display:grid; grid-template-columns:96px minmax(0,1fr); gap:14px; padding:16px 18px; }
      .dlg .por { width:96px; height:96px; border-radius:50%; border:2px solid var(--gold); background:radial-gradient(circle at 50% 35%, #3d3266, #15112a); overflow:hidden; box-shadow:0 0 18px rgba(242,196,109,.35); }
      .dlg .por img { width:100%; height:100%; object-fit:cover; }
      .dlg .who { font-family:var(--font-display); font-size:22px; color:var(--gold-hi); line-height:1.1; }
      .dlg .who small { font-family:var(--font-body); font-style:italic; font-size:14px; color:var(--muted); margin-left:8px; }
      .dlg .txt { font-family:var(--font-body); font-size:17.5px; line-height:1.5; margin:6px 0 10px; min-height:52px; color:var(--parch); max-height:34vh; overflow:auto; user-select:text; -webkit-user-select:text; }
      .dlg .txt .you { color:var(--muted); font-style:italic; display:block; margin-bottom:4px; font-size:15px; }
      .dlg .opts { display:flex; flex-direction:column; gap:5px; }
      .dlg .opt { text-align:left; background:rgba(242,196,109,.06); border:1px solid var(--line-soft); color:var(--parch); border-radius:4px; padding:7px 10px; font-size:15px; font-family:var(--font-ui); cursor:pointer; }
      .dlg .opt:hover, .dlg .opt:focus-visible { border-color:var(--gold); background:rgba(242,196,109,.12); outline:none; }
      .dlg .opt b { color:var(--gold-hi); }
      .dlg .opt.ai { border-color:rgba(198,155,255,.45); }
      .dlg .opt.ai::before { content:'✦ '; color:#c9b6ff; }
      .dlg .free { display:flex; gap:8px; margin-top:6px; }
      .dlg .free input { flex:1; min-width:0; background:rgba(0,0,0,.35); border:1px solid rgba(198,155,255,.5); color:var(--parch); border-radius:4px; padding:8px 10px; font-size:15px; font-family:var(--font-body); outline:none; user-select:text; -webkit-user-select:text; }
      .dlg .free input:focus { border-color:#c9b6ff; }
      .dlg .think { color:#c9b6ff; font-style:italic; }
      .dlg .note { font-size:12px; color:var(--muted); margin-top:6px; }
      @media (max-width:560px) { .dlg { grid-template-columns:56px minmax(0,1fr); padding:12px; bottom:calc(150px + var(--safe-b)); } .dlg .por { width:56px; height:56px; } .dlg .txt { font-size:15.5px; } }
    `);
    document.head.appendChild(style);
  }

  open(npc) {
    const g = this.game;
    this.close(true);
    this.npc = npc;
    npc.talking = true;
    g.dialogueOpen = true;
    g.input.exitLock();
    this.txt = h('div', { class: 'txt' });
    this.opts = h('div', { class: 'opts' });
    this.el = h('div', { class: 'dlg panel ornate', role: 'dialog', 'aria-label': 'Dialogue avec ' + npc.name },
      h('div', { class: 'por' }, h('img', { src: g.icons.portrait(npc.model), alt: '' })),
      h('div', {}, h('div', { class: 'who' }, npc.name, h('small', {}, npc.title)), this.txt, this.opts));
    g.ui.root.appendChild(this.el);
    npc.char.playAction('Interact', { timeScale: 1.2 });
    g.quests?.onEvent('talk', { npc: npc.id });
    const greet = GREET[npc.id];
    this.say(greet[Math.floor(Math.random() * greet.length)]);
    this.menu();
    g.audio?.play('ui');
    this.keyHandler = (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) { const b = this.opts.querySelectorAll('.opt')[n - 1]; if (b) { e.preventDefault(); b.click(); } }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  close(silent = false) {
    if (!this.el) return;
    this.el.remove(); this.el = null;
    if (this.npc) this.npc.talking = false;
    this.game.dialogueOpen = false;
    window.removeEventListener('keydown', this.keyHandler);
    if (!silent) this.game.audio?.play('ui');
  }

  say(text, you) {
    this.txt.innerHTML = '';
    if (you) this.txt.appendChild(h('span', { class: 'you' }, '« ' + you + ' »'));
    const span = h('span');
    this.txt.appendChild(span);
    // effet machine à écrire
    let i = 0;
    clearInterval(this.typer);
    this.typer = setInterval(() => { i += 2; span.textContent = text.slice(0, i); if (i >= text.length) clearInterval(this.typer); }, 16);
    this.npc.bubble = text.length > 90 ? text.slice(0, 88) + '…' : text;
    this.npc.bubbleT = 6;
  }

  option(label, fn, cls = '') {
    const idx = this.opts.children.length + 1;
    const b = h('button', { class: 'opt ' + cls, html: `<span style="color:var(--muted);margin-right:6px">${idx}.</span>${label}` });
    b.addEventListener('click', () => { this.game.audio?.play('select'); fn(); });
    this.opts.appendChild(b);
    return b;
  }

  menu() {
    const g = this.game, n = this.npc, q = g.quests;
    this.opts.innerHTML = '';
    const ready = q.readyFor(n.id);
    if (ready) this.option(`Rendre la quête <b>« ${esc(ready.title)} »</b>`, () => {
      q.complete(ready);
      this.say(ready.farewell || (n.id === 'elder' ? 'Vous avez fait plus que je n’osais espérer. La lumière vous le rendra.' : 'Bien joué. Voilà ce qui te revient.'));
      this.menu();
    });
    const main = q.mainFor(n.id);
    if (main && !q.active.some((x) => x.id === main.id)) this.option(`Quête : <b>« ${esc(main.title)} »</b>`, () => this.offer(main));
    for (const side of q.sidesFor(n.id)) this.option(`Quête : <b>« ${esc(side.title)} »</b>`, () => this.offer(side));
    if (n.id === 'smith') this.smithOptions();
    if (n.id === 'merchant') this.merchantOptions();
    if (n.id === 'oracle') this.option('Écouter l’Oracle — <b>recevoir une quête unique</b>', () => this.oracleQuest(), g.mind?.available() ? 'ai' : '');
    if (g.mind?.available()) this.option('Parler librement…', () => this.freeTalk(), 'ai');
    else this.option('Demander un conseil', () => { const l = FALLBACK_LINES[n.id]; this.say(l[Math.floor(Math.random() * l.length)]); });
    this.option('Au revoir', () => this.close());
  }

  offer(def) {
    const g = this.game;
    this.say(def.desc);
    this.opts.innerHTML = '';
    this.option('<b>Accepter</b>', () => {
      const q = g.quests.instantiate(def);
      g.quests.add(q);
      this.say(this.npc.id === 'elder' ? 'Que la lumière guide vos pas.' : this.npc.id === 'guard' ? 'Pour Havrelumière !' : 'À plus tard, alors.');
      this.menu();
    });
    this.option('Plus tard', () => this.menu());
  }

  smithOptions() {
    const g = this.game, hero = g.hero;
    const w = hero.equip.weapon;
    if (w) {
      const lvl = w.upg || 0;
      const cost = 30 + hero.level * 12 + lvl * 45;
      if (lvl < 10) this.option(`Améliorer <b>${esc(w.name)}</b> (+${lvl + 1}) — <span class="gold">${cost} or</span>`, () => {
        if (hero.gold < cost) { this.say(`Il te manque ${cost - hero.gold} pièces. Reviens avec de quoi payer le charbon.`); return; }
        hero.gold -= cost;
        w.upg = lvl + 1;
        w.stats.atk = Math.round(w.stats.atk * 1.1 + 2);
        w.name = w.name.replace(/ \+\d+$/, '') + ' +' + w.upg;
        hero.recompute();
        g.audio?.play('block');
        g.fx.burst(this.npc.position.clone().setY(this.npc.position.y + 1.5), '#ffb347', { count: 30, speed: 6, size: 0.3, life: 0.6, gravity: 9 });
        this.say(['Clang ! Voilà qui coupera mieux.', 'Trempée dans l’eau du lac. Elle chante maintenant.', 'Une arme digne d’un héros. Ou presque.'][Math.floor(Math.random() * 3)]);
        g.save?.soon();
        this.menu();
      });
    }
    const commons = hero.inventory.filter((it) => it.kind === 'gear' && it.rarity === 0 && !hero.isUpgrade(it));
    if (commons.length) this.option(`Vendre les ${commons.length} objets communs inutiles — <span class="gold">${commons.reduce((s, it) => s + Math.round(it.value * 0.5), 0)} or</span>`, () => {
      let total = 0;
      for (const it of commons) total += hero.sellItem(it.id);
      g.audio?.play('coin');
      this.say(`Marché conclu : ${total} pièces. Ces squelettes ont bon goût en ferraille.`);
      g.save?.soon();
      this.menu();
    });
    this.option('Ouvrir mon sac (vendre au détail)', () => { this.close(true); g.windows.open('inventory'); });
  }

  merchantOptions() {
    const g = this.game, hero = g.hero;
    const buy = (type, price, label) => this.option(`Acheter ${label} — <span class="gold">${price} or</span> (vous en avez ${hero.potions[type] || 0})`, () => {
      if (hero.gold < price) { this.say('Ah… il vous manque quelques pièces. Les squelettes en laissent tomber, vous savez.'); return; }
      hero.gold -= price;
      hero.potions[type] = (hero.potions[type] || 0) + 1;
      g.audio?.play('coin');
      this.say(type === 'hp' ? 'Rouge comme l’aube. Buvez-le d’un trait (touche R).' : 'Bleu comme l’éther. Parfait pour les runes.');
      g.save?.soon();
      this.menu();
    });
    buy('hp', 15, 'un élixir de vie');
    buy('mp', 15, 'un élixir d’éther');
  }

  async oracleQuest() {
    const g = this.game;
    if (g.quests.active.filter((x) => x.ai).length >= 2) { this.say('Tu portes déjà deux de mes murmures. Accomplis-les d’abord.'); return; }
    this.opts.innerHTML = '';
    this.txt.innerHTML = '';
    this.txt.appendChild(h('span', { class: 'think' }, g.mind?.available() ? 'L’Oracle écoute les échos du monde…' : 'L’Oracle ferme les yeux…'));
    g.audio?.play('oracle');
    g.fx.runeCircle(this.npc.position, '#c9b6ff', { radius: 2.4, life: 2.5, spin: 2 });
    try {
      const q = await g.mind.generateQuest();
      if (!this.el) return;
      this.say(q.desc);
      this.opts.innerHTML = '';
      const obj = h('div', { class: 'note' }, q.objectives.map((o) => '◆ ' + o.text).join('   '));
      this.opts.appendChild(obj);
      this.option(`<b>Accepter « ${esc(q.title)} »</b> — ${q.rewards.xp} xp, ${q.rewards.gold} or`, () => { g.quests.add(q); this.say(q.farewell || 'Va.'); this.menu(); });
      this.option('Refuser', () => { this.say('Un autre écho viendra.'); this.menu(); });
    } catch (e) {
      if (!this.el) return;
      this.say(e?.code === 'rate_limited' ? 'Trop de voix à la fois… Reviens dans un moment.' : 'Les échos se brouillent. Reviens plus tard.');
      this.menu();
    }
  }

  freeTalk() {
    const g = this.game, n = this.npc;
    this.opts.innerHTML = '';
    const input = h('input', { id: 'npc-say', maxlength: '200', placeholder: `Dire quelque chose à ${n.name}…`, autocomplete: 'off', spellcheck: 'false' });
    const send = h('button', { class: 'btn small' }, 'Dire');
    const box = h('div', { class: 'free' }, input, send);
    this.opts.appendChild(box);
    this.opts.appendChild(h('div', { class: 'note' }, `${n.name} répond grâce à Claude et se souvient de vos échanges.`));
    this.option('Retour', () => this.menu());
    const go = async () => {
      const line = cleanText(input.value);
      if (!line || g.mind.busy) return;
      input.value = '';
      input.disabled = true; send.disabled = true;
      this.txt.innerHTML = '';
      this.txt.appendChild(h('span', { class: 'you' }, '« ' + line + ' »'));
      const out = h('span', { class: 'think' }, '…');
      this.txt.appendChild(out);
      try {
        const text = await g.mind.chat(n.id, line, (t) => { out.className = ''; out.textContent = t; });
        out.className = ''; out.textContent = text;
        n.bubble = text.length > 90 ? text.slice(0, 88) + '…' : text; n.bubbleT = 6;
        n.char.playAction('Interact', { timeScale: 1.1 });
      } catch (e) {
        out.className = 'think';
        out.textContent = e?.code === 'rate_limited' ? `${n.name} reprend son souffle. Réessayez dans un moment.` : e?.code === 'refused' ? `${n.name} détourne le regard, sans répondre.` : (FALLBACK_LINES[n.id][0]);
        if (!g.mind.available()) { this.menu(); return; }
      } finally {
        if (this.el) { input.disabled = false; send.disabled = false; input.focus(); }
      }
    };
    send.addEventListener('click', go);
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.code === 'Enter') go(); if (e.code === 'Escape') this.menu(); });
    setTimeout(() => input.focus(), 30);
  }

  update() {
    if (!this.el || !this.npc) return;
    const p = this.game.player.position;
    if (Math.hypot(p.x - this.npc.spot.x, p.z - this.npc.spot.z) > 7) this.close();
  }
}

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
