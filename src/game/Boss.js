import * as THREE from 'three';
import { BOSS } from '../config.js';
import { angleDiff } from '../engine/math.js';

// Le Roi Sans Lumière : boss du sommet, simulé par l'hôte comme les autres squelettes.
export class Boss {
  constructor(game) {
    this.game = game;
    this.respawnAt = 0;
    this.summoned = new Set();
    this.aura = null;
  }

  find() { for (const e of this.game.enemies.map.values()) if (e.def.boss) return e; return null; }

  update(dt) {
    const g = this.game;
    const boss = this.find();
    this.updateAura(boss, dt);
    if (!g.enemies.isHost) return;
    if (!boss) {
      if (Date.now() < this.respawnAt) return;
      const players = g.playerTargets();
      const near = players.filter((p) => Math.hypot(p.position.x - BOSS.x, p.position.z - BOSS.z) < 75 && p.position.y > 45);
      if (!near.length) return;
      const e = g.enemies.spawn('boss', BOSS.level, BOSS.x, BOSS.z, { home: { x: BOSS.x, z: BOSS.z } });
      const scale = 1 + 0.65 * Math.max(0, near.length - 1);
      e.maxHp = Math.round(e.maxHp * scale); e.hp = e.maxHp;
      e.radius = 1.6; e.height = 6.4;
      this.summoned.clear();
      g.enemies.fx('bossSpawn', e.position);
      return;
    }
    if (!boss.alive) {
      if (!boss.handled) { boss.handled = true; this.respawnAt = Date.now() + BOSS.respawnMinutes * 60000; g.enemies.fx('bossDown', boss.position); }
      return;
    }
    // invocations aux seuils de vie
    for (const th of [0.7, 0.4, 0.15]) {
      if (boss.hpPct < th && !this.summoned.has(th)) {
        this.summoned.add(th);
        for (let i = 0; i < 4; i++) {
          const a = i / 4 * Math.PI * 2 + Math.random();
          const x = boss.position.x + Math.cos(a) * 8, z = boss.position.z + Math.sin(a) * 8;
          if (g.world.terrain.heightAt(x, z) === null) continue;
          g.enemies.spawn(i % 2 ? 'warrior' : 'minion', BOSS.level - 4, x, z, { home: { x: BOSS.x, z: BOSS.z } });
        }
        g.enemies.fx('bossSummon', boss.position);
      }
    }
  }

  chooseAttack(e, tgt) {
    const g = this.game, en = g.enemies;
    const enraged = e.hpPct < 0.25;
    if (enraged) e.attackCd *= 0.7;
    const d = Math.hypot(tgt.position.x - e.position.x, tgt.position.z - e.position.z);
    const roll = Math.random();
    const phase2 = e.hpPct < 0.5;
    if (phase2 && roll < 0.25) {
      // vagues de ténèbres : trois anneaux qui s'étendent
      e.char.playAction('Spellcast_Summon', { full: true, timeScale: 1.6 });
      e.casting = 2.2;
      const c = e.position.clone();
      en.fx('bossWaves', c);
      e.pending = { t: 0.9, custom: (b, players) => {
        for (let w = 0; w < 3; w++) g.schedule(w * 0.55, () => {
          const r = 6 + w * 6;
          for (const p of g.playerTargets()) {
            const pd = Math.hypot(p.position.x - c.x, p.position.z - c.z);
            if (Math.abs(pd - r) < 2.2 && p.position.y < c.y + 3) g.hurtPlayer(p.id, b.atk * 0.9, b, { kind: 'boss' });
          }
        });
      } };
      return;
    }
    if (roll < 0.55 || d > 7) {
      // onde d'ombre : zone d'impact annoncée
      e.char.playAction('1H_Melee_Attack_Jump_Chop', { full: true, timeScale: 0.75 });
      e.casting = 1.7;
      const p = d > 7 ? tgt.position.clone() : e.position.clone();
      const r = d > 7 ? 6 : 9;
      en.fx('telegraph', p, { r, d: 1.4 });
      e.pending = { t: 1.4, custom: (b) => {
        en.fx('bossSlam', p, { r });
        for (const pl of g.playerTargets()) if (Math.hypot(pl.position.x - p.x, pl.position.z - p.z) < r) g.hurtPlayer(pl.id, b.atk * 1.5, b, { kind: 'boss' });
      } };
      e.atkCount++;
      return;
    }
    if (roll < 0.75) {
      // tourbillon
      e.char.playAction('2H_Melee_Attack_Spin', { full: true, timeScale: 1 });
      e.casting = 2.4;
      en.fx('bossSpin', e.position);
      e.pending = { t: 0.3, custom: (b) => {
        for (let k = 0; k < 5; k++) g.schedule(k * 0.4, () => {
          if (!b.alive) return;
          for (const pl of g.playerTargets()) if (Math.hypot(pl.position.x - b.position.x, pl.position.z - b.position.z) < 6.5) g.hurtPlayer(pl.id, b.atk * 0.45, b, { kind: 'boss' });
        });
      } };
      e.atkCount++;
      return;
    }
    // fendoir frontal
    e.playAttack();
    e.pending = { t: 0.75, custom: (b) => {
      en.fx('swing', b.position, { rot: b.rot, boss: true });
      for (const pl of g.playerTargets()) {
        const dx = pl.position.x - b.position.x, dz = pl.position.z - b.position.z;
        if (Math.hypot(dx, dz) < 7.5 && Math.abs(angleDiff(b.rot, Math.atan2(dx, dz))) < 1.2) g.hurtPlayer(pl.id, b.atk * 1.2, b, { kind: 'boss' });
      }
    } };
  }

  playFx(ev, p) {
    const g = this.game, fx = g.fx;
    switch (ev.type) {
      case 'bossSpawn':
        fx.beam(p, '#8a3cff', { height: 60, radius: 5, life: 2.5 });
        fx.explosion(p, '#8a3cff', 7);
        g.ui.announce('Le Roi Sans Lumière', 'Il s’éveille au sommet du Pic du Silence.', 4);
        g.audio?.play('summon', p); g.shakeAt(p, 1);
        break;
      case 'bossDown':
        fx.beam(p, '#ffe7a0', { height: 120, radius: 6, life: 3 });
        fx.explosion(p, '#ffd36b', 9);
        g.ui.announce('Le Roi est tombé', 'La lumière remonte du Pic du Silence.', 5);
        g.audio?.play('beacon', p);
        g.chat?.system('✦ Le Roi Sans Lumière a été vaincu !');
        break;
      case 'bossSlam':
        fx.explosion(p, '#8a3cff', (ev.r || 8) * 0.8);
        fx.shockwave(p, '#b05cff', ev.r || 8);
        g.audio?.play('slam', p); g.shakeAt(p, 1);
        break;
      case 'bossSpin':
        for (let k = 0; k < 5; k++) g.schedule(k * 0.4, () => { fx.ring(p, '#b05cff', { from: 2, to: 6.5, life: 0.4 }); g.audio?.play('swoosh', p); });
        break;
      case 'bossWaves':
        g.audio?.play('summon', p);
        for (let w = 0; w < 3; w++) g.schedule(0.9 + w * 0.55, () => { fx.ring(p, '#8a3cff', { from: Math.max(1, 6 + w * 6 - 3), to: 6 + w * 6 + 1, life: 0.5, intensity: 3.5, thickness: 2 }); g.audio?.play('boom', p); });
        fx.telegraph(p, 18, 0.9, '#8a3cff');
        break;
      case 'bossSummon':
        fx.runeCircle(p, '#8a3cff', { radius: 10, life: 2 });
        g.audio?.play('summon', p);
        g.ui.toast('Le Roi appelle ses gardes !', { color: '#e2ccff' });
        break;
    }
  }

  updateAura(boss, dt) {
    const g = this.game;
    if (!boss || !boss.alive) { if (this.aura) { this.aura.removeFromParent(); this.aura = null; } return; }
    if (!this.aura) {
      this.aura = new THREE.PointLight('#9a4cff', 30, 30, 1.5);
      boss.object.add(this.aura);
      this.aura.position.y = 5;
      for (const m of boss.char.materials) if (m.name === 'Glow') { m.emissive.set('#c06bff'); m.emissiveIntensity = 5; m.userData.baseEmissive = m.emissive.clone(); m.userData.baseEmissiveIntensity = 5; }
    }
    if (Math.random() < dt * 25) {
      const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 2.5;
      g.fx.sparkle(new THREE.Vector3(boss.position.x + Math.cos(a) * r, boss.position.y + Math.random() * 4, boss.position.z + Math.sin(a) * r), '#9a4cff', 0.4, 1, 0.45);
    }
  }
}
