// Le montage de la publicité pixel art : où commence et où finit chaque scène, calé sur les TEMPS de la musique.
// La musique (public/music/edit108.wav) est à 108 battements par minute : un temps = 60 / 108 s = 33,333 images à 60 im/s.
// `beat(k)` donne l'image du temps k ; toutes les coupes tombent sur un temps. Chaque scène travaille en temps LOCAL (l'image
// depuis son propre début) : pour y poser un son ou un geste, on part du début de la scène (`SCENE.xxx.from`), jamais d'un
// numéro d'image absolu. Allonger ou raccourcir une scène ne casse donc plus la synchro.
export const beat = (k: number) => Math.round((k * 100) / 3);

export type SceneId = "accroche" | "chaos" | "nuit" | "anneau" | "zoomLogo" | "fil" | "marches" | "ia" | "alerte" | "appareils" | "rafale" | "lettres" | "fin";
export type Scene = { readonly id: SceneId; readonly from: number; readonly to: number };

// [identifiant, temps de début] ; la fin d'une scène est le début de la suivante
const CUTS: readonly (readonly [SceneId, number])[] = [
  ["accroche", 0], ["chaos", 7], ["nuit", 13], ["anneau", 19], ["zoomLogo", 27], ["fil", 28], ["marches", 37], ["ia", 45],
  ["alerte", 56], ["appareils", 62], ["rafale", 69], ["lettres", 72], ["fin", 78],
];
const END = 86;

// Le tableau du montage (début, fin en images) et le même, indexé par identifiant, avec la durée
export const SCENES: readonly Scene[] = CUTS.map(([id, k], i) => ({ id, from: beat(k), to: beat(i + 1 < CUTS.length ? CUTS[i + 1][1] : END) }));
export const SCENE = Object.fromEntries(SCENES.map((s) => [s.id, { ...s, len: s.to - s.from }])) as Record<SceneId, Scene & { readonly len: number }>;

// Un plan peut couvrir deux scènes de suite quand l'image ne coupe pas entre elles (les icônes du chaos, la caméra qui fonce dans
// le logo, les lettres puis la fin) : début de la première, fin de la dernière
export const span = (a: SceneId, z: SceneId = a) => ({ from: SCENE[a].from, to: SCENE[z].to, len: SCENE[z].to - SCENE[a].from });
export const PIXEL_TOTAL = SCENES[SCENES.length - 1].to;
// L'image où la musique repart fort (la fin du creux de la scène 3)
export const DROP = SCENE.anneau.from;
