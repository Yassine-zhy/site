// Scènes 1 et 2 (images 0 → 300) : sur le gris papier, la question « combien d'applis t'ouvres chaque matin pour suivre la
// bourse ? » ; des icônes surgissent une à une autour du texte, puis se multiplient et s'agitent (le chaos) ; un éclat bleu
// balaie l'écran à 170 ; le texte devient « cac 40. crypto. newsletters. alertes. ».
import React from "react";
import { PCY, Hand, Icon, PWord, Words, bob } from "./fx";
import { LIN, clamp, pop, ramp } from "../kit";
import { SpriteName } from "./sprites";

type Ic = { readonly name: SpriteName; readonly x: number; readonly y: number; readonly size: number; readonly at: number; readonly rot: number; readonly spin: number };
// Les cinq de la scène 1 (toutes les 14 images à partir de 70), puis dix de plus à partir de 152 (toutes les 6 images)
export const CHAOS_ICONS: readonly Ic[] = [
  { name: "telephone", x: 200, y: 450, size: 120, at: 70, rot: -8, spin: -70 },
  { name: "journal", x: 870, y: 500, size: 124, at: 84, rot: 7, spin: 80 },
  { name: "cloche", x: 215, y: 905, size: 124, at: 98, rot: -6, spin: -90 },
  { name: "graphique", x: 855, y: 920, size: 124, at: 112, rot: 8, spin: 75 },
  { name: "bitcoin", x: 545, y: 360, size: 116, at: 126, rot: -5, spin: -60 },
  { name: "piece", x: 800, y: 270, size: 112, at: 152, rot: 12, spin: 90 },
  { name: "billet", x: 300, y: 250, size: 124, at: 158, rot: -14, spin: -90 },
  { name: "tirelire", x: 640, y: 1090, size: 130, at: 164, rot: 9, spin: 100 },
  { name: "loupe", x: 360, y: 1070, size: 116, at: 170, rot: -12, spin: -80 },
  { name: "eclair", x: 470, y: 1195, size: 112, at: 176, rot: 14, spin: 90 },
  { name: "globe", x: 925, y: 760, size: 104, at: 182, rot: -8, spin: -90 },
  { name: "ordinateur", x: 150, y: 710, size: 116, at: 188, rot: 10, spin: 90 },
  { name: "tasse", x: 690, y: 215, size: 104, at: 194, rot: -10, spin: -90 },
  { name: "bougie", x: 140, y: 1170, size: 116, at: 200, rot: 8, spin: 90 },
  { name: "calendrier", x: 925, y: 1170, size: 104, at: 206, rot: -9, spin: -90 },
];
export const CHAOS_ICON_AT = CHAOS_ICONS.map((i) => i.at);

// Les mots de la scène 1 (une ligne, puis la ligne dessous) et ceux de la scène 2 (un mot toutes les 12 images)
const LOOP = "M 4 96 C 18 58 58 70 80 50 C 102 28 74 2 54 22 C 36 40 68 74 110 52 C 128 42 138 30 150 18";
export const CHAOS_WORDS_1 = [4, 10, 16, 22, 28, 40, 46, 52, 58];
export const CHAOS_WORDS_2 = [156, 168, 180, 192, 204];
export const Chaos: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f >= 300) return null;
  const agit = ramp(f, 150, 230, 0, 1, LIN);
  const loop = <Hand key="loop" d={LOOP} box={[154, 100]} p={ramp(f, 38, 70, 0, 1, LIN)} style={{ left: "38%", bottom: "78%" }} />;
  const w1: PWord[] = [
    { t: "combien", at: 4 }, { t: "d'applis", at: 10, deco: loop }, { t: "t'ouvres", at: 16 }, { t: "chaque", at: 22 }, { t: "matin", at: 28 },
    { t: "pour", at: 40, br: true }, { t: "suivre", at: 46 }, { t: "la", at: 52 }, { t: "bourse ?", at: 58 },
  ];
  const w2: PWord[] = [{ t: "cac", at: 156 }, { t: "40.", at: 168 }, { t: "crypto.", at: 180 }, { t: "newsletters.", at: 192 }, { t: "alertes.", at: 204 }];
  return (
    <>
      {CHAOS_ICONS.map((ic, i) => {
        if (f < ic.at) return null;
        const born = pop(f, ic.at, 11, 170, 0.7), settle = ramp(f, ic.at, ic.at + 20);
        const phase = i * 1.9;
        const rot = ic.rot + (1 - settle) * ic.spin + agit * 11 * Math.sin(f / 3.3 + phase);
        const x = ic.x + bob(f, phase, 6, 41) + agit * 15 * Math.sin(f / 4.1 + phase * 2);
        const y = ic.y + bob(f, phase + 1, 7, 37) + agit * 15 * Math.cos(f / 3.6 + phase);
        const grow = 1 + 0.22 * agit * (i % 2 ? 1 : 0.6);
        return <Icon key={i} name={ic.name} x={x} y={y} size={ic.size * grow} rot={rot} scale={clamp(born, 0, 1.25)} />;
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: PCY - 62 }}><Words words={w1} f={f} out={138} /></div>
      <div style={{ position: "absolute", left: 0, right: 0, top: PCY - 28 }}><Words words={w2} f={f} /></div>
    </>
  );
};
