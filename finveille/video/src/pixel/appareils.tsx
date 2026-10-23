// Scène 10 (1340 → 1520) : sur le gris papier, un téléphone (cadre noir arrondi, 360 × 740) qui montre l'application, une fine
// ellipse bleue en orbite autour de lui (fixe, inclinée, qui reste dans les marges de 70 px : la moitié de gauche passe derrière,
// celle de droite devant), et à côté un ordinateur (fenêtre) : thème clair, puis à 1430 (coupe franche, avec un punch d'échelle et
// un éclair blanc) le globe. « dans ta poche. » puis « de jour comme de nuit. ». Tout flotte doucement ; les trois plans (texte,
// fenêtre, téléphone) ne suivent pas la caméra de la même façon (parallaxe). L'entrée monte (« cut the curve » vers le haut).
import React from "react";
import { BACK, Layer, Orbit, PWord, Words, Win, Footage, Shot, bob, punch } from "./fx";
import { LIN, pop, ramp } from "../kit";
import { PX } from "./theme";

export const APP_FROM = 1340, APP_TO = 1520, APP_CUT = 1430;
const PHX = 290, PHY = 800, PHW = 360, PHH = 740;

export const Appareils: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f < APP_FROM || f >= APP_TO) return null;
  const ph = pop(f, APP_FROM + 4, 14, 150), pc = pop(f, APP_FROM + 14, 14, 150);
  const rise = ramp(f, APP_FROM + 2, APP_FROM + 34, 0, 1, BACK);  // le téléphone monte et se pose
  const phY = PHY + (1 - rise) * 90 + bob(f, 0, 7, 46), phRot = bob(f, 1, 0.7, 60);
  const t: PWord[] = [{ t: "dans", at: 1350 }, { t: "ta", at: 1357 }, { t: "poche.", at: 1363 }, { t: "de", at: 1424, br: true }, { t: "jour", at: 1430 }, { t: "comme", at: 1437 }, { t: "de", at: 1444 }, { t: "nuit.", at: 1450 }];
  // L'orbite : ellipse presque verticale (grand axe 420, petit axe 178) centrée sur le téléphone ; son point le plus à gauche est à ~80 px
  const orbit = { f, cx: PHX, cy: PHY + 10, rx: 420, ry: 178, tilt: -78, dot: 0.06, color: PX.brand, p: ramp(f, APP_FROM + 12, APP_FROM + 44, 0, 1) };
  const flash = ramp(f, APP_CUT, APP_CUT + 9, 0.75, 0, LIN) * (f >= APP_CUT ? 1 : 0);
  return (
    <Shot f={f} from={APP_FROM} to={APP_TO} enter="up" exit="inv">
      <Layer f={f} k={0.5}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 215 }}><Words words={t} f={f} /></div>
      </Layer>
      <Layer f={f} k={1}>
        <Orbit {...orbit} layer="back" a={ph} />
        <div style={{
          position: "absolute", left: PHX - PHW / 2, top: phY - PHH / 2, width: PHW, height: PHH, borderRadius: 54, padding: 12, boxSizing: "border-box",
          background: "#0B0E17", scale: String(ph), rotate: `${phRot}deg`, boxShadow: "0 1px 2px rgba(21,26,43,0.2), 0 28px 54px -16px rgba(21,26,43,0.45), inset 0 0 0 2px #2A3045",
        }}>
          <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 43, overflow: "hidden", background: "#fff" }}>
            <Footage name="mobile" from={APP_FROM} frames={APP_TO - APP_FROM} w={PHW - 24} h={PHH - 24} />
          </div>
        </div>
        <Orbit {...orbit} layer="front" a={ph} />
      </Layer>
      <Layer f={f} k={0.6}>
        <Win cx={765} cy={800 + bob(f, 3, 5, 50)} w={490} h={276} seed="pc" scale={pc * punch(f, APP_CUT, 0.045, 3, 16)} lift={ramp(f, APP_FROM + 14, APP_FROM + 48, 0, 1, BACK)}>
          {f < APP_CUT
            ? <Footage name="light" from={APP_FROM} frames={APP_CUT - APP_FROM} w={490} h={276} />
            : <Footage name="globe" from={APP_CUT} frames={APP_TO - APP_CUT} w={490} h={276} />}
          {flash > 0.01 && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash }} />}
        </Win>
      </Layer>
    </Shot>
  );
};
