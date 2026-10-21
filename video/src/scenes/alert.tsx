// La scène E (temps 22 - 25) : l'alerte. La cloche vectorielle prend le relais de la cloche 3D, sonne deux fois (lueur, ondes),
// la notification « Alerte de cours » tombe puis repart ; il ne reste que le carré ambre, que la scène F reprend sans saut.
import React from "react";
import { useCurrentFrame } from "remotion";
import { At, C, CAM, Glyph, Halo, IN, LogoMark, b, focus, glass, lerp, pop, ramp, sans } from "../kit";

const AMBER_FILL = ["#221b10", "#100d08"] as const;
const WAVE = 30;  // durée d'une onde, en images

// Une onde ambre qui part de la cloche à l'image `at`
const Wave: React.FC<{ readonly f: number; readonly at: number }> = ({ f, at }) => {
  const t = (f - at) / WAVE;
  if (t < 0 || t >= 1) return null;
  const r = ramp(f, at, at + WAVE, 120, 520);
  return (
    <div style={{ position: "absolute", left: 960 - r, top: 540 - r, width: 2 * r, height: 2 * r, boxSizing: "border-box", borderRadius: "50%", border: `2px solid ${C.amber}`, opacity: ramp(f, at, at + WAVE, 0.6, 0) }} />
  );
};

export const Alert: React.FC = () => {
  const f = useCurrentFrame();
  if (f < b(22) || f >= b(25)) return null;

  const END = b(25) - 1;  // la dernière image : seul reste le carré vide et sa lueur
  const p = ramp(f, b(22.4), b(23));

  // Le pictogramme : entre net, sonne à b(23) puis plus faiblement à b(24), s'efface à la fin
  const ring = (at: number, amp: number) => (f < at ? 0 : amp * Math.sin((2 * Math.PI * (f - at)) / 14) * Math.exp(-(f - at) / 22));
  const angle = ring(b(23), 16) + ring(b(24), 8);
  const glyphOut = ramp(f, b(24.5), b(24.5) + 24);
  const glyphScale = lerp(1, 0.8, glyphOut);

  // La lueur : un souffle à chaque coup, puis elle se fixe à 0,3 pour la scène suivante
  const kick = (at: number, amp: number) => (f < at ? 0 : amp * Math.exp(-(f - at) / 18));
  const rest = ramp(f, b(24.5), END, 0, 1, CAM);
  const haloA = lerp((0.15 * p) + kick(b(23), 0.6) + kick(b(24), 0.4), 0.3, rest);

  // La notification : tombe du haut en ressort, remonte à la fin
  const down = pop(f, b(23.25));
  const up = ramp(f, b(24.5), END, 0, 1, IN);
  const ny = f < b(24.5) ? lerp(-120, 170, down) : lerp(170, -140, up);

  return (
    <>
      <Halo x={960} y={540} r={360} color={C.amber} a={haloA} />
      <Wave f={f} at={b(23)} />
      <Wave f={f} at={b(24)} />

      <At x={960} y={540} style={{
        width: 200, height: 200, borderRadius: 52, display: "flex", alignItems: "center", justifyContent: "center",
        transform: `scale(${lerp(1.25, 1, p)})`, ...focus(p, 24), ...glass(2.5, 26, C.amber, AMBER_FILL),
      }}>
        <div style={{ transformOrigin: "50% 0%", transform: `rotate(${angle}deg) scale(${glyphScale})`, opacity: 1 - glyphOut }}>
          <Glyph name="bell" size={104} stroke={2.2} color="#FFD18A" />
        </div>
      </At>

      {ny > -140 && (
        <At x={960} y={ny} style={{
          width: 820, height: 128, borderRadius: 36, display: "flex", alignItems: "center", gap: 22, padding: "0 32px", boxSizing: "border-box",
          opacity: 1 - up, filter: up > 0.001 ? `blur(${18 * up}px)` : undefined, ...glass(2, 20, "#ffffff", ["#1b1d26", "#11121a"]),
        }}>
          <LogoMark size={64} p={1} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, fontFamily: sans, whiteSpace: "nowrap", WebkitFontSmoothing: "antialiased" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 30, fontWeight: 600, color: C.ink }}>Alerte de cours</span>
              <span style={{ fontSize: 24, fontWeight: 500, color: C.dim }}>maintenant</span>
            </div>
            <span style={{ fontSize: 28, fontWeight: 500, color: C.muted }}>Airbus a franchi 180,00{" "}€</span>
          </div>
        </At>
      )}
    </>
  );
};
