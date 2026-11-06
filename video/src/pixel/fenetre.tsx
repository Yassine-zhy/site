// Scènes 6, 7 et 8 : une fenêtre arrondie (860 px) sur le gris papier, qui montre le vrai site, avec des ZOOMS de caméra sur la
// zone utile (voir zoom.tsx : la caméra glisse ou coupe sur des temps, de plus en plus serrés). Le temps est local à chaque scène.
//   6 (9 temps)  : le blanc de l'éclat s'efface, la fenêtre se reconstitue en pixels et montre le fil ; « 43 sources. » puis
//                  « un seul fil. » (les deux restent lisibles) ; trois icônes (journal, globe, loupe) tournent autour d'elle,
//                  sur une ellipse plus large que la fenêtre. Zoom lent vers la dépêche de la une, qu'il suit pendant le défilement.
//   7 (8 temps)  : coupe franche ; la carte des marchés ; « les marchés, en direct. » ; une bougie et un graphique flottent ;
//                  trois zooms sur les cases de la carte du CAC 40 (noms et pourcentages lisibles), tous les 2 temps puis 1,5
//   8 (11 temps) : la fenêtre se dissout en pixels puis revient avec l'assistant : page entière, zoom sur le champ de la question
//                  pendant qu'elle est tapée, glissement vers la réponse et ses sources numérotées, puis vers la colonne de droite
//                  et plan d'ensemble ; « une question ? » puis « il te dit où il l'a lu. » (trait à la main autour de « où »), et
//                  un contour à la main autour des sources dans la vidéo zoomée.
// Les positions des caméras sont des fractions de la vidéo (1920 × 1080) mesurées sur des images extraites de public/footage.
import React from "react";
import { BACK, Hand, Icon, Layer, PCX, PWord, Shot, Words, Win, Footage, bob, punch } from "./fx";
import { CAM, IN, LIN, ramp } from "../kit";
import { SCENE } from "./montage";
import { SpriteName } from "./sprites";
import { Cam, ZoomView } from "./zoom";

const WX = PCX, WY = 790, WW = 860, WH = 484;
const TEXT_TOP = 215;
const WSCALE = 1.11, WY_ZOOM = 820;  // la fenêtre est plus grande (955 px) et un peu plus bas dans les scènes zoomées (7 et 8)

// --- Scène 6 : le fil (feed.mp4, 4 s, ralentie à 0,8 pour durer les 300 images) --------------------------------------------------
export const FIL_LEN = SCENE.fil.len;
export const FIL_WORDS = [10, 17, 100, 107, 113];
const FIL_RATE = 0.8;
// La page d'accueil (la dépêche en grand, immobile jusqu'à 90), puis le défilement vers « À la une » (de 94 à 255) : la caméra
// descend avec lui, puis la page ne bouge plus
export const FIL_KEYS: readonly Cam[] = [
  { at: 0, dur: 0, x: 0.5, y: 0.5, s: 1 },
  { at: 20, dur: 90, x: 0.3, y: 0.44, s: 1.5 },     // zoom lent vers la dépêche (le titre de la page d'accueil)
  { at: 120, dur: 135, x: 0.385, y: 0.6, s: 1.7 },  // il suit le défilement jusqu'à la carte « À la une »
  { at: 267, dur: 33, x: 0.45, y: 0.6, s: 2.1 },    // sur le temps 8, un rapprochement vers son titre
];
const ORBIT: readonly SpriteName[] = ["journal", "globe", "loupe"];

export const Fil: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f >= FIL_LEN) return null;
  const p = ramp(f, 0, 12, 0, 1, LIN);
  const lift = ramp(f, 0, 36, 0, 1, BACK);
  const wscale = 1 + 0.02 * (f / FIL_LEN);
  const wy = WY + bob(f, 4, 4, 52);  // elle flotte à peine
  // L'orbite des trois icônes : une ellipse plus large et plus haute que la fenêtre ; en bas (devant) elles sont plus grandes et nettes,
  // en haut (derrière) plus petites, pâles et floues. Elles restent entre le texte (≤ 385) et la fenêtre (≥ 531) ou en dessous, et dans les marges.
  const orbOut = 1 - ramp(f, FIL_LEN - 14, FIL_LEN - 1, 0, 1, IN);
  const orb = ORBIT.map((n, i) => {
    const phi = ((f * 0.7 + i * 120) * Math.PI) / 180, depth = Math.sin(phi), q = (depth + 1) / 2;
    return { n, depth, q, x: WX + 405 * Math.cos(phi), y: WY + 18 + 365 * Math.sin(phi), size: 100 * (0.8 + 0.3 * q) };
  });
  const orbitEl = orb.sort((a, b) => a.depth - b.depth).map((o) => (
    <Icon key={o.n} name={o.n} x={o.x} y={o.y} size={o.size} blur={(1 - o.q) * 2.2} opacity={0.78 + 0.22 * o.q} rot={bob(f, o.x, 5, 30)} scale={ramp(f, 6, 28, 0, 1, BACK) * orbOut} />
  ));
  const t: PWord[] = [{ t: "43", at: FIL_WORDS[0] }, { t: "sources.", at: FIL_WORDS[1] }, { t: "un", at: FIL_WORDS[2], br: true }, { t: "seul", at: FIL_WORDS[3] }, { t: "fil.", at: FIL_WORDS[4] }];
  return (
    <>
      {/* le blanc de l'éclat de la scène 5 s'efface sous la fenêtre qui se reconstitue */}
      {f < 22 && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: ramp(f, 0, 20, 1, 0, LIN) }} />}
      <Shot f={f} from={0} to={FIL_LEN}>
        <Layer f={f} k={0.6}>
          <div style={{ position: "absolute", left: 0, right: 0, top: TEXT_TOP }}><Words words={t} f={f} /></div>
        </Layer>
        <Layer f={f} k={0.45}>
          <Win cx={WX} cy={wy} w={WW} h={WH} p={p} seed="w6" lift={lift} scale={wscale}>
            <ZoomView f={f} w={WW} h={WH} keys={FIL_KEYS}>
              <Footage name="feed" from={0} frames={FIL_LEN} w={WW} h={WH} rate={FIL_RATE} />
            </ZoomView>
          </Win>
        </Layer>
        <Layer f={f} k={1}>{orbitEl}</Layer>
      </Shot>
    </>
  );
};

// --- Scène 7 : les marchés (heatmap.mp4, 3 s, ralentie pour durer les 267 images) -----------------------------------------------
export const MARCHES_LEN = SCENE.marches.len;
export const MARCHES_WORDS = [6, 12, 18, 24];
// La page d'accueil des marchés défile vers la carte du CAC 40 (immobile dès 89) : trois cadrages sur ses cases
export const MARCHES_KEYS: readonly Cam[] = [
  { at: 0, dur: 0, x: 0.5, y: 0.5, s: 1 },
  { at: 100, dur: 22, x: 0.445, y: 0.32, s: 2.6 },  // temps 3 : Luxe, Finance, Industrie (LVMH, Hermès, BNP, Airbus...)
  { at: 167, dur: 18, x: 0.44, y: 0.7, s: 2.5 },    // temps 5 : Santé, Matériaux, Technologie, Télécoms, Consommation
  { at: 217, dur: 20, x: 0.68, y: 0.29, s: 2.6 },  // temps 6,5 : la droite de la carte (L'Oréal, Kering, Legrand, Bouygues)
];
export const MARCHES_PINGS = [60, 130, 200];

export const Marches: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f >= MARCHES_LEN) return null;
  const wy = WY_ZOOM + bob(f, 4, 4, 52);
  const wscale = WSCALE * punch(f, 0, 0.035, 3, 18);
  const out = 1 - ramp(f, MARCHES_LEN - 14, MARCHES_LEN - 1, 0, 1, IN);
  const t: PWord[] = [{ t: "les", at: MARCHES_WORDS[0] }, { t: "marchés,", at: MARCHES_WORDS[1] }, { t: "en", at: MARCHES_WORDS[2] }, { t: "direct.", at: MARCHES_WORDS[3] }];
  return (
    <Shot f={f} from={0} to={MARCHES_LEN}>
      <Layer f={f} k={0.6}>
        <div style={{ position: "absolute", left: 0, right: 0, top: TEXT_TOP }}><Words words={t} f={f} /></div>
      </Layer>
      <Layer f={f} k={0.45}>
        <Win cx={WX} cy={wy} w={WW} h={WH} seed="w7" scale={wscale}>
          <ZoomView f={f} w={WW} h={WH} keys={MARCHES_KEYS}>
            <Footage name="heatmap" from={0} frames={MARCHES_LEN} w={WW} h={WH} rate={180 / MARCHES_LEN} />
          </ZoomView>
        </Win>
      </Layer>
      <Layer f={f} k={1}>
        <Icon name="bougie" x={110} y={470 + bob(f, 0, 9, 40)} size={132} rot={-8 + bob(f, 1, 4, 55)} scale={ramp(f, 2, 20, 0, 1, BACK) * out} />
        <Icon name="graphique" x={965} y={1190 + bob(f, 2, 9, 44)} size={132} rot={7 + bob(f, 3, 4, 50)} scale={ramp(f, 8, 26, 0, 1, BACK) * out} />
      </Layer>
    </Shot>
  );
};

// --- Scène 8 : l'assistant (ai.mp4, 5,9 s, à la vitesse 0,8) ---------------------------------------------------------------------
// La fenêtre se dissout (0 → 10) et revient (12 → 24) avec l'assistant. La vidéo : la question est tapée de 47 à ~169, la réponse
// arrive à 184 (la page ne bouge plus ensuite, jusqu'à 3,6 s de la vidéo ; elle se remet à défiler après) : à 274 (3,5 s de la
// vidéo) on la fige presque (vitesse 0,1) pour que les sources restent immobiles sous les zooms.
export const IA_LEN = SCENE.ia.len;
export const IA = { dissolve: 0, reform: 12, typing: [47, 169], answer: 184, freeze: 274 } as const;
export const IA_RATE = 0.8;
export const IA_WORDS_A = [6, 13];
export const IA_WORDS_B = [190, 196, 202, 208, 214, 220, 226];
export const IA_KEYS: readonly Cam[] = [
  { at: 0, dur: 0, x: 0.68, y: 0.29, s: 2.6 },   // l'état de la fin de la scène 7 (la fenêtre est dissoute pendant la coupe)
  { at: IA.reform - 1, dur: 0, x: 0.5, y: 0.5, s: 1 },      // la page entière
  { at: 67, dur: 18, x: 0.36, y: 0.5, s: 2.4 },  // temps 2 : le champ de la question, pendant qu'elle est tapée
  { at: 183, dur: 50, x: 0.4, y: 0.38, s: 1.9 }, // temps 5,5 : la réponse et les sources 1, 2, 4, 5, 7, 8
  { at: 267, dur: 20, x: 0.62, y: 0.4, s: 1.9 }, // temps 8 : la colonne de droite (2, 3, 5, 6, 8)
  { at: 317, dur: 24, x: 0.51, y: 0.41, s: 1.5 },  // temps 9,5 : toutes les sources d'un coup d'œil
];
// Le cercle à la main de « où » (boîte de 76 × 58, dans la boîte du mot) ; le cadre à la main des sources (coordonnées de la vidéo, 960 × 540 ; il passe entre la phrase de réponse et les cartes)
const CIRCLE = "M 14 31 C 10 10 58 2 66 24 C 74 50 20 58 9 36 C 4 22 28 6 52 6";
const SOURCES = "M 205 143 C 400 139 640 144 790 141 Q 807 140 807 157 L 806 284 Q 806 299 790 298 C 600 302 360 296 205 299 Q 186 299 186 284 L 187 158 Q 187 142 212 141 C 260 138 300 143 345 140";

export const Ia: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f >= IA_LEN) return null;
  const dissolving = f < IA.reform;
  // La visibilité de la fenêtre (1 = nette, 0 = dissoute)
  const p = dissolving ? 1 - ramp(f, IA.dissolve, IA.dissolve + 10, 0, 1, LIN) : ramp(f, IA.reform, IA.reform + 12, 0, 1, LIN);
  const lift = dissolving ? 1 : ramp(f, IA.reform, IA.reform + 30, 0.55, 1, BACK);
  const wscale = WSCALE * (dissolving ? 1 : punch(f, IA.reform + 4, 0.03, 3, 16));
  const wy = WY_ZOOM + bob(f, 4, 4, 52);
  const ring = <Hand key="ou" d={CIRCLE} box={[76, 58]} p={ramp(f, IA_WORDS_B[3] + 6, IA_WORDS_B[3] + 34, 0, 1, CAM)} style={{ left: "-21%", top: "6%", width: "142%" }} />;
  const ta: PWord[] = [{ t: "une", at: IA_WORDS_A[0] }, { t: "question ?", at: IA_WORDS_A[1] }];
  const tb: PWord[] = [
    { t: "il", at: IA_WORDS_B[0] }, { t: "te", at: IA_WORDS_B[1] }, { t: "dit", at: IA_WORDS_B[2] }, { t: "où", at: IA_WORDS_B[3], deco: ring },
    { t: "il", at: IA_WORDS_B[4] }, { t: "l'a", at: IA_WORDS_B[5] }, { t: "lu.", at: IA_WORDS_B[6] },
  ];
  return (
    <Shot f={f} from={0} to={IA_LEN} exit="fwd">
      <Layer f={f} k={0.6}>
        <div style={{ position: "absolute", left: 0, right: 0, top: TEXT_TOP }}>
          <Words words={ta} f={f} out={IA_WORDS_B[0] - 12} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 0 }}><Words words={tb} f={f} /></div>
        </div>
      </Layer>
      <Layer f={f} k={0.45}>
        <Win cx={WX} cy={wy} w={WW} h={WH} p={p} seed={dissolving ? "w80" : "w81"} lift={lift} scale={wscale}>
          <ZoomView f={f} w={WW} h={WH} keys={IA_KEYS}>
            {dissolving
              ? <Footage name="heatmap" from={0} frames={IA.reform} w={WW} h={WH} rate={1} startSec={2.9} />
              : <>
                <Footage name="ai" from={IA.reform} frames={IA.freeze - IA.reform} w={WW} h={WH} rate={IA_RATE} />
                <Footage name="ai" from={IA.freeze} frames={IA_LEN - IA.freeze} w={WW} h={WH} rate={0.1} startSec={((IA.freeze - IA.reform) * IA_RATE) / 60} />
              </>}
            {!dissolving && <Hand d={SOURCES} box={[960, 540]} p={ramp(f, 298, 330, 0, 1, CAM)} width={3.6} style={{ left: 0, top: 0, width: WW }} />}
          </ZoomView>
        </Win>
      </Layer>
    </Shot>
  );
};
