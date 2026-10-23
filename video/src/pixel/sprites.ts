// Les icônes pixel art de la publicité : chaque sprite est un tableau de 24 chaînes de 24 caractères ('.' = transparent)
// et une palette {lettre: couleur}. La lumière vient d'en haut à gauche : trois tons (a clair, b moyen, c sombre), un
// contour d'un pixel (k) et, çà et là, un point de brillance (h). Les formes rondes ou obliques sont tracées par de petites
// fonctions (disque, polygone, ligne), les détails (lettres, bandeaux) sont posés à la main ; tout est calculé une fois,
// au chargement du module, et vérifié (24 × 24, chaque lettre a sa couleur).
export type Palette = Readonly<Record<string, string>>;
export type Sprite = { readonly rows: readonly string[]; readonly palette: Palette };

const N = 24;
type Grid = string[][];
const grid = (): Grid => Array.from({ length: N }, () => Array<string>(N).fill("."));
const at = (g: Grid, x: number, y: number) => (x < 0 || y < 0 || x >= N || y >= N ? "." : g[y][x]);
const put = (g: Grid, x: number, y: number, ch: string) => { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = ch; };
const rect = (g: Grid, x: number, y: number, w: number, h: number, ch: string) => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(g, i, j, ch);
};
// Une petite image posée à la main : '#' prend la lettre `ch`, ' ' et '.' laissent ce qu'il y a dessous
const stamp = (g: Grid, x: number, y: number, art: readonly string[], ch: string) =>
  art.forEach((row, j) => [...row].forEach((c, i) => { if (c === "#") put(g, x + i, y + j, ch); else if (c !== "." && c !== " ") put(g, x + i, y + j, c); }));
// Un disque (centre cx, cy ; pixels dont le centre est dans le rayon) ; fn reçoit le décalage et la distance au centre
const disc = (g: Grid, cx: number, cy: number, r: number, fn: (dx: number, dy: number, d: number) => string) => {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    if (d <= r) put(g, x, y, fn(dx, dy, d));
  }
};
const ellipse = (g: Grid, cx: number, cy: number, rx: number, ry: number, fn: (u: number, v: number, d: number) => string) => {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = Math.hypot(u, v);
    if (d <= 1) put(g, x, y, fn(u, v, d));
  }
};
const poly = (g: Grid, pts: readonly (readonly [number, number])[], ch: string) => {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const px = x + 0.5, py = y + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) put(g, x, y, ch);
  }
};
// Une ligne épaisse de `th` pixels (Bresenham)
const line = (g: Grid, x0: number, y0: number, x1: number, y1: number, ch: string, th = 1) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let s = 0; s <= n; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / (n || 1)), y = Math.round(y0 + ((y1 - y0) * s) / (n || 1));
    rect(g, x, y, th, th, ch);
  }
};
// Le contour d'un pixel, posé autour de la forme
const halo = (g: Grid, ch = "k") => {
  const add: [number, number][] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y][x] !== ".") continue;
    if (at(g, x - 1, y) !== "." || at(g, x + 1, y) !== "." || at(g, x, y - 1) !== "." || at(g, x, y + 1) !== ".") add.push([x, y]);
  }
  add.forEach(([x, y]) => put(g, x, y, ch));
};
// Le biseau : les pixels `fill` au bord haut ou gauche de la forme passent à `lit`, ceux du bord bas ou droit à `shade`
const bevel = (g: Grid, fill: string, lit: string, shade: string) => {
  const out: [number, number, string][] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y][x] !== fill) continue;
    if (at(g, x - 1, y) === "." || at(g, x, y - 1) === ".") out.push([x, y, lit]);
    else if (at(g, x + 1, y) === "." || at(g, x, y + 1) === ".") out.push([x, y, shade]);
  }
  out.forEach(([x, y, c]) => put(g, x, y, c));
};
const finish = (g: Grid, palette: Palette, name: string): Sprite => {
  const rows = g.map((r) => r.join(""));
  if (rows.length !== N || rows.some((r) => r.length !== N)) throw new Error(`sprite ${name} : pas 24 × 24`);
  for (const r of rows) for (const c of r) if (c !== "." && !(c in palette)) throw new Error(`sprite ${name} : pas de couleur pour « ${c} »`);
  return { rows, palette };
};

// --- Les pièces : un disque, une jante éclairée en haut à gauche, une gravure --------------------------------------------------
const coin = (glyph: readonly string[], gx: number, gy: number, engrave: string, palette: Palette, name: string): Sprite => {
  const g = grid();
  disc(g, 12, 12, 9.5, (dx, dy, d) => {
    const s = dx + dy;
    if (d > 8.4) return s < 0 ? "a" : "b";
    if (d > 7.4) return s < 0 ? "c" : "a";  // la gorge : sombre côté lumière, claire de l'autre
    if (s > 9) return "c";
    return s < -8 ? "a" : "b";
  });
  [[7, 6], [8, 6], [7, 7]].forEach(([x, y]) => put(g, x, y, "h"));
  halo(g);
  stamp(g, gx + 1, gy + 1, glyph, "a");
  stamp(g, gx, gy, glyph, engrave);
  return finish(g, palette, name);
};
const EURO = ["..####..", ".##..##.", "##......", "######..", "##......", "######..", "##......", ".##..##.", "..####.."];
const BTC = ["..#.#...", ".######.", ".##..##.", ".##..##.", ".#####..", ".##..##.", ".##..##.", ".######.", "..#.#..."];
const GOLD = { k: "#5B3A0B", c: "#C27C0E", b: "#F5B81C", a: "#FFDC55", h: "#FFF6C4" };
const COIN_EUR = coin(EURO, 8, 8, "c", GOLD, "pièce");
const COIN_BTC = coin(BTC, 8, 7, "w", { k: "#7A3300", c: "#E36A00", b: "#FF9A1F", a: "#FFC04D", h: "#FFF0C2", w: "#FFFFFF" }, "bitcoin");
// la pièce d'or du mot « finveille » : même dessin, gravure sombre (le tracé de la lettre, plus lisible en grand)

// --- Le graphique en hausse : une carte, quatre barres bleues, une flèche verte -----------------------------------------------
const chart = (): Sprite => {
  const g = grid();
  rect(g, 2, 3, 20, 18, "w");
  bevel(g, "w", "w", "d");
  [[5, 3], [9, 5], [13, 8], [17, 11]].forEach(([x, h]) => {
    rect(g, x, 18 - h, 1, h, "q"); rect(g, x + 1, 18 - h, 1, h, "p"); rect(g, x + 2, 18 - h, 1, h, "r");
  });
  rect(g, 3, 18, 18, 1, "x");
  halo(g);
  const pts: [number, number][] = [[4, 13], [8, 9], [11, 11], [17, 6]];
  for (let i = 0; i < pts.length - 1; i++) line(g, pts[i][0], pts[i][1] + 1, pts[i + 1][0], pts[i + 1][1] + 1, "G", 2);
  for (let i = 0; i < pts.length - 1; i++) line(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], "g", 2);
  poly(g, [[14, 2], [20, 2], [20, 8]], "g");
  rect(g, 20, 3, 1, 6, "G");
  put(g, 15, 2, "l"); put(g, 16, 2, "l"); put(g, 17, 2, "l");
  return finish(g, { k: "#1C2340", w: "#F3F5FB", d: "#CDD3E6", x: "#B6BDD6", side: "#8F98BE", q: "#8FB0FF", p: "#3B6CFF", r: "#1E3FAA", g: "#22C55E", G: "#14803C", l: "#B5F5C9" }, "graphique");
};

// --- La cloche : un profil (bord gauche de chaque ligne), rempli en miroir, éclairé par la gauche -------------------------------
const bellLeft = [8, 7, 8, 6, 4, 3, 3, 3, 3, 3, 3, 2, 2, 1, 1, 0, 0];  // lignes 0 → 16 : le pommeau, le dôme, les flancs, l'évasement, le bord
const bell = (): Sprite => {
  const g = grid();
  bellLeft.forEach((l, y) => {
    for (let x = l; x <= 19 - l; x++) {
      const t = (x - l) / (19 - 2 * l);
      let c = t < 0.25 ? "a" : t < 0.65 ? "b" : "c";
      if (y <= 2) c = x - l < 1 ? "a" : x - l < 3 ? "b" : "c";  // le pommeau, plus petit
      if (y === 15) c = "c";  // le bord : une ligne d'ombre sous l'évasement
      put(g, x + 2, y + 1, c);
    }
  });
  for (let y = 5; y <= 12; y++) put(g, bellLeft[y] + 4, y + 1, "h");
  disc(g, 12, 20.4, 2.3, (dx, dy) => (dx + dy < -0.5 ? "a" : dx + dy > 1.2 ? "c" : "b"));
  halo(g);
  return finish(g, { k: "#5B3A0B", c: "#C27C0E", b: "#F5B81C", a: "#FFE27A", h: "#FFF6C4" }, "cloche");
};
// La cloche des plans sombres : bleu lumineux (le dégradé de la marque, presque blanc au cœur) ou blanc-bleuté
export const BELL_BLUE: Palette = { k: "#1B3FC2", c: "#2451DE", b: "#6D93FF", a: "#B9CCFF", h: "#F4F7FF" };
export const BELL_WHITE: Palette = { k: "#2451DE", c: "#6D93FF", b: "#BCD0FF", a: "#EAF1FF", h: "#FFFFFF" };

// --- Le journal plié : deux pages, un pli, un bandeau, une photo, des colonnes ------------------------------------------------
const news = (): Sprite => {
  const g = grid();
  rect(g, 2, 4, 20, 17, "w");
  rect(g, 12, 4, 10, 17, "d");
  rect(g, 11, 4, 1, 17, "c");
  rect(g, 4, 6, 16, 3, "n");
  [7, 9, 13, 15, 17].forEach((x) => put(g, x, 7, "w"));
  rect(g, 4, 10, 6, 6, "i"); rect(g, 4, 10, 6, 1, "j"); rect(g, 9, 11, 1, 5, "m"); rect(g, 4, 15, 6, 1, "m");
  put(g, 6, 12, "j"); put(g, 7, 12, "j");
  rect(g, 4, 17, 6, 1, "l"); rect(g, 4, 19, 4, 1, "l");
  [10, 12, 14, 16, 18].forEach((y, i) => rect(g, 13, y, i === 4 ? 4 : 7, 1, "l"));
  halo(g);
  return finish(g, { k: "#2B2420", w: "#F7F4EA", d: "#E2DDCD", c: "#B5AE9A", n: "#2B2F45", i: "#7D93B8", j: "#B7C6DF", m: "#5F7396", l: "#9C9788" }, "journal");
};

// --- Le téléphone : cadre sombre, écran dégradé bleu avec un mini graphique ----------------------------------------------------
const phone = (): Sprite => {
  const g = grid();
  rect(g, 7, 1, 10, 22, "b");
  rect(g, 7, 1, 1, 22, "a"); rect(g, 7, 1, 10, 1, "a"); rect(g, 16, 2, 1, 21, "c"); rect(g, 8, 22, 9, 1, "c");
  for (let y = 4; y <= 19; y++) rect(g, 8, y, 8, 1, y < 9 ? "s" : y < 14 ? "t" : "u");
  halo(g);
  rect(g, 11, 2, 2, 1, "k");
  rect(g, 9, 5, 4, 1, "w"); rect(g, 9, 7, 6, 2, "w");
  [[9, 16], [10, 15], [11, 15], [12, 13], [13, 14], [14, 12]].forEach(([x, y]) => put(g, x, y, "g"));
  rect(g, 10, 18, 4, 1, "w");
  return finish(g, { k: "#161A28", a: "#7580A0", b: "#363D55", c: "#232838", s: "#7CC4FF", t: "#4A8DFF", u: "#2D5BE0", w: "#FFFFFF", g: "#5DF29A" }, "téléphone");
};

// --- L'ordinateur portable : écran bleu avec un graphique, base argentée ----------------------------------------------------------
const laptop = (): Sprite => {
  const g = grid();
  rect(g, 3, 3, 18, 12, "f");
  rect(g, 3, 3, 18, 1, "e"); rect(g, 3, 3, 1, 12, "e");
  for (let y = 5; y <= 12; y++) rect(g, 5, y, 14, 1, y < 8 ? "s" : y < 11 ? "t" : "u");
  rect(g, 2, 15, 20, 1, "a"); rect(g, 1, 16, 22, 1, "b"); rect(g, 1, 17, 22, 2, "c");
  halo(g);
  rect(g, 10, 15, 4, 1, "c");
  [6, 8, 10, 12].forEach((x, i) => rect(g, x, 12 - 1 - i, 2, i + 1, "q"));
  [[7, 10], [9, 8], [11, 9], [13, 7], [15, 6], [16, 6]].forEach(([x, y]) => put(g, x, y, "g"));
  return finish(g, { k: "#161A28", f: "#323950", e: "#6A7392", s: "#8CC9FF", t: "#4F90FF", u: "#2C59DE", a: "#F1F3FA", b: "#C9CFE0", c: "#9AA3BD", q: "#BFD6FF", g: "#5DF29A" }, "ordinateur");
};

// --- Le globe : un disque océan, des continents, une brillance --------------------------------------------------------------------
const LAND = [
  "........................", "........................", "........................",
  ".......LLLL.....LLL.....", "......LLLLLL..LLLLLL....", ".....LLLLLLL..LLLLLLL...",
  "....LLLLLLL....LLLLLL...", "....LLLLLL....LLLLLLLL..", "....LLLLL.....LLLLLLLL..",
  "....LLLLL.....LLLLLLLLL.", ".....LLLL....LLLLLLLLLL.", "......LLL...LLLLLLLLLLL.",
  "......LLL...LLLLLLLLLLL.", ".......LLL...LLLLLLLLL..", ".......LLLL...LLLLLLLL..",
  "........LLLL...LLLLLL...", ".........LLL....LLLL....", ".........LLL....LLL.....",
  "..........LL.....LL......", "........................", "........................", "........................",
  "........................", "........................",
];
const globe = (): Sprite => {
  const g = grid();
  disc(g, 12, 12, 9.5, (dx, dy) => {
    const s = dx + dy;
    const land = LAND[Math.floor(dy + 12)][Math.floor(dx + 12)] === "L";
    if (land) return s < -4 ? "l" : s < 5 ? "g" : "G";
    return s < -7 ? "a" : s < 4 ? "b" : "c";
  });
  [[6, 5], [7, 5], [6, 6]].forEach(([x, y]) => put(g, x, y, "h"));
  halo(g);
  return finish(g, { k: "#10306E", a: "#8ED3FF", b: "#3B93FF", c: "#2159D6", l: "#8BE07A", g: "#43B85A", G: "#2A8040", h: "#F4FBFF" }, "globe");
};

// --- Le billet de banque vert : un liseré, un médaillon avec un « € », des coins -------------------------------------------------
const bill = (): Sprite => {
  const g = grid();
  rect(g, 1, 6, 22, 12, "b");
  rect(g, 1, 6, 22, 1, "a"); rect(g, 1, 17, 22, 1, "c");
  rect(g, 3, 8, 18, 8, "b");
  rect(g, 3, 8, 18, 1, "a"); rect(g, 3, 15, 18, 1, "a"); rect(g, 3, 8, 1, 8, "a"); rect(g, 20, 8, 1, 8, "a");
  rect(g, 4, 9, 16, 6, "b");
  disc(g, 12, 12, 3.6, (dx, dy) => (dx + dy < -1 ? "h" : "a"));
  halo(g);
  stamp(g, 10, 10, [".###.", "#....", "###..", "#....", ".###."], "c");
  [[5, 10], [18, 10], [5, 13], [18, 13]].forEach(([x, y]) => rect(g, x, y, 1, 1, "a"));
  return finish(g, { k: "#12502A", a: "#8DE3A6", b: "#3DAE5C", c: "#237A3E", h: "#D5F8DF" }, "billet");
};

// --- La tirelire rose : un corps ovale, un groin, une oreille, quatre pattes, la pièce qui tombe -----------------------------------
const piggy = (): Sprite => {
  const g = grid();
  rect(g, 4, 18, 3, 4, "c"); rect(g, 13, 18, 3, 4, "c"); rect(g, 5, 18, 1, 4, "b"); rect(g, 14, 18, 1, 4, "b");
  poly(g, [[13, 4], [17, 5], [16, 9]], "c");
  poly(g, [[13.5, 5.5], [16, 6], [15.5, 8]], "b");
  ellipse(g, 10.5, 13, 8.5, 6.5, (u, v) => { const s = u + v; return s < -0.75 ? "a" : s < 0.5 ? "b" : "c"; });
  ellipse(g, 19.5, 13.5, 2.5, 3, (u, v) => (u + v < 0 ? "a" : "b"));
  halo(g);
  [[5, 8], [6, 8], [5, 9]].forEach(([x, y]) => put(g, x, y, "h"));
  rect(g, 8, 7, 5, 1, "k");
  put(g, 15, 11, "k"); put(g, 20, 12, "k"); put(g, 20, 15, "k");
  put(g, 1, 11, "c"); put(g, 1, 12, "c"); put(g, 1, 13, "c");
  disc(g, 10.5, 3.2, 2.4, (dx, dy) => (dx + dy < -0.6 ? "y" : "z"));
  halo(g, "k");
  return finish(g, { k: "#6B1B3C", a: "#FFC2D9", b: "#FF8DB5", c: "#E0588F", h: "#FFEAF2", y: "#FFE066", z: "#E0A512" }, "tirelire");
};

// --- La loupe : une monture d'acier, un verre pâle avec un reflet, un manche en bois ------------------------------------------------
const magnifier = (): Sprite => {
  const g = grid();
  disc(g, 9.5, 9.5, 8, (dx, dy, d) => {
    const s = dx + dy;
    if (d > 5.6) return s < -2 ? "a" : s < 4 ? "b" : "c";
    return s > 3 ? "v" : "g";
  });
  [[6, 5], [7, 4], [5, 6], [6, 4], [5, 5]].forEach(([x, y]) => put(g, x, y, "h"));
  for (let t = 0; t < 7; t++) {
    put(g, 15 + t, 15 + t, "w"); put(g, 16 + t, 15 + t, "y"); put(g, 15 + t, 16 + t, "x");
    put(g, 16 + t, 16 + t, "y"); put(g, 14 + t, 15 + t, "x");
  }
  poly(g, [[13.5, 14], [16.5, 14], [16.5, 17], [14, 17]], "q");
  halo(g);
  return finish(g, { k: "#1B2236", a: "#EEF1FA", b: "#B3BCD6", c: "#6E7899", g: "#C7ECFF", v: "#9ED3F5", h: "#FFFFFF", w: "#B5651D", x: "#E7A45C", y: "#7A3E0E", q: "#D3D9EA" }, "loupe");
};

// --- L'éclair jaune : un polygone biseauté -----------------------------------------------------------------------------------------
const bolt = (): Sprite => {
  const g = grid();
  poly(g, [[14, 1], [5, 13.5], [11, 13.5], [8.5, 23], [19, 9.5], [13, 9.5], [18, 1]], "b");
  bevel(g, "b", "a", "c");
  [[13, 3], [12, 4], [11, 5]].forEach(([x, y]) => put(g, x, y, "h"));
  halo(g);
  return finish(g, { k: "#8A4B00", a: "#FFF08A", b: "#FFD21F", c: "#F28C0C", h: "#FFFFFF" }, "éclair");
};

// --- La tasse de café : une tasse blanche, un café brun, une anse, une soucoupe, deux volutes de vapeur ----------------------------
const cup = (): Sprite => {
  const g = grid();
  ellipse(g, 10.5, 20, 9, 2, (u, v) => (v > 0.2 ? "c" : u < -0.3 ? "a" : "b"));
  for (let y = 9; y <= 18; y++) {
    const l = 5 + Math.floor(Math.max(0, y - 11) / 3), r = 16 - Math.floor(Math.max(0, y - 11) / 3);
    for (let x = l; x <= r; x++) put(g, x, y, "b");
  }
  disc(g, 17.5, 13, 3.4, (dx, dy, d) => (d > 1.7 ? (dx + dy < 0 ? "a" : "c") : "."));
  for (let y = 9; y <= 18; y++) for (let x = 0; x < N; x++) if (g[y][x] === "b") {
    if (at(g, x - 1, y) === "." || at(g, x - 2, y) === "." || at(g, x, y - 1) === ".") g[y][x] = "a";
    else if (at(g, x + 1, y) === "." || at(g, x + 2, y) === "." || at(g, x, y + 1) === ".") g[y][x] = "c";
  }
  ellipse(g, 10.5, 9.3, 6.4, 2.3, () => "a");
  ellipse(g, 10.5, 9.5, 5.2, 1.6, (u) => (u < -0.35 ? "p" : "o"));
  halo(g);
  [[8, 7], [9, 6], [9, 5], [8, 4], [8, 3], [9, 2], [12, 6], [13, 5], [13, 4], [12, 3], [12, 2], [13, 1]].forEach(([x, y]) => put(g, x, y, "m"));
  return finish(g, { k: "#3B2A24", a: "#FFFFFF", b: "#E4E8F4", c: "#A9B1CC", o: "#4F2D12", p: "#8B5A2B", m: "#C4CAE0" }, "tasse");
};

// --- Les bougies de bourse : une rouge qui descend, deux vertes qui montent, avec leurs mèches ----------------------------------
const candles = (): Sprite => {
  const g = grid();
  const body = (x: number, y: number, h: number, a: string, b: string, c: string) => {
    rect(g, x, y, 1, h, a); rect(g, x + 1, y, 1, h, b); rect(g, x + 2, y, 1, h, b); rect(g, x + 3, y, 1, h, c);
  };
  body(2, 10, 8, "r", "s", "t"); body(9, 7, 9, "f", "g", "j"); body(16, 3, 10, "f", "g", "j");
  halo(g);
  rect(g, 4, 7, 1, 14, "k"); rect(g, 11, 4, 1, 15, "k"); rect(g, 18, 1, 1, 15, "k");
  put(g, 3, 11, "h"); put(g, 10, 8, "h"); put(g, 17, 4, "h");
  return finish(g, { k: "#1B1F33", side: "#6A7396", r: "#FF8A8A", s: "#F0384A", t: "#B3182E", f: "#8CF0B6", g: "#22C55E", j: "#12803F", h: "#FFFFFF" }, "bougie");
};

// --- Le calendrier : un en-tête rouge, deux anneaux, une grille de jours dont un orange -----------------------------------------
const calendar = (): Sprite => {
  const g = grid();
  rect(g, 2, 4, 20, 18, "w");
  rect(g, 21, 9, 1, 13, "d"); rect(g, 2, 21, 20, 1, "d");
  rect(g, 2, 4, 20, 5, "r"); rect(g, 2, 4, 20, 1, "q"); rect(g, 2, 8, 20, 1, "R");
  rect(g, 6, 2, 2, 4, "m"); rect(g, 16, 2, 2, 4, "m"); rect(g, 6, 2, 1, 4, "n"); rect(g, 16, 2, 1, 4, "n");
  halo(g);
  [11, 14, 17].forEach((y) => [4, 8, 12, 16].forEach((x) => rect(g, x, y, 3, 2, "x")));
  rect(g, 12, 14, 3, 2, "y"); rect(g, 12, 14, 3, 1, "z");
  return finish(g, { k: "#3A2026", w: "#FFFFFF", d: "#D8DDEE", r: "#E5484D", q: "#FF8A8E", R: "#B3262C", m: "#6B7186", n: "#C8CDE0", side: "#A9B0CB", x: "#8E96B2", y: "#FFB020", z: "#FFD66B" }, "calendrier");
};

export const SPRITES = {
  piece: COIN_EUR, bitcoin: COIN_BTC, graphique: chart(), cloche: bell(), journal: news(), telephone: phone(), ordinateur: laptop(),
  globe: globe(), billet: bill(), tirelire: piggy(), loupe: magnifier(), eclair: bolt(), tasse: cup(), bougie: candles(), calendrier: calendar(),
} as const;
export type SpriteName = keyof typeof SPRITES;
export const SPRITE_NAMES = Object.keys(SPRITES) as SpriteName[];
