// A, le marché (temps 0 → 8) : la carte du CAC 40, inclinée, sort du noir pendant l'intro calme ; au drop (temps 4)
// la barre du jour s'allume, la carte se redresse, la caméra plonge dans la barre, qui devient un point de lumière.
import React from "react";
import { Easing, useCurrentFrame } from "remotion";
import { C, CAM, IN, OUT, b, clamp, count, display, focus, lerp, pop, ramp, sans } from "../kit";

// La carte (repère local, en px) et son graphique de la semaine : 5 barres, la dernière (vendredi) est le héros
const CARD = { w: 1180, h: 700 };
const CHART = { x: 70, y: 250, w: 1040, h: 330 };
const DAYS = ["lun.", "mar.", "mer.", "jeu.", "ven."];
const HEIGHTS = [0.52, 0.4, 0.66, 0.48, 0.88];
const BAR_W = 150, AVG = 0.58;
const bar = (i: number) => {
  const h = HEIGHTS[i] * CHART.h;
  return { x: CHART.x + i * (CHART.w / 5) + (CHART.w / 5 - BAR_W) / 2, y: CHART.y + CHART.h - h, h };
};
const HERO = bar(4);
const HERO_C = { x: HERO.x + BAR_W / 2, y: HERO.y + HERO.h / 2 };
const ZOOM = 2.2;  // à cette échelle, la barre du jour remplit le centre de l'écran
const DRIFT = Easing.bezier(0.33, 0, 0.67, 1);

// La lumière de la barre du jour : dégradé bleu → vert, halo
const heroFill = "linear-gradient(0deg, #2F6BFF 0%, #4FA8E0 55%, #6EE7A8 100%)";
const heroGlow = (k: number) => `0 0 ${50 * k}px rgba(110,231,168,${0.55 * k}), 0 0 ${130 * k}px rgba(47,107,255,${0.35 * k})`;

export const Market: React.FC = () => {
  const f = useCurrentFrame();
  if (f >= b(8)) return null;

  // La caméra : dérive lente pendant l'intro, redressement au drop, plongée vers la barre du jour
  const theta = f < b(4) ? lerp(66, 52, DRIFT(clamp(f / b(4), 0, 1))) : ramp(f, b(4), b(6), 52, 0, CAM);
  const phi = f < b(4) ? lerp(-14, -8, DRIFT(clamp(f / b(4), 0, 1))) : ramp(f, b(4), b(6), -8, 0, CAM);
  const s = f < b(4) ? lerp(1.3, 1.42, DRIFT(clamp(f / b(4), 0, 1))) : f < b(5.5) ? ramp(f, b(4), b(5.5), 1.42, 0.92, CAM) : ramp(f, b(5.5), b(7), 0.92, ZOOM, CAM);
  const dive = ramp(f, b(5.5), b(7), 0, 1, CAM);
  const px = lerp(CARD.w / 2, HERO_C.x, dive), py = f < b(4) ? lerp(300, 380, DRIFT(clamp(f / b(4), 0, 1))) : lerp(360, HERO_C.y, dive);

  const appear = ramp(f, 0, b(1.5), 0, 1, Easing.bezier(0.3, 0, 0.3, 1));
  const leave = ramp(f, b(7), b(7.6), 0, 1, IN);  // la carte s'efface, la barre devient le point
  const lit = ramp(f, b(4), b(4) + 16);  // la barre du jour se remplit de lumière
  const flash = f < b(4) ? 0 : Math.exp(-(f - b(4)) / 20);
  const avg = ramp(f, b(4.25), b(5), 0, 1, OUT);
  const pill = pop(f, b(4.5));

  // Le point : la barre du jour, en coordonnées d'écran, qui se resserre en un disque de 26 px
  const m = ramp(f, b(7), b(7.8), 0, 1, CAM);
  const dw = lerp(BAR_W * ZOOM, 26, m), dh = lerp(HERO.h * ZOOM, 26, m), dr = lerp(18 * ZOOM, 13, m);
  const breathe = 1 + 0.06 * Math.sin(Math.max(0, f - b(7.8)) / 6);

  return (
    <div style={{ position: "absolute", inset: 0, perspective: 1700, perspectiveOrigin: "960px 540px" }}>
      <div
        style={{
          position: "absolute", left: 0, top: 0, width: CARD.w, height: CARD.h, transformOrigin: "0 0",
          transform: `translate(960px, 540px) rotateX(${theta}deg) rotateZ(${phi}deg) scale(${s}) translate(${-px}px, ${-py}px)`,
          ...focus(appear * (1 - leave), 24),
        }}
      >
        {/* Le verre de la carte */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 44, border: "2px solid transparent",
          background: "linear-gradient(180deg, #151720, #0b0c12) padding-box, linear-gradient(140deg, rgba(255,255,255,0.75), rgba(255,255,255,0.12) 40%, rgba(255,255,255,0.05) 65%, rgba(255,255,255,0.4)) border-box",
          boxShadow: `0 0 ${30 + 60 * flash}px rgba(160,190,255,${0.14 + 0.25 * flash}), 0 60px 120px -40px rgba(0,0,0,0.9)`,
        }} />
        {/* L'en-tête : l'indice, son niveau, sa variation */}
        <div style={{ position: "absolute", left: 70, top: 62, display: "flex", alignItems: "center", gap: 14, fontFamily: sans, fontWeight: 600, fontSize: 34, color: C.muted }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: C.dot, boxShadow: `0 0 ${10 + 14 * flash}px ${C.dot}` }} />
          CAC 40
          <span style={{ fontWeight: 500, fontSize: 26, color: C.dim, marginLeft: 8 }}>cette semaine</span>
        </div>
        <div style={{ position: "absolute", left: 66, top: 104, fontFamily: display, fontWeight: 800, fontSize: 104, letterSpacing: "-0.03em", color: C.ink }}>
          {count(f, b(0.8), b(4), 7984.12, 8142.6, 2)}
        </div>
        <div style={{
          position: "absolute", right: 70, top: 128, padding: "10px 22px", borderRadius: 26, fontFamily: sans, fontWeight: 600, fontSize: 32,
          color: C.up, background: "rgba(52,209,127,0.14)", border: "1.5px solid rgba(52,209,127,0.45)",
          opacity: clamp(pill * 1.5, 0, 1), scale: String(lerp(0.6, 1, pill)), transformOrigin: "100% 50%",
        }}>
          +0,84{" "}%
        </div>
        {/* Le graphique : repères, barres, moyenne */}
        {[0.25, 0.5, 0.75].map((g) => (
          <div key={g} style={{ position: "absolute", left: CHART.x, top: CHART.y + CHART.h * (1 - g), width: CHART.w, height: 1.5, background: "rgba(255,255,255,0.05)" }} />
        ))}
        {HEIGHTS.map((_, i) => {
          const r = bar(i);
          const grow = ramp(f, b(0.9) + i * 9, b(2.9) + i * 9, 0, 1, OUT);
          const wave = f < b(4) ? 0 : Math.exp(-Math.max(0, f - b(4) - i * 3) / 14) * (f >= b(4) + i * 3 ? 1 : 0);
          const hero = i === 4;
          return (
            <div key={i} style={{ position: "absolute", left: r.x, top: r.y + r.h * (1 - grow), width: BAR_W, height: r.h * grow, borderRadius: 18, overflow: "hidden",
              background: `linear-gradient(180deg, rgba(255,255,255,${0.16 + 0.12 * wave}), rgba(255,255,255,${0.05 + 0.05 * wave}))`,
              boxShadow: hero ? heroGlow(lit) : undefined, opacity: hero && f >= b(7) ? 0 : 1 }}>
              {hero && <div style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: `${lit * 100}%`, background: heroFill }} />}
            </div>
          );
        })}
        <svg width={CARD.w} height={CARD.h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <line x1={CHART.x} x2={CHART.x + CHART.w} y1={CHART.y + CHART.h * (1 - AVG)} y2={CHART.y + CHART.h * (1 - AVG)} stroke="rgba(255,255,255,0.4)" strokeWidth={2.5}
            strokeDasharray="10 12" pathLength={1000} style={{ clipPath: `inset(0 ${(1 - avg) * 100}% 0 0)` }} />
        </svg>
        <div style={{ position: "absolute", left: CHART.x, top: CHART.y + CHART.h * (1 - AVG) - 38, fontFamily: sans, fontWeight: 500, fontSize: 22, color: C.dim, opacity: avg }}>moyenne</div>
        {DAYS.map((d, i) => (
          <div key={d} style={{ position: "absolute", left: bar(i).x, top: CHART.y + CHART.h + 22, width: BAR_W, textAlign: "center", fontFamily: sans, fontWeight: 500, fontSize: 26,
            color: i === 4 ? `rgba(242,244,250,${0.45 + 0.55 * lit})` : C.dim }}>{d}</div>
        ))}
      </div>

      {/* Le point : la barre du jour, reprise à l'écran à l'image où la caméra s'arrête, qui se resserre */}
      {f >= b(7) && (
        <div style={{
          position: "absolute", left: 960 - (dw * breathe) / 2, top: 540 - (dh * breathe) / 2, width: dw * breathe, height: dh * breathe, borderRadius: dr * breathe,
          background: heroFill, overflow: "hidden", boxShadow: `${heroGlow(1 - m * 0.6)}, 0 0 ${26 * m}px rgba(255,255,255,${0.7 * m})`,
        }}>
          <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: m }} />
        </div>
      )}
    </div>
  );
};
