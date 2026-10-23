// Le son de la publicité (musique : public/music ; bruitages : public/sfx-pixel, fabriqués par tools/pixel_sfx.py).
// Avant `DROP` (le début de la scène 4), pas de musique, seulement des bruitages, de plus en plus rares : à la fin de la scène 3 vient
// le CREUX (50 images : tout s'éteint, sauf un souffle presque inaudible). Puis la musique démarre pile sur `DROP`, avec un impact : elle
// est décalée de 333 images dans le fichier (music/edit108.wav, la même musique à 108 battements par minute), là où elle repart
// fort. Volume 0,6 pour que les bruitages se détachent dessus, fondu de sortie sur les 60 dernières images.
//
// Tous les sons sont posés RELATIVEMENT au début de leur scène (`at("scène", image locale)`, voir montage.ts) : si une scène change de
// durée, il suffit de décaler les débuts, rien ne se désynchronise. Les numéros viennent des scènes (les mots, les caméras...).
//   - premier plan : l'impact et le sub_drop des coupes vers la nuit, la cloche (chime), la pièce (coin), le riser et le logo, les
//     whoosh des éclats, des zooms et de la rafale, les glitch des dissolutions en pixels (volumes 0,3 à 0,6)
//   - milieu : un blip par icône qui surgit (0,2 à 0,32), les stamp des coupes franches et des temps forts (0,3 à 0,4)
//   - fond : un tick très léger par mot qui apparaît (0,07 à 0,1), les lits d'air (swish_loop) sous les icônes qui bougent
// À 60 im/s la musique a un temps toutes les 33,3 images à partir de DROP : le riser finit sur le temps de la pose du logo.
import { Audio } from "@remotion/media";
import React from "react";
import { Sequence, staticFile, useCurrentFrame } from "remotion";
import { LIN, ramp } from "../kit";
import { RING_SLOW, RING_WORDS, LOGO_POP, ZOOM_AT, ringNorm } from "./anneau";
import { APP_CUT, APP_LEN, APP_WORDS } from "./appareils";
import { CHAOS_ICON_AT, CHAOS_LEAK, CHAOS_WORDS_1, CHAOS_WORDS_2 } from "./chaos";
import { FIL_KEYS, FIL_WORDS, IA, IA_KEYS, IA_LEN, IA_WORDS_A, IA_WORDS_B, MARCHES_KEYS, MARCHES_LEN, MARCHES_PINGS, MARCHES_WORDS } from "./fenetre";
import { FIN_ARROW, FIN_BLACK, FIN_FORMED, FIN_L1, FIN_L3, FIN_NOTE, FIN_SUB } from "./finale";
import { DROP, PIXEL_TOTAL, SCENE, SceneId } from "./montage";
import { BELL_RING, BELL_RING_2, CREUX, NUIT3_LEN, NUIT3_WORDS, NUIT9_WORDS } from "./nuit";
import { RAFALE_CUTS } from "./rafale";
import { Cam } from "./zoom";

export const MUSIC = { from: DROP, trim: 333, volume: 0.6, fade: 60 };
// Les bruitages en version sans musique sont un peu plus forts
const SOLO = 1.2;

// L'image absolue d'un instant donné en temps local d'une scène
const at = (id: SceneId, local: number) => SCENE[id].from + local;

type Sfx = readonly [name: string, at: number, volume: number];
const ticks = (volume: number, id: SceneId, locals: readonly number[]): Sfx[] => locals.map((l) => ["tick", at(id, l), volume] as const);
// Un léger whoosh_up à chaque mouvement de caméra (les coupes sans durée et l'état de départ n'en ont pas) ; plus doux si le glissement est lent
const zooms = (id: SceneId, keys: readonly Cam[]): Sfx[] => keys.slice(1).filter((k) => k.dur > 0).map((k) => ["whoosh_up", at(id, k.at), k.dur >= 60 ? 0.06 : 0.1] as const);

// [son, image, volume]
export const SFX: readonly Sfx[] = [
  // scène 1 : un tick par mot, un blip par icône (ordre varié, calmes), le trait à la main qui entoure « d'applis »
  ...ticks(0.1, "accroche", CHAOS_WORDS_1),
  ["whoosh_up", at("accroche", 40), 0.1],
  ...CHAOS_ICON_AT.slice(0, 5).map((a, i) => [`blip${[1, 3, 2, 5, 4][i]}`, at("accroche", a), 0.28] as const),
  // scène 2 : dix icônes en rafale (une gamme qui monte, deux fois), un tick par mot, l'éclat bleu, le souffle qui aspire vers la coupe
  ...CHAOS_ICON_AT.slice(5).map((a, i) => [`blip${(i % 5) + 1}`, at("accroche", a), 0.24] as const),
  ...ticks(0.1, "chaos", CHAOS_WORDS_2),
  ["whoosh_up", at("accroche", CHAOS_LEAK - 4), 0.4], ["whoosh_up", at("chaos", SCENE.chaos.len - 20), 0.3],
  // scène 3 : coupe au noir, la cloche claque puis se pose, « et au final ? » « t'as raté l'info. » ; puis le CREUX (rien)
  ["impact", at("nuit", 0), 0.5], ["sub_drop", at("nuit", 0), 0.35], ["chime_soft", at("nuit", 22), 0.3],
  ...ticks(0.1, "nuit", NUIT3_WORDS),
  // scène 4 : la musique repart fort avec un impact, cinq icônes qui filent vers l'anneau, « et si tout tenait au même endroit ? »,
  // l'anneau ralentit, le riser monte (72 images) et finit sur le temps de la pose du logo, qui se reconstitue en pixels
  ["impact", DROP, 0.55], ["stamp", DROP, 0.35],
  ...[2, 8, 14, 20, 26].map((l, i) => [`blip${i + 1}`, at("anneau", l), 0.2] as const),
  ...ticks(0.09, "anneau", RING_WORDS),
  ["whoosh_down", at("anneau", RING_SLOW - 4), 0.3], ["riser", at("anneau", LOGO_POP - 72), 0.45],
  ["pop_logo", at("anneau", LOGO_POP + 1), 0.5], ["glitch2", at("anneau", LOGO_POP + 2), 0.18],
  // scène 5 : la caméra fonce à travers le logo, puis le blanc coupe sur la scène suivante
  ["whoosh_up", at("anneau", ZOOM_AT - 18), 0.4],
  // scène 6 : la fenêtre se reconstitue en pixels, trois icônes surgissent en orbite, « 43 sources. un seul fil. », zoom lent sur la dépêche
  ["stamp", at("fil", 0), 0.4], ["glitch1", at("fil", 0), 0.22],
  ["blip2", at("fil", 8), 0.22], ["blip4", at("fil", 12), 0.22], ["blip5", at("fil", 16), 0.22],
  ...ticks(0.1, "fil", FIL_WORDS),
  ...zooms("fil", FIL_KEYS),
  // scène 7 : coupe franche, la bougie et le graphique surgissent, « les marchés, en direct. », trois zooms sur la carte du CAC 40
  ["stamp", at("marches", 0), 0.3], ["blip3", at("marches", 2), 0.25], ["blip5", at("marches", 8), 0.25],
  ...ticks(0.1, "marches", MARCHES_WORDS),
  ...zooms("marches", MARCHES_KEYS),
  // la carte des marchés vit : de petits pings espacés (fond), pour ne pas laisser la scène muette sans musique
  ...MARCHES_PINGS.map((l, i) => [`blip${[1, 3, 2][i]}`, at("marches", l), 0.14] as const),
  // scène 8 : la fenêtre se dissout puis revient, la question est tapée (de petits clics), la réponse arrive, « il te dit où il l'a lu. »
  ["glitch1", at("ia", 0), 0.3], ["glitch2", at("ia", IA.reform), 0.3],
  ...ticks(0.07, "ia", Array.from({ length: 31 }, (_, i) => IA.typing[0] + i * 4)),
  ["blip5", at("ia", IA.answer), 0.25], ["chime_soft", at("ia", IA.answer + 2), 0.2],
  ...ticks(0.1, "ia", [...IA_WORDS_A, ...IA_WORDS_B]),
  ...zooms("ia", IA_KEYS),
  ["whoosh_up", at("ia", IA_WORDS_B[3] + 6), 0.1],
  // scène 9 : le souffle monte, coupe au noir et éclat rouge, la cloche apparaît puis sonne (deux fois), « tu fixes un seuil. »
  ["whoosh_up", at("alerte", -20), 0.3], ["impact", at("alerte", 0), 0.5], ["sub_drop", at("alerte", 0), 0.35], ["whoosh_down", at("alerte", 0), 0.25], ["blip3", at("alerte", 4), 0.2],
  ["chime", at("alerte", BELL_RING), 0.6], ["chime_soft", at("alerte", BELL_RING + 17), 0.16], ["chime_soft", at("alerte", BELL_RING_2), 0.2],
  ...ticks(0.1, "alerte", NUIT9_WORDS),
  // scène 10 : coupe sur le papier, le téléphone puis l'ordinateur surgissent, « dans ta poche. », le thème passe du jour (clair) à la
  // nuit (globe) sur le temps 2, « de jour comme de nuit. » ; le souffle monte vers la rafale
  ["stamp", at("appareils", 0), 0.35], ["blip2", at("appareils", 4), 0.3], ["blip4", at("appareils", 14), 0.3],
  ...ticks(0.1, "appareils", APP_WORDS),
  ["stamp", at("appareils", APP_CUT), 0.3], ["whoosh_up", at("appareils", APP_LEN - 18), 0.25],
  // scène 10b : la rafale, un stamp ou un blip sur chaque coupe (papier : stamp, nuit : blip), le logo claque en dernier
  ...RAFALE_CUTS.slice(0, 5).map((l, i) => (i % 2 === 0 ? ["stamp", at("rafale", l), 0.4] : [`blip${i + 2}`, at("rafale", l), 0.35]) as Sfx),
  ["pop_logo", at("rafale", RAFALE_CUTS[5]), 0.5], ["blip5", at("rafale", RAFALE_CUTS[5]), 0.25],
  // scène 11 : coupe sur le papier, les lettres se rassemblent (neuf notes), la pièce d'or apparaît, « finveille » est formé, la promesse
  ["stamp", at("lettres", 0), 0.3], ["letters", at("lettres", 20), 0.3], ["coin", at("lettres", FIN_FORMED - 12), 0.4],
  ["impact", at("lettres", FIN_FORMED), 0.3], ["stamp", at("lettres", FIN_FORMED), 0.2],
  ...ticks(0.07, "lettres", FIN_SUB),
  // scène 12 : « gratuit · sans pub », la mention, « lien en commentaire ↓ », coupe au noir
  ...ticks(0.1, "lettres", [...FIN_L1, ...FIN_L3]), ...ticks(0.06, "lettres", FIN_NOTE),
  ["stamp", at("lettres", FIN_L1[3] + 4), 0.3], ["chime_soft", at("lettres", FIN_ARROW), 0.3], ["sub_drop", at("lettres", FIN_BLACK - 4), 0.35],
];
// Dans la version sans musique, le départ fort de la scène 4 est annoncé par un riser qui finit pile sur DROP (avec l'impact)
const SOLO_SFX: readonly Sfx[] = [["riser", DROP - 72, 0.5]];

// Les lits d'air (swish_loop, en boucle) : [début, fin, hauteur (vitesse de lecture), volume selon l'image]
const BEDS: readonly (readonly [number, number, number, (f: number) => number])[] = [
  // la scène 1 : un souffle très calme, pour que le début ne soit pas muet entre les mots
  [at("accroche", 0), SCENE.accroche.to, 0.85, () => 0.05],
  // le chaos des icônes qui s'agite : de plus en plus présent
  [SCENE.chaos.from, SCENE.chaos.to, 1.15, (f) => 0.03 + 0.09 * ramp(f, SCENE.chaos.from, SCENE.chaos.from + 130, 0, 1, LIN)],
  // la nuit : l'ellipse qui tourne autour de la cloche, jusqu'au creux ; puis un souffle presque inaudible, tout le creux
  [SCENE.nuit.from, at("nuit", NUIT3_LEN - CREUX), 0.8, () => 0.07],
  [at("nuit", NUIT3_LEN - CREUX - 4), SCENE.nuit.to, 0.6, () => 0.012],
  // l'anneau d'icônes : le volume suit sa vitesse ; une seconde couche, plus aiguë, ne s'entend qu'à pleine vitesse
  [DROP, at("anneau", ZOOM_AT), 1, (f) => 0.04 + 0.3 * ringNorm(f - DROP)],
  [DROP, at("anneau", ZOOM_AT), 1.6, (f) => 0.2 * ringNorm(f - DROP) ** 3],
  // les trois icônes en orbite autour de la fenêtre, puis les scènes de la fenêtre (cartes, assistant)
  [at("fil", 6), SCENE.fil.to, 1, () => 0.05],
  [at("marches", 2), at("marches", MARCHES_LEN), 1, () => 0.04],
  [at("ia", 2), at("ia", IA_LEN), 1, () => 0.04],
  [at("alerte", 4), SCENE.alerte.to, 0.8, () => 0.04],
  [at("appareils", 4), SCENE.appareils.to, 1, () => 0.04],
  // la fin calme : un souffle léger sous les lettres et les promesses (sans musique, rien d'autre ne tiendrait le son)
  [SCENE.lettres.from, at("lettres", FIN_BLACK), 0.9, () => 0.03],
];

// Le volume d'un son posé à l'image `at` : à l'intérieur de sa Sequence l'image repart de 0 ; le son se coupe en fondu
// avant la fin de la vidéo (rien ne dépasse la dernière image)
const toEnd = (abs: number) => Math.min(1, Math.max(0, (PIXEL_TOTAL - abs) / 8));

// La musique s'efface un instant sous les grands coups (le logo, la coupe rouge, la cloche, la pièce, le mot formé) : -3 dB (x 0,7),
// en 2 images, puis elle revient en 20 images ; c'est ce qui détache ces bruitages
const DIPS = [at("anneau", LOGO_POP), at("alerte", 0), at("alerte", BELL_RING), at("lettres", FIN_FORMED - 12), at("lettres", FIN_FORMED)];
const dip = (f: number) => Math.max(...DIPS.map((d) => ramp(f, d - 2, d, 0, 1, LIN) * (1 - ramp(f, d + 4, d + 24, 0, 1, LIN))));

const Music: React.FC = () => {
  const f = useCurrentFrame();  // dans la Sequence : 0 sur DROP
  const len = PIXEL_TOTAL - MUSIC.from;
  const volume = MUSIC.volume * (1 - 0.3 * dip(f + MUSIC.from)) * (1 - ramp(f, len - MUSIC.fade, len, 0, 1, LIN));
  return <Audio src={staticFile("music/edit108.wav")} trimBefore={MUSIC.trim} volume={volume} />;
};

// `music` faux : la version sans musique (composition « PixelSansMusique »), où les sons, seuls, sont un peu plus forts
export const Son: React.FC<{ readonly music?: boolean }> = ({ music = true }) => {
  const gain = music ? 1 : SOLO;
  const sfx = music ? SFX : [...SFX, ...SOLO_SFX];
  return (
    <>
      {music && <Sequence from={MUSIC.from} durationInFrames={PIXEL_TOTAL - MUSIC.from} layout="none"><Music /></Sequence>}
      {sfx.map(([name, start, volume], i) => (
        <Sequence key={i} from={start} durationInFrames={150} layout="none">
          <Audio src={staticFile(`sfx-pixel/${name}.wav`)} volume={(local) => Math.min(1, volume * gain) * toEnd(start + local)} />
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
