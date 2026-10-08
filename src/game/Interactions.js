import * as THREE from 'three';
import { CHEST_TIERS } from './Chests.js';

// Interactions contextuelles (touche E) : habitants, échos, phares, coffres.
export class Interactions {
  constructor(game) {
    this.game = game;
    this.channel = null;
    this.beaconCd = {};
  }

  target() {
    const g = this.game, p = g.player;
    if (!p || p.dead) return null;
    const pos = p.position;
    if (this.task) return { kind: 'busy', text: `${this.task.label}… ${Math.round(this.task.t / this.task.dur * 100)} %` };
    if (g.arenaFights?.wallPrompt) return { kind: 'busy', text: g.arenaFights.wallPrompt };
    const ex = g.expedition?.target(pos);
    if (ex) return ex;
    const npc = g.npcs?.nearest(pos, 3.8);
    if (npc) return { kind: 'npc', npc, text: `Parler à ${npc.name}` };
    const room = g.rooms?.target(pos);
    if (room) return room;
    const st = g.story?.steleNear(pos);
    if (st) return { kind: 'stele', st, text: g.story.lore?.steles[st.def.id] ? `Relire la stèle · ${st.def.title}` : 'Lire la stèle de mémoire' };
    const ec = g.echoes?.nearest(pos, 2.6);
    if (ec) return ec.kind === 'echo'
      ? { kind: 'echo', key: ec.key, text: ec.it.uid === g.echoes.uid ? 'Votre écho' : `Faire résonner l’écho de ${ec.it.e.n}` }
      : { kind: 'ghost', key: ec.key, text: `Revoir la chute de ${ec.it.g.n}` };
    const ws = g.waystones?.nearest(pos, 3.6);
    if (ws) return { kind: 'waystone', ws, text: g.waystones.known(ws.id) ? `Voyager · ${ws.name}` : `Éveiller la pierre de passage · ${ws.name}` };
    const sp = g.chests?.spotNear(pos);
    if (sp) return { kind: 'chest', spot: sp, text: `Ouvrir · ${CHEST_TIERS[sp.tier].name}` };
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
    else if (t.kind === 'room') g.rooms.use(t);
    else if (t.kind === 'stele') g.story.readStele(t.st);
    else if (t.kind === 'echo') g.echoes.resonate(t.key);
    else if (t.kind === 'ghost') g.echoes.playGhost(t.key);
    else if (t.kind === 'chest') this.startTask({ dur: 0.9, label: 'Ouverture', anim: 'Interact', onDone: () => g.chests.openSpot(t.spot) });
    else if (t.kind === 'beacon') this.startChannel(t);
    else if (t.kind === 'waystone') g.waystones.open(t.ws);
    else if (t.kind === 'expexit') g.expedition.leave();
    else if (t.kind === 'expportal') g.windows.open('party');
    else if (t.kind === 'expobj') this.startTask({ dur: 2.2, label: t.text, onDone: () => g.expedition.completeObject(t.i) });
  }

  startChannel(t) {
    const g = this.game;
    if ((this.beaconCd[t.bc.def.id] || 0) > 0) { g.ui.toast('Le phare a besoin d’un instant avant de recevoir à nouveau votre lumière.'); return; }
    if ((g.worldState?.levels[t.i] || 0) >= 0.999 && !g.quests?.wantsLight?.(t.bc.def.id)) { g.ui.toast(`${t.bc.def.name} brille déjà de tous ses feux.`); return; }
    this.channel = { t: 0, dur: 2.6, bc: t.bc, i: t.i, start: g.player.position.clone() };
    g.player.char.playLoop('Spellcasting', { full: true });
    g.player.rooted = 2.7;
    g.audio?.play('cast', g.player.position);
  }

  // action à maintenir quelques secondes sans bouger (autels, braseros…)
  startTask(task) {
    const g = this.game, p = g.player;
    this.task = { t: 0, start: p.position.clone(), ...task };
    p.char.playLoop(task.anim || 'Spellcasting', { full: true });
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
