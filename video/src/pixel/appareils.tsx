// Scène 10 (1340 → 1520) : sur le gris papier, un téléphone (cadre noir arrondi, 360 × 740) qui montre l'application, une fine
// ellipse blanche en orbite autour de lui, et à côté un ordinateur (fenêtre) : thème clair, puis à 1430 (coupe franche) le globe.
// « dans ta poche. » puis « de jour comme de nuit. ».
import React from "react";
import { Orbit, PWord, Words, Win, Footage } from "./fx";
import { pop } from "../kit";

export const APP_FROM = 1340, APP_TO = 1520, APP_CUT = 1430;
const PHX = 290, PHY = 800, PHW = 360, PHH = 740;

export const Appareils: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f < APP_FROM || f >= APP_TO) return null;
  const ph = pop(f, APP_FROM + 4, 14, 150), pc = pop(f, APP_FROM + 14, 14, 150);
  const t: PWord[] = [{ t: "dans", at: 1350 }, { t: "ta", at: 1357 }, { t: "poche.", at: 1363 }, { t: "de", at: 1424, br: true }, { t: "jour", at: 1430 }, { t: "comme", at: 1437 }, { t: "de", at: 1444 }, { t: "nuit.", at: 1450 }];
  const orbit = { f, cx: PHX, cy: PHY, rx: 430, ry: 205, tilt: 78, spin: 0.25, dot: 0.06 };
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 215 }}><Words words={t} f={f} /></div>
      <Orbit {...orbit} layer="back" a={ph} />
      <div style={{
        position: "absolute", left: PHX - PHW / 2, top: PHY - PHH / 2, width: PHW, height: PHH, borderRadius: 54, padding: 12, boxSizing: "border-box",
        background: "#0B0E17", scale: String(ph), boxShadow: "0 1px 2px rgba(21,26,43,0.2), 0 28px 54px -16px rgba(21,26,43,0.45), inset 0 0 0 2px #2A3045",
      }}>
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 43, overflow: "hidden", background: "#fff" }}>
          <Footage name="mobile" from={APP_FROM} frames={APP_TO - APP_FROM} w={PHW - 24} h={PHH - 24} />
        </div>
      </div>
      <Orbit {...orbit} layer="front" a={ph} />
      <Win cx={765} cy={800} w={490} h={276} seed="pc" scale={pc}>
        {f < APP_CUT
          ? <Footage name="light" from={APP_FROM} frames={APP_CUT - APP_FROM} w={490} h={276} />
          : <Footage name="globe" from={APP_CUT} frames={APP_TO - APP_CUT} w={490} h={276} />}
      </Win>
    </>
  );
};
