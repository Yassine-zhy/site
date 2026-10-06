import * as THREE from 'three';
import { recognize, glyphPath } from './Recognizer.js';
import { h } from '../ui/dom.js';
import { hitRadius, aimPoint } from './Abilities.js';

// Les six runes d'Aetheria.
export const RUNE_SPELLS = {
  ignis: { name: 'Ignis', shape: 'triangle', color: '#ff8a3d', mana: 18, cd: 4, desc: 'Boule de feu qui explose (4 m).' },
  fulgur: { name: 'Fulgur', shape: 'éclair', color: '#a8d8ff', mana: 22, cd: 6, desc: 'Foudre qui rebondit sur 5 ennemis.' },
  vita: { name: 'Vita', shape: 'cercle', color: '#7ee0a8', mana: 25, cd: 10, desc: 'Soigne le héros et les alliés proches.' },
  aegis: { name: 'Aegis', shape: 'V', color: '#9be8ff', mana: 20, cd: 12, desc: 'Bouclier absorbant pendant 8 s.' },
  ventus: { name: 'Ventus', shape: 'spirale', color: '#d9f3ff', mana: 15, cd: 7, desc: 'Tornade : propulse dans les airs, repousse.' },
  lux: { name: 'Lux', shape: 'trait vertical', color: '#ffe3a3', mana: 30, cd: 8, desc: 'Rayon sacré ; nourrit les Phares proches.' },
};

const QUALITY_LABELS = [[0.85, 'Parfait !'], [0.65, 'Excellent'], [0.5, 'Bien tracé'], [0, 'Tracé fragile']];

export class Runes {
  constructor(game) {
    this.game = game;
    this.drawing = false;
    this.points = [];
    this.cursor = { x: 0, y: 0 };
    this.cds = {};
    this.gcd = 0;
    const canvas = h('canvas', { class: 'rune-canvas', style: { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '5' } });
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hint = h('div', { class: 'rune-hint', style: { position: 'absolute', left: '50%', bottom: '120px', transform: 'translateX(-50%)', zIndex: '6', pointerEvents: 'none', textAlign: 'center', fontFamily: 'var(--font-body)', fontStyle: 'italic', color: '#e2ccff', textShadow: '0 2px 8px #000', fontSize: '17px' } });
    this.hint.hidden = true;
    this.result = h('div', { style: { position: 'absolute', left: '50%', top: '42%', transform: 'translate(-50%,-50%)', zIndex: '6', pointerEvents: 'none', textAlign: 'center' } });
    game.ui.root.append(canvas, this.hint, this.result);
    this.resize();
    addEventListener('resize', () => this.resize());
    this.sparks = [];
    this.fadeT = 0;
    this.touchMode = false;
    // dessin tactile / souris libre sur la couche
    this.overlay = h('div', { class: 'rune-overlay interactive', style: { position: 'absolute', inset: '0', zIndex: '4', touchAction: 'none' } });
    this.overlay.hidden = true;
    game.ui.root.appendChild(this.overlay);
    const pt = (e) => ({ x: e.clientX, y: e.clientY });
    this.overlay.addEventListener('pointerdown', (e) => { this.overlay.setPointerCapture(e.pointerId); this.points = [pt(e)]; this.pointerDown = true; });
    this.overlay.addEventListener('pointermove', (e) => { if (this.pointerDown) this.addPoint(pt(e)); });
    this.overlay.addEventListener('pointerup', () => { if (this.pointerDown) { this.pointerDown = false; this.finish(); } });
    // début / fin du tracé dès l'évènement (pas d'attente de l'image suivante)
    game.input.on('rightdown', (e) => {
      if (!game.inGame || game.windowOpen || game.dialogueOpen || game.chatOpen || this.drawing) return;
      this.begin('right', e);
    });
    game.input.on('rightup', () => { if (this.drawing && this.via === 'right') this.finish(); });
    // capture fine du tracé à chaque mouvement de souris (indépendant de la cadence d'affichage)
    game.input.on('mousemove', (e, locked) => {
      if (!this.drawing || this.via === 'touch') return;
      if (locked) {
        this.cursor.x = Math.max(0, Math.min(innerWidth, this.cursor.x + e.movementX * 1.1));
        this.cursor.y = Math.max(0, Math.min(innerHeight, this.cursor.y + e.movementY * 1.1));
      } else { this.cursor.x = e.clientX; this.cursor.y = e.clientY; }
      this.addPoint({ x: this.cursor.x, y: this.cursor.y });
    });
  }

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = innerWidth * dpr; this.canvas.height = innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  legend() {
    return Object.entries(RUNE_SPELLS).map(([id, r]) => {
      const svg = `<svg viewBox="0 0 24 24" width="34" height="34" style="flex:none;stroke:${r.color};fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 4px ${r.color})"><path d="${glyphPath(id)}"/></svg>`;
      return h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', margin: '5px 0', fontSize: '13.5px' }, html: `${svg}<div><b class="sc" style="color:${r.color}">${r.name}</b> · ${r.shape} — ${r.desc} <span style="color:var(--muted)">(${r.mana} éther)</span></div>` });
    });
  }

  // ------------------------------------------------------------------ entrée
  handleInput(input) {
    const g = this.game;
    if (this.drawing) {
      // fin du tracé : relâcher le clic droit, X, ou clic gauche
      if (this.via === 'key' && (input.pressed('rune') || input.mouse.clicked)) this.finish();
      else if (performance.now() - this.startT > 3200) this.finish();
      return;
    }
    if (input.pressed('rune')) { if (input.isTouch) this.beginTouch(); else this.begin('key'); }
    void g;
  }

  canCast() {
    const g = this.game;
    if (g.player.dead) return false;
    if (this.gcd > 0) return false;
    return true;
  }

  begin(via, ev) {
    if (!this.canCast()) return;
    const g = this.game;
    this.drawing = true; this.via = via;
    this.points = [];
    this.startT = performance.now();
    if (g.input.locked) { this.cursor.x = innerWidth / 2; this.cursor.y = innerHeight / 2; this.useDeltas = true; }
    else { this.cursor.x = ev ? ev.clientX : g.input.mouse.x; this.cursor.y = ev ? ev.clientY : g.input.mouse.y; this.useDeltas = false; }
    this.points.push({ ...this.cursor });
    this.hint.textContent = 'Tracez la rune d’un seul geste…';
    this.hint.hidden = false;
    g.player.char.playLoop('Spellcasting', { full: false });
    g.player.attackSlow = 0.35;
    g.audio?.play('rune');
    this.fadeT = 0;
  }

  beginTouch() {
    if (!this.canCast()) return;
    const g = this.game;
    this.drawing = true; this.via = 'touch'; this.touchMode = true;
    this.points = [];
    this.startT = performance.now() + 4000; // plus de temps au doigt
    this.overlay.hidden = false;
    this.hint.textContent = 'Dessinez la rune avec le doigt';
    this.hint.hidden = false;
    g.player.char.playLoop('Spellcasting', { full: false });
    g.player.attackSlow = 0.35;
  }

  // les déplacements de souris pendant le tracé ne tournent pas la caméra
  feedLook() {}

  addPoint(p) {
    const last = this.points[this.points.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 2) return;
    this.points.push(p);
    if (this.points.length % 3 === 0) this.game.audio?.play('rune');
    for (let i = 0; i < 2; i++) this.sparks.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60 - 20, t: 0, life: 0.5 + Math.random() * 0.4 });
  }

  finish() {
    const g = this.game;
    this.drawing = false;
    this.overlay.hidden = true;
    this.hint.hidden = true;
    g.player.attackSlow = 0;
    g.player.char.stopAction(0.15);
    const r = recognize(this.points);
    this.fadeT = 0.6;
    if (!r || r.score < 0.38) { this.fail(r ? 'La rune se brise…' : 'Tracé trop court'); return; }
    const spell = RUNE_SPELLS[r.name];
    if ((this.cds[r.name] || 0) > 0) { this.fail(`${spell.name} se recharge (${Math.ceil(this.cds[r.name])} s)`); return; }
    if (g.hero.mp < spell.mana) { this.fail('Pas assez d’éther'); return; }
    g.hero.mp -= spell.mana;
    const q = Math.min(1, Math.max(0, (r.score - 0.38) / 0.5));
    const power = (0.7 + 0.6 * q) * (g.classDef.runeBonus || 1) * (1 + (g.hero.stats.rune || 0) / 100);
    this.cds[r.name] = spell.cd * g.cdMult();
    this.gcd = 1.0;
    g.cooldowns.rune = 1.0; g.runeCd = 1.0;
    g.hero.runesCast++;
    g.hero.bestRune = Math.max(g.hero.bestRune || 0, Math.round(r.score * 100));
    const label = QUALITY_LABELS.find(([s]) => r.score >= s)[1];
    this.showResult(spell, r.score, label);
    g.audio?.play('runeok');
    const data = this.cast(r.name, power);
    this.visual(r.name, { ...data, power }, g.player);
    g.net?.sendAction('rune:' + r.name, { ...data, power });
    g.quests?.onEvent('rune', { name: r.name, score: r.score });
    g.lastCombat = g.elapsed;
  }

  fail(msg) {
    const g = this.game;
    g.audio?.play('runefail');
    this.result.innerHTML = '';
    this.result.appendChild(h('div', { style: { fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: '20px', color: '#c9b6ff', textShadow: '0 2px 10px #000' } }, msg));
    clearTimeout(this.resT);
    this.resT = setTimeout(() => { this.result.innerHTML = ''; }, 1200);
    g.fx.burst(g.player.position.clone().setY(g.player.position.y + 1.6), '#8e7cc3', { count: 14, speed: 3, size: 0.3, life: 0.6 });
  }

  showResult(spell, score, label) {
    this.result.innerHTML = '';
    this.result.appendChild(h('div', {}, h('div', { style: { fontFamily: 'var(--font-display)', fontSize: '54px', color: spell.color, textShadow: `0 0 24px ${spell.color}, 0 3px 0 #2a1d48`, animation: 'annin 0.5s cubic-bezier(.2,1.4,.4,1)' } }, spell.name),
      h('div', { style: { fontFamily: 'var(--font-sc)', letterSpacing: '0.12em', fontSize: '15px', color: '#f1e6cc', textShadow: '0 2px 6px #000' } }, `${label} · ${Math.round(score * 100)} %`)));
    clearTimeout(this.resT);
    this.resT = setTimeout(() => { this.result.innerHTML = ''; }, 1300);
  }

  // ------------------------------------------------------------------ effets des sorts (logique locale)
  cast(name, power) {
    const g = this.game, a = g.player, hero = g.hero;
    const c = { game: g, actor: a, classId: hero.classId, isLocal: true };
    switch (name) {
      case 'ignis': {
        g.aimFacing();
        const to = aimPoint(c, 34).add(new THREE.Vector3(0, 1.0, 0));
        g.schedule(0.15, () => {
          const f = new THREE.Vector3(a.position.x + Math.sin(a.facing), a.position.y + 1.6, a.position.z + Math.cos(a.facing));
          g.projectiles.spawn({ x: f.x, y: f.y, z: f.z, dir: to.clone().sub(f), speed: 30, range: 40, color: '#ff8a3d', size: 0.6, kind: 'orb', team: 'player', homing: g.target ? 3 : 0, target: g.target,
            onHit: (e, p) => this.ignisBoom(p, power), onExpire: (p) => this.ignisBoom(p, power) });
        });
        return { to: [to.x, to.y, to.z] };
      }
      case 'fulgur': {
        const chain = [];
        let from = a.position.clone().setY(a.position.y + 1.6);
        let pool = g.enemies.hittable().filter((e) => Math.hypot(e.position.x - a.position.x, e.position.z - a.position.z) < 20);
        let cur = g.target && pool.includes(g.target) ? g.target : pool.sort((p, q) => Math.hypot(p.position.x - a.position.x, p.position.z - a.position.z) - Math.hypot(q.position.x - a.position.x, q.position.z - a.position.z))[0];
        let mult = 1.5 * power;
        for (let i = 0; i < 5 && cur; i++) {
          const to = cur.position.clone().setY(cur.position.y + 1.3);
          chain.push([from.x, from.y, from.z, to.x, to.y, to.z]);
          const tgt = cur;
          g.schedule(i * 0.08, () => g.enemies.damage(tgt, mult, a, { stun: 0.4, kind: 'spell' }));
          pool = pool.filter((e) => e !== cur);
          from = to;
          const prev = cur;
          cur = pool.filter((e) => Math.hypot(e.position.x - prev.position.x, e.position.z - prev.position.z) < 10).sort((p, q) => Math.hypot(p.position.x - prev.position.x, p.position.z - prev.position.z) - Math.hypot(q.position.x - prev.position.x, q.position.z - prev.position.z))[0];
          mult *= 0.85;
        }
        if (!chain.length) { const f = a.position; chain.push([f.x, f.y + 1.6, f.z, f.x + Math.sin(a.facing) * 10, f.y + 1, f.z + Math.cos(a.facing) * 10]); }
        return { chain };
      }
      case 'vita': {
        const amount = Math.round(hero.stats.hp * 0.3 * power);
        g.healSelf(amount);
        hero.addBuff('vita', 6, {}, { hot: hero.stats.hp * 0.03 * power, icon: 'potion', label: 'Vita' });
        return { heal: amount, r: 10 };
      }
      case 'aegis': {
        const absorb = Math.round(hero.stats.hp * 0.3 * power);
        hero.addBuff('aegis', 8, {}, { absorb, icon: 'shield', label: 'Aegis' });
        return { absorb };
      }
      case 'ventus': {
        a.launch(17 + 8 * power, 2);
        a.gliding = false;
        hitRadius(c, a.position, 6.5, 0.7 * power, { knock: 5 });
        g.quests?.onEvent('ventus', {});
        return {};
      }
      case 'lux': {
        g.aimFacing();
        const from = a.position.clone().setY(a.position.y + 1.5);
        const dir = new THREE.Vector3(Math.sin(a.facing), 0, Math.cos(a.facing));
        const len = 26;
        for (const e of g.enemies.hittable()) {
          const v = e.position.clone().sub(a.position);
          const t = v.dot(dir);
          if (t < 0 || t > len) continue;
          const perp = Math.hypot(v.x - dir.x * t, v.z - dir.z * t);
          if (perp < 1.6 + e.radius) g.enemies.damage(e, 2.6 * power, a, { vsUndead: true, kind: 'spell' });
        }
        g.worldState?.channelLight(a.position, 0.06 * power);
        return { from: [from.x, from.y, from.z], dir: [dir.x, dir.z], len };
      }
    }
    return {};
  }

  ignisBoom(p, power) {
    const g = this.game;
    hitRadius({ game: g, actor: g.player, classId: g.hero.classId }, p, 4.2, 2.2 * power, { knock: 2, kind: 'spell' });
    g.netFx('ignis', { p: [p.x, p.y, p.z] });
  }

  // ------------------------------------------------------------------ visuels (local et autres joueurs)
  visual(name, d, actor) {
    const g = this.game, fx = g.fx;
    const color = RUNE_SPELLS[name].color;
    fx.runeCircle(actor.position, color, { radius: 2.4, life: 1.1, spin: 3 });
    fx.burst(actor.position.clone().setY(actor.position.y + 1.6), color, { count: 24, speed: 4, size: 0.35, life: 0.7 });
    switch (name) {
      case 'ignis': actor.char.playAction('Spellcast_Shoot', { timeScale: 1.6 }); g.audio?.play('cast', actor.position); break;
      case 'fulgur':
        actor.char.playAction('Spellcast_Shoot', { timeScale: 1.8 });
        (d.chain || []).forEach((c, i) => g.schedule(i * 0.08, () => { fx.lightning(new THREE.Vector3(c[0], c[1], c[2]), new THREE.Vector3(c[3], c[4], c[5]), color, { jitter: 1.4 }); g.audio?.play('zap', new THREE.Vector3(c[3], c[4], c[5])); }));
        break;
      case 'vita':
        actor.char.playAction('Spellcast_Raise', { timeScale: 2 });
        fx.ring(actor.position, color, { to: d.r || 10, life: 0.9 });
        fx.aura(actor, color, { duration: 1.6, rate: 50 });
        g.audio?.play('heal', actor.position);
        if (actor !== g.player && g.player && Math.hypot(actor.position.x - g.player.position.x, actor.position.z - g.player.position.z) < (d.r || 10) && !g.player.dead) {
          g.healSelf(Math.round(g.hero.stats.hp * 0.18 * (d.power || 1)));
          g.ui.toast('Un allié vous soigne avec <b>Vita</b>.', { time: 2 });
        }
        break;
      case 'aegis': actor.char.playAction('Block', { timeScale: 1.5 }); fx.bubble(actor, color, 8, 1.8); g.audio?.play('shield', actor.position); break;
      case 'ventus':
        actor.char.playAction('Jump_Full_Short', { full: true, timeScale: 0.8 });
        for (let i = 0; i < 8; i++) g.schedule(i * 0.06, () => { fx.ring(actor.position, color, { from: 1, to: 3 + i * 0.6, life: 0.5, y: i * 0.6 }); fx.dust(actor.position, { count: 4, color: '#e8eef6', size: 1.2, speed: 6 }); });
        g.audio?.play('storm', actor.position);
        break;
      case 'lux': {
        actor.char.playAction('Spellcast_Long', { timeScale: 2.2 });
        const from = new THREE.Vector3(...(d.from || [actor.position.x, actor.position.y + 1.5, actor.position.z]));
        const dir = new THREE.Vector3(d.dir?.[0] ?? Math.sin(actor.facing), 0, d.dir?.[1] ?? Math.cos(actor.facing));
        const len = d.len || 26;
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, len, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        beam.position.copy(from).addScaledVector(dir, len / 2);
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        fx.spawnMesh(beam, 0.6, (e, t) => { beam.material.opacity = 0.9 * (1 - t); beam.scale.set(1 + t * 2, 1, 1 + t * 2); }).dispose = () => beam.geometry.dispose();
        for (let k = 0; k < 10; k++) fx.burst(from.clone().addScaledVector(dir, k * len / 10), color, { count: 4, speed: 2, size: 0.4, life: 0.6, gravity: -1 });
        g.audio?.play('holy', actor.position);
        break;
      }
    }
  }

  playFx(type, d) {
    if (type === 'ignis') {
      const p = new THREE.Vector3(...d.p);
      this.game.fx.explosion(p, '#ff8a3d', 4);
      this.game.audio?.play('boom', p);
      this.game.shakeAt(p, 0.5);
    }
  }

  // ------------------------------------------------------------------ rendu du tracé
  update(dt) {
    for (const k of Object.keys(this.cds)) this.cds[k] = Math.max(0, this.cds[k] - dt);
    this.gcd = Math.max(0, this.gcd - dt);
    // soins dans le temps
    const vita = this.game.hero?.hasBuff('vita');
    if (vita && vita.hot) this.game.healSelf(vita.hot * dt, false);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (!this.drawing && this.fadeT <= 0 && !this.sparks.length) return;
    this.fadeT = Math.max(0, this.fadeT - dt);
    const alpha = this.drawing ? 1 : this.fadeT / 0.6;
    if (this.drawing) {
      // voile léger
      ctx.fillStyle = 'rgba(20, 10, 40, 0.18)';
      ctx.fillRect(0, 0, innerWidth, innerHeight);
    }
    const pts = this.points;
    if (pts.length > 1) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [w, col] of [[16, `rgba(160, 100, 255, ${0.25 * alpha})`], [8, `rgba(200, 160, 255, ${0.6 * alpha})`], [3, `rgba(255, 245, 255, ${alpha})`]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }
    if (this.drawing && this.useDeltas) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(this.cursor.x, this.cursor.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 40 * dt;
      if (s.t > s.life) { this.sparks.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(230, 210, 255, ${1 - s.t / s.life})`;
      ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    }
  }
}
