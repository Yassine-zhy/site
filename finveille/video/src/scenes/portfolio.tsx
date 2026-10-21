// F, le portefeuille (temps 25 → 28) : le carré vide de la cloche (fin de E) s'arrondit en cercle, l'anneau de la
// répartition se dessine, la valeur grimpe ; puis le cercle s'étire en pastille, qui sera le bouton de G.
import React from "react";
import { useCurrentFrame } from "remotion";
import { At, C, CAM, Halo, IN, b, clamp, count, display, focus, glass, lerp, mixHex, pop, ramp, sans } from "../kit";

// La répartition du portefeuille d'entraînement (parts en %, dans l'ordre du tracé)
const PARTS = [
  { name: "Actions", share: 55, color: C.brand },
  { name: "ETF", share: 30, color: C.up },
  { name: "Crypto", share: 15, color: C.violet },
];
const R = 150, GAP = 3.2;  // rayon de l'anneau ; écart entre deux parts, en % du tour

export const Portfolio: React.FC = () => {
  const f = useCurrentFrame();
  if (f < b(25) || f >= b(28)) return null;

  const m = ramp(f, b(25), b(25.8), 0, 1, CAM);  // carré de la cloche → cercle
  const x = ramp(f, b(27.4), b(28), 0, 1, CAM);  // cercle → pastille du bouton
  const size = lerp(200, 400, m);
  const w = lerp(size, 640, x), h = lerp(size, 120, x);
  const radius = lerp(lerp(52, 200, m), 60, x);
  const cy = lerp(lerp(540, 500, m), 540, x);
  const tint = mixHex(C.amber, "#ffffff", m);
  const fill: [string, string] = [mixHex("#221b10", "#181a22", m), mixHex("#100d08", "#0d0e14", m)];

  const draw = ramp(f, b(25.5), b(26.6), 0, 100, CAM);
  const gone = ramp(f, b(27.3), b(27.7), 0, 1, IN);  // tout ce qui n'est pas la forme s'efface avant l'étirement
  const center = ramp(f, b(25.9), b(25.9) + 14) * (1 - gone);
  const title = ramp(f, b(25.8), b(25.8) + 16) * (1 - gone);
  const gain = pop(f, b(26.75));

  let start = 0;
  const arcs = PARTS.map((p) => {
    const a = start;
    start += p.share;
    return { ...p, len: clamp(draw - a, 0, p.share - GAP), from: a };
  });

  return (
    <>
      <Halo x={960} y={cy} r={360} color={C.amber} a={0.3 * (1 - m)} />
      <Halo x={960} y={cy} r={lerp(300, 420, m)} color={C.up} a={0.22 * m * (1 - x)} />
      <At x={960} y={cy}>
        <div style={{ width: w, height: h, borderRadius: radius, ...glass(2.5, 26, tint, fill) }} />
      </At>
      {/* L'anneau : une piste sombre, puis les trois parts qui se dessinent l'une après l'autre */}
      <At x={960} y={cy} style={{ opacity: m * (1 - gone), filter: gone > 0 ? `blur(${gone * 10}px)` : undefined }}>
        <svg width={400} height={400} viewBox="0 0 400 400" style={{ display: "block", overflow: "visible" }}>
          <circle cx={200} cy={200} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={26} />
          {arcs.map((a) => (
            <circle key={a.name} cx={200} cy={200} r={R} fill="none" stroke={a.color} strokeWidth={26} strokeLinecap="round" pathLength={100}
              strokeDasharray={`${a.len} ${100 - a.len}`} strokeDashoffset={25 - a.from - GAP / 2} opacity={a.len > 0.2 ? 1 : 0}
              style={{ filter: `drop-shadow(0 0 10px ${a.color})` }} />
          ))}
        </svg>
      </At>
      <At x={960} y={cy} style={{ ...focus(center, 12), display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 54, letterSpacing: "-0.03em", color: C.ink, whiteSpace: "nowrap" }}>
          {count(f, b(25.9), b(27), 10000, 10842)}{" "}€
        </div>
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 28, color: C.up, padding: "6px 16px", borderRadius: 20, background: "rgba(52,209,127,0.14)",
          opacity: clamp(gain * 1.5, 0, 1), scale: String(lerp(0.6, 1, gain)) }}>
          +8,42{" "}%
        </div>
      </At>
      <At x={960} y={cy + 268} style={{ ...focus(title, 14), display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 38, color: C.ink, whiteSpace: "nowrap" }}>Portefeuille d’entraînement</div>
        <div style={{ display: "flex", gap: 34 }}>
          {PARTS.map((p, i) => {
            const k = ramp(f, b(26.25) + i * 6, b(26.25) + i * 6 + 12);
            return (
              <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: sans, fontWeight: 500, fontSize: 28, color: C.muted, opacity: k, translate: `0 ${(1 - k) * 10}px` }}>
                <span style={{ width: 14, height: 14, borderRadius: 7, background: p.color, boxShadow: `0 0 10px ${p.color}` }} />
                {p.name}
              </div>
            );
          })}
        </div>
      </At>
    </>
  );
};
