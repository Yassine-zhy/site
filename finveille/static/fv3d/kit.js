// FinVeille — la boîte à outils des maquettes (guide 33) : matières, lumière, sol, gravures.
//
// Les maquettes sont faites de la matière du site : du verre sombre (les cartes), des arêtes de lumière bleue (la
// grille et la ligne de cours des en-têtes), des données en lumière (hausse en vert, baisse en rouge) et une
// poussière de particules (le décor). Rien de blanc ni d'opaque : l'objet semble sortir de l'interface.
//
// Une maquette ne choisit pas ses matières : elle donne un rôle (une couleur de la palette) et mat() en fait du
// verre (porcelain, relief, shade, plinth) ou de la lumière (up, down, brand, ink). Les arêtes sont ajoutées par la
// vitrine (outline), le sol par plinth() ou disc().

import * as THREE from "./three.module.min.js";
import { RoundedBoxGeometry } from "./addons/RoundedBoxGeometry.js";
import { LAND, LAND_W, LAND_H } from "./land.js";

export { THREE, RoundedBoxGeometry };

let current = null;   // la palette de la maquette en cours de construction (une à la fois)

export function palette(dark) {
  current = {
    dark,
    // le verre : la matière des volumes, du plus présent au plus effacé ; sombre dans les deux thèmes (sur une page
    // claire, l'objet se détache comme un objet de verre fumé photographié sur fond blanc)
    porcelain: new THREE.Color(0x22346a),
    relief: new THREE.Color(0x26386e),
    shade: new THREE.Color(0x101830),
    plinth: new THREE.Color(0x0c1326),
    // la lumière : les données et la marque
    ink: new THREE.Color(0x9db0ff),
    up: new THREE.Color(0x2fbf71), down: new THREE.Color(0xef5361), brand: new THREE.Color(0x5b7cff),
    violet: new THREE.Color(0x8b6cff),
  };
  return current;
}

const GLASS = ["porcelain", "relief", "shade", "plinth"], LIGHT = ["ink", "up", "down", "brand", "violet"];
function role(color) {   // le rôle le plus proche dans la palette : verre ou lumière
  if (color?.isLight) return "up";   // une variation (changeColor) : toujours de la lumière
  const c = new THREE.Color(color);
  let best = "porcelain", gap = Infinity;
  for (const name of [...GLASS, ...LIGHT]) {
    const r = current[name], d = (c.r - r.r) ** 2 + (c.g - r.g) ** 2 + (c.b - r.b) ** 2;
    if (d < gap) { gap = d; best = name; }
  }
  return best;
}

// Le contre-jour du verre : plus la surface fuit le regard, plus elle s'éclaire de bleu (effet de Fresnel).
function fresnel(material, color, strength) {
  material.userData.rim = { value: new THREE.Color(color).multiplyScalar(strength) };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = material.userData.rim;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uRim;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += uRim * pow(1.0 - facing, 2.4);`);
  };
  material.customProgramCacheKey = () => "fv-glass";
  return material;
}

export function mat(color, o = {}) {
  const pal = current, name = role(color), c = new THREE.Color(color);
  if (o.map) {   // une gravure : le verre, et le dessin en lumière
    const m = fresnel(new THREE.MeshStandardMaterial({ color: pal.porcelain, roughness: 0.25, metalness: 0.2,
      emissive: pal.ink, emissiveMap: o.map, emissiveIntensity: 1.5, bumpMap: o.bump ?? null,
      bumpScale: o.bumpScale ?? 1 }), pal.brand, 0.9);
    m.userData.role = "glass";
    return m;
  }
  if (LIGHT.includes(name) || o.glow > 0.5) {   // une donnée, un trait de la marque : de la lumière
    // la couleur éclaire sans aplatir : une part de lumière propre, le reste vient de l'éclairage (le volume se lit)
    const m = fresnel(new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.7), roughness: 0.28, metalness: 0.15,
      emissive: c, emissiveIntensity: pal.dark ? 0.5 : 0.4, transparent: o.opacity != null, opacity: o.opacity ?? 1 }),
    c, 0.9);
    m.userData.role = "light";
    m.userData.tone = c;
    return m;
  }
  // le verre : sombre et poli en thème sombre, givré en thème clair ; plus effacé pour « shade »
  const m = fresnel(new THREE.MeshStandardMaterial({ color: c, roughness: 0.14, metalness: 0.5,
    transparent: true, opacity: o.opacity ?? (name === "shade" ? 0.6 : pal.dark ? 0.86 : 0.94) }),
  pal.brand, name === "shade" ? 0.35 : 1.35);
  m.userData.role = "glass";
  return m;
}

// Les arêtes de lumière : un trait fin sur chaque arête vive, de la couleur du rôle (bleu pour le verre).
export function outline(root, pal) {
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.userData.noEdges && o.material?.userData?.role) meshes.push(o); });
  for (const mesh of meshes) {
    if (mesh.geometry.attributes.position.count > 30000) continue;
    const light = mesh.material.userData.role === "light";
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 32), new THREE.LineBasicMaterial({
      color: light ? mesh.material.userData.tone : 0x8ea4ff, transparent: true,
      opacity: light ? 0.9 : 0.62, depthWrite: false,
    }));
    lines.userData.noEdges = true;
    lines.raycast = () => {};   // le pointeur vise les volumes, pas les traits
    mesh.add(lines);
  }
}

// La lumière d'atelier : peu de lumière directe, de l'environnement (reflets dans le verre), deux contre-jours aux
// couleurs de la marque (bleu à droite, violet à gauche) qui dessinent les silhouettes. `reach` : la zone des ombres.
export function lights(scene, pal, { reach = 7, map = 1024, sun = [-6, 11, 7] } = {}) {
  const sky = new THREE.HemisphereLight(0xc8d4ff, pal.dark ? 0x060912 : 0xdfe5f2, pal.dark ? 0.35 : 1.0);
  const key = new THREE.DirectionalLight(0xffffff, pal.dark ? 1.3 : 1.7);
  key.position.set(...sun);
  key.castShadow = true;
  key.shadow.mapSize.set(map, map);
  Object.assign(key.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 0.5, far: 60 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = 6;   // une ombre douce (filtrage PCF élargi)
  const rim = new THREE.DirectionalLight(pal.brand, pal.dark ? 2.6 : 1.1);
  rim.position.set(8, 4, -9);
  const rim2 = new THREE.DirectionalLight(pal.violet, pal.dark ? 1.6 : 0.6);
  rim2.position.set(-9, 3, -6);
  scene.add(sky, key, rim, rim2);
}

// Le sol : pas de socle, la grille de points des en-têtes qui se prolonge sous l'objet, un halo bleu, l'ombre seule
// (visible en thème clair) et une poussière de particules autour. `size` : l'empreinte de l'objet.
function floor(pal, size) {
  const g = new THREE.Group();
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.8, size * 1.8).rotateX(-Math.PI / 2),
    new THREE.ShadowMaterial({ opacity: pal.dark ? 0.5 : 0.09 }));
  catcher.receiveShadow = true;
  catcher.userData.noEdges = true;
  catcher.raycast = () => {};
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.7, size * 1.7).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: pal.brand, transparent: true, depthWrite: false,
      opacity: pal.dark ? 0.2 : 0.14, blending: pal.dark ? THREE.AdditiveBlending : THREE.NormalBlending }));
  halo.position.y = -0.01;
  halo.raycast = () => {};
  // la grille : un point tous les 0,33, de plus en plus pâle en s'éloignant du centre
  const step = 0.33, half = size * 0.85, pos = [], col = [];
  const base = pal.dark ? new THREE.Color(0x8ea4ff) : new THREE.Color(0x5b7cff);
  for (let x = -half; x <= half; x += step) for (let z = -half; z <= half; z += step) {
    const k = Math.max(0, 1 - Math.hypot(x, z) / half);
    if (k <= 0) continue;
    pos.push(x, 0.002, z);
    const c = base.clone().multiplyScalar(k * k * (pal.dark ? 0.9 : 1));
    col.push(c.r, c.g, c.b);
  }
  // la poussière : quelques particules en suspension au-dessus du sol
  const rnd = random(size * 100 | 0);
  for (let i = 0; i < 160; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * half * 0.9;
    pos.push(Math.cos(a) * r, 0.2 + rnd() * size * 0.55, Math.sin(a) * r);
    const c = (rnd() < 0.7 ? pal.brand : pal.violet).clone().multiplyScalar(0.35 + rnd() * 0.5);
    col.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const dots = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true,
    depthWrite: false, blending: pal.dark ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: pal.dark ? 1 : 0.7 }));
  dots.raycast = () => {};
  g.add(halo, catcher, dots);
  return g;
}
let glow = null;
function glowTexture() {   // un dégradé radial, partagé
  if (glow) return glow;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d"), grad = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = grad;
  x.fillRect(0, 0, 128, 128);
  glow = new THREE.CanvasTexture(c);
  return glow;
}
export const plinth = (pal, w, d) => floor(pal, Math.max(w, d) * 0.8);
export const disc = (pal, r) => floor(pal, r * 1.9);

// Une gravure : un dessin blanc sur noir, qui devient de la lumière sur le verre (mat), et son relief.
export function engraving(text, pal, { size = 256, scale = 0.62, weight = 800 } = {}) {
  const make = (relief) => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const x = c.getContext("2d");
    x.fillStyle = "#000";
    x.fillRect(0, 0, size, size);
    if (relief) x.filter = `blur(${size / 128}px)`;
    x.fillStyle = "#fff";
    x.font = `${weight} ${Math.round(size * scale)}px "Schibsted Grotesk", "IBM Plex Sans", sans-serif`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(text, size / 2, size / 2 + size * 0.04);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  };
  return { map: make(false), bump: make(true) };
}

// La couleur d'une variation : du vert ou du rouge, d'autant plus vif que le mouvement est fort.
export function changeColor(pal, change, full = 2.5) {
  if (change == null || Number.isNaN(change)) return pal.relief.clone();
  const k = 0.45 + 0.55 * Math.min(1, Math.abs(change) / full);
  const c = (change >= 0 ? pal.up : pal.down).clone().multiplyScalar(k);
  c.isLight = true;
  return c;
}

export const signed = (v, unit = "%") => v == null ? "" :
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2).replace(".", ",")} ${unit}`;

// Le temps du montage : 0 avant `start`, 1 après `start + span`, une courbe douce entre les deux.
export function phase(t, start, span = 0.7) {
  const k = Math.min(1, Math.max(0, (t - start) / span));
  return 1 - Math.pow(1 - k, 3);
}
export function overshoot(t, start, span = 0.8) {   // un petit rebond à l'arrivée
  const k = Math.min(1, Math.max(0, (t - start) / span));
  const c = 1.6;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
}

// Les terres émergées (land.js, 1 bit par degré) et la position d'un point sur une sphère.
const LAND_BITS = Uint8Array.from(atob(LAND), (ch) => ch.charCodeAt(0));
export function isLand(lat, lon) {
  const x = Math.floor(((lon + 180) % 360 + 360) % 360), y = Math.min(LAND_H - 1, Math.floor(90 - lat));
  const i = y * LAND_W + x;
  return (LAND_BITS[i >> 3] >> (i & 7)) & 1;
}
export function onSphere(lat, lon, r) {
  const a = lat * Math.PI / 180, o = lon * Math.PI / 180;
  return new THREE.Vector3(r * Math.cos(a) * Math.sin(o), r * Math.sin(a), r * Math.cos(a) * Math.cos(o));
}

// Un générateur pseudo-aléatoire à graine : le même objet à chaque visite.
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rend un objet pointable : chaque maille porte l'identifiant de ce qu'elle représente.
export function tag(object, id) {
  object.traverse((o) => { if (o.isMesh) o.userData.id = id; });
  return object;
}
// `keyOf` : le nom que la page cherchera si l'on clique (une entreprise, une place, une question…)
export function pickFrom(ray, objects, describe, keyOf = null) {
  const hit = ray.intersectObjects(objects, true).find((h) => h.object.userData.id != null);
  if (!hit) return null;
  const id = hit.object.userData.id;
  return { id, text: describe(id), key: keyOf ? keyOf(id) : null };
}

// --- Les outils du détail -----------------------------------------------------------------------------------------

// Une façade de nuit : une grille de fenêtres, certaines allumées (chaud ou froid), d'autres éteintes. La texture se
// répète ; facadeBox la cale pour qu'une fenêtre garde la même taille sur toutes les tours.
let facade = null;
export function facadeTexture() {
  if (facade) return facade;
  const cols = 32, rows = 64, cw = 16, ch = 16, c = document.createElement("canvas");
  c.width = cols * cw; c.height = rows * ch;
  const x = c.getContext("2d"), rnd = random(40);
  x.fillStyle = "#000";
  x.fillRect(0, 0, c.width, c.height);
  for (let j = 0; j < rows; j++) {
    const floorLit = rnd() < 0.85;   // des étages entiers éteints, comme la nuit
    for (let i = 0; i < cols; i++) {
      const on = floorLit && rnd() < 0.42;
      const warm = rnd() < 0.7;
      const v = on ? 0.55 + rnd() * 0.45 : 0.04 + rnd() * 0.05;
      const [r, g, b] = on ? (warm ? [255, 214, 160] : [180, 205, 255]) : [120, 140, 200];
      x.fillStyle = `rgba(${r},${g},${b},${v})`;
      x.fillRect(i * cw + 3, j * ch + 4, cw - 6, ch - 7);   // la fenêtre, et autour le meneau sombre
    }
  }
  facade = new THREE.CanvasTexture(c);
  facade.wrapS = facade.wrapT = THREE.RepeatWrapping;
  facade.colorSpace = THREE.SRGBColorSpace;
  facade.anisotropy = 8;
  return facade;
}
// Une boîte dont les coordonnées de texture suivent ses dimensions (une fenêtre = `cell` de côté), posée sur y = 0.
export function facadeBox(w, h, d, cell = 0.16, offset = 0) {
  const g = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const across = ny > 0.5 ? w : nx > 0.5 ? d : w, up = ny > 0.5 ? d : h;
    uv.setXY(i, uv.getX(i) * across / cell / 32 + offset, uv.getY(i) * up / cell / 64 + offset * 0.37);
  }
  return g;
}

// Une fiche d'article, comme les cartes du site : une image, un titre, des lignes de texte, la source en bleu.
export function cardTexture(seed = 1) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 176;
  const x = c.getContext("2d"), rnd = random(seed);
  x.fillStyle = "#000";
  x.fillRect(0, 0, 256, 176);
  x.fillStyle = "rgba(91,124,255,.55)";
  x.fillRect(14, 14, 84, 56);   // la vignette
  x.fillStyle = "rgba(255,255,255,.9)";
  x.fillRect(110, 18, 120 - rnd() * 30, 10);   // le titre, sur deux lignes
  x.fillRect(110, 36, 90 - rnd() * 30, 10);
  x.fillStyle = "rgba(160,180,230,.45)";
  for (let l = 0; l < 4; l++) x.fillRect(14, 88 + l * 16, 228 - rnd() * 70, 6);
  x.fillStyle = "rgba(91,124,255,.95)";
  x.fillRect(14, 154, 46, 7);   // la source
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// L'atmosphère : un halo qui s'éclaire sur le bord d'une sphère (vu de face, il disparaît).
export function atmosphere(radius, color, strength = 1) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz;
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying vec3 vN; varying vec3 vV;
      void main() { float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0);
        gl_FragColor = vec4(uColor * f * uStrength, f); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  }));
}

// Un trait de lumière le long d'une courbe (arcs du globe, orbites) : un tube très fin, qui brille.
export function lightTube(curve, color, radius = 0.01, segments = 96) {
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 6, false),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.9, depthWrite: false }));
  m.userData.noEdges = true;
  m.raycast = () => {};
  return m;
}

// Le métal sombre et vernis des pièces et des pièces de précision (pieds, anneaux, axes).
export function metal(pal, o = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color: o.color ?? 0x2a3a6e, metalness: 0.9,
    roughness: o.rough ?? 0.28, clearcoat: 1, clearcoatRoughness: 0.12, emissive: o.emissive ?? 0x000000,
    emissiveMap: o.emissiveMap ?? null, emissiveIntensity: o.glow ?? 1, bumpMap: o.bump ?? null, bumpScale: o.bumpScale ?? 1 });
  m.userData.role = "glass";
  return m;
}
