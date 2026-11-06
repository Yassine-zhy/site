// La fin (temps 84 → 112) : tout ce qu'on a vu, en une mosaïque de 3 × 3 tuiles qui s'allument une à une autour du logo ;
// les tuiles s'envolent, le logo reste et grandit ; la phrase de la marque, l'adresse ; la musique s'arrête net au
// temps 106 (la cymbale résonne) ; fondu au noir. `showUrl` (vrai par défaut) montre l'adresse du site ; la version « TrailerSfx »
// la retire (la pastille « Gratuit, sans publicité » remonte alors d'un cran pour rester centrée sous la phrase).
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { At, C, CAM, Glyph, GlyphName, Halo, IN, LogoMark, Sparks, TOTAL, b, clamp, display, focus, glass, lerp, pop, ramp, rnd, sans } from "../kit";

const TW = 500, TH = 290, GAP = 26;
const TEAL = "#3DD6C6";
type Tile = { readonly label: string; readonly icon: GlyphName; readonly color: string; readonly mini: "news" | "line" | "heat" | "curves" | "coin" | "search" | "bell" | "ring" };
// Les huit tuiles autour du logo, dans l'ordre où elles s'allument (sens des aiguilles d'une montre depuis le haut à gauche)
const RING: readonly (readonly [number, number, Tile])[] = [
  [0, 0, { label: "L’actu", icon: "news", color: C.brand, mini: "news" }],
  [1, 0, { label: "Les marchés", icon: "chart", color: C.up, mini: "line" }],
  [2, 0, { label: "Le CAC 40", icon: "grid", color: C.up, mini: "heat" }],
  [2, 1, { label: "L’économie", icon: "bank", color: C.violet, mini: "curves" }],
  [2, 2, { label: "La crypto", icon: "coin", color: TEAL, mini: "coin" }],
  [1, 2, { label: "Les questions", icon: "search", color: C.brand, mini: "search" }],
  [0, 2, { label: "Les alertes", icon: "bell", color: C.amber, mini: "bell" }],
  [0, 1, { label: "Le portefeuille", icon: "pie", color: C.up, mini: "ring" }],
];
const cx = (col: number) => 960 + (col - 1) * (TW + GAP), cy = (row: number) => 545 + (row - 1) * (TH + GAP);

// La petite animation de chaque tuile (dans un cadre de 200 × 120, en haut à droite de la tuile)
const Mini: React.FC<{ readonly kind: Tile["mini"]; readonly f: number; readonly color: string }> = ({ kind, f, color }) => {
  const W = 200, H = 120;
  if (kind === "news") {
    const y0 = (f * 0.6) % 36;
    return (
      <svg width={W} height={H} style={{ overflow: "hidden" }}>
        {Array.from({ length: 6 }, (_, i) => <rect key={i} x={0} y={i * 36 - y0} width={[180, 140, 160, 120, 170, 130][i]} height={12} rx={6} fill={i % 2 ? "rgba(255,255,255,0.18)" : color} opacity={i % 2 ? 1 : 0.7} />)}
      </svg>
    );
  }
  if (kind === "line") {
    const pts = Array.from({ length: 30 }, (_, i) => [i * (W / 29), H * 0.75 - i * 2 - 14 * Math.sin(i / 3 + f / 20) * (i / 30)]);
    return (
      <svg width={W} height={H} style={{ overflow: "visible" }}>
        <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
        <circle cx={pts[29][0]} cy={pts[29][1]} r={7} fill="#fff" />
      </svg>
    );
  }
  if (kind === "heat") {
    return (
      <svg width={W} height={H}>
        {Array.from({ length: 15 }, (_, i) => {
          const v = Math.sin(i * 1.7 + Math.floor(f / 14) * 0.9);
          return <rect key={i} x={(i % 5) * 41} y={Math.floor(i / 5) * 41} width={36} height={36} rx={6} fill={v > 0 ? C.up : C.down} opacity={0.35 + 0.55 * Math.abs(v)} />;
        })}
      </svg>
    );
  }
  if (kind === "curves") {
    return (
      <svg width={W} height={H} style={{ overflow: "visible" }}>
        {[0, 1, 2].map((k) => {
          const d = Array.from({ length: 20 }, (_, i) => `${i ? "L" : "M"} ${i * (W / 19)} ${70 - k * 18 - 26 * Math.log1p(i / 4) * (0.6 + 0.4 * Math.sin(f / 30 + k))}`).join(" ");
          return <path key={k} d={d} fill="none" stroke={color} strokeWidth={3} opacity={1 - k * 0.3} />;
        })}
      </svg>
    );
  }
  if (kind === "coin") {
    const sx = Math.cos(f / 14);
    return (
      <div style={{ width: W, height: H, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: 104, height: 104, borderRadius: 52, scale: `${Math.max(0.08, Math.abs(sx))} 1`, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: display, fontWeight: 800, fontSize: 56, color: "#06121a", background: `linear-gradient(140deg, #9ff3ea, ${color})`, boxShadow: `0 0 26px ${color}` }}>₿</div>
      </div>
    );
  }
  if (kind === "search") {
    const n = Math.floor(f / 4) % 16;
    return (
      <div style={{ width: W, height: H, display: "flex", alignItems: "center" }}>
        <div style={{ width: W, height: 52, borderRadius: 26, border: `1.5px solid ${color}`, display: "flex", alignItems: "center", gap: 8, padding: "0 14px", boxSizing: "border-box", fontFamily: sans, fontWeight: 500, fontSize: 20, color: C.ink, whiteSpace: "nowrap", overflow: "hidden" }}>
          <Glyph name="search" size={20} color={color} />{"Pourquoi l’or…".slice(0, Math.min(n, 14))}<span style={{ width: 2, height: 22, background: color, opacity: Math.floor(f / 10) % 2 }} />
        </div>
      </div>
    );
  }
  if (kind === "bell") {
    const r = 14 * Math.sin(f / 3) * Math.max(0, Math.sin(f / 28));
    return (
      <div style={{ width: W, height: H, display: "flex", justifyContent: "center", alignItems: "center", position: "relative" }}>
        <div style={{ rotate: `${r}deg`, transformOrigin: "50% 10%" }}><Glyph name="bell" size={90} color="#FFD18A" stroke={2} /></div>
        <div style={{ position: "absolute", left: 118, top: 14, width: 30, height: 30, borderRadius: 15, background: C.down, color: "#fff", fontFamily: sans, fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>1</div>
      </div>
    );
  }
  // le portefeuille : l'anneau des trois parts, qui tourne
  const parts: readonly (readonly [number, string])[] = [[55, C.brand], [30, C.up], [15, TEAL]];
  let acc = 0;
  return (
    <svg width={W} height={H} viewBox="-100 -60 200 120">
      {parts.map(([share, col], i) => {
        const off = acc;
        acc += share;
        return <circle key={i} r={46} fill="none" stroke={col} strokeWidth={16} pathLength={100} strokeDasharray={`${share - 3} ${103 - share}`} strokeDashoffset={-off} transform={`rotate(${f * 0.8 - 90})`} strokeLinecap="round" />;
      })}
    </svg>
  );
};

export const Finale: React.FC<{ readonly showUrl?: boolean }> = ({ showUrl = true }) => {
  const f = useCurrentFrame();
  if (f < b(83.5)) return null;

  const settle = ramp(f, b(83.5), b(91), 0, 1, CAM);
  const fly = ramp(f, b(92), b(94.5), 0, 1, IN);  // les tuiles s'envolent
  const grow = ramp(f, b(92), b(95), 0, 1, CAM);  // le logo grandit et devient la signature
  const frameOff = ramp(f, b(93), b(95));
  const tag = ramp(f, b(97.5), b(97.5) + 18);
  const url = ramp(f, b(100), b(100) + 18);
  const free = pop(f, b(101.5));
  const stop = f < b(106) ? 0 : Math.exp(-(f - b(106)) / 30);
  const wave = f < b(106) ? -1 : (f - b(106)) / 50;
  const black = ramp(f, TOTAL - 60, TOTAL - 1, 0, 1, (t) => t);
  const lockY = lerp(cy(1), 470, grow);

  return (
    <AbsoluteFill>
      <Sparks f={f} n={50} seed="fin" color="#b8c8ff" a={0.45} />
      <Halo x={960} y={lockY} r={lerp(420, 700, grow) + 200 * stop} color={C.brand} a={0.3 + 0.35 * grow + 0.4 * stop} />

      {/* La mosaïque, légèrement inclinée, qui se redresse */}
      <AbsoluteFill style={{ perspective: 2000, perspectiveOrigin: "960px 540px" }}>
        <AbsoluteFill style={{ transform: `rotateX(${lerp(14, 0, settle)}deg) scale(${lerp(0.88, 1, settle)})` }}>
          {RING.map(([col, row, t], i) => {
            const at = b(84.5) + Math.round(i * b(0.5));
            const p = pop(f, at, 14, 150);
            const dx = cx(col) - 960, dy = cy(row) - 545, len = Math.hypot(dx, dy);
            const lit = f < at ? 0 : Math.exp(-(f - at) / 24);
            return (
              <div key={t.label} style={{
                position: "absolute", left: cx(col) - TW / 2, top: cy(row) - TH / 2, width: TW, height: TH, borderRadius: 34,
                ...glass(2, 18 + 30 * lit, t.color, ["#141722", "#0b0c12"]),
                translate: `${(dx / len) * 1400 * fly}px ${(dy / len) * 1400 * fly}px`, scale: String(lerp(0.6, 1, p) * (1 - 0.2 * fly)),
                ...focus(clamp(p * 1.3, 0, 1) * (1 - fly), 16),
              }}>
                <div style={{ position: "absolute", left: 30, top: 28 }}><Glyph name={t.icon} size={50} color={t.color} stroke={2.2} /></div>
                <div style={{ position: "absolute", right: 28, top: 26 }}><Mini kind={t.mini} f={f + Math.round(rnd(t.label) * 60)} color={t.color} /></div>
                <div style={{ position: "absolute", left: 30, bottom: 26, fontFamily: display, fontWeight: 800, fontSize: 46, letterSpacing: "-0.03em", color: C.ink, whiteSpace: "nowrap" }}>{t.label}</div>
              </div>
            );
          })}
          {/* La tuile du centre : le logo, qui devient la signature */}
          <At x={960} y={lockY} style={{ scale: String(lerp(1, 1.5, grow)), ...focus(clamp(pop(f, b(84)) * 1.3, 0, 1), 16) }}>
            <div style={{ position: "relative", width: TW, height: TH, display: "flex", alignItems: "center", justifyContent: "center", gap: 22 }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: 34, ...glass(2.5, 30, C.brand, ["#141a2e", "#0b0d16"]), opacity: 1 - frameOff }} />
              <div style={{ position: "relative", filter: `drop-shadow(0 0 ${24 + 40 * stop}px rgba(59,108,255,${0.6 + 0.4 * stop}))` }}><LogoMark size={110} p={ramp(f, b(84), b(86), 0, 1, (t) => t)} id="fin" /></div>
              <div style={{ position: "relative", fontFamily: display, fontWeight: 900, fontSize: 70, letterSpacing: "-0.04em", whiteSpace: "nowrap" }}>
                <span style={{ color: C.ink }}>Fin</span><span style={{ color: C.brand }}>Veille</span>
              </div>
            </div>
          </At>
        </AbsoluteFill>
      </AbsoluteFill>

      {wave >= 0 && wave <= 1 && (
        <At x={960} y={lockY}>
          <div style={{ width: lerp(300, 2000, CAM(wave)), height: lerp(300, 2000, CAM(wave)), borderRadius: "50%", border: "2px solid rgba(170,195,255,0.8)", opacity: 0.7 * (1 - wave) }} />
        </At>
      )}

      {/* La phrase, l'adresse, la gratuité */}
      <At x={960} y={690} style={{ ...focus(tag, 14), translate: `-50% calc(-50% + ${(1 - tag) * 16}px)`, fontFamily: sans, fontWeight: 500, fontSize: 46, color: C.ink, whiteSpace: "nowrap" }}>
        Toute la finance qui compte, en un seul site.
      </At>
      {showUrl && (
        <At x={960} y={790} style={{ ...focus(url, 14), translate: `-50% calc(-50% + ${(1 - url) * 16}px)`, fontFamily: sans, fontWeight: 600, fontSize: 44, color: C.brand, whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
          finveille.streamlit.app
        </At>
      )}
      <At x={960} y={showUrl ? 884 : 810} style={{ opacity: clamp(free * 1.4, 0, 1), scale: String(lerp(0.7, 1, free)) }}>
        <div style={{ padding: "12px 30px", borderRadius: 30, ...glass(1.5, 16, C.up, ["#10201a", "#0a120e"]), fontFamily: sans, fontWeight: 600, fontSize: 32, color: C.up, whiteSpace: "nowrap" }}>
          Gratuit, sans publicité
        </div>
      </At>
      {black > 0 && <AbsoluteFill style={{ background: "#000", opacity: black }} />}
    </AbsoluteFill>
  );
};
