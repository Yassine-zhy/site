// Les briques communes de la publicité pixel art : le fond « papier » (ou nuit) avec son grain, les mots qui arrivent un
// par un, le trait dessiné à la main, l'ellipse en orbite, l'éclat de lumière, la dissolution en carrés, la séquence filmée.
// Tout est calculé à partir du numéro de l'image `f` (jamais l'horloge).
import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, random, staticFile } from "remotion";
import { At, CAM, LIN, OUT, clamp, display, lerp, ramp, rgba } from "../kit";
import { Sprite } from "./Sprite";
import { SPRITES, SpriteName, Palette } from "./sprites";
import { PX } from "./theme";

export const PW = 1080, PH = 1350, PCX = 540, PCY = 675;

// --- Le fond : papier gris froid (ou bleu nuit), grain de pellicule qui bouge à chaque image, vignettage ---------------------------
export const Paper: React.FC<{ readonly f: number; readonly dark: boolean }> = ({ f, dark }) => {
  const gx = Math.floor(random(`pgx${Math.floor(f / 2)}`) * 256), gy = Math.floor(random(`pgy${Math.floor(f / 2)}`) * 256);
  return (
    <AbsoluteFill style={{ background: dark ? PX.night : PX.paper }}>
      {dark && <AbsoluteFill style={{ background: `radial-gradient(ellipse 72% 56% at 50% 48%, ${rgba(PX.nightHalo, PX.nightHaloA)}, transparent 74%)` }} />}
      <AbsoluteFill style={{
        backgroundImage: `url(${staticFile("grain.png")})`, backgroundSize: "256px 256px", backgroundPosition: `${gx}px ${gy}px`,
        mixBlendMode: dark ? "screen" : "multiply", opacity: dark ? 0.07 : PX.grain, filter: dark ? undefined : "brightness(1.5)",
      }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 82% 76% at 50% 50%, transparent 52%, ${dark ? "rgba(0,0,0,0.55)" : "rgba(21,26,43,0.20)"} 100%)` }} />
    </AbsoluteFill>
  );
};

// --- Les mots : minuscules, petits, centrés ; chacun arrive en 6 images (fondu + montée de 6 px) ----------------------------------
export type PWord = { readonly t: string; readonly at: number; readonly color?: string; readonly deco?: React.ReactNode; readonly br?: boolean };
export const Words: React.FC<{
  readonly words: readonly PWord[]; readonly f: number; readonly size?: number; readonly color?: string; readonly out?: number;
  readonly align?: "center" | "left"; readonly weight?: number; readonly style?: React.CSSProperties;
}> = ({ words, f, size = 36, color = PX.ink, out, align = "center", weight = 600, style }) => {
  const lines: PWord[][] = [];
  words.forEach((w, i) => { if (i === 0 || w.br) lines.push([]); lines[lines.length - 1].push(w); });
  return (
    <div style={{ fontFamily: display, fontWeight: weight, fontSize: size, lineHeight: 1.5, letterSpacing: "-0.012em", color, textAlign: align, ...style }}>
      {lines.map((line, li) => (
        <div key={li} style={{ display: "flex", justifyContent: align === "center" ? "center" : "flex-start", columnGap: "0.3em", whiteSpace: "nowrap" }}>
          {line.map((w) => {
            const up = ramp(f, w.at, w.at + 6), gone = out === undefined ? 0 : ramp(f, out, out + 6, 0, 1, LIN);
            return (
              <span key={w.t + w.at} style={{ position: "relative", display: "inline-block", opacity: up * (1 - gone), translate: `0 ${(1 - up) * 6}px`, color: w.color }}>
                {w.t}
                {w.deco}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// --- Le trait dessiné à la main : un tracé SVG qui se dessine (stroke-dashoffset), p de 0 à 1 ---------------------------------------
export const Hand: React.FC<{
  readonly d: string; readonly box: readonly [number, number]; readonly p: number; readonly style: React.CSSProperties;
  readonly color?: string; readonly width?: number;
}> = ({ d, box, p, style, color = PX.brand, width = 3.2 }) =>
  p <= 0.001 ? null : (
    <svg width={box[0]} height={box[1]} viewBox={`0 0 ${box[0]} ${box[1]}`} style={{ position: "absolute", overflow: "visible", pointerEvents: "none", ...style }}>
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
    </svg>
  );

// --- L'ellipse blanche en orbite (1,5 px) : la moitié du fond passe derrière le sujet, celle de devant par-dessus ; un point la parcourt ---
export const Orbit: React.FC<{
  readonly f: number; readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number; readonly tilt: number;
  readonly layer: "back" | "front"; readonly color?: string; readonly a?: number; readonly spin?: number; readonly dot?: number;
}> = ({ f, cx, cy, rx, ry, tilt, layer, color = "#ffffff", a = 1, spin = 0.5, dot = 0.07 }) => {
  const phi = f * dot, front = layer === "front";
  const dx = rx * Math.cos(phi), dy = ry * Math.sin(phi), inLayer = Math.sin(phi) >= 0 === front;
  return (
    <svg width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
      <g transform={`translate(${cx} ${cy}) rotate(${tilt + f * spin})`}>
        <path d={`M ${-rx} 0 A ${rx} ${ry} 0 0 ${front ? 0 : 1} ${rx} 0`} fill="none" stroke={color} strokeWidth={1.5} opacity={a * (front ? 0.95 : 0.4)} />
        {inLayer && <circle cx={dx} cy={dy} r={front ? 4.5 : 3} fill={color} opacity={a * (front ? 1 : 0.5)} />}
      </g>
    </svg>
  );
};

// --- L'éclat de lumière : un croissant flou, du bleu au violet de la marque, qui balaie l'écran en `dur` images ------------------------
export const Leak: React.FC<{
  readonly f: number; readonly at: number; readonly dur?: number; readonly from?: string; readonly to?: string;
  readonly dir?: 1 | -1; readonly angle?: number; readonly screen?: boolean;
}> = ({ f, at, dur = 14, from = PX.brand, to = PX.violet, dir = 1, angle = -16, screen = false }) => {
  if (f < at || f > at + dur) return null;
  const u = clamp((f - at) / dur, 0, 1), t = ramp(f, at, at + dur, 0, 1, CAM);
  const x = lerp(-1500, 1500, dir > 0 ? t : 1 - t), env = Math.sin(Math.PI * u);
  const id = `lk${at}`;
  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      <svg width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`} style={{
        position: "absolute", inset: 0, overflow: "visible", filter: "blur(34px)", opacity: 0.95 * env, mixBlendMode: screen ? "screen" : "normal",
        transform: `translateX(${x}px) rotate(${angle}deg)`, transformOrigin: "50% 50%",
      }}>
        <defs>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={from} /><stop offset="1" stopColor={to} /></linearGradient>
          <mask id={`${id}m`}><rect x="-2000" y="-2000" width="5000" height="5000" fill="#fff" /><circle cx={PCX + 330 * dir} cy={PCY} r={900} fill="#000" /></mask>
          <mask id={`${id}n`}><rect x="-2000" y="-2000" width="5000" height="5000" fill="#fff" /><circle cx={PCX + 200 * dir} cy={PCY} r={620} fill="#000" /></mask>
        </defs>
        <circle cx={PCX} cy={PCY} r={900} fill={`url(#${id}g)`} mask={`url(#${id}m)`} />
        <circle cx={PCX - 260 * dir} cy={PCY + 60} r={620} fill={`url(#${id}g)`} mask={`url(#${id}n)`} opacity={0.6} />
      </svg>
    </AbsoluteFill>
  );
};

// --- La dissolution en carrés : un clip-path fait des cellules visibles ; chaque cellule a son instant, stable (graine) --------------
// p : 0 → tout est caché ; 1 → tout est visible (pas de clip)
export const pixelClip = (w: number, h: number, cell: number, p: number, seed: string): string | undefined => {
  if (p >= 0.999) return undefined;
  let d = "";
  for (let cy = 0; cy < Math.ceil(h / cell); cy++) for (let cx = 0; cx < Math.ceil(w / cell); cx++) {
    if (random(`${seed}${cx}_${cy}`) < p) d += `M${cx * cell} ${cy * cell}h${cell}v${cell}h${-cell}z`;
  }
  return `path('${d || "M0 0"}')`;
};

// --- Une icône pixel art centrée sur (x, y) -------------------------------------------------------------------------------------------
export const Icon: React.FC<{
  readonly name: SpriteName; readonly x: number; readonly y: number; readonly size: number; readonly rot?: number; readonly blur?: number;
  readonly opacity?: number; readonly scale?: number; readonly depth?: number; readonly palette?: Palette; readonly glow?: string; readonly scaleX?: number;
}> = ({ name, x, y, size, rot = 0, blur = 0, opacity = 1, scale = 1, depth = 5, palette, glow, scaleX = 1 }) =>
  scale <= 0.001 || opacity <= 0.001 ? null : (
    <At x={x} y={y} style={{ scale: String(scale) }}>
      <Sprite sprite={SPRITES[name]} size={size} rot={rot} blur={blur} opacity={opacity} depth={depth} palette={palette} glow={glow} scaleX={scaleX} />
    </At>
  );

// --- Une fenêtre arrondie (16 px, ombre douce) qui se dissout / se reconstitue en carrés de 24 px ------------------------------------
export const BAR = 34;
export const Win: React.FC<{
  readonly cx: number; readonly cy: number; readonly w: number; readonly h: number; readonly p?: number; readonly seed: string;
  readonly children: React.ReactNode; readonly scale?: number; readonly bar?: boolean;
}> = ({ cx, cy, w, h, p = 1, seed, children, scale = 1, bar = true }) => {
  const H = h + (bar ? BAR : 0);
  if (p <= 0.001) return null;
  return (
    <div style={{ position: "absolute", left: cx - w / 2, top: cy - H / 2, width: w, height: H, scale: String(scale) }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 16, opacity: p * p * p, boxShadow: "0 1px 2px rgba(21,26,43,0.10), 0 22px 46px -14px rgba(21,26,43,0.30)" }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: 16, overflow: "hidden", background: "#fff", clipPath: pixelClip(w, H, 24, p, seed) }}>
        {bar && (
          <div style={{ height: BAR, display: "flex", alignItems: "center", gap: 7, padding: "0 14px", background: "#F4F5F9", borderBottom: "1px solid rgba(21,26,43,0.08)" }}>
            {["#FF6B5E", "#FFC53D", "#3DD16F"].map((c) => <span key={c} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />)}
          </div>
        )}
        <div style={{ position: "relative", width: w, height: h, overflow: "hidden", background: "#fff" }}>{children}</div>
      </div>
    </div>
  );
};

// --- Une séquence filmée : recadrée en « cover » ; si elle est plus courte que son plan, on la ralentit (jamais d'écran vide) -------
// Durées en secondes, mesurées avec ffprobe (public/footage)
export const FOOTAGE_SEC: Readonly<Record<string, number>> = { feed: 4, heatmap: 3, ai: 4.5, alerts: 4, light: 3, globe: 5, mobile: 4 };
export const Footage: React.FC<{ readonly name: string; readonly from: number; readonly frames: number; readonly w: number; readonly h: number }> = ({ name, from, frames, w, h }) => (
  <Sequence from={from} durationInFrames={frames} layout="none">
    <Video src={staticFile(`footage/${name}.mp4`)} muted objectFit="cover" playbackRate={Math.min(1, (FOOTAGE_SEC[name] * 60) / frames)}
      style={{ position: "absolute", inset: 0, width: w, height: h }} />
  </Sequence>
);

// --- Petites aides de mouvement ----------------------------------------------------------------------------------------------------------
// Une dérive douce (flottement) propre à chaque objet : amplitude en px
export const bob = (f: number, phase: number, amp = 6, period = 45) => Math.sin(f / period + phase) * amp;
export { OUT };
