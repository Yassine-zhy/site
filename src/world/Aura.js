import * as THREE from 'three';
import { PATHS, MOUNTAIN, SEA_LEVEL } from '../config.js';
import { Character } from '../entities/Character.js';
import { SHARDS, SHARD_OF, LORDS, SEALS } from '../game/Lore.js';

// L'aura du monde : la Couronne Brisée qui flotte au-dessus du Pic (un arc se rallume par Éclat
// repris), les rayons de grâce qui partent des pierres de passage vers l'objectif, et les statues
// des cinq seigneurs tels qu'ils étaient avant la Nuit du Bris, dressées devant leur Brume.

const CROWN = new THREE.Vector3(MOUNTAIN.x, 360, MOUNTAIN.z - 90);
const CROWN_R = 250;
const CROWN_FAR = 1500;   // au-delà, la couronne est rapprochée (même taille apparente) pour rester sous le plan lointain
const ORDER = ['souverainete', 'endurance', 'memoire', 'vie', 'passage'];

// apparence des statues : le seigneur avant le Bris
const STATUES = {
  roi: { model: 'knight', show: ['1H_Sword', 'Round_Shield'], pose: 'Blocking', t: 0.5 },
  colosse: { model: 'barbarian', show: ['2H_Axe'], pose: '2H_Melee_Idle', t: 0.3, scale: 3.6 },
  reine: { model: 'mage', show: ['2H_Staff'], pose: 'Spellcast_Raise', t: 0.55 },
  gardien: { model: 'mage', show: ['2H_Staff'], pose: 'Spellcasting', t: 0.4 },
  fossoyeur: { model: 'rogue_hooded', show: [], pose: 'Idle', t: 0.2 },
};

// Devant chaque Brume, là où la grande route la traverse (le Roi : au pied du Pic).
// Fonction pure : la végétation s'en sert aussi pour laisser la place aux statues.
let SPOTS = null;
export function statueSpots() {
  if (SPOTS) return SPOTS;
  const spots = {};
  const cross = (cx, cz, r) => {
    let best = null, bd = Infinity;
    for (const path of PATHS) for (let i = 0; i < path.length - 1; i++) {
      const [ax, az] = path[i], [bx, bz] = path[i + 1];
      for (let k = 0; k <= 40; k++) {
        const x = ax + (bx - ax) * k / 40, z = az + (bz - az) * k / 40;
        if (Math.abs(Math.hypot(x - cx, z - cz) - r) > 3) continue;
        const dv = Math.hypot(x, z);
        if (dv < bd) { const len = Math.hypot(bx - ax, bz - az) || 1; bd = dv; best = { x, z, nx: -(bz - az) / len, nz: (bx - ax) / len }; }
      }
    }
    return best;
  };
  for (const s of SEALS) {
    const lord = { ambre: 'colosse', givre: 'reine', sylve: 'gardien', hantee: 'fossoyeur' }[s.id];
    const c = cross(s.x, s.z, s.r + 16);
    if (c) spots[lord] = c;
  }
  const roi = cross(MOUNTAIN.x, MOUNTAIN.z, 250);
  if (roi) spots.roi = roi;
  return (SPOTS = spots);
}

export class Aura {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.buildCrown();
    this.buildRays();
    this.statues = [];
    try { this.buildStatues(); } catch (e) { console.error(e); }
  }

  // ------------------------------------------------------------------ Couronne Brisée
  buildCrown() {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    // l'anneau se présente incliné vers le sud (Havrelumière), comme un halo au-dessus du Pic
    inner.rotation.x = -Math.PI / 2 + 0.75;
    g.add(inner);
    const span = (Math.PI * 2) / 5;
    this.arcs = [];
    const stoneMat = () => new THREE.MeshBasicMaterial({ color: '#d8ccb4', transparent: true, opacity: 0.32, fog: false, depthWrite: false, toneMapped: false });
    for (let i = 0; i < 5; i++) {
      const key = ORDER[i];
      const a0 = i * span + span * 0.09;
      const arcLen = span * 0.82;
      const grp = new THREE.Group();
      grp.rotation.z = a0;
      const body = new THREE.Mesh(new THREE.TorusGeometry(CROWN_R, 8, 6, 40, arcLen), stoneMat());
      const glow = new THREE.Mesh(new THREE.TorusGeometry(CROWN_R, 26, 6, 40, arcLen), new THREE.MeshBasicMaterial({ color: SHARDS[key].color, transparent: true, opacity: 0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      const rune = new THREE.Mesh(new THREE.TorusGeometry(CROWN_R + 30, 2.6, 4, 40, arcLen * 0.8), stoneMat());
      rune.rotation.z = arcLen * 0.1;
      // la pointe de la couronne, au milieu de l'arc, dressée vers le ciel
      const spike = new THREE.Mesh(new THREE.ConeGeometry(15, 90, 5), stoneMat());
      const mid = arcLen / 2;
      spike.position.set(Math.cos(mid) * CROWN_R, Math.sin(mid) * CROWN_R, 40);
      spike.rotation.x = Math.PI / 2;
      grp.add(glow, body, rune, spike);
      inner.add(grp);
      this.arcs.push({ key, grp, body, glow, rune, spike, lit: 0, want: 0, flash: 0 });
    }
    for (const m of g.children) m.frustumCulled = false;
    g.traverse((o) => { o.frustumCulled = false; o.renderOrder = -1; });
    this.crown = g;
    this.crownInner = inner;
    this.game.scene.add(g);
  }

  setCrown(shards = {}, flashKey = null) {
    for (const a of this.arcs) {
      a.want = shards[a.key] ? 1 : 0;
      if (a.key === flashKey) a.flash = 1;
    }
  }

  updateCrown(dt) {
    const cam = this.game.camera.position;
    const d = cam.distanceTo(CROWN);
    const k = d > CROWN_FAR ? CROWN_FAR / d : 1;
    this.crown.position.copy(cam).lerp(CROWN, k);
    this.crown.scale.setScalar(k);
    this.crownInner.rotation.z += dt * 0.008;
    const night = this.game.world.sky?.state?.night ?? 0;
    for (const a of this.arcs) {
      a.lit += (a.want - a.lit) * Math.min(1, dt * 0.6);
      a.flash = Math.max(0, a.flash - dt * 0.35);
      const c = new THREE.Color(SHARDS[a.key].color);
      const lit = a.lit;
      const base = 0.42 + night * 0.2;
      for (const m of [a.body, a.rune, a.spike]) {
        m.material.color.set('#d8ccb4').lerp(c.clone().multiplyScalar(2.2), lit).lerp(new THREE.Color(3, 3, 3), a.flash);
        m.material.opacity = base + (1 - base) * Math.max(lit, a.flash);
      }
      a.glow.material.opacity = (lit * (0.16 + night * 0.12) + a.flash * 0.5) * (0.85 + 0.15 * Math.sin(this.t * 1.3 + a.grp.rotation.z * 3));
    }
  }

  // ------------------------------------------------------------------ rayons de grâce
  buildRays() {
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
    geo.translate(0.5, 0, 0);
    this.rayMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#ffd98a').multiplyScalar(1.8) }, uFade: { value: 0 } },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uFade; uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float along = vUv.x, across = abs(vUv.y - 0.5) * 2.0;
          float core = pow(1.0 - across, 3.0);
          float fade = smoothstep(0.0, 0.06, along) * (1.0 - smoothstep(0.35, 1.0, along));
          float flow = 0.55 + 0.45 * sin(along * 38.0 - uTime * 5.0);
          float a = core * fade * flow * uFade;
          gl_FragColor = vec4(uColor * (0.6 + core), a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    });
    this.rays = new THREE.Group();
    this.rayList = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Group();
      const p1 = new THREE.Mesh(geo, this.rayMat), p2 = new THREE.Mesh(geo, this.rayMat);
      p2.rotation.x = Math.PI / 2;
      r.add(p1, p2);
      r.userData = { yaw: (i - 1) * 0.07, pitch: 0.16 + i * 0.05, len: 70 + i * 14 };
      this.rays.add(r);
      this.rayList.push(r);
    }
    this.rays.visible = false;
    this.rayFade = 0;
    this.game.scene.add(this.rays);
  }

  updateRays(dt) {
    const g = this.game, p = g.player?.position;
    if (!p) return;
    this.rayT = (this.rayT || 0) - dt;
    if (this.rayT <= 0) {
      this.rayT = 0.3;
      this.rayAnchor = null;
      const t = g.quests?.primaryTarget();
      if (t && p.x < 3500 && !g.rooms?.current?.()) {
        const anchors = [{ x: 0, z: 0, y: (g.world.terrain.heightAt(0, 0) ?? 14) + 7.2 }];
        for (const w of g.waystones?.list || []) anchors.push({ x: w.x, z: w.z, y: w.group ? w.group.position.y + 5.2 : (g.world.terrain.heightAt(w.x, w.z) ?? 0) + 5.2 });
        let best = null, bd = 34;
        for (const a of anchors) { const d = Math.hypot(p.x - a.x, p.z - a.z); if (d < bd) { bd = d; best = a; } }
        if (best && Math.hypot(t.x - best.x, t.z - best.z) > 70) this.rayAnchor = { ...best, yaw: Math.atan2(t.z - best.z, t.x - best.x) };
      }
    }
    const want = this.rayAnchor ? 1 : 0;
    this.rayFade += (want - this.rayFade) * Math.min(1, dt * 1.5);
    this.rays.visible = this.rayFade > 0.01;
    if (!this.rays.visible) return;
    const A = this.rayAnchor || this.lastAnchor;
    if (!A) return;
    this.lastAnchor = A;
    this.rays.position.set(A.x, A.y, A.z);
    this.rayMat.uniforms.uTime.value = this.t;
    this.rayMat.uniforms.uFade.value = this.rayFade * 0.75;
    for (const r of this.rayList) {
      const u = r.userData;
      r.rotation.set(0, -(A.yaw + u.yaw + Math.sin(this.t * 0.4 + u.len) * 0.02), u.pitch, 'YZX');
      r.scale.set(u.len, 1.6, 1.6);
    }
  }

  // ------------------------------------------------------------------ statues des seigneurs
  buildStatues() {
    const g = this.game, t = g.world.terrain, col = g.world.colliders;
    const stone = new THREE.MeshStandardMaterial({ color: '#a39d92', roughness: 0.95, metalness: 0, flatShading: true });
    const plinth = new THREE.MeshStandardMaterial({ color: '#6f6a64', roughness: 0.95, flatShading: true });
    const baseGeo = new THREE.CylinderGeometry(2.6, 3.1, 1.6, 8); baseGeo.translate(0, 0.8, 0);
    const capGeo = new THREE.CylinderGeometry(2.2, 2.4, 0.4, 8); capGeo.translate(0, 1.8, 0);
    const spots = statueSpots();
    for (const [lord, sp] of Object.entries(spots)) {
      const def = STATUES[lord];
      // à côté de la route, un peu en retrait, tournée vers elle
      const { nx, nz } = sp;
      const free = (xx, zz) => {
        const y = t.heightAt(xx, zz);
        if (y === null || y < SEA_LEVEL + 1 || col.occupied(xx, zz, 3.2)) return false;
        for (const [dx, dz] of [[2.6, 0], [-2.6, 0], [0, 2.6], [0, -2.6]]) { const yy = t.heightAt(xx + dx, zz + dz); if (yy === null || Math.abs(yy - y) > 1.6 || col.occupied(xx + dx, zz + dz, 1.2)) return false; }
        return true;
      };
      const tx = nz, tz = -nx;
      let x = sp.x + nx * 9, z = sp.z + nz * 9;
      search: for (const d of [9, -9, 12, -12, 15, -15]) for (const a of [0, 6, -6, 12, -12]) {
        const xx = sp.x + nx * d + tx * a, zz = sp.z + nz * d + tz * a;
        if (free(xx, zz)) { x = xx; z = zz; break search; }
      }
      const y = t.heightAt(x, z) ?? 10;
      const grp = new THREE.Group();
      grp.position.set(x, y - 0.3, z);
      grp.rotation.y = Math.atan2(sp.x - x, sp.z - z);
      const base = new THREE.Mesh(baseGeo, plinth), cap = new THREE.Mesh(capGeo, plinth);
      for (const m of [base, cap]) { m.castShadow = true; m.receiveShadow = true; grp.add(m); }
      const ch = new Character(g.assets, def.model, { show: def.show, tint: null });
      ch.noLod = true;
      ch.setLocomotion(def.pose);
      ch.update(def.t);
      ch.object.traverse((o) => { if (o.isMesh) { o.material = stone; o.castShadow = true; o.receiveShadow = true; } });
      const sc = def.scale || 3.1;
      ch.object.scale.setScalar(sc);
      ch.object.position.y = 2.0;
      grp.add(ch.object);
      // le cœur du seigneur : sombre tant que l'Éclat n'est pas repris
      const key = SHARD_OF[lord];
      const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: '#3a2a55', toneMapped: false }));
      heart.position.set(0, 2.0 + sc * 0.95, sc * 0.2);
      heart.scale.set(1, 1.5, 1);
      grp.add(heart);
      g.scene.add(grp);
      g.world.cullFar(grp, 0.6);
      col.addCircle(x, z, 3.0, y - 1, y + 2 + sc * 1.9, 'monument');
      this.statues.push({ lord, key, x, z, y, grp, char: ch, heart, lit: false });
    }
  }

  updateStatues(shards) {
    for (const s of this.statues) {
      const lit = !!shards?.[s.key];
      if (lit === s.lit) continue;
      s.lit = lit;
      s.heart.material.color.set(lit ? SHARDS[s.key].color : '#3a2a55').multiplyScalar(lit ? 2.4 : 1);
    }
  }

  statueNear(pos, r = 9) {
    for (const s of this.statues) if (Math.abs(pos.x - s.x) < r && Math.abs(pos.z - s.z) < r) return s;
    return null;
  }

  statuePlate(s, fallen) {
    const L = LORDS[s.lord];
    return { name: fallen ? L.true : L.name, title: fallen ? 'statue · libéré de la Brume' : 'statue · tel qu’il fut avant la Nuit du Bris' };
  }

  update(dt) {
    this.t += dt;
    this.updateCrown(dt);
    this.updateRays(dt);
  }
}
