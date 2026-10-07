import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { CITADEL, Citadel, platformAt } from '../world/Citadel.js';
import { CLASSES, VILLAGE } from '../config.js';
import { generateItem } from './Items.js';
import { escapeHtml } from '../net/Net.js';
import { VirtualLight } from '../world/Lights.js';

export const EXP_PORTAL = { x: 13, z: -25 };

// Expéditions : un groupe privé (1 à 4 héros) rejoint par code part affronter des boss
// dans la Citadelle des Ombres. L'hôte du groupe simule tout et publie l'avancement.
export const EXPEDITIONS = {
  citadelle: {
    name: 'La Citadelle des Ombres',
    desc: 'Trois gardiens, trois épreuves : franchissez la Porte, purifiez la Nef et terrassez l’Avatar de la Brume.',
    stages: [
      { id: 'gardes', text: 'Vaincre les gardes de la Porte des Ombres', kind: 'kills', count: 10, platform: 1, guards: ['warrior', 'minion', 'rogue', 'minion'], max: 7 },
      { id: 'sentinelle', text: 'Terrasser la Sentinelle d’Os', kind: 'boss', boss: 'boss_sentinelle', platform: 1 },
      { id: 'autels', text: 'Purifier les 3 autels de la Nef (touche E)', kind: 'altars', count: 3, platform: 2, guards: ['mage', 'warrior', 'minion'], max: 5 },
      { id: 'liche', text: 'Vaincre Morvhain, la Liche', kind: 'boss', boss: 'boss_liche', platform: 2 },
      { id: 'braseros', text: 'Allumer les 4 braseros du Cœur (touche E)', kind: 'braziers', count: 4, platform: 3, guards: ['frostguard', 'amberwarrior', 'mage', 'frostling'], max: 6 },
      { id: 'avatar', text: 'Terrasser l’Avatar de la Brume', kind: 'boss', boss: 'boss_avatar', platform: 3 },
    ],
  },
  arene: {
    name: 'L’Arène des Champions',
    desc: 'Les trois seigneurs du monde, l’un après l’autre, dans l’arène. Le chronomètre tourne.',
    stages: [
      { id: 'colosse', text: 'Vaincre le Colosse d’Ambre', kind: 'boss', boss: 'boss_colosse', platform: 4 },
      { id: 'reine', text: 'Vaincre la Reine de Givre', kind: 'boss', boss: 'boss_reine', platform: 4 },
      { id: 'roi', text: 'Vaincre le Roi Sans Lumière', kind: 'boss', boss: 'boss', platform: 4 },
    ],
  },
};

// barrières ouvertes selon l'avancement (pont i : [Seuil→Porte, Porte→Nef, Nef→Cœur, Seuil→Arène])
function barriersFor(ex, stage) {
  if (ex === 'arene') return [false, false, false, true];
  return [true, stage >= 2, stage >= 4, false];
}

export class Expedition {
  constructor(game) {
    this.game = game;
    this.citadel = null;
    this.ready = false;
    this.state = this.freshState();
    this.lastPublic = null;
    this.doneShown = false;
    this.guardT = 0;
    this.buildVillagePortal();
  }

  // le Portail des Expéditions, sur la place de Havrelumière
  buildVillagePortal() {
    const g = this.game, { x, z } = EXP_PORTAL;
    const y = g.world.terrain.heightAt(x, z) ?? 14;
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.rotation.y = Math.atan2(-x, -z);
    const stone = new THREE.MeshStandardMaterial({ color: '#8f8778', roughness: 0.85, flatShading: true });
    for (const s of [-1, 1]) {
      const p = g.assets.prop('pillar_decorated');
      p.scale.set(0.9, 1.3, 0.9); p.position.set(s * 3.1, 0, 0);
      grp.add(p);
      g.world.colliders.addCircle(x + Math.cos(grp.rotation.y) * s * 3.1, z - Math.sin(grp.rotation.y) * s * 3.1, 0.8, y - 1, y + 6, 'monument');
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.7, 1.1), stone);
    lintel.position.y = 6.2; lintel.castShadow = true;
    grp.add(lintel);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.14, 8, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#c69bff').multiplyScalar(2.2), toneMapped: false }));
    ring.position.y = 3.1;
    grp.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40), new THREE.MeshBasicMaterial({ color: '#9a6bff', transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    disc.position.y = 3.1;
    grp.add(disc);
    const l = new VirtualLight('#b48cff', 8, 18, 1.6);
    l.position.y = 3.2; grp.add(l);
    g.scene.add(grp);
    this.portal = { x, y, z, ring, disc };
  }

  freshState() { return { ph: 'none', ex: 'citadelle', sg: 0, n: 0, a: [0, 0, 0], b: [0, 0, 0, 0], lv: 10, dif: 0, t0: 0, t1: 0, started: false }; }

  get inParty() { return !!this.game.net?.party; }
  get active() { return this.inParty && (this.state.ph === 'run' || this.state.ph === 'done'); }
  get isHost() { return this.game.enemies.isHost; }
  get def() { return EXPEDITIONS[this.state.ex] || EXPEDITIONS.citadelle; }
  get stage() { return this.def.stages[this.state.sg] || null; }

  ensureCitadel() {
    if (!this.citadel) this.citadel = new Citadel(this.game.world, this.game.assets);
    return this.citadel;
  }

  // ------------------------------------------------------------------ groupe
  async host() {
    const code = Math.random().toString(36).slice(2, 7).replace(/[^a-z0-9]/g, 'x');
    const r = await this.game.net.joinParty(code, true);
    if (!r.ok) { this.game.ui.toast(r.why, { color: '#ff8a72' }); return; }
    this.state = { ...this.freshState(), ph: 'lobby' };
    this.ready = true;
    this.game.ui.toast(`Expédition créée. Code : <b>${code.toUpperCase()}</b> — donnez-le à vos amis.`, { time: 6 });
    this.game.audio?.play('quest');
    this.refreshWindow();
  }

  async join(code) {
    const r = await this.game.net.joinParty(code, false);
    if (!r.ok) { this.game.ui.toast(r.why, { color: '#ff8a72' }); return; }
    this.state = { ...this.freshState(), ph: 'lobby' };
    this.ready = false;
    this.game.ui.toast(`Vous rejoignez l’expédition <b>${escapeHtml(String(code).toUpperCase())}</b>…`, { time: 3 });
    this.refreshWindow();
  }

  leave() {
    const g = this.game, wasIn = this.active;
    this.left();
    g.net?.leaveParty();
    if (wasIn) this.returnToWorld();
    this.refreshWindow();
  }

  // nettoyage local (appelé aussi quand le groupe est complet)
  left() {
    this.state = this.freshState();
    this.ready = false; this.doneShown = false;
    this.game.world.sky.mood = 0;
  }

  returnToWorld() {
    const g = this.game;
    const sp = g.respawnPoint(true);
    g.ui.fade?.(0.35);
    g.schedule(0.3, () => { g.player.spawn(sp.x, sp.y + 0.3, sp.z, sp.facing); g.rig.yaw = sp.facing + Math.PI; g.rig.initialized = false; g.ui.announce('Havrelumière', 'De retour dans l’archipel', 2.5); });
  }

  // ------------------------------------------------------------------ hôte
  launch(ex = 'citadelle', dif = 0) {
    const g = this.game;
    if (!this.isHost) return;
    const members = g.net.partyMembers();
    const lv = Math.max(10, ...members.map((m) => m.l || 1)) + dif * 3;
    this.state = { ...this.freshState(), ph: 'run', ex, lv, dif, t0: Date.now(), sg: 0 };
    this.stageStarted = false;
    this.enterCitadel();
  }

  publicState() {
    const s = this.state;
    return { ph: s.ph, ex: s.ex, sg: s.sg, n: s.n, a: s.a, b: s.b, lv: s.lv, dif: s.dif, t0: s.t0, t1: s.t1 };
  }

  // évènement envoyé par un coéquipier (autel, brasero…)
  hostEvent(type, data, from) {
    if (type === 'obj') this.activateObject(data | 0);
  }

  activateObject(idx) {
    const s = this.state, st = this.stage;
    if (!st) return;
    if (st.kind === 'altars' && idx >= 0 && idx < 3 && !s.a[idx]) { s.a[idx] = 1; s.n++; this.game.enemies.fx('expObj', this.objPos('altar', idx), { k: 'altar' }); }
    if (st.kind === 'braziers' && idx >= 0 && idx < 4 && !s.b[idx]) { s.b[idx] = 1; s.n++; this.game.enemies.fx('expObj', this.objPos('brazier', idx), { k: 'brazier' }); }
  }

  objPos(kind, i) {
    const c = this.ensureCitadel();
    const o = kind === 'altar' ? c.altars[i] : c.braziers[i];
    return new THREE.Vector3(o.x, o.y, o.z);
  }

  onKill(k) { if (this.active && this.isHost && this.stage?.kind === 'kills' && k.exp) this.state.n++; }
  onBossDown(e) { if (this.isHost && this.stage?.kind === 'boss' && e.type === this.stage.boss) this.bossDead = true; }

  hostUpdate(dt) {
    const g = this.game, s = this.state, st = this.stage;
    if (s.ph !== 'run' || !st) return;
    const P = CITADEL.platforms[st.platform];
    const players = g.playerTargets();
    if (!this.stageStarted) {
      this.stageStarted = true; this.bossDead = false; s.n = 0;
      if (st.kind === 'boss') {
        const near = players.length;
        g.schedule(2.5, () => { if (this.state.ph === 'run' && this.stage === st) this.bossRef = g.boss.spawnBoss(st.boss, P.x, P.z, s.lv + 2, { players: near, home: { x: P.x, z: P.z } }); });
      }
      if (st.guards) this.spawnGuards(st, P, st.kind === 'kills' ? st.max : 3);
      g.enemies.fx('expStage', new THREE.Vector3(P.x, P.y, P.z), { sg: s.sg, ex: s.ex });
    }
    // gardes qui reviennent pendant les épreuves d'autels / braseros
    if (st.guards && st.kind !== 'kills') {
      this.guardT -= dt;
      if (this.guardT <= 0) { this.guardT = 14; if (this.countExp() < st.max) this.spawnGuards(st, P, 2); }
    } else if (st.kind === 'kills' && this.countExp() < 2 && s.n < st.count) this.spawnGuards(st, P, Math.min(4, st.count - s.n));
    // fin d'épreuve
    let done = false;
    if (st.kind === 'kills') done = s.n >= st.count;
    else if (st.kind === 'altars' || st.kind === 'braziers') done = s.n >= st.count;
    else if (st.kind === 'boss') done = this.bossDead;
    if (done) {
      s.sg++; this.stageStarted = false; s.n = 0;
      if (s.sg >= this.def.stages.length) { s.ph = 'done'; s.t1 = Date.now(); }
      else g.enemies.fx('expNext', new THREE.Vector3(P.x, P.y, P.z), { sg: s.sg, ex: s.ex });
    }
  }

  countExp() { let n = 0; for (const e of this.game.enemies.map.values()) if (e.alive && e.exp) n++; return n; }

  spawnGuards(st, P, n) {
    const g = this.game;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * (P.r - 10);
      const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
      if (!g.world.terrain.isLand(x, z)) continue;
      const elite = Math.random() < 0.18;
      const e = g.enemies.spawn(st.guards[i % st.guards.length], this.state.lv, x, z, { elite, home: { x: P.x, z: P.z } });
      e.exp = true;
    }
  }

  // ------------------------------------------------------------------ tous les joueurs
  applyHostState(pt) {
    if (!pt || typeof pt !== 'object' || !this.inParty) return;
    const prev = this.state;
    const ph = ['lobby', 'run', 'done'].includes(pt.ph) ? pt.ph : 'lobby';
    this.state = { ...prev, ph, ex: EXPEDITIONS[pt.ex] ? pt.ex : 'citadelle', sg: pt.sg | 0, n: pt.n | 0, a: Array.isArray(pt.a) ? pt.a.slice(0, 3) : [0, 0, 0], b: Array.isArray(pt.b) ? pt.b.slice(0, 4) : [0, 0, 0, 0], lv: pt.lv | 0, dif: pt.dif | 0, t0: +pt.t0 || 0, t1: +pt.t1 || 0 };
    if (ph === 'run' && prev.ph !== 'run' && prev.ph !== 'done') this.enterCitadel();
    if (ph === 'lobby' && prev.ph === 'done') this.doneShown = false;
    this.refreshWindow(true);
  }

  enterCitadel() {
    const g = this.game;
    const c = this.ensureCitadel();
    g.world.sky.mood = 1;
    const P = CITADEL.platforms[this.state.ex === 'arene' ? 4 : 0];
    const spot = this.state.ex === 'arene' ? { x: P.x, z: P.z + P.r - 8 } : { x: P.x + 3, z: P.z + (Math.random() - 0.5) * 6 };
    g.ui.fade?.(0.4);
    g.schedule(0.35, () => {
      const y = g.world.terrain.heightAt(spot.x, spot.z) ?? P.y;
      g.player.spawn(spot.x, y + 0.3, spot.z, Math.PI / 2);
      g.rig.yaw = -Math.PI / 2; g.rig.initialized = false;
      g.ui.announce(this.def.name, this.state.dif ? `Difficulté ${this.state.dif + 1}` : 'Expédition', 3.5);
      g.audio?.play('summon');
    });
    c.setBarriers(barriersFor(this.state.ex, this.state.sg));
    if (g.windows?.current === 'party') g.windows.close();
  }

  // point de réapparition pendant une expédition : la plateforme de l'épreuve en cours
  respawnPoint() {
    if (!this.active) return null;
    const st = this.stage, P = CITADEL.platforms[st ? (st.platform === 4 ? 4 : Math.max(0, st.platform - 1)) : 0];
    const x = P.x + 2, z = P.z + 2;
    return { x, y: this.game.world.terrain.heightAt(x, z) ?? P.y, z, facing: Math.PI / 2 };
  }

  update(dt) {
    const g = this.game;
    this.portal.ring.rotation.z += dt * 0.7;
    this.portal.disc.material.opacity = 0.28 + Math.sin(g.elapsed * 2.2) * 0.07;
    if (!this.inParty) { if (this.state.ph !== 'none') this.left(); return; }
    if (this.isHost) this.hostUpdate(dt);
    if (this.citadel) {
      this.citadel.update(dt, g.elapsed, g.world.sky.state.night);
      this.citadel.setBarriers(this.active ? barriersFor(this.state.ex, this.state.sg) : [true, false, false, false]);
      this.citadel.setObjects(this.state.a, this.state.b);
    }
    // ciel de la Citadelle
    const inCitadel = g.player && g.player.position.x > 3500;
    g.world.sky.mood = inCitadel ? 1 : 0;
    if (this.state.ph === 'done' && !this.doneShown && inCitadel) { this.doneShown = true; this.victory(); }
    // chute dans le vide : retour à la plateforme de l'épreuve
    if (inCitadel && g.player.position.y < 20 && !g.player.dead) {
      const sp = this.respawnPoint();
      if (sp) { g.player.spawn(sp.x, sp.y + 0.5, sp.z, sp.facing); g.ui.toast('Le vide vous recrache sur la plateforme.', { time: 2 }); }
    }
  }

  // ------------------------------------------------------------------ objets interactifs
  target(pos) {
    if (Math.hypot(pos.x - this.portal.x, pos.z - this.portal.z) < 3.8) return { kind: 'expportal', text: 'Portail des Expéditions (jouer entre amis)' };
    if (!this.active || !this.citadel) return null;
    const st = this.stage, c = this.citadel;
    if (Math.hypot(pos.x - c.portal.x, pos.z - c.portal.z) < 3.5) return { kind: 'expexit', text: 'Quitter l’expédition (retour au monde)' };
    if (st?.kind === 'altars') for (const [i, a] of c.altars.entries()) if (!this.state.a[i] && Math.hypot(pos.x - a.x, pos.z - a.z) < 3.4) return { kind: 'expobj', i, text: 'Purifier l’autel' };
    if (st?.kind === 'braziers') for (const [i, b] of c.braziers.entries()) if (!this.state.b[i] && Math.hypot(pos.x - b.x, pos.z - b.z) < 3.4) return { kind: 'expobj', i, text: 'Allumer le brasero' };
    return null;
  }

  completeObject(i) {
    if (this.isHost) this.activateObject(i);
    else this.game.net.sendExpEvent('obj', i);
  }

  playFx(ev, p) {
    const g = this.game, fx = g.fx;
    if (ev.type === 'expObj') {
      fx.beam(p, ev.k === 'altar' ? '#ffd36b' : '#ffae5c', { height: 30, radius: 1.4, life: 1.2 });
      g.audio?.play('beacon', p);
      g.ui.toast(ev.k === 'altar' ? 'Un autel est purifié !' : 'Un brasero s’embrase !', { time: 2 });
    } else if (ev.type === 'expStage' || ev.type === 'expNext') {
      const ex = EXPEDITIONS[ev.ex] || EXPEDITIONS.citadelle;
      const st = ex.stages[ev.sg | 0];
      if (st) g.ui.announce(ev.type === 'expNext' ? 'Épreuve réussie' : 'Nouvelle épreuve', st.text, 3.5);
      g.audio?.play('quest');
    }
  }

  // ------------------------------------------------------------------ victoire
  victory() {
    const g = this.game, hero = g.hero;
    const s = this.state;
    const secs = Math.max(1, Math.round(((s.t1 || Date.now()) - s.t0) / 1000));
    const key = 'exp:' + s.ex;
    hero.discovered[key] = (hero.discovered[key] | 0) + 1;
    if (s.ex === 'arene') { const best = hero.discovered['exptime:arene'] | 0; if (!best || secs < best) hero.discovered['exptime:arene'] = secs; }
    if (s.ex === 'citadelle') hero.title = hero.title || 'Pourfendeur de Brume';
    // récompenses personnelles
    const p = g.player.position.clone();
    const lvl = Math.max(hero.level, s.lv);
    g.loot.drop(p, { gold: 300 + s.dif * 150 });
    g.loot.drop(p, { item: generateItem(hero.classId, lvl, { rarity: 3 }) });
    g.loot.drop(p, { item: generateItem(hero.classId, lvl, { rarity: 2 }) });
    g.loot.drop(p, { potion: 'hp' });
    g.gainXp(1500 + s.dif * 600);
    g.fx.levelUp(g.player);
    g.ui.announce('Expédition réussie !', `${this.def.name} · ${Math.floor(secs / 60)} min ${secs % 60} s`, 6);
    g.audio?.play('levelup');
    g.quests?.onEvent('expedition', { ex: s.ex });
    g.save?.soon(1);
    g.schedule(2, () => { g.windows?.open('party'); });
  }

  // ------------------------------------------------------------------ fenêtre « Expédition »
  refreshWindow(soft = false) {
    const win = this.game.windows;
    if (win?.current !== 'party') return;
    // pas de reconstruction pendant la saisie du code
    if (soft && document.activeElement?.id === 'exp-code') return;
    win.open('party');
  }

  window(win) {
    const g = this.game, net = g.net;
    const body = h('div', { class: 'exp' });
    if (!net) return win.frame('Expéditions', h('div', { class: 'istats' }, 'Le multijoueur démarre…'));
    if (!this.inParty) {
      const input = h('input', { id: 'exp-code', class: 'exp-code', maxlength: 8, placeholder: 'CODE', autocomplete: 'off', spellcheck: 'false' });
      input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.code === 'Enter') this.join(input.value); });
      body.append(
        h('p', { class: 'tut-lead' }, 'Partez à l’aventure avec vos amis : jusqu’à 4 héros dans une partie privée, avec des quêtes et des boss qui n’existent nulle part ailleurs.'),
        h('div', { class: 'exp-cards' },
          ...Object.entries(EXPEDITIONS).map(([id, ex]) => h('div', { class: 'exp-card' }, h('b', {}, ex.name), h('div', { class: 'istats' }, ex.desc), h('div', { class: 'istats' }, `${ex.stages.length} épreuves · ${ex.stages.filter((s) => s.kind === 'boss').length} boss`)))),
        h('div', { class: 'exp-actions' },
          h('button', { class: 'btn', onclick: () => this.host() }, 'Héberger une expédition'),
          h('div', { class: 'exp-join' }, input, h('button', { class: 'btn ghost', onclick: () => this.join(input.value) }, 'Rejoindre'))),
        h('p', { class: 'tut-note' }, 'Héberger crée un groupe et vous donne un code. Vos amis le saisissent ici pour vous rejoindre, où qu’ils soient dans l’archipel.'),
      );
      return win.frame('Expéditions', body);
    }
    const members = net.partyMembers();
    const code = (net.party?.code || '').toUpperCase();
    const s = this.state, iAmHost = this.isHost;
    const list = h('div', { class: 'exp-members' }, ...members.map((m) => h('div', { class: 'exp-member' },
      h('span', { style: { color: CLASSES[m.c]?.color || 'var(--parch)', fontWeight: '700' } }, (m.n || 'Héros') + (m.me ? ' (vous)' : '')),
      h('span', { class: 'istats' }, `${CLASSES[m.c]?.name || ''} · niv. ${m.l || 1}`),
      h('span', { class: 'exp-tag' + (m.host ? ' host' : m.rd ? ' ok' : '') }, m.host ? 'hôte' : m.rd ? 'prêt' : 'en attente'))),
    ...Array.from({ length: Math.max(0, 4 - members.length) }, () => h('div', { class: 'exp-member empty' }, h('span', { class: 'istats' }, 'place libre'))));
    body.append(
      h('div', { class: 'exp-codebox' }, h('div', { class: 'istats' }, 'Code de l’expédition'), h('div', { class: 'exp-bigcode' }, code),
        h('button', { class: 'btn small ghost', onclick: () => { try { navigator.clipboard?.writeText(code); g.ui.toast('Code copié.'); } catch { /* */ } } }, 'Copier')),
      list,
    );
    if (s.ph === 'run') {
      const st = this.stage;
      body.append(h('div', { class: 'exp-status' }, h('b', {}, this.def.name), h('div', {}, st ? `Épreuve ${s.sg + 1}/${this.def.stages.length} : ${st.text}` : '')));
    } else if (s.ph === 'done') {
      const secs = Math.round(((s.t1 || Date.now()) - s.t0) / 1000);
      body.append(h('div', { class: 'exp-status good' }, h('b', {}, 'Expédition réussie !'), h('div', {}, `${this.def.name} en ${Math.floor(secs / 60)} min ${secs % 60} s`)));
    }
    const actions = h('div', { class: 'exp-actions' });
    if (iAmHost && s.ph !== 'run') {
      for (const [id, ex] of Object.entries(EXPEDITIONS)) actions.append(h('button', { class: 'btn', onclick: () => { this.launch(id, s.ph === 'done' && s.ex === id ? s.dif + 1 : 0); win.close(); } }, (s.ph === 'done' && s.ex === id ? 'Recommencer, plus difficile : ' : 'Lancer : ') + ex.name));
    } else if (!iAmHost && s.ph === 'lobby') {
      actions.append(h('button', { class: 'btn' + (this.ready ? ' ghost' : ''), onclick: () => { this.ready = !this.ready; this.refreshWindow(); } }, this.ready ? 'Je ne suis plus prêt' : 'Je suis prêt'));
      actions.append(h('div', { class: 'istats' }, 'L’hôte lance l’expédition quand tout le monde est prêt.'));
    }
    actions.append(h('button', { class: 'btn ghost', onclick: () => { this.leave(); } }, s.ph === 'run' ? 'Abandonner et rentrer' : 'Quitter le groupe'));
    body.append(actions);
    return win.frame('Expédition', body);
  }

  // objectif affiché dans le suivi des quêtes
  tracked() {
    if (!this.active) return null;
    const s = this.state, st = this.stage;
    if (s.ph === 'done') return { title: this.def.name, objectives: [{ text: 'Expédition réussie ! (touche P pour recommencer)', done: true, count: 1, have: 1 }] };
    if (!st) return null;
    const count = st.count || 1;
    return { title: `${this.def.name} · ${s.sg + 1}/${this.def.stages.length}`, exp: true, objectives: [{ text: st.text, done: false, count, have: Math.min(s.n, count) }] };
  }
}

export { VILLAGE };
