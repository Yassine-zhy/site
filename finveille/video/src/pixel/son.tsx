// Le son de la publicité (musique : public/music ; bruitages : public/sfx-pixel, fabriqués par tools/pixel_sfx.py).
// Avant l'image 420, pas de musique, seulement des bruitages ; à 420 la musique démarre (décalée de 283 images dans le fichier,
// là où elle repart fort), volume 0,6 pour que les bruitages se détachent dessus, fondu de sortie sur les 40 dernières images.
//
// Les bruitages sont posés sur l'image exacte de l'événement visuel (les numéros viennent des scènes) :
//   - premier plan : l'impact et le sub_drop des coupes vers la nuit, la cloche (chime), la pièce (coin), le riser et le logo, les
//     whoosh des éclats et des zooms, les glitch des dissolutions en pixels (volumes 0,3 à 0,6)
//   - milieu : un blip par icône qui surgit (0,2 à 0,32), les stamp des coupes franches et des temps forts (0,3 à 0,4)
//   - fond : un tick très léger par mot qui apparaît (0,07 à 0,1), les lits d'air (swish_loop) sous les icônes qui bougent
// À 60 im/s la musique a un temps toutes les 28,3 images (à partir de l'image 420) : le riser finit sur le temps de 562.
import { Audio } from "@remotion/media";
import React from "react";
import { Sequence, staticFile, useCurrentFrame } from "remotion";
import { IN, LIN, ramp } from "../kit";
import { CHAOS_ICON_AT, CHAOS_WORDS_1, CHAOS_WORDS_2 } from "./chaos";
import { BELL_RING } from "./nuit";
import { FEN } from "./fenetre";
import { APP_CUT } from "./appareils";
import { FIN_FORMED } from "./finale";
import { PIXEL_TOTAL } from "./total";

export const MUSIC = { from: 420, trim: 283, volume: 0.6, fade: 40 };
// Les bruitages en version sans musique sont un peu plus forts
const SOLO = 1.2;

type Sfx = readonly [name: string, at: number, volume: number];
const tick = (volume: number, ...at: number[]): Sfx[] => at.map((a) => ["tick", a, volume] as const);

// [son, image, volume]
export const SFX: readonly Sfx[] = [
  // scène 1 (0 → 150) : un tick par mot, un blip par icône (ordre varié), le trait à la main qui entoure « d'applis »
  ...tick(0.1, ...CHAOS_WORDS_1),
  ["whoosh_up", 40, 0.1],
  ...CHAOS_ICON_AT.slice(0, 5).map((at, i) => [`blip${[1, 3, 2, 5, 4][i]}`, at, 0.32] as const),
  // scène 2 (150 → 300) : dix icônes en 54 images (une gamme qui monte, deux fois), un tick par mot, l'éclat bleu à 170, le souffle
  // qui aspire vers la coupe
  ...CHAOS_ICON_AT.slice(5).map((at, i) => [`blip${(i % 5) + 1}`, at, 0.24] as const),
  ...tick(0.1, ...CHAOS_WORDS_2),
  ["whoosh_up", 162, 0.4], ["whoosh_up", 280, 0.3],
  // scène 3 (300 → 420) : coupe au noir, la cloche claque puis se pose, « et au final ? » « t'as raté l'info. »
  ["impact", 300, 0.5], ["sub_drop", 300, 0.35], ["chime_soft", 322, 0.3],
  ...tick(0.1, 304, 310, 316, 322, 362, 368, 374),
  // scène 4 (420 → 600) : coupe sur le papier, cinq icônes qui filent vers l'anneau, « et si tout tenait au même endroit ? »,
  // l'anneau ralentit (546), le riser monte (72 images) et finit à 562 sur le temps fort, le logo se reconstitue en pixels (564 → 590)
  ["stamp", 420, 0.4],
  ...[422, 428, 434, 440, 446].map((at, i) => [`blip${i + 1}`, at, 0.2] as const),
  ...tick(0.09, 438, 445, 452, 459, 466, 473, 480),
  ["whoosh_down", 546, 0.3], ["riser", 490, 0.45], ["pop_logo", 563, 0.5], ["glitch2", 564, 0.18],
  // scène 5 (600 → 640) : la caméra fonce à travers le logo (éclat à 598), puis le blanc coupe sur la scène suivante
  ["whoosh_up", 582, 0.4],
  // scène 6 (640 → 820) : la fenêtre se reconstitue en pixels, trois icônes surgissent en orbite, « 43 sources. un seul fil. »
  ["stamp", 640, 0.4], ["glitch1", 640, 0.22],
  ["blip2", 648, 0.22], ["blip4", 652, 0.22], ["blip5", 656, 0.22],
  ...tick(0.1, 650, 657, 690, 696, 702),
  // scène 7 (820 → 1000) : coupe franche, la bougie et le graphique surgissent, « les marchés, en direct. »
  ["stamp", 820, 0.3], ["blip3", 822, 0.25], ["blip5", 828, 0.25],
  ...tick(0.1, 826, 832, 839, 845),
  // la carte des marchés vit : de petits pings espacés (fond), pour ne pas laisser la scène muette sans musique
  ["blip1", 856, 0.1], ["blip3", 892, 0.1], ["blip2", 928, 0.1], ["blip5", 964, 0.1],
  // scène 8 (1000 → 1180) : la fenêtre se dissout puis revient, « une question ? », « il te dit où il l'a lu. » et le trait autour de « où »
  ["glitch1", FEN.dissolve, 0.3], ["glitch2", FEN.reform, 0.3],
  ["chime_soft", 1036, 0.2],
  ...tick(0.1, 1006, 1013, 1090, 1096, 1102, 1108, 1114, 1120, 1126),
  ["whoosh_up", 1110, 0.1],
  // scène 9 (1180 → 1340) : le souffle monte, coupe au noir et éclat rouge, la cloche apparaît puis sonne, « tu fixes un seuil. »
  ["whoosh_up", 1160, 0.3], ["impact", 1180, 0.5], ["sub_drop", 1180, 0.35], ["whoosh_down", 1180, 0.25], ["blip3", 1184, 0.2],
  ["chime", BELL_RING, 0.6], ["chime_soft", BELL_RING + 17, 0.16],
  ...tick(0.1, 1196, 1203, 1210, 1217, 1262, 1268, 1274),
  // scène 10 (1340 → 1520) : coupe sur le papier, le téléphone puis l'ordinateur surgissent, « dans ta poche. », le thème passe
  // du jour (clair) à la nuit (globe) à 1430, « de jour comme de nuit. » ; le souffle monte vers le finale
  ["stamp", 1340, 0.35], ["blip2", 1344, 0.3], ["blip4", 1354, 0.3],
  ...tick(0.1, 1350, 1357, 1363, 1424, 1430, 1437, 1444, 1450),
  ["stamp", APP_CUT, 0.3], ["whoosh_up", 1500, 0.2],
  // scène 11 (1520 → 1660) : les lettres se rassemblent (neuf notes), la pièce d'or apparaît, « finveille » est formé, la promesse
  ["letters", 1540, 0.3], ["coin", FIN_FORMED - 12, 0.4], ["impact", FIN_FORMED, 0.3], ["stamp", FIN_FORMED, 0.2],
  ...tick(0.07, 1610, 1618, 1626, 1634, 1642),
  // scène 12 (1660 → 1800) : « gratuit · sans pub », l'adresse, « lien en commentaire ↓ », coupe au noir
  ...tick(0.1, 1666, 1674, 1680, 1722, 1728, 1734),
  ["stamp", 1694, 0.3], ["chime_soft", 1742, 0.3], ["sub_drop", 1776, 0.35],
];

// La vitesse de l'anneau d'icônes (scène 4), en degrés par image : la même formule que anneau.tsx (elle y est privée)
const RING_FROM = 420;
const ringSpeed = (u: number) => (u < RING_FROM ? 0 : 1.2 + 10.5 * ramp(u, RING_FROM, 540, 0, 1, IN) * (1 - ramp(u, 548, 578, 0, 1)));
const ringNorm = (u: number) => ringSpeed(u) / 11.7;

// Les lits d'air (swish_loop, en boucle) : [début, fin, hauteur (vitesse de lecture), volume selon l'image]
const BEDS: readonly (readonly [number, number, number, (f: number) => number])[] = [
  // le chaos des icônes qui s'agite (150 → 300) : de plus en plus présent
  [150, 300, 1.15, (f) => 0.03 + 0.09 * ramp(f, 150, 230, 0, 1, LIN)],
  // la nuit : l'ellipse qui tourne autour de la cloche
  [300, 420, 0.8, () => 0.04],
  // l'anneau d'icônes : le volume suit sa vitesse ; une seconde couche, plus aiguë, ne s'entend qu'à pleine vitesse
  [RING_FROM, 600, 1, (f) => 0.04 + 0.3 * ringNorm(f)],
  [RING_FROM, 600, 1.6, (f) => 0.2 * ringNorm(f) ** 3],
  // les trois icônes en orbite autour de la fenêtre, puis les scènes de la fenêtre (cartes, assistant)
  [646, 820, 1, () => 0.05],
  [822, 1180, 1, () => 0.04],
  [1184, 1340, 0.8, () => 0.04],
  [1344, 1520, 1, () => 0.04],
];

// Le volume d'un son posé à l'image `at` : à l'intérieur de sa Sequence l'image repart de 0 ; le son se coupe en fondu
// avant la fin de la vidéo (rien ne dépasse l'image 1800)
const toEnd = (abs: number) => Math.min(1, Math.max(0, (PIXEL_TOTAL - abs) / 8));

// La musique s'efface un instant sous les grands coups (le logo, la coupe rouge, la cloche, la pièce, le mot formé) : -3 dB (x 0,7),
// en 2 images, puis elle revient en 20 images ; c'est ce qui détache ces bruitages
const DIPS = [563, 1180, BELL_RING, FIN_FORMED - 12, FIN_FORMED];
const dip = (f: number) => Math.max(...DIPS.map((d) => ramp(f, d - 2, d, 0, 1, LIN) * (1 - ramp(f, d + 4, d + 24, 0, 1, LIN))));

const Music: React.FC = () => {
  const f = useCurrentFrame();  // dans la Sequence : 0 à l'image 420
  const len = PIXEL_TOTAL - MUSIC.from;
  const volume = MUSIC.volume * (1 - 0.3 * dip(f + MUSIC.from)) * (1 - ramp(f, len - MUSIC.fade, len, 0, 1, LIN));
  return <Audio src={staticFile("music/edit.wav")} trimBefore={MUSIC.trim} volume={volume} />;
};

// `music` faux : la version sans musique (composition « PixelSansMusique »), où les sons, seuls, sont un peu plus forts
export const Son: React.FC<{ readonly music?: boolean }> = ({ music = true }) => {
  const gain = music ? 1 : SOLO;
  return (
    <>
      {music && <Sequence from={MUSIC.from} durationInFrames={PIXEL_TOTAL - MUSIC.from} layout="none"><Music /></Sequence>}
      {SFX.map(([name, at, volume], i) => (
        <Sequence key={i} from={at} durationInFrames={150} layout="none">
          <Audio src={staticFile(`sfx-pixel/${name}.wav`)} volume={(local) => Math.min(1, volume * gain) * toEnd(at + local)} />
        </Sequence>
      ))}
      {BEDS.map(([from, to, rate, vol], i) => (
        <Sequence key={`lit${i}`} from={from} durationInFrames={to - from} layout="none">
          <Audio src={staticFile("sfx-pixel/swish_loop.wav")} loop playbackRate={rate}
            volume={(local) => Math.min(1, vol(from + local) * gain) * ramp(local, 0, 10, 0, 1, LIN) * (1 - ramp(local, to - from - 10, to - from, 0, 1, LIN)) * toEnd(from + local)} />
        </Sequence>
      ))}
    </>
  );
};
