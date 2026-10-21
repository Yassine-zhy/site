// La bande-annonce de FinVeille v4 (étape 36) : une publicité d'application, sans voix off, sur une vraie musique.
// 2 000 images, 1920 × 1080, 60 im/s. Un seul plan continu : chaque élément d'interface se transforme en le suivant, la
// caméra ne coupe jamais. La musique (« Uplifting Bass », Lily J, Mixkit, montée par tools/trailer_assets.py) bat à
// 67 temps par minute : un temps = 53,733 images, b(k) donne l'image du temps k ; le drop est au temps 4, l'accord final
// au temps 32. Les gros mouvements partent sur un temps, les petits sur un demi-temps.
//
// | id | temps       | images      | ce qu'on voit                                                                         |
// | -- | ----------- | ----------- | ------------------------------------------------------------------------------------- |
// | A  | 0 - 7,5     | 0 - 403     | la carte du CAC 40 inclinée sort du noir ; au drop, la barre du jour s'allume, la     |
// |    |             |             | carte se redresse, la caméra plonge dans la barre, qui devient un point lumineux      |
// | B  | 7,5 - 12,5  | 403 - 672   | le point devient une pastille « Marchés » qui compte, trois autres la rejoignent,     |
// |    |             |             | une accolade les réunit : « Dépêches du moment » ; la caméra monte                    |
// | C  | 11,5 - 17   | 618 - 913   | l'icône de l'assistant, la question tapée, la réponse et ses trois sources            |
// | D  | 16 - 22,5   | 860 - 1209  | la réponse devient une tuile du mur des 15 maquettes 3D, survolé en 3D ; plongée dans |
// |    |             |             | la cloche                                                                             |
// | E  | 22 - 25     | 1182 - 1343 | la cloche vectorielle sonne, lueur ambre, la notification « Alerte de cours » tombe   |
// | F  | 25 - 28     | 1343 - 1505 | le carré de la cloche s'arrondit en anneau : le portefeuille d'entraînement           |
// | G  | 28 - 32     | 1505 - 1719 | l'anneau s'étire en bouton « Commencer », un reflet le balaie, on appuie              |
// | H  | 32 - fin    | 1719 - 2000 | le bouton devient le logo, « FinVeille », la phrase de la marque, puis l'adresse     |
import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Backdrop, C, GlowKey, TOTAL, b } from "./kit";
import { Alert } from "./scenes/alert";
import { Assistant } from "./scenes/assistant";
import { Finale } from "./scenes/finale";
import { Market } from "./scenes/market";
import { News } from "./scenes/news";
import { Portfolio } from "./scenes/portfolio";
import { Wall } from "./scenes/wall";

// La couleur de la lueur du fond, scène par scène (elle glisse d'une couleur à l'autre pendant les transitions)
const LAV = "#8C86C8";
const GLOW: readonly GlowKey[] = [
  [0, C.brand, 0], [b(3), C.brand, 0.45], [b(4), C.brand, 0.95], [b(7), C.brand, 0.8], [b(8), LAV, 0.75], [b(11.5), LAV, 0.75],
  [b(12.5), C.violet, 0.95], [b(16), C.violet, 0.9], [b(17), C.brand, 0.8], [b(22), C.brand, 0.7], [b(23), C.amber, 0.9],
  [b(25), C.amber, 0.7], [b(26), C.up, 0.6], [b(27.5), C.up, 0.6], [b(28.5), LAV, 0.8], [b(31.5), LAV, 0.8], [b(32), C.brand, 1],
  [b(35), C.brand, 0.8], [TOTAL, C.brand, 0.2],
];

// L'habillage sonore : la musique, et quelques sons d'interface discrets (public/sfx, faits par tools/music.py)
const SFX: readonly (readonly [string, number, number])[] = [
  ["tick", b(8), 0.3], ["tick", b(8.75), 0.22], ["tick", b(9.25), 0.22], ["tick", b(9.75), 0.22],
  ["whoosh", b(11.35), 0.3], ["whoosh", b(15.85), 0.3], ["whoosh", b(20.45), 0.35],
  ...Array.from({ length: 16 }, (_, i) => ["keys", b(13) + i * 5, 0.14] as const),
  ["bell", b(23), 0.45], ["whoosh", b(27.4), 0.25], ["click", b(31), 0.4],
];

const Sound: React.FC = () => (
  <>
    <Audio src={staticFile("music/edit.wav")} volume={0.9} />
    {SFX.map(([name, at, volume], i) => (
      <Sequence key={i} from={at} durationInFrames={b(3)} layout="none">
        <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
      </Sequence>
    ))}
  </>
);

export const Trailer: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <Backdrop f={f} glow={GLOW} />
      <Market />
      <News />
      <Assistant />
      <Wall />
      <Alert />
      <Portfolio />
      <Finale />
      <Sound />
    </AbsoluteFill>
  );
};
