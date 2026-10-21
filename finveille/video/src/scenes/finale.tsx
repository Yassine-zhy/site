// G et H, la fin (temps 28 → 37,2) : la pastille devient le bouton « Commencer », un reflet le balaie, on appuie ; le
// bouton se resserre en carré bleu, le logo s'y dessine sur l'accord final (temps 32), le nom entre au point, la phrase
// de la marque, puis l'adresse seule ; fondu au noir.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { At, C, CAM, Glyph, Halo, IN, LogoMark, TOTAL, b, clamp, display, focus, glass, lerp, ramp, sans } from "../kit";

const LOGO = 132;  // le carré du logo, en px
const WORD_W = 550;  // la largeur de « FinVeille » en Schibsted 900 à 132 px (mesurée sur un rendu)

export const Finale: React.FC = () => {
  const f = useCurrentFrame();
  if (f < b(28)) return null;

  // Le bouton (temps 28 → 32)
  const ready = ramp(f, b(28), b(28.4));
  const sweep = ramp(f, b(29), b(30.2), 0, 1, (t) => t);
  const lit = clamp(Math.sin(Math.PI * sweep), 0, 1);  // l'éclat du bouton pendant que le reflet passe
  const sharp = ramp(f, b(29.1), b(29.9));  // le texte devient net quand le reflet passe dessus
  const press = f < b(31) ? 0 : Math.sin(Math.min(1, (f - b(31)) / 12) * Math.PI);
  const rim = f < b(31) ? 0 : Math.exp(-(f - b(31)) / 16);
  const k = ramp(f, b(31.3), b(32), 0, 1, CAM);  // bouton → carré du logo
  const bw = lerp(640, LOGO, k), bh = lerp(120, LOGO, k), br = lerp(60, LOGO / 4, k);
  const text = (1 - ramp(f, b(31.3), b(31.6), 0, 1, IN));

  // Le logo (temps 32 →)
  const draw = ramp(f, b(32), b(32.9));
  const open = ramp(f, b(32.6), b(33.5), 0, 1, CAM);  // le nom écarte le logo vers la gauche
  const boom = f < b(32) ? 0 : Math.exp(-(f - b(32)) / 26);
  const wave = f < b(32) ? -1 : (f - b(32)) / 40;
  const tag = ramp(f, b(33.25), b(33.25) + 18);
  const away = ramp(f, b(35), b(35.5), 0, 1, IN);
  const url = ramp(f, b(35.4), b(35.9));
  const black = ramp(f, TOTAL - 55, TOTAL - 1, 0, 1, (t) => t);

  const lockW = LOGO + 34 * open + WORD_W * open;
  const markX = 960 - lockW / 2 + LOGO / 2;

  return (
    <>
      <Halo x={960} y={540} r={lerp(380, 620, 1 - boom)} color={C.brand} a={0.75 * boom * (1 - away)} />
      {wave >= 0 && wave <= 1 && (
        <At x={960} y={540}>
          <div style={{ width: lerp(150, 1500, CAM(wave)), height: lerp(150, 1500, CAM(wave)), borderRadius: "50%", border: "2px solid rgba(160,190,255,0.8)", opacity: 0.7 * (1 - wave) }} />
        </At>
      )}

      {/* Le bouton, puis le carré qui deviendra le logo */}
      {f < b(32) && (
        <At x={960} y={540} style={{ scale: String(1 - 0.06 * press) }}>
          <div style={{ position: "relative", width: bw, height: bh, borderRadius: br, boxShadow: glass(2.5, 26 + 30 * lit + 40 * rim).boxShadow }}>
            {/* le verre : le liseré (qui s'efface quand le bouton devient le carré bleu), l'intérieur, le bleu du logo */}
            <div style={{ position: "absolute", inset: 0, borderRadius: br, ...glass(2.5, 0), boxShadow: "none", opacity: 1 - k }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: br, background: "linear-gradient(135deg, #3b6cff, #1536b4)", opacity: k }} />
            <div style={{ position: "absolute", inset: 2.5, borderRadius: br - 2.5, overflow: "hidden" }}>
              {/* le reflet : une bande de lumière lavande qui traverse */}
              <div style={{ position: "absolute", top: -60, left: lerp(-320, 700, sweep), width: 260, height: 240, background: "linear-gradient(90deg, transparent, rgba(225,220,255,0.85), transparent)", filter: "blur(16px)", opacity: lit }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 18, opacity: text * lerp(0.35, 1, sharp) * ready,
                filter: sharp < 1 ? `blur(${(1 - sharp) * 7}px)` : undefined, textShadow: `0 0 ${24 * lit}px rgba(225,220,255,${lit})` }}>
                <Glyph name="play" size={34} color={C.ink} />
                <span style={{ fontFamily: sans, fontWeight: 600, fontSize: 44, color: C.ink }}>Commencer</span>
              </div>
            </div>
          </div>
        </At>
      )}

      {/* Le logo, le nom, la phrase */}
      {f >= b(32) && (
        <div style={{ position: "absolute", inset: 0, ...focus(1 - away, 16) }}>
          <At x={markX} y={540}>
            <div style={{ filter: `drop-shadow(0 0 ${20 + 50 * boom}px rgba(59,108,255,${0.45 + 0.4 * boom}))` }}>
              <LogoMark size={LOGO} p={draw} id="fin" />
            </div>
          </At>
          <div style={{ position: "absolute", left: markX + LOGO / 2 + 34, top: 540, translate: "0 -50%", display: "flex", fontFamily: display, fontWeight: 900, fontSize: 132, letterSpacing: "-0.04em", lineHeight: 1 }}>
            {[..."FinVeille"].map((ch, i) => {
              const p = ramp(f, b(32.8) + i * 3, b(32.8) + i * 3 + 18);
              return <span key={i} style={{ color: i < 3 ? C.ink : C.brand, display: "inline-block", ...focus(p, 22), translate: `${(1 - p) * 24}px 0` }}>{ch}</span>;
            })}
          </div>
          <At x={960} y={700} style={{ ...focus(tag, 14), fontFamily: sans, fontWeight: 500, fontSize: 40, color: C.muted, whiteSpace: "nowrap" }}>
            Toute la finance qui compte, en un seul site.
          </At>
        </div>
      )}
      <At x={960} y={540} style={{ ...focus(url, 14), fontFamily: sans, fontWeight: 500, fontSize: 42, color: C.muted, whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
        finveille.streamlit.app
      </At>
      {black > 0 && <AbsoluteFill style={{ background: "#000", opacity: black }} />}
    </>
  );
};
