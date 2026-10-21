// La boîte à outils de la v3 : couleurs, polices, mouvement, minutage de la voix, texte cinétique, logo, personnages.
import { loadFont } from "@remotion/fonts";
import React, { createContext, useContext } from "react";
import { AbsoluteFill, Easing, Img, Sequence, interpolate, random, staticFile, useCurrentFrame } from "remotion";
import voJson from "../public/vo/vo.json";

// Les polices de la marque, embarquées (public/fonts) : le rendu n'a pas besoin d'Internet
export const display = "Schibsted Grotesk", sans = "IBM Plex Sans";
loadFont({ family: display, url: staticFile("fonts/SchibstedGrotesk.woff2"), weight: "400 900" });
loadFont({ family: sans, url: staticFile("fonts/IBMPlexSans.woff2"), weight: "100 700" });
export const mono = "ui-monospace, 'DejaVu Sans Mono', 'Liberation Mono', Menlo, Consolas, monospace";

export const COLORS = {
  night: "#060912", ink: "#E8EDF6", muted: "#96A2B9", line: "#24304A", brand: "#6D93FF", up: "#34D17F", down: "#FF6375",
  ines: "#6D4CFF", hugo: "#129E5A", sami: "#FF7A1A", dot: "#6ee7a8",
};
export type WorldName = "ines" | "hugo" | "sami";
export const WORLDS: Record<WorldName, string> = { ines: COLORS.ines, hugo: COLORS.hugo, sami: COLORS.sami };

// --- Le temps : 30 im/s, images absolues du film ------------------------------------------------------------------------
export const FPS = 30;
export const fr = (t: number) => Math.round(t * FPS);

// --- La voix : vo.json donne, pour chaque phrase, les mots et leurs instants en secondes absolues -------------------------
export type Word = { readonly w: string; readonly t0: number; readonly t1: number };
export type Phrase = { readonly id: string; readonly text: string; readonly start: number; readonly dur: number; readonly words: readonly Word[] };
export const VO = voJson as unknown as readonly Phrase[];
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
export const phrase = (id: string): Phrase => {
  const p = VO.find((x) => x.id === id);
  if (!p) throw new Error(`phrase ${id} absente de vo.json`);
  return p;
};
export const PH = (id: string) => ({ from: fr(phrase(id).start), to: fr(phrase(id).start + phrase(id).dur) });
// Image absolue d'un mot : par rang dans la phrase, ou par le texte du mot (sans accent ni ponctuation)
export const W = (id: string, key: number | string, edge: "t0" | "t1" = "t0"): number => {
  const p = phrase(id);
  const w = typeof key === "number" ? p.words[key] : p.words.find((x) => norm(x.w) === norm(key));
  if (!w) throw new Error(`mot ${String(key)} absent de ${id}`);
  return fr(w[edge]);
};

// --- Le mouvement : une arrivée, une sortie, un mouvement de caméra -----------------------------------------------------
const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const OUT = Easing.bezier(0.16, 1, 0.3, 1);  // arrivée
export const IN = Easing.bezier(0.7, 0, 0.84, 0);  // sortie
export const CAM = Easing.bezier(0.65, 0, 0.35, 1);  // le seul mouvement de caméra d'un plan
export const ramp = (frame: number, a: number, b: number, to: readonly [number, number] = [0, 1], easing: (t: number) => number = OUT) =>
  interpolate(frame, [a, b > a ? b : a + 1], [to[0], to[1]], { ...clampOpts, easing });
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const mod = (a: number, n: number) => ((a % n) + n) % n;
export const rnd = (seed: string) => random(seed);

// --- La scène : une Sequence qui garde en mémoire son image de départ, pour raisonner en images absolues ------------------
const SceneCtx = createContext(0);
export const Scene: React.FC<{ readonly id: string; readonly from: number; readonly to: number; readonly children: React.ReactNode }> = ({ id, from, to, children }) => (
  <Sequence from={from} durationInFrames={to - from} name={id}>
    <SceneCtx.Provider value={from}>{children}</SceneCtx.Provider>
  </Sequence>
);
export const useSceneFrom = () => useContext(SceneCtx);
// L'image absolue du film (à n'appeler que sous une <Scene>, pas sous une Sequence imbriquée)
export const useAbs = () => useCurrentFrame() + useContext(SceneCtx);

// --- Le texte cinétique : chaque mot monte derrière un cache à l'image où la voix le dit ----------------------------------
export type Tok = { readonly t: string; readonly at: number; readonly br?: boolean; readonly color?: string };
// Les mots d'une phrase de la voix (rang [a, b[), une coupure de ligne avant les rangs de `br`
export const toks = (id: string, a = 0, b?: number, br: readonly number[] = [], text?: readonly string[]): Tok[] =>
  phrase(id).words.slice(a, b).map((w, i) => ({ t: text?.[i] ?? w.w, at: fr(w.t0), br: br.includes(a + i) }));

export const Kinetic: React.FC<{
  readonly toks: readonly Tok[]; readonly size: number; readonly color?: string; readonly font?: string; readonly weight?: number;
  readonly lh?: number; readonly tracking?: string; readonly align?: "left" | "center" | "right"; readonly exit?: number;
  readonly style?: React.CSSProperties; readonly shadow?: string;
}> = ({ toks: list, size, color = COLORS.ink, font = display, weight = 900, lh = 0.92, tracking = "-0.04em", align = "left", exit, style, shadow }) => {
  const f = useAbs();
  const lines: Tok[][] = [];
  list.forEach((t, i) => {
    if (i === 0 || t.br) lines.push([]);
    lines[lines.length - 1].push(t);
  });
  const just = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
  return (
    <div style={{ fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: lh, letterSpacing: tracking, color, textShadow: shadow, ...style }}>
      {lines.map((line, li) => (
        <div key={li} style={{ display: "flex", justifyContent: just, columnGap: "0.24em", whiteSpace: "nowrap" }}>
          {line.map((t, wi) => {
            const up = ramp(f, t.at, t.at + 10);
            const down = exit === undefined ? 0 : ramp(f, exit + wi * 2, exit + wi * 2 + 9, [0, 1], IN);
            return (
              <span key={wi} style={{ display: "inline-block", overflow: "hidden", paddingTop: "0.2em", marginTop: "-0.2em", paddingBottom: "0.18em", marginBottom: "-0.18em", paddingRight: "0.04em" }}>
                <span style={{ display: "inline-block", color: t.color, translate: `0 ${(1 - up) * 135 - down * 140}%` }}>{t.t}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// Un petit libellé en minuscules (Plex 600) qui monte à `at`
export const Label: React.FC<{ readonly text: string; readonly at: number; readonly size?: number; readonly color?: string; readonly style?: React.CSSProperties }> = ({
  text, at, size = 34, color = COLORS.ink, style,
}) => {
  const f = useAbs();
  const p = ramp(f, at, at + 10);
  return <div style={{ fontFamily: sans, fontWeight: 600, fontSize: size, color, opacity: p, translate: `0 ${(1 - p) * 18}px`, ...style }}>{text}</div>;
};

// Une pastille blanche qui claque à `at` (échelle 0,8 → 1)
export const Pill: React.FC<{ readonly text: string; readonly at: number; readonly color: string; readonly size?: number; readonly bg?: string; readonly style?: React.CSSProperties }> = ({
  text, at, color, size = 60, bg = "#fff", style,
}) => {
  const f = useAbs();
  const p = ramp(f, at, at + 9);
  return (
    <div
      style={{
        display: "inline-block", fontFamily: display, fontWeight: 800, fontSize: size, letterSpacing: "-0.02em", lineHeight: 1, color, background: bg,
        padding: `${size * 0.26}px ${size * 0.5}px`, borderRadius: size, opacity: p, scale: String(lerp(0.8, 1, p)), translate: `0 ${(1 - p) * 20}px`,
        boxShadow: "0 18px 40px -18px rgba(0,0,0,0.45)", ...style,
      }}
    >
      {text}
    </div>
  );
};

// --- L'éclat radial : des traits fins qui jaillissent du centre (les deux impacts) ----------------------------------------
export const Burst: React.FC<{ readonly at: number; readonly color?: string; readonly cx?: number; readonly cy?: number }> = ({ at, color = "#ffffff", cx = 960, cy = 540 }) => {
  const f = useAbs() - at;
  if (f < 0 || f > 26) return null;
  const p = f / 24;
  const N = 56;
  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: N }, (_, i) => {
        const a = (i / N) * Math.PI * 2 + rnd(`b${i}`) * 0.05;
        const len = 0.45 + rnd(`bl${i}`) * 0.55;
        const head = OUT(clamp(p, 0, 1)) * 1500 * len;
        const tail = OUT(clamp((p - 0.12) / 0.88, 0, 1)) * 1500 * len * 0.82;
        const w = 1.5 + rnd(`bw${i}`) * 2.5;
        return (
          <line key={i} x1={cx + Math.cos(a) * (60 + tail)} y1={cy + Math.sin(a) * (60 + tail)} x2={cx + Math.cos(a) * (60 + head)} y2={cy + Math.sin(a) * (60 + head)}
            stroke={i % 5 === 0 ? COLORS.brand : color} strokeWidth={w} strokeLinecap="round" opacity={1 - p * p} />
        );
      })}
    </svg>
  );
};

// --- Le logo (redessiné d'après public/logo.svg) : carré arrondi, F, ligne de cours, point vert --------------------------
export const Logo: React.FC<{ readonly cx: number; readonly cy: number; readonly size: number; readonly at: number; readonly id?: string }> = ({ cx, cy, size, at, id = "a" }) => {
  const f = useAbs() - at;
  const s = size / 64;
  const sq = ramp(f, 0, 10), bar1 = ramp(f, 4, 15), bar2 = ramp(f, 8, 19), line = ramp(f, 12, 24), dot = ramp(f, 20, 28);
  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <linearGradient id={`fvg${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3b6cff" /><stop offset="1" stopColor="#1536b4" /></linearGradient>
        <clipPath id={`fvb1${id}`}><rect x="16" y="13" width="9.5" height={38 * bar1 + 0.01} /></clipPath>
        <clipPath id={`fvb2${id}`}><rect x="16" y="13" width={32 * bar2 + 0.01} height="9.5" /></clipPath>
      </defs>
      <g transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${s})`}>
        <g transform={`translate(32 32) scale(${lerp(0.5, 1, sq)}) translate(-32 -32)`} opacity={sq}>
          <rect width="64" height="64" rx="16" fill={`url(#fvg${id})`} style={{ filter: "drop-shadow(0 8px 24px rgba(21,54,180,0.55))" }} />
        </g>
        <rect x="16" y="13" width="9.5" height="38" rx="3.5" fill="#fff" clipPath={`url(#fvb1${id})`} />
        <rect x="16" y="13" width="32" height="9.5" rx="3.5" fill="#fff" clipPath={`url(#fvb2${id})`} />
        <path d="M25.5 38.5 L32 33.2 L38 36.2 L46 28.5" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"
          pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - line} opacity={line > 0.001 ? 1 : 0} />
        <circle cx="46.5" cy="28" r={5 * dot} fill={COLORS.dot} />
      </g>
    </svg>
  );
};

// Le nom : « Fin » encre, « Veille » bleu, lettre par lettre derrière un cache, centré sur `cx`
export const Wordmark: React.FC<{ readonly top: number; readonly size: number; readonly at: number; readonly cx?: number }> = ({ top, size, at, cx = 960 }) => {
  const f = useAbs();
  const letters = [..."Fin"].map((c) => ({ c, color: COLORS.ink })).concat([..."Veille"].map((c) => ({ c, color: COLORS.brand })));
  return (
    <div style={{ position: "absolute", left: cx - 960, width: 1920, top, display: "flex", justifyContent: "center", fontFamily: display, fontWeight: 900, fontSize: size, lineHeight: 1.04, letterSpacing: "-0.04em" }}>
      {letters.map((l, i) => {
        const t = ramp(f, at + i * 2.2, at + 10 + i * 2.2);
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingTop: "0.1em", marginTop: "-0.1em", paddingBottom: "0.18em", marginBottom: "-0.18em" }}>
            <span style={{ display: "inline-block", color: l.color, translate: `0 ${(1 - t) * 135}%` }}>{l.c}</span>
          </span>
        );
      })}
    </div>
  );
};

// --- Les personnages (Notionists, CC0) : un disque de couleur qui les cadre, le buste dépasse un peu en haut ----------------
export const Character: React.FC<{
  readonly name: WorldName; readonly cx: number; readonly cy: number; readonly d: number; readonly at: number; readonly disc?: string; readonly rise?: boolean;
}> = ({ name, cx, cy, d, at, disc = "rgba(0,0,0,0.16)", rise = true }) => {
  const f = useAbs();
  const p = ramp(f, at, at + 14);
  // le personnage est cadré par un disque ; il monte depuis le bas (masque circulaire) à l'image `at`
  return (
    <div style={{ position: "absolute", left: cx - d / 2, top: cy - d / 2, width: d, height: d, opacity: rise ? 1 : p, scale: String(rise ? 1 : lerp(0.9, 1, p)) }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: disc, scale: String(lerp(0.4, 1, p)) }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden" }}>
        <Img src={staticFile(`characters/${name}.svg`)} style={{ position: "absolute", left: -d * 0.04, top: d * 0.06 + (rise ? (1 - p) * d : 0), width: d * 1.08, height: d * 1.08 }} />
      </div>
    </div>
  );
};

// Un aplat de couleur plein cadre (le monde d'un personnage)
export const World: React.FC<{ readonly color: string; readonly children?: React.ReactNode }> = ({ color, children }) => (
  <AbsoluteFill style={{ backgroundColor: color, overflow: "hidden" }}>{children}</AbsoluteFill>
);

// Un panneau de couleur qui balaie l'écran de la gauche vers la droite (whoosh) : il finit par recouvrir tout le cadre
export const Sweep: React.FC<{ readonly from: number; readonly to: number; readonly color: string }> = ({ from, to, color }) => {
  const f = useAbs();
  if (f < from) return null;
  const p = ramp(f, from, to, [0, 1], Easing.bezier(0.5, 0, 0.84, 0.3));
  return (
    <div style={{ position: "absolute", top: 0, bottom: 0, left: -300, width: 2520, background: color, transform: `translateX(${(p - 1) * 2520}px) skewX(-8deg)`, boxShadow: "40px 0 80px -20px rgba(0,0,0,0.35)" }} />
  );
};
