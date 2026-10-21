// B, les dépêches (temps 8 → 12,5) : le point devient une pastille « Marchés » qui compte ses dépêches, trois autres
// rubriques la rejoignent, une accolade les réunit sous le total ; puis la caméra monte vers l'assistant.
import React from "react";
import { useCurrentFrame } from "remotion";
import { C, CAM, At, Glyph, GlyphName, b, count, display, focus, glass, lerp, pop, ramp, sans } from "../kit";

// Les quatre rubriques du fil (core/config.py) ; le total est leur somme
const TOPICS: readonly { readonly name: string; readonly icon: GlyphName; readonly n: number; readonly at: number }[] = [
  { name: "Marchés", icon: "chart", n: 86, at: b(8) },
  { name: "Économie", icon: "bank", n: 71, at: b(8.75) },
  { name: "Entreprises", icon: "building", n: 48, at: b(9.25) },
  { name: "Crypto", icon: "coin", n: 43, at: b(9.75) },
];
const TOTAL_N = TOPICS.reduce((a, t) => a + t.n, 0);
const PILL = { w: 272, h: 112 };
const slot = (i: number) => 960 + (i - 1.5) * 345;

const Pill: React.FC<{ readonly f: number; readonly i: number; readonly x: number; readonly y: number; readonly scale: number; readonly first: boolean }> = ({ f, i, x, y, scale, first }) => {
  const t = TOPICS[i];
  // La première naît du point de la scène A (disque blanc de 26 px) ; les autres entrent au point, en ressort
  const g = pop(f, t.at, 14, 150);
  const d0 = 26 / 1.45;  // le point de A mesure 26 px à l'écran, la première pastille naît à l'échelle 1,45
  const w = first ? lerp(d0, PILL.w, g) : PILL.w, h = first ? lerp(d0, PILL.h, g) : PILL.h;
  const white = first ? 1 - ramp(f, t.at, t.at + 14) : 0;
  const enter = first ? 1 : ramp(f, t.at, t.at + 12);
  const inner = ramp(f, t.at + (first ? 8 : 3), t.at + (first ? 20 : 14));
  const label = ramp(f, t.at + 8, t.at + 22);
  return (
    <At x={x} y={y} style={{ scale: String(scale * (first ? 1 : lerp(0.55, 1, g))), ...focus(enter, 14) }}>
      <div style={{ position: "relative", width: w, height: h, borderRadius: h / 2, ...glass(2.5, 24), display: "flex", alignItems: "center", justifyContent: "center", gap: 16, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: white, borderRadius: h / 2 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16, ...focus(inner, 10) }}>
          <Glyph name={t.icon} size={40} color={C.ink} stroke={2.2} />
          <span style={{ fontFamily: display, fontWeight: 800, fontSize: 56, letterSpacing: "-0.02em", color: C.ink, minWidth: 74 }}>{count(f, t.at + 4, t.at + b(1), 0, t.n)}</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: "50%", top: h + 24, translate: `-50% ${(1 - label) * 10}px`, fontFamily: sans, fontWeight: 500, fontSize: 32, color: C.muted, whiteSpace: "nowrap", opacity: label }}>
        {t.name}
      </div>
    </At>
  );
};

export const News: React.FC = () => {
  const f = useCurrentFrame();
  if (f < b(8) || f >= b(12.5)) return null;

  const row = ramp(f, b(10), b(10.6), 560, 660, CAM);
  const move = ramp(f, b(8.6), b(9.4), 0, 1, CAM);  // la première pastille quitte le centre pour sa place
  const draw = ramp(f, b(10.25), b(10.25) + 30, 0, 1, CAM);
  const total = ramp(f, b(10.5), b(10.5) + 14);
  const pan = ramp(f, b(11.5), b(12.5), 0, 1, CAM);
  const breathe = 1 + 0.025 * ramp(f, b(8), b(12.5), 0, 1, (t) => t);
  const live = 0.5 + 0.5 * Math.sin((f - b(10.5)) / 7);

  // L'accolade : du cran central vers chaque bout, qui redescend vers la première et la dernière pastille
  const y0 = row - 104, half = (dir: 1 | -1) => {
    const end = slot(dir === 1 ? 3 : 0);
    return `M 960 ${y0 - 22} L ${960 + dir * 20} ${y0} L ${end - dir * 26} ${y0} Q ${end} ${y0} ${end} ${y0 + 26} L ${end} ${y0 + 34}`;
  };

  return (
    <div style={{ position: "absolute", inset: 0, translate: `0 ${-700 * pan}px`, scale: String(breathe), opacity: 1 - ramp(f, b(12), b(12.5)), filter: pan > 0 ? `blur(${12 * pan}px)` : undefined }}>
      {TOPICS.map((_, i) => (
        <Pill key={i} f={f} i={i} first={i === 0}
          x={i === 0 ? lerp(960, slot(0), move) : slot(i)} y={i === 0 ? lerp(540, row, Math.max(move, ramp(f, b(10), b(10.6), 0, 1, CAM))) : row}
          scale={i === 0 ? lerp(1.45, 1, move) : 1} />
      ))}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible", filter: "drop-shadow(0 0 8px rgba(255,255,255,0.55))" }}>
        {([1, -1] as const).map((d) => (
          <path key={d} d={half(d)} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
            pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} opacity={draw > 0.001 ? 0.92 : 0} />
        ))}
      </svg>
      <At x={960} y={row - 330} style={{ ...focus(total, 16), translate: `-50% calc(-50% + ${(1 - total) * 16}px)`, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 36, color: C.muted }}>Dépêches du moment</div>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <span style={{ fontFamily: display, fontWeight: 800, fontSize: 150, letterSpacing: "-0.035em", color: C.ink, lineHeight: 1.08 }}>{count(f, b(10.5), b(11.4), 0, TOTAL_N)}</span>
          <span style={{ width: 18, height: 18, borderRadius: 9, background: C.dot, boxShadow: `0 0 ${10 + 14 * live}px ${C.dot}`, marginTop: 10 }} />
        </div>
      </At>
    </div>
  );
};
