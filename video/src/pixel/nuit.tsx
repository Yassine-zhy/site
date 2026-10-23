// Scènes 3 et 9 : les plans sombres (bleu nuit). Un sujet lumineux (la grosse cloche pixel art en bleu lumineux, du bleu de
// la marque presque blanc au cœur, avec son halo) entouré d'une fine ellipse blanche en orbite.
//   scène 3 (300 → 420) : coupe franche ; la cloche claque à l'écran ; « et au final ? » puis « t'as raté l'info. » à gauche
//   scène 9 (1180 → 1340) : coupe franche, éclat rouge (l'alerte) ; la cloche blanche sonne (±15°, amortie) ; « tu fixes
//                           un seuil. » puis « il te prévient. »
import React from "react";
import { Icon, Orbit, PCX, PWord, Words, bob } from "./fx";
import { LIN, OUT, lerp, pop, ramp } from "../kit";
import { BELL_BLUE, BELL_WHITE } from "./sprites";
import { PX } from "./theme";

export const NUIT3 = { from: 300, to: 420 }, NUIT9 = { from: 1180, to: 1340 };
export const BELL_RING = 1200;  // l'image où la cloche de la scène 9 sonne

export const Nuit3: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f < NUIT3.from || f >= NUIT3.to) return null;
  const t = f - NUIT3.from;
  // La cloche claque : trop grande puis elle se pose, avec une petite secousse
  const slam = lerp(1.35, 1, OUT(ramp(f, 300, 312, 0, 1, LIN)));
  const shake = Math.sin(t * 2.4) * 9 * (1 - ramp(f, 300, 322, 0, 1, LIN));
  const cx = 690, cy = 600;
  const w1: PWord[] = [{ t: "et", at: 304 }, { t: "au", at: 310 }, { t: "final", at: 316 }, { t: "?", at: 322 }];
  const w2: PWord[] = [{ t: "t'as", at: 362 }, { t: "raté", at: 368 }, { t: "l'info.", at: 374 }];
  return (
    <>
      <Orbit f={f} cx={cx} cy={cy + 20} rx={290} ry={96} tilt={-16} layer="back" spin={0.45} />
      <Icon name="cloche" x={cx + shake} y={cy + bob(f, 0, 8, 38)} size={400} scale={slam} rot={bob(f, 1, 2.2, 52)} palette={BELL_BLUE} glow={PX.brand} depth={7} shade={0.22} />
      <Orbit f={f} cx={cx} cy={cy + 20} rx={290} ry={96} tilt={-16} layer="front" spin={0.45} />
      <div style={{ position: "absolute", left: 90, top: 975 }}><Words words={w1} f={f} out={354} color={PX.snow} align="left" /></div>
      <div style={{ position: "absolute", left: 90, top: 975 }}><Words words={w2} f={f} color={PX.snow} align="left" /></div>
    </>
  );
};

export const Nuit9: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f < NUIT9.from || f >= NUIT9.to) return null;
  const k = f - BELL_RING;
  // Elle sonne : une oscillation de ±15° autour de son sommet, qui s'amortit
  const swing = k < 0 ? 0 : 15 * Math.sin((k / 34) * Math.PI * 2) * Math.exp(-k / 52);
  const pip = pop(f, NUIT9.from + 4, 13, 150);
  const w1: PWord[] = [{ t: "tu", at: 1196 }, { t: "fixes", at: 1203 }, { t: "un", at: 1210 }, { t: "seuil.", at: 1217 }];
  const w2: PWord[] = [{ t: "il", at: 1262 }, { t: "te", at: 1268 }, { t: "prévient.", at: 1274 }];
  return (
    <>
      <Orbit f={f} cx={PCX} cy={590} rx={330} ry={104} tilt={14} layer="back" spin={-0.4} />
      {/* le pivot est au sommet de la cloche : le conteneur de taille nulle tourne autour de son coin */}
      <div style={{ position: "absolute", left: PCX, top: 364, width: 0, height: 0, transformOrigin: "0 0", rotate: `${swing}deg` }}>
        <Icon name="cloche" x={0} y={156} size={410} scale={pip} palette={BELL_WHITE} glow={PX.brandLight} depth={7} shade={0.22} />
      </div>
      <Orbit f={f} cx={PCX} cy={590} rx={330} ry={104} tilt={14} layer="front" spin={-0.4} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 1000 }}><Words words={w1} f={f} out={1254} color={PX.snow} /></div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1000 }}><Words words={w2} f={f} color={PX.snow} /></div>
    </>
  );
};
