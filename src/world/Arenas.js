import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Decor } from './Decor.js';
import { VirtualLight } from './Lights.js';
import { decorMaterial, SHARED } from './SurfaceDetail.js';
import { ARENAS } from './ArenaDefs.js';
import { mulberry32 } from '../engine/math.js';

// Arènes des boss du monde. Chacune : un sol dallé autour d'un grand cercle runique, une
// enceinte basse ouverte sur un portail monumental gravé de son nom, des piliers coiffés de
// braseros, des bannières aux armes du seigneur, un décor propre à son thème, et une barrière
// de brume qui se referme pendant le combat (pilotée par ArenaFights).

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const yawOf = (dx, dz) => Math.atan2(-dz, dx); // rotation.y qui aligne +X local sur (dx, dz)
const faceOf = (dx, dz) => Math.atan2(dx, dz); // rotation.y qui tourne +Z local vers (dx, dz)
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// ajoute une primitive colorée (par sommet) à une liste de géométries à fusionner
function put(list, geo, color, x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
  g.applyMatrix4(_m);
  const c = color.isColor ? color : new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  list.push(g);
  return g;
}

// ------------------------------------------------------------------ dessins (blasons, runes, inscriptions)
function sigil(ctx, kind, cx, cy, s, color) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (kind === 'crown') {
    ctx.moveTo(-60, 40); ctx.lineTo(-70, -30); ctx.lineTo(-35, 0); ctx.lineTo(0, -55); ctx.lineTo(35, 0); ctx.lineTo(70, -30); ctx.lineTo(60, 40); ctx.closePath(); ctx.fill();
    ctx.fillRect(-62, 48, 124, 16);
    for (const x of [-70, 0, 70]) { ctx.beginPath(); ctx.arc(x, x === 0 ? -62 : -36, 9, 0, Math.PI * 2); ctx.fill(); }
  } else if (kind === 'sun') {
    ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.12) * 42, Math.sin(a - 0.12) * 42); ctx.lineTo(Math.cos(a) * (i % 2 ? 66 : 80), Math.sin(a) * (i % 2 ? 66 : 80)); ctx.lineTo(Math.cos(a + 0.12) * 42, Math.sin(a + 0.12) * 42); ctx.fill(); }
  } else if (kind === 'flake') {
    ctx.lineWidth = 9; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a);
      ctx.moveTo(0, 0); ctx.lineTo(c * 72, s2 * 72);
      for (const t of [30, 52]) { const bx = c * t, by = s2 * t; ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + 0.7) * 18, by + Math.sin(a + 0.7) * 18); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a - 0.7) * 18, by + Math.sin(a - 0.7) * 18); }
    }
    ctx.stroke();
  } else if (kind === 'leaf') {
    ctx.moveTo(0, 75); ctx.bezierCurveTo(-70, 20, -55, -55, 0, -80); ctx.bezierCurveTo(55, -55, 70, 20, 0, 75); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 70); ctx.lineTo(0, -70);
    for (const y of [-40, -10, 20, 45]) { ctx.moveTo(0, y); ctx.lineTo(-30, y - 22); ctx.moveTo(0, y); ctx.lineTo(30, y - 22); }
    ctx.stroke();
  } else if (kind === 'skull') {
    ctx.arc(0, -12, 52, Math.PI * 0.95, Math.PI * 2.05); ctx.lineTo(34, 40); ctx.lineTo(-34, 40); ctx.closePath(); ctx.fill();
    ctx.fillRect(-26, 40, 52, 26);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(-20, -8, 14, 0, Math.PI * 2); ctx.arc(20, -8, 14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(-8, 26); ctx.lineTo(8, 26); ctx.fill();
    for (const x of [-14, 0, 14]) ctx.fillRect(x - 3, 44, 6, 18);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
function runeCircleTexture(A) {
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d'), c = S / 2;
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff';
  const ring = (r, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke(); };
  ring(500, 10); ring(470, 4); ring(330, 8); ring(300, 3); ring(150, 6);
  // runes entre les deux grands cercles
  ctx.font = 'bold 44px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 36; i++) {
    const a = i / 36 * Math.PI * 2;
    ctx.save(); ctx.translate(c + Math.cos(a) * 400, c + Math.sin(a) * 400); ctx.rotate(a + Math.PI / 2);
    ctx.fillText(RUNES[(i * 7 + A.id.length) % RUNES.length], 0, 0); ctx.restore();
  }
  // étoile à branches reliant les cercles
  ctx.lineWidth = 4; ctx.beginPath();
  const k = 7;
  for (let i = 0; i <= k; i++) { const a = (i * 3 % k) / k * Math.PI * 2 - Math.PI / 2; const x = c + Math.cos(a) * 300, y = c + Math.sin(a) * 300; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.stroke();
  sigil(ctx, A.theme.sigil, c, c, 1.25, '#fff');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

function bannerTexture(A) {
  const W = 256, H = 768, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), th = A.theme;
  ctx.fillStyle = th.banner; ctx.fillRect(0, 0, W, H - 90);
  // pointe en V et franges
  ctx.beginPath(); ctx.moveTo(0, H - 90); ctx.lineTo(W / 2, H - 10); ctx.lineTo(W, H - 90); ctx.fill();
  const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = th.trim; ctx.lineWidth = 10; ctx.strokeRect(14, 14, W - 28, H - 120);
  ctx.lineWidth = 4; ctx.strokeRect(28, 28, W - 56, H - 148);
  sigil(ctx, th.sigil, W / 2, 230, 1.1, th.trim);
  ctx.fillStyle = th.trim; for (let y = 400; y < H - 140; y += 46) { ctx.beginPath(); ctx.moveTo(W / 2, y); ctx.lineTo(W / 2 + 16, y + 16); ctx.lineTo(W / 2, y + 32); ctx.lineTo(W / 2 - 16, y + 16); ctx.fill(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

function lintelTexture(A) {
  const W = 1024, H = 160, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold 78px Georgia, 'Times New Roman', serif`;
  const text = A.name.toUpperCase();
  let size = 78; while (ctx.measureText(text).width > W - 80 && size > 40) { size -= 4; ctx.font = `bold ${size}px Georgia, serif`; }
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(text, W / 2 + 3, H / 2 + 4);
  ctx.fillStyle = A.theme.trim; ctx.fillText(text, W / 2, H / 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

// ------------------------------------------------------------------ matériaux animés
function bannerMaterial(tex, time) {
  const m = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85, alphaTest: 0.4, transparent: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float hang = 1.0 - uv.y;
        float ph = position.x * 0.37 + position.z * 0.29;
        transformed += normal * (sin(uTime * 1.7 + ph + hang * 2.2) * 0.22 + sin(uTime * 3.1 + ph * 2.0) * 0.06) * hang * hang;`);
  };
  m.customProgramCacheKey = () => 'arena-banner';
  return m;
}

function barrierMaterial(color, time) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: time, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(color) }, uNoise: SHARED.uNoise },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uOpacity; uniform vec3 uColor; uniform sampler2D uNoise; varying vec2 vUv;
      void main() {
        float n = texture2D(uNoise, vec2(vUv.x * 9.0 + uTime * 0.03, vUv.y * 0.9 - uTime * 0.11)).r;
        float n2 = texture2D(uNoise, vec2(vUv.x * 23.0 - uTime * 0.05, vUv.y * 2.1 - uTime * 0.23)).g;
        float a = uOpacity * (0.1 + 0.42 * n * n2 + 0.2 * smoothstep(0.55, 0.9, n));
        a *= smoothstep(1.0, 0.55, vUv.y) * smoothstep(0.0, 0.06, vUv.y);
        // liseré lumineux au ras du sol
        a += uOpacity * 0.6 * (1.0 - smoothstep(0.0, 0.05, vUv.y));
        gl_FragColor = vec4(uColor * (0.7 + 1.3 * n2), a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  });
}

// ------------------------------------------------------------------ arènes
export class Arenas extends Decor {
  constructor(scene, assets, terrain, colliders) {
    super(scene, assets, terrain, colliders, 'arenas');
    this.fallbackY = 30;
    this.rng = mulberry32(9090);
    this.time = { value: 0 };
    this.sites = ARENAS.map((A) => this.build(A));
    this.mergeStatic();
  }

  build(A) {
    const th = A.theme, rng = this.rng, y0 = A.floor;
    const stone = new THREE.Color(th.stone), stone2 = new THREE.Color(th.stone2), trim = new THREE.Color(th.trim);
    const solid = [], glow = [];
    const tint = (c, k) => c.clone().multiplyScalar(k);
    const site = { A, group: new THREE.Group(), flames: [], lights: [], state: { fight: 0, rage: 0, seal: 0, win: 0 }, braziers: [] };
    site.group.name = 'arena:' + A.id;
    this.scene.add(site.group);
    const gx = Math.cos(A.gate), gz = Math.sin(A.gate);

    // --- sol : joints sombres, dalles en anneaux autour du médaillon central
    const grout = new THREE.CircleGeometry(A.r + 0.6, 72); grout.rotateX(-Math.PI / 2);
    put(solid, grout, tint(stone2, 0.45), A.x, y0 + 0.03, A.z);
    const tiles = { pos: [], col: [] };
    const tileRing = (ri, ro) => {
      const rm = (ri + ro) / 2, n = Math.max(6, Math.round(Math.PI * 2 * rm / 2.3)), off = rng() * 6.28;
      for (let i = 0; i < n; i++) {
        const a0 = off + (i + 0.04) / n * Math.PI * 2, a1 = off + (i + 0.96) / n * Math.PI * 2;
        const r0 = ri + 0.06, r1 = ro - 0.06, h = y0 + 0.08 + rng() * 0.03;
        const c = stone.clone().lerp(stone2, rng() * 0.6).multiplyScalar(0.88 + rng() * 0.2);
        const P = [[Math.cos(a0) * r0, Math.sin(a0) * r0], [Math.cos(a1) * r0, Math.sin(a1) * r0], [Math.cos(a1) * r1, Math.sin(a1) * r1], [Math.cos(a0) * r1, Math.sin(a0) * r1]];
        for (const k of [0, 2, 1, 0, 3, 2]) { tiles.pos.push(A.x + P[k][0], h, A.z + P[k][1]); tiles.col.push(c.r, c.g, c.b); }
      }
    };
    for (let ri = 4.6; ri < A.r; ri += 2.2) tileRing(ri, Math.min(A.r + 0.4, ri + 2.2));
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tiles.pos, 3));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(tiles.col, 3));
    tg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(tiles.pos.length / 3 * 2), 2));
    tg.computeVertexNormals();
    solid.push(tg);
    // médaillon central (le boss y apparaît)
    put(solid, new THREE.CylinderGeometry(4.4, 4.6, 0.22, 40), trim, A.x, y0 + 0.06, A.z);
    put(solid, new THREE.CylinderGeometry(3.7, 3.7, 0.24, 40), tint(stone2, 0.8), A.x, y0 + 0.08, A.z);

    // --- enceinte basse (ouverte au portail)
    const rw = A.r + 1.4, gateHalf = 4.2 / rw;
    const segN = Math.round(Math.PI * 2 * rw / 3.2);
    for (let i = 0; i < segN; i++) {
      const a = (i + 0.5) / segN * Math.PI * 2;
      if (Math.abs(angDiff(a, A.gate)) < gateHalf) continue;
      const x = A.x + Math.cos(a) * rw, z = A.z + Math.sin(a) * rw, ry = yawOf(-Math.sin(a), Math.cos(a));
      const len = Math.PI * 2 * rw / segN + 0.05;
      put(solid, new THREE.BoxGeometry(len, 1.25, 0.9), stone.clone().lerp(stone2, rng() * 0.5), x, y0 + 0.62, z, ry);
      put(solid, new THREE.BoxGeometry(len + 0.06, 0.2, 1.08), trim, x, y0 + 1.32, z, ry);
      this.colliders.addBox(x, z, len / 2, 0.5, ry, y0 - 2, y0 + 1.45, 'ruin');
    }

    // --- piliers à braseros et bannières
    const N = A.r > 24 ? 10 : 8, rp = A.r + 2.8;
    const banners = [];
    for (let i = 0; i < N; i++) {
      const a = A.gate + (i + 0.5) / N * Math.PI * 2;
      const x = A.x + Math.cos(a) * rp, z = A.z + Math.sin(a) * rp;
      const ry = faceOf(A.x - x, A.z - z);
      put(solid, new THREE.BoxGeometry(2.3, 0.7, 2.3), tint(stone2, 0.9), x, y0 + 0.35, z, ry);
      put(solid, new THREE.CylinderGeometry(0.62, 0.74, 7.2, 8), stone, x, y0 + 4.3, z, ry + Math.PI / 8);
      put(solid, new THREE.BoxGeometry(1.9, 0.45, 1.9), trim, x, y0 + 8.1, z, ry);
      put(solid, new THREE.CylinderGeometry(1.05, 0.55, 0.65, 10, 1), tint(stone2, 0.7), x, y0 + 8.65, z);
      this.colliders.addCircle(x, z, 1.25, y0 - 2, y0 + 9, 'ruin');
      site.braziers.push({ x, y: y0 + 9.0, z, k: rng() * 10 });
      // bannière tournée vers le centre, accrochée sous le chapiteau
      const bx = x + (A.x - x) / rp * 0.78, bz = z + (A.z - z) / rp * 0.78;
      const bg = new THREE.PlaneGeometry(1.7, 5.1, 1, 8);
      _m.compose(_p.set(bx, y0 + 7.85 - 2.55, bz), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(1, 1, 1));
      bg.applyMatrix4(_m);
      banners.push(bg);
    }
    const bannerMesh = new THREE.Mesh(mergeGeometries(banners), bannerMaterial(bannerTexture(A), this.time));
    bannerMesh.castShadow = true;
    site.group.add(bannerMesh);

    // --- portail monumental
    const rg = rw, tx = -gz, tz = gx; // tangente
    const cxg = A.x + gx * rg, czg = A.z + gz * rg;
    const gry = yawOf(tx, tz);
    for (const s of [-1, 1]) {
      const px = cxg + tx * 4.4 * s, pz = czg + tz * 4.4 * s;
      put(solid, new THREE.BoxGeometry(2.6, 1.0, 2.6), tint(stone2, 0.85), px, y0 + 0.5, pz, gry);
      put(solid, new THREE.BoxGeometry(1.7, 9.0, 1.7), stone, px, y0 + 5.4, pz, gry);
      put(solid, new THREE.BoxGeometry(2.1, 0.5, 2.1), trim, px, y0 + 10.1, pz, gry);
      this.colliders.addBox(px, pz, 1.1, 1.1, gry, y0 - 2, y0 + 11, 'ruin');
    }
    // arche (demi-tore dans le plan vertical du portail) et linteau gravé
    const arch = new THREE.TorusGeometry(4.4, 0.55, 6, 18, Math.PI);
    put(solid, arch, stone, cxg, y0 + 10.3, czg, gry);
    put(solid, new THREE.BoxGeometry(8.8, 1.3, 1.2), tint(stone2, 0.95), cxg, y0 + 9.9, czg, gry);
    const lintel = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 1.28), new THREE.MeshStandardMaterial({ map: lintelTexture(A), transparent: true, roughness: 0.6, emissive: new THREE.Color(th.glow), emissiveIntensity: 0.25, emissiveMap: null, polygonOffset: true, polygonOffsetFactor: -2 }));
    for (const side of [1, -1]) {
      const l = side > 0 ? lintel : lintel.clone();
      l.position.set(cxg + gx * 0.62 * side, y0 + 9.9, czg + gz * 0.62 * side);
      l.rotation.y = faceOf(gx * side, gz * side);
      site.group.add(l);
    }
    // blason lumineux à la clé de voûte
    const sigilTex = runeCircleTexture(A);
    const key = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), new THREE.MeshBasicMaterial({ map: sigilTex, color: new THREE.Color(th.glow).multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    key.position.set(cxg + gx * 0.05, y0 + 14.0, czg + gz * 0.05); key.rotation.y = faceOf(gx, gz);
    site.group.add(key);
    site.key = key;

    // --- cercle runique au sol (s'illumine pendant le combat)
    const runeMat = new THREE.MeshBasicMaterial({ map: sigilTex, color: new THREE.Color(th.glow), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const runes = new THREE.Mesh(new THREE.CircleGeometry(A.r * 0.66, 64), runeMat);
    runes.rotation.x = -Math.PI / 2; runes.position.set(A.x, y0 + 0.2, A.z);
    site.group.add(runes);
    site.runes = runes;

    // --- flammes des braseros (deux couches instanciées) et leurs lumières
    const flameGeo = new THREE.ConeGeometry(0.62, 2.1, 8, 1, true); flameGeo.translate(0, 1.05, 0);
    const outer = new THREE.InstancedMesh(flameGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(th.flame).multiplyScalar(2.4), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), site.braziers.length);
    const inner = new THREE.InstancedMesh(flameGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(th.flame).lerp(new THREE.Color('#ffffff'), 0.55).multiplyScalar(2.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), site.braziers.length);
    outer.frustumCulled = inner.frustumCulled = false;
    site.group.add(outer, inner);
    site.flameMeshes = [outer, inner];
    site.baseFlame = new THREE.Color(th.flame);
    site.braziers.forEach((b, i) => {
      if (i % 2) return;
      const l = new VirtualLight(th.flame, 0, 26, 1.4);
      l.position.set(b.x, b.y + 1.4, b.z);
      site.group.add(l);
      site.lights.push(l);
    });

    // --- barrière de brume (cylindre ouvert)
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(A.r + 2.0, A.r + 2.0, 11, 96, 1, true), barrierMaterial(th.glow, this.time));
    bar.position.set(A.x, y0 + 5.4, A.z);
    bar.visible = false;
    bar.renderOrder = 3;
    site.group.add(bar);
    site.barrier = bar;

    // --- décor propre au thème
    this['theme_' + th.props]?.(A, site, solid, glow, { stone, stone2, trim });

    // fusion des parties fixes : une passe de dessin pour la pierre, une pour ce qui brille
    const solidMesh = new THREE.Mesh(mergeGeometries(solid), decorMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, flatShading: true })));
    solidMesh.castShadow = true; solidMesh.receiveShadow = true;
    solidMesh.geometry.computeBoundingSphere();
    this.scene.add(solidMesh);
    (this.scene.userData.staticMeshes = this.scene.userData.staticMeshes || []).push(solidMesh);
    if (glow.length) {
      const gm = new THREE.Mesh(mergeGeometries(glow), site.glowMat || new THREE.MeshStandardMaterial({ vertexColors: true, emissive: new THREE.Color(th.glow), emissiveIntensity: 0.9, roughness: 0.3, flatShading: true }));
      gm.castShadow = true;
      site.group.add(gm);
    }
    return site;
  }

  // ------------------------------------------------------------------ thèmes
  // le Roi Sans Lumière : tapis royal, trône sur estrade, épées plantées, armures
  theme_royal(A, site, solid, glow, C) {
    const bx = Math.cos(A.gate + Math.PI), bz = Math.sin(A.gate + Math.PI);
    const tx = A.x + bx * (A.r - 4.2), tz = A.z + bz * (A.r - 4.2), ry = faceOf(-bx, -bz), y0 = A.floor;
    put(solid, new THREE.CylinderGeometry(4.2, 4.5, 0.5, 24), C.stone2, tx, y0 + 0.25, tz);
    put(solid, new THREE.CylinderGeometry(3.3, 3.5, 0.45, 24), C.trim, tx, y0 + 0.7, tz);
    // trône
    const seat = (dx, dy, dz, w, h, d, c) => { const ox = Math.cos(-ry) * dx + Math.sin(-ry) * dz, oz = -Math.sin(-ry) * dx + Math.cos(-ry) * dz; put(solid, new THREE.BoxGeometry(w, h, d), c, tx + ox, y0 + dy, tz + oz, ry); };
    seat(0, 1.35, 0, 2.6, 0.9, 2.2, C.stone);
    seat(0, 3.6, -1.0, 2.8, 4.6, 0.55, C.stone2);
    seat(-1.35, 2.1, 0, 0.45, 0.8, 2.2, C.trim); seat(1.35, 2.1, 0, 0.45, 0.8, 2.2, C.trim);
    seat(0, 6.1, -1.0, 3.4, 0.5, 0.7, C.trim);
    for (const s of [-1, 1]) seat(s * 1.6, 6.7, -1.0, 0.35, 1.2, 0.35, C.trim);
    const gx = Math.cos(-ry) * 0 + Math.sin(-ry) * -0.7, gz = Math.cos(-ry) * -0.7;
    put(glow, new THREE.OctahedronGeometry(0.55, 0), '#d9a2ff', tx + gx, y0 + 5.3, tz + gz);
    // tapis royal du portail au trône
    const len = A.r * 2 - 9, mx = A.x + Math.cos(A.gate) * (A.r - 1 - len / 2), mz = A.z + Math.sin(A.gate) * (A.r - 1 - len / 2);
    const rug = new THREE.PlaneGeometry(3.2, len); rug.rotateX(-Math.PI / 2);
    put(solid, rug, '#4a1a6e', mx, y0 + 0.13, mz, faceOf(Math.cos(A.gate), Math.sin(A.gate)));
    const edge = new THREE.PlaneGeometry(3.6, len + 0.2); edge.rotateX(-Math.PI / 2);
    put(solid, edge, C.trim, mx, y0 + 0.12, mz, faceOf(Math.cos(A.gate), Math.sin(A.gate)));
    // épées plantées et armures le long de l'allée
    for (const s of [-1, 1]) for (const t of [0.3, 0.62]) {
      const d = A.r * (1 - t * 1.4), px = A.x + Math.cos(A.gate) * d + Math.cos(A.gate + Math.PI / 2) * 5.4 * s, pz = A.z + Math.sin(A.gate) * d + Math.sin(A.gate + Math.PI / 2) * 5.4 * s;
      this.placeProp('sword_shield', px, pz, 1.9, faceOf(A.x - px, A.z - pz), 0, true);
    }
    for (const s of [-1, 1]) {
      const px = tx + Math.cos(A.gate + Math.PI / 2) * 5.6 * s, pz = tz + Math.sin(A.gate + Math.PI / 2) * 5.6 * s;
      this.placeProp('pillar_decorated', px, pz, 1.7, ry, 0, true);
    }
  }

  // Colosse d'Ambre : cristaux d'ambre, colonnes effondrées, éboulis
  theme_amber(A, site, solid, glow, C) {
    const rng = this.rng, y0 = A.floor;
    for (let i = 0; i < 9; i++) {
      const a = A.gate + 0.5 + i / 9 * (Math.PI * 2 - 1.0), r = A.r + 6 + rng() * 5;
      this.crystals(glow, A.x + Math.cos(a) * r, y0, A.z + Math.sin(a) * r, 4 + Math.floor(rng() * 3), 1.6 + rng() * 1.2, '#ffb347', '#ffd27a');
    }
    for (let i = 0; i < 4; i++) {
      const a = A.gate + Math.PI * (0.45 + i * 0.37), r = A.r * (0.55 + rng() * 0.25);
      const x = A.x + Math.cos(a) * r, z = A.z + Math.sin(a) * r;
      if (i % 2) this.placeProp('rubble_large', x, z, 1.5, rng() * 6, 0, true);
      else { const o = this.placeProp('column', x, z, 1.7, rng() * 6, 0, false); o.rotation.z = Math.PI / 2; o.position.y += 0.9; this.colliders.addCircle(x, z, 1.4, y0 - 1, y0 + 1.8, 'prop', true); }
    }
    // obélisque gravé derrière l'arène
    const bx = A.x - Math.cos(A.gate) * (A.r + 7), bz = A.z - Math.sin(A.gate) * (A.r + 7);
    put(solid, new THREE.BoxGeometry(3, 1.2, 3), C.stone2, bx, y0 + 0.6, bz);
    put(solid, new THREE.CylinderGeometry(0.6, 1.3, 14, 4), C.stone, bx, y0 + 8, bz, Math.PI / 4);
    put(glow, new THREE.OctahedronGeometry(0.9, 0), '#ffcf6b', bx, y0 + 15.6, bz);
  }

  // Reine de Givre : couronne de stalagmites de glace autour de l'enceinte
  theme_ice(A, site, solid, glow, C) {
    const rng = this.rng, y0 = A.floor;
    site.glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: new THREE.Color('#5fb8ff'), emissiveIntensity: 0.55, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.86, flatShading: true });
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = A.gate + (i + 0.5) / n * Math.PI * 2;
      if (Math.abs(angDiff(a, A.gate)) < 0.5) continue;
      const r = A.r + 4.5 + rng() * 3;
      this.crystals(glow, A.x + Math.cos(a) * r, y0, A.z + Math.sin(a) * r, 3 + Math.floor(rng() * 3), 2.4 + rng() * 2.2, '#cfeeff', '#9fd8ff');
    }
    // statues gelées de chevaliers vaincus, le long de l'entrée
    for (const s of [-1, 1]) {
      const d = A.r * 0.5, px = A.x + Math.cos(A.gate) * d + Math.cos(A.gate + Math.PI / 2) * 6 * s, pz = A.z + Math.sin(A.gate) * d + Math.sin(A.gate + Math.PI / 2) * 6 * s;
      this.crystals(glow, px, y0, pz, 3, 1.3, '#e6f6ff', '#b8e6ff');
      this.placeProp('sword_shield_broken', px, pz, 1.6, faceOf(A.x - px, A.z - pz), 0, false);
    }
  }

  // Gardien Sylvestre : racines géantes en arches, champignons lumineux, lierre sur les piliers
  theme_grove(A, site, solid, glow, C) {
    const rng = this.rng, y0 = A.floor, bark = new THREE.Color('#5a4030'), bark2 = new THREE.Color('#6d4f38'), moss = new THREE.Color('#4f7a3a');
    for (let i = 0; i < 6; i++) {
      const a = A.gate + 0.7 + i / 6 * (Math.PI * 2 - 1.4);
      const r0 = A.r + 9, r1 = A.r - 1.5;
      const p0 = new THREE.Vector3(A.x + Math.cos(a) * r0, y0 - 1, A.z + Math.sin(a) * r0);
      const a1 = a + (rng() - 0.5) * 0.5;
      const p2 = new THREE.Vector3(A.x + Math.cos(a1) * r1, y0 - 0.6, A.z + Math.sin(a1) * r1);
      const mid = p0.clone().lerp(p2, 0.5); mid.y = y0 + 6 + rng() * 3;
      const curve = new THREE.CatmullRomCurve3([p0, p0.clone().lerp(mid, 0.5).setY(y0 + 4), mid, mid.clone().lerp(p2, 0.6).setY(y0 + 3), p2]);
      const tube = new THREE.TubeGeometry(curve, 20, 0.75 + rng() * 0.3, 7, false);
      put(solid, tube, rng() < 0.5 ? bark : bark2, 0, 0, 0);
      this.colliders.addCircle(p2.x, p2.z, 1.0, y0 - 1, y0 + 1.2, 'prop', true);
    }
    // champignons lumineux
    site.glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: new THREE.Color('#7dff9a'), emissiveIntensity: 0.75, roughness: 0.5, flatShading: true });
    const cap = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), stem = new THREE.CylinderGeometry(0.18, 0.26, 1, 6);
    for (let i = 0; i < 16; i++) {
      const a = rng() * Math.PI * 2;
      if (Math.abs(angDiff(a, A.gate)) < 0.4) continue;
      const r = A.r + 3.5 + rng() * 6, x = A.x + Math.cos(a) * r, z = A.z + Math.sin(a) * r, s = 0.6 + rng() * 1.1;
      const gy = this.ground(x, z);
      put(solid, stem, '#e9e2c8', x, gy + 0.5 * s, z, 0, 0, 0, s, s, s);
      put(glow, cap, rng() < 0.5 ? '#bfffd0' : '#9fe8ff', x, gy + s, z, 0, 0, 0, s * 0.9, s * 0.6, s * 0.9);
    }
    // lierre en spirale sur les piliers
    for (const b of site.braziers) {
      const pts = [];
      for (let k = 0; k <= 12; k++) { const t = k / 12, a = t * Math.PI * 4 + b.k; pts.push(new THREE.Vector3(b.x + Math.cos(a) * 0.78, A.floor + 0.6 + t * 7.2, b.z + Math.sin(a) * 0.78)); }
      put(solid, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.12, 4, false), moss, 0, 0, 0);
    }
  }

  // Fossoyeur : nécropole, tombes en couronne, crypte au fond, pieux à crânes
  theme_grave(A, site, solid, glow, C) {
    const rng = this.rng, y0 = A.floor;
    const back = A.gate + Math.PI, bx = A.x + Math.cos(back) * (A.r + 9), bz = A.z + Math.sin(back) * (A.r + 9);
    this.placeProp('hw_crypt', bx, bz, 2.8, faceOf(A.x - bx, A.z - bz), 0, true);
    const graves = ['hw_gravestone', 'hw_grave_A', 'hw_grave_B', 'hw_gravemarker_A', 'hw_gravemarker_B', 'hw_grave_A_destroyed'];
    for (let i = 0; i < 22; i++) {
      const a = A.gate + 0.45 + i / 22 * (Math.PI * 2 - 0.9);
      if (Math.abs(angDiff(a, back)) < 0.35) continue;
      const r = A.r + 5 + (i % 2) * 3 + rng() * 1.5, x = A.x + Math.cos(a) * r, z = A.z + Math.sin(a) * r;
      this.placeProp(graves[Math.floor(rng() * graves.length)], x, z, 1.35, faceOf(A.x - x, A.z - z), 0, true);
      if (rng() < 0.3) this.placeProp(rng() < 0.5 ? 'hw_candle_triple' : 'hw_skull_candle', x + 1, z + 0.8, 1.4, rng() * 6, 0, false);
    }
    for (const b of site.braziers) this.placeProp('hw_post_skull', b.x + (A.x - b.x) * 0.09, b.z + (A.z - b.z) * 0.09, 1.5, faceOf(A.x - b.x, A.z - b.z), 0, false);
    // cercueils ouverts et ossements dans l'arène
    for (let i = 0; i < 5; i++) {
      const a = A.gate + 1.2 + i * 0.85, r = A.r * (0.5 + rng() * 0.3), x = A.x + Math.cos(a) * r, z = A.z + Math.sin(a) * r;
      this.placeProp(i % 2 ? 'hw_coffin' : rng() < 0.5 ? 'hw_ribcage' : 'hw_bone_A', x, z, 1.4, rng() * 6, 0, i % 2 === 1);
    }
    put(glow, new THREE.IcosahedronGeometry(0.6, 0), '#c9b8ff', bx, y0 + 7.5, bz);
  }

  // grappe de cristaux (ambre, glace) : prismes pointus inclinés
  crystals(list, x, y, z, n, size, c1, c2) {
    const rng = this.rng, gy = this.ground(x, z);
    for (let k = 0; k < n; k++) {
      const h = size * (1.2 + rng() * 1.6), w = size * (0.22 + rng() * 0.16);
      const geo = new THREE.CylinderGeometry(0, w, h, 5, 1); geo.translate(0, h / 2, 0);
      const base = new THREE.CylinderGeometry(w, w * 0.8, h * 0.25, 5, 1); base.translate(0, -h * 0.1, 0);
      const ox = (rng() - 0.5) * size * 0.9, oz = (rng() - 0.5) * size * 0.9, rx = (rng() - 0.5) * 0.7, rz = (rng() - 0.5) * 0.7;
      const col = new THREE.Color(rng() < 0.5 ? c1 : c2);
      put(list, geo, col, x + ox, gy - 0.2, z + oz, rng() * 6, rx, rz);
      put(list, base, col, x + ox, gy - 0.2, z + oz, rng() * 6, rx, rz);
    }
    this.colliders.addCircle(x, z, size * 0.8, gy - 1, gy + size * 3, 'ruin');
  }

  // ------------------------------------------------------------------ animation
  // état visuel : fight (combat engagé), rage (seconde phase), seal (barrière), win (victoire)
  setState(id, st) { const s = this.sites.find((x) => x.A.id === id); if (s) Object.assign(s.want || (s.want = {}), st); }

  update(dt, elapsed, night, focus) {
    this.time.value = elapsed;
    const dm = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const s of this.sites) {
      const d = focus ? Math.hypot(focus.x - s.A.x, focus.z - s.A.z) : 0;
      const near = d < 420;
      s.group.visible = near;
      if (!near) { for (const l of s.lights) l.intensity = 0; continue; }
      const w = s.want || {}, st = s.state;
      for (const k of ['fight', 'rage', 'seal', 'win']) st[k] += ((w[k] ? 1 : 0) - st[k]) * Math.min(1, dt * (k === 'seal' ? 2.5 : 1.5));
      // flammes : plus hautes au combat, rougies par la fureur, dorées à la victoire
      const col = s.flameMeshes[0].material.color;
      col.copy(s.baseFlame).lerp(new THREE.Color('#ff4030'), st.rage * 0.7).lerp(new THREE.Color('#ffe08a'), st.win).multiplyScalar(2.4);
      s.braziers.forEach((b, i) => {
        const f = 1 + Math.sin(elapsed * 9 + b.k) * 0.12 + Math.sin(elapsed * 15.3 + b.k * 2) * 0.07;
        const k = (0.85 + st.fight * 0.45 + st.rage * 0.3) * f;
        q.setFromAxisAngle(v.set(0, 1, 0), elapsed * 1.5 + b.k);
        dm.compose(v.set(b.x, b.y, b.z), q, sc.set(k * 0.95, k * (1 + st.rage * 0.4), k * 0.95));
        s.flameMeshes[0].setMatrixAt(i, dm);
        dm.compose(v.set(b.x, b.y, b.z), q, sc.set(k * 0.55, k * 0.7, k * 0.55));
        s.flameMeshes[1].setMatrixAt(i, dm);
      });
      s.flameMeshes[0].instanceMatrix.needsUpdate = true; s.flameMeshes[1].instanceMatrix.needsUpdate = true;
      for (const l of s.lights) { l.color.copy(col).multiplyScalar(1 / 2.4); l.intensity = (14 + night * 20 + st.fight * 10) * (0.9 + Math.sin(elapsed * 11 + l.id) * 0.08); }
      // cercle runique : veille, pulsation au combat, rapide en fureur, éclat doré à la victoire
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * (2 + st.rage * 4));
      s.runes.material.opacity = 0.28 + st.fight * (0.45 + pulse * 0.3) + st.win * 0.5;
      s.runes.material.color.set(s.A.theme.glow).lerp(new THREE.Color('#ff5040'), st.rage * 0.6).lerp(new THREE.Color('#ffe7a0'), st.win);
      s.runes.rotation.z += dt * (0.05 + st.fight * 0.2 + st.rage * 0.4);
      s.key.material.color.set(s.A.theme.glow).multiplyScalar(1.6 + st.fight * 1.5 + pulse * st.fight);
      // barrière de brume
      s.barrier.material.uniforms.uOpacity.value = st.seal;
      s.barrier.visible = st.seal > 0.01;
    }
  }
}
