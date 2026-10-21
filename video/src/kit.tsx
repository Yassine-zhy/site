// La boîte à outils de la v4 (étape 36) : le temps musical, les courbes, le fond, le verre lumineux, les icônes.
// Toutes les scènes raisonnent en images absolues du film (60 im/s) et en temps de la musique (67 battements/min).
import { loadFont } from "@remotion/fonts";
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, random, spring, staticFile } from "remotion";

// --- Les polices de la marque, embarquées (public/fonts) ------------------------------------------------------------------
export const display = "Schibsted Grotesk", sans = "IBM Plex Sans";
loadFont({ family: display, url: staticFile("fonts/SchibstedGrotesk.woff2"), weight: "400 900" });
loadFont({ family: sans, url: staticFile("fonts/IBMPlexSans.woff2"), weight: "100 700" });

export const C = {
  bg: "#05060A", ink: "#F2F4FA", muted: "#9AA3B8", dim: "#5B6478", line: "rgba(255,255,255,0.10)",
  brand: "#6D93FF", violet: "#9B7BFF", up: "#34D17F", down: "#FF6375", amber: "#FFB547", dot: "#6ee7a8",
};

// --- Le temps : 60 im/s ; un temps de la musique = 0,89555 s = 53,733 images ; une mesure = 4 temps ---------------------
export const FPS = 60, W = 1920, H = 1080, CX = 960, CY = 540;
export const BEAT = 0.89555 * FPS;
export const b = (beat: number) => Math.round(beat * BEAT);  // l'image d'un temps (le drop est au temps 4)
export const TOTAL = 2000;  // 33,33 s

// --- Les courbes --------------------------------------------------------------------------------------------------------
export const OUT = Easing.bezier(0.16, 1, 0.3, 1);  // arrivée : rapide puis très douce
export const IN = Easing.bezier(0.7, 0, 0.84, 0);  // sortie
export const CAM = Easing.bezier(0.65, 0, 0.35, 1);  // mouvement de caméra
export const LIN = (t: number) => t;
const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
// 0 → 1 (ou from → to) entre les images a et b
export const ramp = (f: number, a: number, z: number, from = 0, to = 1, ease: (t: number) => number = OUT) =>
  interpolate(f, [a, z > a ? z : a + 1], [from, to], { ...clampOpts, easing: ease });
// Un ressort (léger dépassement, comme une interface d'iPhone) : 0 avant `at`, puis ≈ 1
export const pop = (f: number, at: number, damping = 13, stiffness = 170, mass = 0.7) =>
  f < at ? 0 : spring({ frame: f - at, fps: FPS, config: { damping, stiffness, mass } });
export const lerp = (a: number, z: number, t: number) => a + (z - a) * t;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const rnd = (seed: string) => random(seed);
// Mélange de deux couleurs #rrggbb
export const mix = (c1: string, c2: string, t: number) => {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [a, z] = [p(c1), p(c2)];
  return `rgb(${a.map((v, i) => Math.round(lerp(v, z[i], clamp(t, 0, 1)))).join(",")})`;
};
// Le même mélange, rendu en #rrggbb (pour les fonctions qui prennent une couleur hexadécimale)
export const mixHex = (c1: string, c2: string, t: number) =>
  "#" + (mix(c1, c2, t).match(/\d+/g) ?? []).map((v) => Number(v).toString(16).padStart(2, "0")).join("");
export const rgba = (hex: string, a: number) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;

// --- La mise au point : un élément entre net depuis le flou, ou sort en se floutant -------------------------------------------
// p = 0 : invisible et flou ; p = 1 : net
export const focus = (p: number, px = 18): React.CSSProperties => ({
  opacity: clamp(p * 1.4, 0, 1), filter: p >= 0.999 ? undefined : `blur(${(1 - clamp(p, 0, 1)) * px}px)`,
});
// Entrée à `at` (durée d), sortie à `out` (durée d2) ; renvoie 0 → 1 → 0
export const life = (f: number, at: number, d: number, out?: number, d2 = d) =>
  ramp(f, at, at + d) * (out === undefined ? 1 : 1 - ramp(f, out, out + d2, 0, 1, IN));

// --- Les nombres à la française : espace fine insécable pour les milliers, virgule décimale ------------------------------------
export const num = (v: number, decimals = 0) => {
  const [i, d] = Math.abs(v).toFixed(decimals).split(".");
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${v < 0 ? "−" : ""}${int}${d ? "," + d : ""}`;
};
// Un compteur qui roule de `from` à `to` entre les images a et z
export const count = (f: number, a: number, z: number, from: number, to: number, decimals = 0) =>
  num(ramp(f, a, z, from, to, Easing.bezier(0.2, 0.7, 0.2, 1)), decimals);

// --- Le fond : nuit, une lueur en haut dont la couleur suit la scène, un vignettage et un grain qui bouge ------------------------
// glow : [image, couleur #rrggbb, intensité 0-1], dans l'ordre des images
export type GlowKey = readonly [number, string, number];
export const Backdrop: React.FC<{ readonly f: number; readonly glow: readonly GlowKey[] }> = ({ f, glow }) => {
  let i = 0;
  while (i < glow.length - 1 && glow[i + 1][0] <= f) i++;
  const [f0, c0, a0] = glow[i];
  const [f1, c1, a1] = glow[Math.min(i + 1, glow.length - 1)];
  const t = f1 > f0 ? CAM(clamp((f - f0) / (f1 - f0), 0, 1)) : 0;
  const color = mix(c0, c1, t), alpha = lerp(a0, a1, t);
  const gx = Math.floor(rnd(`gx${Math.floor(f / 2)}`) * 256), gy = Math.floor(rnd(`gy${Math.floor(f / 2)}`) * 256);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 62% 58% at 50% -8%, ${color.replace("rgb", "rgba").replace(")", `,${0.55 * alpha})`)}, transparent 72%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 40% 30% at 50% 108%, ${color.replace("rgb", "rgba").replace(")", `,${0.12 * alpha})`)}, transparent 80%)` }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 80% at 50% 45%, transparent 55%, rgba(0,0,0,0.65) 100%)" }} />
      <AbsoluteFill style={{ opacity: 0.045, mixBlendMode: "screen", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: gx - 256, top: gy - 256, width: 9 * 256, display: "flex", flexWrap: "wrap" }}>
          {Array.from({ length: 9 * 6 }, (_, i) => <Img key={i} src={staticFile("grain.png")} style={{ width: 256, height: 256, display: "block" }} />)}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// --- Le verre lumineux : intérieur sombre, liseré blanc dégradé (fort en haut à gauche), halo doux ------------------------------
export const glass = (bw = 2.5, glow = 26, tint = "#ffffff", fill: readonly [string, string] = ["#181a22", "#0d0e14"]): React.CSSProperties => ({
  background: `linear-gradient(180deg, ${fill[0]}, ${fill[1]}) padding-box, linear-gradient(140deg, ${rgba(tint, 0.95)}, ${rgba(tint, 0.2)} 36%, ${rgba(tint, 0.08)} 60%, ${rgba(tint, 0.65)}) border-box`,
  border: `${bw}px solid transparent`,
  boxShadow: `0 0 ${glow}px ${rgba(tint, 0.22)}, 0 0 ${glow * 3}px ${rgba(tint, 0.07)}, inset 0 1px 0 rgba(255,255,255,0.10), 0 30px 70px -30px rgba(0,0,0,0.95)`,
  boxSizing: "border-box",
});

// Un bloc centré sur (x, y)
export const At: React.FC<{ readonly x: number; readonly y: number; readonly style?: React.CSSProperties; readonly children: React.ReactNode }> = ({ x, y, style, children }) => (
  <div style={{ position: "absolute", left: x, top: y, translate: "-50% -50%", ...style }}>{children}</div>
);

// Une lueur ronde (halo coloré flou) centrée sur (x, y)
export const Halo: React.FC<{ readonly x: number; readonly y: number; readonly r: number; readonly color: string; readonly a: number }> = ({ x, y, r, color, a }) =>
  a <= 0.001 ? null : (
    <div style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: `radial-gradient(circle, ${rgba(color, a)} 0%, ${rgba(color, a * 0.35)} 38%, transparent 70%)` }} />
  );

// --- Les icônes : traits de 2 px sur une grille de 24, à la manière des pictogrammes du site --------------------------------------
export type GlyphName = "news" | "chart" | "building" | "bank" | "coin" | "spark" | "bell" | "play" | "search" | "pie" | "arrowUp";
const PATHS: Record<GlyphName, React.ReactNode> = {
  news: <><rect x="3" y="4" width="15" height="16" rx="2.5" /><path d="M18 8h2.5a.5.5 0 0 1 .5.5V18a2 2 0 0 1-2 2H6" /><path d="M7 8.5h7M7 12h7M7 15.5h4" /></>,
  chart: <><path d="M3 20h18" /><path d="M6 16l4-5 3.5 3L19 7" /><circle cx="19" cy="7" r="1.6" fill="currentColor" /></>,
  building: <><rect x="4" y="3" width="10" height="18" rx="1.5" /><path d="M14 9h5a1 1 0 0 1 1 1v11" /><path d="M7.5 7h3M7.5 11h3M7.5 15h3M2 21h20" /></>,
  bank: <><path d="M3 9.5L12 4l9 5.5z" /><path d="M5.5 10.5v7M9.8 10.5v7M14.2 10.5v7M18.5 10.5v7M3 20.5h18" /></>,
  coin: <><circle cx="12" cy="12" r="8.5" /><path d="M14.8 9.3a3.4 3.4 0 1 0 0 5.4" /><path d="M8 11h4.5M8 13.2h4.5" /></>,
  spark: <path d="M12 2.5c.6 4.9 2.6 6.9 7.5 7.5-4.9.6-6.9 2.6-7.5 7.5-.6-4.9-2.6-6.9-7.5-7.5 4.9-.6 6.9-2.6 7.5-7.5z" fill="currentColor" />,
  bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></>,
  pie: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5V12l6 6" /></>,
  arrowUp: <path d="M12 5l7 8h-4.5v6h-5v-6H5z" fill="currentColor" stroke="none" />,
};
export const Glyph: React.FC<{ readonly name: GlyphName; readonly size: number; readonly color?: string; readonly stroke?: number; readonly style?: React.CSSProperties }> = ({
  name, size, color = C.ink, stroke = 2, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ color, display: "block", overflow: "visible", ...style }}>
    {PATHS[name]}
  </svg>
);

// --- Le logo (d'après public/logo.svg) : carré arrondi bleu, F blanc, ligne de cours, point vert ----------------------------------
// p : 0 → 1, le dessin du F, puis de la ligne, puis du point (le carré est dessiné par l'appelant ou par `square`)
export const LogoMark: React.FC<{ readonly size: number; readonly p: number; readonly square?: boolean; readonly id?: string }> = ({ size, p, square = true, id = "m" }) => {
  const bar1 = clamp(p / 0.4, 0, 1), bar2 = clamp((p - 0.15) / 0.4, 0, 1), line = clamp((p - 0.35) / 0.45, 0, 1), dot = clamp((p - 0.75) / 0.25, 0, 1);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`lg${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3b6cff" /><stop offset="1" stopColor="#1536b4" /></linearGradient>
        <clipPath id={`c1${id}`}><rect x="16" y="13" width="9.5" height={38 * bar1 + 0.01} /></clipPath>
        <clipPath id={`c2${id}`}><rect x="16" y="13" width={32 * bar2 + 0.01} height="9.5" /></clipPath>
      </defs>
      {square && <rect width="64" height="64" rx="16" fill={`url(#lg${id})`} />}
      <rect x="16" y="13" width="9.5" height="38" rx="3.5" fill="#fff" clipPath={`url(#c1${id})`} />
      <rect x="16" y="13" width="32" height="9.5" rx="3.5" fill="#fff" clipPath={`url(#c2${id})`} />
      <path d="M25.5 38.5 L32 33.2 L38 36.2 L46 28.5" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"
        pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - line} opacity={line > 0.001 ? 1 : 0} />
      <circle cx="46.5" cy="28" r={5 * dot} fill={C.dot} />
    </svg>
  );
};
