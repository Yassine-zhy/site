// FinVeille — les maquettes des autres pages (guide 33). Même contrat que models.js (voir son en-tête).
//
// Même niveau de détail que les quatre maquettes principales : beaucoup de petites pièces, des chanfreins, des règles
// graduées, des façades allumées, des gravures de lumière. Une hauteur, un éclat ou une couleur dit toujours la donnée ;
// le reste (cadres, vis, socles) n'est là que pour le métier de l'objet.

import {
  THREE, RoundedBoxGeometry, mat, lights, plinth, disc, engraving, changeColor, phase, overshoot, random, tag,
  pickFrom, facadeTexture, facadeBox, cardTexture, atmosphere, lightTube,
} from "./kit.js";

// --- Les outils communs de l'atelier -----------------------------------------------------------------------------
const NN = " ";   // l'espace fine insécable : avant % et €, et entre les milliers
const fr = (v, d = 0) => {   // un nombre à la française : 16 289 ou 1,20
  const [int, dec] = Math.abs(v).toFixed(d).split(".");
  return `${v < 0 ? "−" : ""}${int.replace(/\B(?=(\d{3})+(?!\d))/g, NN)}${dec ? `,${dec}` : ""}`;
};
const pct = (v, d = 2) => `${v > 0 ? "+" : ""}${fr(v, d)}${NN}%`;
const FONT = "\"Schibsted Grotesk\", \"IBM Plex Sans\", sans-serif";
const SERIF = "\"Playfair Display\", \"Times New Roman\", Georgia, serif";
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
// Le métal sombre et poli des pièces de précision. Le vernis de metal() (clearcoat) coûte cher à compiler sur un processeur
// graphique logiciel : ici un MeshStandard poli, du même ton, suffit.
function alloy(pal, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color: o.color ?? (pal.dark ? 0x2a3a6e : 0xc9d3ee), metalness: 0.9, roughness: o.rough ?? 0.3 });
  m.userData.role = "glass";
  return m;
}
const solid = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
const part = (geo, material) => solid(new THREE.Mesh(geo, material));
const quiet = (m) => { m.userData.noEdges = true; return m; };   // pas d'arêtes : pièce fine, courbe ou lumineuse
const fine = (geo, material) => quiet(part(geo, material));   // une petite pièce solide, sans arêtes
const box = (w, h, d, r = 0.04) =>
  new RoundedBoxGeometry(w, h, d, 2, Math.max(1e-4, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)));
const glow = (pal, k = 0.12) => (pal.dark ? k : 0);
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
// De la lumière pure (rien ne l'éclaire) : un trait, une bille, une bague. Le halo fait le reste.
const lamp = (color, k = 1.7, o = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), ...o });
const lit = (geo, color, k, o) => { const m = new THREE.Mesh(geo, lamp(color, k, o)); m.userData.noEdges = true; return m; };
// Le survol : chaque pièce `it` (groupe `g`, hauteur `lift`) se soulève doucement ; vrai tant qu'elle bouge.
function hoverStep(items, hover, dt, lift = 0.12) {
  let moving = false;
  const k = 1 - Math.exp(-dt * 12);
  for (const it of items) {
    const target = it === hover ? lift : 0;
    if (Math.abs(it.lift - target) > 0.002) { it.lift += (target - it.lift) * k; moving = true; } else it.lift = target;
    it.g.position.y = it.lift;
  }
  return moving;
}
function roundedRect(w, h, r) {   // un rectangle aux angles arrondis, centré sur l'origine
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function frameGeo(w, d, r, border, height, upright = false) {   // un cadre : un rectangle arrondi évidé, à plat sur y = 0
  const s = roundedRect(w, d, r);
  s.holes.push(new THREE.Path(roundedRect(w - 2 * border, d - 2 * border, Math.max(0.01, r - border)).getPoints(6)));
  const geo = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false, curveSegments: 6 });
  return upright ? geo : geo.rotateX(-Math.PI / 2);
}
function rod(a, b, r, material, seg = 12) {   // une tige de métal entre deux points
  const A = V3(...a), B = V3(...b);
  const m = part(new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg), material);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), B.sub(A).normalize());
  return quiet(m);
}
function screw(material, r = 0.05) {   // une vis à tête fendue, tête vers +y
  const g = new THREE.Group();
  g.add(fine(new THREE.CylinderGeometry(r, r * 1.05, r * 0.7, 14).translate(0, r * 0.35, 0), material));
  const slot = new THREE.Mesh(new THREE.BoxGeometry(r * 1.7, r * 0.16, r * 0.26).translate(0, r * 0.68, 0),
    new THREE.MeshBasicMaterial({ color: 0x03060f }));
  slot.userData.noEdges = true;
  g.add(slot);
  return g;
}

// Les textures dessinées : de la lumière sur fond noir (gravure) ou de l'encre sur fond clair (thème clair).
function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const inkOf = (pal) => (pal.dark ? "rgba(176,196,255,.96)" : "rgba(46,70,200,.95)");
// Un dessin posé à plat, en lumière (jamais une surface pleine) : fond transparent, clair en thème sombre.
function decal(pal, w, h, draw, px = 200) {
  const tex = canvasTexture(Math.min(4096, Math.round(w * px)), Math.min(2048, Math.round(h * px)), (x, cw, ch) => {
    x.clearRect(0, 0, cw, ch);
    draw(x, cw, ch, inkOf(pal));
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true,
    depthWrite: false, blending: pal.dark ? THREE.AdditiveBlending : THREE.NormalBlending }));
  m.userData.noEdges = true;
  m.raycast = () => {};
  return m;
}
// Une page imprimée : en thème sombre l'encre est de la lumière sur du verre noir, en thème clair du papier.
function printed(pal, w, h, draw, o = {}) {
  const tex = canvasTexture(w, h, (x) => {
    x.fillStyle = pal.dark ? "#000" : "#f4f6fd";
    x.fillRect(0, 0, w, h);
    draw(x, pal.dark);
  });
  const m = pal.dark
    ? new THREE.MeshStandardMaterial({ color: o.base ?? 0x0f1a3a, metalness: 0.3, roughness: 0.35, emissive: 0xffffff,
      emissiveMap: tex, emissiveIntensity: o.k ?? 1.0 })
    : new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.7, metalness: 0 });
  m.userData.role = "glass";
  return m;
}

// Une règle graduée posée de biais : un corps de métal, des repères en relief et la gravure des valeurs.
// `items` : [{ x (depuis le centre), text, major }].
function ruler(pal, length, items, { depth = 0.34, tilt = 0.55, size = 0.15 } = {}) {
  const outer = new THREE.Group(), g = new THREE.Group(), body = alloy(pal, { rough: 0.55 });
  outer.add(g);
  g.rotation.x = tilt;
  g.add(part(box(length, 0.07, depth, 0.02), body));
  const label = decal(pal, length, depth, (x, cw, ch, ink) => {
    x.fillStyle = ink;
    x.textAlign = "center";
    x.textBaseline = "middle";
    for (const it of items) {
      const px = (it.x + length / 2) / length * cw;
      if (it.text) {
        x.font = `${it.major ? 800 : 600} ${size / depth * ch * (it.major ? 0.92 : 0.8)}px ${FONT}`;
        x.fillText(it.text, px, ch * 0.64);
      }
    }
  }, 220);
  label.rotation.x = -Math.PI / 2;
  label.position.y = 0.037;
  g.add(label);
  const tick = (major) => new THREE.BoxGeometry(major ? 0.02 : 0.012, 0.02, major ? 0.1 : 0.06);
  const geos = [tick(false), tick(true)];
  for (const it of items) {   // les repères : en relief sur le bord arrière
    const t = lit(geos[it.major ? 1 : 0], pal.ink, pal.dark ? 1.1 : 0.7);
    t.position.set(it.x, 0.045, -depth / 2 + 0.07);
    g.add(t);
  }
  return outer;
}

// Une tour de nuit, détaillée : un podium, un fût aux fenêtres allumées et ses quatre arêtes, un retrait pour les grandes,
// un toit (la couleur de la donnée), des équipements, et une antenne à balise pour les plus hautes. Posée sur y = y0.
function tower(pal, kit, w, h, roofMat, rnd, o = {}) {
  const body = new THREE.Group(), y0 = o.y0 ?? 0;
  const add = (geo, m, x, y, z, still = false) => {
    const mesh = part(geo, m);
    mesh.position.set(x, y + y0, z);
    if (still) mesh.userData.noEdges = true;
    body.add(mesh);
    return mesh;
  };
  add(box(w + 0.16, 0.22, w + 0.16, 0.03).translate(0, 0.11, 0), kit.relief, 0, 0, 0);
  const setback = h > 2.5, lower = setback ? h * 0.72 : h, shaftH = lower - 0.22;
  add(facadeBox(w, shaftH, w, 0.15, rnd()), kit.skin, 0, 0.22, 0);
  const fin = new THREE.BoxGeometry(0.05, shaftH, 0.05).translate(0, shaftH / 2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(fin, kit.steel, sx * w / 2, 0.22, sz * w / 2, true);
  let top = lower, roofW = w;
  if (setback) {   // la corniche, puis le retrait
    add(box(w + 0.07, 0.07, w + 0.07, 0.02).translate(0, 0.035, 0), kit.relief, 0, lower, 0);
    const uh = h - lower - 0.07, uw = w * 0.7;
    add(facadeBox(uw, uh, uw, 0.15, rnd()), kit.skin, 0, lower + 0.07, 0);
    const f2 = new THREE.BoxGeometry(0.04, uh, 0.04).translate(0, uh / 2, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(f2, kit.steel, sx * uw / 2, lower + 0.07, sz * uw / 2, true);
    top = h; roofW = uw;
  }
  add(box(roofW + 0.05, 0.08, roofW + 0.05, 0.02).translate(0, 0.04, 0), roofMat, 0, top, 0);   // le toit : la donnée
  if (o.edge) {   // un filet de lumière borde le toit
    const rim = lit(frameGeo(roofW + 0.05, roofW + 0.05, 0.02, 0.035, 0.014), o.edge, 1.8);
    rim.position.set(0, top + y0 + 0.08, 0);
    body.add(rim);
  }
  const n = 2 + Math.floor(rnd() * 2);
  for (let u = 0; u < n; u++) {   // les équipements : groupes de ventilation et réservoir
    const uw = 0.14 + rnd() * 0.12, ud = 0.1 + rnd() * 0.08, uh = 0.06 + rnd() * 0.07;
    add(box(uw, uh, ud, 0.015).translate(0, uh / 2, 0), kit.shade, (rnd() - 0.5) * roofW * 0.55, top + 0.08,
      (rnd() - 0.5) * roofW * 0.55, true);
  }
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.11, 12).translate(0, 0.055, 0), kit.steel, roofW * 0.22, top + 0.08, roofW * 0.2, true);
  if (o.mast) {   // l'antenne et sa balise
    const mh = o.mast;
    add(new THREE.CylinderGeometry(0.008, 0.028, mh, 8).translate(0, mh / 2, 0), kit.steel, -roofW * 0.15, top + 0.08, -roofW * 0.12, true);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), kit.beacon);
    b.position.set(-roofW * 0.15, top + 0.08 + mh, -roofW * 0.12);
    b.userData.noEdges = true;
    body.add(b);
  }
  return { body, top: top + 0.08 + y0 };
}
function skin(pal) {   // la façade : du verre sombre et réfléchissant, ses fenêtres allumées par la maquette
  const m = new THREE.MeshStandardMaterial({ color: pal.dark ? 0x101c40 : 0xd5def3, metalness: 0.65, roughness: 0.2,
    emissive: 0xffffff, emissiveMap: facadeTexture(), emissiveIntensity: 0, transparent: true });
  m.userData.role = "glass";
  m.userData.lit = pal.dark ? 1.3 : 0.45;
  return m;
}
const towerKit = (pal) => ({ relief: mat(pal.relief), shade: mat(pal.shade), steel: alloy(pal, { rough: 0.35 }), skin: skin(pal),
  beacon: lamp(pal.down, 2.2) });

// --- Le brief : un journal du matin sur son plateau de verre, et le jour qui se lève derrière ------------------------
function newspaper(x, W, H, dark, front, seed) {   // une page de journal : en-tête, titres, colonnes, photo
  const rnd = random(seed), M = 54, gap = 26, cw = (W - 2 * M - 2 * gap) / 3;
  const fg = dark ? "rgba(236,242,255,.96)" : "rgba(18,28,70,.92)", mid = dark ? "rgba(150,172,230,.55)" : "rgba(40,58,140,.5)";
  const acc = dark ? "rgba(110,140,255,1)" : "rgba(60,90,230,1)";
  const date = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const rule = (y, t = 2, a = M, b = W - M) => { x.fillStyle = fg; x.fillRect(a, y, b - a, t); };
  const fit = (text, max, size, font) => {   // la plus grande taille qui tient dans la largeur
    x.font = `${font} ${size}px ${SERIF}`;
    while (x.measureText(text).width > max && size > 10) { size -= 2; x.font = `${font} ${size}px ${SERIF}`; }
    return size;
  };
  const text = (x0, y0, wd, count, step = 17) => {   // des paragraphes suggérés : des barres fines de longueurs variées
    x.fillStyle = mid;
    let y = y0, left = 0;
    for (let i = 0; i < count; i++) {
      if (left === 0) left = 4 + Math.floor(rnd() * 5);
      left--;
      x.fillRect(x0, y, left === 0 ? wd * (0.25 + rnd() * 0.55) : wd, 6);
      y += left === 0 ? step * 1.9 : step;
    }
  };
  x.textBaseline = "alphabetic";
  x.fillStyle = mid;
  x.font = `600 17px ${FONT}`;
  x.textAlign = "left";
  x.fillText(front ? `N° 412 — ${date.toUpperCase()}` : "ÉCONOMIE — MARCHÉS — ENTREPRISES", M, 62);
  x.textAlign = "right";
  x.fillText(front ? "1,20 €" : "— 4 —", W - M, 62);
  rule(76, 3);
  let y = 330;
  if (front) {
    x.fillStyle = fg;
    x.textAlign = "center";
    x.font = `900 ${fit("LE BRIEF", W - 2 * M - 160, 190, 900)}px ${SERIF}`;
    x.fillText("LE BRIEF", W / 2, 232);
    rule(254, 4);
    rule(264, 1);
    x.fillStyle = mid;
    x.font = `700 15px ${FONT}`;
    x.textAlign = "left";
    x.fillText("ÉDITION DU MATIN", M, 292);
    x.textAlign = "center";
    x.fillText("MARCHÉS, ÉCONOMIE, ENTREPRISES", W / 2, 292);
    x.textAlign = "right";
    x.fillText("BOURSE, TAUX, CRYPTOS", W - M, 292);
    rule(304, 1);
    y = 372;
  }
  x.fillStyle = fg;
  x.textAlign = "left";
  const head = front ? ["Les marchés européens", "ouvrent en nette hausse"] : ["Les taux se détendent", "sur toute la courbe"];
  const size = Math.min(...head.map((s) => fit(s, 2 * cw + gap, 60, 800)));
  x.font = `800 ${size}px ${SERIF}`;
  head.forEach((s, i) => x.fillText(s, M, y + i * (size + 8)));
  y += head.length * (size + 8) - 6;
  text(M, y + 8, 2 * cw + gap, 3, 15);   // le chapeau
  const py = y + 82, ph = front ? 240 : 190, pw = 2 * cw + gap;   // la photo
  const grad = x.createLinearGradient(M, py, M + pw, py + ph);
  grad.addColorStop(0, dark ? "rgba(91,124,255,.6)" : "rgba(90,120,255,.5)");
  grad.addColorStop(1, dark ? "rgba(70,40,150,.35)" : "rgba(160,176,240,.55)");
  x.fillStyle = grad;
  x.fillRect(M, py, pw, ph);
  x.fillStyle = dark ? "rgba(255,222,170,.9)" : "rgba(255,200,120,.9)";
  x.beginPath(); x.arc(M + pw * 0.72, py + ph * 0.34, 26, 0, Math.PI * 2); x.fill();
  for (let i = 0; i < 24; i++) {   // une ligne d'horizon d'immeubles
    const bw = pw / 24, bh = 30 + rnd() * (ph * 0.55);
    x.fillStyle = dark ? "rgba(8,14,40,.7)" : "rgba(30,44,120,.4)";
    x.fillRect(M + i * bw + 2, py + ph - bh, bw - 4, bh);
    x.fillStyle = dark ? "rgba(255,214,160,.75)" : "rgba(255,255,255,.7)";
    for (let k = 0; k < bh / 22; k++) if (rnd() < 0.45) x.fillRect(M + i * bw + 7 + rnd() * (bw - 20), py + ph - bh + 8 + k * 20, 4, 5);
  }
  x.strokeStyle = fg;
  x.lineWidth = 2;
  x.strokeRect(M, py, pw, ph);
  x.fillStyle = mid;
  x.fillRect(M, py + ph + 12, pw * 0.55, 6);   // la légende
  // la colonne de droite : l'essentiel, en liste
  const sx = M + 2 * (cw + gap), sy = y - (size + 8) * head.length + 8;
  x.fillStyle = acc;
  x.fillRect(sx, sy, cw, 8);
  x.font = `800 22px ${FONT}`;
  x.fillText(front ? "L'ESSENTIEL" : "EN CHIFFRES", sx, sy + 40);
  for (let i = 0; i < 4; i++) {
    const yy = sy + 78 + i * 112;
    x.fillStyle = acc;
    x.fillRect(sx, yy, 10, 10);
    x.fillStyle = fg;
    x.fillRect(sx + 24, yy, cw * (0.78 - rnd() * 0.2), 9);
    x.fillStyle = mid;
    x.fillRect(sx + 24, yy + 22, cw * (0.7 - rnd() * 0.2), 6);
    x.fillRect(sx + 24, yy + 40, cw * (0.55 - rnd() * 0.2), 6);
    x.fillRect(sx + 24, yy + 58, cw * (0.62 - rnd() * 0.2), 6);
  }
  // le bas de page : trois colonnes de texte séparées de filets, chacune avec son intertitre
  const by = py + ph + 56;
  rule(by - 14, 2);
  for (let c = 0; c < 3; c++) {
    const cx = M + c * (cw + gap);
    x.fillStyle = fg;
    x.fillRect(cx, by, cw * 0.7, 11);
    text(cx, by + 30, cw, Math.floor((H - 70 - by - 30) / 17), 17);
    if (c) { x.fillStyle = mid; x.fillRect(cx - gap / 2, by, 1.5, H - 70 - by); }
  }
  rule(H - 52, 1);
  x.fillStyle = mid;
  x.font = `600 14px ${FONT}`;
  x.textAlign = "center";
  x.fillText("FINVEILLE, LA VEILLE FINANCIÈRE DU MATIN", W / 2, H - 28);
}
function fold(pal, W, D, material, layers, lean, edge, seed) {   // un journal plié en deux : deux moitiés qui se rejoignent au pli
  const g = new THREE.Group(), rnd = random(seed), th = 0.013;
  for (const side of [-1, 1]) {
    const half = new THREE.Group();
    half.position.x = side * W / 2;   // pivot sur le bord extérieur : le pli se soulève
    half.rotation.z = -side * lean;
    for (let i = 0; i < layers; i++) {   // les feuilles, légèrement décalées
      const sheet = part(new THREE.BoxGeometry(W / 2 - rnd() * 0.02, th, D - rnd() * 0.04), edge);
      sheet.position.set(-side * W / 4, th / 2 + i * th, (rnd() - 0.5) * 0.03);
      sheet.userData.noEdges = i < layers - 1;
      half.add(sheet);
    }
    const geo = new THREE.PlaneGeometry(W / 2, D).rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.5 + (side > 0 ? 0.5 : 0));
    const top = quiet(part(geo, material));
    top.position.set(-side * W / 4, layers * th + 0.0015, 0);
    half.add(top);
    g.add(half);
  }
  return g;
}
function lathe(points, segments, material) {   // une pièce tournée : [rayon, hauteur]
  return quiet(part(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments), material));
}
function paper(data, pal, scene) {
  lights(scene, pal, { reach: 4.4, map: 1024 });
  const root = new THREE.Group();
  root.add(plinth(pal, 6, 5));
  const steel = alloy(pal, { rough: 0.3 }), glass = mat(pal.plinth);
  // le plateau : une dalle de verre, son rebord de métal et quatre pieds
  const tray = new THREE.Group();
  tray.add(part(box(4.7, 0.1, 3.9, 0.04).translate(0, 0.09, 0), glass),
    part(frameGeo(4.7, 3.9, 0.14, 0.1, 0.09).translate(0, 0.14, 0), steel));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    tray.add(at(fine(new THREE.CylinderGeometry(0.11, 0.13, 0.05, 20), steel), sx * 2.05, 0.025, sz * 1.65));
  }
  root.add(tray);
  const base = 0.14;
  const edge = mat(pal.porcelain);
  const front = printed(pal, 1024, 1338, (x, dark) => newspaper(x, 1024, 1338, dark, true, 5));
  const inside = printed(pal, 1024, 1338, (x, dark) => newspaper(x, 1024, 1338, dark, false, 9));
  const under = fold(pal, 2.75, 3.5, inside, 3, 0.03, edge, 3);   // le journal du dessous, un peu de travers
  under.position.set(-0.2, base, -0.05);
  under.rotation.y = 0.16;
  const top = fold(pal, 2.75, 3.5, front, 3, 0.045, edge, 4);   // celui du dessus : la une
  top.position.set(-0.4, base + 0.05, 0.1);
  top.rotation.y = -0.05;
  const papers = [{ g: under, rot: 0.16, x: -0.2 }, { g: top, rot: -0.05, x: -0.4 }];
  root.add(under, top);
  // la tasse de café, sur sa soucoupe
  const cup = new THREE.Group();
  cup.position.set(1.66, base, 1.0);
  const china = alloy(pal, { rough: 0.22, color: pal.dark ? 0x32468a : 0xd6def5 });
  cup.add(lathe([[0, 0], [0.3, 0], [0.5, 0.05], [0.53, 0.07], [0.48, 0.07], [0.26, 0.035], [0, 0.035]], 48, china));
  cup.add(lathe([[0, 0.035], [0.15, 0.035], [0.2, 0.07], [0.3, 0.3], [0.32, 0.36], [0.285, 0.36], [0.26, 0.3], [0.18, 0.1],
    [0, 0.08]], 48, china));
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.25, 40).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1b100c, roughness: 0.08, metalness: 0.2 }));
  coffee.position.y = 0.31;
  coffee.userData.noEdges = true;
  const handle = fine(new THREE.TorusGeometry(0.1, 0.025, 8, 20, Math.PI).rotateZ(-Math.PI / 2), china);
  handle.position.set(0.31, 0.2, 0);
  cup.add(coffee, handle);
  root.add(cup);
  // le jour qui se lève : un arc d'horizon, deux arcs plus pâles, le soleil, des rayons courts
  const dawn = new THREE.Group();
  dawn.position.set(0.2, 0.02, -2.5);
  const arcs = [[1.9, 0.018, 1.9, 0.9], [1.45, 0.008, 1.5, 0.45], [2.4, 0.006, 1.5, 0.3]].map(([r, tube, k, opacity]) => {
    const a = lit(new THREE.TorusGeometry(r, tube, 8, 160, Math.PI), pal.brand, k, { transparent: true, opacity: 0, depthWrite: false });
    a.userData.max = opacity;
    dawn.add(a);
    return a;
  });
  const horizon = lit(new THREE.BoxGeometry(5.4, 0.012, 0.012), pal.brand, 1.3, { transparent: true, opacity: 0, depthWrite: false });
  horizon.userData.max = 0.7;
  arcs.push(horizon);
  dawn.add(horizon);
  const sun = new THREE.Group();
  sun.add(lit(new THREE.SphereGeometry(0.2, 32, 20), pal.brand, 2.6), atmosphere(0.46, pal.brand, pal.dark ? 1.1 : 0.6));
  dawn.add(sun);
  const rays = [];
  for (let k = 0; k < 11; k++) {   // les rayons, de part et d'autre du soleil
    const a = Math.PI * (0.08 + 0.84 * k / 10), ray = lit(new THREE.BoxGeometry(0.012, k % 2 ? 0.2 : 0.34, 0.012), pal.brand, 1.6,
      { transparent: true, opacity: 0, depthWrite: false });
    ray.userData.max = 0.8;
    ray.position.set(Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0);
    ray.rotation.z = a - Math.PI / 2;
    sun.add(ray);
    rays.push(ray);
  }
  root.add(dawn);
  return {
    root, view: { pos: [2.4, 5.6, 7.9], look: [0.1, 0.8, -0.35], fov: 32, aspect: 1.2 }, intro: 2.1,
    update(t) {
      const rise = phase(t, 0.1, 1.6);
      sun.position.y = -0.1 + rise * 0.9;   // le soleil se lève
      sun.scale.setScalar(Math.max(0.001, 0.4 + 0.6 * rise));
      for (const a of arcs.concat(rays)) a.material.opacity = a.userData.max * phase(t, 0.5, 1.2);
      for (const p of papers) {   // les deux journaux glissent sur le plateau
        const k = phase(t, 0.2 + papers.indexOf(p) * 0.3, 0.8);
        p.g.position.x = p.x + (1 - k) * 3;
        p.g.rotation.y = p.rot + (1 - k) * 0.4;
      }
      return t < 2.1;
    },
  };
}

// --- Le flux : les dépêches heure par heure, la colonne de maintenant en bleu ------------------------------------
const DAY = [3, 2, 2, 1, 2, 4, 9, 17, 26, 31, 27, 22, 19, 21, 25, 29, 27, 22, 16, 12, 9, 7, 5, 4];
function bars(data, pal, scene) {
  const values = (data?.values?.length ? data.values : DAY).slice(-24).map((v) => Math.max(0, +v || 0));
  const n = values.length, pitch = 0.46, w = 0.34, d = 1.0, vmax = Math.max(1, ...values), floor = 0.07;
  const names = data?.labels?.slice(-24) || [];
  const labels = values.map((_, i) => names[i] ?? `${24 - n + i} h`);
  const width = n * pitch + 1.2, X = (i) => (i - (n - 1) / 2) * pitch;
  lights(scene, pal, { reach: width / 2 + 0.5, map: 1024 });
  const root = new THREE.Group();
  root.add(plinth(pal, width, d + 1.4));
  const steel = alloy(pal, { rough: 0.3 });
  // la dalle sur laquelle poussent les colonnes, et son liseré de métal
  root.add(part(box(n * pitch + 0.5, floor, d + 0.5, 0.03).translate(0, floor / 2, 0), mat(pal.plinth)),
    part(frameGeo(n * pitch + 0.5, d + 0.5, 0.06, 0.035, 0.02).translate(0, floor, 0), steel));
  // la grille derrière : des traits fins, un par repère de valeur et un toutes les trois heures
  const gz = -d / 2 - 0.55, gh = 0.1 + 3.6, pts = [];
  for (let k = 0; k <= 4; k++) pts.push(V3(X(0) - 0.3, floor + gh * k / 4, gz), V3(X(n - 1) + 0.3, floor + gh * k / 4, gz));
  for (let i = 0; i < n; i += 3) pts.push(V3(X(i), floor, gz), V3(X(i), floor + gh, gz));
  const wall = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: pal.brand, transparent: true, opacity: pal.dark ? 0.26 : 0.34, depthWrite: false }));
  root.add(wall);
  // l'axe : une règle de métal gravée, un repère toutes les trois heures
  const items = values.map((_, i) => ({ x: X(i), text: i % 3 === 0 ? labels[i] : "", major: i % 3 === 0 }));
  const axis = ruler(pal, n * pitch + 0.3, items, { depth: 0.36, tilt: 0.6, size: 0.17 });
  axis.position.set(0, floor + 0.07, d / 2 + 0.55);
  root.add(axis);
  const cols = values.map((v, i) => {
    const h = 0.1 + 3.6 * v / vmax, now = i === n - 1, k = v / vmax;
    const g = new THREE.Group(), inner = new THREE.Group(), cap = 0.06;
    inner.position.y = floor;
    g.add(inner);
    const bodyMat = mat(now ? pal.brand : pal.porcelain, now ? { opacity: 0.62 } : {});
    const body = part(box(w, h - cap, d, 0.03).translate(0, (h - cap) / 2, 0), bodyMat);
    // le chapeau lumineux : d'autant plus vif que la valeur est haute ; le dernier est de la couleur de la marque
    const capMat = mat(now ? pal.brand : pal.ink);
    capMat.emissiveIntensity *= now ? 2.2 : 0.2 + 1.1 * k;
    const lid = part(box(w + 0.02, cap, d + 0.02, 0.02).translate(0, h - cap / 2, 0), capMat);
    // deux pastilles de verre rainurées sur la face avant : le bord de la colonne, comme un chanfrein
    const step = fine(new THREE.BoxGeometry(w - 0.06, 0.012, 0.01).translate(0, Math.max(0.05, h * 0.5), d / 2 + 0.004),
      lamp(now ? pal.brand : pal.ink, now ? 1.5 : 0.5 + k));
    inner.add(body, lid, step);
    if (now) {   // un repère de « maintenant » : un fil de lumière et une bille
      inner.add(at(lit(new THREE.CylinderGeometry(0.008, 0.008, 0.7, 8).translate(0, 0.35, 0), pal.brand, 1.8), 0, h, 0),
        at(lit(new THREE.SphereGeometry(0.05, 14, 10), pal.brand, 2.4), 0, h + 0.74, 0));
    }
    tag(g, i);
    g.position.x = X(i);
    g.scale.y = 0.001;
    root.add(g);
    return { g, lift: 0, delay: i * 0.05 };
  });
  const intro = (n - 1) * 0.05 + 0.75;
  let hover = null;
  return {
    root, view: { pos: [4.6, 7.6, 18.6], look: [0, 1.3, 0], fov: 30, aspect: 1.2 }, intro,
    update(t, dt) {
      for (const c of cols) c.g.scale.y = Math.max(0.001, overshoot(t, c.delay, 0.7));
      wall.material.opacity = (pal.dark ? 0.26 : 0.34) * phase(t, 0.1, 0.8);
      const moving = hoverStep(cols, hover, dt, 0.1);
      return t < intro || moving;
    },
    pick: (ray) => pickFrom(ray, cols.map((c) => c.g), (id) =>
      `${labels[id]} : ${fr(values[id])} dépêche${values[id] >= 2 ? "s" : ""}`),
    setHover(id) { hover = id == null ? null : cols[id]; },
  };
}

// --- Le face-à-face : deux quartiers de tours de part et d'autre d'une avenue, l'un aux toits bleus ----------------
// Chaque ligne : [distance à l'avenue, profondeur, hauteur, largeur].
const DUEL = {
  a: [[1.7, -1.6, 2.7, 1.0], [1.7, 0, 3.7, 0.95], [1.7, 1.6, 2.3, 1.05], [3.2, -1.6, 3.1, 0.95], [3.2, 0, 2.1, 1.0]],
  b: [[1.7, -1.6, 3.3, 1.0], [1.7, 0, 2.5, 1.05], [1.7, 1.6, 3.0, 0.95], [3.2, -1.6, 2.2, 1.0], [3.2, 1.6, 2.7, 0.95]],
};
function duel(data, pal, scene) {
  lights(scene, pal, { reach: 5.4, map: 1024 });
  const root = new THREE.Group(), rnd = random(21);
  root.add(plinth(pal, 9.4, 5.6));
  const steel = alloy(pal, { rough: 0.3 }), kit = { a: towerKit(pal), b: towerKit(pal) };
  // les deux îlots : une dalle de verre bordée d'un trottoir de métal
  for (const sx of [-1, 1]) {
    const slab = part(box(3.3, 0.1, 5.1, 0.04).translate(sx * 2.7, 0.05, 0), mat(pal.plinth));
    const kerb = part(frameGeo(3.3, 5.1, 0.06, 0.05, 0.03).translate(sx * 2.7, 0.1, 0), steel);
    root.add(slab, kerb);
  }
  // l'avenue : le marquage gravé (bords, tirets, passages piétons), la ligne de lumière du centre, deux lampadaires par côté
  const road = decal(pal, 2.0, 5.2, (x, cw, ch, ink) => {
    x.strokeStyle = ink;
    x.lineWidth = 3;
    x.setLineDash([]);
    for (const u of [0.04, 0.96]) { x.beginPath(); x.moveTo(cw * u, 0); x.lineTo(cw * u, ch); x.stroke(); }
    x.lineWidth = 2;
    x.setLineDash([22, 26]);
    for (const u of [0.27, 0.73]) { x.beginPath(); x.moveTo(cw * u, ch * 0.08); x.lineTo(cw * u, ch * 0.92); x.stroke(); }
    x.setLineDash([]);
    x.fillStyle = ink;
    for (const v of [0.045, 0.955]) for (let k = 0; k < 7; k++) x.fillRect(cw * (0.12 + k * 0.1), ch * v - 5, cw * 0.05, 10);
  }, 120);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.004;
  root.add(road);
  const centre = lightTube(new THREE.LineCurve3(V3(0, 0.03, -2.5), V3(0, 0.03, 2.5)), pal.brand, 0.013, 2);
  root.add(centre);
  const warm = new THREE.Color(0xffd9a0);
  for (const sx of [-1, 1]) for (const z of [-1.8, 0, 1.8]) {   // les lampadaires
    const post = new THREE.Group();
    post.add(fine(new THREE.CylinderGeometry(0.012, 0.018, 0.55, 8).translate(0, 0.275, 0), steel),
      at(fine(new THREE.BoxGeometry(0.16, 0.014, 0.014), steel), -sx * 0.08, 0.55, 0), at(lit(new THREE.SphereGeometry(0.03, 10, 8), warm, 2.4), -sx * 0.16, 0.54, 0));
    post.position.set(sx * 0.88, 0.0, z + 0.5);
    root.add(post);
  }
  const trails = [[-0.5, pal.brand.clone().lerp(new THREE.Color(1, 1, 1), 0.55), 1], [0.5, pal.down, -1]].map(([x, color, dir]) => {
    const g = new THREE.Group();
    g.add(lightTube(new THREE.LineCurve3(V3(0, 0, -0.6), V3(0, 0, 0.6)), color, 0.012, 2),
      lit(new THREE.SphereGeometry(0.04, 10, 8), color, 2.4).translateZ(0.6 * dir));
    g.position.set(x, 0.05, 0);
    root.add(g);
    return { g, dir };
  });
  const names = { a: data?.a || "Groupe A", b: data?.b || "Groupe B" };
  const towers = [];
  for (const side of ["a", "b"]) {
    const roofColor = side === "a" ? pal.brand : pal.violet, roofMat = mat(roofColor);
    roofMat.emissiveIntensity *= 0.8;
    DUEL[side].forEach(([dx, z, h, w], k) => {
      const built = tower(pal, kit[side], w, h, roofMat, rnd, { y0: 0.1, mast: h > 3 ? 0.7 : 0, edge: roofColor });
      const g = new THREE.Group().add(built.body);
      tag(g, towers.length);
      g.position.set(side === "a" ? -dx : dx, 0, z);
      built.body.scale.y = 0.001;
      root.add(g);
      towers.push({ g, body: built.body, lift: 0, side, k, delay: 0.1 + (k * 2 + (side === "a" ? 0 : 1)) * 0.07 });
    });
  }
  const intro = 0.1 + 10 * 0.07 + 0.75;
  let hover = null;
  return {
    root, view: { pos: [6.4, 9.4, 15.8], look: [0, 1.4, 0], fov: 30, aspect: 1.2 }, intro,
    update(t, dt) {
      for (const tw of towers) tw.body.scale.y = Math.max(0.001, overshoot(t, tw.delay, 0.75));
      for (const side of ["a", "b"]) kit[side].skin.emissiveIntensity = kit[side].skin.userData.lit * phase(t, 0.9 + (side === "a" ? 0 : 0.1), 1.0);
      for (const tr of trails) tr.g.position.z = -tr.dir * (1 - phase(t, 0.6, 1.2)) * 3.2;   // les feux entrent dans l'avenue
      const moving = hoverStep(towers, hover, dt);
      return t < intro || moving;
    },
    pick: (ray) => pickFrom(ray, towers.map((tw) => tw.g), (id) => `${names[towers[id].side]}, tour ${towers[id].k + 1}`),
    setHover(id) { hover = id == null ? null : towers[id]; },
  };
}

// --- Le portefeuille : un anneau découpé en parts, haute selon le poids, coiffée de la couleur de la séance --------
function sectorPoints(a0, a1, r0, r1, n) {   // un secteur d'anneau : l'arc extérieur, puis l'arc intérieur en sens inverse
  const pts = [];
  for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; pts.push(new THREE.Vector2(Math.cos(a) * r1, Math.sin(a) * r1)); }
  for (let k = n; k >= 0; k--) { const a = a0 + (a1 - a0) * k / n; pts.push(new THREE.Vector2(Math.cos(a) * r0, Math.sin(a) * r0)); }
  return pts;
}
function ring(data, pal, scene) {
  const demo = [34, 24, 18, 14, 10].map((weight, i) => ({ name: `Action ${"ABCDE"[i]}`, weight, c: null }));
  const given = (data?.slices?.length ? data.slices : demo).map((s) => ({ ...s, weight: Math.max(0, +s.weight || 0) }));
  const sum = given.reduce((a, s) => a + s.weight, 0) || 1, wmax = Math.max(1e-6, ...given.map((s) => s.weight));
  const R = 2.8, r = 1.5, gap = 0.1, bt = 0.035, plate = 0.07;
  lights(scene, pal, { reach: 3.9, map: 1024 });
  const root = new THREE.Group();
  root.add(disc(pal, 3.6));
  const steel = alloy(pal, { rough: 0.3 }), steel2 = alloy(pal, { rough: 0.18, color: pal.dark ? 0x4660b8 : 0xaebce6 });
  // la platine : un anneau de métal sous les parts, son jonc et un cercle de lumière gravé de repères
  const plateShape = new THREE.Shape();
  plateShape.absarc(0, 0, R + 0.28, 0, Math.PI * 2, false);
  plateShape.holes.push(new THREE.Path().absarc(0, 0, r - 0.1, 0, Math.PI * 2, true));
  root.add(part(new THREE.ExtrudeGeometry(plateShape, { depth: plate - 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02,
    bevelSegments: 2, curveSegments: 96 }).translate(0, 0, 0.015).rotateX(-Math.PI / 2), steel));
  const jonc = (rad, tube, material, y) => root.add(at(quiet(part(new THREE.TorusGeometry(rad, tube, 10, 160).rotateX(Math.PI / 2), material)), 0, y, 0));
  jonc(R + 0.28, 0.03, steel2, plate);
  jonc(r - 0.1, 0.025, steel2, plate);
  root.add(at(lit(new THREE.TorusGeometry(R + 0.17, 0.014, 6, 200).rotateX(Math.PI / 2), pal.brand, 1.7), 0, plate + 0.01, 0));
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.014, 0.014, 0.1), lamp(pal.ink, pal.dark ? 1.1 : 0.8), 72);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
  for (let k = 0; k < 72; k++) {   // un repère tous les 5°, plus long tous les 30°
    const a = k / 72 * Math.PI * 2, major = k % 6 === 0;
    q.setFromAxisAngle(V3(0, 1, 0), a);
    ticks.setMatrixAt(k, m4.compose(V3(Math.sin(a) * (R + 0.2 + (major ? 0.03 : 0)), plate + 0.012, Math.cos(a) * (R + 0.2 + (major ? 0.03 : 0))),
      q, major ? V3(1.2, 1.2, 1.9) : s1));
  }
  ticks.userData.noEdges = true;
  ticks.raycast = () => {};
  root.add(ticks);
  // le moyeu : un fût tourné, ses bagues et un cœur de lumière ; huit rayons le relient à l'anneau intérieur
  const hub = lathe([[0, 0], [0.62, 0], [0.64, 0.04], [0.58, 0.1], [0.52, 0.34], [0.4, 0.4], [0.26, 0.44], [0, 0.44]], 72, steel);
  root.add(hub);
  for (const [y, rad] of [[0.12, 0.6], [0.3, 0.55]]) jonc(rad, 0.018, steel2, y);
  root.add(at(lit(new THREE.TorusGeometry(0.2, 0.014, 8, 48).rotateX(Math.PI / 2), pal.brand, 2.2), 0, 0.446, 0));
  root.add(at(lit(new THREE.SphereGeometry(0.07, 16, 12), pal.brand, 2.6), 0, 0.47, 0));
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2 + Math.PI / 8;
    const spoke = part(box(0.9, 0.07, 0.1, 0.02), steel);
    spoke.position.set(Math.cos(a) * 1.0, 0.1, Math.sin(a) * 1.0);
    spoke.rotation.y = -a;
    spoke.userData.noEdges = true;
    root.add(spoke);
  }
  let acc = 0;
  const slices = given.map((s, i) => {
    const share = s.weight / sum, span = Math.max(0.03, share * Math.PI * 2 - gap);
    const mid = Math.PI / 2 - (acc + share / 2) * Math.PI * 2, a0 = mid - span / 2, a1 = mid + span / 2;
    acc += share;
    const n = Math.max(2, Math.ceil(span / 0.06));
    const sh = new THREE.Shape(sectorPoints(a0, a1, r, R, n));
    const h = Math.max(0.3, 2.4 * s.weight / wmax);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: h - 2 * bt, bevelEnabled: true, bevelThickness: bt, bevelSize: bt * 0.8,
      bevelSegments: 2, curveSegments: 1 }).translate(0, 0, bt).rotateX(-Math.PI / 2);
    // le dessus : une peau de lumière très pâle, bordée d'un cadre fin de la couleur de la séance
    const edge = s.c != null ? changeColor(pal, s.c) : pal.brand, m = 0.075, da = m / ((r + R) / 2);
    const frame = new THREE.Shape(sectorPoints(a0, a1, r + m * 0.55, R - m * 0.55, n));
    frame.holes.push(new THREE.Path(sectorPoints(a0 + da, a1 - da, r + m * 1.5, R - m * 1.5, n).reverse()));
    const lid = new THREE.ExtrudeGeometry(frame, { depth: 0.02, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, h - 0.004)
      .rotateX(-Math.PI / 2);
    const skinGeo = new THREE.ExtrudeGeometry(new THREE.Shape(sectorPoints(a0, a1, r + m * 0.55, R - m * 0.55, n)),
      { depth: 0.01, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, h - 0.006).rotateX(-Math.PI / 2);
    const g = new THREE.Group().add(part(geo, mat(pal.porcelain)), quiet(part(skinGeo, mat(edge, { opacity: 0.22 }))),
      lit(lid, edge, 1.35));
    g.position.y = 0;
    tag(g, i);
    g.children.forEach((c) => { c.position.y += plate; });
    g.scale.y = 0.001;
    root.add(g);
    return { g, lift: 0, share, delay: 0.1 + i * Math.min(0.2, 1.2 / given.length), ...s };
  });
  const intro = 0.1 + (given.length - 1) * Math.min(0.2, 1.2 / given.length) + 0.8;
  let hover = null;
  return {
    root, view: { pos: [3.8, 10.8, 11.6], look: [0, 0.4, 0], fov: 30, aspect: 1.2 }, intro,
    update(t, dt) {
      for (const s of slices) s.g.scale.y = Math.max(0.001, overshoot(t, s.delay, 0.75));
      const moving = hoverStep(slices, hover, dt);
      return t < intro || moving;
    },
    pick: (ray) => pickFrom(ray, slices.map((s) => s.g), (id) => {
      const s = slices[id];
      return [s.name, `${fr(s.share * 100)}${NN}%`, s.c != null ? pct(s.c) : ""].filter(Boolean).join(", ");
    }),
    setHover(id) { hover = id == null ? null : slices[id]; },
  };
}

// --- Les intérêts composés : quinze marches, le capital versé en verre, les intérêts gagnés en lumière bleue ---------
function stairs(data, pal, scene) {
  const monthly = data?.monthly ?? 100, rate = data?.rate ?? 5, years = 15;
  const mr = rate / 100 / 12;
  const rows = Array.from({ length: years }, (_, y) => {
    const m = (y + 1) * 12, paid = monthly * m;
    const total = mr > 0 ? monthly * ((1 + mr) ** m - 1) / mr : paid;
    return { year: y + 1, paid, total, gain: total - paid };
  });
  const top = Math.max(1, rows[years - 1].total), H = 4.2, pitch = 0.78, w = 0.62, d = 1.1, floor = 0.08;
  const width = years * pitch + 1.2, X = (i) => (i - (years - 1) / 2) * pitch;
  lights(scene, pal, { reach: width / 2 + 0.5, map: 1024 });
  const root = new THREE.Group();
  root.add(plinth(pal, width, d + 1.5));
  const steel = alloy(pal, { rough: 0.3 }), coinMat = alloy(pal, { rough: 0.2, color: pal.dark ? 0x4a64bc : 0xb4c2ea });
  root.add(part(box(years * pitch + 0.4, floor, d + 0.5, 0.03).translate(0, floor / 2, 0), mat(pal.plinth)),
    part(frameGeo(years * pitch + 0.4, d + 0.5, 0.06, 0.035, 0.02).translate(0, floor, 0), steel));
  // la grille derrière les marches : une ligne par quart de la valeur finale, un trait vertical tous les cinq ans
  const gz = -d / 2 - 0.5, gp = [];
  for (let k = 1; k <= 4; k++) gp.push(V3(X(0) - 0.4, floor + H * k / 4, gz), V3(X(years - 1) + 0.4, floor + H * k / 4, gz));
  for (let i = 4; i < years; i += 5) gp.push(V3(X(i), floor, gz), V3(X(i), floor + H, gz));
  gp.push(V3(X(0) - 0.4, floor, gz), V3(X(0) - 0.4, floor + H, gz));
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gp),
    new THREE.LineBasicMaterial({ color: pal.brand, transparent: true, opacity: pal.dark ? 0.24 : 0.32, depthWrite: false })));
  // la règle des années : un repère par année, plus long et gravé tous les cinq ans
  const items = rows.map((row, i) => ({ x: X(i), text: `${row.year}`, major: row.year === 1 || row.year % 5 === 0 }));
  const axis = ruler(pal, years * pitch + 0.2, items, { depth: 0.36, tilt: 0.6, size: 0.17 });
  axis.position.set(0, floor + 0.07, d / 2 + 0.55);
  root.add(axis);
  const coinGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.05, 32), coinRim = new THREE.TorusGeometry(0.21, 0.01, 6, 32).rotateX(Math.PI / 2);
  const stacks = { 5: 3, 10: 5, 15: 7 };
  const steps = rows.map((row, i) => {
    const hp = Math.max(0.05, row.paid / top * H), hg = row.gain / top * H, g = new THREE.Group(), inner = new THREE.Group();
    inner.position.y = floor;
    g.add(inner);
    inner.add(part(box(w, hp, d, 0.035).translate(0, hp / 2, 0), mat(pal.porcelain)));
    let y = hp;
    if (hg > 0.004) {   // le joint de métal, puis les intérêts en lumière
      inner.add(at(fine(box(w + 0.03, 0.016, d + 0.03, 0.006), steel), 0, hp, 0));
      inner.add(part(box(w, hg, d, 0.035).translate(0, hp + hg / 2 + 0.008, 0), mat(pal.brand, { opacity: 0.7 })),
        at(lit(frameGeo(w - 0.04, d - 0.04, 0.03, 0.025, 0.012), pal.brand, 1.5), 0, hp + hg + 0.008, 0));   // le filet du dessus
      y = hp + hg + 0.008;
    }
    const count = stacks[row.year];
    if (count) {   // une pile de pièces, posée à l'arrière du palier
      for (let c = 0; c < count; c++) {
        const coin = fine(coinGeo, coinMat);
        coin.position.set((c % 2 ? 0.014 : -0.012), y + 0.025 + c * 0.054, -0.14);
        coin.rotation.y = c * 0.9;
        inner.add(coin);
      }
      inner.add(at(lit(coinRim, pal.brand, 1.8), 0, y + 0.054 * count + 0.003, -0.14));
    }
    g.position.x = X(i);
    tag(g, i);
    g.scale.y = 0.001;
    root.add(g);
    return { g, lift: 0, delay: 0.1 + i * 0.07, top: floor + y + (count ? 0.054 * count : 0), edge: floor + hp + hg, ...row };
  });
  // la courbe de lumière qui suit l'arête avant des sommets : une exponentielle
  const pts = steps.map((s, i) => V3(X(i), s.edge + 0.035, d / 2 - 0.02));
  const curve = new THREE.CatmullRomCurve3([V3(X(0) - 0.4, steps[0].edge * 0.9 + 0.035, d / 2 - 0.02), ...pts,
    V3(X(years - 1) + 0.4, steps[years - 1].edge + 0.1, d / 2 - 0.02)], false, "centripetal");
  const line = lightTube(curve, pal.brand, 0.026, 220);
  root.add(line);
  const indexCount = line.geometry.index.count;
  const beads = pts.map((p) => {
    const b = lit(new THREE.SphereGeometry(0.05, 12, 8), pal.brand, 2.4);
    b.position.copy(p);
    root.add(b);
    return b;
  });
  const intro = 0.1 + (years - 1) * 0.07 + 0.75;
  let hover = null;
  return {
    root, view: { pos: [4.6, 8.2, 18.0], look: [0, 2.3, 0], fov: 30, aspect: 1.2 }, intro,
    update(t, dt) {
      for (const s of steps) s.g.scale.y = Math.max(0.001, overshoot(t, s.delay, 0.75));
      const reveal = Math.min(1, Math.max(0, (t - 0.1) / (years * 0.07 + 0.4)));   // la courbe suit la croissance des marches
      line.geometry.setDrawRange(0, Math.floor(indexCount * reveal / 36) * 36);
      beads.forEach((b, i) => b.scale.setScalar(Math.max(0.001, overshoot(t, 0.1 + i * 0.07 + 0.3, 0.5))));
      const moving = hoverStep(steps, hover, dt, 0.1);
      return t < intro || moving;
    },
    pick: (ray) => pickFrom(ray, steps.map((s) => s.g), (id) => {
      const s = steps[id];
      return `Année ${s.year} : ${fr(s.total)}${NN}€ dont ${fr(s.gain)}${NN}€ d'intérêts`;
    }),
    setHover(id) { hover = id == null ? null : steps[id]; },
  };
}

// --- La courbe des taux : des rubans les uns derrière les autres, le plus récent en bleu, au premier plan ------------
// Chaque ruban est un peu surélevé par rapport à celui qui le précède, pour que tous restent lisibles (comme un relief).
const CURVES = [
  [3.4, 3.5, 3.6, 3.8, 4.0, 4.3, 4.6], [3.2, 3.3, 3.5, 3.6, 3.9, 4.1, 4.4], [2.9, 3.1, 3.2, 3.5, 3.7, 4.0, 4.3],
  [2.5, 2.7, 2.9, 3.1, 3.4, 3.8, 4.1], [1.9, 2.1, 2.4, 2.7, 3.1, 3.5, 3.9], [1.2, 1.4, 1.7, 2.1, 2.6, 3.1, 3.6],
];
const AGES = ["Aujourd'hui", "Il y a 1 mois", "Il y a 3 mois", "Il y a 6 mois", "Il y a 1 an", "Il y a 2 ans"];
const TERMS = ["3 m", "6 m", "1 a", "2 a", "5 a", "10 a", "30 a"];
function ridges(data, pal, scene) {
  const curves = (data?.curves?.length ? data.curves : CURVES).slice(0, 8);
  const n = curves.length, gapZ = 0.9, halfW = 3.4, depth = 0.12, bt = 0.02, band = 0.4, floor = 0.08;
  const all = curves.flat().map((v) => +v || 0), vmax = Math.max(1, ...all);
  const base = Math.min(...all) * 0.7;   // le zéro du relief
  const width = halfW * 2 + 2.2, deep = n * gapZ + 1.8, frontZ = ((n - 1) / 2) * gapZ;
  const Y = (v, k) => floor + ((+v || 0) - base) / Math.max(0.01, vmax - base) * 2.7 + k * 0.55;
  lights(scene, pal, { reach: width / 2 + 0.5, map: 1024 });
  const root = new THREE.Group();
  root.add(plinth(pal, width, deep));
  const steel = alloy(pal, { rough: 0.3 }), steel2 = alloy(pal, { rough: 0.2, color: pal.dark ? 0x4660b8 : 0xaebce6 });
  root.add(part(box(halfW * 2 + 1.0, floor, n * gapZ + 0.5, 0.03).translate(0, floor / 2, 0), mat(pal.plinth)),
    part(frameGeo(halfW * 2 + 1.0, n * gapZ + 0.5, 0.06, 0.035, 0.02).translate(0, floor, 0), steel));
  const m = curves[0].length, X = (i) => -halfW + 2 * halfW * i / (m - 1);
  // l'axe des échéances : une règle gravée « 3 m … 30 a », un repère par point de la courbe
  const terms = curves[0].map((_, i) => ({ x: X(i), text: m === TERMS.length ? TERMS[i] : `${i + 1}`, major: true }));
  const axis = ruler(pal, halfW * 2 + 0.7, terms, { depth: 0.36, tilt: 0.6, size: 0.18 });
  axis.position.set(0, floor + 0.07, frontZ + 0.95);
  root.add(axis);
  // l'axe des taux : un rail vertical à gauche du ruban de devant, un repère par point de pourcentage
  const railX = -halfW - 0.55;
  root.add(rod([railX, floor, frontZ], [railX, floor + 3.2, frontZ], 0.025, steel2),
    at(fine(new THREE.SphereGeometry(0.05, 12, 8), steel2), railX, floor + 3.2, frontZ));
  const lo = Math.ceil(base), hi = Math.floor(vmax), rates = [];
  for (let v = lo; v <= hi; v++) rates.push(v);
  for (const v of rates) root.add(at(fine(new THREE.BoxGeometry(0.2, 0.014, 0.014), lamp(pal.ink, pal.dark ? 1.2 : 0.8)), railX + 0.1, Y(v, 0), frontZ));
  const scale = decal(pal, 0.7, 3.4, (x, cw, ch, ink) => {
    x.fillStyle = ink;
    x.font = `800 ${ch * 0.05}px ${FONT}`;
    x.textAlign = "right";
    x.textBaseline = "middle";
    for (const v of rates) x.fillText(`${v}${NN}%`, cw * 0.9, ch * (1 - (Y(v, 0) - floor - 0.1) / 3.4));
  }, 200);
  scale.position.set(railX - 0.45, floor + 0.1 + 1.7, frontZ);
  root.add(scale);
  const dot = new THREE.SphereGeometry(0.045, 12, 8), post = new THREE.CylinderGeometry(0.011, 0.011, 1, 6).translate(0, 0.5, 0);
  const walls = curves.map((ys, k) => {
    const pts = ys.map((v, i) => V3(X(i), Y(v, k), 0));
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal"), line = curve.getPoints(72);
    const sh = new THREE.Shape();   // le ruban : la courbe, et la même courbe un peu plus bas
    sh.moveTo(line[0].x, line[0].y);
    for (const p of line) sh.lineTo(p.x, p.y);
    for (let i = line.length - 1; i >= 0; i--) sh.lineTo(line[i].x, Math.max(floor + 0.03, line[i].y - band));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: depth - 2 * bt, bevelEnabled: true, bevelThickness: bt, bevelSize: bt * 0.8,
      bevelSegments: 1, curveSegments: 1 }).translate(0, 0, -(depth - 2 * bt) / 2);
    const front = k === 0, mixed = pal.brand.clone().lerp(pal.violet, 0.85 * k / Math.max(1, n - 1));
    const g = new THREE.Group();
    g.add(part(geo, mat(front ? pal.porcelain : pal.porcelain.clone().lerp(pal.shade, 0.5 * k / Math.max(1, n - 1)))));
    const edge = lightTube(curve, mixed, front ? 0.024 : 0.017, 160);
    edge.material.opacity = front ? 1 : 0.85 - 0.45 * k / Math.max(1, n - 1);
    g.add(edge);
    pts.forEach((p, i) => {   // une bille sur chaque point, et un pied jusqu'à la dalle
      const bead = lit(dot, mixed, front ? 2.6 : 1.8);
      bead.position.copy(p);
      bead.scale.setScalar(front ? 1.5 : 0.85);
      const leg = new THREE.Mesh(post, lamp(mixed, 0.8, { transparent: true, opacity: front ? 0.55 : 0.28, depthWrite: false }));
      leg.userData.noEdges = true;
      leg.position.set(p.x, floor, 0);
      leg.scale.y = Math.max(0.01, p.y - band);
      g.add(bead, leg);
    });
    tag(g, k);
    g.position.z = frontZ - k * gapZ;
    g.scale.y = 0.001;
    root.add(g);
    return { g, lift: 0, name: AGES[k] || `Courbe ${k + 1}`, from: +ys[0] || 0, to: +ys[ys.length - 1] || 0,
      delay: 0.1 + (n - 1 - k) * 0.2 };
  });
  const intro = 0.1 + (n - 1) * 0.2 + 0.85;
  let hover = null;
  return {
    root, view: { pos: [5.2, 11.0, 15.0], look: [-0.2, 1.1, 0], fov: 30, aspect: 1.2 }, intro,
    update(t, dt) {
      for (const w of walls) w.g.scale.y = Math.max(0.001, overshoot(t, w.delay, 0.8));
      const moving = hoverStep(walls, hover, dt);
      return t < intro || moving;
    },
    pick: (ray) => pickFrom(ray, walls.map((w) => w.g), (id) => {
      const w = walls[id];
      return `${w.name} : de ${fr(w.from, 2)}${NN}% à ${fr(w.to, 2)}${NN}%`;
    }),
    setHover(id) { hover = id == null ? null : walls[id]; },
  };
}

// --- Les alertes : une cloche suspendue qui sonne, et les ondes qui s'en vont sur le sol, la première en bleu ---------
// Le profil de la cloche, de la gorge au sommet : l'intérieur (creux), la lèvre, puis l'extérieur (pavillon, taille, épaule).
const BELL_IN = [[0, 2.18], [0.22, 2.13], [0.38, 1.97], [0.5, 1.75], [0.6, 1.42], [0.7, 1.04], [0.84, 0.66], [0.97, 0.36],
  [1.05, 0.14], [1.08, 0.03]];
const BELL_OUT = [[1.26, 0.035], [1.24, 0.12], [1.14, 0.3], [1.0, 0.58], [0.86, 0.92], [0.76, 1.28], [0.68, 1.62], [0.58, 1.92],
  [0.45, 2.14], [0.28, 2.27], [0.12, 2.34], [0, 2.36]];
function bellProfile() {
  const spline = (pts, n) => new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(n);
  return [...spline(BELL_IN, 40), new THREE.Vector2(1.12, 0), new THREE.Vector2(1.2, 0), ...spline(BELL_OUT, 48)];
}
const bellRadius = (y) => {   // le rayon extérieur à une hauteur donnée
  for (let i = 1; i < BELL_OUT.length; i++) {
    const [r0, y0] = BELL_OUT[i - 1], [r1, y1] = BELL_OUT[i];
    if (y >= y0 && y <= y1) return r0 + (r1 - r0) * (y - y0) / (y1 - y0);
  }
  return 0.5;
};
function bell(data, pal, scene) {
  lights(scene, pal, { reach: 4.8, map: 1024 });
  const root = new THREE.Group();
  root.add(disc(pal, 4.3));
  const steel = alloy(pal, { rough: 0.32 }), bronze = alloy(pal, { rough: 0.24, color: pal.dark ? 0x4660b8 : 0xaebce6 });
  const rig = new THREE.Group();   // le portique, la cloche et son battant : ils apparaissent ensemble
  root.add(rig);
  // le portique : deux montants tournés sur leur platine, haubanés, et la poutre qui porte la cloche
  const post = new THREE.LatheGeometry([[0, 0], [0.17, 0], [0.17, 0.05], [0.12, 0.12], [0.1, 0.3], [0.08, 0.9], [0.075, 3.2],
    [0.1, 3.28], [0.1, 3.34], [0, 3.34]].map(([r, y]) => new THREE.Vector2(r, y)), 32);
  for (const z of [-1.5, 1.5]) {
    rig.add(at(part(box(1.1, 0.08, 1.1, 0.03), steel), 0, 0.04, z), at(quiet(part(post, steel)), 0, 0.08, z));
    for (const y of [0.6, 1.5, 2.5]) rig.add(at(quiet(part(new THREE.TorusGeometry(0.095 - y * 0.004, 0.018, 8, 28).rotateX(Math.PI / 2), bronze)), 0, y, z));
    rig.add(at(part(box(0.3, 0.3, 0.3, 0.03), steel), 0, 3.46, z));   // le palier du pivot
    for (const sx of [-1, 1]) {
      rig.add(rod([sx * 0.8, 0.08, z], [0, 2.4, z], 0.032, steel, 8));
      rig.add(at(fine(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 14), steel), sx * 0.8, 0.1, z));
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) rig.add(at(screw(steel, 0.035), sx * 0.44, 0.08, z + sz * 0.44));
  }
  rig.add(rod([0, 0.14, -1.5], [0, 0.14, 1.5], 0.03, steel, 8));
  rig.add(rod([0, 3.5, -1.62], [0, 3.5, 1.62], 0.075, steel));
  for (const z of [-1.62, 1.62]) rig.add(at(fine(new THREE.SphereGeometry(0.1, 16, 12), bronze), 0, 3.5, z));
  const pivot = new THREE.Group();   // la cloche pend de la poutre et balance autour d'elle
  pivot.position.y = 3.5;
  rig.add(pivot);
  pivot.add(quiet(part(new THREE.CylinderGeometry(0.14, 0.14, 0.34, 24).rotateX(Math.PI / 2), bronze)));   // le collier
  for (const dz of [-0.11, 0.11]) pivot.add(at(part(box(0.12, 0.46, 0.05, 0.015), steel), 0, -0.26, dz));   // les étriers
  pivot.add(at(quiet(part(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 10).rotateZ(Math.PI / 2), bronze)), 0, -0.4, 0));
  const swing = new THREE.Group();   // le corps de la cloche : son bord bas est à 0,6 au-dessus du sol
  swing.position.y = -2.9;
  pivot.add(swing);
  swing.add(quiet(part(new THREE.LatheGeometry(bellProfile(), 96), alloy(pal, { rough: 0.4, color: pal.dark ? 0x3b52a6 : 0xb3c1ea }))));
  for (const [y, tube] of [[0.2, 0.024], [0.36, 0.016], [0.52, 0.012], [1.72, 0.016], [1.8, 0.012]]) {   // les filets de bronze
    swing.add(at(quiet(part(new THREE.TorusGeometry(bellRadius(y) + 0.004, tube, 8, 96).rotateX(Math.PI / 2), bronze)), 0, y, 0));
  }
  swing.add(at(fine(new THREE.CylinderGeometry(0.2, 0.3, 0.1, 28), bronze), 0, 2.4, 0),   // le sommet et son anneau de suspension
    at(fine(new THREE.TorusGeometry(0.1, 0.028, 8, 24).rotateY(Math.PI / 2), bronze), 0, 2.52, 0));
  const clapper = new THREE.Group();   // le battant, accroché sous la voûte
  clapper.position.y = 2.1;
  clapper.add(fine(new THREE.CylinderGeometry(0.028, 0.034, 1.62, 10).translate(0, -0.81, 0), steel),
    fine(new THREE.SphereGeometry(0.17, 28, 20).translate(0, -1.72, 0), bronze));
  swing.add(clapper);
  // la pastille de notification, sur l'épaule : une bille rouge et son anneau
  const phi = 0.5, bx = Math.sin(phi), bz = Math.cos(phi), br = bellRadius(1.95) + 0.07;
  const badge = new THREE.Group();
  badge.position.set(bx * br, 1.95, bz * br);
  badge.add(fine(new THREE.SphereGeometry(0.14, 28, 20), mat(pal.down)), lit(new THREE.TorusGeometry(0.22, 0.01, 6, 40), pal.down, 1.6));
  badge.children[1].rotation.y = phi;
  badge.children[1].position.set(0, 0, 0);
  swing.add(badge);
  // les ondes : des anneaux de lumière sur le sol, le premier en bleu
  const waves = [1.9, 2.55, 3.2, 3.85].map((rad, i) => {
    const m = lamp(i === 0 ? pal.brand : pal.ink, i === 0 ? 1.9 : 1.1, { transparent: true, opacity: 0, depthWrite: false });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(rad, i === 0 ? 0.026 : 0.016, 8, 160).rotateX(Math.PI / 2), m);
    torus.position.y = 0.03;
    torus.userData.noEdges = true;
    root.add(torus);
    return { torus, m, full: [1, 0.7, 0.5, 0.34][i], delay: 0.7 + i * 0.3 };
  });
  let volley = -1;   // un clic sonne une nouvelle volée : le temps depuis le clic (-1 : au repos)
  return {
    root, view: { pos: [5.0, 6.6, 12.0], look: [0, 1.6, 0], fov: 30, aspect: 1.2 }, intro: 2.3,
    poke() { volley = 0; },
    update(t, dt) {
      rig.scale.setScalar(Math.max(0.001, overshoot(t, 0.05, 0.8)));
      if (volley >= 0) volley += dt;
      const s = volley >= 0 ? 0.8 + volley : t;   // la volée du montage, ou celle du clic, et ses ondes
      const u = Math.min(1, Math.max(0, (s - 0.8) / 1.5)), ramp = Math.min(1, u * 6);   // une seule volée, qui s'éteint
      pivot.rotation.z = 0.42 * Math.sin(u * Math.PI * 3) * (1 - u);
      clapper.rotation.z = -0.7 * Math.sin(u * Math.PI * 3 - 0.9) * (1 - u) * ramp;
      for (const w of waves) {
        const k = phase(s, w.delay, 0.9);
        w.torus.scale.setScalar(0.3 + 0.7 * k);
        w.m.opacity = k * w.full;
        w.torus.visible = k > 0.001;
      }
      if (volley > 1.8) volley = -1;
      return t < 2.3 || volley >= 0;
    },
  };
}

// --- Le suivi : un petit quartier de sept tours, et la loupe qui se pose sur l'une d'elles -----------------------
// Chaque ligne : [x, z, hauteur] ; la dernière est celle que la loupe examine.
const LENS_TOWERS = [[-2.2, -1.2, 2.0], [-0.8, -1.4, 2.9], [0.7, -1.2, 2.3], [2.1, -0.9, 1.7], [1.7, 0.7, 2.1],
  [-2.2, 0.4, 1.4], [-0.5, 0.3, 3.0]];
function lens(data, pal, scene) {
  lights(scene, pal, { reach: 4.4, map: 1024 });
  const root = new THREE.Group(), rnd = random(33);
  root.add(plinth(pal, 7, 5));
  const steel = alloy(pal, { rough: 0.3 }), bronze = alloy(pal, { rough: 0.2, color: pal.dark ? 0x4660b8 : 0xaebce6 });
  const kit = towerKit(pal);
  root.add(part(box(6.3, 0.1, 4.3, 0.04).translate(0, 0.05, 0), mat(pal.plinth)),
    part(frameGeo(6.3, 4.3, 0.06, 0.05, 0.03).translate(0, 0.1, 0), steel));
  const aimRoof = mat(pal.brand);
  aimRoof.emissiveIntensity *= 1.2;
  const names = data?.names || [];
  const towers = LENS_TOWERS.map(([x, z, h], i) => {
    const w = i === 6 ? 1.1 : 1.0, aimed = i === 6;
    const built = tower(pal, kit, w, h, aimed ? aimRoof : kit.relief, rnd,
      { y0: 0.1, mast: h > 2.8 && !aimed ? 0.6 : 0, edge: aimed ? pal.brand : null });
    const g = new THREE.Group().add(built.body);
    tag(g, i);
    g.position.set(x, 0, z);
    built.body.scale.y = 0.001;
    root.add(g);
    return { g, body: built.body, lift: 0, name: names[i] || `Valeur ${i + 1}`, delay: 0.1 + i * 0.1, x, z, h: built.top };
  });
  for (const [x, z] of [[-3.0, 1.5], [-1.4, 1.6], [0.9, 1.7], [2.9, 1.2], [3.0, -1.3], [-3.0, -1.6]]) {   // quelques arbres
    root.add(at(fine(new THREE.CylinderGeometry(0.014, 0.02, 0.2, 6).translate(0, 0.1, 0), steel), x, 0.1, z),
      at(fine(new THREE.IcosahedronGeometry(0.14, 1), kit.shade), x, 0.34, z));
  }
  const aim = towers[6];
  root.add(at(lit(new THREE.TorusGeometry(0.34, 0.012, 6, 48).rotateX(Math.PI / 2), pal.brand, 2), aim.x, aim.h + 0.012, aim.z));   // le point visé
  const loupe = new THREE.Group();   // la loupe, penchée vers nous, au-dessus du toit de la tour visée
  loupe.rotation.x = -1.1;
  const R = 0.9;
  // la monture : un jonc de métal, son biseau intérieur, un filet de lumière, huit vis
  loupe.add(quiet(part(new THREE.TorusGeometry(R, 0.075, 18, 112), steel)),
    quiet(part(new THREE.TorusGeometry(R - 0.07, 0.026, 10, 112), bronze)),
    lit(new THREE.TorusGeometry(R + 0.005, 0.01, 6, 112), pal.brand, 1.8).translateZ(0.07));
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2 + 0.2, s = screw(bronze, 0.035);
    s.position.set(Math.cos(a) * R, Math.sin(a) * R, 0.07);
    s.rotation.x = Math.PI / 2;
    loupe.add(s);
  }
  // le verre : biconvexe, transparent, légèrement teinté
  const lensGeo = new THREE.LatheGeometry([[0, -0.07], [0.35, -0.062], [0.65, -0.04], [R - 0.05, -0.012], [R - 0.05, 0.012], [0.65, 0.04],
    [0.35, 0.062], [0, 0.07]].map(([r, y]) => new THREE.Vector2(r, y)), 72).rotateX(Math.PI / 2);
  const glass = new THREE.Mesh(lensGeo, new THREE.MeshPhysicalMaterial({ color: pal.dark ? 0xa9bcff : 0xcad6ff, transmission: 0,
    transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0, clearcoat: 1 }));
  glass.material.userData.role = "glass";
  glass.material.depthWrite = false;
  glass.userData.noEdges = true;
  glass.receiveShadow = true;   // le verre ne porte pas d'ombre : elle serait pleine
  loupe.add(glass, at(lit(new THREE.TorusGeometry(R * 0.7, 0.012, 6, 30, 1.0).rotateZ(1.9), pal.ink, 1.6, { transparent: true, opacity: 0.8 }), 0, 0, 0.05));
  // le manche : une bague de métal, un cuir rainuré et un bouton
  const dir = new THREE.Vector2(0.55, -0.83).normalize();
  const handle = new THREE.Group();
  handle.position.set(dir.x * R, dir.y * R, 0);
  handle.rotation.z = Math.atan2(-dir.x, dir.y);
  const leather = new THREE.MeshStandardMaterial({ color: pal.dark ? 0x1b2552 : 0x8895c4, roughness: 0.78, metalness: 0.1 });
  leather.userData.role = "glass";
  handle.add(quiet(part(new THREE.CylinderGeometry(0.05, 0.075, 0.2, 18).translate(0, 0.1, 0), steel)),   // le collet, relié au jonc
    quiet(part(new THREE.CylinderGeometry(0.095, 0.095, 0.2, 24).translate(0, 0.3, 0), bronze)),   // la bague
    quiet(part(new THREE.LatheGeometry([[0, 0.42], [0.075, 0.42], [0.085, 0.5], [0.09, 0.64], [0.075, 0.66], [0.088, 0.68], [0.092, 0.82],
      [0.077, 0.84], [0.09, 0.86], [0.095, 1.0], [0.08, 1.02], [0.093, 1.04], [0.1, 1.3], [0.11, 1.45], [0.095, 1.54], [0, 1.56]]
      .map(([r, y]) => new THREE.Vector2(r, y)), 28), leather)),
    quiet(part(new THREE.TorusGeometry(0.098, 0.014, 8, 28).rotateX(Math.PI / 2), bronze)).translateY(1.46),
    at(fine(new THREE.SphereGeometry(0.075, 18, 12), bronze), 0, 1.56, 0));
  loupe.add(handle);
  root.add(loupe);
  let hover = null;
  const intro = 2.1;
  return {
    root, view: { pos: [5.2, 8.2, 12.2], look: [0, 1.5, 0], fov: 30, aspect: 1.2 }, intro,
    update(t, dt) {
      for (const tw of towers) tw.body.scale.y = Math.max(0.001, overshoot(t, tw.delay, 0.75));
      kit.skin.emissiveIntensity = kit.skin.userData.lit * phase(t, 0.9, 1.0);
      loupe.position.set(aim.x, aim.h + 1.0 + (1 - overshoot(t, 1.0, 0.9)) * 2.6, aim.z + 0.35);   // elle descend se poser sur la tour
      const moving = hoverStep(towers, hover, dt);
      return t < intro || moving;
    },
    pick: (ray) => pickFrom(ray, towers.map((tw) => tw.g), (id) => towers[id].name),
    setHover(id) { hover = id == null ? null : towers[id]; },
  };
}

// --- Les favoris : trois articles en éventail dans un présentoir, et le signet bleu pincé sur celui de devant --------
function articleCard(pal, seed, w, h) {   // une fiche d'article : la même que celles de l'assistant (cardTexture)
  const m = new THREE.MeshStandardMaterial({ color: pal.dark ? 0x0f1a3a : 0xe9eefc, metalness: 0.4, roughness: 0.25,
    emissive: pal.dark ? 0xffffff : 0x2f45c8, emissiveMap: cardTexture(seed), emissiveIntensity: pal.dark ? 0.85 : 0.7 });
  m.userData.role = "glass";
  return part(new RoundedBoxGeometry(w, h, 0.05, 2, 0.02), m);
}
function bookmark(data, pal, scene) {
  lights(scene, pal, { reach: 4.0, map: 1024 });
  const root = new THREE.Group();
  root.add(plinth(pal, 6.8, 3.8));
  const steel = alloy(pal, { rough: 0.3 }), bronze = alloy(pal, { rough: 0.2, color: pal.dark ? 0x4660b8 : 0xaebce6 });
  const W = 2.5, Hc = 1.76, T = 0.05, tilt = -0.1, base = 0.14;
  // le présentoir : un rail de métal bas, son liseré de lumière, le nom gravé devant, quatre vis
  root.add(part(box(6.9, base, 1.7, 0.045).translate(0, base / 2, 0), steel));
  root.add(at(lit(new THREE.BoxGeometry(6.7, 0.012, 0.012), pal.brand, 1.5, { transparent: true, opacity: 0.9 }), 0, base + 0.002, 0.82));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) root.add(at(screw(bronze, 0.045), sx * 3.2, base, sz * 0.65));
  const name = decal(pal, 2.2, 0.28, (x, cw, ch, ink) => {
    x.fillStyle = ink;
    x.font = `800 ${ch * 0.62}px ${FONT}`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.letterSpacing = `${ch * 0.14}px`;
    x.fillText("FAVORIS", cw / 2, ch * 0.54);
  }, 220);
  name.rotation.x = -Math.PI / 2;
  name.position.set(0, base + 0.004, 0.6);
  root.add(name);
  const specs = [{ x: -1.95, z: -0.2, ry: 0.3, seed: 3 }, { x: 1.95, z: -0.2, ry: -0.3, seed: 5 }, { x: 0, z: 0.35, ry: 0, seed: 8 }];
  const cards = specs.map((s, i) => {
    const g = new THREE.Group(), lean = new THREE.Group();
    lean.rotation.x = tilt;
    const card = articleCard(pal, s.seed, W, Hc);
    card.position.y = Hc / 2 + 0.08;
    lean.add(card);
    for (const sz of [-1, 1]) lean.add(at(part(box(W * 0.9, sz > 0 ? 0.2 : 0.14, 0.05, 0.015), steel), 0, sz > 0 ? 0.1 : 0.07, sz * (T / 2 + 0.025)));
    for (const sx of [-1, 1]) lean.add(at(part(box(0.06, 0.2, T + 0.1, 0.015), steel), sx * W * 0.45, 0.1, 0));
    g.add(lean);
    g.position.set(s.x, base, s.z);
    root.add(g);
    return { g, lean, ...s, i, delay: 0.1 + i * 0.22 };
  });
  // le signet : un ruban de lumière à bout en V, qui passe par-dessus le bord haut de la fiche de devant
  const rw = 0.36, rl = 1.15, ribbon = new THREE.Shape();
  ribbon.moveTo(-rw / 2, 0);
  ribbon.lineTo(rw / 2, 0);
  ribbon.lineTo(rw / 2, -rl);
  ribbon.lineTo(0, -rl + 0.22);
  ribbon.lineTo(-rw / 2, -rl);
  ribbon.closePath();
  const rgeo = new THREE.ExtrudeGeometry(ribbon, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005,
    bevelSegments: 1 });
  const rp = rgeo.attributes.position;
  for (let i = 0; i < rp.count; i++) {   // le ruban se décolle légèrement vers le bas
    const t = Math.min(1, Math.max(0, -rp.getY(i) / rl));
    rp.setZ(i, rp.getZ(i) + 0.07 * t * t + 0.012 * Math.sin(rp.getX(i) * 9) * t);
  }
  rgeo.computeVertexNormals();
  const rm = mat(pal.brand);
  rm.emissiveIntensity *= 1.4;
  const clip = new THREE.Group();
  clip.add(quiet(part(rgeo, rm)).translateZ(T / 2 + 0.006),
    at(quiet(part(box(rw + 0.012, 0.03, T + 0.04, 0.008), rm)), 0, 0.012, 0),
    at(quiet(part(box(rw + 0.012, 0.36, 0.014, 0.004), rm)), 0, -0.16, -T / 2 - 0.008));
  clip.position.set(0.62, Hc + 0.08, 0);
  const front = cards[2].lean;
  front.add(clip);
  const intro = 2.0;
  return {
    root, view: { pos: [3.6, 4.8, 10.6], look: [0, 1.0, 0], fov: 30, aspect: 1.2 }, intro,
    update(t) {
      for (const c of cards) {
        const k = phase(t, c.delay, 0.8);
        c.g.position.set(c.x * (0.4 + 0.6 * k), base + (1 - k) * 2.2, c.z);
        c.g.rotation.y = c.ry * k;
        c.g.scale.setScalar(Math.max(0.001, k));
      }
      clip.position.y = Hc + 0.08 + (1 - overshoot(t, 1.1, 0.8)) * 2.4;
      return t < intro;
    },
  };
}

// --- Le glossaire : une pile de quatre livres reliés un peu de travers, l'un à couverture bleue, un « A » sur le dessus --
const TITLES = ["INDICES", "OBLIGATIONS", "ACTIONS", "GLOSSAIRE"];
function pageBlock(pal) {   // la tranche des pages : des filets fins, comme des feuilles serrées
  const rnd = random(5);
  return printed(pal, 256, 128, (x, dark) => {
    for (let y = 0; y < 128; y += 3) {
      x.fillStyle = dark ? `rgba(170,190,240,${0.22 + rnd() * 0.3})` : `rgba(70,90,160,${0.18 + rnd() * 0.25})`;
      x.fillRect(0, y, 256, 1.4);
    }
  }, { base: 0x0b1330, k: 0.7 });
}
function spineTitle(pal, text, tone) {   // le titre en creux sur le dos : de la lumière sur la couleur de la couverture
  const tex = canvasTexture(128, 512, (x, w, h) => {
    x.fillStyle = "#000";
    x.fillRect(0, 0, w, h);
    x.fillStyle = "#fff";
    x.translate(w / 2, h / 2);
    x.rotate(Math.PI / 2);
    x.font = `800 ${h * 0.12}px ${FONT}`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.letterSpacing = `${h * 0.012}px`;
    x.fillText(text, 0, 0);
  });
  const m = new THREE.MeshStandardMaterial({ color: pal.dark ? 0x131f48 : 0xdce3f7, metalness: 0.5, roughness: 0.3, emissive: tone,
    emissiveMap: tex, emissiveIntensity: pal.dark ? 1.5 : 1 });
  m.userData.role = "glass";
  return m;
}
function book(pal, kit, W, h, D, cover, title, blue) {
  const g = new THREE.Group(), tc = 0.05, r = h / 2, sz = D / 2 - r, depth = D / 2 + sz, zc = (sz - D / 2) / 2;
  const half = (len, extra = 0, from = -Math.PI / 2, span = Math.PI, open = false) =>   // un demi-cylindre couché le long de x
    new THREE.CylinderGeometry(r + extra, r + extra, len, 32, 1, open, from, span).rotateZ(Math.PI / 2).translate(0, h / 2, sz);
  g.add(part(box(W, tc, depth, 0.02).translate(0, tc / 2, zc), cover), part(box(W, tc, depth, 0.02).translate(0, h - tc / 2, zc), cover));
  g.add(part(half(W), cover));   // le dos arrondi
  g.add(part(new THREE.BoxGeometry(W - 0.14, h - 2 * tc + 0.004, depth - 0.1).translate(0, h / 2, zc - 0.03), kit.pages));   // les pages
  const tone = blue ? pal.brand : pal.ink;
  const label = quiet(part(half(W * 0.5, 0.005, -Math.PI / 2 + 0.5, Math.PI - 1.0, true), spineTitle(pal, title, tone)));
  g.add(label);
  for (const sx of [-1, 1]) {   // les nerfs : deux filets de métal sur le dos, et les tranchefiles aux deux bouts des pages
    g.add(quiet(part(half(0.035, 0.012, -Math.PI / 2 + 0.2, Math.PI - 0.4).translate(sx * W * 0.36, 0, 0), kit.bronze)));
    g.add(at(fine(new THREE.CylinderGeometry(h * 0.1, h * 0.1, 0.26, 10).rotateX(Math.PI / 2), blue ? kit.light : kit.bronze),
      sx * (W / 2 - 0.1), h / 2, sz - 0.2));
  }
  // un filet gravé sur le plat supérieur : le cadre de la couverture
  const fr = lit(frameGeo(W - 0.34, depth - 0.3, 0.05, blue ? 0.022 : 0.012, 0.008), tone, blue ? 1.8 : pal.dark ? 0.8 : 0.5);
  fr.position.set(0, h + 0.002, zc - 0.02);
  g.add(fr);
  return g;
}
function books(data, pal, scene) {
  lights(scene, pal, { reach: 3.4, map: 1024 });
  const root = new THREE.Group();
  root.add(plinth(pal, 5.6, 4.4));
  const kit = { pages: pageBlock(pal), bronze: alloy(pal, { rough: 0.22, color: pal.dark ? 0x4660b8 : 0xaebce6 }), light: mat(pal.brand) };
  const tinted = (c, k) => { const m = mat(c); m.color.lerp(pal.brand, k); return m; };
  const specs = [{ w: 3.5, h: 0.62, d: 2.5, c: tinted(pal.relief, 0.1), ry: 0.1, x: 0.05 },
    { w: 2.9, h: 0.5, d: 2.1, c: tinted(pal.shade, 0.25), ry: -0.2, x: -0.3 },
    { w: 3.3, h: 0.56, d: 2.35, c: tinted(pal.relief, 0.55), ry: 0.22, x: 0.25, blue: true },
    { w: 2.6, h: 0.44, d: 1.9, c: tinted(pal.porcelain, 0.1), ry: -0.08, x: 0.1 }];
  let y = 0.0;
  const stack = specs.map((s, i) => {
    const b = book(pal, kit, s.w, s.h, s.d, s.c, TITLES[i], s.blue);
    b.position.set(s.x, 0, 0);
    b.rotation.y = s.ry;
    const holder = new THREE.Group().add(b);
    holder.position.y = y;
    const rest = y;
    y += s.h;
    root.add(holder);
    if (i === specs.length - 1) {   // le « A » gravé sur la couverture du livre du dessus
      const a = engraving("A", pal, { scale: 0.8 });
      const mark = quiet(solid(new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0),
        mat(0xffffff, { map: a.map, bump: a.bump, bumpScale: 2 }))));
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(0, s.h + 0.006, -0.08);
      b.add(mark);
    }
    tag(holder, i);
    return { holder, rest, delay: 0.15 + i * 0.3, title: TITLES[i] };
  });
  const intro = 0.15 + 3 * 0.3 + 1.0;
  let hover = null;
  // un clic sur un livre cherche son sujet dans le glossaire (le dessus de la pile : tout le glossaire)
  const terms = { GLOSSAIRE: "", ACTIONS: "action", OBLIGATIONS: "obligation", INDICES: "indice" };
  return {
    root, view: { pos: [3.8, 5.0, 8.8], look: [0, 1.0, 0.1], fov: 30, aspect: 1.2 }, intro,
    update(t) {
      let moving = t < intro;
      for (const b of stack) {
        const k = overshoot(t, b.delay, 0.9), out = b === hover ? 0.35 : 0;   // le livre visé sort de la pile
        b.holder.position.y = b.rest + (1 - k) * 3.5;
        b.holder.rotation.y = (1 - phase(t, b.delay, 0.9)) * 0.9;
        const z = b.holder.position.z + (out - b.holder.position.z) * 0.25;
        if (Math.abs(z - out) > 0.002) moving = true;
        b.holder.position.z = z;
      }
      return moving;
    },
    pick: (ray) => pickFrom(ray, stack.map((b) => b.holder), (id) => stack[id].title.charAt(0) + stack[id].title.slice(1).toLowerCase(),
      (id) => terms[stack[id].title] ?? stack[id].title.toLowerCase()),
    setHover(id) { hover = id == null || id === "all" ? null : stack[id]; },
  };
}

// --- Les réglages : trois engrenages à denture en développante, sur une platine ; le petit en bleu --------------------
// Le module est 0,2 : le rayon primitif vaut dents × 0,1. Flancs en développante de cercle (angle de pression 20°).
function gearShape(N, rp, bore, holes) {
  const pa = 20 * Math.PI / 180, rb = rp * Math.cos(pa), ra = rp + 0.13, rr = rp - 0.16, step = Math.PI * 2 / N, inv = (a) => Math.tan(a) - a;
  const half = (r) => 0.96 * Math.PI / (2 * N) + inv(pa) - inv(Math.acos(Math.min(1, rb / r)));   // demi-épaisseur angulaire à r
  const r0 = Math.max(rr, rb), pts = [], p = (r, a) => pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  for (let i = 0; i < N; i++) {
    const c = i * step;
    if (rr < rb) p(rr, c - half(rb));
    for (let k = 0; k <= 6; k++) { const r = r0 + (ra - r0) * k / 6; p(r, c - half(r)); }
    for (let k = 1; k < 3; k++) p(ra, c - half(ra) + 2 * half(ra) * k / 3);
    for (let k = 6; k >= 0; k--) { const r = r0 + (ra - r0) * k / 6; p(r, c + half(r)); }
    if (rr < rb) p(rr, c + half(rb));
    const a0 = c + half(r0), a1 = c + step - half(r0);   // le fond de la denture jusqu'à la dent suivante
    for (let k = 1; k < 3; k++) p(rr, a0 + (a1 - a0) * k / 3);
  }
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  const hole = (x, y, r) => { const h = new THREE.Path(); h.absarc(x, y, r, 0, Math.PI * 2, true); s.holes.push(h); };
  hole(0, 0, bore);
  const [count, ringR, holeR] = holes;
  for (let k = 0; k < count; k++) { const a = k / count * Math.PI * 2 + Math.PI / count; hole(Math.cos(a) * ringR, Math.sin(a) * ringR, holeR); }
  return s;
}
function gear(data, pal, scene) {
  lights(scene, pal, { reach: 4.4, map: 1024 });
  const root = new THREE.Group();
  root.add(plinth(pal, 7.8, 3.6));
  const steel = alloy(pal, { rough: 0.3 }), bronze = alloy(pal, { rough: 0.2, color: pal.dark ? 0x4660b8 : 0xaebce6 });
  const shaft = alloy(pal, { rough: 0.15, color: pal.dark ? 0x6f86d8 : 0x93a5df });
  // A (16 dents) engrène B (10 dents) qui engrène C (8 dents). Les phases sont réglées pour que chaque dent
  // arrive dans un creux : la dent de A vise B, un creux de B regarde A, et une dent de B vise C.
  const A = { teeth: 16, R: 1.6, hole: 0.3, hub: 0.46, x: -1.4, y: 1.85, holes: [6, 0.95, 0.27], color: alloy(pal, { rough: 0.26,
    color: pal.dark ? 0x3a4f9a : 0xb9c6ea }) };
  const B = { teeth: 10, R: 1.0, hole: 0.22, hub: 0.34, y: 1.25, holes: [5, 0.6, 0.15], color: alloy(pal, { rough: 0.26,
    color: pal.dark ? 0x4660b8 : 0xaebce6 }) };
  const C = { teeth: 8, R: 0.8, hole: 0.18, hub: 0.28, holes: [4, 0.47, 0.1], color: mat(pal.brand) };
  const dAB = A.R + B.R, alpha = Math.atan2(B.y - A.y, Math.sqrt(dAB * dAB - (B.y - A.y) ** 2));
  B.x = A.x + Math.cos(alpha) * dAB;
  A.off = alpha;
  const pB = Math.PI * 2 / B.teeth, pC = Math.PI * 2 / C.teeth;
  B.off = alpha + Math.PI - pB / 2;
  const beta = B.off + Math.round((1.0 - B.off) / pB) * pB;
  C.x = B.x + Math.cos(beta) * (B.R + C.R);
  C.y = B.y + Math.sin(beta) * (B.R + C.R);
  C.off = beta + Math.PI - pC / 2;
  const sign = [1, -A.teeth / B.teeth, A.teeth / C.teeth];   // la vitesse de chacun, rapportée à celle de A
  // la platine : une plaque debout où les axes sont vissés, posée sur une semelle, avec ses vis et ses pieds
  const lift = 0.3, cx = (A.x - A.R + C.x + C.R) / 2 + 0.05, pw = C.x + C.R - (A.x - A.R) + 0.9, ph = 4.3;
  root.add(part(box(pw + 0.5, 0.18, 1.5, 0.05).translate(cx, 0.12, 0.1), steel));
  const back = new THREE.ExtrudeGeometry(roundedRect(pw, ph, 0.2), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02,
    bevelSegments: 2, curveSegments: 8 }).translate(cx, 0.21 + ph / 2, -0.62);
  root.add(part(back, alloy(pal, { rough: 0.38, color: pal.dark ? 0x1d2a5c : 0xc3cfee })));
  for (const sx of [-1, 1]) {
    root.add(at(fine(new THREE.CylinderGeometry(0.1, 0.12, 0.06, 18), steel), cx + sx * (pw / 2 + 0.1), 0.03, 0.6),
      at(fine(new THREE.CylinderGeometry(0.1, 0.12, 0.06, 18), steel), cx + sx * (pw / 2 + 0.1), 0.03, -0.35));
    for (const sy of [0.4, ph - 0.1]) {   // quatre vis, tête de face
      const s = screw(shaft, 0.06);
      s.rotation.x = Math.PI / 2;
      s.position.set(cx + sx * (pw / 2 - 0.3), 0.21 + sy, -0.5);
      root.add(s);
    }
    root.add(at(screw(shaft, 0.06), cx + sx * (pw / 2 - 0.2), 0.21, 0.5));
  }
  const border = lit(frameGeo(pw - 0.5, ph - 0.5, 0.12, 0.014, 0.008, true), pal.ink, pal.dark ? 0.9 : 0.6);
  border.position.set(cx, 0.21 + ph / 2, -0.495);
  const plaque = decal(pal, 3.4, 0.2, (x, cw, ch, ink) => {   // la gravure de la platine
    x.fillStyle = ink;
    x.font = `800 ${ch * 0.5}px ${FONT}`;
    x.textAlign = "left";
    x.textBaseline = "middle";
    x.letterSpacing = `${ch * 0.1}px`;
    x.fillText("MÉCANISME DE RÉGLAGE, n° 1", 0, ch * 0.54);
  }, 200);
  plaque.position.set(cx - pw / 2 + 0.55 + 1.7, 0.21 + ph - 0.38, -0.494);
  root.add(border, plaque);
  const gears = [A, B, C].map((s, i) => {
    const geo = new THREE.ExtrudeGeometry(gearShape(s.teeth, s.R, s.hole, s.holes), { depth: 0.36, bevelEnabled: true, bevelThickness: 0.025,
      bevelSize: 0.018, bevelSegments: 2, curveSegments: 4 }).translate(0, 0, -0.18);
    const spin = new THREE.Group();
    spin.add(part(geo, s.color));
    for (const sz of [-1, 1]) {   // le moyeu tourné de chaque côté, ses boulons et la bague
      const boss = quiet(part(new THREE.LatheGeometry([[0, 0], [s.hub + 0.04, 0], [s.hub + 0.04, 0.04], [s.hub, 0.08], [s.hub * 0.82, 0.13],
        [0, 0.13]].map(([r, y]) => new THREE.Vector2(r, y)), 40).rotateX(sz * Math.PI / 2), steel));
      boss.position.z = sz * 0.2;
      spin.add(boss);
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2, b = fine(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 6).rotateX(Math.PI / 2), shaft);
        b.position.set(Math.cos(a) * s.hub * 0.64, Math.sin(a) * s.hub * 0.64, sz * 0.335);
        spin.add(b);
      }
    }
    spin.add(at(lit(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12).rotateX(Math.PI / 2), pal.ink, 1.8), s.R - 0.35, 0, 0.215));   // le repère
    const g = new THREE.Group();
    g.position.set(s.x, s.y + lift, 0);
    g.add(spin);
    // l'axe traverse l'engrenage, tenu par une entretoise ; une rondelle et une vis le bloquent devant
    g.add(quiet(part(new THREE.CylinderGeometry(s.hole - 0.03, s.hole - 0.03, 0.8, 24).rotateX(Math.PI / 2).translate(0, 0, -0.04), shaft)),
      at(fine(new THREE.CylinderGeometry(s.hole + 0.08, s.hole + 0.08, 0.2, 24).rotateX(Math.PI / 2), steel), 0, 0, -0.5),
      at(fine(new THREE.CylinderGeometry(s.hole + 0.04, s.hole + 0.04, 0.03, 24).rotateX(Math.PI / 2), steel), 0, 0, 0.375));
    const nut = screw(shaft, s.hole * 0.7);
    nut.rotation.x = Math.PI / 2;
    nut.position.z = 0.385;
    g.add(nut);
    root.add(g);
    return { g, spin, s, k: sign[i], delay: 0.05 + i * 0.15 };
  });
  const intro = 2.3;
  let extra = 0, from = 0, clock = -1;
  return {
    root, view: { pos: [3.8, 6.4, 11.6], look: [0.1, 2.0, 0], fov: 30, aspect: 1.2 }, intro,
    poke() { from = extra; clock = 0; },
    update(t, dt) {
      if (clock >= 0) {   // un clic : un quart de tour de plus, en douceur (les rapports gardent les dents engrenées)
        clock += dt;
        const k = phase(clock, 0, 0.9);
        extra = from + k * Math.PI / 2;
        if (k >= 1) clock = -1;
      }
      const turn = (1 - phase(t, 0.15, 1.9)) * Math.PI * 2.4 + extra;   // ils tournent ensemble, puis s'arrêtent bien engrenés
      for (const it of gears) {
        it.g.scale.setScalar(Math.max(0.001, overshoot(t, it.delay, 0.7)));
        it.spin.rotation.z = it.s.off + it.k * turn;
      }
      return t < intro || clock >= 0;
    },
  };
}

// --- À propos : la marque FinVeille (la tuile, le L, la courbe et le point vert) incrustée, sur un chevalet ----------
function ghosted(group, k = 0.13) {   // un reflet : les mêmes pièces, très pâles, sans ombre ni arêtes
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = false;
    o.userData.noEdges = true;
    o.raycast = () => {};
    o.material = o.material.clone();
    o.material.transparent = true;
    o.material.depthWrite = false;
    o.material.opacity = (o.material.opacity ?? 1) * k;
  });
  return group;
}
function logo(data, pal, scene) {
  lights(scene, pal, { reach: 4.0, map: 1024 });
  const root = new THREE.Group();
  root.add(plinth(pal, 6.6, 4.4));
  const S = 4.3 / 64, X = (x) => (x - 32) * S, Y = (y) => (32 - y) * S;   // les coordonnées du logo.svg, en mètres de maquette
  const depth = 0.3, bt = 0.06, cy = 2.58;
  const build = (reflect) => {
    const steel = alloy(pal, { rough: 0.3 }), bronze = alloy(pal, { rough: 0.2, color: pal.dark ? 0x4660b8 : 0xaebce6 });
    const frame = alloy(pal, { rough: 0.2, color: pal.dark ? 0x2b3f86 : 0xb4c2ec });
    const piece = new THREE.Group(), tile = new THREE.Group();
    tile.position.y = cy;
    piece.add(tile);
    // la tuile : un corps de métal à chanfrein, un filet de lumière, et la plaque de verre où la marque est incrustée
    tile.add(part(new THREE.ExtrudeGeometry(roundedRect(4.3, 4.3, 16 * S), { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bt,
      bevelSegments: 4, curveSegments: 12 }).translate(0, 0, -depth / 2), frame));
    const z0 = depth / 2 + bt;
    const grad = canvasTexture(256, 256, (x, w, h) => {
      const gr = x.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, "#4a78ff");
      gr.addColorStop(1, "#16348e");
      x.fillStyle = gr;
      x.fillRect(0, 0, w, h);
    });
    const plateGeo = new THREE.ShapeGeometry(roundedRect(3.84, 3.84, 0.86), 12), up = plateGeo.attributes.uv, pp = plateGeo.attributes.position;
    for (let i = 0; i < up.count; i++) up.setXY(i, (pp.getX(i) + 1.92) / 3.84, 1 - (1.92 - pp.getY(i)) / 3.84 * 1);
    const plateMat = new THREE.MeshStandardMaterial({ color: pal.dark ? 0x0a1232 : 0xdfe6fb, metalness: 0.5, roughness: 0.28, emissive: 0xffffff,
      emissiveMap: grad, emissiveIntensity: pal.dark ? 0.5 : 0.42 });
    plateMat.userData.role = "glass";
    tile.add(at(quiet(part(plateGeo, plateMat)), 0, 0, z0 + 0.003));
    tile.add(at(lit(frameGeo(3.96, 3.96, 0.92, 0.04, 0.014, true), pal.brand, 1.7), 0, 0, z0 + 0.003));
    const face = new THREE.Group();   // la face avant de la tuile
    face.position.z = z0 + 0.004;
    tile.add(face);
    const lightMat = mat(pal.brand);
    lightMat.emissiveIntensity *= 1.15;
    const marks = [];
    const inlay = (w, h, r, d, x, y, rz, start, m = lightMat) => {   // un liseré de métal, et dans le creux la lumière
      const g = new THREE.Group();
      const b = 0.045;
      g.add(part(new THREE.ExtrudeGeometry(roundedRect(w + 2 * b, h + 2 * b, r + b), { depth: 0.07, bevelEnabled: false, curveSegments: 8 }), steel),
        quiet(part(new THREE.ExtrudeGeometry(roundedRect(w, h, r), { depth: d, bevelEnabled: false, curveSegments: 8 }), m)));
      g.position.set(x, y, 0);
      g.rotation.z = rz;
      g.scale.z = 0.001;
      face.add(g);
      marks.push([g, start]);
    };
    inlay(9.5 * S, 38 * S, 3.5 * S, 0.1, X(20.75), Y(32), 0, 1.0);
    inlay(32 * S, 9.5 * S, 3.5 * S, 0.1, X(32), Y(17.75), 0, 1.1);
    const way = [[25.5, 38.5], [32, 33.2], [38, 36.2], [46, 28.5]];   // la courbe : trois segments à bouts ronds
    for (let i = 0; i < 3; i++) {
      const [x0, y0] = way[i], [x1, y1] = way[i + 1], len = Math.hypot(x1 - x0, y1 - y0) * S, w = 5.5 * S;
      inlay(len + w, w, w / 2, 0.1 + 0.003 * (i + 1), X((x0 + x1) / 2), Y((y0 + y1) / 2), Math.atan2(-(y1 - y0), x1 - x0), 1.3 + i * 0.12);
    }
    const dot = new THREE.Group(), green = mat(pal.up);
    green.emissiveIntensity *= 1.6;
    dot.add(quiet(part(new THREE.CylinderGeometry(5.7 * S, 5.7 * S, 0.07, 40).rotateX(Math.PI / 2).translate(0, 0, 0.035), steel)),
      quiet(part(new THREE.CylinderGeometry(5 * S, 5 * S, 0.14, 40).rotateX(Math.PI / 2).translate(0, 0, 0.07), green)));
    dot.position.set(X(46.5), Y(28), 0);
    dot.scale.z = 0.001;
    face.add(dot);
    marks.push([dot, 1.7]);
    // le chevalet : deux montants inclinés, la barre du haut, la tablette où repose la tuile, le pied arrière
    for (const sx of [-1, 1]) {
      piece.add(rod([sx * 2.45, 0, 0.75], [sx * 2.45, 4.98, -0.35], 0.06, steel), at(fine(new THREE.SphereGeometry(0.09, 14, 10), bronze), sx * 2.45, 0.02, 0.75));
      piece.add(at(fine(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 16).rotateZ(Math.PI / 2), bronze), sx * 2.4, 0.3, 0.2));
    }
    piece.add(rod([-2.45, 4.98, -0.35], [2.45, 4.98, -0.35], 0.05, steel), rod([0, 4.98, -0.35], [0, 0, -2.7], 0.055, steel),
      at(fine(new THREE.SphereGeometry(0.09, 14, 10), bronze), 0, 0.02, -2.7));
    piece.add(at(part(box(4.8, 0.13, 0.9, 0.03), steel), 0, 0.3, 0.2), at(part(box(4.8, 0.09, 0.07, 0.02), bronze), 0, 0.42, 0.62));   // la tablette
    piece.add(at(part(box(0.8, 0.12, 0.5, 0.03), steel), 0, 4.8, 0.02), at(screw(shaftSteel(pal), 0.07), 0, 4.86, 0.02));   // la pince du haut
    if (reflect) ghosted(piece);
    return { piece, tile, marks };
  };
  const real = build(false), mirror = build(true);
  const reflection = new THREE.Group().add(mirror.piece);
  reflection.scale.y = -1;
  reflection.position.y = -0.012;
  root.add(real.piece, reflection);
  const intro = 2.4;
  return {
    root, view: { pos: [3.8, 6.0, 13.2], look: [0, 2.3, 0], fov: 28, aspect: 1.2 }, intro,
    update(t) {
      const k = phase(t, 0.1, 1.1);
      for (const it of [real, mirror]) {
        it.piece.rotation.y = -0.4 - (1 - k) * Math.PI * 1.2;
        it.piece.scale.setScalar(Math.max(0.001, k));
        for (const [m, start] of it.marks) m.scale.z = Math.max(0.001, overshoot(t, start, 0.6));
      }
      return t < intro;
    },
  };
}
const shaftSteel = (pal) => alloy(pal, { rough: 0.15, color: pal.dark ? 0x6f86d8 : 0x93a5df });

export const ATELIER = { paper, bars, duel, ring, stairs, ridges, bell, lens, bookmark, books, gear, logo };
