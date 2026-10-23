// La bande-annonce de FinVeille v5 (étape 37) : une publicité de 53 s, sans voix off, sur une musique entraînante.
// 3 180 images, 1920 × 1080, 60 im/s. La musique (« Expressive Courage », Mixkit, montée par tools/trailer_assets.py)
// bat à 127 temps par minute : un temps = 28,344 images, b(k) donne l'image du temps k, une mesure = 4 temps.
// Elle se coupe aux temps 8 et 9 (on appuie sur le logo), repart au temps 10 (l'application s'ouvre), et s'arrête net
// au temps 106 (le logo, la cymbale qui s'éteint).
//
// | scène    | temps    | images      | ce qu'on voit                                                                    |
// | -------- | -------- | ----------- | -------------------------------------------------------------------------------- |
// | ouverture| 0 - 12   | 0 - 340     | le logo FinVeille et son nom ; un curseur appuie dessus pendant le silence ;    |
// |          |          |             | au retour de la musique l'icône s'agrandit jusqu'à remplir l'écran               |
// | actu     | 12 - 28  | 340 - 794   | un flot de dépêches de toutes les rubriques et de toutes les sources, qui se    |
// |          |          |             | range en un seul fil                                                             |
// | marchés  | 28 - 44  | 794 - 1247  | la courbe du CAC 40 en direct, les bandeaux de cotations, la carte du CAC 40     |
// | éco      | 44 - 56  | 1247 - 1587 | la courbe des taux, puis trois pièces de crypto                                  |
// | outils   | 56 - 72  | 1587 - 2041 | une question tapée et sa réponse sourcée, les alertes de cours, le portefeuille  |
// | partout  | 72 - 84  | 2041 - 2381 | le vrai site sur un ordinateur, puis sur un téléphone                            |
// | fin      | 84 - fin | 2381 - 3180 | tout ce qu'on a vu en une mosaïque, qui se resserre en logo ; l'adresse          |
//
// Les transitions entre scènes sont faites ici (zoom à travers, glissés) ; chaque scène gère ses enchaînements internes.
import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Backdrop, C, CAM, GlowKey, TOTAL, b, clamp, lerp, ramp } from "./kit";
import { Actu } from "./scenes/actu";
import { Eco } from "./scenes/eco";
import { Finale } from "./scenes/finale";
import { Marches } from "./scenes/marches";
import { Opening } from "./scenes/opening";
import { Outils } from "./scenes/outils";
import { Partout } from "./scenes/partout";

const LAV = "#8C86C8", TEAL = "#3DD6C6";
export const GLOW: readonly GlowKey[] = [
  [0, C.brand, 0.25], [b(6), C.brand, 0.6], [b(10), C.brand, 1], [b(12), C.brand, 0.8], [b(16), C.brand, 0.8],
  [b(17), C.violet, 0.85], [b(18), C.amber, 0.75], [b(19), TEAL, 0.75], [b(20.5), C.brand, 0.8], [b(28), C.brand, 0.8],
  [b(29), C.up, 0.55], [b(35.5), C.up, 0.55], [b(36.5), C.brand, 0.7], [b(44), C.brand, 0.7], [b(45), C.violet, 0.8],
  [b(50), C.violet, 0.8], [b(51), TEAL, 0.7], [b(56), TEAL, 0.6], [b(57), C.brand, 0.8], [b(62), C.brand, 0.8],
  [b(63), C.amber, 0.85], [b(67), C.amber, 0.8], [b(68), C.up, 0.6], [b(72), C.up, 0.6], [b(73), LAV, 0.8],
  [b(84), LAV, 0.8], [b(85), C.brand, 0.9], [b(96), C.brand, 1], [b(106), C.brand, 0.9], [TOTAL, C.brand, 0.2],
];

// --- Les transitions : chaque scène entre et sort par un zoom à travers, ou un glissé (horizontal ou vertical) -------------
type Tr = "none" | "zoom" | "whipX" | "whipY";
const HALF = b(0.5);  // une transition dure un temps, centrée sur la frontière
const look = (kind: Tr, p: number, side: "in" | "out"): React.CSSProperties => {
  // p = 0 : la scène est pleinement là ; p = 1 : elle a disparu (de l'autre côté de la transition)
  if (kind === "none" || p <= 0) return {};
  const blur = `blur(${p * 22}px)`;
  const opacity = clamp(1 - p * 1.25, 0, 1);
  if (kind === "zoom") return { scale: String(side === "out" ? lerp(1, 1.4, p) : lerp(1, 0.8, p)), filter: blur, opacity };
  const d = side === "out" ? -1 : 1;
  if (kind === "whipX") return { translate: `${d * p * 1100}px 0`, filter: blur, opacity };
  return { translate: `0 ${d * p * 800}px`, filter: blur, opacity };
};
const Shot: React.FC<{ readonly from: number; readonly to: number; readonly enter: Tr; readonly exit: Tr; readonly children: React.ReactNode }> = ({ from, to, enter, exit, children }) => {
  const f = useCurrentFrame();
  if (f < from - HALF || f > to + HALF) return null;
  const pin = 1 - ramp(f, from - HALF, from + HALF, 0, 1, CAM);
  const pout = ramp(f, to - HALF, to + HALF, 0, 1, CAM);
  const style = f < (from + to) / 2 ? look(enter, enter === "none" ? 0 : pin, "in") : look(exit, exit === "none" ? 0 : pout, "out");
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

// --- Le son : la musique et quelques sons d'interface discrets (public/sfx, faits par tools/music.py) ---------------------
const SFX: readonly (readonly [string, number, number])[] = [
  ["click", b(8), 0.55], ["whoosh", b(9.4), 0.35],
  ["whoosh", b(27.6), 0.3], ["whoosh", b(43.6), 0.3], ["whoosh", b(55.6), 0.3], ["whoosh", b(71.6), 0.3], ["whoosh", b(83.6), 0.25],
  ...Array.from({ length: 14 }, (_, i) => ["keys", b(57) + i * 4, 0.16] as const),
  ["click", b(59.25), 0.3], ["bell", b(63.5), 0.4], ["tick", b(63.75), 0.25], ["bell", b(65.5), 0.22], ["tick", b(65.75), 0.25],
];
const Sound: React.FC = () => (
  <>
    <Audio src={staticFile("music/edit.wav")} volume={0.9} />
    {SFX.map(([name, at, volume], i) => (
      <Sequence key={i} from={at} durationInFrames={b(6)} layout="none">
        <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
      </Sequence>
    ))}
  </>
);

// Le visuel seul (sans le son) : la composition « Trailer » y ajoute la musique et les bruitages (<Sound />), la composition
// « TrailerSfx » (src/TrailerSfx.tsx) le rejoue à un temps remappé, avec ses propres bruitages et sans l'adresse (showUrl faux).
export const TrailerVisual: React.FC<{ readonly showUrl?: boolean }> = ({ showUrl = true }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <Backdrop f={f} glow={GLOW} />
      <Shot from={b(12)} to={b(28)} enter="none" exit="zoom"><Actu /></Shot>
      <Shot from={b(28)} to={b(44)} enter="zoom" exit="whipX"><Marches /></Shot>
      <Shot from={b(44)} to={b(56)} enter="whipX" exit="zoom"><Eco /></Shot>
      <Shot from={b(56)} to={b(72)} enter="zoom" exit="whipY"><Outils /></Shot>
      <Shot from={b(72)} to={b(84)} enter="whipY" exit="zoom"><Partout /></Shot>
      <Shot from={b(84)} to={TOTAL + HALF} enter="zoom" exit="none"><Finale showUrl={showUrl} /></Shot>
      <Opening />
    </AbsoluteFill>
  );
};

export const Trailer: React.FC = () => (
  <>
    <TrailerVisual />
    <Sound />
  </>
);
