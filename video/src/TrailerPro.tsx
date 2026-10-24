// La bande-annonce avec un vrai habillage sonore, sans musique : la même image que « Trailer » (53 s, même vitesse),
// et une cinquantaine de bruitages ENREGISTRÉS (Mixkit, public/sfx-pro, téléchargés par tools/sfx_pro.py), tous différents
// d'une transition à l'autre. Chaque souffle est posé pour que sa crête tombe pile sur la coupe (`peak`), les clics et
// les notifications partent sur l'événement (`at`). Une nappe très discrète (room_tone) évite les trous de silence.
//
// | scène    | temps    | sons                                                                                     |
// | -------- | -------- | ---------------------------------------------------------------------------------------- |
// | ouverture| 0 - 12   | le logo apparaît (scintillement), clic du curseur, l'appli s'ouvre (aspiration)          |
// | actu     | 12 - 28  | les dépêches se posent (clics), elles se rangent en un fil (tourbillon), « Réunies » (pop)|
// | marchés  | 28 - 44  | la courbe démarre (tons numériques), passage à la carte (souffle), les cases qui changent|
// | éco      | 44 - 56  | la courbe des taux (ton), passage à la crypto (balayage), les pièces (tintement)          |
// | outils   | 56 - 72  | la question tapée (clavier), envoi, réponse, alertes (cloche, pop), portefeuille (validé)|
// | partout  | 72 - 84  | l'ordinateur puis le téléphone (balayage métallique), clair / sombre (interrupteur)       |
// | fin      | 84 - fin | les tuiles s'allument (clics variés), montée, envol, signature du logo, coup final        |
// Transitions : 28 « whoosh ciné », 44 « balayage rapide », 56 « zoom-impact », 72 « glissé techno », 84 « whoosh-impact ».
import { Audio } from "@remotion/media";
import React from "react";
import { Sequence, staticFile } from "remotion";
import { b } from "./kit";
import { TrailerVisual } from "./Trailer";

// Mesures de tools/sfx_pro.py : [durée, crête] en images (60 im/s)
const LEN = {
  logo_appear: [208, 25], logo_click: [30, 1], app_open: [68, 18], tr_actu_marches: [80, 65], tr_marches_eco: [43, 16],
  tr_eco_outils: [69, 26], tr_outils_partout: [98, 5], tr_partout_fin: [211, 56], fil_swirl: [143, 113], fil_pop: [10, 1],
  card_click: [6, 0], heatmap_sweep: [31, 3], data_tone: [77, 8], tile_check: [8, 1], eco_sweep: [213, 52], coins: [60, 24],
  typing: [78, 41], send: [87, 1], answer: [94, 10], bell: [196, 14], alert2: [17, 1], tools_sweep: [49, 17],
  portfolio_ok: [165, 8], device_sweep: [94, 27], theme_switch: [66, 0], tile_tick: [63, 1], riser: [114, 104],
  fly_away: [77, 14], logo_sting: [141, 8], final_hit: [208, 6],
} as const;
type Name = keyof typeof LEN;

// [son, image, volume, calage] : « peak » = la crête du son tombe sur l'image ; « at » = le son commence à l'image
type Ev = readonly [name: Name, frame: number, volume: number, align?: "peak" | "at"];

const TILES: readonly Ev[] = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [
  (["tile_check", "card_click", "tile_tick", "tile_check", "card_click", "tile_tick", "tile_check", "card_click"] as const)[i],
  b(84.5) + Math.round(i * b(0.5)), [0.22, 0.26, 0.18, 0.26, 0.3, 0.2, 0.3, 0.34][i],
] as const);

const EVENTS: readonly Ev[] = [
  // Ouverture
  ["logo_appear", b(0.5), 0.5], ["logo_click", b(8), 0.6], ["app_open", b(10), 0.6, "peak"],
  // Actu
  ["card_click", b(12) + 4, 0.5], ["card_click", b(12) + 18, 0.38], ["card_click", b(12) + 32, 0.45], ["card_click", b(12) + 48, 0.34],
  ["fil_swirl", b(24), 0.42, "peak"], ["fil_pop", b(24.5), 0.4],
  ["tr_actu_marches", b(28), 0.7, "peak"],
  // Marchés
  ["data_tone", b(28.8), 0.24], ["data_tone", b(31.8), 0.16], ["heatmap_sweep", b(36), 0.45, "peak"],
  ...[39, 40, 41, 42, 43].map((k, i) => ["tile_check", b(k), [0.2, 0.15, 0.22, 0.17, 0.24][i]] as const),
  ["tr_marches_eco", b(44), 0.65, "peak"],
  // Éco et crypto
  ["data_tone", b(45), 0.2], ["eco_sweep", b(50.5), 0.42, "peak"], ["coins", b(51), 0.45],
  ["tr_eco_outils", b(56), 0.65, "peak"],
  // Outils : la question, l'envoi, la réponse, les alertes, le portefeuille
  ["typing", b(57), 0.45], ["send", b(59.25), 0.4], ["answer", b(59.9), 0.32],
  ["tools_sweep", b(62.5), 0.45, "peak"], ["bell", b(63.5), 0.42], ["alert2", b(65.5), 0.45],
  ["heatmap_sweep", b(67.5), 0.32, "peak"], ["portfolio_ok", b(69.3), 0.32],
  ["tr_outils_partout", b(72), 0.6, "peak"],
  // Partout
  ["device_sweep", b(76.3), 0.45, "peak"], ["theme_switch", b(80), 0.5],
  ["tr_partout_fin", b(84), 0.65, "peak"],
  // Fin
  ...TILES,
  ["riser", b(92), 0.5, "peak"], ["fly_away", b(92.6), 0.5, "peak"], ["logo_sting", b(94), 0.5],
  ["fil_pop", b(97.5), 0.3], ["tile_check", b(101.5), 0.3], ["final_hit", b(106), 0.6],
];

const MASTER = 1.25;  // +2 dB : crête finale vers -3 dB

export const TrailerPro: React.FC = () => (
  <>
    <TrailerVisual />
    <Audio src={staticFile("sfx-trailer/room_tone.wav")} volume={0.05} loop />
    {EVENTS.map(([name, frame, volume, align = "at"], i) => {
      const [length, peak] = LEN[name];
      return (
        <Sequence key={i} from={Math.round(frame - (align === "peak" ? peak : 0))} durationInFrames={length} layout="none">
          <Audio src={staticFile(`sfx-pro/${name}.wav`)} volume={volume * MASTER} />
        </Sequence>
      );
    })}
  </>
);
