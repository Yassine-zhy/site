// La bande-annonce de FinVeille v2 (étape 34), en motion design avec Remotion.
// Le plan de montage fait foi : 120 BPM, 30 im/s, 15 im par temps, 60 par mesure, 34 mesures = 2 040 images.
// Un seul langage de mouvement : arrivée cubic-bezier(0.16,1,0.3,1), sortie cubic-bezier(0.7,0,0.84,0), aucun dépassement.
// La signature : la ligne de cours, qui se dessine, traverse les cartons et se replie en logo (P3 et P21).
import { Audio, Video } from "@remotion/media";
import { loadFont } from "@remotion/fonts";
import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  continueRender,
  delayRender,
  getStaticFiles,
  interpolate,
  interpolateColors,
  random,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Les polices de la marque, embarquées (public/fonts) : le rendu n'a pas besoin d'Internet
const display = "Schibsted Grotesk", sans = "IBM Plex Sans";
loadFont({ family: display, url: staticFile("fonts/SchibstedGrotesk.woff2"), weight: "400 900" });
loadFont({ family: sans, url: staticFile("fonts/IBMPlexSans.woff2"), weight: "100 700" });

export const COLORS = {
  night: "#060912", ink: "#E8EDF6", muted: "#96A2B9", line: "#24304A", brand: "#6D93FF", violet: "#9B7BFF",
  up: "#34D17F", down: "#FF6375", green: "#6ee7a8",
};

// --- La table des plans (images absolues ; [début, fin[) ---------------------------------------------------------------
export const TOTAL = 2040;
export const FRAMES = {
  p1: [0, 120], p2: [120, 240], p3: [240, 360],
  p4: [360, 480], p5: [480, 540], p6: [540, 600], p7: [600, 660], p8: [660, 720],
  p9: [720, 840], p10: [840, 900], p11: [900, 960], p12: [960, 1020], p13: [1020, 1080],
  p14: [1080, 1200], p15: [1200, 1440], p16: [1440, 1560],
  p17: [1560, 1620], p18: [1620, 1680], p19: [1680, 1740], p20: [1740, 1800], p21: [1800, 2040],
} as const;

type Section = { readonly text: string; readonly lift: number; readonly exit: number; readonly caption: number };
type Shot = {
  readonly id: string; readonly name: string; readonly from: number; readonly to: number;
  readonly trim: number;  // images de la séquence d'origine à sauter : le passage choisi pour la durée du plan
  readonly caption: string; readonly section?: Section;
};
// Titre de section : la fenêtre s'éclaire à `lift`, le titre sort à `exit`, la légende entre à `caption` (images du plan)
const SEC = { lift: 60, exit: 40, caption: 52 };
const SEC_SHORT = { lift: 46, exit: 27, caption: 38 };  // P17 ne dure que 60 images
export const FOOTAGE: readonly Shot[] = [
  { id: "P4", name: "story", from: 360, to: 480, trim: 10, caption: "La séance, racontée en 3D", section: { text: "S'informer", ...SEC } },
  { id: "P5", name: "feed", from: 480, to: 540, trim: 56, caption: "Toutes les dépêches, triées par sujet" },
  { id: "P6", name: "search", from: 540, to: 600, trim: 22, caption: "Une recherche qui parle Bourse" },
  { id: "P7", name: "brief", from: 600, to: 660, trim: 20, caption: "Le brief du matin" },
  { id: "P8", name: "ai", from: 660, to: 720, trim: 0, caption: "Un assistant qui cite ses sources" },
  { id: "P9", name: "globe", from: 720, to: 840, trim: 30, caption: "Un clic sur une place, et son cours", section: { text: "Comprendre les marchés", ...SEC } },
  { id: "P10", name: "heatmap", from: 840, to: 900, trim: 25, caption: "Les 40 valeurs, d'un coup d'œil" },
  { id: "P11", name: "economy", from: 900, to: 960, trim: 30, caption: "Taux, inflation, banques centrales" },
  { id: "P12", name: "crypto", from: 960, to: 1020, trim: 6, caption: "Et les cryptomonnaies" },
  { id: "P13", name: "compare", from: 1020, to: 1080, trim: 20, caption: "Deux valeurs face à face" },
  { id: "P17", name: "portfolio", from: 1560, to: 1620, trim: 0, caption: "Un portefeuille pour t'entraîner", section: { text: "Tes outils", ...SEC_SHORT } },
  { id: "P18", name: "alerts", from: 1620, to: 1680, trim: 10, caption: "Des alertes de cours" },
  { id: "P19", name: "simulators", from: 1680, to: 1740, trim: 20, caption: "Des simulateurs pour décider" },
];
// P20 : l'écran partagé (thème clair à gauche, téléphone à droite)
export const SPLIT = { light: { trim: 20 }, mobile: { trim: 30 }, caption: "Sur ordinateur et sur téléphone, en clair ou en sombre" };

// P15 : la galerie, un temps (15 im) par maquette ; chacune commence vers l'image 20 de son fichier
const MODELS: readonly (readonly [string, string])[] = [
  ["city", "L'accueil"], ["globe", "Marchés"], ["coins", "Crypto"], ["orb", "Assistant IA"], ["paper", "Le brief"],
  ["bars", "En chiffres"], ["ridges", "Économie"], ["bell", "Alertes"], ["ring", "Portefeuille"], ["stairs", "Simulateurs"],
  ["lens", "Mes suivis"], ["duel", "Comparer"], ["books", "Glossaire"], ["bookmark", "Favoris"], ["gear", "Réglages"],
  ["logo", "À propos"],
];
const MODEL_TRIM = 20;
const GRID_MODELS = [...MODELS.map((m) => m[0]), "quiz"];  // P16 : les 17 maquettes

// --- Le sonore : fichiers de public/sfx, placés aux images du plan -------------------------------------------------------
const VOL = { music: 0.9, whoosh: 0.45, impact: 0.8, click: 0.6, bell: 0.5, keys: 0.3, tick: 0.22 };
const WHOOSH = [225, 705, 1185, 1545, 1785];  // 15 images avant chaque changement de section : le sommet tombe sur la coupe
const IMPACT = [240, 1200, 1800];
const KEYS = { from: 543, count: 4, every: 4 };  // « Sanofi » se tape dans P6 : les 4 dernières lettres (image 25 de la séquence, trim 22)
const TICKS = MODELS.map((_, i) => 1200 + i * 15);  // un tic par maquette du drop
const CLICKS = [{ name: "globe", from: 720, trim: 30, bell: false }, { name: "alerts", from: 1620, trim: 10, bell: true }];  // mêmes trim que FOOTAGE

// --- Outils : mouvement, fichiers, JSON ------------------------------------------------------------------------------------
const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const OUT = Easing.bezier(0.16, 1, 0.3, 1);  // arrivée
const IN = Easing.bezier(0.7, 0, 0.84, 0);  // sortie
const CAM = Easing.bezier(0.65, 0, 0.35, 1);  // le seul mouvement de caméra d'un plan
const ramp = (frame: number, a: number, b: number, to: readonly [number, number] = [0, 1], easing: (t: number) => number = OUT) =>
  interpolate(frame, [a, b > a ? b : a + 1], [to[0], to[1]], { ...clampOpts, easing });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Les fichiers présents dans public/ (lus au rendu) : un fichier qui manque donne une doublure ou pas de son, jamais un plantage
let staticNames: Set<string> | null = null;
const has = (path: string) => {
  if (!staticNames) staticNames = new Set(getStaticFiles().map((f) => f.name));
  return staticNames.has(path);
};

const jsonCache = new Map<string, unknown>();
const useJson = <T,>(path: string | undefined): T | null => {
  const wanted = path !== undefined && has(path);
  const [data, setData] = useState<T | null>(() => (wanted && jsonCache.has(path) ? (jsonCache.get(path) as T) : null));
  const [handle] = useState(() => (wanted && !jsonCache.has(path) ? delayRender(`json ${path}`) : null));
  useEffect(() => {
    if (handle === null || path === undefined) return;
    fetch(staticFile(path))
      .then((r) => r.json())
      .then((d) => {
        jsonCache.set(path, d);
        setData(d as T);
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  }, [handle, path]);
  return data;
};

// --- 1. Le fond : la nuit, un quadrillage discret, une lueur bleue lente (texture, jamais en concurrence) ------------
export const Backdrop: React.FC<{ readonly level?: number }> = ({ level = 1 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.night, overflow: "hidden" }}>
      <AbsoluteFill style={{ opacity: level }}>
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${COLORS.line}44 1px, transparent 1px), linear-gradient(90deg, ${COLORS.line}44 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(60% 65% at 50% 48%, #000, transparent 85%)",
          }}
        />
        <AbsoluteFill
          style={{
            background: `radial-gradient(1000px 640px at ${56 + Math.sin(frame / 140) * 10}% ${42 + Math.cos(frame / 170) * 8}%, ${COLORS.brand}26, transparent 70%)`,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
// Le fond s'allume sur la première seconde et se retire sur le carton de la montée (P14)
const backdropLevel = (f: number) =>
  f >= 1200 ? 1 : ramp(f, 20, 90) * (f < 1080 ? 1 : ramp(f, 1082, 1104, [1, 0.35]) * ramp(f, 1184, 1192, [1, 0], IN));

// --- 4. Le texte qui monte, mot à mot, derrière un cache ----------------------------------------------------------------
const Words: React.FC<{
  readonly text: string;  // « \n » coupe la ligne
  readonly start?: number; readonly size: number; readonly color?: string; readonly font?: string; readonly weight?: number;
  readonly gap?: number; readonly align?: "left" | "center"; readonly exitAt?: number; readonly tracking?: string;
}> = ({ text, start = 0, size, color = COLORS.ink, font = display, weight = 800, gap = 7, align = "left", exitAt, tracking = "-0.03em" }) => {
  const frame = useCurrentFrame();
  let k = 0;
  return (
    <div style={{ fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1.06, letterSpacing: tracking, color }}>
      {text.split("\n").map((line, li) => (
        <div key={li} style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", columnGap: "0.26em" }}>
          {line.split(" ").map((word, wi) => {
            const i = k++;
            const up = ramp(frame, start + i * gap, start + i * gap + 10);
            const down = exitAt === undefined ? 0 : ramp(frame, exitAt + i * 2, exitAt + i * 2 + 10, [0, 1], IN);
            return (
              <span key={wi} style={{ display: "inline-block", overflow: "hidden", paddingTop: "0.08em", marginTop: "-0.08em", paddingBottom: "0.16em", marginBottom: "-0.16em" }}>
                <span style={{ display: "inline-block", translate: `0 ${(1 - up) * 110 - down * 110}%` }}>{word}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// --- 7. La légende : en bas à gauche, entre en 7 im, sort 8 im avant la coupe -------------------------------------------
const Caption: React.FC<{ readonly text: string; readonly from?: number; readonly enter?: number; readonly leave?: number }> = ({
  text, from = 0, enter = 7, leave = 8,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const inT = ramp(frame, from, from + enter);
  const outT = leave > 0 ? ramp(frame, durationInFrames - leave - 6, durationInFrames - leave, [0, 1], IN) : 0;
  return (
    <div
      style={{
        position: "absolute", left: 210, top: 980, fontFamily: sans, fontWeight: 500, fontSize: 34, lineHeight: 1.2, color: COLORS.ink,
        opacity: inT * (1 - outT), translate: `0 ${(1 - inT) * 16 - outT * 12}px`, textShadow: "0 2px 18px #060912",
      }}
    >
      {text}
    </div>
  );
};

// --- 8. Le titre de section, en surimpression au début du premier plan de la section ------------------------------------
const SectionTitle: React.FC<{ readonly text: string; readonly exit: number }> = ({ text, exit }) => (
  <div style={{ position: "absolute", left: 210, top: 0, width: 1500, height: 1080, display: "flex", alignItems: "center" }}>
    <div style={{ textShadow: `0 0 60px ${COLORS.night}, 0 0 20px ${COLORS.night}99` }}>
      <Words text={text.replace(" les ", "\nles ")} start={4} size={150} exitAt={exit} />
    </div>
  </div>
);

// --- 2. La ligne de cours : la signature ----------------------------------------------------------------------------------
type Pt = { readonly x: number; readonly y: number };
const N_PTS = 24;
// Marche aléatoire déterministe qui traverse le cadre (la tendance monte, comme la ligne du logo)
const walk = (seed: string, y0: number, amp: number): Pt[] => {
  let acc = 0;
  const raw: number[] = [];
  for (let i = 0; i < N_PTS; i++) {
    acc += (random(`${seed}-${i}`) - 0.4) * 2;
    raw.push(acc);
  }
  const lo = Math.min(...raw), hi = Math.max(...raw);
  return raw.map((v, i) => ({ x: -20 + (i * 1960) / (N_PTS - 1), y: y0 - amp * ((2 * (v - lo)) / (hi - lo) - 1) }));
};
const HERO_LINE = walk("finveille-cours", 700, 110);  // P1 à P3, et P20 à P21
const CARTON_LINE = walk("finveille-roulement", 820, 80);  // P14

// La ligne de cours du logo (viewBox 64 × 64), rééchantillonnée en 24 points le long de son tracé ; les deux coins sont gardés
const LOGO_LINE: readonly Pt[] = [{ x: 25.5, y: 38.5 }, { x: 32, y: 33.2 }, { x: 38, y: 36.2 }, { x: 46, y: 28.5 }];
const resample = (pts: readonly Pt[], n: number): Pt[] => {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  const total = seg.reduce((a, b) => a + b, 0);
  const out: Pt[] = [];
  for (let k = 0; k < n; k++) {
    let d = (total * k) / (n - 1), s = 0;
    while (s < seg.length - 1 && d > seg[s]) {
      d -= seg[s];
      s++;
    }
    const t = Math.min(1, d / seg[s]);
    out.push({ x: lerp(pts[s].x, pts[s + 1].x, t), y: lerp(pts[s].y, pts[s + 1].y, t) });
  }
  for (const corner of pts.slice(1, -1)) {
    let best = 1;
    for (let k = 1; k < n - 1; k++) {
      if (Math.hypot(out[k].x - corner.x, out[k].y - corner.y) < Math.hypot(out[best].x - corner.x, out[best].y - corner.y)) best = k;
    }
    out[best] = corner;
  }
  return out;
};
const LOGO_PTS = resample(LOGO_LINE, N_PTS);

const PriceLine: React.FC<{
  readonly points: readonly Pt[];
  readonly draw?: readonly [number, number];  // images où le trait se dessine (par défaut : déjà dessiné)
  readonly fold?: number;  // 0 → 1 : chaque point rejoint la ligne du logo
  readonly foldTo?: readonly Pt[];  // les 24 points du logo, déjà placés à l'écran
  readonly foldWidth?: number;
  readonly width?: number; readonly glow?: number; readonly opacity?: number;
}> = ({ points, draw = [-100, -50], fold = 0, foldTo, foldWidth = 5.5, width = 3, glow = 1, opacity = 1 }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, draw[0], draw[1], [0, 1], CAM);
  const cur = points.map((pt, i) => (foldTo ? { x: lerp(pt.x, foldTo[i].x, fold), y: lerp(pt.y, foldTo[i].y, fold) } : pt));
  const d = cur.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");
  const stroke = interpolateColors(fold, [0, 1], [COLORS.brand, "#ffffff"]);
  const blur = (6 + 10 * glow) * (1 - fold);
  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible", opacity }}>
      <g style={{ filter: blur > 0.5 ? `drop-shadow(0 0 ${blur}px rgba(109,147,255,0.85))` : undefined }}>
        <path
          d={d} pathLength={1} fill="none" stroke={stroke} strokeWidth={lerp(width, foldWidth, fold)} strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="1 1" strokeDashoffset={1 - p} opacity={p > 0.001 ? 1 : 0}
        />
      </g>
      {cur.map((pt, i) => {
        if (i % 3 !== 1) return null;  // une lueur sur un point sur trois
        const a = Math.min(1, Math.max(0, (p - i / (N_PTS - 1)) / 0.07)) * (1 - fold);
        return (
          <circle key={i} cx={pt.x} cy={pt.y} r={5 + 2 * glow} fill="#BFD0FF" opacity={a * 0.9} style={{ filter: "drop-shadow(0 0 10px rgba(140,170,255,0.95))" }} />
        );
      })}
    </svg>
  );
};

// --- 3. Le logo : la ligne se replie en marque, puis le nom et la signature (P3 et P21) --------------------------------
type Line = { readonly text: string; readonly start: number; readonly top: number; readonly size: number; readonly color: string; readonly font?: string; readonly weight?: number };
const LogoReveal: React.FC<{ readonly cy: number; readonly size?: number; readonly lines: readonly Line[] }> = ({ cy, size = 200, lines }) => {
  const frame = useCurrentFrame();
  const cx = 960, s = size / 64, ox = cx - size / 2, oy = cy - size / 2;
  const targets = LOGO_PTS.map((p) => ({ x: ox + p.x * s, y: oy + p.y * s }));
  const fold = ramp(frame, 0, 28);
  const sq = ramp(frame, 3, 21);  // le carré arrondi grandit derrière la ligne
  const bar1 = ramp(frame, 22, 34), bar2 = ramp(frame, 28, 40);  // les deux barres du F se dessinent (cache)
  const dot = ramp(frame, 24, 34);
  const wordTop = cy + size / 2 + 34;
  const letters = [..."Fin"].map((c) => ({ c, color: COLORS.ink })).concat([..."Veille"].map((c) => ({ c, color: COLORS.brand })));
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <linearGradient id="fvg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3b6cff" /><stop offset="1" stopColor="#1536b4" /></linearGradient>
          <clipPath id="fvb1"><rect x="16" y="13" width="9.5" height={38 * bar1 + 0.01} /></clipPath>
          <clipPath id="fvb2"><rect x="16" y="13" width={32 * bar2 + 0.01} height="9.5" /></clipPath>
        </defs>
        <g transform={`translate(${ox} ${oy}) scale(${s})`}>
          <g transform={`translate(32 32) scale(${lerp(0.6, 1, sq)}) translate(-32 -32)`} opacity={sq}>
            <rect width="64" height="64" rx="16" fill="url(#fvg)" style={{ filter: "drop-shadow(0 8px 24px rgba(21,54,180,0.55))" }} />
          </g>
          <rect x="16" y="13" width="9.5" height="38" rx="3.5" fill="#fff" clipPath="url(#fvb1)" />
          <rect x="16" y="13" width="32" height="9.5" rx="3.5" fill="#fff" clipPath="url(#fvb2)" />
        </g>
      </svg>
      <PriceLine points={HERO_LINE} fold={fold} foldTo={targets} foldWidth={5.5 * s} />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <circle cx={ox + 46.5 * s} cy={oy + 28 * s} r={5 * s * dot} fill={COLORS.green} />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: wordTop, display: "flex", justifyContent: "center", fontFamily: display, fontWeight: 800, fontSize: 150, lineHeight: 1.08, letterSpacing: "-0.03em" }}>
        {letters.map((l, i) => {
          const t = ramp(frame, 15 + i * 3.4, 25 + i * 3.4);
          return (
            <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: "0.16em", marginBottom: "-0.16em" }}>
              <span style={{ display: "inline-block", color: l.color, translate: `0 ${(1 - t) * 110}%` }}>{l.c}</span>
            </span>
          );
        })}
      </div>
      {lines.map((l) => (
        <div key={l.text} style={{ position: "absolute", left: 0, right: 0, top: l.top }}>
          <Words text={l.text} start={l.start} size={l.size} color={l.color} font={l.font ?? sans} weight={l.weight ?? 500} gap={3} align="center" tracking="0" />
        </div>
      ))}
    </AbsoluteFill>
  );
};

// --- 5. Les colonnes de dépêches (P2) ---------------------------------------------------------------------------------------
const HEADLINES = [
  "La BCE maintient ses taux directeurs", "Le CAC 40 termine la séance en hausse", "Le pétrole recule sur fond de craintes de ralentissement",
  "L'inflation ralentit en zone euro", "Wall Street ouvre en ordre dispersé", "L'euro se stabilise face au dollar",
  "Les banques centrales restent attentives aux chiffres de l'emploi", "Les valeurs technologiques tirent la cote vers le haut",
  "Le bitcoin repasse au-dessus d'un seuil symbolique", "L'or reste une valeur refuge pour les investisseurs",
  "La Bourse de Paris hésite avant les résultats trimestriels", "Les taux d'emprunt à dix ans se détendent",
  "Les marchés asiatiques ouvrent en baisse", "La Fed laisse la porte ouverte à une baisse des taux",
  "Le secteur bancaire accélère en début de séance", "Les investisseurs guettent la prochaine réunion des banquiers centraux",
  "Le dollar prend un peu de recul", "Le luxe français sous pression en Asie", "Les résultats des grandes entreprises rassurent les marchés",
  "Le prix du gaz européen reste volatil", "La croissance française confirme sa résilience",
  "Les marchés d'actions finissent la semaine sur une note prudente", "La confiance des ménages progresse légèrement",
  "Les cryptomonnaies repartent à la hausse", "L'industrie européenne montre des signes de reprise",
  "Le cuivre suit la demande chinoise", "Les investisseurs se réfugient vers les obligations d'État",
  "Les chiffres de l'emploi américain très attendus", "Le Nasdaq progresse, porté par les semi-conducteurs",
  "La livre sterling évolue sans direction claire", "Les marchés digèrent une série de résultats contrastés",
  "L'épargne des ménages reste élevée", "Les analystes relèvent leurs prévisions de croissance",
  "Les places européennes terminent en ordre dispersé", "Le marché immobilier ralentit dans les grandes villes",
  "Les assureurs profitent de la remontée des rendements",
];
const COLS = [  // x, vitesse (px par image, + monte), opacité, flou : peu contrastées, les colonnes lointaines floues
  { x: 96, v: 0.55, o: 0.14, blur: 3 }, { x: 441, v: -1.0, o: 0.22, blur: 1.2 }, { x: 787, v: 0.85, o: 0.28, blur: 0 },
  { x: 1132, v: -1.4, o: 0.2, blur: 1.5 }, { x: 1478, v: 0.65, o: 0.15, blur: 3 },
];
const ITEM = 150, PER_COL = 9;
const Headlines: React.FC = () => {
  const frame = useCurrentFrame();
  const squash = ramp(frame, 105, 119, [1, 0], IN);  // sur 225-239 elles s'aspirent vers la ligne
  const H = ITEM * PER_COL;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scaleY(${squash})`, transformOrigin: `50% ${HERO_LINE[12].y}px` }}>
        {COLS.map((c, ci) =>
          Array.from({ length: PER_COL }, (_, k) => {
            const y = (((k * ITEM - c.v * frame + ci * 61) % H) + H) % H - ITEM;
            return (
              <div
                key={`${ci}-${k}`}
                style={{
                  position: "absolute", left: c.x, top: y, width: 330, fontFamily: sans, fontWeight: 500, fontSize: 29, lineHeight: 1.28,
                  color: COLORS.ink, opacity: c.o, filter: c.blur ? `blur(${c.blur}px)` : undefined,
                }}
              >
                {HEADLINES[(ci * 7 + k * 4 + ci) % HEADLINES.length]}
              </div>
            );
          }),
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// --- 6. La fenêtre du site, qui flotte en 3D --------------------------------------------------------------------------------
type Box = { readonly x: number; readonly y: number; readonly w: number };  // la hauteur suit : séquences en 16/9
const MAIN: Box = { x: 210, y: 88, w: 1500 };  // 210 → 1710, 88 → 932

const Placeholder: React.FC<{ readonly label: string; readonly w: number; readonly h: number }> = ({ label, w, h }) => (
  <div style={{ width: w, height: h, background: "linear-gradient(160deg, #0d1424, #080c18)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: h * 0.02 }}>
    <div style={{ fontFamily: display, fontWeight: 800, fontSize: h * 0.14, letterSpacing: "-0.03em", color: COLORS.ink, opacity: 0.85 }}>{label}</div>
    <div style={{ fontFamily: sans, fontWeight: 500, fontSize: h * 0.04, color: COLORS.muted }}>séquence à venir</div>
  </div>
);

type CursorRow = readonly [number, number, number, number | string | boolean];
const isDown = (b: CursorRow[3]) => b === true || b === "down" || (typeof b === "number" && b > 0);
const Cursor: React.FC<{ readonly rows: readonly CursorRow[]; readonly idx: number; readonly k: number; readonly top: number }> = ({ rows, idx, k, top }) => {
  if (rows.length === 0 || idx < rows[0][0] - 8) return null;
  let j = 0;
  while (j < rows.length - 1 && rows[j + 1][0] <= idx) j++;
  const a = rows[j], b = rows[Math.min(j + 1, rows.length - 1)];
  const t = b[0] > a[0] ? Math.min(1, Math.max(0, (idx - a[0]) / (b[0] - a[0]))) : 0;
  const x = lerp(a[1], b[1], t) * k, y = lerp(a[2], b[2], t) * k + top;  // la vidéo commence sous la barre
  let press = -1;  // l'image où le bouton s'est enfoncé le plus récemment
  for (let i = 0; i <= j; i++) if (isDown(rows[i][3]) && (i === 0 || !isDown(rows[i - 1][3]))) press = rows[i][0];
  const age = press < 0 ? 99 : idx - press;
  const ring = ramp(age, 0, 16);
  const show = ramp(idx, rows[0][0] - 8, rows[0][0]);
  const s = 1.5 * Math.max(0.7, k / 0.78);
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: show, pointerEvents: "none" }}>
      {age < 17 ? (
        <div style={{ position: "absolute", left: -44 * k - 2, top: -44 * k - 2, width: 88 * k, height: 88 * k, borderRadius: "50%", border: `3px solid ${COLORS.brand}`, background: `${COLORS.brand}33`, opacity: 1 - ring, transform: `scale(${lerp(0.2, 1, ring)})` }} />
      ) : null}
      <svg width={24 * s} height={32 * s} viewBox="0 0 24 32" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.6))" }}>
        <path d="M2 2 L2 24 L8 18.5 L12.5 28.5 L16.5 26.7 L12 17 L20 17 Z" fill="#fff" stroke="#0b1020" strokeWidth={2} strokeLinejoin="round" />
      </svg>
    </div>
  );
};

const Pane: React.FC<{
  readonly src: string;  // chemin dans public/ (footage/….mp4)
  readonly label: string; readonly trimBefore?: number;
  readonly cursor?: string;  // JSON optionnel : [image, x, y, bouton] en pixels 1920 × 1080 de la séquence d'origine
  readonly dim?: number;  // image du plan où la fenêtre est entièrement éclairée (elle est assombrie à 45 % avant)
  readonly box?: Box; readonly turn?: 1 | -1; readonly opacity?: number;
}> = ({ src, label, trimBefore = 0, cursor, dim, box = MAIN, turn = 1, opacity = 1 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const rows = useJson<CursorRow[]>(cursor);
  const h = Math.round((box.w * 9) / 16), k = box.w / 1920, bar = Math.round(32 * Math.max(0.8, k / 0.78));
  const cam = ramp(frame, 0, durationInFrames, [0, 1], CAM);  // UN seul mouvement de caméra : poussée lente et rotation qui s'apaise
  const dark = dim === undefined ? 0 : 0.55 * (1 - ramp(frame, dim - 16, dim, [0, 1], CAM));
  const blur = (dark / 0.55) * 5;  // la fenêtre se défait un peu sous le titre de section
  return (
    <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: h, transform: `perspective(2400px) rotateY(${turn * lerp(6, 2, cam)}deg) scale(${lerp(1, 1.06, cam)})`, opacity }}>
      <div style={{ position: "absolute", left: box.w * 0.08, top: h - 26, width: box.w * 0.84, height: 150, background: `radial-gradient(50% 100% at 50% 0%, ${COLORS.brand}55, transparent 75%)`, filter: "blur(18px)" }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: 22, overflow: "hidden", boxShadow: `0 70px 140px -30px #000, 0 0 0 1px #ffffff14`, background: "#0a0f1b" }}>
        <div style={{ position: "absolute", left: 0, top: bar, width: box.w, height: h - bar, overflow: "hidden", filter: blur > 0.2 ? `blur(${blur}px)` : undefined }}>
          {has(src) ? <Video src={staticFile(src)} trimBefore={trimBefore} muted objectFit="fill" style={{ width: box.w, height: h }} /> : <Placeholder label={label} w={box.w} h={h - bar} />}
        </div>
        {rows ? <Cursor rows={rows} idx={trimBefore + frame} k={k} top={bar} /> : null}
        <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: bar, background: "#0b1120", borderBottom: "1px solid #ffffff12", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ padding: `0 ${bar * 0.5}px`, height: bar * 0.62, borderRadius: bar, background: "#151d30", display: "flex", alignItems: "center", gap: bar * 0.22, fontFamily: sans, fontWeight: 500, fontSize: bar * 0.45, color: COLORS.muted }}>
            <span style={{ width: bar * 0.18, height: bar * 0.18, borderRadius: "50%", background: COLORS.green }} />
            finveille.streamlit.app
          </div>
        </div>
        {dark > 0 ? <div style={{ position: "absolute", inset: 0, background: COLORS.night, opacity: dark }} /> : null}
      </div>
    </div>
  );
};

// Un plan filmé : la fenêtre, le titre de section éventuel, la légende
const FootageShot: React.FC<{ readonly shot: Shot }> = ({ shot }) => {
  const sec = shot.section;
  return (
    <AbsoluteFill>
      <Pane src={`footage/${shot.name}.mp4`} label={shot.name} trimBefore={shot.trim} cursor={`footage/${shot.name}.cursor.json`} dim={sec?.lift} />
      {sec ? <SectionTitle text={sec.text} exit={sec.exit} /> : null}
      <Caption text={shot.caption} from={sec ? sec.caption : 0} />
    </AbsoluteFill>
  );
};

// --- 11. P20 : l'écran partagé, thème clair à gauche, téléphone à droite -------------------------------------------------
const LIGHT_BOX: Box = { x: 210, y: 220, w: 990 };
const PHONE = { cx: 1500, w: 400, ar: 2338 / 1080, r: 52, bezel: 6 };  // ar : hauteur / largeur de la séquence mobile
const Phone: React.FC<{ readonly trimBefore: number }> = ({ trimBefore }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const cam = ramp(frame, 0, durationInFrames, [0, 1], CAM);
  const sw = PHONE.w, sh = Math.round(PHONE.w * PHONE.ar), src = "footage/mobile.mp4";
  return (
    <div
      style={{
        position: "absolute", left: PHONE.cx - sw / 2 - PHONE.bezel, top: (1080 - sh) / 2 - PHONE.bezel - 10, width: sw + PHONE.bezel * 2, height: sh + PHONE.bezel * 2,
        borderRadius: PHONE.r, background: "#10172a", boxShadow: `0 70px 140px -30px #000, 0 0 0 1px #ffffff1c, 0 0 90px -30px ${COLORS.brand}88`,
        transform: `perspective(2400px) rotateY(${-lerp(6, 2, cam)}deg) scale(${lerp(1, 1.06, cam)})`, padding: PHONE.bezel,
      }}
    >
      <div style={{ width: sw, height: sh, borderRadius: PHONE.r - PHONE.bezel, overflow: "hidden", background: "#0a0f1b" }}>
        {has(src) ? <Video src={staticFile(src)} trimBefore={trimBefore} muted objectFit="cover" style={{ width: sw, height: sh }} /> : <Placeholder label="mobile" w={sw} h={sh} />}
      </div>
    </div>
  );
};
const Split: React.FC = () => {
  const frame = useCurrentFrame();
  const gone = ramp(frame, 46, 59, [1, 0], IN);  // RACCORD 2 : tout s'efface sauf la ligne de cours
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: gone }}>
        <Pane src="footage/light.mp4" label="light" trimBefore={SPLIT.light.trim} cursor="footage/light.cursor.json" box={LIGHT_BOX} />
        <Phone trimBefore={SPLIT.mobile.trim} />
      </AbsoluteFill>
      <PriceLine points={HERO_LINE} draw={[40, 59]} />
      <Caption text={SPLIT.caption} />
    </AbsoluteFill>
  );
};

// --- 9. La galerie (P15) : 16 maquettes plein cadre, 15 images chacune -------------------------------------------------------
const ModelShot: React.FC<{ readonly name: string; readonly label: string }> = ({ name, label }) => {
  const src = `models/${name}.mp4`;
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.night }}>
      {has(src) ? <Video src={staticFile(src)} trimBefore={MODEL_TRIM} muted objectFit="cover" style={{ width: 1920, height: 1080 }} /> : <Placeholder label={name} w={1920} h={1080} />}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 240, background: `linear-gradient(transparent, ${COLORS.night}cc)` }} />
      <Caption text={label} enter={6} leave={0} />
    </AbsoluteFill>
  );
};
const Gallery: React.FC = () => (
  <AbsoluteFill>
    {MODELS.map(([name, label], i) => (
      <Sequence key={name} from={i * 15} durationInFrames={15} name={`maquette ${name}`}>
        <ModelShot name={name} label={label} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

// --- 10. La grille des 17 maquettes (P16), 6 × 3, la 18e case dit le chiffre -------------------------------------------------
const CELL = { w: 256, h: 262, gap: 24 };
const Grid: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const back = ramp(frame, 0, durationInFrames, [1.08, 1], CAM);  // la caméra recule
  const left = (1920 - (6 * CELL.w + 5 * CELL.gap)) / 2, top = (1080 - (3 * CELL.h + 2 * CELL.gap)) / 2;
  return (
    <AbsoluteFill style={{ transform: `scale(${back})` }}>
      {Array.from({ length: 18 }, (_, i) => {
        const t = ramp(frame, 6 + 3 * i, 20 + 3 * i);  // apparition décalée de 3 images, de gauche à droite
        const x = left + (i % 6) * (CELL.w + CELL.gap), y = top + Math.floor(i / 6) * (CELL.h + CELL.gap);
        const name = GRID_MODELS[i];
        const src = `models/${name}.mp4`;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: CELL.w, height: CELL.h, borderRadius: 18, overflow: "hidden", opacity: t, translate: `0 ${(1 - t) * 24}px`, scale: String(lerp(0.96, 1, t)), background: "#050810", boxShadow: "0 0 0 1px #ffffff12, 0 30px 60px -30px #000" }}>
            {name === undefined ? (
              <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 26px", background: `linear-gradient(160deg, ${COLORS.brand}33, #0a0f1b)` }}>
                <div style={{ fontFamily: display, fontWeight: 800, fontSize: 104, letterSpacing: "-0.03em", lineHeight: 1, color: COLORS.brand }}>17</div>
                <div style={{ fontFamily: display, fontWeight: 800, fontSize: 31, letterSpacing: "-0.02em", lineHeight: 1.1, color: COLORS.ink, marginTop: 6 }}>maquettes interactives</div>
              </div>
            ) : has(src) ? (
              <Video src={staticFile(src)} trimBefore={MODEL_TRIM} loop muted objectFit="cover" style={{ position: "absolute", left: -CELL.w * 0.225, top: (CELL.h - CELL.w * 1.45 * 0.5625) / 2, width: CELL.w * 1.45, height: CELL.w * 1.45 * 0.5625 }} />
            ) : (
              <Placeholder label={name} w={CELL.w} h={CELL.h} />
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// --- Les cartons : P1 à P2 (l'accroche), P14 (la montée) ----------------------------------------------------------------------
const Opening: React.FC = () => (
  <AbsoluteFill>
    <Sequence from={120} durationInFrames={120} name="P2 dépêches"><Headlines /></Sequence>
    <PriceLine points={HERO_LINE} draw={[10, 90]} />
    <div style={{ position: "absolute", left: 96, right: 96, top: 250 }}>
      <Words text={"Chaque jour,\ndes milliers de dépêches."} start={30} size={124} align="center" exitAt={104} />
    </div>
    <div style={{ position: "absolute", left: 96, right: 96, top: 230 }}>
      <Sequence from={120} durationInFrames={120} layout="none">
        <Words text={"Des marchés qui\nne dorment jamais."} start={15} size={140} align="center" />
      </Sequence>
    </div>
  </AbsoluteFill>
);

// La ligne pulse au rythme du roulement de caisse claire, qui accélère (une impulsion toutes les 15 puis 6 images)
const rollPhase = (f: number) => {
  let ph = 0;
  for (let i = 30; i < f; i++) ph += 1 / lerp(15, 6, Math.min(1, (i - 30) / 75));
  return ph;
};
const Carton: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = frame < 30 ? 0 : Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * rollPhase(frame)), 2);
  return (
    <AbsoluteFill>
      <PriceLine points={CARTON_LINE} draw={[0, 30]} glow={0.6 + 2 * pulse} width={3 + 1.5 * pulse} opacity={1 - ramp(frame, 100, 108, [0, 1], IN)} />
      <div style={{ position: "absolute", left: 96, right: 96, top: 250 }}>
        <Words text={"Chaque page\na sa maquette 3D."} start={5} size={130} align="center" exitAt={54} />
      </div>
      <div style={{ position: "absolute", left: 96, right: 96, top: 250 }}>
        <Words text={"Et chacune\nrépond au clic."} start={60} size={130} align="center" exitAt={100} />
      </div>
    </AbsoluteFill>
  );
};

// --- Les fondus et le flash --------------------------------------------------------------------------------------------------------
const Fades: React.FC = () => {
  const frame = useCurrentFrame();
  const black = frame < 1200 ? ramp(frame, 1186, 1192, [0, 1], IN) : ramp(frame, 2010, 2039, [0, 1], CAM);
  const white = frame >= 1200 && frame < 1202 ? 1 - (frame - 1200) / 2 : 0;  // le seul flash blanc : 2 images
  return (
    <>
      {black > 0 ? <AbsoluteFill style={{ background: "#000", opacity: black }} /> : null}
      {white > 0 ? <AbsoluteFill style={{ background: "#fff", opacity: white }} /> : null}
    </>
  );
};

// --- 12. Le son --------------------------------------------------------------------------------------------------------------------------
const Sfx: React.FC<{ readonly file: string; readonly at: number; readonly volume: number }> = ({ file, at, volume }) =>
  has(`sfx/${file}.wav`) ? (
    <Sequence from={at} name={`son ${file}`}>
      <Audio src={staticFile(`sfx/${file}.wav`)} volume={volume} />
    </Sequence>
  ) : null;

// Les clics des séquences : image absolue = début du plan + (clic − images sautées)
const ClickSounds: React.FC<{ readonly name: string; readonly from: number; readonly trim: number; readonly bell: boolean }> = ({ name, from, trim, bell }) => {
  const ev = useJson<{ click?: number }>(`footage/${name}.events.json`);
  if (!ev || typeof ev.click !== "number") return null;
  const at = from + (ev.click - trim);
  return (
    <>
      <Sfx file="click" at={at} volume={VOL.click} />
      {bell ? <Sfx file="bell" at={at + 3} volume={VOL.bell} /> : null}
    </>
  );
};

const Sound: React.FC = () => (
  <>
    {has("music.mp3") ? <Audio src={staticFile("music.mp3")} volume={(f) => VOL.music * ramp(f, TOTAL - 30, TOTAL, [1, 0], CAM)} /> : null}
    {WHOOSH.map((f) => <Sfx key={`w${f}`} file="whoosh" at={f} volume={VOL.whoosh} />)}
    {IMPACT.map((f) => <Sfx key={`i${f}`} file="impact" at={f} volume={VOL.impact} />)}
    {Array.from({ length: KEYS.count }, (_, i) => <Sfx key={`k${i}`} file="keys" at={KEYS.from + i * KEYS.every} volume={VOL.keys} />)}
    {TICKS.map((f) => <Sfx key={`t${f}`} file="tick" at={f} volume={VOL.tick} />)}
    {CLICKS.map((c) => <ClickSounds key={c.name} {...c} />)}
  </>
);

// --- Le montage ----------------------------------------------------------------------------------------------------------------------------
export const Trailer: React.FC = () => {
  const frame = useCurrentFrame();
  const [p3] = FRAMES.p3, [p14] = FRAMES.p14, [p15] = FRAMES.p15, [p16] = FRAMES.p16, [p20] = FRAMES.p20, [p21] = FRAMES.p21;
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.night }}>
      <Backdrop level={frame >= p15 ? 1 : backdropLevel(frame)} />
      <Sequence from={0} durationInFrames={240} name="P1 à P2 : l'accroche"><Opening /></Sequence>
      <Sequence from={p3} durationInFrames={120} name="P3 : le logo">
        <LogoReveal
          cy={372}
          lines={[{ text: "Toute la finance qui compte, en un seul site.", start: 45, top: 716, size: 42, color: COLORS.muted }]}
        />
      </Sequence>
      {FOOTAGE.map((s) => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from} name={`${s.id} ${s.name}`}><FootageShot shot={s} /></Sequence>
      ))}
      <Sequence from={p14} durationInFrames={120} name="P14 : la montée"><Carton /></Sequence>
      <Sequence from={p15} durationInFrames={240} name="P15 : la galerie"><Gallery /></Sequence>
      <Sequence from={p16} durationInFrames={120} name="P16 : la grille"><Grid /></Sequence>
      <Sequence from={p20} durationInFrames={60} name="P20 : écran partagé"><Split /></Sequence>
      <Sequence from={p21} durationInFrames={240} name="P21 : la signature">
        <LogoReveal
          cy={330}
          lines={[
            { text: "finveille.streamlit.app", start: 60, top: 674, size: 46, color: COLORS.brand },
            { text: "Un projet de Yassine Zouhair, étudiant en finance", start: 105, top: 752, size: 36, color: COLORS.muted },
          ]}
        />
      </Sequence>
      <Fades />
      <Sound />
    </AbsoluteFill>
  );
};
