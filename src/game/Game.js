import * as THREE from 'three';
import { World } from '../world/World.js';
import { Player } from '../entities/Player.js';
import { CameraRig } from '../entities/CameraRig.js';
import { Effects } from '../fx/Effects.js';
import { Enemies } from './Enemies.js';
import { Projectiles, pickSoftTarget } from './Combat.js';
import { Loot } from './Loot.js';
import { generateItem, rollRarity } from './Items.js';
import { ABILITIES, BASIC, basicAttack, basicVisual } from './Abilities.js';
import { CLASSES, ENEMIES, VILLAGE, BEACONS, FOREST, RUINS, LAKE, MOUNTAIN, HILLS, ISLETS } from '../config.js';
import { CLOUD_SEA_Y } from '../world/Clouds.js';
import { renderWorldMap } from '../ui/MapRender.js';
import { Hud } from '../ui/Hud.js';
import { Icons } from '../ui/Icons.js';
import { Updrafts } from '../world/Updrafts.js';

// Orchestrateur principal : boucle de jeu, combat, liens entre systèmes.
export class Game {
  constructor({ renderer, assets, input, ui, platform, audio }) {
    this.renderer = renderer; this.assets = assets; this.input = input; this.ui = ui; this.platform = platform; this.audio = audio;
    this.scene = renderer.scene; this.camera = renderer.camera;
    this.timer = new THREE.Timer();
    this.elapsed = 0;
    this.running = false;
    this.timers = [];
    this.cooldowns = {};
    this.combo = 0; this.comboT = 0;
    this.target = null;
    this.timeScale = 1; this.hitStopT = 0;
    this.lastCombat = -100;
    this.classDefs = CLASSES;
    this.remotePlayers = new Map();
    this.settings = { autoEquip: false, sensitivity: 1, volume: 0.8, music: 0.6, quality: renderer.qualityName, showHelp: true };
    this.paused = false;
    this.hurtFlash = 0;
    this.fps = 60; this.fpsAcc = 0; this.fpsN = 0;
  }

  get selfId() { return this.net?.selfId || 'local'; }
  get classDef() { return CLASSES[this.hero.classId]; }
  get basicCd() { return BASIC[this.hero.classId].cd / (1 + (this.hero.stats.haste || 0) / 100); }
  cdMult() { return 1 / (1 + (this.hero.stats.haste || 0) / 100); }

  async buildWorld(onStep) {
    this.world = await new World(this.renderer, this.assets, this.renderer.quality).init(onStep);
    this.rig = new CameraRig(this.camera, this.world.terrain, this.world.colliders);
    this.fx = new Effects(this.scene);
    this.enemies = new Enemies(this);
    this.projectiles = new Projectiles(this);
    this.loot = new Loot(this);
    this.icons = new Icons(this.renderer, this.assets);
    this.world.updrafts = new Updrafts(this.scene, this.world.terrain, this.fx);
    onStep?.('Cartographie de l’archipel…');
    await new Promise((r) => setTimeout(r, 0));
    this.mapImage = renderWorldMap(this.world.terrain, 512);
  }

  // Compile d'avance tout ce qui apparaît en combat : effets, héros et squelettes, opaques
  // et en fondu (mort d'un ennemi, caméra proche). Des copies cachées restent dans la scène
  // pour que ces shaders ne soient jamais détruits puis recompilés en pleine action.
  prewarm() {
    const fade = (o) => o.traverse((m) => { if (!m.isMesh) return; for (const mat of [].concat(m.material)) { mat.transparent = true; mat.opacity = 0.5; mat.depthWrite = false; } });
    const keep = [];
    for (const name of ['knight', 'barbarian', 'mage', 'rogue', 'rogue_hooded', 'skel_minion', 'skel_warrior', 'skel_rogue', 'skel_mage']) {
      if (!this.assets.gltf[name]) continue;
      keep.push(this.assets.character(name));
      const faded = this.assets.character(name); fade(faded); keep.push(faded);
    }
    for (const def of Object.values(ENEMIES)) {
      for (const w of [def.weapon, def.shield]) {
        if (!w) continue;
        for (const f of [false, true]) {
          const p = this.assets.prop(w[0]);
          p.traverse((m) => { if (m.isMesh) m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone(); });
          if (f) fade(p);
          keep.push(p);
        }
      }
    }
    this.fx.prewarm(this.renderer, keep);
  }

  // ------------------------------------------------------------------ démarrage d'une partie
  startHero(hero) {
    this.hero = hero;
    this.player = new Player(this, hero.classId, hero.name);
    this.scene.add(this.player.object);
    const sp = this.respawnPoint(true);
    this.player.spawn(sp.x, sp.y, sp.z, sp.facing);
    this.rig.yaw = sp.facing + Math.PI;
    this.rig.pitch = 0.3;
    this.rig.initialized = false;
    if (this.input.isTouch) { this.rig.targetDistance = this.rig.distance = 11; }
    this.hud = new Hud(this.ui, this);
    this.hud.portrait.src = this.icons.portrait(this.classDef.model);
    this.world.sky.override = null;
    this.inGame = true;
  }

  respawnPoint(first = false) {
    // au Cœur de Lumière, ou au phare allumé le plus proche de la mort
    let x = VILLAGE.x + 3, z = VILLAGE.z + 11, facing = Math.PI;
    if (!first && this.player && this.worldState) {
      let best = null, bd = Math.hypot(this.player.position.x - x, this.player.position.z - z);
      BEACONS.forEach((b, i) => {
        if ((this.worldState.levels[i] || 0) < 0.999) return;
        const d = Math.hypot(this.player.position.x - b.x, this.player.position.z - b.z);
        if (d < bd) { bd = d; best = b; }
      });
      if (best) { x = best.x + 4; z = best.z + 4; facing = 0; }
    }
    const y = this.world.terrain.heightAt(x, z) ?? 20;
    return { x, y, z, facing };
  }

  start() {
    this.running = true;
    const loop = (t) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      this.timer.update(t);
      let dt = Math.min(this.timer.getDelta(), 1 / 15);
      this.frame(dt);
    };
    requestAnimationFrame(loop);
  }

  schedule(delay, fn) { this.timers.push({ t: delay, fn }); }
  hitStop(d) { this.hitStopT = Math.max(this.hitStopT, d); }
  shakeAt(p, amount) {
    if (!this.player) return;
    const d = Math.hypot(p.x - this.player.position.x, p.z - this.player.position.z);
    if (d < 30) this.rig.shake(amount * (1 - d / 30));
  }

  // ------------------------------------------------------------------ boucle
  frame(rawDt) {
    rawDt = Math.min(rawDt, this.maxDt || 0.25);
    this.fpsAcc += rawDt; this.fpsN++;
    if (this.fpsAcc > 1) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    // simulation à pas fixes (stable même quand l'affichage ralentit)
    const steps = Math.min(40, Math.max(1, Math.ceil(rawDt / (1 / 30))));
    const sdt = rawDt / steps;
    let simulated = 0;
    for (let i = 0; i < steps; i++) {
      let dt = sdt;
      if (this.hitStopT > 0) { this.hitStopT -= sdt; dt = sdt * 0.08; }
      simulated += dt;
      this.elapsed += dt;
      for (let k = this.timers.length - 1; k >= 0; k--) {
        const tm = this.timers[k];
        tm.t -= dt;
        if (tm.t <= 0) { this.timers.splice(k, 1); try { tm.fn(); } catch (e) { console.error(e); } }
      }
      if (this.inGame && this.player) this.updateGame(dt, i === 0);
      if (i === 0) this.input.clearPressed();
    }
    const dt = simulated;
    const inGame = this.inGame && this.player;
    if (inGame) this.lateUpdate(dt);
    else this.updateMenu?.(dt);
    const focus = inGame ? this.player.position : (this.menuFocus || new THREE.Vector3(0, 20, 0));
    const pushers = [];
    if (inGame) {
      pushers.push({ x: this.player.position.x, z: this.player.position.z, r: 1.3 });
      for (const rp of this.remotePlayers.values()) if (pushers.length < 5) pushers.push({ x: rp.position.x, z: rp.position.z, r: 1.3 });
      for (const e of this.enemies.map.values()) if (pushers.length < 8 && e.alive) { const d = Math.hypot(e.position.x - focus.x, e.position.z - focus.z); if (d < 25) pushers.push({ x: e.position.x, z: e.position.z, r: 1.1 }); }
    }
    this.world.playerFocus = inGame ? this.player.position : null;
    this.world.update(dt, focus, this.camera, pushers);
    this.world.updrafts?.update(dt, this.elapsed, focus);
    this.systemsUpdate?.(dt);
    this.audio?.update(dt);
    this.fx.update(dt, this.camera, this.renderer.renderer.domElement.clientHeight * this.renderer.renderer.getPixelRatio());
    this.ui.update(dt, this.camera);
    if (this.renderer.grade) {
      this.hurtFlash = Math.max(0, this.hurtFlash - rawDt * 1.8);
      const low = inGame ? Math.max(0, 0.35 - this.hero.hp / this.hero.stats.hp) * 1.6 : 0;
      this.renderer.grade.uniforms.uHurt.value = Math.min(1, this.hurtFlash + low * (0.7 + 0.3 * Math.sin(this.elapsed * 5)));
    }
    this.frameN = (this.frameN || 0) + 1;
    if (!this.renderEvery || this.frameN % this.renderEvery === 0) this.renderer.render(dt, this.elapsed);
    this.input.endFrame();
  }

  updateGame(dt, first) {
    const input = this.input, p = this.player, hero = this.hero;
    hero.playTime += dt;
    if (first) {
      const look = input.consumeLook();
      if (!this.runes?.drawing) this.rig.handleLook(look);
      else this.runes.feedLook(look);
    }
    const blocked = this.paused || this.windowOpen || this.dialogueOpen || this.chatOpen;
    input.enabled = !blocked;
    // cooldowns
    for (const k of Object.keys(this.cooldowns)) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    if (!p.dead && !blocked && first) this.handleCombatInput(dt);
    p.update(dt, input, this.rig);
    if (p.invulnerableT) { p.invulnerableT -= dt; p.invulnerable = p.invulnerableT > 0 || p.invulnerable; if (p.invulnerableT <= 0) { p.invulnerableT = 0; } }
    this.handlePlayerEvents();
    this.updateTarget();
    this.enemies.update(dt);
    this.projectiles.update(dt);
    this.loot.update(dt);
    // régénération
    hero.updateBuffs(dt);
    if (!p.dead) {
      const out = this.elapsed - this.lastCombat > 6;
      hero.hp = Math.min(hero.stats.hp, hero.hp + (hero.stats.regen * 0.6 + (out ? hero.stats.hp * 0.035 : 0)) * dt);
      hero.mp = Math.min(hero.stats.mp, hero.mp + (hero.stats.mp * (out ? 0.05 : 0.018) + 0.6) * dt);
    }
    // chute dans la mer de nuages
    if (!p.dead && p.position.y < CLOUD_SEA_Y + 8) this.fellIntoClouds();
    if (first && input.pressed('interact') && !blocked) this.interactions?.interact();
  }

  lateUpdate(dt) {
    const p = this.player;
    this.promptText = this.interactions?.prompt() || '';
    this.hud?.update(dt);
    this.updatePlates();
    this.rig.update(dt, p.position, Math.max(0, Math.hypot(p.velocity.x, p.velocity.z) - 8) / 4);
    p.char.setOpacity(!p.dead && this.rig.closeFade < 1 ? Math.round(this.rig.closeFade * 10) / 10 : 1);
  }

  handleCombatInput() {
    const input = this.input, hero = this.hero;
    // runes
    this.runes?.handleInput(input);
    if (this.runes?.drawing) return;
    // attaque de base
    const wantAttack = input.mouse.clicked || (input.locked && input.mouse.left && !input.mouse.dragging) || input.touch.buttons.has('attack');
    if (wantAttack && (this.cooldowns.attack || 0) <= 0 && !this.player.dash && !this.player.dodge) this.basicAttack();
    const cls = this.classDef;
    for (let i = 0; i < 4; i++) if (input.pressed('ability' + (i + 1))) this.useAbility(i);
    if (input.pressed('potion')) this.usePotion();
    void cls; void hero;
  }

  ctx() { return { game: this, actor: this.player, classId: this.hero.classId, isLocal: true }; }

  aimFacing() {
    // le héros se tourne vers sa cible ou vers la direction de la caméra
    const p = this.player;
    if (this.target && this.target.alive) p.faceTowards(this.target.position.x, this.target.position.z, true);
    else p.facing = this.rig.yaw + Math.PI;
    p.object.rotation.y = p.facing;
  }

  basicAttack() {
    const p = this.player;
    this.aimFacing();
    this.cooldowns.attack = this.basicCd;
    const data = basicAttack(this.ctx(), this.combo);
    this.net?.sendAction('basic', data);
    this.combo = (this.combo + 1) % 3; this.comboT = 1.1;
    p.combatIdle = 4;
    this.lastCombat = this.elapsed;
    if (this.hero.hasBuff('stealth')) this.breakStealth();
  }

  useAbility(i) {
    const id = this.classDef.abilities[i];
    const ab = ABILITIES[id];
    const hero = this.hero, p = this.player;
    if (!ab || p.dead) return;
    if (hero.level < ab.level) { this.ui.toast(`<b>${ab.name}</b> se débloque au niveau ${ab.level}.`); return; }
    if ((this.cooldowns[id] || 0) > 0) return;
    if (hero.mp < ab.mana) { this.ui.toast('Pas assez d’éther.', { color: '#8ef0f6', time: 1.5 }); this.audio?.play('error'); return; }
    if (!['blink', 'roll', 'shieldwall', 'rally', 'rage', 'smoke', 'frostnova', 'whirlwind'].includes(id)) this.aimFacing();
    hero.mp -= ab.mana;
    this.cooldowns[id] = ab.cd * this.cdMult();
    const c = this.ctx();
    const data = ab.cast(c) || {};
    ab.visual(c, data);
    this.net?.sendAction(id, data);
    const sl = this.hud?.slots[id];
    if (sl) { sl.el.classList.remove('flash'); void sl.el.offsetWidth; sl.el.classList.add('flash'); }
    this.lastCombat = this.elapsed;
    p.combatIdle = 4;
    if (id !== 'smoke' && hero.hasBuff('stealth')) this.breakStealth();
    if (data.ally) this.net?.sendAllyBuff?.(data.ally);
  }

  breakStealth() { this.hero.buffs = this.hero.buffs.filter((b) => b.id !== 'stealth'); this.hero.recompute(); }

  usePotion() {
    const hero = this.hero;
    if ((this.cooldowns.potion || 0) > 0 || this.player.dead) return;
    if ((hero.potions.hp || 0) <= 0) { this.ui.toast('Plus d’élixir de vie. Brom en vend au village.', { time: 2 }); return; }
    hero.potions.hp--;
    this.cooldowns.potion = 8;
    this.player.char.playAction('Use_Item', { timeScale: 1.8 });
    const amount = Math.round(hero.stats.hp * 0.45);
    for (let i = 0; i < 5; i++) this.schedule(i * 0.2, () => this.healSelf(Math.round(amount / 5), i === 0));
    this.fx.aura(this.player, '#7ee0a8', { duration: 1, rate: 40 });
    this.audio?.play('potion');
  }

  healSelf(n, show = true) {
    const hero = this.hero;
    const before = hero.hp;
    hero.hp = Math.min(hero.stats.hp, hero.hp + n);
    if (show && hero.hp > before) this.ui.floatText(this.player.position.clone().setY(this.player.position.y + 2.6), '+' + Math.round(n), 'heal');
  }

  // ------------------------------------------------------------------ ciblage
  updateTarget() {
    const p = this.player;
    const list = this.enemies.hittable();
    const range = this.classDef.ranged ? 32 : 14;
    const keep = this.target && this.target.alive && Math.hypot(this.target.position.x - p.position.x, this.target.position.z - p.position.z) < range + 6;
    if (!keep) this.target = null;
    const yaw = this.rig.yaw + Math.PI;
    const cand = pickSoftTarget(p.position, yaw, list, range, this.classDef.ranged ? 0.45 : 0.9);
    // on change de cible si la nouvelle est nettement mieux centrée
    if (!this.target || (cand && cand !== this.target && this.elapsed - (this.lastCombat || 0) > 1.2)) this.target = cand || this.target;
    // anneau sous la cible
    if (!this.targetRing) {
      this.targetRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6b5e').multiplyScalar(2), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      this.targetRing.rotation.x = -Math.PI / 2;
      this.scene.add(this.targetRing);
    }
    const t = this.target;
    this.targetRing.visible = !!t;
    if (t) {
      this.targetRing.position.set(t.position.x, t.position.y + 0.12, t.position.z);
      const s = t.radius * 1.9 * (1 + Math.sin(this.elapsed * 6) * 0.06);
      this.targetRing.scale.setScalar(s);
      this.targetRing.material.color.set(t.elite ? '#ffd36b' : '#ff6b5e').multiplyScalar(2);
    }
    // boss engagé
    this.bossEngaged = null;
    for (const e of this.enemies.map.values()) if (e.def.boss && e.alive && Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) < 55) this.bossEngaged = e;
  }

  updatePlates() {
    const ui = this.ui;
    for (const e of this.enemies.map.values()) {
      if (!e.alive && e.deadT > 1.5) continue;
      ui.setPlate({ id: e.id, position: e.position, height: e.height + 0.2, name: (e.elite ? '★ ' : '') + e.def.name + ' · ' + e.level, kind: e.elite || e.def.boss ? 'elite' : 'enemy', hpPct: e.alive ? Math.max(0, e.hpPct) : 0, hidden: e.def.boss });
    }
    this.npcs?.plates(ui);
    for (const rp of this.remotePlayers.values()) rp.plate(ui);
    this.echoes?.plates?.(ui);
  }

  // ------------------------------------------------------------------ évènements du joueur (sons, poussière)
  handlePlayerEvents() {
    const p = this.player;
    for (const ev of p.events.splice(0)) {
      if (ev.type === 'step') this.audio?.play(ev.water ? 'splash' : 'step', p.position, 0.5);
      else if (ev.type === 'jump') { this.audio?.play('jump', p.position); this.fx.dust(p.position, { count: 6, size: 0.9 }); }
      else if (ev.type === 'land') { this.fx.dust(p.position, { count: Math.min(24, 6 + ev.impact), size: 1.1 }); this.audio?.play('land', p.position); if (ev.impact > 26) this.takeDamage((ev.impact - 26) * 4, null, { kind: 'fall' }); }
      else if (ev.type === 'dodge') this.audio?.play('dodge', p.position);
      else if (ev.type === 'glide') { this.audio?.play(ev.open ? 'glide' : 'glideclose', p.position); if (ev.open) this.quests?.onEvent('glide', {}); }
    }
  }

  // ------------------------------------------------------------------ dégâts
  playerTargets() {
    const out = [];
    const p = this.player;
    if (p && !p.dead) out.push({ id: this.selfId, position: p.position, velocity: p.velocity, alive: true, radius: 0.55, height: 2.4, stealth: !!this.hero.hasBuff('stealth'), threatMul: this.hero.classId === 'knight' ? 1.5 : 1, isLocal: true });
    for (const rp of this.remotePlayers.values()) if (!rp.dead) out.push({ id: rp.id, position: rp.position, velocity: rp.velocity, alive: true, radius: 0.55, height: 2.4, stealth: rp.stealth, threatMul: rp.classId === 'knight' ? 1.5 : 1 });
    return out;
  }

  hurtPlayer(id, amount, source, opts = {}) {
    if (id === this.selfId) this.takeDamage(amount, source, opts);
    else this.net?.queueDamage(id, Math.round(amount), opts.kind || 'melee', source ? [source.position.x, source.position.z] : null);
  }

  takeDamage(raw, source, opts = {}) {
    const p = this.player, hero = this.hero;
    if (!p || p.dead) return;
    if (p.invulnerable && opts.kind !== 'fall') { this.ui.floatText(p.position.clone().setY(p.position.y + 2.4), 'Esquive', 'info'); return; }
    let dmg = raw * (60 / (60 + hero.stats.def * 2.2)) * (0.9 + Math.random() * 0.2);
    const wall = hero.hasBuff('shieldwall');
    if (wall && source) {
      dmg *= 1 - wall.reduce;
      this.fx.hit(p.position.clone().setY(p.position.y + 1.4), '#ffd36b', 0.6);
      this.audio?.play('block', p.position);
    }
    const shield = hero.hasBuff('aegis');
    if (shield && shield.absorb > 0) {
      const ab = Math.min(shield.absorb, dmg);
      shield.absorb -= ab; dmg -= ab;
      if (shield.absorb <= 0) hero.buffs = hero.buffs.filter((b) => b !== shield);
      this.fx.hit(p.position.clone().setY(p.position.y + 1.4), '#9be8ff', 0.6);
    }
    dmg = Math.max(1, Math.round(dmg));
    hero.hp -= dmg;
    this.lastCombat = this.elapsed;
    this.ui.floatText(p.position.clone().setY(p.position.y + 2.4), '−' + dmg, 'hurt', { spread: 1 });
    this.hurtFlash = Math.min(1, this.hurtFlash + dmg / hero.stats.hp * 3);
    p.char.hitFlash('#ff5040', 0.8);
    this.rig.shake(Math.min(0.5, dmg / hero.stats.hp * 3));
    this.audio?.play('hurt', p.position);
    if (!wall && !p.char.oneShot && dmg > hero.stats.hp * 0.08) p.char.playAction('Hit_A', { timeScale: 1.8 });
    if (hero.hp <= 0) this.die(source, opts);
  }

  onDamageDealt(e, r, opts) {
    const pos = e.position.clone().setY(e.position.y + e.height + 0.3);
    this.ui.floatText(pos, String(r.amount), r.crit ? 'crit' : 'dmg', { scale: r.crit ? 1.1 : 1 });
    const ls = this.hero.hasBuff('rage')?.lifesteal;
    if (ls) this.healSelf(r.amount * ls, false);
    this.lastCombat = this.elapsed;
    if (opts.kind === 'melee' || opts.kind === undefined) { this.fx.hit(e.position.clone().setY(e.position.y + 1.3), r.crit ? '#ffe3a3' : '#fff4d0', r.crit ? 1.3 : 0.8); this.audio?.play(r.crit ? 'crit' : 'hit', e.position); }
    if (!this.target || !this.target.alive) this.target = e;
  }

  onEnemyKilled(e, killers) {
    // chez l'hôte : appelé pour chaque mort ; chaque client récompense les siens
    this.fx.burst(e.position.clone().setY(e.position.y + 1.2), '#c9b6ff', { count: 30, speed: 5, size: 0.4, life: 1, gravity: -1.5, up: 3 });
    this.audio?.play('bones', e.position);
    if (killers.includes(this.selfId)) this.rewardKill({ type: e.type, level: e.level, elite: e.elite, xp: e.xp, x: e.position.x, y: e.position.y, z: e.position.z, boss: !!e.def.boss });
  }

  rewardKill(k) {
    const hero = this.hero;
    const diff = k.level - hero.level;
    const xp = Math.round(k.xp * (diff < -5 ? 0.3 : diff < -2 ? 0.7 : diff > 2 ? 1.25 : 1));
    hero.kills++;
    const pos = new THREE.Vector3(k.x, k.y + 2.6, k.z);
    this.ui.floatText(pos, `+${xp} xp`, 'xp', { rise: 2.2, life: 1.6 });
    this.gainXp(xp);
    // butin personnel
    const lp = new THREE.Vector3(k.x, k.y, k.z);
    const gold = Math.round((2 + k.level * 1.5) * (k.elite ? 3 : 1) * (0.6 + Math.random() * 0.8)) * (k.boss ? 20 : 1);
    this.loot.drop(lp, { gold });
    if (Math.random() < (k.boss ? 1 : k.elite ? 0.8 : 0.16)) {
      const it = generateItem(hero.classId, k.level, { rarity: k.boss ? 3 : k.elite ? Math.max(1, rollRarity(Math.random, 1)) : rollRarity() });
      this.loot.drop(lp, { item: it });
      if (k.boss) this.loot.drop(lp, { item: generateItem(hero.classId, k.level, { rarity: 2 }) });
    }
    if (Math.random() < 0.09) this.loot.drop(lp, { potion: Math.random() < 0.65 ? 'hp' : 'mp' });
    this.quests?.onEvent('kill', k);
    this.worldState?.onKill(k);
    this.save?.soon();
  }

  gainXp(xp) {
    const hero = this.hero;
    const lv = hero.addXp(xp);
    if (lv) {
      this.fx.levelUp(this.player);
      this.ui.announce('Niveau ' + hero.level, this.levelUnlockText(), 3.2);
      this.audio?.play('levelup');
      this.net?.announce?.('levelup', { level: hero.level });
      this.quests?.onEvent('level', { level: hero.level });
      this.save?.soon(0.5);
    }
  }

  levelUnlockText() {
    const ab = this.classDef.abilities.map((a) => ABILITIES[a]).find((a) => a.level === this.hero.level);
    return ab ? `Nouvelle compétence : ${ab.name}` : 'Votre lumière grandit.';
  }

  die(source) {
    const p = this.player, hero = this.hero;
    p.dead = true;
    hero.hp = 0;
    hero.deaths++;
    p.char.stopAction(0);
    p.char.playAction('Death_A', { full: true, hold: true });
    this.audio?.play('death');
    this.target = null;
    this.echoes?.recordDeath?.(source);
    this.screens?.showDeath(source ? `Terrassé par ${source.def?.name || 'la Brume'}.` : 'La Brume vous a rattrapé.');
    this.save?.soon();
  }

  respawn() {
    const p = this.player, hero = this.hero;
    const sp = this.respawnPoint();
    p.char.stopAction(0);
    p.spawn(sp.x, sp.y, sp.z, sp.facing);
    hero.hp = Math.round(hero.stats.hp * 0.7); hero.mp = Math.round(hero.stats.mp * 0.7);
    this.fx.beam(p.position, '#ffe3a3', { height: 30, radius: 2, life: 1.4 });
    this.fx.ring(p.position, '#ffe3a3', { to: 6 });
    this.audio?.play('respawn');
    this.lastCombat = -100;
  }

  fellIntoClouds() {
    const p = this.player;
    this.ui.toast('La mer de nuages vous recrache au Cœur de Lumière.', { time: 3 });
    const sp = { x: VILLAGE.x + 3, z: VILLAGE.z + 11 };
    const y = this.world.terrain.heightAt(sp.x, sp.z) ?? 20;
    p.spawn(sp.x, y + 20, sp.z, Math.PI);
    p.gliding = true;
    this.hero.hp = Math.max(1, this.hero.hp - Math.round(this.hero.stats.hp * 0.1));
    this.quests?.onEvent('fall', {});
  }

  // effets purement visuels diffusés aux autres joueurs
  netFx(type, data) {
    this.playNetFx(type, data);
    this.net?.sendFx?.(type, data);
  }
  playNetFx(type, d) {
    if (type === 'bolt') { this.fx.lightning(new THREE.Vector3(...d.from), new THREE.Vector3(...d.to), '#a8d8ff'); this.audio?.play('zap', new THREE.Vector3(...d.to)); }
    else this.runes?.playFx?.(type, d);
  }

  // ------------------------------------------------------------------ zones & carte
  currentZone() {
    const p = this.player.position;
    const t = this.world.terrain;
    const isl = t.islandAt(p.x, p.z);
    if (isl && isl !== t.main) return { name: isl.name, sub: 'îlot flottant' };
    if (!isl) return { name: 'Le Ciel', sub: 'au-dessus de la mer de nuages' };
    const zones = [
      [VILLAGE, VILLAGE.radius + 10, 'havre de paix'], [LAKE, LAKE.radius * 1.8, 'eaux calmes'], [FOREST, FOREST.radius, 'squelettes niv. 3–6'],
      [RUINS, RUINS.radius, 'squelettes niv. 5–9'], [MOUNTAIN, MOUNTAIN.radius * 0.9, 'squelettes niv. 8–15'], [HILLS, HILLS.radius, 'squelettes niv. 1–3'],
    ];
    for (const [z, r, sub] of zones) if (Math.hypot(p.x - z.x, p.z - z.z) < r) return { name: z.name, sub };
    return { name: 'Terres d’Aetheria', sub: 'squelettes niv. 1–4' };
  }

  mapMarkers() {
    const out = [];
    this.npcs?.markers(out);
    this.quests?.markers(out);
    this.echoes?.markers?.(out);
    return out;
  }
}

export { basicVisual, ISLETS };
