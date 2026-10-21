// La bande-annonce de FinVeille v3 (étape 35) : une histoire racontée par une voix off, en motion design avec Remotion.
// 1 980 images, 1920 × 1080, 30 im/s. Chaque élément entre à l'image où la voix le nomme : les instants viennent de
// public/vo/vo.json (secondes absolues, images = round(t × 30)) ; la musique est à 120 BPM (une mesure = 60 images).
// Un seul langage de mouvement : arrivée cubic-bezier(0.16,1,0.3,1), sortie cubic-bezier(0.7,0,0.84,0), coupes franches.
//
// | id  | images      | phrase                                                   | ce qu'on voit                                                      |
// | --- | ----------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
// | S1  | 0 - 120     | L01 Chaque jour, des milliers d'articles sur les marchés | mur de 28 x 14 cartes qui se remplit en vague, éclats vert/rouge   |
// | S2  | 120 - 210   | L02 En anglais. Sur des dizaines de sites. À toute heure | le mur défile ; titres anglais, onglets qui se multiplient, horloge|
// | S3  | 210 - 255   | L03 Et toi, tu as dix minutes                            | bleu marque, « 10:00 » géant qui décompte (sans sous-titre)        |
// | S4  | 255 - 360   | L04 Pour comprendre ce qui compte                        | mur éteint, trois cartes s'allument, tout aspiré en une ligne      |
// | S5  | 360 - 405   | L05 Alors voici FinVeille                                | impact : éclat radial, logo, « FinVeille »                         |
// | S6  | 405 - 480   | L06 FinVeille rassemble toutes les dépêches              | entonnoir de cartes vers la fenêtre du fil, « À la une » cerné     |
// | S7  | 480 - 525   | L07 les trie par sujet                                   | quatre colonnes Marchés, Crypto, Entreprises, Macro                |
// | S8  | 525 - 630   | L08 et t'explique l'essentiel, en français               | le brief recadré, tampon « En français », panneau violet qui balaie |
// | S9  | 630 - 735   | L09 Voici Inès. Vingt ans. Un oral de marchés demain     | monde violet : Inès, « 20 ans », carte d'agenda                    |
// | S10 | 735 - 855   | L10 Elle demande à l'assistant ce qui fait bouger le CAC | la vraie question tapée dans le site (ai.mp4), recadrée            |
// | S11 | 855 - 930   | L11 Une réponse claire, sources à l'appui                | la vraie réponse, surbrillance sur les sources citées              |
// | S12 | 930 - 1035  | L12 Voici Hugo. Vingt-trois ans. Cent euros par mois     | monde vert : Hugo, « 23 ans », « 100 € » qui compte               |
// | S13 | 1035 - 1110 | L13 Il s'entraîne sur un portefeuille virtuel            | maquette de l'anneau, « Portefeuille virtuel », « Zéro euro réel » |
// | S14 | 1110 - 1200 | L14 et règle une alerte sur Airbus                       | clic filmé sur la cloche (sons clic + cloche), carte Airbus        |
// | S15 | 1200 - 1320 | L15 Et voici Sami. Dix-neuf ans. Du bitcoin un peu vite  | monde orange : Sami, « 19 ans », pièce qui tombe, courbe rouge     |
// | S16 | 1320 - 1395 | L16 Lui, il apprend enfin le vocabulaire                 | tableau à palettes PER, ETF, Dividende... + maquette des livres    |
// | S17 | 1395 - 1500 | L17 et voit ce que cent euros par mois deviennent        | 10 barres (versé / intérêts), noir total de 1493 à 1500            |
// | S18 | 1500 - 1590 | L18 Un seul site. Trois façons de comprendre             | drop : « Un seul site. », trois panneaux Inès, Hugo, Sami          |
// | S19 | 1590 - 1710 | L19 Et chaque page a sa maquette 3D, qui répond au clic  | rafale de 7 maquettes, puis le vrai clic sur le globe              |
// | S20 | 1710 - 1755 | L20 Et ce site ?                                         | noir, « Et ce site ? » géant (sans sous-titre)                     |
// | S21 | 1755 - 1860 | L20b C'est un projet d'étudiant, codé avec Claude Code   | terminal, chemins du projet, carte « Yassine Zouhair »             |
// | S22 | 1860 - 1980 | L21 FinVeille. Gratuit, et en français                   | impact : logo, nom, adresse, deux pastilles, fondu au noir         |
//
// Les coupes tombent sur les temps (15 images) ; chaque plan court jusqu'au début du suivant.
import React from "react";
import { AbsoluteFill } from "remotion";
import { Captions } from "./captions";
import { AI_FALLBACK, S10, S11, S9 } from "./scenes/ines";
import { COLORS, Scene, W, fr, ramp, useAbs } from "./kit";
import { useEvents } from "./site";
import { S12, S13, S14 } from "./scenes/hugo";
import { S15, S16, S17 } from "./scenes/sami";
import { BURST_STEP, S18, S19, S20, S21, S22 } from "./scenes/finale";
import { S1, S2, S3, S4 } from "./scenes/opening";
import { S5, S6, S7, S8 } from "./scenes/product";
import { Sound, TOTAL } from "./sound";

export { TOTAL };

// Les plans : [début, fin[ en secondes (la fin = le début du plan suivant) ; l'image = round(t × 30)
const PLANS: readonly { readonly id: string; readonly t: readonly [number, number]; readonly view: React.FC }[] = [
  { id: "S1", t: [0, 4], view: S1 }, { id: "S2", t: [4, 7], view: S2 }, { id: "S3", t: [7, 8.5], view: S3 }, { id: "S4", t: [8.5, 12], view: S4 },
  { id: "S5", t: [12, 13.5], view: S5 }, { id: "S6", t: [13.5, 16], view: S6 }, { id: "S7", t: [16, 17.5], view: S7 }, { id: "S8", t: [17.5, 21], view: S8 },
  { id: "S9", t: [21, 24.5], view: S9 }, { id: "S10", t: [24.5, 28.5], view: S10 }, { id: "S11", t: [28.5, 31], view: S11 },
  { id: "S12", t: [31, 34.5], view: S12 }, { id: "S13", t: [34.5, 37], view: S13 }, { id: "S14", t: [37, 40], view: S14 },
  { id: "S15", t: [40, 44], view: S15 }, { id: "S16", t: [44, 46.5], view: S16 }, { id: "S17", t: [46.5, 50], view: S17 },
  { id: "S18", t: [50, 53], view: S18 }, { id: "S19", t: [53, 57], view: S19 }, { id: "S20", t: [57, 58.5], view: S20 },
  { id: "S21", t: [58.5, 62], view: S21 }, { id: "S22", t: [62, 66], view: S22 },
];

// Le noir total de la musique (49,75 à 50,0 s) puis le fondu au noir final (65 à 66 s)
const Blackouts: React.FC = () => {
  const f = useAbs();
  const silence = f >= fr(49.75) && f < fr(50);
  const o = silence ? 1 : ramp(f, fr(65), fr(66), [0, 1], (t) => t);
  return o > 0 ? <AbsoluteFill style={{ background: "#000", opacity: o }} /> : null;
};

// Les sons calés sur les mots et sur les clics filmés
const Cues: React.FC = () => {
  const ai = useEvents("ai", AI_FALLBACK);
  const tDem = W("L10", "demande"), tEnd = W("L10", "40", "t1");
  const rate = (ai.send - 5 - ai.typing) / (tEnd - tDem);
  const tAl = W("L14", "alerte"), tClic = W("L19", "clic");
  const aiClick = Math.round(tDem + (ai.click - ai.typing) / rate);
  return (
    <Sound
      typing={[tDem, tEnd]}
      clicks={[aiClick, tAl, W("L08", "français"), tClic]}
      bells={[tAl + 3]}
      ticks={Array.from({ length: 7 }, (_, i) => fr(53) + i * BURST_STEP)}
    />
  );
};

export const Trailer: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.night }}>
    {PLANS.map(({ id, t, view: View }) => (
      <Scene key={id} id={id} from={fr(t[0])} to={fr(t[1])}><View /></Scene>
    ))}
    <Scene id="sous-titres" from={0} to={TOTAL}><Captions /></Scene>
    <Scene id="noirs" from={0} to={TOTAL}><Blackouts /></Scene>
    <Cues />
  </AbsoluteFill>
);
