// Le son de la publicité (public/sfx et public/music) : avant l'image 420, pas de musique, seulement des sons ; à 420 la musique
// démarre (décalée de 283 images dans le fichier, là où elle repart fort), volume 0,75, fondu de sortie sur les 40 dernières images.
import { Audio } from "@remotion/media";
import React from "react";
import { Sequence, staticFile, useCurrentFrame } from "remotion";
import { ramp, LIN } from "../kit";
import { CHAOS_ICON_AT, CHAOS_WORDS_1, CHAOS_WORDS_2 } from "./chaos";
import { BELL_RING } from "./nuit";
import { FEN } from "./fenetre";
import { PIXEL_TOTAL } from "./total";

export const MUSIC = { from: 420, trim: 283, volume: 0.75, fade: 40 };
// [son, image, volume]
const SFX: readonly (readonly [string, number, number])[] = [
  // scènes 1 à 3 : un tick par icône, des touches de clavier sous les mots, le whoosh de l'éclat bleu, l'impact de la coupe au noir, la cloche
  ...CHAOS_ICON_AT.map((at) => ["tick", at, 0.25] as const),
  ...[...CHAOS_WORDS_1, ...CHAOS_WORDS_2].map((at) => ["keys", at, 0.12] as const),
  ["whoosh", 170, 0.35], ["impact", 300, 0.5], ["bell", 330, 0.3],
  // ensuite : un clic à chaque coupe franche, un whoosh à chaque zoom et éclat de lumière, un tick à chaque dissolution en pixels
  ["click", 420, 0.3], ["tick", 566, 0.2], ["whoosh", 598, 0.3], ["click", 640, 0.3], ["tick", 642, 0.2], ["click", 820, 0.3],
  ["tick", FEN.dissolve, 0.2], ["tick", FEN.reform, 0.2], ["click", 1180, 0.3], ["whoosh", 1180, 0.3], ["bell", BELL_RING, 0.45],
  ["click", 1340, 0.3], ["click", 1520, 0.3], ["impact", 1600, 0.45], ["click", 1780, 0.3],
];

const Music: React.FC = () => {
  const f = useCurrentFrame();  // dans la Sequence : 0 à l'image 420
  const len = PIXEL_TOTAL - MUSIC.from;
  const volume = MUSIC.volume * (1 - ramp(f, len - MUSIC.fade, len, 0, 1, LIN));
  return <Audio src={staticFile("music/edit.wav")} trimBefore={MUSIC.trim} volume={volume} />;
};

// `music` faux : la version sans musique (composition « PixelSansMusique »), où les sons, seuls, sont un peu plus forts
export const Son: React.FC<{ readonly music?: boolean }> = ({ music = true }) => (
  <>
    {music && <Sequence from={MUSIC.from} durationInFrames={PIXEL_TOTAL - MUSIC.from} layout="none"><Music /></Sequence>}
    {SFX.map(([name, at, volume], i) => (
      <Sequence key={i} from={at} durationInFrames={150} layout="none">
        <Audio src={staticFile(`sfx/${name}.wav`)} volume={music ? volume : Math.min(1, volume * 1.4)} />
      </Sequence>
    ))}
  </>
);
