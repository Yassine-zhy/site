import * as THREE from 'three';
import { STEP_UP } from '../world/Colliders.js';
import { Character } from './Character.js';
import { createGlider } from './Glider.js';
import { clamp, damp, dampAngle, angleDiff, smoothstep } from '../engine/math.js';
import { CLASSES, UPDRAFTS, WATERS, SEA_LEVEL, WORLD_HALF } from '../config.js';

const GRAVITY = 28;
const WALK = 2.9, RUN = 7.2, SPRINT = 10.6;
// pose en selle : jambes écartées et tombantes (corrige l'animation « assis sur une chaise »)
const RIDE = { spread: 0.55, drop: 0.75, knee: -0.55 };

// Héros contrôlé par le joueur : déplacements, saut, vol plané, esquive.
export class Player {
  constructor(game, classId, name) {
    this.game = game;
    this.cls = CLASSES[classId];
    this.classId = classId;
    this.name = name;
    this.char = new Character(game.assets, this.cls.model, { show: this.cls.weapons.show });
    this.object = this.char.object;
    this.glider = createGlider(this.cls.color, '#2b2350');
    this.object.add(this.glider);
    this.position = this.object.position;
    this.velocity = new THREE.Vector3();
    this.facing = 0;
    this.onGround = false;
    this.gliding = false;
    this.gliderOpen = 0;
    this.stamina = 100;
    this.sprinting = false;
    this.walkToggle = false;
    this.dodge = null;
    this.dash = null;
    this.locked = 0; // immobilisation (attaques lourdes)
    this.rooted = 0;
    this.speedMult = 1;
    this.airTime = 0;
    this.lastGround = new THREE.Vector3();
    this.inWater = false;
    this.inUpdraft = false;
    this.mounted = false;
    this.state = 'idle';
    this.locoName = null;
    this.radius = 0.55;
    this.dead = false;
    this.fallTime = 0;
    this.moveDir = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.events = [];
    this.stepPhase = 0;
    this.jumpBuffered = 0;
    this.coyote = 0;
    this.char.setLocomotion(this.cls.weapons.idle);
  }

  spawn(x, y, z, facing = 0) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.facing = facing;
    this.object.rotation.y = facing;
    this.gliding = false; this.dodge = null; this.dash = null; this.dead = false;
    this.lastGround.set(x, y, z);
  }

  emit(type, data) { this.events.push({ type, ...data }); }

  startDodge(dirX, dirZ) {
    if (this.dodge || !this.onGround || this.stamina < 18 || this.dead) return false;
    const l = Math.hypot(dirX, dirZ);
    if (l < 0.01) { dirX = Math.sin(this.facing); dirZ = Math.cos(this.facing); } else { dirX /= l; dirZ /= l; }
    this.stamina -= 18;
    // choisit l'animation selon la direction relative au regard
    const rel = angleDiff(this.facing, Math.atan2(dirX, dirZ));
    let anim = 'Dodge_Forward';
    if (Math.abs(rel) > 2.3) anim = 'Dodge_Backward';
    else if (rel > 0.7) anim = 'Dodge_Left';
    else if (rel < -0.7) anim = 'Dodge_Right';
    this.dodge = { t: 0, dur: 0.42, dx: dirX, dz: dirZ, speed: 15 };
    this.char.playAction(anim, { full: true, timeScale: 1.0 });
    this.emit('dodge');
    return true;
  }

  // Déplacement forcé (charge, clignement, roulade...)
  startDash(dirX, dirZ, distance, duration, opts = {}) {
    const l = Math.hypot(dirX, dirZ) || 1;
    this.dash = { t: 0, dur: duration, dx: dirX / l, dz: dirZ / l, speed: distance / duration, ...opts };
  }

  launch(vy, forward = 0) {
    this.velocity.y = vy;
    this.velocity.x += Math.sin(this.facing) * forward;
    this.velocity.z += Math.cos(this.facing) * forward;
    this.onGround = false;
    this.position.y += 0.1;
  }

  faceTowards(x, z, instant = false) {
    const a = Math.atan2(x - this.position.x, z - this.position.z);
    if (instant) this.facing = a; else this.targetFacing = a;
  }

  update(dt, input, rig) {
    const terrain = this.game.world.terrain;
    const pos = this.position, vel = this.velocity;
    if (this.dead) { this.char.update(dt); return; }

    // --- intention de déplacement (relative à la caméra)
    const mv = input.moveVector();
    const fwd = rig.forward(this.tmp);
    const rightX = -fwd.z, rightZ = fwd.x;
    let dx = fwd.x * mv.y + rightX * mv.x;
    let dz = fwd.z * mv.y + rightZ * mv.x;
    const mag = Math.min(1, Math.hypot(mv.x, mv.y));
    if (mag > 0.01) { const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
    this.moveDir.set(dx * mag, 0, dz * mag);

    if (input.pressed('walk')) this.walkToggle = !this.walkToggle;
    const wantSprint = input.is('sprint') && mag > 0.1 && !this.gliding;
    this.sprinting = wantSprint && this.stamina > 2 && this.onGround;
    if (this.sprinting) this.stamina = Math.max(0, this.stamina - 16 * dt);
    else this.stamina = Math.min(100, this.stamina + (this.onGround ? 22 : 8) * dt);

    if (input.pressed('dodge')) this.startDodge(this.moveDir.x, this.moveDir.z);

    const busy = this.locked > 0 || this.rooted > 0;
    this.locked = Math.max(0, this.locked - dt);
    this.rooted = Math.max(0, this.rooted - dt);

    let speed = this.walkToggle ? WALK : (this.sprinting ? SPRINT : RUN);
    if (this.mounted) speed = this.sprinting ? 26 : 18.5; // monture d'éther
    speed *= this.cls.base.speed * this.speedMult * (this.game.hero?.hasBuff('chill') ? 0.65 : 1);
    if (this.inWater) speed *= 0.55;
    if (this.attackSlow) speed *= this.attackSlow;

    // --- saut / planeur
    if (input.pressed('jump')) this.jumpBuffered = 0.15;
    this.jumpBuffered = Math.max(0, this.jumpBuffered - dt);
    this.coyote = this.onGround ? 0.12 : Math.max(0, this.coyote - dt);
    if (this.jumpBuffered > 0 && !busy) {
      if (this.onGround || this.coyote > 0) {
        vel.y = 10.8; this.onGround = false; this.coyote = 0; this.jumpBuffered = 0;
        this.char.playAction('Jump_Start', { full: true, timeScale: 1.4 });
        this.emit('jump');
      } else if (!this.gliding && this.airTime > 0.18) {
        if (this.mounted) this.game.mount?.dismount();
        this.gliding = true; this.jumpBuffered = 0;
        this.emit('glide', { open: true });
      } else if (this.gliding) {
        this.gliding = false; this.jumpBuffered = 0;
        this.emit('glide', { open: false });
      }
    }

    // --- vitesse horizontale
    let targetVX = this.moveDir.x * speed, targetVZ = this.moveDir.z * speed;
    if (busy) { targetVX *= this.rooted > 0 ? 0 : 0.25; targetVZ *= this.rooted > 0 ? 0 : 0.25; }
    if (this.gliding) {
      const gs = 12.5 * this.speedMult;
      const hdx = Math.sin(this.facing), hdz = Math.cos(this.facing);
      targetVX = hdx * gs * (0.55 + 0.45 * Math.max(mag, 0.4)) + this.moveDir.x * 3;
      targetVZ = hdz * gs * (0.55 + 0.45 * Math.max(mag, 0.4)) + this.moveDir.z * 3;
    }
    const accel = this.onGround ? 14 : (this.gliding ? 2.2 : 3.2);
    vel.x = damp(vel.x, targetVX, accel, dt);
    vel.z = damp(vel.z, targetVZ, accel, dt);

    if (this.dodge) {
      const d = this.dodge; d.t += dt;
      const f = 1 - d.t / d.dur;
      vel.x = d.dx * d.speed * (0.4 + f); vel.z = d.dz * d.speed * (0.4 + f);
      this.invulnerable = d.t < d.dur * 0.8;
      if (d.t >= d.dur) { this.dodge = null; this.invulnerable = false; }
    }
    if (this.dash) {
      const d = this.dash; d.t += dt;
      vel.x = d.dx * d.speed; vel.z = d.dz * d.speed;
      if (d.noGravity) vel.y = 0;
      d.onTick?.(d);
      if (d.t >= d.dur) { this.dash = null; d.onEnd?.(); vel.x *= 0.3; vel.z *= 0.3; }
    }

    // --- gravité, planeur, courants ascendants
    const wasUpdraft = this.inUpdraft;
    this.inUpdraft = false;
    for (const u of UPDRAFTS) {
      if (Math.hypot(pos.x - u.x, pos.z - u.z) < u.radius && pos.y < u.top) { this.inUpdraft = u; break; }
    }
    if (this.inUpdraft && !wasUpdraft && !this.onGround) this.emit('updraft', {});
    if (!this.onGround) {
      if (this.gliding) {
        vel.y = damp(vel.y, -2.6, 3, dt);
        if (this.inUpdraft) vel.y = Math.min(vel.y + 42 * dt, 13);
      } else {
        vel.y -= GRAVITY * dt;
        if (this.inUpdraft) vel.y = Math.min(vel.y + 60 * dt, 9);
      }
      vel.y = Math.max(vel.y, -45);
    } else if (this.inUpdraft && input.is('jump')) {
      vel.y = 12; this.onGround = false;
    }

    // --- intégration
    const prevY = pos.y;
    pos.y += vel.y * dt;
    // collisions horizontales, par petits pas (pas de traversée des parois fines)
    const cols = this.game.world.colliders;
    cols.moveAndCollide(pos, vel.x * dt, vel.z * dt, this.radius, pos.y);
    this.separateFromCrowd(pos);

    // sol : relief, ou dessus d'un obstacle bas (caisse, rocher, muret)
    let ground = terrain.groundBelow(pos.x, Math.max(pos.y, prevY), pos.z);
    const top = cols.surfaceAt(pos.x, pos.z, Math.max(pos.y, prevY) + STEP_UP + 0.05);
    if (top !== null && (ground === null || top > ground)) ground = top;
    this.inWater = false;
    let floor = ground;
    const lake = ground !== null && WATERS.find((w) => Math.hypot(pos.x - w.x, pos.z - w.z) < w.radius * 1.8 && ground < w.level - 0.9);
    // la mer : on nage à la surface ; au large, le courant ramène vers le rivage
    const sea = !lake && ground !== null && ground < SEA_LEVEL - 0.9 && pos.x < 3000;
    this.atSea = false;
    if (lake) {
      floor = Math.max(ground, lake.level - 1.5); this.inWater = true;
    } else if (sea) {
      floor = Math.max(ground, SEA_LEVEL - 1.5); this.inWater = true;
      const depth = SEA_LEVEL - ground;
      if (depth > 12 && pos.y < SEA_LEVEL + 2) {
        this.atSea = true;
        const e = 8, ch = (x, z) => terrain.continentHeight(x, z);
        let gx = ch(pos.x + e, pos.z) - ch(pos.x - e, pos.z), gz = ch(pos.x, pos.z + e) - ch(pos.x, pos.z - e);
        if (Math.hypot(gx, gz) < 0.05) { gx = -pos.x; gz = -pos.z; }
        const L = Math.hypot(gx, gz) || 1, k = smoothstep(12, 32, depth) * 9;
        pos.x += gx / L * k * dt; pos.z += gz / L * k * dt;
      }
    }
    if (pos.x < 3000) { const lim = WORLD_HALF - 15; pos.x = clamp(pos.x, -lim, lim); pos.z = clamp(pos.z, -lim, lim); }
    const wasGround = this.onGround;
    this.char.groundOffset = floor === null ? 99 : Math.max(0, pos.y - floor);
    if (floor !== null && pos.y <= floor + 0.02 && vel.y <= 0.5) {
      // pente trop raide : glissade
      const slope = terrain.slopeAt(pos.x, pos.z);
      if (slope > 0.95 && !this.inWater) {
        const e = 1.0;
        const hx = (terrain.heightAt(pos.x + e, pos.z) ?? floor) - (terrain.heightAt(pos.x - e, pos.z) ?? floor);
        const hz = (terrain.heightAt(pos.x, pos.z + e) ?? floor) - (terrain.heightAt(pos.x, pos.z - e) ?? floor);
        vel.x -= hx * 9 * dt * 10; vel.z -= hz * 9 * dt * 10;
      }
      pos.y = floor;
      if (!wasGround) {
        const impact = -vel.y;
        if (impact > 6) { this.char.playAction('Jump_Land', { full: false, timeScale: 1.6 }); this.emit('land', { impact }); }
        if (this.gliding) this.emit('glide', { open: false });
      }
      vel.y = 0; this.onGround = true; this.gliding = false; this.airTime = 0;
      this.lastGround.copy(pos);
    } else {
      if (wasGround && floor !== null && pos.y - floor < 0.6 && vel.y <= 0) {
        // descente de petite marche : on colle au sol
        pos.y = floor; this.onGround = true;
      } else {
        this.onGround = false; this.airTime += dt;
      }
    }

    // --- orientation
    const hs = Math.hypot(vel.x, vel.z);
    if (this.targetFacing !== undefined && this.targetFacing !== null) {
      this.facing = dampAngle(this.facing, this.targetFacing, 18, dt);
      if (Math.abs(angleDiff(this.facing, this.targetFacing)) < 0.02) this.targetFacing = null;
    } else if (this.gliding && mag > 0.1) {
      this.facing = dampAngle(this.facing, Math.atan2(this.moveDir.x, this.moveDir.z), 2.2, dt);
    } else if (mag > 0.1 && !this.dodge && !busy) {
      this.facing = dampAngle(this.facing, Math.atan2(this.moveDir.x, this.moveDir.z), 12, dt);
    }
    this.object.rotation.y = this.facing;

    // --- planeur visuel
    this.gliderOpen = damp(this.gliderOpen, this.gliding ? 1 : 0, 9, dt);
    this.glider.visible = this.gliderOpen > 0.02;
    this.glider.scale.set(this.gliderOpen, 0.3 + this.gliderOpen * 0.7, 1);
    this.glider.rotation.z = clamp(-angleDiff(this.facing, Math.atan2(this.moveDir.x || Math.sin(this.facing), this.moveDir.z || Math.cos(this.facing))) * 0.4, -0.35, 0.35);

    // --- animation de locomotion
    let loco;
    const ratio = hs / RUN;
    if (this.mounted) loco = 'Sit_Chair_Idle';
    else if (this.gliding) loco = 'Jump_Idle';
    else if (!this.onGround && this.airTime > 0.25) loco = 'Jump_Idle';
    else if (hs < 0.4) loco = this.combatIdle > 0 ? this.cls.weapons.idle === 'Idle' ? '2H_Melee_Idle' : this.cls.weapons.idle : this.cls.weapons.idle;
    else if (this.walkToggle || hs < 3.6) loco = 'Walking_A';
    else loco = this.sprinting ? 'Running_B' : 'Running_A';
    let ts = 1;
    if (loco === 'Walking_A') ts = clamp(hs / 2.9, 0.5, 1.6);
    else if (loco.startsWith('Running')) ts = clamp(hs / (loco === 'Running_B' ? 9 : 6.6), 0.6, 1.6);
    if (this.mounted) ts = 1;
    if (!this.dodge) this.char.setLocomotion(loco, ts);
    this.char.legPose = this.mounted ? RIDE : null;
    this.combatIdle = Math.max(0, (this.combatIdle || 0) - dt);
    this.state = loco;

    // pas (pour l'audio)
    if (this.onGround && hs > 1) {
      this.stepPhase += dt * ts * (loco.startsWith('Running') ? 2.5 : 1.9);
      if (this.stepPhase >= 1) { this.stepPhase -= 1; this.emit('step', { water: this.inWater }); }
    }

    this.char.update(dt);
  }

  // les squelettes et les habitants sont solides : on ne les traverse pas
  separateFromCrowd(pos) {
    const g = this.game;
    if (this.dodge || this.dash) return;
    const push = (x, z, r) => {
      const dx = pos.x - x, dz = pos.z - z, d = Math.hypot(dx, dz), m = r + this.radius;
      if (d < m && d > 1e-4) { pos.x = x + dx / d * m; pos.z = z + dz / d * m; }
    };
    for (const e of g.enemies?.map.values() || []) {
      if (!e.alive || e.state === 'spawn' || Math.abs(e.position.y - pos.y) > 2) continue;
      if (Math.abs(e.position.x - pos.x) > 6 || Math.abs(e.position.z - pos.z) > 6) continue;
      push(e.position.x, e.position.z, (e.radius || 0.6) * 0.85);
    }
  }
}
