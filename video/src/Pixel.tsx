// La publicité pixel art de FinVeille : une pub verticale de 47,8 s, sans voix off, dans le style d'une pub TikTok minimaliste
// (fond papier gris à grain, textes qui arrivent mot à mot et restent lisibles, icônes pixel art épaisses, plans sombres au sujet
// lumineux, éclats de lumière, transitions en carrés, zooms de caméra dans les fenêtres du vrai site). 2 867 images, 1080 × 1350
// (4:5), 60 im/s ; tout est calé sur le numéro de l'image, et le montage sur les temps de la musique (108 battements par minute :
// un temps = 33,33 images, `beat(k)` dans pixel/montage.ts). Chaque scène travaille en temps LOCAL (image depuis son début) ;
// le tableau SCENES (début, fin) est dans pixel/montage.ts. Le rythme : un début calme (plans longs, on lit), un creux presque
// silencieux à la fin de la scène 3, le départ fort de la musique sur la scène 4, des coupes de plus en plus serrées (zooms dans
// les fenêtres des scènes 6 à 8), une rafale de plans-éclairs, puis une fin calme.
// Les couleurs sont dans pixel/theme.ts, les icônes dans pixel/sprites.ts, les effets dans pixel/fx.tsx, le son dans pixel/son.tsx.
//
// | scène | temps   | images      | ce qu'on voit                                                                                      |
// | ----- | ------- | ----------- | -------------------------------------------------------------------------------------------------- |
// | 1     | 0 - 7   | 0 - 233     | papier ; « combien d'applis t'ouvres chaque matin pour suivre la bourse ? », des icônes surgissent  |
// | 2     | 7 - 13  | 233 - 433   | le chaos d'icônes, éclat bleu, « cac 40. crypto. newsletters. alertes. »                           |
// | 3     | 13 - 19 | 433 - 633   | coupe au noir : la grosse cloche bleue lumineuse, « et au final ? » « t'as raté l'info. » ; creux  |
// | 4     | 19 - 27 | 633 - 900   | papier, la musique repart fort : les icônes en anneau qui tourne, « et si tout tenait... », le logo |
// | 5     | 27 - 28 | 900 - 933   | zoom à travers le logo, éclat blanc                                                                |
// | 6     | 28 - 37 | 933 - 1233  | la fenêtre (le fil), zoom lent sur la dépêche ; « 43 sources. un seul fil. » ; trois icônes en orbite |
// | 7     | 37 - 45 | 1233 - 1500 | la carte des marchés, trois zooms sur les cases du CAC 40 ; « les marchés, en direct. »             |
// | 8     | 45 - 56 | 1500 - 1867 | la fenêtre revient avec l'assistant : zoom sur la question tapée, sur la réponse et ses sources     |
// | 9     | 56 - 62 | 1867 - 2067 | coupe au noir, éclat rouge : la cloche sonne ; « tu fixes un seuil. » « il te prévient. »          |
// | 10    | 62 - 69 | 2067 - 2300 | téléphone et ordinateur ; « dans ta poche. » « de jour comme de nuit. »                            |
// | 10b   | 69 - 72 | 2300 - 2400 | la rafale : six plans-éclairs (papier / nuit), de grosses icônes puis le logo                      |
// | 11    | 72 - 78 | 2400 - 2600 | les lettres éparpillées forment « FinVeille », la pièce d'or tourne, la promesse                   |
// | 12    | 78 - 86 | 2600 - 2867 | « gratuit · sans pub », « lien en commentaire ↓ », la mention ; coupe au noir sur les 20 dernières |
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Appareils } from "./pixel/appareils";
import { Anneau, ZOOM_AT } from "./pixel/anneau";
import { Chaos, CHAOS_LEAK } from "./pixel/chaos";
import { Fil, Ia, Marches } from "./pixel/fenetre";
import { Finale } from "./pixel/finale";
import { Leak, Paper } from "./pixel/fx";
import { SCENE, SCENES, PIXEL_TOTAL, span } from "./pixel/montage";
import { Nuit3, Nuit9 } from "./pixel/nuit";
import { Rafale, rafaleDark } from "./pixel/rafale";
import { Son } from "./pixel/son";
import { PX } from "./pixel/theme";
export { PIXEL_TOTAL, SCENES };

// Les plans sombres : la scène 3, la scène 9, un plan sur deux de la rafale, et le noir des 20 dernières images
const isDark = (f: number) =>
  (f >= SCENE.nuit.from && f < SCENE.nuit.to) || (f >= SCENE.alerte.from && f < SCENE.alerte.to) || rafaleDark(f - SCENE.rafale.from) || f >= PIXEL_TOTAL - 20;

// Un plan : un bloc de scènes qui se suivent sans coupe ; ses enfants reçoivent l'image LOCALE (0 = début de la première scène)
const Local: React.FC<{ readonly children: (f: number) => React.ReactNode }> = ({ children }) => <>{children(useCurrentFrame())}</>;
const Plan: React.FC<{ readonly from: number; readonly to: number; readonly children: (f: number) => React.ReactNode }> = ({ from, to, children }) => (
  <Sequence from={from} durationInFrames={to - from} layout="none"><Local>{children}</Local></Sequence>
);

export const Pixel: React.FC<{ readonly music?: boolean }> = ({ music = true }) => {
  const f = useCurrentFrame();
  const chaos = span("accroche", "chaos"), anneau = span("anneau", "zoomLogo"), finale = span("lettres", "fin");
  return (
    <AbsoluteFill style={{ background: PX.paper, overflow: "hidden" }}>
      <Paper f={f} dark={isDark(f)} />
      <Plan {...chaos}>{(t) => <Chaos f={t} />}</Plan>
      <Plan {...SCENE.nuit}>{(t) => <Nuit3 f={t} />}</Plan>
      <Plan {...anneau}>{(t) => <Anneau f={t} />}</Plan>
      <Plan {...SCENE.fil}>{(t) => <Fil f={t} />}</Plan>
      <Plan {...SCENE.marches}>{(t) => <Marches f={t} />}</Plan>
      <Plan {...SCENE.ia}>{(t) => <Ia f={t} />}</Plan>
      <Plan {...SCENE.alerte}>{(t) => <Nuit9 f={t} />}</Plan>
      <Plan {...SCENE.appareils}>{(t) => <Appareils f={t} />}</Plan>
      <Plan {...SCENE.rafale}>{(t) => <Rafale f={t} />}</Plan>
      <Plan {...finale}>{(t) => <Finale f={t} />}</Plan>
      {/* les éclats de lumière : bleu dans le chaos et pendant le zoom, rouge (l'alerte) à l'entrée de la scène 9 */}
      <Leak f={f} at={chaos.from + CHAOS_LEAK} />
      <Leak f={f} at={anneau.from + ZOOM_AT - 2} dir={-1} angle={14} />
      <Leak f={f} at={SCENE.alerte.from} from={PX.alert} to="#FF7A3D" screen angle={-12} />
      <Son music={music} />
    </AbsoluteFill>
  );
};
