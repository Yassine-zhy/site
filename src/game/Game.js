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
import { CLASSES, ENEMIES, VILLAGE, HAMLET, BEACONS, FOREST, RUINS, LAKE, MOUNTAIN, HILLS, WAYSTONES, REGIONS, W } from '../config.js';
import { zoneAt } from '../world/Terrain.js';
import { CLOUD_SEA_Y } from '../world/Clouds.js';
import { renderWorldMap } from '../ui/MapRender.js';
import { Hud } from '../ui/Hud.js';
import { Icons } from '../ui/Icons.js';
import { platformAt } from '../world/Citadel.js';
import { ROOMS } from '../world/Interiors.js';
import { Updrafts } from '../world/Updrafts.js';
import { cloneModelMaterial } from '../engine/ModelLook.js';
import { Creature } from '../entities/Creature.js';

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
    onStep?.('Cartographie du continent…');
    await new Promise((r) => setTimeout(r, 0));
    this.mapImage = renderWorldMap(this.world.terrain, 768);
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
          p.traverse((m) => { if (m.isMesh) m.material = Array.isArray(m.material) ? m.material.map(cloneModelMaterial) : cloneModelMaterial(m.material); });
          if (f) fade(p);
          keep.push(p);
        }
      }
    }
    // créatures de la Brume (opaques et en fondu) et butin au sol
    for (const kind of ['slime', 'spider', 'wolf', 'golem', 'wisp']) {
      keep.push(new Creature(kind).object);
      const c = new Creature(kind); c.setOpacity(0.5); keep.push(c.object);
    }
    for (const n of ['coin_stack_small', 'coin_stack_large', 'coin', 'chest', 'chest_gold', 'bottle_A_green']) keep.push(this.assets.prop(n));
    this.fx.prewarm(this.renderer, keep);
  }

  // ------------------------------------------------------------------ démarrage d'une partie
  startHero(hero) {
    // changement de héros : on retire l'ancien et sa barre d'action
    if (this.player) { this.scene.remove(this.player.object); this.player.char?.dispose?.(); }
    if (this.hud) { this.hud.dispose(); this.hud = null; }
    this.cooldowns = {}; this.target = null; this.combo = 0; this.lastCombat = -100; this.bossEngaged = null;
    this.hero = hero;
    this.player = new Player(this, hero.classId, hero.name);
    this.scene.add(this.player.object);
    const sp = this.respawnPoint(true);
    this.player.spawn(sp.x, sp.y, sp.z, sp.facing);
    this.rig.yaw = sp.facing + Math.PI;
    this.rig.pitch = 0.3;
    this.rig.initialized = false;
    if (this.input.isTouch) { this.rig.targetDistance = this.rig.distance = 11; }
    this.locked = null;
    this.applySettings();
    this.hud = new Hud(this.ui, this);
    this.hud.portrait.src = this.icons.portrait(this.classDef.model);
    this.world.sky.override = null;
    this.inGame = true;
  }

  // Retour à l'écran d'accueil (sans recharger la page) : sauvegarde, quitte le groupe, nettoie.
  async exitToTitle() {
    if (!this.inGame) return;
    this.windows?.close();
    if (this.dialogueOpen) this.dialogue?.close(true);
    if (this.interactions) { this.interactions.task = null; this.interactions.channel = null; }
    if (this.expedition?.inParty) { this.expedition.left(); this.net.party = null; }
    await this.save?.write(true);
    this.net?.switchTransport(null);
    this.inGame = false;
    this.input.exitLock();
    if (this.hud) { this.hud.dispose(); this.hud = null; }
    if (this.touch) this.touch.root.style.display = 'none';
    if (this.player) { this.scene.remove(this.player.object); this.player.char?.dispose?.(); this.player = null; }
    this.loot.clear();
    this.chests?.clearRoll?.();
    this.waves?.reset();
    this.target = null; this.bossEngaged = null;
    if (this.targetRing) this.targetRing.visible = false;
    for (const id of [...this.ui.plates.keys()]) this.ui.removePlate(id);
    this.world.sky.mood = 0;
    this.timers.length = 0;
    this.showMainMenu?.();
  }

  respawnPoint(first = false) {
    const ex = !first && this.expedition?.respawnPoint();
    if (ex) return ex;
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
      // ou à la pierre de passage éveillée la plus proche
      let ws = null;
      for (const w of WAYSTONES) {
        if (!this.waystones?.known(w.id)) continue;
        const d = Math.hypot(this.player.position.x - w.x, this.player.position.z - w.z);
        if (d < bd) { bd = d; ws = w; }
      }
      if (ws) { x = ws.x; z = ws.z + 4; facing = 0; }
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
  // ralenti (victoire, esquive parfaite) : le monde passe à k × la vitesse normale
  slowMo(d, k = 0.35) { this.slowT = Math.max(this.slowT || 0, d); this.slowK = k; }
  shakeAt(p, amount) {
    if (!this.player) return;
    const d = Math.hypot(p.x - this.player.position.x, p.z - this.player.position.z);
    if (d < 30) this.rig.shake(amount * (1 - d / 30));
  }

  // ------------------------------------------------------------------ boucle
  frame(rawDt) {
    rawDt = Math.min(rawDt, this.maxDt || 0.25);
    this.renderer.adapt?.(rawDt, this.settings.adaptive !== false);
    this.fpsAcc += rawDt; this.fpsN++;
    if (this.fpsAcc > 1) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    // simulation à pas fixes (stable même quand l'affichage ralentit)
    const steps = Math.min(40, Math.max(1, Math.ceil(rawDt / (1 / 30))));
    const sdt = rawDt / steps;
    let simulated = 0;
    for (let i = 0; i < steps; i++) {
      let dt = sdt;
      if (this.hitStopT > 0) { this.hitStopT -= sdt; dt = sdt * 0.08; }
      else if (this.slowT > 0) { this.slowT -= sdt; const k = this.slowT > 0.4 ? this.slowK : 1 + (this.slowK - 1) * (this.slowT / 0.4); dt = sdt * k; }
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
    if (first) this.checkZoneEntry(dt);
    if (first) {
      const look = input.consumeLook();
      if (Math.abs(look.dx) + Math.abs(look.dy) > 3) this.lastLookT = performance.now();
      if (!this.runes?.drawing) this.rig.handleLook(look);
      else this.runes.feedLook(look);
    }
    const blocked = this.paused || this.windowOpen || this.dialogueOpen || this.chatOpen || !!this.arenaFights?.introActive;
    input.enabled = !blocked;
    // cooldowns
    for (const k of Object.keys(this.cooldowns)) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    if (!p.dead && !blocked && first) this.handleCombatInput(dt);
    p.update(dt, input, this.rig);
    // invulnérabilité temporaire (compétences, cinématique) : levée à l'échéance, sauf pendant une esquive
    if (p.invulnerableT) { p.invulnerableT -= dt; if (p.invulnerableT > 0) p.invulnerable = true; else { p.invulnerableT = 0; if (!p.dodge) p.invulnerable = false; } }
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
    const lk = this.locked;
    if (lk && !p.dead && this.settings.lockCam !== false && !this.runes?.drawing && performance.now() - (this.lastLookT || 0) > 700) {
      const dx = lk.position.x - p.position.x, dz = lk.position.z - p.position.z;
      if (Math.hypot(dx, dz) > 2.5) {
        let diff = Math.atan2(-dx, -dz) - this.rig.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.rig.yaw += diff * Math.min(1, dt * 3.2);
      }
    }
    this.rig.update(dt, p.position, Math.max(0, Math.hypot(p.velocity.x, p.velocity.z) - 8) / 4);
    p.char.setOpacity(!p.dead && this.rig.closeFade < 1 ? Math.round(this.rig.closeFade * 10) / 10 : 1);
  }

  handleCombatInput() {
    const input = this.input, hero = this.hero;
    // runes
    this.runes?.handleInput(input);
    if (this.runes?.drawing) return;
    // attaque de base
    const manual = input.mouse.clicked || (input.locked && input.mouse.left && !input.mouse.dragging) || input.touch.buttons.has('attack');
    if (manual && this.player.mounted) this.mount?.dismount();
    // attaque de base automatique : le héros frappe ou tire seul sur l'ennemi le plus proche à portée
    const auto = !manual && this.settings.autoBasic !== false ? this.autoTarget() : null;
    if ((manual || auto) && (this.cooldowns.attack || 0) <= 0 && !this.player.dash && !this.player.dodge) {
      if (auto) this.target = auto;
      this.basicAttack();
    }
    const cls = this.classDef;
    for (let i = 0; i < 6; i++) if (input.pressed('ability' + (i + 1))) this.useAbility(i);
    if (input.pressed('potion')) this.usePotion();
    void cls; void hero;
  }

  // Cible de l'attaque automatique : la cible verrouillée si elle est à portée, sinon l'ennemi le plus proche.
  autoTarget() {
    const p = this.player;
    if (p.dead || p.gliding || p.mounted || !p.onGround && p.velocity.y < -6) return null;
    const ranged = this.classDef.ranged;
    const reach = ranged ? 22 : this.classDef.attackRange + 0.9;
    const dist = (e) => Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z);
    const ok = (e) => e && e.alive && dist(e) < reach && Math.abs(e.position.y - p.position.y) < (ranged ? 12 : 3.5);
    if (ok(this.locked)) return this.locked;
    if (ok(this.target)) return this.target;
    let best = null, bd = Infinity;
    for (const e of this.enemies.hittable()) {
      if (!ok(e)) continue;
      const d = dist(e) - (e.target?.isLocal ? 4 : 0); // priorité à ceux qui nous attaquent
      if (d < bd) { bd = d; best = e; }
    }
    return best;
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

  // compétence de l'emplacement i de la barre
  useAbility(i) {
    const id = this.hero.bar?.[i];
    if (!id) { this.ui.toast(`Emplacement ${i + 1} vide : choisissez une compétence dans le grimoire (${this.input.isTouch ? 'menu' : 'touche K'}).`, { time: 2.5 }); return; }
    this.castAbility(id);
  }

  // la barre a changé (déblocage, grimoire) : barre d'action et boutons tactiles reconstruits
  onBarChanged() { this.hud?.buildBar?.(); this.touch?.buildAbilities?.(); this.save?.soon(1); }

  castAbility(id) {
    const ab = ABILITIES[id];
    const hero = this.hero, p = this.player;
    if (!ab || p.dead) return;
    if (p.mounted) this.mount?.dismount();
    if (hero.level < ab.level) { this.ui.toast(`<b>${ab.name}</b> se débloque au niveau ${ab.level}.`); return; }
    if ((this.cooldowns[id] || 0) > 0) return;
    if (hero.mp < ab.mana) { this.ui.toast('Pas assez d’éther.', { color: '#8ef0f6', time: 1.5 }); this.audio?.play('error'); return; }
    if (!SELF_CAST.has(id)) this.aimFacing();
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
    const touch = this.input.isTouch;
    // cible verrouillée : elle reste la cible tant qu'elle vit et n'est pas trop loin
    const L = this.locked;
    if (L && (!L.alive || !this.enemies.map.has(L.id) || Math.hypot(L.position.x - p.position.x, L.position.z - p.position.z) > 42)) {
      this.locked = null;
      if (!L.alive && this.settings.autoRelock !== false) {
        const next = list.filter((e) => e !== L && Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) < 18)
          .sort((a, b) => Math.hypot(a.position.x - p.position.x, a.position.z - p.position.z) - Math.hypot(b.position.x - p.position.x, b.position.z - p.position.z))[0];
        if (next) this.lock(next, true);
      }
    }
    const keep = this.target && this.target.alive && Math.hypot(this.target.position.x - p.position.x, this.target.position.z - p.position.z) < range + 6;
    if (!keep) this.target = null;
    if (this.locked) this.target = this.locked;
    // sur écran tactile, viser est plus difficile : cône plus large, orienté vers la course
    const moving = touch && Math.hypot(p.velocity.x, p.velocity.z) > 2;
    const yaw = moving ? Math.atan2(p.velocity.x, p.velocity.z) : this.rig.yaw + Math.PI;
    const cand = pickSoftTarget(p.position, yaw, list, range, (this.classDef.ranged ? 0.45 : 0.9) * (touch ? 1.7 : 1));
    // on change de cible si la nouvelle est nettement mieux centrée
    if (!this.locked && (!this.target || (cand && cand !== this.target && this.elapsed - (this.lastCombat || 0) > 1.2))) this.target = cand || this.target;
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
      this.targetRing.material.color.set(this.locked ? '#7fe0ff' : t.elite ? '#ffd36b' : '#ff6b5e').multiplyScalar(2);
    }
    // réticule de verrouillage : quatre flèches qui tournent autour de la cible
    if (!this.lockMark) {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#7fe0ff').multiplyScalar(2.2), toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
      const geo = new THREE.ConeGeometry(0.22, 0.5, 3); geo.rotateZ(Math.PI / 2);
      for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(geo, mat); const a = i * Math.PI / 2; m.position.set(Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2); m.rotation.y = -a; g.add(m); }
      g.renderOrder = 6;
      this.scene.add(g);
      this.lockMark = g;
    }
    const lk = this.locked;
    this.lockMark.visible = !!lk;
    if (lk) {
      const k = lk.radius * 1.6 + 0.4 + Math.sin(this.elapsed * 5) * 0.08;
      this.lockMark.position.set(lk.position.x, lk.position.y + lk.height * 0.55, lk.position.z);
      this.lockMark.scale.setScalar(k);
      this.lockMark.rotation.y = this.elapsed * 1.6;
    }
    // boss engagé
    this.bossEngaged = null;
    for (const e of this.enemies.map.values()) if (e.def.boss && e.alive && Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) < 55) this.bossEngaged = e;
  }

  // ------------------------------------------------------------------ verrouillage de cible
  // Tab (PC) ou bouton cible (mobile) : verrouille l'ennemi le mieux placé, puis passe au suivant.
  lockNext() {
    const p = this.player;
    if (!p || p.dead) return;
    const d = (e) => Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z);
    const list = this.enemies.hittable().filter((e) => d(e) < 30).sort((a, b) => d(a) - d(b));
    if (!list.length) { if (this.locked) this.unlock(); else this.ui.toast('Aucun ennemi à portée.', { time: 1.5 }); return; }
    if (!this.locked) {
      const best = pickSoftTarget(p.position, this.rig.yaw + Math.PI, list, 30, 1.2) || list[0];
      this.lock(best);
      return;
    }
    const i = list.indexOf(this.locked);
    if (list.length === 1 && i === 0) { this.unlock(); return; }
    this.lock(list[(i + 1) % list.length]);
  }

  lock(e, quiet = false) {
    this.locked = e; this.target = e;
    if (!quiet) { this.audio?.play('select'); this.vibrate(12); }
  }

  unlock() { if (!this.locked) return; this.locked = null; this.audio?.play('select'); }

  vibrate(ms) { if (this.input.isTouch && this.settings.vibrate !== false) try { navigator.vibrate?.(ms); } catch { /* */ } }

  // options appliquées au héros et à la caméra
  applySettings() {
    const s = this.settings, rig = this.rig;
    rig.invertY = !!s.invertY;
    rig.sensitivity = 0.0023 * (s.sensitivity || 1);
    rig.baseFov = s.fov || 60;
    rig.shakeMult = s.shake === false ? 0 : 1;
    if (s.camDist) rig.targetDistance = rig.distance = s.camDist;
    document.documentElement.style.setProperty('--tbtn-scale', String(s.touchScale || 1));
    this.ui.root.classList.toggle('no-dmg-numbers', s.dmgNumbers === false);
    this.ui.root.classList.toggle('no-plates', s.plates === false);
  }

  updatePlates() {
    const ui = this.ui;
    for (const e of this.enemies.map.values()) {
      if (!e.alive && e.deadT > 1.5) continue;
      ui.setPlate({ id: e.id, position: e.position, height: e.height + 0.2, name: (e.elite ? '★ ' : '') + e.def.name + ' · ' + e.level, kind: e.elite || e.def.boss ? 'elite' : 'enemy', hpPct: e.alive ? Math.max(0, e.hpPct) : 0, hidden: e.def.boss, focus: e === this.target });
    }
    this.npcs?.plates(ui);
    this.villagers?.plates(ui);
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
      else if (ev.type === 'updraft') this.quests?.onEvent('updraft', {});
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
    if (p.invulnerable && opts.kind !== 'fall') {
      // esquive au dernier moment : ralenti et riposte critique
      if (p.dodge && p.dodge.t < 0.3 && source && this.elapsed - (this.perfectT ?? -9) > 1.5) this.perfectDodge();
      else this.ui.floatText(p.position.clone().setY(p.position.y + 2.4), 'Esquive', 'info');
      return;
    }
    let dmg = raw * (60 / (60 + hero.stats.def * 2.2)) * (0.9 + Math.random() * 0.2);
    if (p.mounted && opts.kind !== 'fall') this.mount?.dismount(); // un coup fait vider les étriers
    const wall = hero.hasBuff('shieldwall');
    if (wall && source) {
      dmg *= 1 - wall.reduce;
      this.fx.hit(p.position.clone().setY(p.position.y + 1.4), '#ffd36b', 0.6);
      this.audio?.play('block', p.position);
    }
    // autres protections (Égide divine, Bouclier d'éther, Cri de guerre…)
    for (const b of hero.buffs) if (b.reduce && b.id !== 'shieldwall') dmg *= 1 - b.reduce;
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
    p.char.hitFlash(opts.kind === 'chill' ? '#7fd0ff' : '#ff5040', 0.8);
    if (opts.kind === 'chill') {
      if (!hero.hasBuff('chill')) this.ui.toast('Vous êtes <b style="color:#9fd8ff">gelé</b> : vos mouvements ralentissent.', { time: 2, color: '#9fd8ff' });
      hero.addBuff('chill', 2.6, {}, { icon: 'frost', label: 'Gel' });
      this.fx.burst(p.position.clone().setY(p.position.y + 1.2), '#bfe8ff', { count: 14, speed: 3, size: 0.3, life: 0.6, gravity: 2 });
    }
    this.rig.shake(Math.min(0.5, dmg / hero.stats.hp * 3));
    if (dmg > hero.stats.hp * 0.04) this.vibrate(Math.min(60, 15 + dmg / hero.stats.hp * 200));
    this.audio?.play('hurt', p.position);
    if (!wall && !p.char.oneShot && dmg > hero.stats.hp * 0.08) p.char.playAction('Hit_A', { timeScale: 1.8 });
    if (hero.hp <= 0) this.die(source, opts);
  }

  perfectDodge() {
    const p = this.player, hero = this.hero;
    this.perfectT = this.elapsed;
    this.slowMo(0.75, 0.3);
    hero.addBuff('riposte', 3, {}, { icon: 'blink', label: 'Riposte' });
    p.stamina = Math.min(100, p.stamina + 25);
    this.ui.floatText(p.position.clone().setY(p.position.y + 2.6), 'Esquive parfaite !', 'crit', { scale: 1.05 });
    this.fx.ring(p.position.clone().setY(p.position.y + 0.15), '#bfe8ff', { from: 0.5, to: 3.5, life: 0.5 });
    this.audio?.play('blink', p.position);
    this.rig.fovKick = 5;
    if (!this.perfectHint) { this.perfectHint = true; this.ui.toast('<b>Esquive parfaite</b> : votre prochain coup est un critique renforcé.', { time: 3.5 }); }
  }

  // séries d'éliminations : bonus d'expérience croissant
  killStreak() {
    const now = this.elapsed;
    this.streak = now - (this.streakT ?? -99) < 4.5 ? (this.streak || 1) + 1 : 1;
    this.streakT = now;
    const names = { 2: 'Doublé !', 3: 'Triplé !', 4: 'Quadruplé !', 5: 'Carnage !' };
    const n = this.streak;
    if (n >= 2) {
      const p = this.player.position;
      this.ui.floatText(p.clone().setY(p.y + 3.2), names[Math.min(5, n)] || `Série ×${n}`, 'crit', { scale: 0.9 + Math.min(0.5, n * 0.08), rise: 1.6 });
      if (n === 3 || n === 5 || n % 5 === 0) this.audio?.play('epic', p);
    }
    return 1 + Math.min(0.5, Math.max(0, n - 1) * 0.1);
  }

  onDamageDealt(e, r, opts) {
    const pos = e.position.clone().setY(e.position.y + e.height + 0.3);
    // vol de vie (objets mythiques)
    const leech = this.hero?.stats.leech || 0;
    if (leech > 0 && !this.player.dead) this.healSelf(Math.max(1, Math.round(r.amount * leech / 100)), false);
    this.ui.floatText(pos, String(r.amount), r.crit ? 'crit' : 'dmg', { scale: r.crit ? 1.1 : 1 });
    let ls = 0;
    for (const b of this.hero.buffs) if (b.lifesteal > ls) ls = b.lifesteal;
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
    // bonus d'expérience (repas, repos…)
    let xpB = 1;
    for (const b of hero.buffs) if (b.xpBonus) xpB += b.xpBonus;
    const streak = k.remote ? 1 : this.killStreak();
    const xp = Math.round(k.xp * (diff < -5 ? 0.3 : diff < -2 ? 0.7 : diff > 2 ? 1.25 : 1) * xpB * streak);
    hero.kills++;
    this.rooms?.onKill(k);
    const pos = new THREE.Vector3(k.x, k.y + 2.6, k.z);
    this.ui.floatText(pos, `+${xp} xp`, 'xp', { rise: 2.2, life: 1.6 });
    this.gainXp(xp);
    // butin personnel
    const lp = new THREE.Vector3(k.x, k.y, k.z);
    const gold = Math.round((2 + k.level * 1.5) * (k.elite ? 3 : 1) * (0.6 + Math.random() * 0.8)) * (k.boss ? 20 : 1);
    this.loot.drop(lp, { gold });
    if (Math.random() < (k.boss ? 1 : k.elite ? 0.8 : 0.16)) {
      const it = generateItem(hero.classId, k.level, { rarity: k.boss ? (Math.random() < 0.12 ? 4 : 3) : k.elite ? Math.max(1, rollRarity(Math.random, 1)) : rollRarity() });
      this.loot.drop(lp, { item: it });
      if (k.boss) this.loot.drop(lp, { item: generateItem(hero.classId, k.level, { rarity: 2 }) });
    }
    if (Math.random() < 0.09) this.loot.drop(lp, { potion: Math.random() < 0.65 ? 'hp' : 'mp' });
    // coffres : toujours sur un boss, parfois sur une élite ou un monstre
    if (k.boss) this.loot.drop(lp, { chest: Math.random() < 0.15 ? 'mythique' : 'or' });
    else if (k.elite && Math.random() < 0.18) this.loot.drop(lp, { chest: Math.random() < 0.25 ? 'fer' : 'bois' });
    else if (!k.exp && Math.random() < 0.012) this.loot.drop(lp, { chest: 'bois' });
    this.quests?.onEvent('kill', k);
    this.worldState?.onKill(k);
    this.save?.soon();
  }

  gainXp(xp) {
    const hero = this.hero;
    const before = new Set(hero.unlocked());
    const lv = hero.addXp(xp);
    if (lv) {
      const fresh = hero.unlocked().filter((id) => !before.has(id));
      const added = hero.fillBar();
      this.fx.levelUp(this.player);
      this.ui.announce('Niveau ' + hero.level, fresh.length ? 'Nouvelle compétence : ' + fresh.map((id) => ABILITIES[id].name).join(', ') : 'Votre lumière grandit.', 3.2);
      for (const id of fresh) {
        const slot = hero.bar.indexOf(id);
        this.ui.toast(slot >= 0
          ? `<b>${ABILITIES[id].name}</b> rejoint votre barre${this.input.isTouch ? '' : ` (touche ${slot + 1})`}.`
          : `<b>${ABILITIES[id].name}</b> est apprise : placez-la dans votre barre depuis le grimoire (${this.input.isTouch ? 'menu ☰' : 'touche K'}).`, { time: 5, color: '#ffe3a3' });
      }
      if (fresh.length || added.length) this.onBarChanged();
      this.audio?.play('levelup');
      this.net?.announce?.('levelup', { level: hero.level });
      this.quests?.onEvent('level', { level: hero.level });
      this.save?.soon(0.5);
    }
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
  // bannière à l'entrée d'une nouvelle zone (après quelques secondes passées dedans)
  checkZoneEntry(dt) {
    this.zoneT = (this.zoneT || 0) - dt;
    if (this.zoneT > 0) return;
    this.zoneT = 0.5;
    const p = this.player.position;
    if (p.x > 3000 || this.player.dead) return;
    const zn = zoneAt(p.x, p.z);
    const id = zn?.id || null;
    if (id !== this.zoneCand) { this.zoneCand = id; this.zoneStable = 0; return; }
    this.zoneStable += 0.5;
    if (this.zoneStable < 1.5 || id === this.zoneShown) return;
    const first = this.zoneShown === undefined;
    this.zoneShown = id;
    if (!zn || first) return;
    const lv = `Niveaux ${zn.level[0]} à ${zn.level[1]}`;
    const warn = this.hero.level < zn.level[0] - 2 ? ' · Danger !' : '';
    this.ui.announce(zn.n ? `Zone ${zn.n} — ${zn.name}` : zn.name, (zn.n ? '' : 'Terres sauvages · ') + lv + warn, 3.2);
    this.audio?.play?.('discover');
  }

  currentZone() {
    const p = this.player.position;
    const t = this.world.terrain;
    const room = this.rooms?.current();
    if (room) return { name: ROOMS[room]?.name || 'Intérieur', sub: `${this.rooms.inside?.door?.where || 'Havrelumière'} · à l’abri` };
    if (p.x > 3500) { const P = platformAt(p.x, p.z); return { name: P?.name || 'La Citadelle des Ombres', sub: 'Citadelle des Ombres' }; }
    const zone = zoneAt(p.x, p.z);
    const lv = zone ? `niv. ${zone.level[0]}–${zone.level[1]}` : '';
    const tag = zone ? (zone.n ? `Zone ${zone.n} · ${lv}` : `Terres sauvages · ${lv}`) : '';
    if (!t.isLand(p.x, p.z)) return { name: 'La Mer d’Azur', sub: zone ? 'au large · ' + zone.name : 'au large', zone };
    for (const [o, r, sub] of placeList()) if (Math.hypot(p.x - o.x, p.z - o.z) < r) return { name: o.name, sub: sub || `${zone?.name || ''} · ${lv}`, zone };
    return { name: zone?.name || 'Terres d’Aetheria', sub: tag, zone };
  }

  mapMarkers() {
    const out = [];
    this.npcs?.markers(out);
    this.quests?.markers(out);
    this.echoes?.markers?.(out);
    return out;
  }
}

// compétences lancées sur soi (le héros ne se tourne pas vers sa cible)
const SELF_CAST = new Set(['blink', 'roll', 'shieldwall', 'rally', 'rage', 'smoke', 'frostnova', 'whirlwind', 'warcry', 'bloodlust', 'divineshield', 'avatar', 'manashield', 'poison', 'consecrate', 'quake', 'fan', 'trap']);

// lieux nommés du continent : [objet {name, x, z}, rayon, sous-titre (sinon zone et niveaux)]
let PLACES = null;
function placeList() {
  if (PLACES) return PLACES;
  PLACES = [[VILLAGE, VILLAGE.radius + 10, 'havre de paix'], [HAMLET, HAMLET.radius + 12, 'hameau · sûr'], [LAKE, LAKE.radius * 1.6], [RUINS, RUINS.radius * 1.3], [MOUNTAIN, MOUNTAIN.radius * 0.75], [HILLS, HILLS.radius * 0.8], [FOREST, FOREST.radius * 0.8]];
  for (const d of REGIONS) {
    if (d.camp) PLACES.push([d.camp, d.camp.radius + 10, 'campement · sûr']);
    for (const k of ['crypt', 'cirque', 'sanctuary', 'temple', 'cemetery', 'table', 'belvedere', 'mine', 'headland']) if (d[k]?.name) PLACES.push([d[k], (d[k].radius || 30) * (k === 'crypt' || k === 'cirque' ? 1.6 : 1.8), k === 'crypt' ? 'arène du Fossoyeur' : k === 'cirque' ? 'arène du Colosse' : null]);
    if (d.lake?.name) PLACES.push([d.lake, d.lake.radius * 1.6]);
    if (d.peak?.name) PLACES.push([d.peak, d.peak.radius * 0.7]);
  }
  return PLACES;
}

export { basicVisual };
