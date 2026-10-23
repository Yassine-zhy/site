// Scènes 11 et 12 (1520 → 1780, puis le noir jusqu'à 1800) : sur le gris papier, les lettres « f i n v e i l l e », éparpillées et
// tournées sur tout l'écran, convergent (1520 → 1600) pour former « finveille » en grand (« fin » encre, « veille » bleu) ; la
// pièce d'or tourne au-dessus (rotation sur l'axe Y : scaleX = cos). Dessous : « toute la finance qui compte, en un seul
// site. » ; puis « gratuit · sans pub », « finveille.streamlit.app », « lien en commentaire ↓ » ; tout en bas, la mention
// « information, pas un conseil en investissement. ».
import React from "react";
import { random } from "remotion";
import { Icon, PCX, PWord, Words } from "./fx";
import { CAM, display, pop, ramp } from "../kit";
import { PX } from "./theme";

export const FIN_FROM = 1520, FIN_FORMED = 1600, FIN_BLACK = 1780;
const LETTERS = ["f", "i", "n", "v", "e", "i", "l", "l", "e"];
// Largeur approximative de chaque lettre (en em) pour estimer où elle se range : sert seulement au point de départ du voyage
const ADV = [0.36, 0.3, 0.62, 0.6, 0.58, 0.3, 0.3, 0.3, 0.58];
const SIZE = 140, WORD_Y = 640;
const TOTAL_W = ADV.reduce((s, a) => s + a, 0) * SIZE;

export const Finale: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f < FIN_FROM || f >= FIN_BLACK) return null;
  let acc = 0;
  const letters = LETTERS.map((ch, i) => {
    const slot = PCX - TOTAL_W / 2 + (acc + ADV[i] / 2) * SIZE;
    acc += ADV[i];
    const sx = 110 + random(`lx${i}`) * 860, sy = 130 + random(`ly${i}`) * 1070;
    const e = ramp(f, FIN_FROM + 6 + i * 3, FIN_FORMED - 16 + i * 2, 0, 1, CAM);
    return { ch, x: (sx - slot) * (1 - e), y: (sy - WORD_Y) * (1 - e), rot: (random(`lr${i}`) * 520 - 260) * (1 - e) };
  });
  const sub: PWord[] = ["toute", "la", "finance", "qui", "compte,", "en", "un", "seul", "site."].map((t, i) => ({ t, at: 1610 + i * 4 }));
  const l1: PWord[] = [{ t: "gratuit", at: 1666 }, { t: "·", at: 1670 }, { t: "sans", at: 1674 }, { t: "pub", at: 1680 }];
  const l2: PWord[] = [{ t: "finveille.streamlit.app", at: 1694, color: PX.brand }];
  const l3: PWord[] = [{ t: "lien", at: 1722 }, { t: "en", at: 1728 }, { t: "commentaire", at: 1734 }, { t: "↓", at: 1742 }];
  const note: PWord[] = [{ t: "information,", at: 1668 }, { t: "pas", at: 1672 }, { t: "un", at: 1676 }, { t: "conseil", at: 1680 }, { t: "en", at: 1684 }, { t: "investissement.", at: 1688 }];
  const spin = ((f - FIN_FROM) * 3 * Math.PI) / 180;
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: WORD_Y - 90, display: "flex", justifyContent: "center", fontFamily: display, fontWeight: 800, fontSize: SIZE, lineHeight: "180px", letterSpacing: "-0.04em", whiteSpace: "nowrap" }}>
        {letters.map((l, i) => (
          <span key={i} style={{ display: "inline-block", color: i < 3 ? PX.ink : PX.brand, translate: `${l.x}px ${l.y}px`, rotate: `${l.rot}deg` }}>{l.ch}</span>
        ))}
      </div>
      <Icon name="piece" x={PCX} y={430} size={170} scale={pop(f, FIN_FORMED - 10, 13, 150)} scaleX={Math.cos(spin)} depth={6} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 748 }}><Words words={sub} f={f} /></div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 850 }}><Words words={l1} f={f} /></div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 920 }}><Words words={l2} f={f} /></div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 990 }}><Words words={l3} f={f} /></div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1215, opacity: 0.6 }}><Words words={note} f={f} size={22} weight={500} /></div>
    </>
  );
};
