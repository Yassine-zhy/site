// Scènes 1 et 2 (images 0 → 300) : sur le gris papier, la question « combien d'applis t'ouvres chaque matin pour suivre la
// bourse ? » ; des icônes surgissent une à une autour du texte, puis se multiplient et s'agitent (le chaos) ; un éclat bleu
// balaie l'écran à 170 ; le texte devient « cac 40. crypto. newsletters. alertes. ».
import React from "react";
import { PCY, Hand, Icon, Layer, PWord, Shot, Words, bob, drift, punch } from "./fx";
import { CAM, LIN, clamp, pop, ramp } from "../kit";
import { SpriteName } from "./sprites";

type Ic = { readonly name: SpriteName; readonly x: number; readonly y: number; readonly size: number; readonly at: number; readonly rot: number; readonly spin: number };
// Les cinq de la scène 1 (toutes les 14 images à partir de 70), puis dix de plus à partir de 152 (toutes les 6 images).
// Les positions sont écartées d'au moins 175 px pour que les icônes ne se chevauchent pas, même agitées et grossies.
export const CHAOS_ICONS: readonly Ic[] = [
  { name: "telephone", x: 215, y: 470, size: 120, at: 70, rot: -8, spin: -70 },
  { name: "journal", x: 870, y: 500, size: 124, at: 84, rot: 7, spin: 80 },
  { name: "cloche", x: 205, y: 990, size: 124, at: 98, rot: -6, spin: -90 },
  { name: "graphique", x: 845, y: 945, size: 124, at: 112, rot: 8, spin: 75 },
  { name: "bitcoin", x: 585, y: 385, size: 116, at: 126, rot: -5, spin: -60 },
  { name: "piece", x: 775, y: 255, size: 112, at: 152, rot: 12, spin: 90 },
  { name: "billet", x: 330, y: 270, size: 124, at: 158, rot: -14, spin: -90 },
  { name: "tirelire", x: 615, y: 1085, size: 130, at: 164, rot: 9, spin: 100 },
  { name: "loupe", x: 385, y: 1100, size: 116, at: 170, rot: -12, spin: -80 },
  { name: "eclair", x: 520, y: 1255, size: 112, at: 176, rot: 14, spin: 90 },
  { name: "globe", x: 935, y: 790, size: 104, at: 182, rot: -8, spin: -90 },
  { name: "ordinateur", x: 145, y: 815, size: 116, at: 188, rot: 10, spin: 90 },
  { name: "tasse", x: 540, y: 190, size: 104, at: 194, rot: -10, spin: -90 },
  { name: "bougie", x: 130, y: 1190, size: 116, at: 200, rot: 8, spin: 90 },
  { name: "calendrier", x: 935, y: 1185, size: 104, at: 206, rot: -9, spin: -90 },
];
export const CHAOS_ICON_AT = CHAOS_ICONS.map((i) => i.at);

// Les mots de la scène 1 (une ligne, puis la ligne dessous) et ceux de la scène 2 (un mot toutes les 12 images)
// Le trait de « d'applis » : il souligne le mot de gauche à droite puis fait sa boucle sous la ligne. Il est dessiné dans la
// boîte du mot (viewBox 150 × 30, largeur 116 % du mot) : il suit le texte quelle que soit sa taille.
const LOOP = "M 4 5 C 40 9 80 3 112 6 C 130 8 138 27 120 27 C 102 27 104 10 128 10 C 140 10 147 6 149 2";
export const CHAOS_WORDS_1 = [4, 10, 16, 22, 28, 40, 46, 52, 58];
export const CHAOS_WORDS_2 = [156, 168, 180, 192, 204];
export const Chaos: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f >= 300) return null;
  const agit = ramp(f, 150, 230, 0, 1, LIN);
  const loop = <Hand key="loop" d={LOOP} box={[150, 30]} p={ramp(f, 34, 72, 0, 1, CAM)} style={{ left: "-2%", top: "76%", width: "116%" }} />;
  const w1: PWord[] = [
    { t: "combien", at: 4 }, { t: "d'applis", at: 10, deco: loop }, { t: "t'ouvres", at: 16 }, { t: "chaque", at: 22 }, { t: "matin", at: 28 },
    { t: "pour", at: 40, br: true }, { t: "suivre", at: 46 }, { t: "la", at: 52 }, { t: "bourse ?", at: 58 },
  ];
  const w2: PWord[] = [{ t: "cac", at: 156 }, { t: "40.", at: 168 }, { t: "crypto.", at: 180 }, { t: "newsletters.", at: 192 }, { t: "alertes.", at: 204 }];
  return (
    <Shot f={f} from={0} to={300} exit="inv" punch={punch(f, 168, 0.04, 3, 20)}>
      {CHAOS_ICONS.map((ic, i) => {
        if (f < ic.at) return null;
        const born = pop(f, ic.at, 11, 170, 0.7), settle = ramp(f, ic.at, ic.at + 20);
        const phase = i * 1.9, k = 0.5 + ic.size / 150;  // les plus grosses sont plus proches : la parallaxe les déplace davantage
        const [px, py] = drift(f, k);
        const rot = ic.rot + (1 - settle) * ic.spin + agit * 11 * Math.sin(f / 3.3 + phase);
        const x = ic.x + px + bob(f, phase, 6, 41) + agit * 15 * Math.sin(f / 4.1 + phase * 2);
        const y = ic.y + py + bob(f, phase + 1, 7, 37) + agit * 15 * Math.cos(f / 3.6 + phase);
        const grow = 1 + 0.22 * agit * (i % 2 ? 1 : 0.6);
        const blur = clamp(Math.abs(born - pop(f - 1, ic.at, 11, 170, 0.7)) * 28, 0, 5);  // flou de mouvement pendant qu'elle surgit
        return <Icon key={i} name={ic.name} x={x} y={y} size={ic.size * grow} rot={rot} blur={blur} scale={clamp(born, 0, 1.25)} />;
      })}
      <Layer f={f} k={0.6}>
        <div style={{ position: "absolute", left: 0, right: 0, top: PCY - 62 }}><Words words={w1} f={f} out={138} /></div>
        <div style={{ position: "absolute", left: 0, right: 0, top: PCY - 28 }}><Words words={w2} f={f} /></div>
      </Layer>
    </Shot>
  );
};
