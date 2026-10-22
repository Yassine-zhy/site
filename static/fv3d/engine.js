// FinVeille — le décor 3D (guides 30 et 33).
//
// Une scène WebGL (Three.js), fixée derrière toutes les pages : une ambiance de particules qui ondulent comme une
// étendue d'eau, et qui se reforment d'une page à l'autre. Depuis l'étape 33, les objets qui portent des données (la
// ville du CAC 40, le globe des places, les pièces des cryptomonnaies…) ne sont plus dans ce décor : ce sont des
// maquettes posées dans la page elle-même (vitrines.js).
//
// Chargé par scene3d.py (un composant Streamlit) : show(data) installe le décor de la page et renvoie la fonction
// de nettoyage appelée quand la page se ferme.

import * as THREE from "./three.module.min.js";
import { installVitrines } from "./vitrines.js";

// motion.js arrive avec la version de ce fichier (?v=…, scene3d.py) : un correctif y est pris tout de suite, au lieu
// d'attendre que le navigateur oublie l'ancienne copie (le serveur ne dit pas combien de temps la garder)
const VERSION = new URL(import.meta.url).search;
const installMotion = () => import(`./motion.js${VERSION}`).then((m) => m.installMotion())
  .catch((error) => console.warn("FinVeille : animations indisponibles", error));

// --- Palettes : les couleurs de la marque (theme.py), en clair et en sombre -------------------------------------
const PALETTES = {
  dark: {
    dark: true, brand: "#6d93ff", brand2: "#a78bfa", mint: "#6ee7a8", up: "#34d17f", down: "#ff6375", amber: "#f5b54e",
    orange: "#ff8a4c", ink: "#e8edf6", faint: "#2a3550", solid: "#0b1220", rim: "#6d93ff", win: "#ffcf7a",
    scan: "#a9c1ff", panel: "#060a13", label: "rgba(10, 14, 24, .82)", labelInk: "#e8edf6",
  },
  light: {
    dark: false, brand: "#2451de", brand2: "#7c3aed", mint: "#0e9f6e", up: "#047a3c", down: "#c8263a", amber: "#b86e00",
    orange: "#d95926", ink: "#0b1220", faint: "#9aa6bb", solid: "#f4f7fd", rim: "#2451de", win: "#2451de",
    scan: "#2451de", panel: "#0b1222", label: "rgba(255, 255, 255, .9)", labelInk: "#0b1220",
  },
};
const rgb = (hex) => new THREE.Color(hex).toArray();
const mixc = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

// --- Petits outils ------------------------------------------------------------------------------------------------
function random(seed) {  // un tirage pseudo-aléatoire reproductible (mulberry32) : un décor identique à chaque visite
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// --- Les shaders ----------------------------------------------------------------------------------------------------
const FOG = /* glsl */ `
  uniform float uFogNear, uFogFar;
  float fogFade(float depth) { return 1.0 - smoothstep(uFogNear, uFogFar, depth); }`;

const FIELD = /* glsl */ `
  uniform float uTime, uWave, uRipple;
  uniform vec3 uRippleC;
  vec3 field(vec3 p, float k) {   // houle (terrains) et ondes autour d'un point (alertes)
    float w = uWave * (sin(p.x * 0.42 + uTime * 0.55) * 0.55 + sin(p.z * 0.63 - uTime * 0.38 + p.x * 0.12) * 0.45);
    float r = length(p.xz - uRippleC.xz);
    float o = uRipple * sin(r * 1.25 - uTime * 1.9) * exp(-r * 0.09);
    p.y += (w + o) * k;
    return p;
  }`;

// Les particules : chacune va de aFrom (le décor précédent) à aTo (le décor de la page), avec un petit retard
// propre (aSeed) et une trajectoire en arc. Près du scanner, elles grossissent et s'allument.
const POINTS_VS = /* glsl */ `
  attribute vec3 aFrom; attribute vec3 aTo; attribute vec3 aColA; attribute vec3 aColB; attribute float aSeed;
  uniform float uMorph, uSize, uPixel, uLift, uWobble, uScan, uScanOn, uShimmer, uMaxSize;
  uniform vec3 uCenter, uScanCol;
  varying vec3 vColor; varying float vAlpha;
  ${FOG}
  ${FIELD}
  void main() {
    float k = clamp((uMorph - aSeed * 0.42) / 0.58, 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    vec3 p = mix(aFrom, aTo, k);
    p.y += sin(k * 3.14159) * (1.2 + aSeed * 3.4) * uLift;
    p = field(p, k);
    vec3 d = p - uCenter; float l = length(d);
    if (l > 0.001) p += d / l * uWobble * k * sin(uTime * 1.6 + dot(aTo, vec3(1.3, 1.9, 1.1)) * 1.2);
    p += vec3(sin(uTime * 0.7 + aSeed * 40.0), sin(uTime * 0.9 + aSeed * 57.0), cos(uTime * 0.6 + aSeed * 33.0)) * 0.025 * uShimmer;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    float band = uScanOn * (1.0 - smoothstep(0.0, 0.45, abs(world.y - uScan)));
    float twinkle = 0.7 + 0.3 * sin(uTime * 2.3 + aSeed * 91.0) * uShimmer;
    gl_PointSize = clamp(uSize * (0.55 + aSeed) * twinkle * (1.0 + band * 1.6) * uPixel / -mv.z, 1.0, uMaxSize);
    vColor = mix(aColA, aColB, k) + uScanCol * band * 0.7;
    vAlpha = fogFade(-mv.z);
  }`;
const POINTS_FS = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.05, r) * vAlpha * uOpacity);
  }`;

// Les volumes pleins : verre sombre (ou maquette blanche en clair), fenêtres allumées, liseré lumineux au scanner.
// Au-dessus du plan du scanner, rien : on ne voit plus que les fils de fer et les particules (les « rayons X »).
const HIGHLIGHT = /* glsl */ `
  uniform vec3 uHi; uniform float uHiOn; uniform vec3 uHiCol;
  float isHi(float id) {   // id 0 : rien ; sinon le numéro de la tour + 1
    return id > 0.5 && (abs(id - uHi.x) < 0.5 || abs(id - uHi.y) < 0.5 || abs(id - uHi.z) < 0.5) ? 1.0 : 0.0;
  }`;

const SOLID_VS = /* glsl */ `
  attribute vec3 aCol; attribute float aWin; attribute float aId;
  varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying float vWin; varying float vDepth; varying float vId;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vCol = aCol; vWin = aWin; vId = aId;
    vec4 mv = viewMatrix * w; vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const SOLID_FS = /* glsl */ `
  uniform float uScan, uScanOn, uFade, uTime, uTint;
  uniform vec3 uBase, uRim, uWinCol, uScanCol;
  varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying float vWin; varying float vDepth; varying float vId;
  ${FOG}
  ${HIGHLIGHT}
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    float above = vW.y - uScan;
    if (uScanOn > 0.5 && above > 0.0) discard;
    vec3 n = normalize(vN);
    float diff = max(dot(n, normalize(vec3(0.45, 0.8, 0.4))), 0.0);
    float rim = pow(1.0 - abs(dot(n, normalize(cameraPosition - vW))), 2.4);
    vec3 col = uBase * (0.62 + 0.38 * diff) + vCol * uTint + uRim * rim * 0.55;
    if (vWin > 0.0 && abs(n.y) < 0.5) {   // les fenêtres : une grille, certaines allumées (et qui changent)
      float along = abs(n.x) > 0.5 ? vW.z : vW.x;
      vec2 g = vec2(along * 6.0, vW.y * 4.6);
      vec2 f = fract(g); vec2 id = floor(g) + floor(vW.xz * 0.5) * 7.0;
      float cell = step(0.3, f.x) * step(f.x, 0.7) * step(0.3, f.y) * step(f.y, 0.7);
      float lit = step(0.66, hash(id + floor(uTime * 0.12 + hash(id) * 9.0)));
      col += uWinCol * cell * lit * vWin;
    }
    float band = uScanOn * (1.0 - smoothstep(0.0, 0.3, abs(above)));
    col += uScanCol * band * 1.3;
    float hi = isHi(vId);   // le récit : les tours du chapitre s'allument, les autres s'éteignent
    col = mix(col, col * 0.4, uHiOn * (1.0 - hi)) + uHiCol * hi * uHiOn * (0.32 + 0.18 * sin(uTime * 3.0));
    gl_FragColor = vec4(col, uFade * fogFade(vDepth));
  }`;

// Les fils de fer : pleinement visibles dans la zone « rayons X », discrets sur les volumes pleins.
const EDGE_VS = /* glsl */ `
  attribute vec3 aCol; attribute float aT; attribute float aId;
  uniform float uField;
  varying vec3 vCol; varying float vY; varying float vDepth; varying float vT; varying float vId;
  ${FIELD}
  void main() {
    vec3 p = uField > 0.5 ? field(position, 1.0) : position;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vY = w.y; vCol = aCol; vT = aT; vId = aId;
    vec4 mv = viewMatrix * w; vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const EDGE_FS = /* glsl */ `
  uniform float uScan, uScanOn, uFade, uBelow, uFlow, uTime;
  uniform vec3 uScanCol;
  varying vec3 vCol; varying float vY; varying float vDepth; varying float vT; varying float vId;
  ${FOG}
  ${HIGHLIGHT}
  void main() {
    float above = vY - uScan;
    float xray = uScanOn > 0.5 ? step(0.0, above) : 1.0;
    float band = uScanOn * (1.0 - smoothstep(0.0, 0.3, abs(above)));
    float a = mix(uBelow, 1.0, xray);
    if (uFlow > 0.0 && vT >= 0.0) a *= 0.25 + 0.75 * smoothstep(0.82, 1.0, fract(vT * 3.0 - uTime * uFlow));   // flux qui court
    float hi = isHi(vId);
    a *= mix(1.0, 0.3, uHiOn * (1.0 - hi));
    gl_FragColor = vec4(vCol + uScanCol * band + uHiCol * hi * uHiOn * 0.9, a * uFade * fogFade(vDepth));
  }`;

// Les flux : des points qui circulent d'un point A à un point B (voitures, transactions, capitaux).
const STREAM_VS = /* glsl */ `
  attribute vec3 aA; attribute vec3 aB; attribute vec3 aCol; attribute float aSeed; attribute float aSpeed;
  uniform float uSize, uPixel, uSphere, uTime;
  varying vec3 vColor; varying float vAlpha;
  ${FOG}
  void main() {
    float t = fract(aSeed + uTime * aSpeed);
    vec3 p = mix(aA, aB, t);
    if (uSphere > 0.0) p = normalize(p) * (uSphere + sin(t * 3.14159) * (0.25 + distance(aA, aB) * 0.22));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.0, uSize * uPixel / -mv.z);
    vColor = aCol;
    vAlpha = fogFade(-mv.z) * smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.92, 1.0, t));
  }`;
const STREAM_FS = /* glsl */ `
  uniform float uFade;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.0, r) * vAlpha * uFade);
  }`;

// Les bandeaux lumineux des tours : le texte défile (uOffset), et s'éteint avec la tour au passage du scanner.
const BAND_VS = /* glsl */ `
  varying vec2 vUv; varying float vY; varying float vDepth;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y;
    vec4 mv = viewMatrix * w; vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const BAND_FS = /* glsl */ `
  uniform sampler2D uMap; uniform float uScan, uScanOn, uFade, uOffset, uHiOn;
  varying vec2 vUv; varying float vY; varying float vDepth;
  ${FOG}
  void main() {
    if (uScanOn > 0.5 && vY > uScan) discard;
    vec4 c = texture2D(uMap, vec2(vUv.x + uOffset, vUv.y));
    // pendant un gros plan du récit, les bandeaux s'effacent : on regarde les tours du chapitre
    gl_FragColor = linearToOutputTexel(vec4(c.rgb, c.a * uFade * fogFade(vDepth) * (1.0 - 0.85 * uHiOn)));
  }`;

// --- Construire la géométrie --------------------------------------------------------------------------------------
// Un décor = des listes de boîtes (tours, blocs), de segments (fils de fer) et de particules, assemblées en un
// petit nombre d'objets : quelques appels de dessin par image, même pour des centaines de tours.

class Builder {
  constructor(n, palette, seed) {
    this.n = n; this.pal = palette; this.rand = random(seed);
    this.targets = new Float32Array(n * 3); this.colors = new Float32Array(n * 3); this.count = 0;
    this.solid = { pos: [], nor: [], col: [], win: [], idx: [], id: [] };
    this.edges = { pos: [], col: [], t: [], id: [] };
    this.streams = { a: [], b: [], col: [], seed: [], speed: [] };
    this.group = new THREE.Group();
  }
  point(x, y, z, c) {
    if (this.count >= this.n) return false;
    const i = this.count++ * 3;
    this.targets[i] = x; this.targets[i + 1] = y; this.targets[i + 2] = z;
    this.colors[i] = c[0]; this.colors[i + 1] = c[1]; this.colors[i + 2] = c[2];
    return true;
  }
  left() { return this.n - this.count; }
  segment(a, b, c, t0 = -1, t1 = -1, id = 0) {   // t0, t1 ≥ 0 : un flux court le long du segment ; id : la tour
    this.edges.pos.push(...a, ...b); this.edges.col.push(...c, ...c); this.edges.t.push(t0, t1); this.edges.id.push(id, id);
  }
  stream(a, b, c, speed) {
    this.streams.a.push(...a); this.streams.b.push(...b); this.streams.col.push(...c);
    this.streams.seed.push(this.rand()); this.streams.speed.push(speed);
  }
  // Une boîte de centre (x, z), posée au sol à y0, tournée de `rot` autour de la verticale
  box(x, z, w, d, h, c, { y0 = 0, rot = 0, win = 0, edge = c, points = 0, tint = c, id = 0 } = {}) {
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const at = (dx, y, dz) => [x + dx * cos - dz * sin, y, z + dx * sin + dz * cos];
    const hw = w / 2, hd = d / 2, y1 = y0 + h;
    const corners = [at(-hw, y0, -hd), at(hw, y0, -hd), at(hw, y0, hd), at(-hw, y0, hd),
      at(-hw, y1, -hd), at(hw, y1, -hd), at(hw, y1, hd), at(-hw, y1, hd)];
    const faces = [  // quatre coins par face, et la normale (avant rotation)
      [[0, 1, 5, 4], [0, 0, -1]], [[1, 2, 6, 5], [1, 0, 0]], [[2, 3, 7, 6], [0, 0, 1]],
      [[3, 0, 4, 7], [-1, 0, 0]], [[4, 5, 6, 7], [0, 1, 0]],
    ];
    const s = this.solid;
    for (const [quad, [nx, ny, nz]] of faces) {
      const base = s.pos.length / 3;
      const normal = [nx * cos - nz * sin, ny, nx * sin + nz * cos];
      for (const k of quad) { s.pos.push(...corners[k]); s.nor.push(...normal); s.col.push(...tint); s.win.push(win); s.id.push(id); }
      s.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);   // faces tournées vers l'extérieur
    }
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) {
      this.segment(corners[a], corners[b], edge, -1, -1, id);
    }
    for (let k = 0; k < points; k++) {   // des particules sur les arêtes (40 %) et sur les faces
      const r = this.rand;
      if (r() < 0.4) {
        const [a, b] = [[0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4]][Math.floor(r() * 8)];
        const t = r(); const A = corners[a], B = corners[b];
        this.point(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t, c);
      } else {
        const side = Math.floor(r() * 5), u = r() - 0.5, v = r();
        const p = side === 4 ? at(u * w, y1, (v - 0.5) * d)
          : side % 2 === 0 ? at(u * w, y0 + v * h, side === 0 ? -hd : hd) : at(side === 1 ? hw : -hw, y0 + v * h, u * d);
        this.point(p[0], p[1], p[2], c);
      }
    }
  }
  // Le sol : un quadrillage qui s'efface au loin, et de la poussière lumineuse posée dessus
  ground(size, step, c, dust = 0) {
    for (let v = -size; v <= size + 1e-6; v += step) {
      this.segment([-size, 0, v], [size, 0, v], c); this.segment([v, 0, -size], [v, 0, size], c);
    }
    for (let k = 0; k < dust; k++) this.point((this.rand() * 2 - 1) * size, 0, (this.rand() * 2 - 1) * size, c);
  }
  // Ce qui reste de particules : une poussière fine dans le volume (jamais de particules « perdues »)
  dust(rx, ry, rz, c, y0 = 0) {
    // sur fond sombre, des points éteints ; sur fond clair, presque blancs (sinon : des « poussières » grises)
    const fade = this.pal.dark ? [0, 0, 0] : [1, 1, 1];
    while (this.left() > 0) {
      const r = this.rand;
      this.point((r() * 2 - 1) * rx, y0 + Math.pow(r(), 2) * ry, (r() * 2 - 1) * rz, mixc(c, fade, this.pal.dark ? 0.3 + r() * 0.5 : 0.6 + r() * 0.3));
    }
  }
  build(uniforms) {
    const pal = this.pal;
    if (this.solid.idx.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(this.solid.pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(this.solid.nor, 3));
      g.setAttribute("aCol", new THREE.Float32BufferAttribute(this.solid.col, 3));
      g.setAttribute("aWin", new THREE.Float32BufferAttribute(this.solid.win, 1));
      g.setAttribute("aId", new THREE.Float32BufferAttribute(this.solid.id, 1));
      g.setIndex(this.solid.idx);
      this.group.add(solidMesh(g, uniforms, pal));
    }
    if (this.edges.pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(this.edges.pos, 3));
      g.setAttribute("aCol", new THREE.Float32BufferAttribute(this.edges.col, 3));
      g.setAttribute("aT", new THREE.Float32BufferAttribute(this.edges.t, 1));
      g.setAttribute("aId", new THREE.Float32BufferAttribute(this.edges.id, 1));
      this.group.add(edgeLines(g, uniforms, pal));
    }
    if (this.streams.speed.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("aA", new THREE.Float32BufferAttribute(this.streams.a, 3));
      g.setAttribute("aB", new THREE.Float32BufferAttribute(this.streams.b, 3));
      g.setAttribute("position", new THREE.Float32BufferAttribute(this.streams.a, 3));  // pour le calcul des limites
      g.setAttribute("aCol", new THREE.Float32BufferAttribute(this.streams.col, 3));
      g.setAttribute("aSeed", new THREE.Float32BufferAttribute(this.streams.seed, 1));
      g.setAttribute("aSpeed", new THREE.Float32BufferAttribute(this.streams.speed, 1));
      this.group.add(streamPoints(g, uniforms, pal));
    }
    this.dust(18, 10, 18, rgb(pal.faint));
    return this;
  }
}

function solidMesh(geometry, uniforms, pal) {
  const material = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uBase: { value: new THREE.Color(pal.solid) }, uRim: { value: new THREE.Color(pal.rim) },
      uWinCol: { value: new THREE.Color(pal.win).multiplyScalar(pal.dark ? 0.85 : 0.35) },
      uTint: { value: pal.dark ? 0.2 : 0.18 } },
    vertexShader: SOLID_VS, fragmentShader: SOLID_FS, transparent: true, depthWrite: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1;
  return mesh;
}
function edgeLines(geometry, uniforms, pal, extra = {}) {
  const material = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uBelow: { value: pal.dark ? 0.32 : 0.4 }, uFlow: { value: 0 }, uField: { value: 0 }, ...extra },
    vertexShader: EDGE_VS, fragmentShader: EDGE_FS, transparent: true, depthWrite: false,
    blending: pal.dark ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = 2;
  return lines;
}
function streamPoints(geometry, uniforms, pal, extra = {}) {
  const material = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uSize: { value: 0.11 }, uSphere: { value: 0 }, ...extra },
    vertexShader: STREAM_VS, fragmentShader: STREAM_FS, transparent: true, depthWrite: false,
    blending: pal.dark ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 4;
  return points;
}

// Un texte dessiné dans une toile (canvas), utilisé comme texture : étiquettes du globe, bandeaux de titres.
function textCanvas(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  draw(canvas.getContext("2d"));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const redraw = () => { draw(canvas.getContext("2d")); texture.needsUpdate = true; };
  if (document.fonts) document.fonts.load('600 40px "IBM Plex Sans"').then(redraw, () => {});  // police chargée
  return texture;
}
// --- Les décors ---------------------------------------------------------------------------------------------------
// Chaque décor renvoie : les particules (targets, colors), un groupe d'objets, deux poses de caméra (haut de page,
// puis après défilement), la plage du scanner [bas, haut] et une fonction update(t, p) pour ses propres animations.

// Les terrains (Économie, Alertes, Brief et les pages calmes) : une surface de points qui ondule, des lignes de crête.
function terrainScene(n, pal, data, uniforms) {
  const shape = data.shape || "waves";
  const b = new Builder(n, pal, shape.length * 31 + 5);
  const warm = shape === "dawn";
  const brand = rgb(pal.brand), brand2 = rgb(warm ? pal.amber : pal.brand2), mint = rgb(warm ? pal.orange : pal.mint);
  const gx = Math.round(Math.sqrt(n * 0.78 * 1.7)), gz = Math.floor(n * 0.78 / gx);
  const X = 15, Z = 9;
  const height = (x, z) => {
    if (shape === "ridges") {   // des courbes des taux : chaque rangée monte vite puis s'aplatit
      const a = 1.2 + Math.sin(z * 0.7) * 0.6;
      return a * (1 - Math.exp(-(x + X) / (3 + Math.cos(z * 0.5) * 1.5))) - 0.4;
    }
    if (shape === "ripples") return 0;
    return 0.35 * Math.sin(x * 0.3 + z * 0.2);
  };
  for (let i = 0; i < gx; i++) for (let j = 0; j < gz; j++) {
    const x = -X + (i / (gx - 1)) * 2 * X, z = -Z + (j / (gz - 1)) * 2 * Z, y = height(x, z);
    b.point(x, y, z, mixc(mixc(brand, brand2, j / gz), mint, smooth(0.6, 1.6, y) * 0.8));
  }
  const rows = shape === "ridges" ? 12 : 9;
  for (let r = 0; r < rows; r++) {  // les lignes de crête
    const z = -Z + (r + 0.5) * 2 * Z / rows;
    for (let s = 0; s < 80; s++) {
      const x0 = -X + s * 2 * X / 80, x1 = x0 + 2 * X / 80;
      b.segment([x0, height(x0, z) + 0.02, z], [x1, height(x1, z) + 0.02, z], mixc(brand, brand2, r / rows), s / 80, (s + 1) / 80);
    }
  }
  if (shape === "ripples") {   // le seuil d'alerte : une colonne au centre des ondes
    b.box(0, 0, 0.35, 0.35, 3.2, mint, { win: 0, points: 300, tint: mint });
  }
  b.build(uniforms);
  const lines = b.group.children.find((o) => o.isLineSegments);
  if (lines) { lines.material.uniforms.uField.value = 1; lines.material.uniforms.uFlow.value = shape === "ridges" ? 0.12 : 0; }
  if (warm) {   // le brief du jour : un soleil qui se lève derrière l'horizon
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: textCanvas(256, 256, (ctx) => {
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, "rgba(255, 214, 140, 1)"); g.addColorStop(0.22, "rgba(255, 170, 90, .85)");
      g.addColorStop(0.5, "rgba(255, 120, 70, .25)"); g.addColorStop(1, "rgba(255, 120, 70, 0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    }), transparent: true, depthWrite: false, blending: pal.dark ? THREE.AdditiveBlending : THREE.NormalBlending }));
    sun.scale.set(9, 9, 1); sun.position.set(5, 0.5, -11); sun.renderOrder = 0;
    sun.material.opacity = pal.dark ? 1 : 0.45;
    b.group.add(sun);
    b.sun = sun;
  }
  return {
    ...b, center: [0, 0, 0], scan: [-1, 2.5], xray: false,
    wave: { ripples: 0.12, ridges: 0.12, calm: 0.22 }[shape] ?? 0.45, ripple: shape === "ripples" ? 0.55 : 0,
    cam0: { pos: [0, 6.2, 14.5], look: [0, 0, -2] }, cam1: { pos: [0, 2.6, 8.5], look: [0, 0.6, -5] },
    update(t, p) { if (b.sun) b.sun.position.y = 0.2 + easeOut(clamp(p)) * 2.4 + Math.sin(t * 0.2) * 0.05; },
  };
}

const SCENES = { terrain: terrainScene };

// --- Le monde : la toile, la caméra, la boucle d'animation -------------------------------------------------------
class World {
  constructor() {
    const media = (q) => window.matchMedia(q).matches;
    this.small = media("(pointer: coarse)") || window.innerWidth < 760;
    this.reduced = media("(prefers-reduced-motion: reduce)");
    this.n = this.small ? 9000 : 20000;
    this.host = document.createElement("div");
    this.host.id = "fv3d";
    this.host.setAttribute("aria-hidden", "true");
    this.canvas = document.createElement("canvas");
    this.host.appendChild(this.canvas);
    this.attach();
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.small, alpha: true,
      powerPreference: "high-performance" });
    this.renderer.setClearColor(0x000000, 0);
    this.dpr = Math.min(window.devicePixelRatio || 1, this.small ? 1.5 : 1.75);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
    this.scene = new THREE.Scene();
    this.mode = this.detectMode();
    this.pal = PALETTES[this.mode];
    this.u = {   // les réglages partagés par tous les shaders (une seule copie, mise à jour à chaque image)
      uTime: { value: 0 }, uScan: { value: -100 }, uScanOn: { value: 1 }, uFogNear: { value: 18 }, uFogFar: { value: 46 },
      uScanCol: { value: new THREE.Color(this.pal.scan) }, uPixel: { value: 1 },
      uWave: { value: 0 }, uRipple: { value: 0 }, uRippleC: { value: new THREE.Vector3() },
      uHi: { value: new THREE.Vector3() }, uHiOn: { value: 0 }, uHiCol: { value: new THREE.Color() },
    };
    this.makeParticles();
    this.current = null; this.leaving = [];
    this.key = ""; this.refs = 0; this.p = 0; this.clock = 0; this.last = performance.now();
    this.pointer = [0, 0]; this.look = [0, 0];
    this.slowFrames = 0; this.frames = 0;
    this.onResize = () => this.resize();
    this.raycaster = new THREE.Raycaster();
    this.onPointer = (e) => {
      this.pointer = [e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5];
      // le survol ne compte que sur le décor, pas sur un texte, une tuile ou un bouton posés devant
      const target = e.target instanceof Element ? e.target : null;
      this.hovering = !!target?.closest(".fv-hero") && !target.closest(".fv-hero-copy > *, .fv-float, a, button");
      this.dirty = this.dirty || this.hovering;
    };
    this.onVisible = () => { if (!document.hidden && this.refs > 0) this.start(); };
    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointermove", this.onPointer, { passive: true });
    document.addEventListener("visibilitychange", this.onVisible);
    this.canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.broken = true; this.hide(); });
    this.resize();
  }
  attach() {   // la toile se place sous l'application (premier enfant de .stApp), derrière tout le contenu
    const app = document.querySelector(".stApp");
    if (app && this.host.parentElement !== app) app.insertBefore(this.host, app.firstChild);
  }
  detectMode() {
    const app = document.querySelector(".stApp");
    const m = (app ? getComputedStyle(app).backgroundColor : "").match(/\d+(\.\d+)?/g);
    if (!m) return "dark";
    const [r, g, b] = m.map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.4 ? "dark" : "light";
  }
  makeParticles() {
    const n = this.n, geo = new THREE.BufferGeometry(), rnd = random(1);
    const from = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {   // au tout début : un nuage dispersé, qui va se rassembler
      const r = 14 + rnd() * 22, th = rnd() * Math.PI * 2, u = rnd() * 2 - 1;
      from[i * 3] = Math.sqrt(1 - u * u) * Math.cos(th) * r; from[i * 3 + 1] = u * r * 0.6 + 4;
      from[i * 3 + 2] = Math.sqrt(1 - u * u) * Math.sin(th) * r; seed[i] = rnd();
    }
    const col = new Float32Array(n * 3).fill(0.25);
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute("aFrom", new THREE.BufferAttribute(from, 3));
    geo.setAttribute("aTo", new THREE.BufferAttribute(from.slice(), 3));
    geo.setAttribute("aColA", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aColB", new THREE.BufferAttribute(col.slice(), 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    this.pu = { ...this.u, uMorph: { value: 1 }, uSize: { value: 0.05 }, uLift: { value: 1 }, uWobble: { value: 0 },
      uCenter: { value: new THREE.Vector3() }, uOpacity: { value: 1 }, uMaxSize: { value: 6 }, uShimmer: { value: this.reduced ? 0 : 1 },
      uScanOn: { value: 1 } };
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: this.pu, vertexShader: POINTS_VS, fragmentShader: POINTS_FS, transparent: true, depthWrite: false,
      blending: this.pal.dark ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    this.scene.add(this.points);
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Sur un grand écran, le décor se place à droite : le titre de la page reste à gauche, sur un fond calme.
    this.frameHero(true);
    this.u.uPixel.value = h * this.dpr / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    this.pu.uMaxSize.value = 5 * this.dpr;
    this.dirty = true;
  }

  // Le décor de la page : les particules partent de là où elles sont, et rejoignent leur nouvelle place.
  setScene(data) {
    const build = SCENES[data.scene] || SCENES.terrain;
    const group = { uFade: { value: 0 }, uScanOn: { value: 1 }, uWave: { value: 0 }, uRipple: { value: 0 } };
    const uniforms = { ...this.u, ...group };
    const def = build(this.n, this.pal, data, uniforms);
    def.uniforms = group; def.data = data;
    group.uScanOn.value = def.xray ? 1 : 0;
    group.uWave.value = def.wave || 0; group.uRipple.value = def.ripple || 0;
    const geo = this.points.geometry, n = this.n;
    const from = geo.attributes.aFrom.array, to = geo.attributes.aTo.array;
    const colA = geo.attributes.aColA.array, colB = geo.attributes.aColB.array, seed = geo.attributes.aSeed.array;
    // la position actuelle de chaque particule (au milieu d'un trajet si le visiteur change vite de page),
    // ramenée dans le repère du nouveau décor
    const m = this.pu.uMorph.value, old = this.points.matrixWorld.clone();
    this.points.updateMatrixWorld(true);
    def.update?.(this.clock, this.p);
    def.group.updateMatrixWorld(true);
    const inv = def.group.matrixWorld.clone().invert(), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      let k = clamp((m - seed[i] * 0.42) / 0.58); k = k * k * (3 - 2 * k);
      for (let a = 0; a < 3; a++) {
        const j = i * 3 + a;
        from[j] = from[j] + (to[j] - from[j]) * k;
        colA[j] = colA[j] + (colB[j] - colA[j]) * k;
      }
      v.fromArray(from, i * 3).applyMatrix4(old).applyMatrix4(inv).toArray(from, i * 3);
    }
    to.set(def.targets); colB.set(def.colors);
    for (const name of ["aFrom", "aTo", "aColA", "aColB"]) geo.attributes[name].needsUpdate = true;
    this.points.rotation.copy(def.group.rotation);
    this.points.position.copy(def.group.position);
    // même décor, nouvelles données (les couleurs de la séance arrivent) : pas de nouvelle arrivée, un fondu
    const update = this.current?.data.scene === data.scene;
    if (this.current) this.leaving.push(this.current);
    this.current = def;
    this.scene.add(def.group);
    this.started = this.clock;
    this.camFrom = this.pose ? { pos: [...this.pose.pos], look: [...this.pose.look] } : null;
    this.pu.uMorph.value = 0;
    this.pu.uWobble.value = 0;
    if (update) { this.started = this.clock - 6; this.camFrom = null; def.uniforms.uFade.value = 1; }
    this.pu.uCenter.value.fromArray(def.center || [0, 0, 0]);
    this.pu.uSize.value = def.size || 0.05;
    this.u.uRippleC.value.set(0, 0, 0);
    this.dirty = true;
  }
  rebuildForTheme() {   // le visiteur change de thème : même décor, nouvelles couleurs, sans animation
    this.pal = PALETTES[this.mode];
    this.u.uScanCol.value.set(this.pal.scan);
    this.points.material.blending = this.pal.dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.points.material.needsUpdate = true;
    if (!this.current) return;
    const data = this.current.data;
    this.dispose(this.current);
    this.current = null;
    this.setScene(data);
    const geo = this.points.geometry;
    geo.attributes.aFrom.array.set(geo.attributes.aTo.array);
    geo.attributes.aColA.array.set(geo.attributes.aColB.array);
    geo.attributes.aFrom.needsUpdate = geo.attributes.aColA.needsUpdate = true;
    this.pu.uMorph.value = 1;
    this.started = this.clock - 10;
    this.current.uniforms.uFade.value = 1;
    this.camFrom = null;
  }
  dispose(def) {
    this.scene.remove(def.group);
    def.group.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) { o.material.map?.dispose(); o.material.dispose(); }
    });
    for (const texture of def.bands || []) texture.dispose();
  }

  // Le décor se centre sur l'en-tête de la page (à droite sur grand écran) ; la caméra recule si l'en-tête est bas
  frameHero(force = false) {
    const w = window.innerWidth, h = window.innerHeight;
    const box = this.hero?.isConnected ? this.hero.getBoundingClientRect() : null;
    const top = box ? box.top + (this.scroller?.scrollTop || 0) : h * 0.1;
    const height = box ? box.height : h * 0.5;
    const focus = clamp(top + height * 0.5, h * 0.24, h * 0.5);
    const shift = w >= 900 ? w * 0.17 : 0;
    const key = `${w}x${h}:${Math.round(focus)}:${Math.round(height)}`;
    if (!force && key === this.framed) return;
    this.framed = key;
    this.camera.setViewOffset(w, h, -shift, h / 2 - focus, w, h);
    this.camera.updateProjectionMatrix();
    this.distance = clamp(Math.pow(0.64 * h / Math.max(240, height), 0.55), 1, 1.45);
    this.u.uFogNear.value = 18 * this.distance; this.u.uFogFar.value = 46 * this.distance;
  }

  // Le défilement : 0 en haut de la page, 1 une fois l'en-tête passé
  scroll() {
    // la zone qui défile (sur une page de discussion, Streamlit la nomme autrement)
    if (!this.scroller?.isConnected) {
      this.scroller = document.querySelector('[data-testid="stMain"], [data-testid="stAppScrollToBottomContainer"]');
    }
    if (!this.hero?.isConnected) this.hero = document.querySelector(".fv-story-stage, .fv-hero");
    const top = this.scroller ? this.scroller.scrollTop : 0;
    const box = this.hero ? this.hero.getBoundingClientRect() : null;
    const span = box ? Math.max(320, box.height + 120) : window.innerHeight * 0.7;
    const bottom = box ? Math.max(0, Math.round(box.bottom)) : 0;
    if (bottom !== this.heroBottom) { this.heroBottom = bottom; this.host.style.setProperty("--hb", `${bottom}px`); }
    if (this.frames % 15 === 0 || !this.framed) this.frameHero();
    return clamp(top / span, 0, 1.6);
  }

  frame(now) {
    this.raf = 0;
    if (this.stopped) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.reduced) this.clock += dt;
    const t = this.clock, def = this.current;
    if (!def) return;
    if (++this.frames % 45 === 0) {
      this.attach();
      const mode = this.detectMode();
      if (mode !== this.mode) { this.mode = mode; this.rebuildForTheme(); }
    }
    const target = this.reduced ? 0 : this.scroll();
    if (this.reduced) this.scroll();
    const before = this.p;
    this.p += (target - this.p) * (1 - Math.exp(-dt * 7));
    const p = this.p;

    // l'arrivée : les particules se rassemblent (1,9 s), puis le scanner monte et révèle les volumes (1,6 s)
    const age = t - this.started;
    const morph = this.reduced ? 1 : clamp(age / 1.9);
    this.pu.uMorph.value = morph;
    this.pu.uWobble.value = (def.wobble || 0) * smooth(1.2, 2.4, age);
    const reveal = this.reduced ? 1 : easeInOut(clamp((age - 1.1) / 1.6));
    const xray = def.xray ? smooth(0.06, 0.85, p) : 0;
    this.u.uScan.value = def.scan[0] + (def.scan[1] - def.scan[0]) * reveal * (1 - xray);
    this.pu.uScanOn.value = def.xray ? 1 : 0;
    def.uniforms.uFade.value = this.reduced ? 1 : smooth(0.55, 1.5, age);
    def.uniforms.uWave.value = def.wave || 0; def.uniforms.uRipple.value = def.ripple || 0;
    this.u.uWave.value = def.wave || 0; this.u.uRipple.value = def.ripple || 0;
    for (const sprite of def.labels || []) sprite.material.opacity = smooth(1.6, 2.4, age) * (1 - smooth(0.4, 1.1, p) * 0.6);
    if (def.pick && !this.small) {   // l'étiquette de la tour survolée apparaît, les autres s'effacent
      let picked = null;
      if (this.hovering && p < 0.5 && age > 3) {
        this.raycaster.setFromCamera({ x: this.pointer[0] * 2, y: -this.pointer[1] * 2 }, this.camera);
        picked = def.pick(this.raycaster);
      }
      for (const sprite of def.labelsOf?.() || []) {
        const goal = sprite === picked ? 1 : 0;
        sprite.material.opacity += (goal - sprite.material.opacity) * (1 - Math.exp(-dt * 10));
      }
    }
    for (const old of this.leaving) {
      old.uniforms.uFade.value = Math.max(0, old.uniforms.uFade.value - dt * 2.6);
      for (const sprite of old.labels || []) sprite.material.opacity = old.uniforms.uFade.value;
    }
    this.leaving = this.leaving.filter((old) => (old.uniforms.uFade.value > 0 ? true : (this.dispose(old), false)));
    this.u.uTime.value = t;
    def.update?.(t, p);
    this.points.rotation.copy(def.group.rotation);

    // la caméra : de la pose du haut de page à la pose « plongée », un léger tour sur elle-même, la souris
    const k = easeInOut(clamp(p));
    const lerp = (a, b, s) => a.map((v, i) => v + (b[i] - v) * s);
    let pos = lerp(def.cam0.pos, def.cam1.pos, k), look = lerp(def.cam0.look, def.cam1.look, k);
    const far = (this.distance || 1) * (def.far || 1);   // def.far : un décor qui demande plus de recul
    pos = pos.map((v, i) => look[i] + (v - look[i]) * far);
    if (!this.reduced) {
      const swing = Math.sin(t * 0.07) * 0.11, cos = Math.cos(swing), sin = Math.sin(swing);
      const dx = pos[0] - look[0], dz = pos[2] - look[2];
      pos = [look[0] + dx * cos - dz * sin, pos[1], look[2] + dx * sin + dz * cos];
      this.look[0] += (this.pointer[0] - this.look[0]) * (1 - Math.exp(-dt * 2.5));
      this.look[1] += (this.pointer[1] - this.look[1]) * (1 - Math.exp(-dt * 2.5));
      pos = [pos[0] + this.look[0] * 1.6, pos[1] - this.look[1] * 1.0, pos[2]];
    }
    if (this.camFrom && !this.reduced) {   // en changeant de page, la caméra glisse vers sa nouvelle pose
      const s = easeInOut(clamp(age / 1.8));
      pos = lerp(this.camFrom.pos, pos, s); look = lerp(this.camFrom.look, look, s);
      if (s >= 1) this.camFrom = null;
    }
    this.pose = { pos, look };
    this.camera.position.fromArray(pos);
    this.camera.lookAt(...look);
    // une fois l'en-tête passé, le décor devient un fond discret derrière le contenu
    const ambient = (0.24 - smooth(0.3, 1.2, p) * 0.1) * (this.pal.dark ? 1 : 0.6);   // plus discret en clair
    this.host.style.setProperty("--amb", ambient.toFixed(3));

    // Économie : un écran lent rend moins de points par seconde ; au repos (décor discret, rien ne bouge), on
    // dessine une image sur trois.
    const busy = !this.reduced && (age < 4.5 || Math.abs(p - before) > 0.0005 || p < 0.9);
    if (busy || this.dirty || (!this.reduced && this.frames % 3 === 0)) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
      this.host.classList.add("is-on");
      if (this.frames > 30 && this.frames < 400) {
        this.slowFrames = dt > 0.04 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
        if (this.slowFrames > 40 && this.dpr > 1) { this.dpr = 1; this.slowFrames = 0; this.resize(); }
      }
    }
    if (this.reduced) this.idleUntilChange();
    else this.loop();
  }
  idleUntilChange() {   // mouvement réduit : une image fixe, redessinée seulement si quelque chose change
    clearTimeout(this.idle);
    this.idle = setTimeout(() => this.loop(), 500);
  }
  loop() { if (!this.manual && !this.raf && !document.hidden) this.raf = requestAnimationFrame((now) => this.frame(now)); }
  // Pour la bande-annonce (tools/trailer.py) : le temps avance image par image, quelle que soit la vitesse du rendu
  tick(ms) { this.manual = true; this.stopped = false; this.last = performance.now() - ms; this.frame(performance.now()); }
  replay() {   // rejoue l'arrivée du décor : les particules repartent d'un nuage dispersé
    const geo = this.points.geometry, from = geo.attributes.aFrom.array, rnd = random(1);
    for (let i = 0; i < this.n; i++) {
      const r = 14 + rnd() * 22, th = rnd() * Math.PI * 2, u = rnd() * 2 - 1;
      from[i * 3] = Math.sqrt(1 - u * u) * Math.cos(th) * r; from[i * 3 + 1] = u * r * 0.6 + 4;
      from[i * 3 + 2] = Math.sqrt(1 - u * u) * Math.sin(th) * r; rnd();
    }
    geo.attributes.aFrom.needsUpdate = true;
    this.pu.uMorph.value = 0; this.started = this.clock; this.camFrom = null;
  }
  start() { this.stopped = false; this.last = performance.now(); this.loop(); }
  hide() {
    this.host.classList.remove("is-on");
    document.documentElement.classList.remove("fv-3d");
    this.stopped = true;
  }
  retain(data) {
    clearTimeout(this.releaseTimer);
    this.refs += 1;
    const key = JSON.stringify(data);
    if (key !== this.key) { this.key = key; this.setScene(data); }
    if (!this.broken) { document.documentElement.classList.add("fv-3d"); this.start(); }
  }
  release() {
    this.refs = Math.max(0, this.refs - 1);
    clearTimeout(this.releaseTimer);
    // une page qui se ferme est presque toujours remplacée par une autre : on attend avant d'éteindre
    this.releaseTimer = setTimeout(() => { if (this.refs === 0) { this.hide(); this.key = ""; } }, 1500);
  }
}

let world = null;
function webgl() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGL2RenderingContext && c.getContext("webgl2"));
  } catch { return false; }
}

// --- Les cartes d'actualité en relief : elles s'inclinent vers la souris, un reflet suit le pointeur ----------------
function installTilt() {
  if (window.__fvTilt || !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.__fvTilt = true;
  const SELECTOR = '[class*="st-key-fvlead_"], [class*="st-key-fvtile_"]';
  let active = null;
  const reset = (card) => { card.classList.remove("is-tilting"); card.style.removeProperty("--rx"); card.style.removeProperty("--ry"); };
  document.addEventListener("pointermove", (e) => {
    const card = e.target instanceof Element ? e.target.closest(SELECTOR) : null;
    if (active && active !== card) reset(active);
    active = card;
    if (!card) return;
    const box = card.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width, y = (e.clientY - box.top) / box.height;
    const strength = card.matches('[class*="st-key-fvlead_"]') ? 3 : 6;
    card.style.setProperty("--rx", `${((x - 0.5) * strength).toFixed(2)}deg`);
    card.style.setProperty("--ry", `${((0.5 - y) * strength).toFixed(2)}deg`);
    card.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
    card.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
    card.classList.add("is-tilting");
  }, { passive: true });
  document.addEventListener("pointerleave", () => { if (active) reset(active); active = null; });
}

// --- Les liens du pied de page : changer de page sans recharger le site (comme le menu du haut) ------------------
// Un lien HTML ordinaire recharge tout (intro rejouée, décor 3D reconstruit). Streamlit suit l'historique du
// navigateur : on y inscrit la nouvelle adresse et on le prévient, comme le ferait le bouton « Précédent ».
function installLinks() {
  if (window.__fvLinks) return;
  window.__fvLinks = true;
  document.addEventListener("click", (e) => {
    const a = e.target instanceof Element ? e.target.closest(".fv-footer a, a.fv-credit") : null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.classList.contains("fv-footer-top-link")) {   // « Haut de page » : la zone qui défile remonte en douceur
      e.preventDefault();
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.querySelector('[data-testid="stMain"], [data-testid="stAppScrollToBottomContainer"]')
        ?.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
      return;
    }
    if (!a.getAttribute("href")?.startsWith("./")) return;   // seulement les pages du site
    const url = new URL(a.getAttribute("href"), window.location.href);
    if (url.origin !== window.location.origin) return;
    e.preventDefault();
    window.history.pushState({}, "", url.pathname + url.search);
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
  });
}

// --- La page Assistant : la question qu'on vient de poser remonte en haut de l'écran, la réponse s'écrit dessous -----
function installChat() {
  if (window.__fvChat) return;
  window.__fvChat = true;
  let known = -1, queued = false;
  const check = () => {
    queued = false;
    const log = document.querySelector(".st-key-fvchatlog");
    if (!log) { known = -1; return; }
    // les questions : les messages à l'icône « personne » (les réponses portent le logo du site)
    const asked = log.querySelectorAll('[data-testid="stChatMessage"]:has([data-testid="stChatMessageAvatarCustom"])');
    if (known >= 0 && asked.length > known) {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      asked[asked.length - 1].scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
    }
    known = asked.length;
  };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(check); } })
    .observe(document.body, { childList: true, subtree: true });
}

// --- Les dialogues de Streamlit (« Rechercher ») : le thème de la page ------------------------------------------------
// Streamlit ne donne le thème (color-scheme) qu'à .stApp, et ses dialogues sont posés à côté : sans lui, les couleurs
// light-dark() de theme.py y restaient claires en mode sombre (un champ blanc, un texte presque invisible).
function installDialogTheme() {
  if (window.__fvDialogTheme) return;
  window.__fvDialogTheme = true;
  let queued = false;
  const sync = () => {
    queued = false;
    const app = document.querySelector(".stApp");
    if (!app) return;
    const scheme = getComputedStyle(app).colorScheme;
    for (const dialog of document.querySelectorAll('[data-testid="stDialog"]')) {
      if (dialog.style.colorScheme !== scheme) dialog.style.colorScheme = scheme;
    }
  };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(sync); } })
    .observe(document.body, { childList: true, subtree: true });
}

// --- La recherche du site : la touche « / » ou Ctrl+K (Cmd+K) ouvre le dialogue « Rechercher » (search.py) ---------
function installShortcut() {
  if (window.__fvShortcut) return;
  window.__fvShortcut = true;
  const typing = (el) => el instanceof Element && !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.altKey || e.isComposing) return;
    const slash = e.key === "/" && !e.ctrlKey && !e.metaKey && !typing(e.target);
    const palette = (e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey) && !e.shiftKey;
    if (!slash && !palette) return;
    const button = document.querySelector(".st-key-fvsearch_open button");
    if (!button || document.querySelector('[role="dialog"]')) return;   // déjà ouvert : la touche reste à la page
    e.preventDefault();
    button.click();
  });
  // Quand le dialogue s'ouvre, le curseur va dans son champ (sur téléphone, le navigateur peut refuser : tant pis)
  let queued = false;
  const focusField = () => {
    queued = false;
    const field = document.querySelector('[role="dialog"] .st-key-fvsearch_q input');
    if (field && !field.dataset.fvFocused) {
      field.dataset.fvFocused = "1";
      if (!typing(document.activeElement)) field.focus();   // Streamlit met le focus sur le dialogue lui-même
    }
  };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(focusField); } })
    .observe(document.body, { childList: true, subtree: true });
}

export function show(data) {
  installMotion();
  installTilt();
  installLinks();
  installChat();
  installShortcut();
  installDialogTheme();
  if (!webgl()) return () => {};   // pas de WebGL : les illustrations de l'étape 29 restent en place
  installVitrines();
  try {
    world ??= new World();
    window.__fv3d = world;   // pour les tests et la vidéo de démonstration (tools/ux_audit.py, guide 30)
  } catch {
    return () => {};
  }
  if (world.broken) return () => {};
  world.retain(data);
  return () => world.release();
}

