// Scènes 3 et 9 : les plans sombres (bleu nuit). Un sujet lumineux (la grosse cloche pixel art en bleu lumineux, du bleu de
// la marque presque blanc au cœur, avec son halo) entouré d'une fine ellipse blanche en orbite : la moitié du haut passe derrière
// la cloche, celle du bas devant. L'orbite est centrée sur le centre VISUEL de la cloche (la face claire, pas la boîte du sprite).
//   scène 3 (6 temps) : coupe franche (on recule : la cloche arrive trop grande et se pose) ; « et au final ? » puis, dessous,
//                       « t'as raté l'info. » à gauche (les deux restent lisibles) ; la caméra avance doucement ; pendant les
//                       50 dernières images (le CREUX, sans son) tout se fige : seuls la lueur, la cloche et le texte respirent
//   scène 9 (6 temps) : coupe franche, éclat rouge (l'alerte) ; la cloche blanche se penche en arrière puis sonne (±15°,
//                       amortie), puis sonne une seconde fois, plus doucement ; « tu fixes un seuil. » puis, dessous,
//                       « il te prévient. »
// Le temps est local : 0 = la première image de la scène.
import React from "react";
import { Icon, Layer, Orbit, PCX, PWord, Shot, Words, bob, punch } from "./fx";
import { CAM, LIN, clamp, pop, ramp, rgba } from "../kit";
import { SCENE } from "./montage";
import { BELL_BLUE, BELL_WHITE } from "./sprites";
import { visualCenter } from "./Sprite";
import { PX } from "./theme";

export const NUIT3_LEN = SCENE.nuit.len, NUIT9_LEN = SCENE.alerte.len;
export const CREUX = 50;  // les dernières images de la scène 3 : l'image se fige et le son s'éteint
export const NUIT3_WORDS = [4, 10, 16, 22, 66, 73, 80];  // « et au final ? » puis « t'as raté l'info. »
export const BELL_RING = 20, BELL_RING_2 = 133;  // les images (locales) où la cloche de la scène 9 sonne
export const NUIT9_WORDS = [16, 22, 28, 34, 62, 68, 74];
const TILT = -18;  // l'inclinaison élégante de l'orbite, dans les deux scènes

export const Nuit3: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f >= NUIT3_LEN) return null;
  // Le creux : le mouvement s'arrête (`g`, le temps figé de la cloche et de l'orbite) ; seuls un souffle d'échelle et de lueur continuent
  // Il se fige en douceur : la vitesse du temps tombe à zéro en 20 images (courbe quadratique, sans à-coup)
  const P = NUIT3_LEN - CREUX, u = clamp((f - (P - 20)) / 20, 0, 1);
  const g = f < P - 20 ? f : P - 20 + 10 * (1 - (1 - u) * (1 - u)), still = ramp(f, P - 10, P + 10, 0, 1, CAM);
  const t = g;
  // La cloche claque : trop grande puis elle se pose (ressort : elle passe un peu sous 1), avec une petite secousse
  const slam = (1 + 0.12 * (1 - pop(f, 0, 9, 210, 0.6))) * (1 + 0.012 * still * Math.sin((f - P) / 24));
  const shake = Math.sin(t * 2.4) * 9 * (1 - ramp(f, 0, 22, 0, 1, LIN));
  const cx = 690, cy = 600, by = cy + bob(g, 0, 8, 38);
  const [ox, oy] = visualCenter(cx + shake, by, 400, 7, 0.32);
  const op = ramp(f, 6, 36, 0, 1);  // l'orbite se trace
  const glow = 0.92 + 0.08 * Math.sin(f / 17);
  const w: PWord[] = [
    { t: "et", at: NUIT3_WORDS[0] }, { t: "au", at: NUIT3_WORDS[1] }, { t: "final", at: NUIT3_WORDS[2] }, { t: "?", at: NUIT3_WORDS[3] },
    { t: "t'as", at: NUIT3_WORDS[4], br: true }, { t: "raté", at: NUIT3_WORDS[5] }, { t: "l'info.", at: NUIT3_WORDS[6] },
  ];
  const cam = 1 + 0.04 * ramp(g, 0, NUIT3_LEN - CREUX, 0, 1, LIN);
  return (
    <Shot f={f} from={0} to={NUIT3_LEN} enter="inv" exit="left" outDur={5} punch={cam}>
      <Layer f={g} k={0.3}>
        <div style={{ position: "absolute", left: cx - 380, top: cy - 380, width: 760, height: 760, opacity: glow, background: `radial-gradient(circle, ${rgba(PX.brandLight, 0.34)} 0%, ${rgba(PX.brand, 0.14)} 38%, transparent 68%)` }} />
      </Layer>
      <Layer f={g} k={1}>
        <Orbit f={g} cx={ox} cy={oy} rx={300} ry={104} tilt={TILT} layer="back" p={op} />
        <Icon name="cloche" x={cx + shake} y={by} size={400} scale={slam} rot={bob(g, 1, 2.2, 52)} palette={BELL_BLUE} glow={PX.brand} depth={7} shade={0.22} />
        <Orbit f={g} cx={ox} cy={oy} rx={300} ry={104} tilt={TILT} layer="front" p={op} />
      </Layer>
      <Layer f={f} k={0.55}>
        <div style={{ position: "absolute", left: 90, top: 935 }}><Words words={w} f={f} color={PX.snow} align="left" /></div>
      </Layer>
    </Shot>
  );
};

export const Nuit9: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f >= NUIT9_LEN) return null;
  const k = f - BELL_RING, k2 = f - BELL_RING_2;
  // Elle se penche en arrière (anticipation, 6 images avant) puis sonne : une oscillation de ±15° autour de son sommet, qui
  // s'amortit ; une seconde fois, plus douce (±6°), 4 temps plus tard
  const lean = -7 * ramp(f, BELL_RING - 6, BELL_RING, 0, 1, CAM) * (1 - ramp(f, BELL_RING, BELL_RING + 6, 0, 1));
  const swing = lean + (k < 0 ? 0 : 15 * Math.sin((k / 34) * Math.PI * 2) * Math.exp(-k / 52)) + (k2 < 0 ? 0 : 6 * Math.sin((k2 / 34) * Math.PI * 2) * Math.exp(-k2 / 40));
  const pip = pop(f, 4, 13, 150);
  const [ox, oy] = visualCenter(PCX, 364 + 156, 410, 7, 0.32);
  const op = ramp(f, 10, 42, 0, 1);
  const glow = 0.92 + 0.08 * Math.sin(f / 17) + 0.25 * Math.exp(-Math.max(0, k) / 14) * (k >= 0 ? 1 : 0) + 0.12 * Math.exp(-Math.max(0, k2) / 14) * (k2 >= 0 ? 1 : 0);  // un éclat quand elle sonne
  const w: PWord[] = [
    { t: "tu", at: NUIT9_WORDS[0] }, { t: "fixes", at: NUIT9_WORDS[1] }, { t: "un", at: NUIT9_WORDS[2] }, { t: "seuil.", at: NUIT9_WORDS[3] },
    { t: "il", at: NUIT9_WORDS[4], br: true }, { t: "te", at: NUIT9_WORDS[5] }, { t: "prévient.", at: NUIT9_WORDS[6] },
  ];
  return (
    <Shot f={f} from={0} to={NUIT9_LEN} enter="fwd" exit="up" punch={punch(f, BELL_RING, 0.03, 3, 22)}>
      <Layer f={f} k={0.3}>
        <div style={{ position: "absolute", left: PCX - 400, top: 520 - 400, width: 800, height: 800, opacity: glow, background: `radial-gradient(circle, ${rgba(PX.brandLight, 0.34)} 0%, ${rgba(PX.brand, 0.14)} 38%, transparent 68%)` }} />
      </Layer>
      <Layer f={f} k={1}>
        <Orbit f={f} cx={ox} cy={oy + 8} rx={330} ry={104} tilt={TILT} layer="back" p={op} dot={-0.06} />
        {/* le pivot est au sommet de la cloche : le conteneur de taille nulle tourne autour de son coin */}
        <div style={{ position: "absolute", left: PCX, top: 364 + bob(f, 2, 5, 44), width: 0, height: 0, transformOrigin: "0 0", rotate: `${swing}deg` }}>
          <Icon name="cloche" x={0} y={156} size={410} scale={pip} palette={BELL_WHITE} glow={PX.brandLight} depth={7} shade={0.22} />
        </div>
        <Orbit f={f} cx={ox} cy={oy + 8} rx={330} ry={104} tilt={TILT} layer="front" p={op} dot={-0.06} />
      </Layer>
      <Layer f={f} k={0.55}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 945 }}><Words words={w} f={f} color={PX.snow} /></div>
      </Layer>
    </Shot>
  );
};
