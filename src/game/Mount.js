import * as THREE from 'three';
import { Creature } from '../entities/Creature.js';

// Monture d'éther : un cerf spectral qu'on invoque hors combat pour traverser le continent.
// Le héros monte en selle (pose assise, jambes écartées) ; frapper, lancer un sort, planer,
// nager ou recevoir un coup le fait descendre.
const SEAT = 0.45; // hauteur du cavalier au-dessus du dos de la monture
const SCALE = 1.9;
// pose des jambes du cavalier (écartées, genoux pliés)
export const RIDE = { spread: 0.55, drop: 0.75, knee: -0.55 };

// Le cerf d'éther (aussi utilisé pour les montures des autres joueurs)
export function buildStag(scene) {
  const c = new Creature('wolf', { scale: SCALE, tint: '#bdf4ff' });
  const head = c.parts.head;
  // bois de cerf lumineux
  const antlerM = new THREE.MeshStandardMaterial({ color: '#e8fbff', emissive: new THREE.Color('#7fe6ff'), emissiveIntensity: 1.6, roughness: 0.4, flatShading: true });
  const beam = (len, r) => { const g = new THREE.CylinderGeometry(r * 0.6, r, len, 5); g.translate(0, len / 2, 0); return g; };
  for (const side of [-1, 1]) {
    const base = new THREE.Group(); base.position.set(side * 0.14, 0.24, 0.02); base.rotation.set(-0.35, 0, side * -0.45);
    head.add(base);
    base.add(new THREE.Mesh(beam(0.62, 0.05), antlerM));
    for (const [y, a, l] of [[0.22, 0.9, 0.3], [0.4, -0.7, 0.26], [0.56, 0.6, 0.22]]) {
      const t = new THREE.Mesh(beam(l, 0.032), antlerM);
      t.position.y = y; t.rotation.z = side * a; base.add(t);
    }
  }
  c.materials.push(antlerM);
  // selle et rênes
  const saddleM = new THREE.MeshStandardMaterial({ color: '#6b3f8f', roughness: 0.7, flatShading: true });
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.12, 0.6), saddleM);
  saddle.position.set(0, 0.32, -0.08);
  c.parts.body.add(saddle);
  const gold = new THREE.MeshStandardMaterial({ color: '#ffd77a', metalness: 0.6, roughness: 0.35, flatShading: true });
  for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.08), gold); st.position.set(s * 0.36, 0.12, -0.08); c.parts.body.add(st); }
  // corps translucide et lumineux : une créature d'éther
  for (const m of c.materials) {
    if (m === antlerM) continue;
    m.emissive = new THREE.Color('#48c8ff'); m.emissiveIntensity = 0.55;
    m.transparent = true; m.opacity = 0.92;
    m.userData.baseEmissive = m.emissive.clone(); m.userData.baseEmissiveIntensity = m.emissiveIntensity; m.userData.baseOpacity = 0.92;
  }
  c.object.visible = false;
  scene.add(c.object);
  return c;
}

// pose le cerf sous le cavalier : allure selon la vitesse, le cavalier épouse le mouvement du dos
export function rideStag(c, char, pos, facing, hs, dt) {
  c.object.position.copy(pos);
  c.object.rotation.y = facing;
  c.setLocomotion(hs > 12 ? 'run' : hs > 0.6 ? 'walk' : 'Idle', hs > 12 ? hs / 16 : Math.max(0.6, hs / 6));
  c.update(dt);
  const body = c.parts.body;
  char.model.position.y = body.position.y * SCALE + SEAT;
  char.model.rotation.x = body.rotation.x * 0.8;
}

export class Mount {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.creature = null;
    this.facing = 0;
    this.fade = 0;
  }

  build() {
    this.creature = buildStag(this.game.scene);
  }

  get player() { return this.game.player; }

  // raison qui empêche d'invoquer la monture (null si possible)
  blocked() {
    const g = this.game, p = this.player;
    if (!p || p.dead) return 'Impossible pour l’instant.';
    if (p.gliding || !p.onGround) return 'Posez-vous d’abord.';
    if (p.inWater) return 'Pas dans l’eau !';
    if (g.elapsed - (g.lastCombat ?? -99) < 3) return 'Impossible en plein combat.';
    if (g.rooms?.current()) return 'Pas de monture à l’intérieur !';
    return null;
  }

  toggle() {
    if (this.active) return this.dismount();
    const why = this.blocked();
    if (why) { this.game.ui.toast(why, { time: 1.6 }); this.game.audio?.play('error'); return; }
    this.mount();
  }

  mount() {
    if (!this.creature) this.build();
    const g = this.game, p = this.player;
    this.active = true; p.mounted = true;
    this.facing = p.facing;
    this.creature.object.visible = true;
    this.fade = 0;
    g.fx?.burst?.(p.position.clone().setY(p.position.y + 1.4), '#9fe8ff', 30);
    g.fx?.sparkle?.(p.position.clone().setY(p.position.y + 1.2), '#bff4ff', 1.2, 30, 0.4);
    g.audio?.play('summon', p.position);
    g.vibrate?.(25);
    // aide affichée aux trois premières chevauchées seulement
    g.hero.rides = (g.hero.rides || 0) + 1;
    if (g.hero.rides <= 3) g.ui.toast(g.input?.isTouch ? 'Monture d’éther invoquée : poussez le joystick à fond pour galoper' : 'Monture d’éther invoquée : <b>Maj</b> pour galoper, <b>Espace</b> pour sauter', { time: 3 });
  }

  dismount(quiet = false) {
    if (!this.active) return;
    const g = this.game, p = this.player;
    this.active = false;
    if (p) { p.mounted = false; p.char.model.position.y = 0; p.char.model.rotation.x = 0; }
    if (!quiet && p) {
      g.fx?.sparkle?.(p.position.clone().setY(p.position.y + 1.2), '#bff4ff', 1.2, 24, 0.35);
      g.audio?.play('ui', p.position);
    }
  }

  update(dt) {
    const p = this.player, c = this.creature;
    if (!c) return;
    if (this.active && (!p || p.dead || p.inWater || p.gliding)) this.dismount();
    this.fade = THREE.MathUtils.damp(this.fade, this.active ? 1 : 0, 8, dt);
    c.object.visible = this.fade > 0.02;
    if (!c.object.visible) return;
    if (!this.active) { c.setOpacity?.(this.fade); c.update(dt); return; }
    c.setOpacity?.(Math.min(1, this.fade));
    // la monture suit le héros ; le héros est en selle
    let d = p.facing - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.facing += d * Math.min(1, dt * 10);
    const hs = Math.hypot(p.velocity.x, p.velocity.z);
    rideStag(c, p.char, p.position, this.facing, hs, dt);
    // traînée lumineuse au galop
    if (hs > 12 && Math.random() < dt * 20) this.game.fx?.sparkle?.(new THREE.Vector3(p.position.x - Math.sin(this.facing) * 1.6, p.position.y + 1.2, p.position.z - Math.cos(this.facing) * 1.6), '#9fe8ff', 0.4, 1, 0.3);
  }
}
