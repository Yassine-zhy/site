// FinVeille — la boîte à outils des maquettes (guides 33 et 41) : matières, lumière, sol, gravures.
//
// Les maquettes sont des objets que l'on pourrait poser sur un bureau : du carton plume et du plâtre blancs, mats,
// comme une maquette d'architecte ; les données peintes dessus (hausse en vert, baisse en rouge, le bleu de la marque) ;
// les détails imprimés à l'encre grise ; du métal brossé pour les pieds et les axes. Rien ne brille, rien n'émet de
// lumière : le volume se lit par l'ombre. La matière est la même en thème clair et en thème sombre (un objet réel ne
// change pas de matière quand on éteint la pièce) ; seuls le socle et la lumière suivent la page.
//
// Une maquette ne choisit pas ses matières : elle donne un rôle (une couleur de la palette) et mat() en fait du
// plâtre (porcelain, relief, shade, plinth) ou de la peinture (up, down, brand, ink, violet). Les arêtes sont
// soulignées par la vitrine (outline), l'ombre au sol vient de plinth() ou disc().

import * as THREE from "./three.module.min.js";
import { RoundedBoxGeometry } from "./addons/RoundedBoxGeometry.js";
import { LAND, LAND_W, LAND_H } from "./land.js";
import { isPhone } from "./phone.js";

export { THREE, RoundedBoxGeometry };

let current = null;   // la palette de la maquette en cours de construction (une à la fois)

export function palette(dark) {
  current = {
    dark,
    // le plâtre, du plus clair au plus en retrait ; un ton plus bas en thème sombre, pour ne pas éblouir la page
    porcelain: new THREE.Color(dark ? 0xd3d6da : 0xf2f3f4),
    relief: new THREE.Color(dark ? 0xbcc0c6 : 0xe1e4e7),
    shade: new THREE.Color(dark ? 0x8a9099 : 0xbfc4ca),
    plinth: new THREE.Color(dark ? 0x2a2e34 : 0xd4d8dc),   // le socle : une planche qui suit la page
    // la peinture : les données et la marque, aux couleurs du site
    ink: new THREE.Color(dark ? 0x30353c : 0x3d4550),      // l'encre des gravures, des graduations, des tracés
    up: new THREE.Color(dark ? 0x35b271 : 0x23935a), down: new THREE.Color(dark ? 0xe5606b : 0xd0434e),
    brand: new THREE.Color(dark ? 0x5a80f0 : 0x2451de),
    violet: new THREE.Color(dark ? 0x7d8794 : 0x6d7783),   // le second ton, un gris ardoise (plus de violet)
  };
  return current;
}

const BODY = ["porcelain", "relief", "shade", "plinth"], PAINT = ["ink", "up", "down", "brand", "violet"];
function role(color) {   // le rôle le plus proche dans la palette : plâtre ou peinture
  if (color?.isLight) return "up";   // une variation (changeColor) : toujours de la peinture
  const c = new THREE.Color(color);
  let best = "porcelain", gap = Infinity;
  for (const name of [...BODY, ...PAINT]) {
    const r = current[name], d = (c.r - r.r) ** 2 + (c.g - r.g) ** 2 + (c.b - r.b) ** 2;
    if (d < gap) { gap = d; best = name; }
  }
  return best;
}

// Une impression à l'encre : là où le dessin (blanc sur noir) est clair, la matière prend la couleur de l'encre. Le
// dessin passe par l'emplacement de la carte d'émission (ses coordonnées de texture sont déjà gérées), mais rien
// n'émet de lumière. `material.userData.ink.value` : la force de l'impression, de 0 à 1 (animable).
export function inked(material, map, color, strength = 1) {
  material.emissiveMap = map;
  material.emissive = new THREE.Color(0x000000);
  material.userData.ink = { value: strength };
  material.userData.inkColor = { value: new THREE.Color(color) };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uInk = material.userData.ink;
    shader.uniforms.uInkColor = material.userData.inkColor;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uInk;\nuniform vec3 uInkColor;")
      .replace("#include <emissivemap_fragment>", `
        #ifdef USE_EMISSIVEMAP
          float inkAmount = dot(texture2D(emissiveMap, vEmissiveMapUv).rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = mix(diffuseColor.rgb, uInkColor, clamp(inkAmount * uInk, 0.0, 1.0));
        #endif`);
  };
  material.customProgramCacheKey = () => "fv-ink";
  return material;
}

export function mat(color, o = {}) {
  const pal = current, name = role(color), c = new THREE.Color(color);
  if (o.map) {   // une gravure : le plâtre, et le dessin imprimé à l'encre (avec son léger relief)
    const m = inked(new THREE.MeshStandardMaterial({ color: pal.porcelain, roughness: 0.84, metalness: 0,
      bumpMap: o.bump ?? null, bumpScale: o.bumpScale ?? 1 }), o.map, pal.ink, 0.9);
    m.userData.role = "body";
    return m;
  }
  if (PAINT.includes(name) || o.glow > 0.5) {   // une donnée, un trait de la marque : de la peinture satinée
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0, transparent: o.opacity != null,
      opacity: o.opacity ?? 1 });
    m.userData.role = "paint";
    return m;
  }
  // le plâtre : mat, opaque (une transparence ne vient que si la maquette la demande)
  const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.86, metalness: 0, transparent: o.opacity != null,
    opacity: o.opacity ?? 1 });
  m.userData.role = "body";
  return m;
}

// Les arêtes : un trait de crayon très léger sur les arêtes vives du plâtre, pour que deux volumes de la même teinte
// se détachent l'un de l'autre même sans ombre portée (téléphone). La peinture n'en a pas besoin.
export function outline(root, pal) {
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.userData.noEdges && o.material?.userData?.role === "body") meshes.push(o); });
  const pencil = new THREE.LineBasicMaterial({ color: pal.ink, transparent: true, opacity: pal.dark ? 0.34 : 0.2, depthWrite: false });
  for (const mesh of meshes) {
    if (mesh.geometry.attributes.position.count > 30000) continue;
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 32), pencil);
    lines.userData.noEdges = true;
    lines.raycast = () => {};   // le pointeur vise les volumes, pas les traits
    mesh.add(lines);
  }
}

// La lumière d'un atelier : une grande fenêtre (lumière du jour, à peine chaude) qui porte les ombres, le ciel de la
// pièce, et un rappel froid à l'opposé pour déboucher les faces à l'ombre. Aucune lumière colorée. `reach` : la zone
// des ombres ; `shadow` : faux pour une maquette sans ombre portée. Sur téléphone, la carte d'ombres tient en 512 px
// (filtrée de près : l'ombre reste douce) ; vitrines.js y règle aussi le type d'ombre, le plus simple.
export function lights(scene, pal, { reach = 7, map = 1024, sun = [-6, 11, 7], shadow = true } = {}) {
  const phone = isPhone();
  if (phone) map = Math.min(map, 512);
  const sky = new THREE.HemisphereLight(0xffffff, pal.dark ? 0x3a3f46 : 0xc9ced4, pal.dark ? 0.45 : 0.6);
  const key = new THREE.DirectionalLight(0xfff6ea, pal.dark ? 2.3 : 2.1);
  key.position.set(...sun);
  key.castShadow = shadow;
  key.shadow.mapSize.set(map, map);
  Object.assign(key.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 0.5, far: 60 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = phone ? 2 : 6;   // une ombre douce (filtrage PCF élargi) ; plus serrée sur téléphone
  const fill = new THREE.DirectionalLight(0xe4ecff, pal.dark ? 0.45 : 0.55);
  fill.position.set(8, 5, -8);
  scene.add(sky, key, fill);
}

// Le sol : rien que l'ombre de l'objet, posée sur la page. `size` : l'empreinte de l'objet.
function floor(pal, size) {
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.8, size * 1.8).rotateX(-Math.PI / 2),
    new THREE.ShadowMaterial({ opacity: pal.dark ? 0.45 : 0.2 }));
  catcher.receiveShadow = true;
  catcher.userData.noEdges = true;
  catcher.raycast = () => {};
  return catcher;
}
export const plinth = (pal, w, d) => floor(pal, Math.max(w, d) * 0.8);
export const disc = (pal, r) => floor(pal, r * 1.9);

// Une gravure : un dessin blanc sur noir, que mat() imprime à l'encre sur le plâtre, et son relief.
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

// La couleur d'une variation : du vert ou du rouge, d'autant plus soutenu que le mouvement est fort (un petit
// mouvement : une teinte pâle, qui tire sur le plâtre).
export function changeColor(pal, change, full = 2.5) {
  if (change == null || Number.isNaN(change)) return pal.relief.clone();
  const k = 0.5 + 0.5 * Math.min(1, Math.abs(change) / full);
  const c = pal.porcelain.clone().lerp(change >= 0 ? pal.up : pal.down, k);
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

// Une façade : une grille régulière de fenêtres, imprimée à l'encre sur les tours (inked). Quelques stores baissés
// et des étages techniques sans fenêtres cassent la répétition. La texture se répète ; facadeBox la cale pour qu'une
// fenêtre garde la même taille sur toutes les tours.
let facade = null;
export function facadeTexture() {
  if (facade) return facade;
  const cols = 32, rows = 64, cw = 16, ch = 16, c = document.createElement("canvas");
  c.width = cols * cw; c.height = rows * ch;
  const x = c.getContext("2d"), rnd = random(40);
  x.fillStyle = "#000";
  x.fillRect(0, 0, c.width, c.height);
  for (let j = 0; j < rows; j++) {
    const technical = rnd() < 0.06;   // un étage technique : un bandeau plein, sans fenêtres
    for (let i = 0; i < cols; i++) {
      if (technical) continue;
      const v = rnd() < 0.12 ? 0.3 + rnd() * 0.15 : 0.7 + rnd() * 0.3;   // un store baissé de temps en temps
      x.fillStyle = `rgba(255,255,255,${v})`;
      x.fillRect(i * cw + 3, j * ch + 4, cw - 6, ch - 7);   // la fenêtre, et autour le meneau
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

// Un fil tendu le long d'une courbe (orbites, liaisons) : un tube très fin, peint.
export function lightTube(curve, color, radius = 0.01, segments = 96) {
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 6, false),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.5, transparent: true, opacity: 1 }));
  m.userData.noEdges = true;
  m.raycast = () => {};
  return m;
}

// Le métal brossé des pièces de monnaie et des pièces de précision (pieds, anneaux, axes) : un acier clair, qui ne
// reflète que la pièce autour de lui. `emissiveMap` : une gravure, noircie dans le creux du trait (inked).
export function metal(pal, o = {}) {
  const color = new THREE.Color(o.color ?? (pal.dark ? 0xa9afb7 : 0xc2c7cd));
  const m = new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: o.rough ?? 0.38,
    bumpMap: o.bump ?? null, bumpScale: o.bumpScale ?? 1 });
  if (o.emissiveMap) inked(m, o.emissiveMap, color.clone().multiplyScalar(0.22), o.glow ?? 0.85);
  m.userData.role = "metal";
  return m;
}
