// Scène 10b (3 temps, temps local) : la rafale. Six plans-éclairs d'un demi-temps (16,7 images) chacun, coupe franche à chaque fois,
// en alternant le fond papier et le fond nuit : une grosse icône pixel art plein cadre (pièce, bitcoin, graphique en hausse, cloche,
// globe), puis le logo. Chaque plan arrive en reculant (trop grand, il se pose en 5 images) puis avance très lentement ; un blip
// ou un stamp (voir son.tsx) souligne chaque coupe.
import React from "react";
import { At, LogoMark, lerp, pop, ramp } from "../kit";
import { Icon, PCX, PCY, punch } from "./fx";
import { SCENE } from "./montage";
import { BELL_BLUE, SpriteName } from "./sprites";
import { PX } from "./theme";

export const RAFALE_LEN = SCENE.rafale.len;
// L'image (locale) de chaque coupe : un demi-temps d'écart (100 / 6 images)
export const RAFALE_CUTS: readonly number[] = Array.from({ length: 6 }, (_, i) => Math.round((i * 100) / 6));
type Plan = { readonly name: SpriteName | "logo"; readonly dark: boolean };
const PLANS: readonly Plan[] = [
  { name: "piece", dark: false }, { name: "bitcoin", dark: true }, { name: "graphique", dark: false },
  { name: "cloche", dark: true }, { name: "globe", dark: false }, { name: "logo", dark: true },
];
const planAt = (f: number) => RAFALE_CUTS.reduce((acc, c, i) => (f >= c ? i : acc), 0);
// Le plan est-il sombre à l'image locale f ? (le fond de Pixel.tsx en dépend)
export const rafaleDark = (f: number) => f >= 0 && f < RAFALE_LEN && PLANS[planAt(f)].dark;

export const Rafale: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f >= RAFALE_LEN) return null;
  const i = planAt(f), plan = PLANS[i], t = f - RAFALE_CUTS[i], len = (RAFALE_CUTS[i + 1] ?? RAFALE_LEN) - RAFALE_CUTS[i];
  const settle = ramp(t, 0, 6);
  const s = lerp(1.22, 1, settle) * (1 + 0.07 * (t / len)), rot = (i % 2 ? -1 : 1) * (5 * (1 - settle) + 2 * (t / len));
  const glow = plan.dark ? PX.brandLight : undefined;
  return (
    <div style={{ position: "absolute", inset: 0, scale: String(punch(t, 0, 0.02, 2, 8)) }}>
      {plan.name === "logo" ? (
        <At x={PCX} y={PCY} style={{ scale: String(s * (0.9 + 0.1 * pop(t, 0, 12, 200))), rotate: `${rot * 0.5}deg`, filter: `drop-shadow(0 0 28px ${PX.brandLight}) drop-shadow(0 0 90px ${PX.brand})` }}>
          <LogoMark size={560} p={1} id="rf" />
        </At>
      ) : (
        <Icon name={plan.name} x={PCX + 22} y={PCY + 22} size={740} scale={s} rot={rot} depth={3} glow={glow} palette={plan.name === "cloche" ? BELL_BLUE : undefined} shade={plan.dark ? 0.22 : undefined} />
      )}
    </div>
  );
};
