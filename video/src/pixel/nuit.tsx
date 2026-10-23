// Scènes 3 et 9 : les plans sombres (bleu nuit). Un sujet lumineux (la grosse cloche pixel art en bleu lumineux, du bleu de
// la marque presque blanc au cœur, avec son halo) entouré d'une fine ellipse blanche en orbite : la moitié du haut passe derrière
// la cloche, celle du bas devant. L'orbite est centrée sur le centre VISUEL de la cloche (la face claire, pas la boîte du sprite).
//   scène 3 (300 → 420) : coupe franche (on recule : la cloche arrive trop grande et se pose) ; « et au final ? » puis
//                         « t'as raté l'info. » à gauche ; la caméra avance doucement
//   scène 9 (1180 → 1340) : coupe franche, éclat rouge (l'alerte) ; la cloche blanche se penche en arrière puis sonne (±15°,
//                           amortie) ; « tu fixes un seuil. » puis « il te prévient. »
import React from "react";
import { Icon, Layer, Orbit, PCX, PWord, Shot, Words, bob, punch } from "./fx";
import { CAM, LIN, pop, ramp, rgba } from "../kit";
import { BELL_BLUE, BELL_WHITE } from "./sprites";
import { visualCenter } from "./Sprite";
import { PX } from "./theme";

export const NUIT3 = { from: 300, to: 420 }, NUIT9 = { from: 1180, to: 1340 };
export const BELL_RING = 1200;  // l'image où la cloche de la scène 9 sonne
const TILT = -18;  // l'inclinaison élégante de l'orbite, dans les deux scènes

export const Nuit3: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f < NUIT3.from || f >= NUIT3.to) return null;
  const t = f - NUIT3.from;
  // La cloche claque : trop grande puis elle se pose (ressort : elle passe un peu sous 1), avec une petite secousse
  const slam = 1 + 0.12 * (1 - pop(f, 300, 9, 210, 0.6));
  const shake = Math.sin(t * 2.4) * 9 * (1 - ramp(f, 300, 322, 0, 1, LIN));
  const cx = 690, cy = 600, by = cy + bob(f, 0, 8, 38);
  const [ox, oy] = visualCenter(cx + shake, by, 400, 7, 0.32);
  const op = ramp(f, 306, 336, 0, 1);  // l'orbite se trace
  const glow = 0.92 + 0.08 * Math.sin(f / 17);
  const w1: PWord[] = [{ t: "et", at: 304 }, { t: "au", at: 310 }, { t: "final", at: 316 }, { t: "?", at: 322 }];
  const w2: PWord[] = [{ t: "t'as", at: 362 }, { t: "raté", at: 368 }, { t: "l'info.", at: 374 }];
  return (
    <Shot f={f} from={NUIT3.from} to={NUIT3.to} enter="inv" exit="left" punch={1 + 0.04 * ramp(f, 300, 420, 0, 1, LIN)}>
      <Layer f={f} k={0.3}>
        <div style={{ position: "absolute", left: cx - 380, top: cy - 380, width: 760, height: 760, opacity: glow, background: `radial-gradient(circle, ${rgba(PX.brandLight, 0.34)} 0%, ${rgba(PX.brand, 0.14)} 38%, transparent 68%)` }} />
      </Layer>
      <Layer f={f} k={1}>
        <Orbit f={f} cx={ox} cy={oy} rx={300} ry={104} tilt={TILT} layer="back" p={op} />
        <Icon name="cloche" x={cx + shake} y={by} size={400} scale={slam} rot={bob(f, 1, 2.2, 52)} palette={BELL_BLUE} glow={PX.brand} depth={7} shade={0.22} />
        <Orbit f={f} cx={ox} cy={oy} rx={300} ry={104} tilt={TILT} layer="front" p={op} />
      </Layer>
      <Layer f={f} k={0.55}>
        <div style={{ position: "absolute", left: 90, top: 975 }}><Words words={w1} f={f} out={354} color={PX.snow} align="left" /></div>
        <div style={{ position: "absolute", left: 90, top: 975 }}><Words words={w2} f={f} color={PX.snow} align="left" /></div>
      </Layer>
    </Shot>
  );
};

export const Nuit9: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f < NUIT9.from || f >= NUIT9.to) return null;
  const k = f - BELL_RING;
  // Elle se penche en arrière (anticipation, de 1194 à 1200) puis sonne : une oscillation de ±15° autour de son sommet, qui s'amortit
  const lean = -7 * ramp(f, BELL_RING - 6, BELL_RING, 0, 1, CAM) * (1 - ramp(f, BELL_RING, BELL_RING + 6, 0, 1));
  const swing = lean + (k < 0 ? 0 : 15 * Math.sin((k / 34) * Math.PI * 2) * Math.exp(-k / 52));
  const pip = pop(f, NUIT9.from + 4, 13, 150);
  const [ox, oy] = visualCenter(PCX, 364 + 156, 410, 7, 0.32);
  const op = ramp(f, 1190, 1222, 0, 1);
  const glow = 0.92 + 0.08 * Math.sin(f / 17) + 0.25 * Math.exp(-Math.max(0, k) / 14) * (k >= 0 ? 1 : 0);  // un éclat quand elle sonne
  const w1: PWord[] = [{ t: "tu", at: 1196 }, { t: "fixes", at: 1203 }, { t: "un", at: 1210 }, { t: "seuil.", at: 1217 }];
  const w2: PWord[] = [{ t: "il", at: 1262 }, { t: "te", at: 1268 }, { t: "prévient.", at: 1274 }];
  return (
    <Shot f={f} from={NUIT9.from} to={NUIT9.to} enter="fwd" exit="up" punch={punch(f, BELL_RING, 0.03, 3, 22)}>
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
        <div style={{ position: "absolute", left: 0, right: 0, top: 1000 }}><Words words={w1} f={f} out={1254} color={PX.snow} /></div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 1000 }}><Words words={w2} f={f} color={PX.snow} /></div>
      </Layer>
    </Shot>
  );
};
