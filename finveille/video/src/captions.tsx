// Les sous-titres intégrés : la phrase en cours, mot par mot, le mot prononcé en évidence (les gens regardent souvent sans le son)
import React from "react";
import { COLORS, IN, VO, fr, ramp, sans, useAbs } from "./kit";

// Phrases dont le grand texte à l'écran EST déjà la phrase : on ne la dit pas deux fois
const HIDDEN = new Set(["L03", "L20"]);
// Les phrases sur un monde de couleur : le mot prononcé est en blanc souligné (le bleu marque ne s'y lirait pas)
const ON_COLOR = new Set(["L09", "L10", "L11", "L12", "L13", "L14", "L15", "L16", "L17"]);

export const Captions: React.FC = () => {
  const f = useAbs();
  const p = VO.find((x) => !HIDDEN.has(x.id) && f >= fr(x.start) - 3 && f < fr(x.start + x.dur) + 14);
  if (!p) return null;
  const a = fr(p.start) - 3, b = fr(p.start + p.dur) + 8;
  const show = ramp(f, a, a + 5) * (1 - ramp(f, b, b + 6, [0, 1], IN));
  const onColor = ON_COLOR.has(p.id);
  const t = f / 30;
  return (
    <div style={{ position: "absolute", left: 210, width: 1500, bottom: 56, textAlign: "center", fontFamily: sans, fontWeight: 600, fontSize: 44, lineHeight: 1.28, color: "#fff", opacity: show, translate: `0 ${(1 - show) * 10}px`, textShadow: onColor ? "0 2px 14px rgba(20,10,40,0.55)" : "0 2px 16px rgba(0,0,0,0.75)" }}>
      {p.words.map((w, i) => {
        const now = t >= w.t0 - 0.02 && t < w.t1 + 0.04 && !(i < p.words.length - 1 && t >= p.words[i + 1].t0 - 0.02);
        const said = t >= w.t0 - 0.02;
        return (
          <span key={i} style={{ opacity: said ? 1 : 0.55, color: now && !onColor ? COLORS.brand : "#fff", textDecoration: now && onColor ? "underline" : "none", textDecorationThickness: 4, textUnderlineOffset: 8 }}>
            {w.w}{i < p.words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </div>
  );
};
