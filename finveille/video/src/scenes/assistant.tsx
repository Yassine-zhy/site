// La scène C (temps 11,5 - 17) : l'assistant. L'icône monte du bas avec la caméra, rétrécit en avatar, la question se tape,
// la réponse apparaît avec ses trois sources ; puis tout le groupe rétrécit vers le centre et devient une tuile du mur (D).
import React from "react";
import { useCurrentFrame } from "remotion";
import { C, CAM, Halo, LIN, OUT, b, clamp, focus, glass, lerp, pop, ramp, rgba, sans } from "../kit";

const QUESTION = "Qu’est-ce qui fait bouger le CAC 40 aujourd’hui ?";
const RAISON = "Trois raisons ressortent des dépêches du moment :";
const SOURCES = ["BFM Bourse", "Le Monde Économie", "CNBC Marchés"] as const;
const SOURCE_AT = [b(15.25), b(15.5), b(15.75)] as const;
const BARS = [600, 520, 660] as const;

// L'étoile « spark » du kit, avec le dégradé violet → bleu
const Spark: React.FC<{ readonly size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", overflow: "visible" }}>
    <defs>
      <linearGradient id="assistantSpark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#C4B3FF" />
        <stop offset="1" stopColor="#6D93FF" />
      </linearGradient>
    </defs>
    <path d="M12 2.5c.6 4.9 2.6 6.9 7.5 7.5-4.9.6-6.9 2.6-7.5 7.5-.6-4.9-2.6-6.9-7.5-7.5 4.9-.6 6.9-2.6 7.5-7.5z" fill="url(#assistantSpark)" />
  </svg>
);

const text = (size: number, weight: number, color: string): React.CSSProperties => ({
  fontFamily: sans, fontSize: size, fontWeight: weight, color, whiteSpace: "nowrap", WebkitFontSmoothing: "antialiased",
});

export const Assistant: React.FC = () => {
  const f = useCurrentFrame();
  if (f < b(11.5) || f >= b(17)) return null;

  // Le panoramique : le contenu monte du bas, à la vitesse de la scène précédente
  const dy = 700 * (1 - ramp(f, b(11.5), b(12.5), 0, 1, CAM));
  // Le passage au mur : le groupe rétrécit vers le centre de l'écran, puis s'efface
  const sc = lerp(1, 0.36, ramp(f, b(16), b(16.6), 0, 1, OUT));
  const fade = 1 - ramp(f, b(16.3), b(16.65), 0, 1, LIN);

  // 1-2. L'icône : arrive au centre, pulse, puis rétrécit en avatar
  const q = ramp(f, b(12.75), b(13.5), 0, 1, CAM);
  const size = lerp(200, 92, q), radius = lerp(52, 26, q);
  const ix = lerp(960, 512, q), iy = lerp(540, 560, q) + dy;
  const iconOpacity = ramp(f, b(11.5), b(12.1));
  const iconScale = lerp(0.92, 1, pop(f, b(12.3)));
  const pulse = ramp(f, b(12), b(12.5), 0, 1, CAM) * (1 - ramp(f, b(12.5), b(12.5) + 40));
  const haloA = lerp(0.55 + 0.3 * pulse, 0.35, q) * iconOpacity;

  // 3. La question, tapée lettre à lettre ; la bulle s'élargit vers la gauche (bord droit fixe)
  const typedEnd = b(14.5);
  const typed = Math.floor(ramp(f, b(13) + 6, typedEnd, 0, QUESTION.length, LIN));
  const bubbleIn = pop(f, b(13));
  const cursorOn = f < typedEnd || Math.floor((f - typedEnd) / 16) % 2 === 0;

  // 4. La réponse
  const cardP = ramp(f, b(14.5), b(14.5) + 14);
  const cardScale = lerp(0.96, 1, pop(f, b(14.5)));
  const wipe = ramp(f, b(14.5), b(15), 0, 1, CAM);
  const shimmerOut = 1 - ramp(f, b(16) - 10, b(16), 0, 1, LIN);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 2, opacity: fade, transform: `scale(${sc})`, transformOrigin: "960px 540px" }}>
      <Halo x={ix} y={iy} r={lerp(330, 150, q)} color={C.violet} a={haloA} />

      {/* La bulle de la question */}
      <div style={{
        position: "absolute", right: 1920 - 1460, top: 330 + dy, transformOrigin: "100% 50%", transform: `scale(${lerp(0.9, 1, bubbleIn)})`,
        ...focus(ramp(f, b(13), b(13) + 10), 10),
        display: "flex", alignItems: "center", height: 76, boxSizing: "border-box", padding: "0 26px 0 34px", borderRadius: 34,
        background: "rgba(109,147,255,0.16)", border: "1.5px solid rgba(109,147,255,0.5)", boxShadow: "0 0 40px rgba(109,147,255,0.2)",
      }}>
        <span style={{ ...text(34, 500, C.ink), lineHeight: "40px" }}>{QUESTION.slice(0, typed)}</span>
        <span style={{ width: 2.5, height: 38, marginLeft: 4, borderRadius: 1, background: C.brand, opacity: cursorOn ? 1 : 0 }} />
      </div>

      {/* La carte de la réponse */}
      <div style={{
        position: "absolute", left: 580, top: 500 + dy, width: 880, height: 220, boxSizing: "border-box", padding: "30px 36px", borderRadius: 30,
        transformOrigin: "0% 50%", transform: `scale(${cardScale})`, ...focus(cardP, 12), ...glass(2, 18),
      }}>
        <div style={{
          display: "inline-block", ...text(30, 500, C.ink), lineHeight: "40px",
          WebkitMaskImage: `linear-gradient(90deg, #000 ${wipe * 118 - 18}%, transparent ${wipe * 118}%)`,
          maskImage: `linear-gradient(90deg, #000 ${wipe * 118 - 18}%, transparent ${wipe * 118}%)`,
        }}>{RAISON}</div>
        <div style={{ marginTop: 18 }}>
          {BARS.map((len, i) => {
            const grow = ramp(f, b(15) + i * 4, b(15) + i * 4 + 26);
            const w = len * grow;
            const lit = ramp(f, SOURCE_AT[i], SOURCE_AT[i] + 6) - ramp(f, SOURCE_AT[i] + 6, SOURCE_AT[i] + 40, 0, 0.6);
            const sweep = (((f - b(15) - i * 6) % 54) + 54) % 54 / 54;
            return (
              <div key={i} style={{ position: "relative", height: 34, display: "flex", alignItems: "center" }}>
                <div style={{ position: "relative", width: w, height: 14, borderRadius: 7, background: "rgba(255,255,255,0.16)", overflow: "hidden" }}>
                  <div style={{
                    position: "absolute", top: 0, bottom: 0, width: 140, left: lerp(-140, len, sweep), opacity: shimmerOut * clamp(grow * 3, 0, 1),
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.42), transparent)",
                  }} />
                </div>
                <div style={{
                  position: "absolute", left: w + 14, top: 2, width: 30, height: 30, boxSizing: "border-box", borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center", opacity: clamp(grow * 4, 0, 1),
                  background: "rgba(109,147,255,0.2)", border: `1.5px solid ${C.brand}`,
                  boxShadow: `0 0 ${26 * lit}px ${rgba(C.brand, 0.9 * lit)}`, ...text(20, 600, C.ink), lineHeight: "30px",
                }}>{i + 1}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Les sources */}
      <div style={{ position: "absolute", left: 580, top: 800 + dy, display: "flex", gap: 16 }}>
        {SOURCES.map((name, i) => {
          const at = SOURCE_AT[i];
          return (
            <div key={name} style={{
              display: "flex", alignItems: "center", gap: 12, height: 56, padding: "0 20px", borderRadius: 22, ...glass(1.5, 14),
              transform: `scale(${lerp(0.6, 1, pop(f, at))})`, ...focus(ramp(f, at, at + 8), 10),
            }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: C.brand, display: "flex", alignItems: "center", justifyContent: "center", ...text(18, 700, "#fff") }}>{i + 1}</div>
              <span style={text(24, 500, C.ink)}>{name}</span>
            </div>
          );
        })}
      </div>

      {/* L'avatar (l'icône) au-dessus de tout */}
      <div style={{
        position: "absolute", left: ix - size / 2, top: iy - size / 2, width: size, height: size, borderRadius: radius,
        display: "flex", alignItems: "center", justifyContent: "center", opacity: iconOpacity, transform: `scale(${iconScale})`,
        ...glass(lerp(2.5, 2, q), lerp(30, 16, q), C.violet, ["#1a1830", "#0e0d18"]),
      }}>
        <Spark size={size * 0.48} />
      </div>
    </div>
  );
};
