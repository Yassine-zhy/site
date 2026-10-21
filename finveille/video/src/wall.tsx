// Les cartes de dépêches : le mur (S1, S2, S4), l'entonnoir (S6), les colonnes (S7).
import React from "react";
import { COLORS, OUT, W, clamp, display, lerp, mod, ramp, rnd, sans, useAbs } from "./kit";

// --- 1. Le mur : 28 × 14 cartes, chacune avec un titre en deux barres grises -----------------------------------------------
const COLS = 28, ROWS = 14, PX = 1920 / COLS, PY = 1080 / ROWS, CW = PX - 12, CH = PY - 12;
const CARD_FILL = "#0C1322", CARD_LINE = "#1B2845", BAR = "#2A3652";
const HEROES = [  // S4 : les trois cartes qui comptent (colonne, rangée, couleur, libellé)
  { c: 8, r: 6, color: COLORS.up, label: "Hausse" },
  { c: 14, r: 6, color: COLORS.down, label: "Baisse" },
  { c: 20, r: 6, color: COLORS.brand, label: "À la une" },
];
const cards = Array.from({ length: COLS * ROWS }, (_, i) => {
  const c = i % COLS, r = Math.floor(i / COLS);
  const d = Math.hypot((c - 13.5) / 14, (r - 6.5) / 7);
  const h = rnd(`card${i}`);
  return {
    i, c, r, ap: d < 0.34 ? 1 + h * 46 : 55 + d * 30 + h * 6,  // quelques cartes seules d'abord, puis la vague depuis le centre à « milliers »
    flashAt: rnd(`fa${i}`) * 36, flashUp: rnd(`fu${i}`) > 0.5, flashy: rnd(`fy${i}`) < 0.14,
  };
});

export const Wall: React.FC<{ readonly mode: "open" | "close" }> = ({ mode }) => {
  const f = useAbs();
  const open = mode === "open";
  // S2 : le mur défile en diagonale ; S4 : il est immobile
  const drift = open ? Math.max(0, Math.min(f, 210) - 120) : 0;
  const dx = drift * 1.25, dy = drift * 0.8;
  const base = open ? lerp(1, 0.5, ramp(f, 120, 134)) : 1;
  const tCompr = W("L04", "comprendre"), tCompte = W("L04", "compte");
  const dim = open ? 1 : lerp(1, 0.07, ramp(f, tCompr, tCompr + 6));
  const flashing = open && f >= W("L01", "marchés");
  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
      {cards.map((k) => {
        const hero = !open && HEROES.some((h) => h.c === k.c && h.r === k.r);
        const pop = ramp(f, k.ap, k.ap + 9);
        if (pop <= 0) return null;
        const x = mod(k.c * PX + dx, 1920) + 6, y = mod(k.r * PY + dy, 1080) + 6;
        // l'éclat de l'arrivée, puis le clignotement vert et rouge de « marchés »
        const arrive = 1 - ramp(f, k.ap, k.ap + 20, [0, 1], OUT);
        let fl = 0;
        if (flashing && k.flashy) {
          const ph = mod(f - W("L01", "marchés") - k.flashAt, 40);
          fl = ph < 12 ? Math.sin((ph / 12) * Math.PI) : 0;
        }
        const col = k.flashUp ? COLORS.up : COLORS.down;
        const o = pop * base * (hero ? 1 : dim);
        const stroke = fl > 0.02 ? col : arrive > 0.05 ? COLORS.brand : CARD_LINE;
        const sc = lerp(0.7, 1, pop);
        return (
          <g key={k.i} transform={`translate(${x + CW / 2} ${y + CH / 2}) scale(${sc}) translate(${-CW / 2} ${-CH / 2})`} opacity={hero && f >= tCompte ? 0 : o}>
            <rect width={CW} height={CH} rx={9} fill={fl > 0.02 ? col : CARD_FILL} fillOpacity={fl > 0.02 ? 0.12 + 0.3 * fl : 1} stroke={stroke} strokeOpacity={fl > 0.02 ? 0.4 + 0.6 * fl : Math.max(0.5, arrive)} strokeWidth={1.5} />
            <rect x={8} y={12} width={CW * 0.72} height={6} rx={3} fill={fl > 0.02 ? col : BAR} fillOpacity={fl > 0.02 ? 0.5 + 0.5 * fl : 1} />
            <rect x={8} y={25} width={CW * 0.46} height={6} rx={3} fill={fl > 0.02 ? col : BAR} fillOpacity={fl > 0.02 ? 0.5 + 0.5 * fl : 1} />
            <rect x={8} y={CH - 18} width={CW * 0.28} height={5} rx={2.5} fill={BAR} opacity={0.6} />
          </g>
        );
      })}
    </svg>
  );
};

// S4 : à « compte », trois cartes grandissent et s'allument (une verte, une rouge, une bleue)
export const HeroCards: React.FC = () => {
  const f = useAbs();
  const t = W("L04", "compte");
  return (
    <>
      {HEROES.map((h, i) => {
        const p = ramp(f, t + i * 3, t + i * 3 + 12);
        if (p <= 0) return null;
        const w = lerp(CW, 380, p), hh = lerp(CH, 440, p);
        const cx = h.c * PX + PX / 2, cy = h.r * PY + PY / 2;
        const up = h.color === COLORS.up, flat = h.color === COLORS.brand;
        const pts = flat ? "0,70 40,50 80,60 120,30 160,38 200,10" : up ? "0,80 40,66 80,70 120,40 160,28 200,6" : "0,6 40,22 80,18 120,52 160,60 200,84";
        return (
          <div key={i} style={{
            position: "absolute", left: cx - w / 2, top: cy - hh / 2, width: w, height: hh, borderRadius: lerp(9, 26, p), background: "#0E1628",
            border: `${lerp(1.5, 5, p)}px solid ${h.color}`, boxShadow: `0 0 ${80 * p}px ${h.color}66, 0 40px 80px -30px #000`, overflow: "hidden",
          }}>
            <div style={{ opacity: p, padding: 34 }}>
              <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 30, color: h.color }}>{h.label}</div>
              <div style={{ marginTop: 26, height: 16, width: "86%", borderRadius: 8, background: "#33415f" }} />
              <div style={{ marginTop: 16, height: 16, width: "58%", borderRadius: 8, background: "#33415f" }} />
              <svg viewBox="0 0 200 90" width={w - 68} style={{ marginTop: 44, overflow: "visible" }}>
                <polyline points={pts} fill="none" stroke={h.color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        );
      })}
    </>
  );
};

// --- 2. L'entonnoir (S6) : des dizaines de cartes volent des bords vers la fenêtre centrale --------------------------------
const CAT = [COLORS.brand, "#FFA94D", "#9B7BFF", COLORS.up];
export const Funnel: React.FC<{ readonly from: number; readonly to: number }> = ({ from, to }) => {
  const f = useAbs();
  return (
    <>
      {Array.from({ length: 72 }, (_, i) => {
        const a = rnd(`fn${i}`) * Math.PI * 2;
        const cs = Math.cos(a), sn = Math.sin(a);
        const k = 1 / Math.max(Math.abs(cs) / 1200, Math.abs(sn) / 740);  // un point du rectangle qui entoure l'écran
        const x0 = 960 + cs * k, y0 = 540 + sn * k;
        const t0 = from + rnd(`ft${i}`) * (to - from);
        const p = clamp((f - t0) / 32, 0, 1);
        if (f < t0 || p >= 1) return null;
        const e = p * (0.55 + 0.45 * p);  // une accélération douce : les cartes restent visibles en vol
        const x = lerp(x0, 960, e), y = lerp(y0, 500, e);
        return (
          <div key={i} style={{ position: "absolute", left: x - 95, top: y - 60, width: 190, height: 120, borderRadius: 12, background: "#0E1628", border: `1.5px solid ${COLORS.line}`, scale: String(lerp(1, 0.4, e)), rotate: `${(1 - e) * 0 + (rnd(`fr${i}`) - 0.5) * 24 * (1 - e)}deg`, padding: 16, boxSizing: "border-box" }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: CAT[i % 4] }} />
            <div style={{ marginTop: 14, height: 10, width: "86%", borderRadius: 5, background: BAR }} />
            <div style={{ marginTop: 10, height: 10, width: "58%", borderRadius: 5, background: BAR }} />
            <div style={{ marginTop: 16, height: 8, width: "34%", borderRadius: 4, background: BAR, opacity: 0.6 }} />
          </div>
        );
      })}
    </>
  );
};

// --- 3. Les colonnes (S7) : les cartes se rangent en 4 rubriques, décalées de 3 images ------------------------------------------
export const COLUMNS = [
  { name: "Marchés", color: COLORS.brand }, { name: "Crypto", color: "#FFA94D" }, { name: "Entreprises", color: "#9B7BFF" }, { name: "Macro", color: COLORS.up },
];
export const Columns: React.FC<{ readonly start: number }> = ({ start }) => {
  const f = useAbs();
  const tTrie = W("L07", "trie");
  return (
    <>
      {COLUMNS.map((col, j) => {
        const x = 96 + j * 444;
        const p = ramp(f, tTrie + j * 3, tTrie + j * 3 + 10);
        return (
          <div key={col.name} style={{ position: "absolute", left: x, top: 118, width: 396, opacity: p, translate: `0 ${(1 - p) * 24}px` }}>
            <div style={{ fontFamily: display, fontWeight: 900, fontSize: 62, letterSpacing: "-0.04em", color: COLORS.ink, lineHeight: 1 }}>{col.name}</div>
            <div style={{ marginTop: 18, height: 6, width: `${p * 100}%`, borderRadius: 3, background: col.color }} />
          </div>
        );
      })}
      {Array.from({ length: 20 }, (_, i) => {
        const j = i % 4, m = Math.floor(i / 4);
        const t0 = start + j * 3 + m * 5;
        const p = ramp(f, t0, t0 + 11);
        const x1 = 96 + j * 444, y1 = 250 + m * 130;
        const x0 = 90 + rnd(`cx${i}`) * 1500, y0 = 120 + rnd(`cy${i}`) * 700;
        const rot = (rnd(`cr${i}`) - 0.5) * 36 * (1 - p);
        return (
          <div key={i} style={{ position: "absolute", left: lerp(x0, x1, p), top: lerp(y0, y1, p), width: 396, height: 104, borderRadius: 14, background: "#0E1628", border: `1.5px solid ${COLORS.line}`, rotate: `${rot}deg`, overflow: "hidden", scale: String(lerp(0.62, 1, p)) }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, background: p > 0.6 ? COLUMNS[j].color : CAT[(i * 3) % 4] }} />
            <div style={{ position: "absolute", left: 30, top: 28, height: 12, width: "74%", borderRadius: 6, background: BAR }} />
            <div style={{ position: "absolute", left: 30, top: 52, height: 12, width: "48%", borderRadius: 6, background: BAR }} />
            <div style={{ position: "absolute", left: 30, top: 78, height: 8, width: "22%", borderRadius: 4, background: BAR, opacity: 0.6 }} />
          </div>
        );
      })}
    </>
  );
};
