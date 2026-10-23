// La publicité pixel art de FinVeille : une pub verticale de 30 s, sans voix off, dans le style d'une pub TikTok minimaliste
// (fond papier gris à grain, petits textes qui arrivent mot à mot, icônes pixel art épaisses, plans sombres au sujet lumineux,
// éclats de lumière, transitions en carrés). 1 800 images, 1080 × 1350 (4:5), 60 im/s ; tout est calé sur le numéro de l'image.
// Les couleurs sont dans pixel/theme.ts, les icônes dans pixel/sprites.ts, les effets dans pixel/fx.tsx.
//
// | scène | images      | ce qu'on voit                                                                                       |
// | ----- | ----------- | --------------------------------------------------------------------------------------------------- |
// | 1     | 0 - 150     | papier ; « combien d'applis t'ouvres chaque matin pour suivre la bourse ? », des icônes surgissent    |
// | 2     | 150 - 300   | le chaos d'icônes, éclat bleu à 170, « cac 40. crypto. newsletters. alertes. »                        |
// | 3     | 300 - 420   | coupe au noir : la grosse cloche bleue lumineuse, « et au final ? » « t'as raté l'info. »             |
// | 4     | 420 - 600   | papier : les icônes en anneau qui tourne, « et si tout tenait au même endroit ? », le logo en pixels   |
// | 5     | 600 - 640   | zoom à travers le logo, éclat bleu                                                                   |
// | 6     | 640 - 820   | la fenêtre (le fil) se reconstitue en pixels ; « 43 sources. un seul fil. » ; trois icônes en orbite  |
// | 7     | 820 - 1000  | la carte des marchés ; « les marchés, en direct. »                                                   |
// | 8     | 1000 - 1180 | la fenêtre se dissout et revient avec l'assistant ; « une question ? » « il te dit où il l'a lu. »   |
// | 9     | 1180 - 1340 | coupe au noir, éclat rouge : la cloche sonne ; « tu fixes un seuil. » « il te prévient. »             |
// | 10    | 1340 - 1520 | téléphone et ordinateur ; « dans ta poche. » « de jour comme de nuit. »                              |
// | 11    | 1520 - 1660 | les lettres éparpillées forment « finveille », la pièce d'or tourne, la promesse                     |
// | 12    | 1660 - 1800 | « gratuit · sans pub », l'adresse, « lien en commentaire ↓ » ; coupe au noir à 1780                  |
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Appareils } from "./pixel/appareils";
import { Anneau } from "./pixel/anneau";
import { Chaos } from "./pixel/chaos";
import { Fenetre } from "./pixel/fenetre";
import { Finale } from "./pixel/finale";
import { Leak, Paper } from "./pixel/fx";
import { Nuit3, Nuit9 } from "./pixel/nuit";
import { Son } from "./pixel/son";
import { PX } from "./pixel/theme";
export { PIXEL_TOTAL } from "./pixel/total";

// Les plans sombres : la scène 3, la scène 9 et le noir final
const isDark = (f: number) => (f >= 300 && f < 420) || (f >= 1180 && f < 1340) || f >= 1780;

export const Pixel: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: PX.paper, overflow: "hidden" }}>
      <Paper f={f} dark={isDark(f)} />
      <Chaos f={f} />
      <Nuit3 f={f} />
      <Anneau f={f} />
      <Fenetre f={f} />
      <Nuit9 f={f} />
      <Appareils f={f} />
      <Finale f={f} />
      {/* les éclats de lumière : bleu à 170 et pendant le zoom, rouge (l'alerte) à 1180 */}
      <Leak f={f} at={170} />
      <Leak f={f} at={598} dir={-1} angle={14} />
      <Leak f={f} at={1180} from={PX.alert} to="#FF7A3D" screen angle={-12} />
      <Son />
    </AbsoluteFill>
  );
};
