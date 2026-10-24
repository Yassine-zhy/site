// La bande-annonce avec un habillage sonore discret : la même image que « Trailer » (53 s, même vitesse, adresse comprise),
// sans musique, avec une quinzaine de bruitages seulement (public/sfx-trailer, faits par tools/trailer_sfx.py) : les
// transitions entre scènes, et quelques temps forts. Le reste du temps, le silence.
//
// | moment                              | temps      | son                       |
// | ----------------------------------- | ---------- | ------------------------- |
// | le curseur appuie sur le logo       | 8          | ui_click                  |
// | l'icône s'agrandit, l'appli s'ouvre | 9,3        | whoosh_hard               |
// | transitions en zoom à travers       | 28, 56, 84 | whoosh_hard (0,4 temps avant la frontière, pour que le souffle culmine dessus) |
// | transitions en glissé               | 44, 72     | whoosh_soft (idem)        |
// | la question part                    | 59,25      | send                      |
// | les deux alertes tombent            | 63,5, 65,5 | notif                     |
// | les tuiles de la fin s'envolent     | 92         | whoosh_soft               |
// | le logo grandit et signe            | 94,5       | logo_reveal               |
// | l'arrêt final                       | 106        | impact + outro_tail       |
import { Audio } from "@remotion/media";
import React from "react";
import { Sequence, staticFile } from "remotion";
import { b } from "./kit";
import { TrailerVisual } from "./Trailer";

const SFX: readonly (readonly [name: string, at: number, volume: number])[] = [
  ["ui_click", b(8), 0.45], ["whoosh_hard", b(9.3), 0.45],
  ["whoosh_hard", b(27.6), 0.4], ["whoosh_soft", b(43.6), 0.45], ["whoosh_hard", b(55.6), 0.4],
  ["send", b(59.25), 0.25], ["notif", b(63.5), 0.28], ["notif", b(65.5), 0.16],
  ["whoosh_soft", b(71.6), 0.45], ["whoosh_hard", b(83.6), 0.4],
  ["whoosh_soft", b(92), 0.3], ["logo_reveal", b(94.5), 0.35], ["impact", b(106), 0.4], ["outro_tail", b(106), 0.3],
];

// +4 dB sur l'ensemble (sans quoi la crête restait à -10,6 dB : trop bas sur un téléphone)
const MASTER = 1.58;

export const TrailerDiscret: React.FC = () => (
  <>
    <TrailerVisual />
    {SFX.map(([name, at, volume], i) => (
      <Sequence key={i} from={Math.round(at)} durationInFrames={b(8)} layout="none">
        <Audio src={staticFile(`sfx-trailer/${name}.wav`)} volume={volume * MASTER} />
      </Sequence>
    ))}
  </>
);
