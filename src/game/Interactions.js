import * as THREE from 'three';
import { ISLETS } from '../config.js';
import { generateItem } from './Items.js';

const CHESTS = [
  { id: 'tresor', islet: 1, gold: 180, rarity: 3, dx: 2, dz: -3 },
  { id: 'suspendu', islet: 2, gold: 60, rarity: 1, dx: -3, dz: 2 },
  { id: 'pelerin', islet: 3, gold: 140, rarity: 2, dx: 1, dz: 3 },
  { id: 'eclat', islet: 4, gold: 90, rarity: 2, dx: 0, dz: 0 },
];

// Interactions contextuelles (touche E) : habitants, échos, phares, coffres.
export class Interactions {
  constructor(game) {
    this.game = game;
    this.channel = null;
    this.beaconCd = {};
    this.chests = CHESTS.map((c) => {
      const isl = ISLETS[c.islet];
      const x = isl.x + c.dx, z = isl.z + c.dz;
      const y = game.world.terrain.heightAt(x, z) ?? isl.baseY;
      const obj = game.assets.prop('chest_gold');
      obj.position.set(x, y, z);
      obj.rotation.y = Math.random() * Math.PI * 2;
      game.scene.add(obj);
      game.world.colliders.addCircle(x, z, 1.1, y - 1, y + 2, 'prop');
      return { ...c, x, y, z, obj };
    });
  }

  target() {
    const g = this.game, p = g.player;
    if (!p || p.dead) return null;
    const pos = p.position;
    if (this.task) return { kind: 'busy', text: `${this.task.label}… ${Math.round(this.task.t / this.task.dur * 100)} %` };
    const ex = g.expedition?.target(pos);
    if (ex) return ex;
    const npc = g.npcs?.nearest(pos, 3.8);
    if (npc) return { kind: 'npc', npc, text: `Parler à ${npc.name}` };
    const ec = g.echoes?.nearest(pos, 2.6);
    if (ec) return ec.kind === 'echo'
      ? { kind: 'echo', key: ec.key, text: ec.it.uid === g.echoes.uid ? 'Votre écho' : `Faire résonner l’écho de ${ec.it.e.n}` }
      : { kind: 'ghost', key: ec.key, text: `Revoir la chute de ${ec.it.g.n}` };
    const ws = g.waystones?.nearest(pos, 3.6);
    if (ws) return { kind: 'waystone', ws, text: g.waystones.known(ws.id) ? `Voyager · ${ws.name}` : `Éveiller la pierre de passage · ${ws.name}` };
    for (const c of this.chests) {
      if (g.hero.discovered['chest:' + c.id]) continue;
      if (Math.hypot(pos.x - c.x, pos.z - c.z) < 3) return { kind: 'chest', chest: c, text: 'Ouvrir le coffre' };
    }
    const bc = g.world.beacons?.nearest(pos, 9);
    if (bc) {
      const i = g.world.beacons.list.indexOf(bc);
      const lv = Math.round((g.worldState?.levels[i] || 0) * 100);
      const cd = this.beaconCd[bc.def.id] || 0;
      if (this.channel) return { kind: 'busy', text: 'Canalisation…' };
      return { kind: 'beacon', bc, i, text: cd > 0 ? `${bc.def.name} · ${lv} % (repos ${Math.ceil(cd)} s)` : `Canaliser la lumière · ${bc.def.name} ${lv} %` };
    }
    return null;
  }

  prompt() { const t = this.target(); this.current = t; return t ? t.text : ''; }

  interact() {
    const g = this.game, t = this.current || this.target();
    if (!t) return;
    if (t.kind === 'npc') g.dialogue.open(t.npc);
    else if (t.kind === 'echo') g.echoes.resonate(t.key);
    else if (t.kind === 'ghost') g.echoes.playGhost(t.key);
    else if (t.kind === 'chest') this.openChest(t.chest);
    else if (t.kind === 'beacon') this.startChannel(t);
    else if (t.kind === 'waystone') g.waystones.open(t.ws);
    else if (t.kind === 'expexit') g.expedition.leave();
    else if (t.kind === 'expportal') g.windows.open('party');
    else if (t.kind === 'expobj') this.startTask({ dur: 2.2, label: t.text, onDone: () => g.expedition.completeObject(t.i) });
  }

  openChest(c) {
    const g = this.game;
    g.hero.discovered['chest:' + c.id] = true;
    const p = new THREE.Vector3(c.x, c.y, c.z);
    g.fx.beam(p, '#ffd36b', { height: 20, radius: 1.5, life: 1.2 });
    g.fx.burst(p.clone().setY(c.y + 1), '#ffe08a', { count: 50, speed: 7, size: 0.35, life: 1, gravity: 6, up: 6 });
    g.audio?.play('epic', p);
    g.loot.drop(p, { gold: c.gold });
    g.loot.drop(p, { item: generateItem(g.hero.classId, Math.max(g.hero.level, 4), { rarity: c.rarity }) });
    g.loot.drop(p, { potion: 'hp' });
    c.obj.scale.setScalar(0.001);
    g.ui.announce('Coffre céleste', 'Le vent garde bien ses trésors…', 2.5);
    g.save?.soon();
  }

  startChannel(t) {
    const g = this.game;
    if ((this.beaconCd[t.bc.def.id] || 0) > 0) { g.ui.toast('Le phare a besoin d’un instant avant de recevoir à nouveau votre lumière.'); return; }
    if ((g.worldState?.levels[t.i] || 0) >= 0.999) { g.ui.toast(`${t.bc.def.name} brille déjà de tous ses feux.`); return; }
    this.channel = { t: 0, dur: 2.6, bc: t.bc, i: t.i, start: g.player.position.clone() };
    g.player.char.playLoop('Spellcasting', { full: true });
    g.player.rooted = 2.7;
    g.audio?.play('cast', g.player.position);
  }

  // action à maintenir quelques secondes sans bouger (autels, braseros…)
  startTask(task) {
    const g = this.game, p = g.player;
    this.task = { t: 0, start: p.position.clone(), ...task };
    p.char.playLoop('Spellcasting', { full: true });
    p.rooted = task.dur + 0.1;
    g.audio?.play('cast', p.position);
  }

  updateTask(dt) {
    const g = this.game, p = g.player, k = this.task;
    k.t += dt;
    if (Math.random() < dt * 30) g.fx.sparkle(p.position, '#ffe08a', 1.2, 1, 0.25);
    if (p.dead || p.position.distanceTo(k.start) > 1.5) { this.task = null; p.char.stopAction(); p.rooted = 0; g.ui.toast('Action interrompue.'); return; }
    if (k.t >= k.dur) { this.task = null; p.char.stopAction(); p.rooted = 0; k.onDone?.(); }
  }

  update(dt) {
    const g = this.game;
    if (this.task) this.updateTask(dt);
    for (const k of Object.keys(this.beaconCd)) this.beaconCd[k] = Math.max(0, this.beaconCd[k] - dt);
    for (const c of this.chests) if (!g.hero.discovered['chest:' + c.id] && Math.random() < dt * 3) g.fx.sparkle(new THREE.Vector3(c.x, c.y + 0.5, c.z), '#ffe08a', 1, 1, 0.2);
    const ch = this.channel;
    if (!ch) return;
    const p = g.player;
    ch.t += dt;
    const from = p.position.clone().setY(p.position.y + 1.6);
    const to = new THREE.Vector3(ch.bc.def.x, ch.bc.y + 6, ch.bc.def.z);
    for (let k = 0; k < 3; k++) {
      const f = Math.random();
      const q = from.clone().lerp(to, f); q.y += Math.sin(f * Math.PI) * 2;
      g.fx.sparkle(q, '#ffe08a', 0.3, 1, 0.22);
    }
    if (p.dead || p.position.distanceTo(ch.start) > 1.5 || g.elapsed - g.lastCombat < 0.2) {
      this.channel = null; p.char.stopAction(); p.rooted = 0;
      g.ui.toast('Canalisation interrompue.');
      return;
    }
    if (ch.t >= ch.dur) {
      this.channel = null;
      p.char.stopAction(); p.rooted = 0;
      const amount = 4 + g.hero.level * 0.15;
      g.worldState?.add(ch.i, amount, 'channel');
      this.beaconCd[ch.bc.def.id] = 14;
      g.fx.lightning(from, to, '#ffe08a', { jitter: 0.6 });
      g.fx.ring(to.clone().setY(ch.bc.y + 1.3), '#ffe08a', { to: 5, life: 0.7 });
      g.audio?.play('runeok', to);
    }
  }
}
