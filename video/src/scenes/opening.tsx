// L'ouverture (temps 0 → 12) : l'icône de FinVeille se dessine, son nom et sa phrase apparaissent ; un curseur vient,
// appuie au temps 8, au moment où la musique se coupe ; on garde le doigt appuyé pendant le silence ; au temps 10, quand
// la musique repart, l'icône s'agrandit jusqu'à remplir l'écran de bleu (l'application s'ouvre), puis le bleu s'efface
// sur les dépêches de la scène suivante.
import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { At, C, CAM, Halo, IN, LogoMark, OUT, b, clamp, display, focus, lerp, pop, ramp, sans } from "../kit";

const ICON = 220, IY = 420;  // l'icône : taille, hauteur de son centre
const LAUNCH = Easing.bezier(0.75, 0, 0.15, 1);  // l'ouverture : lente au départ, très rapide au milieu

// Le pointeur de la souris (dessiné, 24 × 36 dans son repère), pointe en (0, 0)
const Pointer: React.FC<{ readonly x: number; readonly y: number; readonly s: number; readonly a: number }> = ({ x, y, s, a }) => (
  <svg width={60} height={80} viewBox="-2 -2 30 40" style={{ position: "absolute", left: x - 2 * 2.4 * s, top: y - 2 * 2.4 * s, width: 60 * s, height: 80 * s, opacity: a, filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.55))", overflow: "visible" }}>
    <path d="M0 0 L0 25 L6.2 19.6 L10.4 29 L14.6 27.2 L10.5 18 L18.5 18 Z" fill="#fff" stroke="#0b0d14" strokeWidth={1.6} strokeLinejoin="round" />
  </svg>
);

export const Opening: React.FC = () => {
  const f = useCurrentFrame();
  if (f > b(12) + 16) return null;

  // L'icône : mise au point, dessin du logo, reflet ; survol, appui, ouverture
  const appear = ramp(f, 0, b(1.6), 0, 1, OUT);
  const draw = ramp(f, 10, b(3), 0, 1, (t) => t);
  const sheen = ramp(f, b(3.2), b(4.6), 0, 1, CAM);
  const hover = ramp(f, b(7), b(7) + 10);
  const pressed = f < b(8) ? 0 : f < b(10) ? pop(f, b(8), 16, 260) : 1 - ramp(f, b(10), b(10) + 6);
  const launch = ramp(f, b(10), b(11.3), 0, 1, LAUNCH);
  const scale = lerp(1.18, 1, appear) * (1 + 0.05 * hover - 0.1 * pressed);
  const size = lerp(ICON, 2300, launch), radius = lerp(ICON / 4, 0, ramp(f, b(10.4), b(11.2), 0, 1, CAM));
  const cy = lerp(IY, 540, launch);
  const charge = f < b(8) ? 0 : ramp(f, b(8), b(10), 0, 1, (t) => t);  // la lueur se charge pendant le silence
  const blueOut = ramp(f, b(12), b(12) + 16, 0, 1, CAM);  // le bleu qui remplit l'écran s'efface

  // Le nom, la phrase : ils entrent, puis s'effacent pendant le silence
  const name = (i: number) => ramp(f, b(2.2) + i * 3, b(2.2) + i * 3 + 16);
  const tag = ramp(f, b(4), b(4) + 18);
  const away = ramp(f, b(8.4), b(9.4), 0, 1, IN);

  // Le curseur : il arrive en courbe sur l'icône, s'enfonce, puis s'efface
  const mv = ramp(f, b(5), b(7), 0, 1, CAM);
  const px = lerp(1560, 985, mv) + Math.sin(mv * Math.PI) * 60, py = lerp(980, IY + 30, mv) - Math.sin(mv * Math.PI) * 40;
  const ptrA = ramp(f, b(5), b(5) + 10) * (1 - ramp(f, b(9.6), b(10.1)));
  const ptrS = 1 - 0.12 * pressed;

  // Les ondes de l'appui
  const ring = (at: number) => (f < at ? -1 : (f - at) / 34);

  return (
    <AbsoluteFill style={{ opacity: 1 - blueOut, filter: blueOut > 0 ? `blur(${blueOut * 16}px)` : undefined, scale: String(1 + 0.08 * blueOut) }}>
      <Halo x={960} y={cy} r={lerp(380, 700, charge)} color={C.brand} a={(0.35 + 0.45 * charge + 0.25 * hover) * appear * (1 - launch)} />
      {[b(8), b(9)].map((at) => {
        const t = ring(at);
        return t < 0 || t > 1 ? null : (
          <At key={at} x={960} y={IY}>
            <div style={{ width: lerp(ICON, ICON * 2.6, OUT(t)), height: lerp(ICON, ICON * 2.6, OUT(t)), borderRadius: lerp(ICON / 4, ICON * 1.3, OUT(t)), border: "2px solid rgba(160,190,255,0.85)", opacity: 0.8 * (1 - t) }} />
          </At>
        );
      })}

      {/* L'icône, qui devient l'écran de l'application */}
      <At x={960} y={cy} style={{ scale: String(launch > 0 ? 1 : scale), ...focus(appear, 22) }}>
        <div style={{
          position: "relative", width: size, height: size, borderRadius: radius, overflow: "hidden",
          background: "linear-gradient(135deg, #3b6cff, #1536b4)",
          boxShadow: `0 0 ${50 + 70 * charge}px rgba(59,108,255,${0.5 + 0.35 * charge}), 0 30px 80px -30px rgba(0,0,0,0.9), inset 0 ${-14 * pressed}px 30px rgba(0,0,0,${0.35 * pressed})`,
        }}>
          <div style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%", opacity: 1 - ramp(f, b(10), b(10.5)) }}>
            <LogoMark size={ICON} p={draw} square={false} id="open" />
          </div>
          {/* le reflet qui passe sur l'icône */}
          <div style={{ position: "absolute", top: -ICON * 0.3, left: lerp(-ICON, ICON * 1.4, sheen), width: ICON * 0.45, height: ICON * 1.6, rotate: "20deg", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)", filter: "blur(8px)", opacity: sheen > 0 && sheen < 1 ? 1 : 0 }} />
        </div>
      </At>

      {/* Le nom et la phrase de la marque */}
      <div style={{ position: "absolute", left: 0, width: 1920, top: 590, display: "flex", justifyContent: "center", fontFamily: display, fontWeight: 900, fontSize: 112, letterSpacing: "-0.04em", lineHeight: 1, opacity: 1 - away, filter: away > 0 ? `blur(${away * 14}px)` : undefined }}>
        {[..."FinVeille"].map((ch, i) => (
          <span key={i} style={{ display: "inline-block", color: i < 3 ? C.ink : C.brand, ...focus(name(i), 20), translate: `0 ${(1 - name(i)) * 30}px` }}>{ch}</span>
        ))}
      </div>
      <At x={960} y={760} style={{ fontFamily: sans, fontWeight: 500, fontSize: 38, color: C.muted, whiteSpace: "nowrap", ...focus(tag * (1 - away), 14), translate: `-50% calc(-50% + ${(1 - tag) * 14}px)` }}>
        Toute la finance qui compte, en un seul site.
      </At>

      <Pointer x={px} y={py} s={ptrS} a={ptrA} />
      {/* un éclair blanc très bref quand l'écran bleu est plein */}
      <AbsoluteFill style={{ background: "#fff", opacity: 0.35 * clamp(1 - Math.abs(f - b(11.3)) / 8, 0, 1) }} />
    </AbsoluteFill>
  );
};
