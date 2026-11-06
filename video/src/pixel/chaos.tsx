// Scènes 1 et 2 (7 temps puis 6 temps, un seul plan) : sur le gris papier, la question « combien d'applis t'ouvres chaque matin
// pour suivre la bourse ? » arrive mot à mot et on a le temps de la lire (scène 1, calme) ; cinq icônes surgissent une à une
// autour du texte, de plus en plus vite, puis scène 2 : dix de plus en rafale, tout s'agite, un éclat bleu balaie l'écran, et le
// texte devient « cac 40. crypto. newsletters. alertes. ». Le temps est celui du plan (0 = début de la scène 1) ; la scène 2
// commence à `S2` ; les mots de la scène 2 sont donnés relativement à elle.
import React from "react";
import { PCY, Hand, Icon, Layer, PWord, Shot, Words, bob, drift, punch } from "./fx";
import { CAM, LIN, clamp, pop, ramp } from "../kit";
import { SCENE, span } from "./montage";
import { SpriteName } from "./sprites";

export const S2 = SCENE.chaos.from - SCENE.accroche.from;
export const CHAOS_LEN = span("accroche", "chaos").len;
export const CHAOS_LEAK = S2 + 17;  // l'éclat bleu : tombe sur la troisième icône de la rafale

type Ic = { readonly name: SpriteName; readonly x: number; readonly y: number; readonly size: number; readonly at: number; readonly rot: number; readonly spin: number };
// Les cinq de la scène 1 (sur les temps 3, 4, 5, 5,5 et 6 : le rythme s'accélère), puis dix de plus à partir du début de la
// scène 2 (toutes les 8 images, puis de plus en plus serré). Les positions sont écartées d'au moins 175 px pour que les icônes
// ne se chevauchent pas, même agitées et grossies.
export const CHAOS_ICONS: readonly Ic[] = [
  { name: "telephone", x: 215, y: 470, size: 120, at: 100, rot: -8, spin: -70 },
  { name: "journal", x: 870, y: 500, size: 124, at: 133, rot: 7, spin: 80 },
  { name: "cloche", x: 205, y: 990, size: 124, at: 167, rot: -6, spin: -90 },
  { name: "graphique", x: 845, y: 945, size: 124, at: 183, rot: 8, spin: 75 },
  { name: "bitcoin", x: 585, y: 385, size: 116, at: 200, rot: -5, spin: -60 },
  { name: "piece", x: 775, y: 255, size: 112, at: S2, rot: 12, spin: 90 },
  { name: "billet", x: 330, y: 270, size: 124, at: S2 + 8, rot: -14, spin: -90 },
  { name: "tirelire", x: 615, y: 1085, size: 130, at: S2 + 16, rot: 9, spin: 100 },
  { name: "loupe", x: 385, y: 1100, size: 116, at: S2 + 24, rot: -12, spin: -80 },
  { name: "eclair", x: 520, y: 1255, size: 112, at: S2 + 31, rot: 14, spin: 90 },
  { name: "globe", x: 935, y: 790, size: 104, at: S2 + 38, rot: -8, spin: -90 },
  { name: "ordinateur", x: 145, y: 815, size: 116, at: S2 + 44, rot: 10, spin: 90 },
  { name: "tasse", x: 540, y: 190, size: 104, at: S2 + 50, rot: -10, spin: -90 },
  { name: "bougie", x: 130, y: 1190, size: 116, at: S2 + 56, rot: 8, spin: 90 },
  { name: "calendrier", x: 935, y: 1185, size: 104, at: S2 + 62, rot: -9, spin: -90 },
];
export const CHAOS_ICON_AT = CHAOS_ICONS.map((i) => i.at);

// Les mots de la scène 1 (trois lignes : 56 px) et ceux de la scène 2 (deux lignes), relatifs au début de leur scène
// Le trait de « d'applis » : il souligne le mot de gauche à droite puis fait sa boucle sous la ligne. Il est dessiné dans la
// boîte du mot (viewBox 150 × 30, largeur 116 % du mot) : il suit le texte quelle que soit sa taille.
const LOOP = "M 4 5 C 40 9 80 3 112 6 C 130 8 138 27 120 27 C 102 27 104 10 128 10 C 140 10 147 6 149 2";
export const CHAOS_WORDS_1 = [6, 12, 20, 26, 32, 42, 48, 53, 58];
export const CHAOS_WORDS_2 = [4, 12, 28, 44, 60];
const OUT_1 = S2 - 17;  // la question s'efface une demi-seconde avant la scène 2
export const Chaos: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f >= CHAOS_LEN) return null;
  const agit = ramp(f, S2, S2 + 130, 0, 1, LIN);
  const loop = <Hand key="loop" d={LOOP} box={[150, 30]} p={ramp(f, 40, 90, 0, 1, CAM)} style={{ left: "-2%", top: "76%", width: "116%" }} />;
  const w1: PWord[] = [
    { t: "combien", at: CHAOS_WORDS_1[0] }, { t: "d'applis", at: CHAOS_WORDS_1[1], deco: loop },
    { t: "t'ouvres", at: CHAOS_WORDS_1[2], br: true }, { t: "chaque", at: CHAOS_WORDS_1[3] }, { t: "matin", at: CHAOS_WORDS_1[4] },
    { t: "pour", at: CHAOS_WORDS_1[5], br: true }, { t: "suivre", at: CHAOS_WORDS_1[6] }, { t: "la", at: CHAOS_WORDS_1[7] }, { t: "bourse ?", at: CHAOS_WORDS_1[8] },
  ];
  const w2: PWord[] = [
    { t: "cac", at: S2 + CHAOS_WORDS_2[0] }, { t: "40.", at: S2 + CHAOS_WORDS_2[1] },
    { t: "crypto.", at: S2 + CHAOS_WORDS_2[2], br: true }, { t: "newsletters.", at: S2 + CHAOS_WORDS_2[3] }, { t: "alertes.", at: S2 + CHAOS_WORDS_2[4] },
  ];
  return (
    <Shot f={f} from={0} to={CHAOS_LEN} exit="inv" punch={punch(f, CHAOS_LEAK, 0.04, 3, 20)}>
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
        <div style={{ position: "absolute", left: 0, right: 0, top: PCY - 126 }}><Words words={w1} f={f} out={OUT_1} /></div>
        <div style={{ position: "absolute", left: 0, right: 0, top: PCY - 84 }}><Words words={w2} f={f} /></div>
      </Layer>
    </Shot>
  );
};
