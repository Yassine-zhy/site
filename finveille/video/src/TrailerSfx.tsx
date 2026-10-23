// La bande-annonce de FinVeille, version « TrailerSfx » : sans musique, sans l'adresse du site à la fin, un peu plus rapide par
// endroits, avec un habillage sonore fait uniquement de bruitages (public/sfx-trailer, fabriqués par tools/trailer_sfx.py).
//
// Le visuel est celui de Trailer.tsx (TrailerVisual) rejoué à un temps remappé : à l'image f de cette vidéo on montre l'image
// g(f) de la bande-annonce, g étant linéaire par morceaux (une vitesse par scène). Technique : le visuel est enveloppé dans une
// <Sequence from={f - g(f)} layout="none"> ; dans cette séquence useCurrentFrame() vaut exactement g(f), donc toutes les scènes
// (qui ne dépendent que de leur image) jouent leur animation à la vitesse voulue, sans le moindre saut aux frontières puisque g
// est continue. `from` n'est pas arrondi : l'image g(f) est fractionnaire, ce qui garde un mouvement fluide à ×1,4 et ×1,5 (arrondie,
// elle sauterait une image sur deux ou trois).
//
// | scène     | images (Trailer) | vitesse | images ici    | pourquoi                                                    |
// | --------- | ---------------- | ------- | ------------- | ----------------------------------------------------------- |
// | ouverture | 0 - 340          | × 1,4   | 0 - 243       | le logo, le curseur : on va plus vite à l'amorce            |
// | actu      | 340 - 794        | × 1,1   | 243 - 655     | un peu plus nerveuse                                        |
// | marchés   | 794 - 1247       | × 1,0   | 655 - 1108    | la courbe et les tuiles gardent leur rythme                 |
// | éco       | 1247 - 1587      | × 1,15  | 1108 - 1404   | un peu plus vive                                            |
// | outils    | 1587 - 2041      | × 1,0   | 1404 - 1858   | on y lit : la question, la réponse, les alertes             |
// | partout   | 2041 - 2381      | × 1,1   | 1858 - 2167   | un peu plus nerveuse                                        |
// | fin       | 2381 - 3180      | × 1,5   | 2167 - 2700   | la mosaïque et la signature, sans temps mort (45 s en tout) |
//
// Le son : les événements sont écrits en images de la bande-annonce (celles des scènes, avec b(temps)) et convertis par toNew()
// dans le temps de cette vidéo. Trois plans : le premier plan (souffles de transition, impacts, cloches, riser, logo : volumes 0,4 à
// 0,9), le milieu (clics, envoi, notifications, tintements de verre : 0,2 à 0,5), le fond (tics, frappes, bips de données, poussières
// de lumière : 0,08 à 0,3), et sous tout cela une nappe de salle très discrète (room_tone, 0,08). Les souffles et le riser se placent
// par leur SOMMET (LEAD) : on donne l'image où ils doivent culminer, le fichier démarre plus tôt.
import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";
import { C, FPS, TOTAL, b } from "./kit";
import { TrailerVisual } from "./Trailer";

// --- Le temps remappé : [image de début, image de fin, vitesse] dans la bande-annonce, scène par scène ---------------------------
const SEGS: readonly (readonly [number, number, number])[] = [
  [0, b(12), 1.4], [b(12), b(28), 1.1], [b(28), b(44), 1.0], [b(44), b(56), 1.15], [b(56), b(72), 1.0], [b(72), b(84), 1.1], [b(84), TOTAL, 1.5],
];
// L'image (fractionnaire) de cette vidéo où commence chaque segment
const STARTS: readonly number[] = SEGS.reduce<number[]>((acc, [a, z, v], i) => [...acc, i === 0 ? 0 : acc[i - 1] + (SEGS[i - 1][1] - SEGS[i - 1][0]) / SEGS[i - 1][2]], []);

// Image de la bande-annonce → image de cette vidéo
export const toNew = (old: number): number => {
  const i = Math.max(0, SEGS.findIndex(([, z]) => old < z));
  const k = old >= TOTAL ? SEGS.length - 1 : i;
  return STARTS[k] + (old - SEGS[k][0]) / SEGS[k][2];
};
// Image de cette vidéo → image de la bande-annonce (la fonction g)
const toOld = (now: number): number => {
  let k = SEGS.length - 1;
  while (k > 0 && now < STARTS[k]) k--;
  return Math.min(TOTAL, SEGS[k][0] + (now - STARTS[k]) * SEGS[k][2]);
};
export const TSFX_TOTAL = Math.round(toNew(TOTAL));  // 2 700 images : 45 s

// --- Les bruitages : durée de chaque fichier (s) et image de son sommet (LEAD, en images de cette vidéo) ------------------------------
const LEN = {
  whoosh_soft: 0.9, whoosh_hard: 1.1, swipe: 0.3, ui_click: 0.13, ui_tap: 0.11, type1: 0.09, type2: 0.09, type3: 0.09, type4: 0.09,
  send: 0.45, notif: 1.3, chime: 2.8, glass_tink: 0.65, glass_tink2: 0.65, glass_tink3: 0.65, riser: 1.5, impact: 2.2, sub_hit: 0.7,
  tick: 0.025, sparkle: 1.0, data_blips: 1.0, logo_reveal: 2.5, outro_tail: 3.0,
} as const;
type Name = keyof typeof LEN;
const LEAD: Partial<Record<Name, number>> = { whoosh_soft: 27, whoosh_hard: 39, swipe: 9, riser: 90 };

// [son, image de la bande-annonce, volume] ; l'image est celle de l'événement (ou, pour un souffle, de son sommet)
type Ev = readonly [name: Name, old: number, volume: number];
const MASTER = 1;
const types = [1, 2, 3, 4] as const;

// Les 26 lettres de « Pourquoi l’or monte-t-il ? » (outils.tsx) : la lettre i apparaît quand l'arrondi de la rampe atteint i + 1
const TYPED: readonly Ev[] = Array.from({ length: 26 }, (_, i) => [
  `type${types[(i * 3 + (i >> 2)) % 4]}` as Name, Math.round(b(57) + ((i + 0.5) * (b(59) - b(57))) / 26), 0.2 + 0.05 * ((i * 7) % 4),
] as const);

// Les tuiles du CAC 40 qui changent de valeur (marches.tsx) : à chaque temps de 39 à 43, deux ou trois, espacées de 5 images
const TILE_TICKS: readonly Ev[] = [39, 40, 41, 42, 43].flatMap((k) =>
  Array.from({ length: k % 2 ? 3 : 2 }, (_, j) => ["tick", b(k) + j * 5, 0.18 + 0.05 * ((k + j) % 3)] as const));

// Les huit tuiles de la mosaïque finale (finale.tsx), qui s'allument une à une
const TILES: readonly Ev[] = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [
  (["glass_tink", "glass_tink2", "glass_tink3", "glass_tink2", "glass_tink", "glass_tink3", "glass_tink2", "glass_tink3"] as const)[i],
  b(84.5) + Math.round(i * b(0.5)), [0.28, 0.3, 0.32, 0.3, 0.34, 0.34, 0.36, 0.4][i],
] as const);

const EVENTS: readonly Ev[] = [
  // --- L'ouverture (0 - 340) : le logo se dessine, le curseur vient et appuie (b(8)), l'icône s'ouvre en écran bleu (b(10) - b(11,3)) ---
  ["logo_reveal", 4, 0.42], ["tick", 62, 0.12], ["tick", 71, 0.1], ["tick", 80, 0.1], ["tick", 86, 0.14],
  ["sparkle", b(3.6), 0.12], ["swipe", b(4) + 8, 0.14],
  ["swipe", b(5) + 12, 0.2], ["riser", b(10), 0.5], ["tick", b(7) + 4, 0.16],
  ["ui_click", b(8), 0.62], ["sub_hit", b(8), 0.34], ["ui_tap", b(9), 0.26],
  ["whoosh_hard", 305, 0.5], ["impact", 319, 0.62],
  // --- L'actu (340 - 794) : le mur de dépêches, le titre, la roue des rubriques, les sources, le fil ---
  ["sparkle", b(12), 0.14], ["whoosh_soft", b(11.8), 0.3],
  ["glass_tink2", 344, 0.16], ["glass_tink", 358, 0.14], ["glass_tink3", 372, 0.12], ["glass_tink2", 388, 0.12],
  ["tick", b(13), 0.14], ["ui_tap", b(13.5), 0.26], ["tick", b(14), 0.14],
  ["ui_tap", b(16), 0.3], ["sub_hit", b(16), 0.22], ["ui_tap", b(17), 0.27], ["ui_tap", b(18), 0.27], ["ui_tap", b(19), 0.29], ["ui_tap", b(20), 0.34],
  ["whoosh_soft", b(20) + 24, 0.3], ["swipe", b(20) + 28, 0.22], ["tick", b(20.25), 0.14], ["tick", b(20.75), 0.14],
  ["sub_hit", b(24), 0.38], ["whoosh_soft", b(24) + 22, 0.42], ["swipe", b(24) + 12, 0.18], ["tick", b(24.5), 0.12], ["tick", b(24.5) + 9, 0.12],
  ["ui_tap", b(24) + 22, 0.22],
  ["glass_tink", b(24) + 46, 0.22], ["glass_tink3", b(24) + 52, 0.15], ["glass_tink2", b(24) + 59, 0.2], ["glass_tink", b(24) + 66, 0.13],
  ["ui_click", b(25), 0.44], ["ui_click", b(26), 0.4], ["ui_click", b(27), 0.4],
  ["swipe", b(25) + 8, 0.12], ["swipe", b(26) + 8, 0.12], ["swipe", b(27) + 8, 0.12],
  // --- Les marchés (794 - 1247) : la courbe en direct, les bandeaux, la carte du CAC 40 qui se retourne, les valeurs qui bougent ---
  ["whoosh_hard", b(28), 0.6], ["sub_hit", b(28) + 6, 0.34], ["sparkle", b(28.5), 0.1],
  ["tick", b(28.5), 0.12], ["tick", b(29), 0.12], ["ui_tap", b(29) + 3, 0.3],
  ["data_blips", b(28.8), 0.26], ["data_blips", b(31.8), 0.2], ["data_blips", b(34.8), 0.2],
  ["swipe", b(29.2) + 4, 0.2], ["ui_tap", b(30), 0.34], ["glass_tink2", b(30) + 4, 0.15],
  ["whoosh_soft", b(35.6), 0.4], ["sub_hit", b(36), 0.44],
  ["glass_tink", b(36) + 2, 0.2], ["glass_tink2", b(36) + 10, 0.14], ["glass_tink3", b(36) + 17, 0.22], ["glass_tink", b(36) + 26, 0.14], ["glass_tink2", b(36) + 35, 0.18],
  ["sparkle", b(36.5), 0.12], ["tick", b(36.5), 0.12], ["tick", b(36.5) + 6, 0.12], ["tick", b(37), 0.12], ["ui_tap", b(37) + 6, 0.28],
  ["data_blips", b(37.3), 0.24], ["data_blips", b(40.2), 0.2], ["data_blips", b(42.8), 0.2],
  ...TILE_TICKS,
  ["swipe", b(38.3) + 14, 0.16], ["swipe", b(41.4) + 14, 0.16],
  ["swipe", b(44) - 3, 0.5], ["whoosh_soft", b(44), 0.4],
  // --- L'économie et la crypto (1247 - 1587) : la courbe des taux, trois pastilles, trois pièces de verre ---
  ["sparkle", b(44.5), 0.1], ["ui_tap", b(44.5) + 4, 0.28], ["data_blips", b(45), 0.18],
  ...[45, 46, 47, 48, 49].map((k) => ["tick", b(k), 0.08] as Ev),
  ["glass_tink", b(46), 0.4], ["glass_tink2", b(47), 0.3],
  ["whoosh_soft", b(50.1), 0.38], ["sub_hit", b(50.5), 0.4],
  ["tick", b(50.5), 0.12], ["tick", b(50.5) + 4, 0.12], ["ui_tap", b(50.5) + 8, 0.28],
  ["swipe", b(50.5) + 3, 0.22], ["glass_tink", b(50.5) + 12, 0.44], ["tick", b(50.5) + 56, 0.1],
  ["swipe", b(51) + 3, 0.2], ["glass_tink2", b(51) + 12, 0.38], ["tick", b(51) + 56, 0.1],
  ["swipe", b(51.5) + 3, 0.2], ["glass_tink3", b(51.5) + 12, 0.4], ["tick", b(51.5) + 56, 0.1], ["sparkle", b(51.5) + 16, 0.16],
  ["tick", b(51.4), 0.1], ["data_blips", b(52.2), 0.18],
  // --- Les outils (1587 - 2041) : la question tapée et sa réponse, la cloche et les alertes, le portefeuille ---
  ["whoosh_hard", b(56), 0.6], ["sub_hit", b(56.1), 0.3], ["ui_tap", b(55.8) + 6, 0.26], ["sparkle", b(56), 0.1],
  ["tick", b(56), 0.14], ["tick", b(56.5), 0.12], ["ui_tap", b(56.5) + 4, 0.26], ["swipe", b(58), 0.12],
  ...TYPED,
  ["ui_tap", b(58.6), 0.22], ["send", b(59.25), 0.58], ["ui_click", b(59.25), 0.4],
  ["swipe", b(59.5), 0.2], ["glass_tink", b(59.5) + 2, 0.4], ["tick", b(59.65), 0.1],
  ["data_blips", b(59.9), 0.22], ["tick", b(59.9) + 16, 0.1], ["tick", b(59.9) + 23, 0.1], ["tick", b(59.9) + 30, 0.1],
  ["glass_tink", b(60.5), 0.34], ["glass_tink2", b(60.5) + 14, 0.24], ["glass_tink3", b(60.5) + 28, 0.28],
  ["whoosh_soft", b(62.3), 0.45], ["swipe", b(62.4), 0.24], ["sparkle", b(62.5), 0.1],
  ["tick", b(62.5), 0.14], ["tick", b(63), 0.12], ["ui_tap", b(63) + 4, 0.26],
  ["chime", b(63.5), 0.62], ["sub_hit", b(63.5), 0.28], ["notif", b(63.75), 0.46], ["swipe", b(64), 0.1],
  ["chime", b(65.5), 0.42], ["notif", b(65.75), 0.42],
  ["whoosh_soft", b(67.3), 0.45], ["sparkle", b(67.4), 0.2], ["sub_hit", b(67.5), 0.4], ["swipe", b(67.6), 0.22],
  ["ui_tap", b(67.5), 0.26], ["tick", b(68), 0.12], ["ui_tap", b(68) + 4, 0.26],
  ["data_blips", b(68.1), 0.28], ["tick", b(68.8), 0.1], ["tick", b(68.8) + 6, 0.1], ["tick", b(68.8) + 12, 0.1],
  ["swipe", b(69), 0.1], ["glass_tink", b(69), 0.38], ["chime", b(69.3), 0.3], ["data_blips", b(71), 0.2],
  // --- Partout (2041 - 2381) : le vrai site sur ordinateur, le téléphone qui rejoint, le thème clair qui balaie l'écran ---
  ["whoosh_soft", b(72), 0.5], ["glass_tink2", b(72.2), 0.22], ["sparkle", b(72.3), 0.1],
  ["tick", b(72.5), 0.12], ["ui_tap", b(72.5) + 5, 0.26],
  ["whoosh_soft", b(76.3), 0.42], ["glass_tink3", b(76) + 14, 0.3], ["tick", b(76.5), 0.12], ["ui_tap", b(76.5) + 5, 0.26], ["sub_hit", b(76.8), 0.3],
  ["ui_click", b(80), 0.32], ["whoosh_soft", b(80.75), 0.46], ["sparkle", b(81.2), 0.2],
  ["tick", b(80.5), 0.12], ["tick", b(80.5) + 5, 0.12], ["tick", b(81), 0.12], ["tick", b(81) + 4, 0.12], ["ui_tap", b(81) + 8, 0.28],
  // --- La fin (2381 - 3180) : la mosaïque, le logo qui grandit, la signature, l'arrêt net (b(106)), la traînée ---
  ["whoosh_hard", b(84), 0.62], ["sparkle", b(84.1), 0.12], ["glass_tink2", b(84.3), 0.3], ["sub_hit", b(84) + 6, 0.3],
  ...TILES,
  ["riser", b(92), 0.5], ["impact", b(92), 0.6], ["whoosh_hard", b(93.8), 0.5], ["logo_reveal", b(93), 0.55],
  ["ui_tap", b(97.5), 0.24], ["swipe", b(97.5) + 6, 0.14],
  ["glass_tink", b(101.5), 0.36], ["sparkle", b(101.5) + 4, 0.15],
  ["impact", b(106), 0.82], ["sub_hit", b(106), 0.46], ["sparkle", b(106) + 10, 0.2],
];

// La traînée finale : elle finit avec la vidéo (3 s avant la dernière image), son sommet précède l'arrêt net de peu
const OUTRO_AT = TSFX_TOTAL - Math.ceil(LEN.outro_tail * FPS);

const Sound: React.FC = () => (
  <>
    {/* la nappe de salle : une boucle de 8 s, qui entre en douceur et s'éteint avec le noir de la fin */}
    <Audio src={staticFile("sfx-trailer/room_tone.wav")} loop volume={(f) => 0.08 * Math.min(1, f / 45) * Math.min(1, (TSFX_TOTAL - f) / 40)} />
    {EVENTS.map(([name, old, volume], i) => (
      <Sequence key={i} from={Math.round(toNew(old)) - (LEAD[name] ?? 0)} durationInFrames={Math.ceil(LEN[name] * FPS) + 1} layout="none">
        <Audio src={staticFile(`sfx-trailer/${name}.wav`)} volume={volume * MASTER} />
      </Sequence>
    ))}
    <Sequence from={OUTRO_AT} durationInFrames={Math.ceil(LEN.outro_tail * FPS) + 1} layout="none">
      <Audio src={staticFile("sfx-trailer/outro_tail.wav")} volume={0.7 * MASTER} />
    </Sequence>
  </>
);

export const TrailerSfx: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Sequence from={f - toOld(f)} layout="none"><TrailerVisual showUrl={false} /></Sequence>
      <Sound />
    </AbsoluteFill>
  );
};
