// Scène « L’économie et la crypto » (temps 44 - 56) : la courbe des taux en relief qui change de forme à chaque temps, trois
// pastilles d’indicateurs, puis trois pièces de crypto en verre qui entrent en tournant et qui flottent.
// Visible de b(43.5) à b(56.5) ; le montage fait l’entrée (glissé) et la sortie (zoom).
import React from "react";
import { useCurrentFrame } from "remotion";
import { BEAT, C, CAM, Glyph, Halo, H, IN, LIN, Sparks, Title, W, b, clamp, display, focus, glass, lerp, mix, num, pop, ramp, rgba, sans } from "../kit";

const NN = " ";  // espace fine insécable
const E0 = b(43.5), E1 = b(56.5), P2 = b(50);
const TEAL = "#3DD6C6";
const LIGHT = "#C9BAFF";  // le violet de la rubrique Économie, éclairci pour les traits fins

// --- La courbe des taux : 4 courbes l’une derrière l’autre, des formes qui se mélangent à chaque temps -----------------------------
const SH = [
  [0.22, 0.30, 0.38, 0.52, 0.64, 0.72, 0.78],  // normale
  [0.50, 0.58, 0.62, 0.60, 0.58, 0.56, 0.55],  // aplatie, bossue
  [0.72, 0.66, 0.58, 0.50, 0.46, 0.44, 0.42],  // inversée
  [0.12, 0.22, 0.36, 0.56, 0.74, 0.86, 0.92],  // pentue
];
const SEQ = [0, 1, 2, 1, 0, 3, 1, 0, 2, 3, 0, 1, 2, 0, 3, 1];
const shapeAt = (f: number): number[] => {
  const n = Math.floor(f / BEAT), n0 = Math.round(n * BEAT);
  const u = ramp(f, n0, n0 + 26);
  const L = SEQ.length, a = SH[SEQ[(((n - 1) % L) + L) % L]], z = SH[SEQ[((n % L) + L) % L]];
  return a.map((v, i) => lerp(v, z[i], u));
};
// Une courbe lisse (Catmull-Rom → Bézier) par des points
const smooth = (pts: readonly (readonly [number, number])[]) => {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
};
const CCX = 1405, CW = 750, BASE = 635, DEPTH = 82, AMP = 300;
const LABELS = ["3 mois", "2 ans", "10 ans", "30 ans"];
const curvePts = (f: number, k: number): (readonly [number, number])[] => {
  const h = shapeAt(f - k * 7), sk = 1 - 0.09 * k, amp = AMP * (1 - 0.1 * k), base = BASE - k * DEPTH;
  return h.map((v, i) => [CCX + (i / 6 - 0.5) * CW * sk, base - v * amp + Math.sin(f / 22 + i * 0.9 - k * 0.7) * 7] as const);
};

const YieldCurves: React.FC<{ readonly f: number }> = ({ f }) => {
  const front = curvePts(f, 0), ph = (f / BEAT) % 1;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        {[0, 1, 2, 3].map((k) => (
          <linearGradient key={k} id={`ecg${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.violet} stopOpacity={0.42 - 0.06 * k} /><stop offset="1" stopColor={C.violet} stopOpacity={0.02} />
          </linearGradient>
        ))}
      </defs>
      {/* Le sol en perspective : les maturités filent vers le fond */}
      {[0, 2, 4, 6].map((i) => {
        const a = curvePts(E0, 0)[i], z = curvePts(E0, 3)[i];
        return <line key={i} x1={a[0]} y1={BASE} x2={z[0]} y2={BASE - 3 * DEPTH} stroke="#fff" strokeOpacity={0.08} strokeWidth={1.5} strokeDasharray="3 9" strokeDashoffset={-f * 0.5} />;
      })}
      {[3, 2, 1, 0].map((k) => {
        const pts = curvePts(f, k), base = BASE - k * DEPTH, d = smooth(pts);
        return (
          <g key={k} opacity={1 - 0.2 * k}>
            <line x1={pts[0][0]} x2={pts[6][0]} y1={base} y2={base} stroke="#fff" strokeOpacity={0.14} strokeWidth={1.5} />
            <path d={`${d}L${pts[6][0]} ${base}L${pts[0][0]} ${base}Z`} fill={`url(#ecg${k})`} />
            <path d={d} fill="none" stroke={C.violet} strokeOpacity={0.3} strokeWidth={14 - 2 * k} strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} fill="none" stroke={k === 0 ? LIGHT : mix(LIGHT, C.violet, k / 3)} strokeWidth={5 - 0.7 * k} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      })}
      {/* Les quatre maturités de la courbe de devant */}
      {[0, 2, 4, 6].map((i, j) => (
        <g key={i}>
          <circle cx={front[i][0]} cy={front[i][1]} r={16 + 18 * ph} fill="none" stroke={LIGHT} strokeOpacity={0.5 * (1 - ph)} strokeWidth={2.5} />
          <circle cx={front[i][0]} cy={front[i][1]} r={12 + 2 * Math.sin(f / 10 + j)} fill={C.violet} fillOpacity={0.35} />
          <circle cx={front[i][0]} cy={front[i][1]} r={7.5} fill="#fff" />
          <text x={front[i][0]} y={BASE + 56} fill={C.muted} fontFamily={sans} fontWeight={600} fontSize={26} textAnchor="middle">{LABELS[j]}</text>
        </g>
      ))}
    </svg>
  );
};

// --- Les mini-courbes (points en 0 → 1, y vers le bas), qui se dessinent ------------------------------------------------------------
const miniPath = (pts: readonly (readonly [number, number])[], w: number, h: number, round: boolean) => {
  const P = pts.map(([x, y]) => [x * w, y * h] as const);
  return round ? smooth(P) : P.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
};
const Mini: React.FC<{
  readonly f: number; readonly at: number; readonly w: number; readonly h: number; readonly pts: readonly (readonly [number, number])[];
  readonly color: string; readonly round?: boolean; readonly sw?: number;
}> = ({ f, at, w, h, pts, color, round = true, sw = 4 }) => {
  const d = ramp(f, at, at + 40, 0, 1, CAM), end = pts[pts.length - 1], d0 = miniPath(pts, w, h, round);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      <path d={d0} fill="none" stroke={color} strokeOpacity={0.25} strokeWidth={sw + 6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - d} />
      <path d={d0} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - d} />
      <circle cx={end[0] * w} cy={end[1] * h} r={(sw + 2) * d} fill="#fff" />
      <circle cx={end[0] * w} cy={end[1] * h} r={(sw + 8 + 3 * Math.sin(f / 8)) * d} fill={color} fillOpacity={0.3} />
    </svg>
  );
};

// --- Les trois pastilles d’indicateurs ---------------------------------------------------------------------------------------------------
type PillSpec = { readonly label: string; readonly down: boolean; readonly at: number; readonly pts: readonly (readonly [number, number])[]; readonly round: boolean };
const PILLS: readonly PillSpec[] = [
  { label: "Taux directeurs", down: true, at: b(46), round: false, pts: [[0, 0.1], [0.26, 0.1], [0.26, 0.4], [0.58, 0.4], [0.58, 0.68], [1, 0.68]] },
  { label: "Inflation", down: true, at: b(46.5), round: true, pts: [[0, 0.12], [0.2, 0.28], [0.4, 0.2], [0.6, 0.48], [0.8, 0.62], [1, 0.8]] },
  { label: "Emploi", down: false, at: b(47), round: true, pts: [[0, 0.85], [0.2, 0.68], [0.4, 0.74], [0.6, 0.45], [0.8, 0.5], [1, 0.14]] },
];
const PW = 540, PH = 172, PY = 745;
const Pill: React.FC<{ readonly f: number; readonly i: number; readonly s: PillSpec }> = ({ f, i, s }) => {
  const pp = pop(f, s.at), out = ramp(f, b(49.6) + i * 5, b(49.6) + i * 5 + 24, 0, 1, IN);
  if (pp <= 0 || out >= 1) return null;
  const float = Math.sin(f / 38 + i * 1.7) * 5, x = 110 + i * (PW + 40);
  return (
    <div style={{
      position: "absolute", left: x, top: PY, width: PW, height: PH, borderRadius: 34, padding: "22px 30px", display: "flex", flexDirection: "column", rowGap: 14,
      transform: `translateY(${(1 - pp) * 80 + float + out * 280}px) scale(${0.8 + 0.2 * pp})`, opacity: clamp(pp * 2, 0, 1) * (1 - out),
      filter: out > 0.01 ? `blur(${out * 14}px)` : undefined, ...glass(2.5, 24 + 8 * Math.sin(f / 14 + i), C.violet),
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 34, color: C.ink }}>{s.label}</div>
        <div style={{ width: 52, height: 52, borderRadius: 26, background: rgba(C.violet, 0.22), border: `1.5px solid ${rgba(C.violet, 0.6)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Glyph name="arrowUp" size={28} color={LIGHT} style={{ rotate: s.down ? "180deg" : "0deg", translate: `0 ${Math.sin(f / 9 + i) * 2}px` }} />
        </div>
      </div>
      <Mini f={f} at={s.at + 8} w={PW - 60} h={56} pts={s.pts} color={LIGHT} round={s.round} />
    </div>
  );
};

// --- Les trois pièces ---------------------------------------------------------------------------------------------------------------------
type CoinSpec = { readonly sym: string; readonly name: string; readonly tint: string; readonly v: number; readonly x: number; readonly at: number; readonly pts: readonly (readonly [number, number])[] };
const COINS: readonly CoinSpec[] = [
  { sym: "₿", name: "Bitcoin", tint: "#FFB547", v: 1.8, x: 1040, at: b(50.5), pts: [[0, 0.8], [0.18, 0.62], [0.36, 0.7], [0.56, 0.4], [0.78, 0.46], [1, 0.12]] },
  { sym: "Ξ", name: "Ethereum", tint: "#8FA2FF", v: 2.4, x: 1370, at: b(51), pts: [[0, 0.7], [0.2, 0.78], [0.4, 0.5], [0.6, 0.55], [0.8, 0.28], [1, 0.1]] },
  { sym: "◎", name: "Solana", tint: TEAL, v: -0.6, x: 1700, at: b(51.5), pts: [[0, 0.2], [0.2, 0.34], [0.4, 0.24], [0.6, 0.5], [0.8, 0.42], [1, 0.66]] },
];
const CY = 440, R = 125;
const face = (tint: string, sym: string, flip: boolean): React.ReactNode => (
  <div style={{
    position: "absolute", inset: 0, borderRadius: "50%", backfaceVisibility: "hidden", transform: flip ? "rotateY(180deg)" : undefined,
    display: "flex", alignItems: "center", justifyContent: "center", ...glass(3.5, 34, tint, ["#1d2029", "#0b0c12"]),
  }}>
    <div style={{ position: "absolute", inset: 16, borderRadius: "50%", border: `2px solid ${rgba(tint, 0.35)}`, background: `radial-gradient(circle at 32% 26%, ${rgba(tint, 0.28)}, transparent 62%)` }} />
    <div style={{ position: "relative", fontFamily: display, fontWeight: 800, fontSize: 128, lineHeight: 1, color: tint, textShadow: `0 0 30px ${rgba(tint, 0.6)}` }}>{sym}</div>
  </div>
);
const Coin: React.FC<{ readonly f: number; readonly i: number; readonly s: CoinSpec }> = ({ f, i, s }) => {
  if (f < s.at) return null;
  const spin = ramp(f, s.at, s.at + 56), rot = (1 - spin) * 540, ph = (f / BEAT) % 1, pulse = Math.exp(-ph * 3.5);
  const land = pop(f, s.at + 6), info = ramp(f, s.at + 26, s.at + 48);
  const float = Math.sin(f / 30 + i * 2.1) * 12, tilt = Math.sin(f / 46 + i) * 9 * spin;
  const up = s.v >= 0, col = up ? C.up : C.down, name = (up ? "+" : "") + num(s.v, 1) + NN + "%";
  return (
    <>
      <Halo x={s.x} y={CY + float} r={250} color={s.tint} a={(0.22 + 0.3 * pulse) * clamp(spin * 1.5, 0, 1)} />
      {/* L’anneau pointillé qui tourne autour de la pièce */}
      <svg width={360} height={360} style={{ position: "absolute", left: s.x - 180, top: CY + float - 180, opacity: spin * 0.7, rotate: `${f * (i % 2 ? -0.35 : 0.35)}deg`, scale: String(1 + 0.03 * pulse) }}>
        <circle cx={180} cy={180} r={166} fill="none" stroke={s.tint} strokeOpacity={0.45} strokeWidth={2.5} strokeDasharray="2 14" strokeLinecap="round" />
      </svg>
      <div style={{
        position: "absolute", left: s.x - R, top: CY + float - R, width: 2 * R, height: 2 * R, opacity: clamp(land * 2, 0, 1),
        transform: `perspective(1100px) rotateY(${rot + tilt}deg) scale(${0.55 + 0.45 * land})`, transformStyle: "preserve-3d",
      }}>
        {face(s.tint, s.sym, false)}
        {face(s.tint, s.sym, true)}
      </div>
      <div style={{ position: "absolute", left: s.x - 150, top: 625, width: 300, display: "flex", flexDirection: "column", alignItems: "center", rowGap: 18, ...focus(info, 14), translate: `0 ${(1 - info) * 30}px` }}>
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 32, color: C.ink }}>{s.name}</div>
        <div style={{
          fontFamily: sans, fontWeight: 600, fontSize: 30, color: col, padding: "5px 22px", borderRadius: 999, background: rgba(col, 0.16), border: `1.5px solid ${rgba(col, 0.55)}`,
          boxShadow: `0 0 ${20 + 14 * pulse}px ${rgba(col, 0.3)}`,
        }}>{name}</div>
        <div style={{ marginTop: 8 }}><Mini f={f} at={s.at + 34} w={240} h={80} pts={s.pts} color={col} sw={4} /></div>
      </div>
    </>
  );
};

export const Eco: React.FC = () => {
  const f = useCurrentFrame();
  if (f < E0 || f > E1) return null;

  const cam = 1 + 0.035 * ramp(f, E0, E1, 0, 1, LIN);
  const e1 = ramp(f, b(49.6), b(50.6), 0, 1, IN);  // la courbe des taux s’en va
  const capIn = ramp(f, b(45.3), b(46.2)), capOut = ramp(f, b(49.4), b(50), 0, 1, IN), cap2 = ramp(f, b(51.4), b(52.3));

  return (
    <div style={{ position: "absolute", inset: 0, transform: `scale(${cam}) translate(${-ramp(f, E0, E1, 0, 18, LIN)}px, ${ramp(f, E0, E1, 0, -8, LIN)}px)` }}>
      <Halo x={1400} y={420} r={700} color={C.violet} a={0.16 * (1 - e1)} />
      <Halo x={1370} y={430} r={800} color={TEAL} a={0.14 * ramp(f, b(50.5), b(52))} />
      <div style={{ position: "absolute", inset: 0, opacity: 1 - ramp(f, b(49.5), b(51)) }}><Sparks f={f} n={34} seed="ev" color={LIGHT} a={0.55} /></div>
      <div style={{ position: "absolute", inset: 0, opacity: ramp(f, b(50), b(52)) }}><Sparks f={f} n={34} seed="et" color={TEAL} a={0.55} /></div>

      {/* Les titres */}
      <div style={{ position: "absolute", left: 110, top: 240 }}>
        {f < b(50.4) && <Title f={f} size={130} out={b(49.9)} words={[{ t: "L’économie.", at: b(44.5), color: C.violet }]} />}
      </div>
      <div style={{ position: "absolute", left: 110, top: 240 }}>
        {f >= b(50.2) && (
          <Title f={f} size={130} words={[
            { t: "Et", at: b(50.5) }, { t: "la", at: b(50.5) + 4 }, { t: "crypto.", at: b(50.5) + 8, br: true, color: TEAL },
          ]} />
        )}
      </div>
      <div style={{ position: "absolute", left: 114, top: 400, fontFamily: sans, fontWeight: 500, fontSize: 38, color: C.muted, lineHeight: 1.25, ...focus(capIn * (1 - capOut), 10), translate: `0 ${(1 - capIn) * 24}px` }}>
        Les grands indicateurs,<br />d’un coup d’œil.
      </div>
      <div style={{ position: "absolute", left: 114, top: 540, display: "flex", alignItems: "center", columnGap: 16, fontFamily: sans, fontWeight: 500, fontSize: 38, color: C.muted, ...focus(cap2, 10), translate: `0 ${(1 - cap2) * 24}px` }}>
        <span style={{ width: 14, height: 14, borderRadius: 7, background: C.dot, boxShadow: `0 0 ${10 + 12 * Math.exp(-((f / BEAT) % 1) * 3)}px ${C.dot}` }} />Les cours, en direct.
      </div>

      {/* La courbe des taux en relief, et les trois pastilles */}
      {f < b(50.8) && (
        <div style={{ position: "absolute", inset: 0, translate: `${e1 * 320}px ${-e1 * 50}px`, opacity: 1 - e1, filter: e1 > 0.01 ? `blur(${e1 * 18}px)` : undefined }}>
          <YieldCurves f={f} />
        </div>
      )}
      {f < b(50.8) && PILLS.map((s, i) => <Pill key={i} f={f} i={i} s={s} />)}

      {/* Les pièces */}
      {f >= P2 && COINS.map((s, i) => <Coin key={i} f={f} i={i} s={s} />)}
    </div>
  );
};
