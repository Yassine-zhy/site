import * as THREE from 'three';
import { Character } from '../entities/Character.js';
import { VILLAGE, HAMLET, GIVRE, AMBRE, SYLVE, HANTEE } from '../config.js';
import { dampAngle, mulberry32 } from '../engine/math.js';
import { SHARED } from '../world/SurfaceDetail.js';

// Villageois : des habitants sans quête qui vivent leur vie. Ils flânent entre les maisons et
// les échoppes, s'arrêtent pour discuter, saluent le héros qui passe, et rentrent chez eux à la
// nuit tombée (sauf les veilleurs, qui restent près des lanternes et des feux de camp).

const FIRST = ['Anselme', 'Bérénice', 'Corentin', 'Daphné', 'Eudes', 'Fleur', 'Gauvain', 'Héloïse', 'Isaure', 'Jehan', 'Lise', 'Mathis', 'Nolwenn', 'Odon', 'Perrine', 'Quentin', 'Rosalie', 'Sixtine', 'Thibaut', 'Ursule', 'Valère', 'Yvette', 'Aymeric', 'Clémence'];
const ROLES = {
  village: ['la boulangère', 'le meunier', 'la tisserande', 'le porteur d’eau', 'la lavandière', 'le menuisier', 'l’écuyer', 'la colporteuse', 'le tonnelier', 'la fileuse'],
  hamlet: ['le berger', 'la fermière', 'le faucheur'],
  givre: ['le trappeur', 'la guetteuse'],
  ambre: ['le caravanier', 'la mineuse'],
  sylve: ['la cueilleuse', 'le pisteur'],
  hantee: ['le veilleur', 'la pleureuse'],
};
const LINES = {
  day: ['Belle journée pour flâner, pas vrai ?', 'Les Phares brillent mieux depuis votre arrivée.', 'On dit que la Brume recule. Grâce à vous ?', 'Passez à la taverne, Gaspard sert un hydromel fameux.', 'Brom forge des merveilles, si vous avez de l’or.', 'Vous avez l’air d’en avoir vu, des choses !', 'Prenez garde aux monstres hors des chemins.', 'Les panneaux indiquent les niveaux des régions : écoutez-les !'],
  night: ['Il se fait tard… je rentre.', 'La nuit, les monstres sont plus nombreux.', 'Regardez les étoiles, elles n’ont jamais été si claires.', 'Bonne nuit, voyageur.'],
  givre: ['Couvrez-vous, le vent mord ici.', 'La Reine de Givre chante encore la nuit…'],
  ambre: ['Le sable entre partout, même dans les bottes.', 'Kessa a encore trouvé un filon !'],
  sylve: ['Écoutez les oiseaux… ils se taisent quand le Gardien gronde.', 'Ne vous perdez pas dans les lianes.'],
  hantee: ['Les morts sont agités ce soir.', 'Morwen veille sur nous. Faites-en autant.'],
};
const MODELS = ['rogue', 'mage', 'barbarian', 'knight', 'rogue_hooded'];
const TINTS = ['#ffe6c8', '#d8f0c8', '#f0d0e8', '#c8dcff', '#fff0b0', '#e8d0b8', '#d0e8e8', '#f8d8c0'];

const PLACES = [
  { id: 'village', x: VILLAGE.x, z: VILLAGE.z, r: 46, n: 9, homes: true },
  { id: 'hamlet', x: HAMLET.x, z: HAMLET.z, r: 26, n: 3, homes: true },
  { id: 'givre', x: GIVRE.camp.x, z: GIVRE.camp.z, r: 22, n: 2 },
  { id: 'ambre', x: AMBRE.camp.x, z: AMBRE.camp.z, r: 22, n: 2 },
  { id: 'sylve', x: SYLVE.camp.x, z: SYLVE.camp.z, r: 22, n: 2 },
  { id: 'hantee', x: HANTEE.camp.x, z: HANTEE.camp.z, r: 22, n: 2 },
];

const WALK = 1.35;

export class Villagers {
  constructor(game) {
    this.game = game;
    this.list = [];
    const rng = mulberry32(4242);
    const pick = (a) => a[Math.floor(rng() * a.length)];
    const buildings = game.scene.userData.buildings || [];
    let k = 0;
    const lite = SHARED.lite; // qualité basse : moins d'habitants animés
    this.viewD = lite ? 70 : 140;
    for (const pl of PLACES) {
      // portes des maisons de l'endroit (pour rentrer la nuit)
      const doors = buildings.filter((b) => Math.hypot(b.x - pl.x, b.z - pl.z) < pl.r + 25 && !/well|windmill|castle/.test(b.name))
        .map((b) => { const d = b.front + 0.6; return { x: b.x + Math.sin(b.rot) * d, z: b.z + Math.cos(b.rot) * d }; });
      const count = lite ? Math.max(1, Math.round(pl.n * 0.45)) : pl.n;
      for (let i = 0; i < count; i++) {
        const role = (ROLES[pl.id] || ROLES.village)[i % (ROLES[pl.id] || ROLES.village).length];
        const v = {
          id: 'v' + (k++), place: pl, name: FIRST[(k * 7 + i * 3) % FIRST.length], title: role,
          model: pick(MODELS), tint: pick(TINTS),
          home: doors.length ? doors[Math.floor(rng() * doors.length)] : null,
          // un sur trois veille la nuit (et tous ceux des camps)
          nightOwl: !pl.homes || rng() < 0.3,
          state: 'idle', t: 1 + rng() * 6, dest: null, facing: rng() * 6.28, char: null, fade: 1, bubble: '', bubbleT: 0, greetT: 0,
        };
        const s = this.freeSpot(pl, rng);
        v.position = new THREE.Vector3(s.x, game.world.terrain.heightAt(s.x, s.z), s.z);
        this.list.push(v);
      }
    }
    this.v = new THREE.Vector3();
  }

  // point libre (hors des bâtiments et des décors) dans le lieu
  freeSpot(pl, rnd = Math.random) {
    for (let k = 0; k < 30; k++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * pl.r;
      const x = pl.x + Math.cos(a) * r, z = pl.z + Math.sin(a) * r;
      if (!this.blocked(x, z, 1.0)) return { x, z };
    }
    return { x: pl.x + 4, z: pl.z + 4 };
  }

  blocked(x, z, margin = 0.6) {
    const t = this.game.world.terrain, cols = this.game.world.colliders;
    if (!t.isLand(x, z) || t.slopeAt(x, z) > 0.6) return true;
    for (const c of cols.grid.get(cols.key(Math.floor(x / 8), Math.floor(z / 8))) || []) if (c.tag !== 'npc' && cols.contains(c, x, z, margin)) return true;
    return false;
  }

  // chemin direct dégagé entre deux points ?
  clear(ax, az, bx, bz) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 1.2);
    for (let i = 1; i <= n; i++) { const f = i / n; if (this.blocked(ax + (bx - ax) * f, az + (bz - az) * f, 0.5)) return false; }
    return true;
  }

  ensureChar(v) {
    if (v.char) return;
    const ch = new Character(this.game.assets, v.model, { show: [], tint: v.tint });
    ch.object.position.copy(v.position);
    ch.setLocomotion('Idle');
    this.game.scene.add(ch.object);
    v.char = ch;
    v.position = ch.object.position;
  }

  say(v, list) {
    v.bubble = list[Math.floor(Math.random() * list.length)];
    v.bubbleT = 5;
  }

  update(dt) {
    const g = this.game, p = g.player?.position;
    if (!p) return;
    const night = g.world.sky.state.night > 0.6;
    for (const v of this.list) {
      const d = Math.hypot(p.x - v.position.x, p.z - v.position.z);
      // loin du héros : ni modèle ni animation
      if (d > this.viewD) { if (v.char) v.char.object.visible = false; continue; }
      this.ensureChar(v);
      const ch = v.char;
      // la nuit, les casaniers rentrent chez eux (et disparaissent derrière la porte)
      const goHome = night && !v.nightOwl && v.home;
      if (goHome && v.state !== 'home' && v.state !== 'homing') { v.state = 'homing'; v.dest = v.home; }
      if (!goHome && v.state === 'home') { v.state = 'idle'; v.t = 2; v.fade = 0; }
      if (v.state === 'home') { v.fade = Math.max(0, v.fade - dt); }
      else v.fade = Math.min(1, v.fade + dt * 0.8);
      ch.setOpacity(v.fade);
      ch.object.visible = v.fade > 0.02;
      // le héros approche : on s'arrête, on le regarde, on le salue
      const near = d < 4.5 && v.state !== 'home' && v.state !== 'homing';
      let moving = false;
      if (near) {
        v.facing = dampAngle(v.facing, Math.atan2(p.x - v.position.x, p.z - v.position.z), 5, dt);
        v.greetT -= dt;
        if (v.greetT <= 0) {
          v.greetT = 45;
          const lines = [...(night ? LINES.night : LINES.day), ...(LINES[v.place.id] || [])];
          this.say(v, lines);
          ch.playAction(Math.random() < 0.5 ? 'Cheer' : 'Interact', { full: false });
        }
      } else if (v.state === 'idle') {
        v.t -= dt;
        if (v.t <= 0) {
          // nouvelle destination dégagée dans le lieu
          for (let k = 0; k < 6; k++) {
            const s = this.freeSpot(v.place);
            if (Math.hypot(s.x - v.position.x, s.z - v.position.z) > 4 && this.clear(v.position.x, v.position.z, s.x, s.z)) { v.dest = s; v.state = 'walk'; break; }
          }
          if (v.state === 'idle') v.t = 2 + Math.random() * 3;
        } else if (Math.random() < dt * 0.08 && d < 40) ch.playAction(Math.random() < 0.5 ? 'Interact' : 'PickUp', { full: false });
      }
      if (!near && (v.state === 'walk' || v.state === 'homing') && v.dest) {
        const dx = v.dest.x - v.position.x, dz = v.dest.z - v.position.z, L = Math.hypot(dx, dz);
        if (L < 0.6) {
          if (v.state === 'homing') v.state = 'home';
          else { v.state = 'idle'; v.t = 4 + Math.random() * 9; }
          v.dest = null;
        } else {
          const step = Math.min(L, WALK * dt);
          const nx = v.position.x + dx / L * step, nz = v.position.z + dz / L * step;
          // obstacle imprévu (autre décor) : on renonce, sauf pour rentrer (on s'efface alors)
          if (v.state === 'walk' && this.blocked(nx, nz, 0.35)) { v.state = 'idle'; v.t = 1; v.dest = null; }
          else {
            v.position.x = nx; v.position.z = nz; moving = true;
            v.facing = dampAngle(v.facing, Math.atan2(dx, dz), 6, dt);
          }
        }
      }
      v.position.y = g.world.terrain.heightAt(v.position.x, v.position.z);
      ch.object.rotation.y = v.facing;
      ch.setLocomotion(moving ? 'Walking_A' : 'Idle', moving ? 0.95 : 1);
      if (v.bubbleT > 0) { v.bubbleT -= dt; if (v.bubbleT <= 0) v.bubble = ''; }
      if (d < 70 && ch.object.visible) ch.update(dt);
    }
  }

  plates(ui) {
    const p = this.game.player?.position;
    if (!p) return;
    for (const v of this.list) {
      if (!v.char || !v.char.object.visible) { ui.removePlate('vil:' + v.id); continue; }
      const d = Math.hypot(p.x - v.position.x, p.z - v.position.z);
      if (d > 16) { ui.removePlate('vil:' + v.id); continue; }
      ui.setPlate({ id: 'vil:' + v.id, position: v.position, height: 2.5, name: v.name, title: v.title, kind: 'npc', bubble: v.bubble || '' });
    }
  }
}
