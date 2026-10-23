// Scènes 11 et 12 (3 temps de lettres, puis 8 temps de fin : un seul plan, puis le noir pour les 20 dernières images) : sur le
// gris papier, les lettres « F i n V e i l l e », éparpillées et tournées sur tout l'écran, convergent (en 90 images) pour former
// « FinVeille » en grand (« Fin » encre, « Veille » bleu) ; elles sont floues tant qu'elles filent, se posent avec un léger
// dépassement, et sur le temps 3 (`FIN_FORMED`) le mot fait un punch d'échelle avec une gerbe de petits carrés. La pièce d'or
// tourne au-dessus (rotation sur l'axe Y : scaleX = cos). Dessous : « toute la finance qui compte, en un seul site. » ; puis,
// dans la scène 12 (qui commence à `FIN2`), « gratuit · sans pub », « lien en commentaire » et une flèche dessinée qui rebondit ;
// tout en bas, la mention « information, pas un conseil en investissement. ». Le temps est celui du plan : 0 = début de la scène 11.
import React from "react";
import { random } from "remotion";
import { Arrow, SOFT, Icon, Layer, PCX, PWord, Shot, Words, bob, punch } from "./fx";
import { CAM, display, pop, ramp } from "../kit";
import { SCENE, beat, span } from "./montage";
import { PX } from "./theme";

export const FIN_FORMED = beat(3), FIN2 = SCENE.fin.from - SCENE.lettres.from, FIN_BLACK = span("lettres", "fin").len - 20;
export const FIN_SUB = Array.from({ length: 9 }, (_, i) => FIN_FORMED + 10 + i * 6);  // « toute la finance qui compte, en un seul site. »
export const FIN_L1 = [FIN2 + 12, FIN2 + 18, FIN2 + 24, FIN2 + 30];  // « gratuit · sans pub »
export const FIN_NOTE = Array.from({ length: 6 }, (_, i) => FIN2 + 36 + i * 5);  // la mention
export const FIN_L3 = [FIN2 + 100, FIN2 + 106, FIN2 + 112];  // « lien en commentaire »
export const FIN_ARROW = FIN2 + 130;
const LETTERS = ["F", "i", "n", "V", "e", "i", "l", "l", "e"];
// Largeur approximative de chaque lettre (en em) pour estimer où elle se range : sert seulement au point de départ du voyage
const ADV = [0.58, 0.3, 0.62, 0.66, 0.58, 0.3, 0.3, 0.3, 0.58];
const SIZE = 140, WORD_Y = 560, COIN_Y = 365;
const TOTAL_W = ADV.reduce((s, a) => s + a, 0) * SIZE;
const BURST = Array.from({ length: 16 }, (_, i) => ({ a: (i / 16) * Math.PI * 2 + random(`ba${i}`) * 0.3, r: 150 + random(`br${i}`) * 170, s: 9 + Math.floor(random(`bs${i}`) * 3) * 4, c: i % 3 === 0 ? PX.brandLight : PX.brand }));

export const Finale: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f >= FIN_BLACK) return null;
  let acc = 0;
  const letters = LETTERS.map((ch, i) => {
    const slot = PCX - TOTAL_W / 2 + (acc + ADV[i] / 2) * SIZE;
    acc += ADV[i];
    const sx = 110 + random(`lx${i}`) * 860, sy = 130 + random(`ly${i}`) * 1070;
    const a0 = 6 + i * 3, a1 = FIN_FORMED - 16 + i * 2;
    const e = ramp(f, a0, a1, 0, 1, SOFT), speed = Math.abs(ramp(f, a0, a1, 0, 1, CAM) - ramp(f - 1, a0, a1, 0, 1, CAM));
    return { ch, x: (sx - slot) * (1 - e), y: (sy - WORD_Y) * (1 - e), rot: (random(`lr${i}`) * 520 - 260) * (1 - Math.min(1, e)), blur: Math.min(9, speed * 150), op: ramp(f, a0 - 4, a0 + 4, 0, 1) };
  });
  const subWords = ["toute", "la", "finance", "qui", "compte,", "en", "un", "seul", "site."];
  const sub: PWord[] = subWords.map((t, i) => ({ t, at: FIN_SUB[i], br: i === 5 }));
  const l1: PWord[] = [{ t: "gratuit", at: FIN_L1[0] }, { t: "·", at: FIN_L1[1] }, { t: "sans", at: FIN_L1[2] }, { t: "pub", at: FIN_L1[3] }];
  const l3: PWord[] = [{ t: "lien", at: FIN_L3[0] }, { t: "en", at: FIN_L3[1] }, { t: "commentaire", at: FIN_L3[2] }];
  const note: PWord[] = ["information,", "pas", "un", "conseil", "en", "investissement."].map((t, i) => ({ t, at: FIN_NOTE[i] }));
  const spin = (f * 3 * Math.PI) / 180;
  const wordPunch = punch(f, FIN_FORMED, 0.06, 3, 22);
  const burst = ramp(f, FIN_FORMED, FIN_FORMED + 26, 0, 1);
  return (
    <Shot f={f} from={0} to={FIN_BLACK} exit="fwd" outDur={8}>
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
        <Icon name="piece" x={PCX} y={COIN_Y + bob(f, 1, 7, 42)} size={160} scale={pop(f, FIN_FORMED - 10, 13, 150)} scaleX={Math.cos(spin)} depth={6} />
      </Layer>
      <Layer f={f} k={0.5}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 690 }}><Words words={sub} f={f} /></div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 925 }}><Words words={l1} f={f} /></div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 1005 }}><Words words={l3} f={f} /></div>
        <Arrow f={f} at={FIN_ARROW} x={PCX} y={1165} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 1270, opacity: 0.6 }}><Words words={note} f={f} size={26} weight={500} /></div>
      </Layer>
    </Shot>
  );
};
