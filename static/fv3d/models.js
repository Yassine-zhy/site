// FinVeille — les maquettes (guides 33 et 41) : le CAC 40, le globe des places, les cryptomonnaies. Seules les pages
// dont la maquette montre des données en ont une ; les objets purement décoratifs ont été retirés.
//
// Chaque maquette est une fonction (données, palette, scène) qui rend :
//   root     le groupe à poser dans la vitrine (sans transformation propre)
//   view     la caméra : { pos, look, fov, aspect } (aspect : la largeur / hauteur pour laquelle le cadrage est pensé)
//   intro    la durée du montage, en secondes
//   update(t, dt)   avance le montage (t : secondes depuis l'arrivée) ; vrai tant que quelque chose bouge
//   pick(ray)       ce que vise le pointeur : { id, text } ou null      setHover(id)   le mettre en avant
//   labels()        les étiquettes à afficher : [{ id, text, pos (dans root), tone, opacity }]
//   pose(chapitre)  facultatif : la caméra pour un chapitre du récit de l'accueil
// La lumière est ajoutée à la scène par la maquette (kit.lights), le socle fait partie de root.

import {
  THREE, RoundedBoxGeometry, mat, metal, inked, lights, plinth, disc, changeColor, signed, phase, overshoot,
  isLand, onSphere, random, tag, pickFrom, facadeTexture, facadeBox,
} from "./kit.js";
import { isPhone } from "./phone.js";

// --- Le CAC 40 en maquette (l'accueil) ---------------------------------------------------------------------------
// Une maquette d'architecte : une tour de plâtre par valeur, haute comme son poids dans l'indice, coiffée d'un toit
// peint à la couleur de sa séance. Les plus lourdes au centre, sur une planche où le plan des rues est tracé à l'encre.
// Les fenêtres s'impriment une fois la tour montée.
const WINDOWS = 0.5;
const GLASS = [new THREE.Color(0x1f3b5e), new THREE.Color(0x2b4e7a)];   // le verre des tours : sombre, clair   // la force de l'impression des fenêtres

function streetPlan(pal, W, D, xs, zs) {   // le plan gravé : avenues, lignes pointillées, passages piétons, lampadaires
  const px = 96, c = document.createElement("canvas");
  c.width = Math.round(W * px); c.height = Math.round(D * px);
  const x = c.getContext("2d"), X = (v) => (v + W / 2) * px, Z = (v) => (v + D / 2) * px;
  x.fillStyle = "#000";
  x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = "rgba(255,255,255,.85)";
  x.lineWidth = 2;
  for (const v of xs) { x.beginPath(); x.moveTo(X(v), Z(-D / 2 + 0.25)); x.lineTo(X(v), Z(D / 2 - 0.25)); x.stroke(); }
  for (const v of zs) { x.beginPath(); x.moveTo(X(-W / 2 + 0.25), Z(v)); x.lineTo(X(W / 2 - 0.25), Z(v)); x.stroke(); }
  x.setLineDash([10, 12]);
  x.lineWidth = 1;
  x.strokeStyle = "rgba(255,255,255,.5)";
  for (const v of xs) { x.beginPath(); x.moveTo(X(v) + 9, Z(-D / 2 + 0.3)); x.lineTo(X(v) + 9, Z(D / 2 - 0.3)); x.stroke(); }
  x.setLineDash([]);
  x.fillStyle = "rgba(255,255,255,.9)";
  for (const a of xs) for (const b of zs) {   // un passage piéton et deux lampadaires par carrefour
    for (let k = -2; k <= 2; k++) x.fillRect(X(a) + k * 5 - 1.5, Z(b) - 12, 3, 7);
    x.beginPath(); x.arc(X(a) - 14, Z(b) - 14, 2.2, 0, Math.PI * 2); x.arc(X(a) + 14, Z(b) + 14, 2.2, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c);   // une carte de transparence : pas d'espace de couleur
  t.anisotropy = 8;
  return t;
}

function skin(pal) {   // la façade : du plâtre ; ses fenêtres, imprimées à l'encre, apparaissent une fois la tour montée
  const m = inked(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(pal.dark ? 0x1f3b5e : 0x2b4e7a), roughness: 0.06,
    metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 }), facadeTexture(), 0x9fc0e6, 0);
  m.userData.role = "body";
  return m;
}

function city(data, pal, scene) {
  // 40 immeubles dans une carte d'ombres de 2048 px : trop lourd pour un téléphone, qui garde la lumière sans l'ombre
  lights(scene, pal, { reach: 8, map: 2048, sun: [-7, 12, 6], shadow: !isPhone() });
  const root = new THREE.Group(), rnd = random(11);
  const cols = 8, rows = 5, cell = 1.22, fw = 0.8, gap = 0.18;
  const W = cols * cell + gap + 1.1, D = rows * cell + 1.1;
  const colX = (i) => (i - (cols - 1) / 2) * cell + (i >= cols / 2 ? gap : -gap);
  const rowZ = (j) => (j - (rows - 1) / 2) * cell;
  root.add(plinth(pal, W, D));
  const slab = new THREE.Mesh(new RoundedBoxGeometry(W, 0.16, D, 3, 0.06).translate(0, -0.08, 0), mat(pal.plinth));
  slab.receiveShadow = true;
  const xs = [...Array(cols - 1).keys()].map((i) => (colX(i) + colX(i + 1)) / 2);
  const zs = [...Array(rows - 1).keys()].map((j) => (rowZ(j) + rowZ(j + 1)) / 2);
  const plan = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
    color: 0xaab4c2, alphaMap: streetPlan(pal, W, D, xs, zs), transparent: true, opacity: 0.6,
    depthWrite: false }));
  plan.position.y = 0.003;
  plan.userData.noEdges = true;
  plan.raycast = () => {};
  root.add(slab, plan);
  const cells = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) cells.push({ x: colX(i), z: rowZ(j) });
  cells.sort((a, b) => (a.x * a.x * 0.55 + a.z * a.z) - (b.x * b.x * 0.55 + b.z * b.z));
  const given = (data.towers || []).slice().sort((a, b) => b.w - a.w).slice(0, cells.length);
  const wmax = given[0]?.w || 1;
  const towers = given.map((t, k) => {
    const h = 0.7 + 4.4 * Math.sqrt(t.w / wmax), g = new THREE.Group(), body = new THREE.Group(), facade = skin(pal);
    const podium = new THREE.Mesh(new RoundedBoxGeometry(fw + 0.18, 0.26, fw + 0.18, 2, 0.03).translate(0, 0.13, 0), metal(pal, { rough: 0.3 }));
    body.add(podium);
    // le fût, et pour les grandes tours un retrait au sommet, séparé par une corniche
    const setback = h > 2.3, lower = setback ? h * 0.74 : h;
    const shaft = new THREE.Mesh(facadeBox(fw, lower - 0.26, fw, 0.15, rnd()), facade);
    shaft.position.y = 0.26;
    body.add(shaft);
    let top = lower, roofW = fw;
    if (setback) {
      const ledge = new THREE.Mesh(new RoundedBoxGeometry(fw + 0.06, 0.06, fw + 0.06, 2, 0.02), metal(pal, { rough: 0.3 }));
      ledge.position.y = lower;
      const upper = new THREE.Mesh(facadeBox(fw * 0.68, h - lower, fw * 0.68, 0.15, rnd()), facade);
      upper.position.y = lower + 0.03;
      body.add(ledge, upper);
      top = h + 0.03; roofW = fw * 0.68;
    }
    // le toit : la couleur de la séance ; dessus, une flèche pour les trois plus lourdes, sinon des équipements
    const roofColor = changeColor(pal, t.c);
    const roof = new THREE.Mesh(new RoundedBoxGeometry(roofW + 0.04, 0.09, roofW + 0.04, 2, 0.02).translate(0, 0.045, 0), mat(roofColor));
    roof.position.y = top;
    body.add(roof);
    if (k < 3) {
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.035, 0.85, 8).translate(0, 0.425, 0), metal(pal));
      spire.position.y = top + 0.09;
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), mat(pal.down));
      beacon.position.y = top + 0.96;
      body.add(spire, beacon);
    } else {
      for (let u = 0; u < 1 + (k % 3); u++) {
        const unit = new THREE.Mesh(new RoundedBoxGeometry(0.2 + rnd() * 0.12, 0.08, 0.14, 1, 0.01).translate(0, 0.04, 0), mat(pal.shade));
        unit.position.set((rnd() - 0.5) * roofW * 0.5, top + 0.09, (rnd() - 0.5) * roofW * 0.5);
        body.add(unit);
      }
    }
    body.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    body.scale.y = 0.001;
    g.add(body);
    g.position.set(cells[k].x, 0, cells[k].z);
    tag(g, k);
    root.add(g);
    return { ...t, h: top, g, body, facade, roof, x: cells[k].x, z: cells[k].z, delay: 0.15 + k * 0.035 };
  });
  const known = towers.filter((t) => t.c != null);
  const ups = [...known].sort((a, b) => b.c - a.c).slice(0, 3), downs = [...known].sort((a, b) => a.c - b.c).slice(0, 3);
  let chapter = "overview", hover = null;
  const view = { pos: [12.8, 10.2, 15.8], look: [0, 1.1, 0], fov: 26, aspect: 1.25 };
  const focus = (t) => ({ pos: [t.x + 7.2, t.h + 6.2, t.z + 11.2], look: [t.x - 0.3, t.h * 0.45, t.z] });
  return {
    root, view, intro: 0.15 + towers.length * 0.035 + 1.4,
    pose(kind) {
      chapter = kind;
      if (kind === "up" && ups[0]) return focus(ups[0]);
      if (kind === "down" && downs[0]) return focus(downs[0]);
      if (kind === "news") return { pos: [-10.5, 6.4, 12], look: [0, 1.3, 0] };
      return view;
    },
    update(t, dt) {
      let moving = false;
      const lit = chapter === "up" ? ups[0] : chapter === "down" ? downs[0] : null;
      const k = 1 - Math.exp(-dt * 4);
      for (const tw of towers) {
        const s = Math.max(0.001, overshoot(t, tw.delay, 0.75));
        if (tw.body.scale.y !== s) { tw.body.scale.y = s; moving = true; }
        // les fenêtres s'impriment une fois la tour montée ; le récit peint la tour du chapitre à la couleur de sa
        // séance, les autres restent en plâtre
        const m = tw.facade, ink = WINDOWS * phase(t, tw.delay + 0.55, 0.5), u = m.userData.ink;
        if (Math.abs(u.value - ink) > 0.003) { u.value += (ink - u.value) * (t < 99 ? 1 : k); moving = true; }
        const tone = lit && tw === lit ? changeColor(pal, tw.c, 1) : GLASS[pal.dark ? 0 : 1], c = m.color;
        if (Math.abs(c.r - tone.r) + Math.abs(c.g - tone.g) + Math.abs(c.b - tone.b) > 0.004) { c.lerp(tone, k); moving = true; }
        const lift = tw === hover ? 0.12 : 0;
        if (Math.abs(tw.g.position.y - lift) > 0.002) { tw.g.position.y += (lift - tw.g.position.y) * k * 2; moving = true; }
      }
      return moving;
    },
    pick: (ray) => pickFrom(ray, towers.map((t) => t.g), (id) => `${towers[id].n}${towers[id].c != null ? `, ${signed(towers[id].c)}` : ""}`,
      (id) => towers[id].n),
    setHover(id) { hover = id == null ? null : towers[id]; },
    labels() {
      const lit = chapter === "up" ? ups : chapter === "down" ? downs : [];
      return lit.map((t, i) => ({ id: t.n, text: `${t.n} ${signed(t.c)}`, tone: t.c >= 0 ? "up" : "down",
        pos: new THREE.Vector3(t.x, t.h + 0.4, t.z), opacity: i === 0 ? 1 : 0.75 }));
    },
  };
}

// --- Le globe de bureau (Marchés) --------------------------------------------------------------------------------
// Une sphère de plâtre, les terres en relief, une épingle par place boursière : sa tête est peinte à la couleur de la
// séance. L'axe est incliné comme celui de la Terre ; un méridien d'acier tient le globe.
const PLACES = {
  "^FCHI": ["Paris", 48.86, 2.35], "^GDAXI": ["Francfort", 50.11, 8.68], "^FTSE": ["Londres", 51.51, -0.13],
  "^GSPC": ["New York", 40.71, -74.0], "^N225": ["Tokyo", 35.68, 139.69], "^HSI": ["Hong Kong", 22.32, 114.17],
  "000001.SS": ["Shanghai", 31.23, 121.47],
};
function globe(data, pal, scene) {
  lights(scene, pal, { reach: 6.5, map: 1024, sun: [-5, 9, 8] });
  const root = new THREE.Group(), R = 2.15, rnd = random(7);
  root.add(disc(pal, 1.5));
  // le pied : un socle tourné en gradins, une colonne et ses bagues
  const foot = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [1.05, 0], [1.08, 0.04], [1.02, 0.1], [0.62, 0.14], [0.58, 0.2],
    [0.2, 0.24], [0, 0.24]].map(([x, y]) => new THREE.Vector2(x, y)), 96), metal(pal));
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.62, 32).translate(0, 0.55, 0), metal(pal));
  root.add(foot, column);
  for (const [y, r] of [[0.3, 0.13], [0.62, 0.1], [0.84, 0.08]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.018, 12, 48).rotateX(Math.PI / 2), metal(pal, { rough: 0.15 }));
    ring.position.y = y;
    root.add(ring);
  }
  const axis = new THREE.Group();   // l'inclinaison de la Terre
  axis.position.y = 0.86 + R + 0.3;
  axis.rotation.set(THREE.MathUtils.degToRad(16), 0, THREE.MathUtils.degToRad(-17));   // le pôle penche vers nous : l'Europe se montre
  root.add(axis);
  // le méridien gradué qui tient le globe, ses deux pivots aux pôles
  const meridian = new THREE.Group();
  meridian.add(new THREE.Mesh(new THREE.TorusGeometry(R + 0.2, 0.03, 12, 192, Math.PI * 1.25), metal(pal, { rough: 0.18 })));
  for (let d = 0; d <= 225; d += 5) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(d % 30 === 0 ? 0.11 : 0.06, 0.012, 0.012), mat(pal.ink));
    const a = THREE.MathUtils.degToRad(d);
    tick.position.set(Math.cos(a) * (R + 0.25), Math.sin(a) * (R + 0.25), 0);
    tick.rotation.z = a;
    tick.userData.noEdges = true;
    meridian.add(tick);
  }
  meridian.rotation.z = Math.PI * 0.375 + Math.PI / 2;
  axis.add(meridian);
  for (const y of [R + 0.2, -(R + 0.2)]) {
    const pivot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), metal(pal, { rough: 0.15 }));
    pivot.position.y = y;
    axis.add(pivot);
  }
  const earth = new THREE.Group();
  earth.rotation.y = -0.2;   // l'Europe face à nous, l'Amérique sur la gauche
  axis.add(earth);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), mat(pal.dark ? 0x2d5590 : 0x3a68a8));
  ball.castShadow = ball.receiveShadow = true;
  ball.userData.noEdges = true;
  earth.add(ball);
  // les parallèles et les méridiens, tracés au crayon
  const grid = [];
  for (let lat = -75; lat <= 75; lat += 15) for (let lon = 0; lon < 360; lon += 4) grid.push(onSphere(lat, lon, R * 1.002), onSphere(lat, lon + 4, R * 1.002));
  for (let lon = 0; lon < 360; lon += 15) for (let lat = -84; lat < 84; lat += 4) grid.push(onSphere(lat, lon, R * 1.002), onSphere(lat + 4, lon, R * 1.002));
  earth.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(grid),
    new THREE.LineBasicMaterial({ color: pal.ink, transparent: true, opacity: 0.25, depthWrite: false })));
  // les terres : de petites colonnes hexagonales, comme des points de broderie, un ton plus soutenu que la mer
  const spots = [], golden = Math.PI * (3 - Math.sqrt(5)), M = 9000;
  for (let k = 0; k < M; k++) {
    const y = 1 - (k + 0.5) / M * 2, r = Math.sqrt(1 - y * y), th = golden * k;
    const lat = Math.asin(y) * 180 / Math.PI, lon = ((Math.atan2(Math.sin(th) * r, Math.cos(th) * r) * 180 / Math.PI) + 540) % 360 - 180;
    if (isLand(lat, lon)) spots.push([lat, lon, 0.03 + rnd() * 0.05]);
  }
  const dot = new THREE.CylinderGeometry(0.026, 0.03, 1, 6).translate(0, 0.5, 0);
  const land = new THREE.InstancedMesh(dot, metal(pal, { color: 0xd9dee6, rough: 0.35 }), spots.length);
  land.castShadow = land.receiveShadow = true;
  const up = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const place = (k, grow) => {
    const [lat, lon, h] = spots[k];
    const p = onSphere(lat, lon, R * 0.996);
    q.setFromUnitVectors(up, p.clone().normalize());
    sc.set(1, Math.max(0.001, h * grow), 1);
    land.setMatrixAt(k, m4.compose(p, q, sc));
  };
  spots.forEach((_, k) => place(k, 0.001));
  earth.add(land);
  // les places : une épingle (aiguille d'acier, tête peinte à la couleur de la séance), haute comme le mouvement
  const markers = (data.markers || []).filter((mk) => PLACES[mk.symbol]);
  const pins = markers.map((mk, i) => {
    const [city, lat, lon] = PLACES[mk.symbol];
    const color = changeColor(pal, mk.c, 1.5), p = onSphere(lat, lon, R);
    const tall = 0.35 + Math.min(1, Math.abs(mk.c ?? 0) / 2) * 0.55;
    const pin = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, tall, 8).translate(0, tall / 2, 0), metal(pal));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), mat(color));
    head.position.y = tall;
    const base = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.085, 32).rotateX(-Math.PI / 2), mat(color));
    base.material.side = THREE.DoubleSide;
    base.position.y = 0.006;
    const grip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    grip.position.y = tall * 0.7;
    for (const m of [beam, base, grip]) m.userData.noEdges = true;
    pin.add(beam, head, base, grip);
    pin.position.copy(p);
    pin.quaternion.setFromUnitVectors(up, p.clone().normalize());
    pin.scale.setScalar(0.001);
    tag(pin, i);
    earth.add(pin);
    return { ...mk, city, pin, head, delay: 1.3 + i * 0.12 };
  });
  let hover = null, lastT = 0;
  return {
    root, view: { pos: [0.4, 7.4, 13.2], look: [0, 2.45, 0], fov: 30, aspect: 1.1 }, intro: 3,
    update(t, dt) {
      lastT = t;
      let moving = t < 3;
      if (moving) {   // les terres poussent d'ouest en est, puis les épingles se plantent
        spots.forEach((sp, k) => place(k, phase(t, 0.1 + (sp[1] + 180) / 360 * 1.1, 0.5)));
        land.instanceMatrix.needsUpdate = true;
      }
      for (const p of pins) {
        const target = overshoot(t, p.delay, 0.6) * (p === hover ? 1.3 : 1);
        const s = p.pin.scale.x;
        if (Math.abs(s - target) > 0.002) { p.pin.scale.setScalar(s + (target - s) * Math.min(1, dt * 10)); moving = true; }
      }
      return moving;
    },
    pick: (ray) => pickFrom(ray, pins.map((p) => p.pin), (id) => `${pins[id].name} (${pins[id].city}), ${signed(pins[id].c)}`,
      (id) => pins[id].name),
    setHover(id) { hover = id == null ? null : pins[id]; },
    labels() {   // Paris, toujours nommée : c'est la place de référence du site
      const p = pins.find((x) => x.symbol === "^FCHI");
      if (!p || lastT < p.delay + 0.4) return [];
      const at = root.worldToLocal(p.head.localToWorld(new THREE.Vector3(0, 0.14, 0)));
      return [{ id: "paris", text: `Paris ${signed(p.c)}`, tone: p.c >= 0 ? "up" : "down", pos: at }];
    },
  };
}

// --- Les pièces (Crypto) -----------------------------------------------------------------------------------------
// Des pièces d'acier frappées : le symbole au centre, le nom en couronne, un grènetis, la tranche cannelée. Un filet
// d'émail autour de la face dit la séance sur 24 h. La première a sa pile ; la deuxième s'y appuie.
const GLYPHS = { BTC: "₿", ETH: "Ξ", USDT: "₮", BNB: "B", SOL: "S", XRP: "X", USDC: "$", DOGE: "Ð", ADA: "₳", TRX: "T" };

function coinFace(sym, name, relief) {   // la face frappée, dessinée en blanc sur noir (gravure noircie ou relief)
  const n = 1024, c = document.createElement("canvas");
  c.width = c.height = n;
  const x = c.getContext("2d"), mid = n / 2;
  x.fillStyle = "#000";
  x.fillRect(0, 0, n, n);
  if (relief) x.filter = "blur(3px)";
  x.fillStyle = x.strokeStyle = "#fff";
  for (let k = 0; k < 120; k++) {   // le grènetis
    const a = k / 120 * Math.PI * 2;
    x.beginPath(); x.arc(mid + Math.cos(a) * n * 0.465, mid + Math.sin(a) * n * 0.465, n * 0.0055, 0, Math.PI * 2); x.fill();
  }
  x.lineWidth = n * 0.004;
  x.beginPath(); x.arc(mid, mid, n * 0.34, 0, Math.PI * 2); x.stroke();
  const ring = (text, radius, start, dir) => {   // un texte qui suit le cercle
    x.font = `700 ${n * 0.052}px "Schibsted Grotesk", "IBM Plex Sans", sans-serif`;
    const step = (n * 0.052 * 0.82) / radius;
    let a = start - dir * step * (text.length - 1) / 2;
    for (const ch of text) {
      x.save();
      x.translate(mid + Math.cos(a) * radius, mid + Math.sin(a) * radius);
      x.rotate(a + dir * Math.PI / 2);
      x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(ch, 0, 0);
      x.restore();
      a += dir * step;
    }
  };
  ring(name.toUpperCase(), n * 0.405, -Math.PI / 2, 1);
  ring(sym, n * 0.405, Math.PI / 2, -1);
  x.font = `800 ${n * 0.42}px "Schibsted Grotesk", "IBM Plex Sans", sans-serif`;
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(GLYPHS[sym] || sym.slice(0, 1), mid, mid + n * 0.025);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

const COIN_METALS = [0xe0b24f, 0xcfd4dc, 0xc98a55];   // or, argent, bronze : le rang de la pièce
function coin(pal, c, face, fine = true, tint = 0xcfd4dc) {   // face(relief) : la gravure, partagée par les pièces d'un même nom
  const g = new THREE.Group(), n = fine ? 1 : 0.5;   // les petites pièces de la pile : deux fois moins de facettes
  // le corps : un bord relevé autour d'un champ en creux (profil tourné), puis la tranche cannelée
  const profile = [[0, 0.055], [0.84, 0.055], [0.87, 0.085], [0.95, 0.092], [0.985, 0.075], [0.985, -0.075], [0.95, -0.092],
    [0.87, -0.085], [0.84, -0.055], [0, -0.055]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 160 * n), metal(pal, { rough: 0.2, color: tint }));
  const sides = 240 * n, edge = new THREE.CylinderGeometry(1, 1, 0.15, sides, 1, true);
  const pos = edge.attributes.position;
  for (let i = 0; i < pos.count; i++) {   // les cannelures : un rayon sur deux est en retrait
    const a = Math.atan2(pos.getZ(i), pos.getX(i)), r = 0.993 + 0.009 * Math.sign(Math.cos(a * sides / 2));
    pos.setXYZ(i, Math.cos(a) * r, pos.getY(i), Math.sin(a) * r);
  }
  edge.computeVertexNormals();
  const reed = new THREE.Mesh(edge, metal(pal, { rough: 0.3, color: tint }));
  reed.userData.noEdges = true;
  const glow = face(false), bump = face(true);
  const faceMat = metal(pal, { rough: 0.3, color: tint, emissiveMap: glow, glow: 0.75, bump, bumpScale: 4 });
  const front = new THREE.Mesh(new THREE.CircleGeometry(0.84, 128 * n).rotateX(-Math.PI / 2), faceMat);
  front.position.y = 0.056;
  const back = front.clone();
  back.rotation.x = Math.PI;
  back.position.y = -0.056;
  const tone = changeColor(pal, c.c, 3);
  const line = new THREE.Mesh(new THREE.TorusGeometry(0.91, 0.016, 8, 160 * n).rotateX(Math.PI / 2), mat(tone));
  line.position.y = 0.093;
  const line2 = line.clone();
  line2.position.y = -0.093;
  for (const m of [front, back, line, line2]) m.userData.noEdges = true;
  g.add(body, reed, front, back, line, line2);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

function coins(data, pal, scene) {
  lights(scene, pal, { reach: 4.4, map: 1024, sun: [-5, 10, 7] });
  const root = new THREE.Group();
  root.add(disc(pal, 2.8));
  // sans les cours (CoinGecko limite les requêtes gratuites) : les trois pièces, sans chiffres
  const list = (data.coins?.length ? data.coins : [{ sym: "BTC", name: "Bitcoin" }, { sym: "ETH", name: "Ether" },
    { sym: "SOL", name: "Solana" }]).slice(0, 3);
  const items = [];
  const faces = new Map();   // une gravure par nom, partagée (la pile : six fois la même)
  const face = (c) => (relief) => {
    const key = `${c.sym}|${relief}`;
    if (!faces.has(key)) faces.set(key, coinFace(c.sym, c.name || c.sym, relief));
    return faces.get(key);
  };
  const add = (c, id, s, pos, rot, delay) => {
    const g = coin(pal, c, face(c), s > 0.7, COIN_METALS[id] ?? COIN_METALS[1]);
    g.scale.setScalar(s);
    tag(g, id);
    root.add(g);
    items.push({ ...c, g, id, pos, rot, delay });
  };
  // la première : debout, et sa pile de six pièces à côté ; la deuxième appuyée sur la pile ; la troisième couchée
  if (list[0]) {
    add(list[0], 0, 1.25, [0.55, 1.33, -0.35], [Math.PI / 2, 0, 0.32], 0.2);
    for (let k = 0; k < 6; k++) add(list[0], 0, 0.62, [-1.1 + (k % 2) * 0.03, 0.06 + k * 0.118, 0.55 - (k % 3) * 0.02], [0, k * 0.4, 0], 0.5 + k * 0.08);
  }
  if (list[1]) add(list[1], 1, 0.9, [-1.55, 0.95, -0.55], [Math.PI / 2 - 0.35, 0.5, -0.25], 1.1);
  if (list[2]) add(list[2], 2, 0.78, [1.55, 0.075, 1.15], [0, 0.6, 0], 1.3);
  let hover = null;
  return {
    root, view: { pos: [1.4, 3.9, 9.8], look: [-0.1, 0.9, 0], fov: 30, aspect: 1.2 }, intro: 2.4,
    update(t) {
      let moving = t < 2.4;
      for (const it of items) {   // chaque pièce tombe en tournant, rebondit un peu et se pose
        const fall = 1 - phase(t, it.delay, 0.75), spin = 1 - Math.min(1, overshoot(t, it.delay, 1));
        const lift = it.id === hover ? 0.16 : 0;
        it.g.position.set(it.pos[0], it.pos[1] + fall * 4.2 + lift, it.pos[2]);
        it.g.rotation.set(it.rot[0], it.rot[1] + spin * Math.PI * 2.5, it.rot[2]);
        if (lift && Math.abs(it.g.position.y - it.pos[1] - lift) > 0.002) moving = true;
      }
      return moving;
    },
    pick: (ray) => pickFrom(ray, items.map((it) => it.g), (id) => {
      const it = items.find((x) => x.id === id);
      return [it.name, it.price, it.c != null ? `${signed(it.c)} sur 24 h` : ""].filter(Boolean).join(", ");
    }, (id) => items.find((x) => x.id === id).name),
    setHover(id) { hover = id; },
  };
}

export const MODELS = { city, globe, coins };
