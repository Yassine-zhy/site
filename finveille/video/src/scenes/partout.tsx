// Partout (temps 72 → 84) : le vrai site (séquences filmées par tools/footage.py) dans une fenêtre d'ordinateur, puis un
// téléphone qui la rejoint, puis l'écran de l'ordinateur passe du thème sombre au thème clair.
import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";
import { At, C, CAM, Halo, Sparks, Title, b, focus, lerp, pop, ramp, sans } from "../kit";

const WIN = { w: 1240, bar: 44 };
const WIN_H = WIN.bar + (WIN.w * 1080) / 1920;  // la barre, puis l'image du site en 16:9
const PHONE = { w: 400, h: 866 };

const Footage: React.FC<{ readonly name: string; readonly from: number; readonly w: number; readonly h: number }> = ({ name, from, w, h }) => (
  <Sequence from={from} layout="none">
    <Video src={staticFile(`footage/${name}.mp4`)} muted objectFit="cover" style={{ position: "absolute", inset: 0, width: w, height: h }} />
  </Sequence>
);

export const Partout: React.FC = () => {
  const f = useCurrentFrame();
  if (f < b(71.5) || f > b(84.5)) return null;

  const drift = ramp(f, b(71.5), b(84.5), 0, 1, (t) => t);
  // La fenêtre : à droite au début, puis elle se décale à gauche pour laisser venir le téléphone
  const shift = ramp(f, b(76), b(77), 0, 1, CAM);
  const wx = lerp(1060, 800, shift), wy = 600, ws = lerp(1, 0.86, shift) * (1 + 0.04 * drift);
  const wry = lerp(-12, -4, drift) + 6 * shift;
  // Le téléphone entre en ressort par la droite
  const ph = pop(f, b(76), 14, 140);
  const px = lerp(2200, 1480, ph), pry = lerp(30, 8, ph) - 4 * drift;
  // Le thème clair glisse sur l'écran de l'ordinateur (une diagonale qui balaie de gauche à droite)
  const wipe = ramp(f, b(80), b(81.5), 0, 1, CAM);
  const light = ramp(f, b(80), b(81.5));

  const t1 = [{ t: "Sur", at: b(72.5) }, { t: "ordinateur,", at: b(72.5) + 5 }, { t: "sur", at: b(76.5) }, { t: "téléphone.", at: b(76.5) + 5, color: C.brand }];
  const t2 = [{ t: "En", at: b(80.5) }, { t: "clair", at: b(80.5) + 5 }, { t: "ou", at: b(81) }, { t: "en", at: b(81) + 4 }, { t: "sombre.", at: b(81) + 8, color: C.brand }];

  return (
    <AbsoluteFill>
      <Sparks f={f} n={34} seed="partout" color="#b8c8ff" a={0.4} />
      <Halo x={wx} y={wy} r={760} color={C.brand} a={0.22} />
      <At x={960} y={150}>
        <Title f={f} words={t1} size={104} align="center" out={b(79.6)} />
      </At>
      <At x={960} y={150}>
        <Title f={f} words={t2} size={104} align="center" />
      </At>

      <AbsoluteFill style={{ perspective: 2200, perspectiveOrigin: "960px 540px" }}>
        {/* L'ordinateur : une fenêtre de navigateur, avec le vrai site */}
        <div style={{
          position: "absolute", left: wx - WIN.w / 2, top: wy - WIN_H / 2 + 50, width: WIN.w, height: WIN_H, borderRadius: 22, overflow: "hidden",
          transform: `rotateY(${wry}deg) scale(${ws})`, background: light > 0.5 ? "#eef1f7" : "#0d1018",
          border: "1.5px solid rgba(255,255,255,0.18)", boxShadow: "0 50px 120px -30px rgba(0,0,0,0.9), 0 0 60px rgba(109,147,255,0.18)",
          ...focus(ramp(f, b(71.5), b(72.3)), 16),
        }}>
          <div style={{ height: WIN.bar, display: "flex", alignItems: "center", gap: 9, padding: "0 18px", background: light > 0.5 ? "#e3e7f0" : "#141824" }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
            <div style={{ marginLeft: 22, height: 28, padding: "0 18px", borderRadius: 14, display: "flex", alignItems: "center", fontFamily: sans, fontWeight: 500, fontSize: 17,
              color: light > 0.5 ? "#4b5568" : C.muted, background: light > 0.5 ? "#f7f8fb" : "#1c2232" }}>finveille.streamlit.app</div>
          </div>
          <div style={{ position: "relative", width: WIN.w, height: WIN_H - WIN.bar, overflow: "hidden" }}>
            <Footage name="markets" from={b(71.5)} w={WIN.w} h={WIN_H - WIN.bar} />
            <div style={{ position: "absolute", inset: 0, clipPath: `polygon(0 0, ${wipe * 130}% 0, ${wipe * 130 - 30}% 100%, 0 100%)` }}>
              {f >= b(79.5) && <Footage name="light" from={b(79.5)} w={WIN.w} h={WIN_H - WIN.bar} />}
            </div>
            {/* le bord lumineux du balayage */}
            {wipe > 0 && wipe < 1 && (
              <div style={{ position: "absolute", top: -40, bottom: -40, left: `${wipe * 130 - 15}%`, width: 10, rotate: "13deg", background: "#fff", boxShadow: "0 0 40px 12px rgba(180,200,255,0.9)" }} />
            )}
          </div>
        </div>

        {/* Le téléphone */}
        {f >= b(76) && (
          <div style={{
            position: "absolute", left: px - PHONE.w / 2, top: 610 - PHONE.h / 2 + 40, width: PHONE.w, height: PHONE.h, borderRadius: 58, padding: 12, boxSizing: "border-box",
            background: "linear-gradient(160deg, #2a3042, #0c0f17)", border: "1.5px solid rgba(255,255,255,0.22)",
            boxShadow: "0 50px 120px -30px rgba(0,0,0,0.95), 0 0 50px rgba(109,147,255,0.22)", transform: `rotateY(${pry}deg) scale(${0.86 + 0.04 * drift})`,
          }}>
            <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 46, overflow: "hidden", background: "#0b0e16" }}>
              <Footage name="mobile" from={b(75.5)} w={PHONE.w - 24} h={PHONE.h - 24} />
              <div style={{ position: "absolute", top: 10, left: "50%", translate: "-50% 0", width: 110, height: 30, borderRadius: 15, background: "#000" }} />
            </div>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
