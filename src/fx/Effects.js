import * as THREE from 'three';
import { ParticleSystem } from './Particles.js';

const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

function runeCircleTexture() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.translate(S / 2, S / 2);
  g.strokeStyle = 'rgba(255,255,255,1)';
  g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, S * 0.46, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1.5;
  g.beginPath(); g.arc(0, 0, S * 0.40, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(0, 0, S * 0.22, 0, Math.PI * 2); g.stroke();
  // glyphes runiques autour
  g.font = 'bold 20px serif';
  g.fillStyle = 'white';
  const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    g.save(); g.rotate(a); g.translate(0, -S * 0.43); g.fillText(glyphs[i % glyphs.length], -6, 7); g.restore();
  }
  // étoile intérieure
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i <= 6; i++) { const a = i * (Math.PI * 2 / 6) * 2; const r = S * 0.38; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Bibliothèque d'effets visuels (sorts, impacts, auras).
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.add = new ParticleSystem(scene, 5000, true);
    this.dustSys = new ParticleSystem(scene, 1500, false);
    this.live = [];
    this.geo = {
      ring: new THREE.RingGeometry(0.92, 1, 64),
      disc: new THREE.CircleGeometry(1, 48),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true),
      sphere: new THREE.SphereGeometry(1, 24, 16),
      ico: new THREE.IcosahedronGeometry(1, 1),
    };
    this.geo.ring.rotateX(-Math.PI / 2);
    this.geo.disc.rotateX(-Math.PI / 2);
    this.geo.cyl.translate(0, 0.5, 0);
    this.runeTex = runeCircleTexture();
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 1 }, uTime: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uAlpha; uniform float uTime; varying vec2 vUv;
        void main(){ float f = (1.0 - vUv.y) * (0.6 + 0.4 * sin(vUv.x * 40.0 + uTime * 8.0 + vUv.y * 10.0)); float edge = smoothstep(0.0, 0.15, vUv.y) ; gl_FragColor = vec4(uColor * f * 1.6, uAlpha * f * edge); }`,
    });
  }

  spawnMesh(mesh, life, onUpdate) {
    this.scene.add(mesh);
    const e = { mesh, t: 0, life, onUpdate };
    this.live.push(e);
    return e;
  }

  // ---------- particules
  burst(p, color, { count = 20, speed = 6, size = 0.5, life = 0.7, gravity = 4, drag = 2, up = 2, spread = 1, grow = 0, alpha = 1 } = {}) {
    _c.set(color);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.3) * Math.PI * spread;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.add.emit({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * Math.cos(b) * s, vy: Math.sin(b) * s + up, vz: Math.sin(a) * Math.cos(b) * s, color: _c, size: size * (0.6 + Math.random() * 0.8), life: life * (0.6 + Math.random() * 0.6), gravity, drag, grow, alpha });
    }
  }

  dust(p, { count = 12, color = '#c9b394', size = 1.2, speed = 3, life = 1.1 } = {}) {
    _c.set(color);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.dustSys.emit({ x: p.x + Math.cos(a) * 0.4, y: p.y + 0.2, z: p.z + Math.sin(a) * 0.4, vx: Math.cos(a) * s, vy: 0.6 + Math.random(), vz: Math.sin(a) * s, color: _c, size: size * (0.6 + Math.random() * 0.8), life: life * (0.7 + Math.random() * 0.6), gravity: -0.3, drag: 2.5, grow: 1.2, alpha: 0.45 });
    }
  }

  trail(p, color, size = 0.4, life = 0.35) {
    _c.set(color);
    this.add.emit({ x: p.x + (Math.random() - 0.5) * 0.15, y: p.y + (Math.random() - 0.5) * 0.15, z: p.z + (Math.random() - 0.5) * 0.15, vx: 0, vy: 0.3, vz: 0, color: _c, size, life, gravity: 0, drag: 1 });
  }

  sparkle(p, color, radius = 1, count = 3, size = 0.25) {
    _c.set(color);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
      this.add.emit({ x: p.x + Math.cos(a) * r, y: p.y + Math.random() * 2, z: p.z + Math.sin(a) * r, vx: 0, vy: 1 + Math.random() * 1.5, vz: 0, color: _c, size, life: 0.9 + Math.random() * 0.6, gravity: 0, drag: 0.5 });
    }
  }

  hit(p, color = '#fff4d0', strength = 1) {
    this.burst(p, color, { count: Math.round(10 + strength * 10), speed: 7 * strength, size: 0.35, life: 0.4, gravity: 10, up: 2 });
    this.flashSphere(p, color, 0.5 + strength * 0.4, 0.14);
  }

  flashSphere(p, color, radius, life) {
    const m = new THREE.Mesh(this.geo.sphere, new THREE.MeshBasicMaterial({ color: _c.set(color).clone().multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.position.copy(p); m.scale.setScalar(radius * 0.3);
    this.spawnMesh(m, life, (e, t) => { m.scale.setScalar(radius * (0.3 + t * 0.9)); m.material.opacity = 1 - t; });
  }

  // anneau au sol qui s'étend
  ring(p, color, { from = 0.5, to = 6, life = 0.6, y = 0.15, intensity = 2.5, thickness = 1 } = {}) {
    const mat = new THREE.MeshBasicMaterial({ color: _c.set(color).clone().multiplyScalar(intensity), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const m = new THREE.Mesh(this.geo.ring, mat);
    m.position.set(p.x, p.y + y, p.z);
    this.spawnMesh(m, life, (e, t) => {
      const r = from + (to - from) * (1 - Math.pow(1 - t, 2.2));
      m.scale.set(r, 1, r);
      mat.opacity = (1 - t) * (1 - t);
      m.scale.y = thickness;
    });
  }

  shockwave(p, color, radius = 6) {
    this.ring(p, color, { from: 0.5, to: radius, life: 0.5, intensity: 3 });
    this.ring(p, '#ffffff', { from: 0.3, to: radius * 0.7, life: 0.35, intensity: 1.5 });
    this.dust(p, { count: 18, speed: radius * 1.4, size: 1.4 });
    this.burst({ x: p.x, y: p.y + 0.3, z: p.z }, color, { count: 26, speed: radius * 1.8, size: 0.35, life: 0.5, gravity: 6, up: 1.5, spread: 0.3 });
  }

  // colonne de lumière
  beam(p, color, { height = 30, radius = 1.2, life = 1.2, grow = true } = {}) {
    const mat = this.beamMat.clone();
    mat.uniforms.uColor.value = new THREE.Color(color);
    const m = new THREE.Mesh(this.geo.cyl, mat);
    m.position.set(p.x, p.y, p.z);
    m.scale.set(radius, height, radius);
    this.spawnMesh(m, life, (e, t, dt) => {
      mat.uniforms.uTime.value += dt;
      const r = radius * (grow ? (t < 0.15 ? t / 0.15 : 1) : 1) * (1 - t * 0.5);
      m.scale.set(r, height, r);
      mat.uniforms.uAlpha.value = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
    });
    return m;
  }

  // cercle runique au sol
  runeCircle(p, color, { radius = 3, life = 1.4, spin = 1.5, y = 0.12 } = {}) {
    const mat = new THREE.MeshBasicMaterial({ map: this.runeTex, color: _c.set(color).clone().multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const m = new THREE.Mesh(this.geo.disc, mat);
    m.position.set(p.x, p.y + y, p.z);
    m.scale.setScalar(radius);
    this.spawnMesh(m, life, (e, t, dt) => {
      m.rotation.y += spin * dt;
      mat.opacity = t < 0.15 ? t / 0.15 : (1 - t) / 0.85;
      m.scale.setScalar(radius * (0.85 + Math.min(1, t * 4) * 0.15));
    });
    return m;
  }

  // arc de coup d'arme
  slash(origin, facing, color, { radius = 2.8, arc = 2.2, y = 1.2, life = 0.22, tilt = 0, width = 0.9 } = {}) {
    const seg = 24;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((seg + 1) * 2 * 3), uv = new Float32Array((seg + 1) * 2 * 2);
    for (let i = 0; i <= seg; i++) {
      const a = -arc / 2 + arc * i / seg;
      const ci = Math.cos(a), si = Math.sin(a);
      pos.set([si * (radius - width), 0, ci * (radius - width), si * radius, 0, ci * radius], i * 6);
      uv.set([i / seg, 0, i / seg, 1], i * 4);
    }
    const idx = [];
    for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uT: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uT; varying vec2 vUv;
        void main(){ float head = smoothstep(uT - 0.6, uT, vUv.x) * step(vUv.x, uT + 0.02); float a = head * pow(vUv.y, 1.5) * (1.0 - uT * 0.6); gl_FragColor = vec4(uColor * 2.4 * a, a); }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(origin.x, origin.y + y, origin.z);
    m.rotation.set(tilt, facing, 0, 'YXZ');
    this.spawnMesh(m, life * 1.8, (e, t) => { mat.uniforms.uT.value = Math.min(1.25, t * 1.8); }).dispose = () => geo.dispose();
  }

  // éclair entre deux points
  lightning(a, b, color = '#a8d8ff', { life = 0.28, segments = 12, jitter = 1.2, width = 2 } = {}) {
    const mk = () => {
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const j = i === 0 || i === segments ? 0 : jitter * Math.sin(t * Math.PI);
        pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t + (Math.random() - 0.5) * j, a.y + (b.y - a.y) * t + (Math.random() - 0.5) * j, a.z + (b.z - a.z) * t + (Math.random() - 0.5) * j));
      }
      return pts;
    };
    const geo = new THREE.BufferGeometry().setFromPoints(mk());
    const mat = new THREE.LineBasicMaterial({ color: _c.set(color).clone().multiplyScalar(4), transparent: true, blending: THREE.AdditiveBlending, toneMapped: false, linewidth: width });
    const line = new THREE.Line(geo, mat);
    let acc = 0;
    this.spawnMesh(line, life, (e, t, dt) => {
      acc += dt;
      if (acc > 0.04) { acc = 0; geo.setFromPoints(mk()); }
      mat.opacity = 1 - t;
    }).dispose = () => geo.dispose();
    this.burst(b, color, { count: 10, speed: 5, size: 0.3, life: 0.3, gravity: 2 });
  }

  // bulle de protection qui suit une cible
  bubble(target, color, duration = 4, radius = 1.8) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 0 }, uTime: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uAlpha; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); float hex = 0.5 + 0.5 * sin(vP.x * 9.0 + uTime * 2.0) * sin(vP.y * 9.0 - uTime) * sin(vP.z * 9.0); float a = (f * 0.9 + hex * 0.08) * uAlpha; gl_FragColor = vec4(uColor * 2.0 * a, a); }`,
    });
    const m = new THREE.Mesh(this.geo.sphere, mat);
    m.scale.setScalar(radius);
    const e = this.spawnMesh(m, duration, (e, t, dt) => {
      mat.uniforms.uTime.value += dt;
      m.position.set(target.position.x, target.position.y + 1.2, target.position.z);
      mat.uniforms.uAlpha.value = Math.min(1, t * duration * 5) * Math.min(1, (1 - t) * duration * 3);
    });
    return e;
  }

  // zone d'avertissement (attaque ennemie à venir)
  telegraph(p, radius, duration, color = '#ff4a3d') {
    const ring = new THREE.Mesh(this.geo.ring, new THREE.MeshBasicMaterial({ color: _c.set(color).clone().multiplyScalar(2), transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    const fill = new THREE.Mesh(this.geo.disc, new THREE.MeshBasicMaterial({ color: _c.set(color).clone(), transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
    ring.position.set(p.x, p.y + 0.2, p.z); fill.position.set(p.x, p.y + 0.18, p.z);
    ring.scale.set(radius, 1, radius);
    this.spawnMesh(fill, duration, (e, t) => { fill.scale.set(radius * t, 1, radius * t); fill.material.opacity = 0.18 + t * 0.2; });
    this.spawnMesh(ring, duration, (e, t) => { ring.material.opacity = 0.5 + 0.5 * Math.sin(t * 30); });
  }

  // aura ascendante (soin, montée de niveau)
  aura(target, color, { duration = 1.2, rate = 40, radius = 1.2, size = 0.3 } = {}) {
    const holder = new THREE.Object3D();
    let acc = 0;
    this.spawnMesh(holder, duration, (e, t, dt) => {
      acc += dt * rate;
      while (acc > 1) { acc -= 1; this.sparkle(target.position, color, radius, 1, size); }
    });
  }

  levelUp(target) {
    const p = target.position;
    this.beam(p, '#ffd36b', { height: 40, radius: 2.4, life: 1.8 });
    this.ring(p, '#ffd36b', { from: 0.5, to: 9, life: 1.0, intensity: 3 });
    this.runeCircle(p, '#ffd36b', { radius: 4, life: 2.2 });
    this.burst({ x: p.x, y: p.y + 1, z: p.z }, '#fff0b0', { count: 60, speed: 10, size: 0.4, life: 1.2, gravity: -1, up: 4 });
    this.aura(target, '#ffe08a', { duration: 2, rate: 60 });
  }

  // boule de feu tombant du ciel
  meteor(to, color = '#ff7a2a', delay = 0.9, onImpact) {
    const m = new THREE.Mesh(this.geo.ico, new THREE.MeshBasicMaterial({ color: _c.set(color).clone().multiplyScalar(4), toneMapped: false }));
    const start = new THREE.Vector3(to.x - 8, to.y + 30, to.z - 4);
    m.scale.setScalar(1.4);
    this.telegraph(to, 5.5, delay, color);
    this.spawnMesh(m, delay, (e, t) => {
      m.position.lerpVectors(start, to, t * t);
      m.rotation.x += 0.2; m.rotation.y += 0.13;
      this.trail(m.position, color, 1.2, 0.5);
      this.trail(m.position, '#ffd08a', 0.7, 0.3);
      if (t >= 0.999 && !e.done) { e.done = true; }
    }).onEnd = () => { this.explosion(to, color, 6); onImpact?.(); };
  }

  explosion(p, color, radius = 4) {
    this.flashSphere({ x: p.x, y: p.y + 1, z: p.z }, color, radius * 0.7, 0.3);
    this.shockwave(p, color, radius * 1.4);
    this.burst({ x: p.x, y: p.y + 0.8, z: p.z }, color, { count: 50, speed: radius * 3, size: 0.6, life: 0.8, gravity: 8, up: 4 });
    this.burst({ x: p.x, y: p.y + 0.8, z: p.z }, '#fff2c0', { count: 20, speed: radius * 2, size: 0.4, life: 0.5, gravity: 4, up: 3 });
  }

  update(dt, camera, viewportH) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const e = this.live[i];
      e.t += dt;
      const t = Math.min(1, e.t / e.life);
      e.onUpdate?.(e, t, dt);
      if (e.t >= e.life) {
        e.onEnd?.();
        this.scene.remove(e.mesh);
        if (e.mesh.material && e.mesh.material !== this.beamMat) e.mesh.material.dispose?.();
        e.dispose?.();
        this.live.splice(i, 1);
      }
    }
    this.add.update(dt, camera, viewportH);
    this.dustSys.update(dt, camera, viewportH);
  }
}

export { UP };
