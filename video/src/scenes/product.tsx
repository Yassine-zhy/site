// S5 à S8 : la révélation du produit (logo), le fil, les rubriques, le brief en français
import React from "react";
import { AbsoluteFill } from "remotion";
import { Burst, COLORS, Logo, OUT, Sweep, W, Wordmark, display, lerp, ramp, useAbs } from "../kit";
import { SiteWindow } from "../site";
import { Columns, Funnel } from "../wall";

// --- S5 : « Alors voici FinVeille. » Impact à 12,0 s : éclat radial, le logo, puis le nom au mot --------------------------------
export const S5: React.FC = () => {
  const f = useAbs();
  const flash = ramp(f, 360, 366, [0.55, 0]);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(900px 700px at 50% 44%, ${COLORS.brand}33, transparent 70%)`, opacity: ramp(f, 360, 380) }} />
      <Burst at={360} />
      <Logo cx={960} cy={370} size={250} at={360} id="s5" />
      <Wordmark top={520} size={210} at={W("L05", "FinVeille")} />
      <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};

// --- S6 : « FinVeille rassemble toutes les dépêches, » L'entonnoir : les cartes volent vers la fenêtre qui montre le fil ----------
export const S6: React.FC = () => {
  const tDep = W("L06", "dépêches");
  return (
    <AbsoluteFill>
      <Funnel from={W("L06", "rassemble") - 4} to={W("L06", "rassemble") + 40} />
      <SiteWindow
        name="feed" box={{ x: 330, y: 96, w: 1260, h: 790 }} sync={[tDep, 134]} len={135} hold={134} enter={405}
        cam={[{ f: 418, cx: 960, cy: 540, z: 1.0 }, { f: tDep, cx: 745, cy: 545, z: 1.7 }]}
        marks={[{ rect: [306, 296, 1178, 784], at: tDep, pad: 8 }]}
      />
    </AbsoluteFill>
  );
};

// --- S7 : « les trie par sujet, » Quatre colonnes ---------------------------------------------------------------------------
export const S7: React.FC = () => (
  <AbsoluteFill>
    <Columns start={480} />
  </AbsoluteFill>
);

// --- S8 : « et t'explique l'essentiel, en français. » Le brief recadré sur son résumé, le tampon « En français » ---------------
export const S8: React.FC = () => {
  const f = useAbs();
  const tEss = W("L08", "l'essentiel"), tFr = W("L08", "français");
  const stamp = ramp(f, tFr, tFr + 6, [0, 1], OUT);
  return (
    <AbsoluteFill>
      <SiteWindow
        name="brief" box={{ x: 180, y: 96, w: 1560, h: 800 }} sync={[tEss, 89]} len={90} hold={89} enter={525}
        cam={[{ f: 525, cx: 930, cy: 560, z: 1.45 }]}
        marks={[{ rect: [306, 304, 1566, 736], at: tEss, pad: 8 }]}
      />
      {f >= tFr ? (
        <div style={{
          position: "absolute", left: 1100, top: 730, rotate: "-6deg", scale: String(lerp(1.25, 1, stamp)), opacity: stamp, padding: "10px 40px 18px", borderRadius: 22, background: COLORS.night,
          border: `9px solid ${COLORS.brand}`, boxShadow: `0 30px 70px -20px #000, 0 0 60px ${COLORS.brand}66`, fontFamily: display, fontWeight: 900, fontSize: 124, letterSpacing: "-0.04em", color: COLORS.brand, lineHeight: 1.1,
        }}>
          En français
        </div>
      ) : null}
      <Sweep from={615} to={630} color={COLORS.ines} />
    </AbsoluteFill>
  );
};
