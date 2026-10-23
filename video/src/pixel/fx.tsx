// Les briques communes de la publicité pixel art : le fond « papier » (ou nuit) avec son grain, les mots qui arrivent un
// par un, le trait dessiné à la main, l'ellipse en orbite, l'éclat de lumière, la dissolution en carrés, la séquence filmée,
// et les aides de mouvement (courbes à dépassement, punch d'échelle, parallaxe, entrées et sorties de plan).
// Tout est calculé à partir du numéro de l'image `f` (jamais l'horloge).
import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Easing, Img, Sequence, random, staticFile } from "remotion";
import { At, CAM, IN, LIN, OUT, clamp, display, lerp, pop, ramp, rgba } from "../kit";
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
      <AbsoluteFill style={{ mixBlendMode: dark ? "screen" : "multiply", opacity: dark ? 0.07 : PX.grain, filter: dark ? undefined : "contrast(0.55) brightness(1.85)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: gx - 256, top: gy - 256, width: 6 * 256, display: "flex", flexWrap: "wrap" }}>
          {Array.from({ length: 6 * 7 }, (_, i) => <Img key={i} src={staticFile("grain.png")} style={{ width: 256, height: 256, display: "block" }} />)}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 82% 76% at 50% 50%, transparent 52%, ${dark ? "rgba(0,0,0,0.55)" : "rgba(21,26,43,0.15)"} 100%)` }} />
    </AbsoluteFill>
  );
};

// --- Les courbes et les aides de mouvement ------------------------------------------------------------------------------------------
export const BACK = Easing.bezier(0.34, 1.56, 0.64, 1);  // entrée vive qui dépasse (~8 %) puis se pose
export const SOFT = Easing.bezier(0.3, 1.28, 0.5, 1);  // le même, avec un dépassement léger
// Le « punch » d'un temps fort : l'échelle monte vite à 1 + amp (en `up` images) puis revient à 1 en douceur (`down` images)
export const punch = (f: number, at: number, amp = 0.04, up = 3, down = 18) =>
  f < at ? 1 : f < at + up ? 1 + (amp * (f - at)) / up : 1 + amp * (1 - ramp(f, at + up, at + up + down, 0, 1, OUT));
// La parallaxe : un lent travelling de caméra ; chaque plan le suit plus ou moins (k = 0 le fond lointain, 1 le premier plan)
export const drift = (f: number, k: number): readonly [number, number] => [Math.sin(f / 150) * 15 * k, Math.sin(f / 190 + 1) * 9 * k];
export const Layer: React.FC<{ readonly f: number; readonly k: number; readonly children: React.ReactNode }> = ({ f, k, children }) => {
  const [x, y] = drift(f, k);
  return <div style={{ position: "absolute", inset: 0, translate: `${x}px ${y}px` }}>{children}</div>;
};

// L'entrée et la sortie d'un plan (cf. cut-catalog) : la coupe tombe en plein mouvement, flou et opacité au plus haut du geste
//   fwd : on fonce vers l'écran (la scène qui part grossit, celle qui arrive grossit aussi, depuis 0,8) ;
//   inv : on recule (celle qui part rétrécit, celle qui arrive est trop grande et se pose) ;
//   left, right, up, down : « cut the curve », même sens des deux côtés de la coupe.
export type Cut = "fwd" | "inv" | "left" | "right" | "up" | "down";
const CUT_SCALE_IN = { fwd: 0.8, inv: 1.22 }, CUT_SCALE_OUT = { fwd: 1.2, inv: 0.82 }, CUT_DIST = 150, CUT_BLUR = 12;
const cutShift = (k: Cut | undefined, sign: 1 | -1): [number, number] => {
  const d = CUT_DIST * sign;
  return k === "left" ? [-d, 0] : k === "right" ? [d, 0] : k === "up" ? [0, -d] : k === "down" ? [0, d] : [0, 0];
};
export const Shot: React.FC<{
  readonly f: number; readonly from: number; readonly to: number; readonly enter?: Cut; readonly exit?: Cut;
  readonly inDur?: number; readonly outDur?: number; readonly punch?: number; readonly children: React.ReactNode;
}> = ({ f, from, to, enter, exit, inDur = 12, outDur = 7, punch: pu = 1, children }) => {
  const a = enter ? ramp(f, from, from + inDur, 0, 1, OUT) : 1;  // 0 → 1 à l'entrée
  const z = exit ? ramp(f, to - outDur, to - 1, 0, 1, IN) : 0;  // 0 → 1 jusqu'à la coupe
  const sIn = enter === "fwd" || enter === "inv" ? lerp(CUT_SCALE_IN[enter], 1, a) : 1;
  const sOut = exit === "fwd" || exit === "inv" ? lerp(1, CUT_SCALE_OUT[exit], z) : 1;
  const [ix, iy] = cutShift(enter, 1), [ox, oy] = cutShift(exit, 1);
  const x = ix * (1 - a) + ox * z, y = iy * (1 - a) + oy * z;
  const blur = CUT_BLUR * ((enter ? 1 - a : 0) + z), op = (enter ? lerp(0.15, 1, clamp(a * 2.2, 0, 1)) : 1) * (1 - 0.85 * clamp(z / 0.85, 0, 1));
  const s = sIn * sOut * pu;
  const style: React.CSSProperties = { position: "absolute", inset: 0 };
  if (s !== 1) style.scale = String(s);
  if (x !== 0 || y !== 0) style.translate = `${x}px ${y}px`;
  if (blur > 0.2) style.filter = `blur(${blur}px)`;
  if (op < 0.999) style.opacity = op;
  return <div style={style}>{children}</div>;
};

// --- Les mots : minuscules, petits, centrés ; chacun arrive en 9 images (fondu net, montée de 18 px qui dépasse un peu, flou qui
// se dissipe), et le bloc respire (flotte d'un pixel ou deux) sans jamais être figé ------------------------------------------------------
export type PWord = { readonly t: string; readonly at: number; readonly color?: string; readonly deco?: React.ReactNode; readonly br?: boolean };
export const Words: React.FC<{
  readonly words: readonly PWord[]; readonly f: number; readonly size?: number; readonly color?: string; readonly out?: number;
  readonly align?: "center" | "left"; readonly weight?: number; readonly style?: React.CSSProperties;
}> = ({ words, f, size = 46, color = PX.ink, out, align = "center", weight = 600, style }) => {
  const lines: PWord[][] = [];
  words.forEach((w, i) => { if (i === 0 || w.br) lines.push([]); lines[lines.length - 1].push(w); });
  const breathe = Math.sin(f / 58 + words[0].at) * 1.6;
  return (
    <div style={{ fontFamily: display, fontWeight: weight, fontSize: size, lineHeight: 1.5, letterSpacing: "-0.012em", color, textAlign: align, translate: `0 ${breathe}px`, ...style }}>
      {lines.map((line, li) => (
        <div key={li} style={{ display: "flex", justifyContent: align === "center" ? "center" : "flex-start", columnGap: "0.3em", whiteSpace: "nowrap" }}>
          {line.map((w) => {
            const a = ramp(f, w.at, w.at + 9, 0, 1, BACK), fade = ramp(f, w.at, w.at + 5, 0, 1, LIN), gone = out === undefined ? 0 : ramp(f, out, out + 7, 0, 1, IN);
            const blur = (1 - clamp(a, 0, 1)) * 5 + gone * 7;
            return (
              <span key={w.t + w.at} style={{
                position: "relative", display: "inline-block", opacity: fade * (1 - gone), translate: `0 ${(1 - a) * 18 - gone * 16}px`,
                scale: String(0.9 + 0.1 * a + gone * 0.1), filter: blur > 0.2 ? `blur(${blur}px)` : undefined, color: w.color,
              }}>
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
// Il se place dans la boîte du mot qu'il décore (le <span> du mot, en position relative) : `style` donne left / top / width en
// POURCENTAGES de ce mot, la hauteur suit le rapport de `box` ; le tracé grandit donc avec le texte, quelle que soit sa taille.
export const Hand: React.FC<{
  readonly d: string; readonly box: readonly [number, number]; readonly p: number; readonly style: React.CSSProperties;
  readonly color?: string; readonly width?: number;
}> = ({ d, box, p, style, color = PX.brand, width = 2.4 }) =>
  p <= 0.001 ? null : (
    <svg viewBox={`0 0 ${box[0]} ${box[1]}`} style={{ position: "absolute", overflow: "visible", pointerEvents: "none", height: "auto", aspectRatio: `${box[0]} / ${box[1]}`, ...style }}>
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
    </svg>
  );

// --- La flèche « vers le bas » dessinée au trait (la police n'a pas le caractère ↓) ; elle apparaît puis rebondit doucement ----------------
export const Arrow: React.FC<{ readonly f: number; readonly at: number; readonly x: number; readonly y: number; readonly size?: number; readonly color?: string }> = ({ f, at, x, y, size = 54, color = PX.brand }) => {
  if (f < at) return null;
  const s = pop(f, at, 12, 170), t = (f - at) / 34;
  const hop = Math.abs(Math.sin(Math.PI * t)) * 13 * (1 - 0.35 * Math.min(1, t / 6));  // un rebond doux, toutes les 34 images
  return (
    <At x={x} y={y + hop - (1 - Math.min(1, s)) * 18} style={{ scale: String(0.6 + 0.4 * s), opacity: clamp(s * 1.6, 0, 1) }}>
      <svg width={size} height={size * 1.1} viewBox="0 0 40 44" fill="none" stroke={color} strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round" style={{ overflow: "visible" }}>
        <path d="M 20 4 L 20 38" />
        <path d="M 6 25 L 20 39 L 34 25" />
      </svg>
    </At>
  );
};

// --- L'ellipse en orbite (1,6 px), comme une vraie orbite en 3D : la demi-ellipse du haut passe DERRIÈRE le sujet (plus pâle), celle du
// bas DEVANT ; un petit point la parcourt (avec une courte traînée) et change de plan avec elle. L'inclinaison reste fixe (elle ne
// respire que de ±1,6°) ; p de 0 à 1 la trace à l'entrée. On l'appelle deux fois (layer "back" sous le sujet, "front" par-dessus). ---
export const Orbit: React.FC<{
  readonly f: number; readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number; readonly tilt: number;
  readonly layer: "back" | "front"; readonly color?: string; readonly a?: number; readonly dot?: number; readonly p?: number;
}> = ({ f, cx, cy, rx, ry, tilt, layer, color = "#ffffff", a = 1, dot = 0.07, p = 1 }) => {
  if (p <= 0.001 || a <= 0.001) return null;
  const front = layer === "front", phi = f * dot + 0.6;
  const at = (ph: number) => ({ x: rx * Math.cos(ph), y: ry * Math.sin(ph), inLayer: Math.sin(ph) >= 0 === front });
  const head = at(phi), trail = [1, 2, 3, 4, 5].map((j) => ({ ...at(phi - j * 0.07 * Math.sign(dot)), j }));
  return (
    <svg width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
      <g transform={`translate(${cx} ${cy}) rotate(${tilt + Math.sin(f / 70) * 1.6}) scale(${0.84 + 0.16 * Math.min(1, p)})`} opacity={clamp(p * 1.4, 0, 1)}>
        <path d={`M ${-rx} 0 A ${rx} ${ry} 0 0 ${front ? 0 : 1} ${rx} 0`} fill="none" stroke={color} strokeWidth={1.6} opacity={a * (front ? 0.95 : 0.38)}
          pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
        {trail.filter((t) => t.inLayer).map((t) => <circle key={t.j} cx={t.x} cy={t.y} r={(front ? 4.2 : 2.8) * (1 - t.j * 0.14)} fill={color} opacity={a * (front ? 0.5 : 0.25) * (1 - t.j * 0.17)} />)}
        {head.inLayer && <circle cx={head.x} cy={head.y} r={front ? 4.8 : 3.2} fill={color} opacity={a * (front ? 1 : 0.5)} />}
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
  readonly shade?: number;
}> = ({ name, x, y, size, rot = 0, blur = 0, opacity = 1, scale = 1, depth = 5, palette, glow, scaleX = 1, shade }) =>
  scale <= 0.001 || opacity <= 0.001 ? null : (
    <At x={x} y={y} style={{ scale: String(scale) }}>
      <Sprite sprite={SPRITES[name]} size={size} rot={rot} blur={blur} opacity={opacity} depth={depth} palette={palette} glow={glow} scaleX={scaleX} shade={shade} />
    </At>
  );

// --- Une fenêtre arrondie (16 px, ombre douce) qui se dissout / se reconstitue en carrés de 24 px ------------------------------------
// `lift` (0 → 1, peut dépasser) : sa présence à l'entrée ; elle monte de 70 px, grossit de 0,92 à 1 et son ombre s'installe
export const BAR = 34;
export const Win: React.FC<{
  readonly cx: number; readonly cy: number; readonly w: number; readonly h: number; readonly p?: number; readonly seed: string;
  readonly children: React.ReactNode; readonly scale?: number; readonly bar?: boolean; readonly lift?: number;
}> = ({ cx, cy, w, h, p = 1, seed, children, scale = 1, bar = true, lift = 1 }) => {
  const H = h + (bar ? BAR : 0), l = clamp(lift, 0, 1.15), lc = clamp(lift, 0, 1);
  if (p <= 0.001) return null;
  return (
    <div style={{ position: "absolute", left: cx - w / 2, top: cy - H / 2, width: w, height: H, scale: String(scale * (0.92 + 0.08 * l)), translate: `0 ${(1 - lift) * 70}px` }}>
      <div style={{
        position: "absolute", inset: 0, borderRadius: 16, opacity: p * p * p,
        boxShadow: `0 1px 2px rgba(21,26,43,${0.05 + 0.05 * lc}), 0 ${6 + 16 * lc}px ${18 + 28 * lc}px -14px rgba(21,26,43,${0.1 + 0.2 * lc})`,
      }} />
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
export const FOOTAGE_SEC: Readonly<Record<string, number>> = { feed: 4, heatmap: 3, ai: 5.9, alerts: 4, light: 3, globe: 5, mobile: 4 };
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
