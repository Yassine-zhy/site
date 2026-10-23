// Scènes 11 et 12 (1520 → 1780, puis le noir jusqu'à 1800) : sur le gris papier, les lettres « F i n V e i l l e », éparpillées et
// tournées sur tout l'écran, convergent (1520 → 1600) pour former « FinVeille » en grand (« Fin » encre, « Veille » bleu) ; elles
// sont floues tant qu'elles filent, se posent avec un léger dépassement, et à 1600 le mot fait un punch d'échelle avec une
// gerbe de petits carrés. La pièce d'or tourne au-dessus (rotation sur l'axe Y : scaleX = cos). Dessous : « toute la finance qui
// compte, en un seul site. » ; puis « gratuit · sans pub », « lien en commentaire » et une flèche dessinée qui rebondit ; tout en
// bas, la mention « information, pas un conseil en investissement. ».
import React from "react";
import { random } from "remotion";
import { Arrow, SOFT, Icon, Layer, PCX, PWord, Shot, Words, bob, punch } from "./fx";
import { CAM, display, pop, ramp } from "../kit";
import { PX } from "./theme";

export const FIN_FROM = 1520, FIN_FORMED = 1600, FIN_BLACK = 1780;
const LETTERS = ["F", "i", "n", "V", "e", "i", "l", "l", "e"];
// Largeur approximative de chaque lettre (en em) pour estimer où elle se range : sert seulement au point de départ du voyage
const ADV = [0.58, 0.3, 0.62, 0.66, 0.58, 0.3, 0.3, 0.3, 0.58];
const SIZE = 140, WORD_Y = 690;
const TOTAL_W = ADV.reduce((s, a) => s + a, 0) * SIZE;
const BURST = Array.from({ length: 16 }, (_, i) => ({ a: (i / 16) * Math.PI * 2 + random(`ba${i}`) * 0.3, r: 150 + random(`br${i}`) * 170, s: 9 + Math.floor(random(`bs${i}`) * 3) * 4, c: i % 3 === 0 ? PX.brandLight : PX.brand }));

export const Finale: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f < FIN_FROM || f >= FIN_BLACK) return null;
  let acc = 0;
  const letters = LETTERS.map((ch, i) => {
    const slot = PCX - TOTAL_W / 2 + (acc + ADV[i] / 2) * SIZE;
    acc += ADV[i];
    const sx = 110 + random(`lx${i}`) * 860, sy = 130 + random(`ly${i}`) * 1070;
    const a0 = FIN_FROM + 6 + i * 3, a1 = FIN_FORMED - 16 + i * 2;
    const e = ramp(f, a0, a1, 0, 1, SOFT), speed = Math.abs(ramp(f, a0, a1, 0, 1, CAM) - ramp(f - 1, a0, a1, 0, 1, CAM));
    return { ch, x: (sx - slot) * (1 - e), y: (sy - WORD_Y) * (1 - e), rot: (random(`lr${i}`) * 520 - 260) * (1 - Math.min(1, e)), blur: Math.min(9, speed * 150), op: ramp(f, a0 - 4, a0 + 4, 0, 1) };
  });
  const sub: PWord[] = ["toute", "la", "finance", "qui", "compte,", "en", "un", "seul", "site."].map((t, i) => ({ t, at: 1610 + i * 4 }));
  const l1: PWord[] = [{ t: "gratuit", at: 1666 }, { t: "·", at: 1670 }, { t: "sans", at: 1674 }, { t: "pub", at: 1680 }];
  const l3: PWord[] = [{ t: "lien", at: 1722 }, { t: "en", at: 1728 }, { t: "commentaire", at: 1734 }];
  const note: PWord[] = [{ t: "information,", at: 1668 }, { t: "pas", at: 1672 }, { t: "un", at: 1676 }, { t: "conseil", at: 1680 }, { t: "en", at: 1684 }, { t: "investissement.", at: 1688 }];
  const spin = ((f - FIN_FROM) * 3 * Math.PI) / 180;
  const wordPunch = punch(f, FIN_FORMED, 0.06, 3, 22);
  const burst = ramp(f, FIN_FORMED, FIN_FORMED + 26, 0, 1);
  return (
    <Shot f={f} from={FIN_FROM} to={FIN_BLACK} exit="fwd" outDur={8}>
      <Layer f={f} k={0.8}>
        <div style={{ position: "absolute", left: 0, right: 0, top: WORD_Y - 90, display: "flex", justifyContent: "center", fontFamily: display, fontWeight: 800, fontSize: SIZE, lineHeight: "180px", letterSpacing: "-0.04em", whiteSpace: "nowrap", scale: String(wordPunch), translate: `0 ${f >= FIN_FORMED ? bob(f, 0, 3, 50) : 0}px` }}>
          {letters.map((l, i) => (
            <span key={i} style={{ display: "inline-block", color: i < 3 ? PX.ink : PX.brand, opacity: l.op, translate: `${l.x}px ${l.y}px`, rotate: `${l.rot}deg`, filter: l.blur > 0.3 ? `blur(${l.blur}px)` : undefined }}>{l.ch}</span>
          ))}
        </div>
        {f >= FIN_FORMED && burst < 1 && BURST.map((b, i) => (
          <div key={i} style={{ position: "absolute", left: PCX + Math.cos(b.a) * b.r * burst * 1.4 - b.s / 2, top: WORD_Y + Math.sin(b.a) * b.r * burst * 0.8 - b.s / 2, width: b.s, height: b.s, background: b.c, opacity: 1 - burst * burst, rotate: `${burst * 90}deg` }} />
        ))}
      </Layer>
      <Layer f={f} k={1}>
        <Icon name="piece" x={PCX} y={480 + bob(f, 1, 7, 42)} size={170} scale={pop(f, FIN_FORMED - 10, 13, 150)} scaleX={Math.cos(spin)} depth={6} />
      </Layer>
      <Layer f={f} k={0.5}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 798 }}><Words words={sub} f={f} /></div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 900 }}><Words words={l1} f={f} /></div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 975 }}><Words words={l3} f={f} /></div>
        <Arrow f={f} at={1742} x={PCX} y={1088} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 1215, opacity: 0.6 }}><Words words={note} f={f} size={22} weight={500} /></div>
      </Layer>
    </Shot>
  );
};
