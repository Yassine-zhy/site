// S12 à S14 : le monde vert de Hugo (23 ans, 100 € par mois), le portefeuille virtuel, l'alerte sur Airbus
import React from "react";
import { CAM, COLORS, Character, Kinetic, Label, Pill, Sweep, W, World, display, lerp, ramp, sans, useAbs } from "../kit";
import { Model, SiteWindow, useEvents } from "../site";

const GREEN = COLORS.hugo;

// --- S12 : « Voici Hugo. Vingt-trois ans. Cent euros par mois à placer. » ----------------------------------------------------
export const S12: React.FC = () => {
  const f = useAbs();
  const tHugo = W("L12", "Hugo"), tCent = W("L12", "Cent");
  const n = Math.round(100 * ramp(f, tCent, tCent + 16, [0, 1], CAM));
  const num = ramp(f, tCent - 2, tCent + 6);
  return (
    <World color={GREEN}>
      <Character name="hugo" cx={500} cy={520} d={800} at={tHugo} disc="rgba(255,255,255,0.18)" />
      <Label text="Voici" at={W("L12", "Voici")} size={56} style={{ position: "absolute", left: 1010, top: 96 }} />
      <div style={{ position: "absolute", left: 1000, top: 100 }}>
        <Kinetic toks={[{ t: "Hugo", at: tHugo }]} size={310} shadow="0 8px 40px rgba(0,40,20,0.25)" />
      </div>
      <div style={{ position: "absolute", left: 1006, top: 392 }}>
        <Pill text="23 ans" at={W("L12", "Vingt-trois")} color={GREEN} size={72} />
      </div>
      <div style={{ position: "absolute", left: 1000, top: 490, fontFamily: display, fontWeight: 900, fontSize: 280, letterSpacing: "-0.05em", lineHeight: 1, color: "#fff", fontVariantNumeric: "tabular-nums", opacity: num, translate: `0 ${(1 - num) * 40}px`, textShadow: "0 8px 40px rgba(0,40,20,0.25)", whiteSpace: "nowrap" }}>
        {n} €
      </div>
      <div style={{ position: "absolute", left: 1010, top: 790 }}>
        <Kinetic toks={[
          { t: "par", at: W("L12", "par") }, { t: "mois", at: W("L12", "mois") }, { t: "à", at: W("L12", "à") }, { t: "placer.", at: W("L12", "placer") },
        ]} size={84} weight={800} tracking="-0.03em" />
      </div>
    </World>
  );
};

const SmallHugo: React.FC<{ readonly at: number }> = ({ at }) => (
  <div style={{ position: "absolute", left: 60, top: 110 }}>
    <Character name="hugo" cx={105} cy={105} d={190} at={at} rise={false} disc="rgba(255,255,255,0.18)" />
    <Label text="Hugo" at={at + 3} size={44} style={{ position: "absolute", left: 24, top: 218 }} />
  </div>
);

// --- S13 : « Il s'entraîne sur un portefeuille virtuel, » L'anneau en grand sur le vert, deux étiquettes ----------------------
export const S13: React.FC = () => {
  const f = useAbs();
  const tPf = W("L13", "portefeuille"), tVirt = W("L13", "virtuel");
  const p = ramp(f, 1035, 1049);
  return (
    <World color={GREEN}>
      <div style={{ position: "absolute", left: 360, top: -40, width: 1920, height: 1080, opacity: p, scale: String(lerp(0.9, 1.06, p)), mixBlendMode: "screen", maskImage: "radial-gradient(ellipse 36% 46% at 50% 50%, #000 40%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 36% 46% at 50% 50%, #000 40%, transparent 100%)" }}>
        <Model name="ring" />
      </div>
      <SmallHugo at={1035} />
      <div style={{ position: "absolute", left: 96, top: 420 }}>
        <Kinetic toks={[{ t: "Portefeuille", at: tPf, br: false }, { t: "virtuel", at: tPf + 3, br: true }]} size={140} />
      </div>
      <div style={{ position: "absolute", left: 100, top: 760 }}>
        <Pill text="Zéro euro réel en jeu" at={tVirt + 6} color={GREEN} size={54} />
      </div>
    </World>
  );
};

// --- S14 : « et règle une alerte sur Airbus. » La cloche sonne au clic filmé, puis la carte Airbus et son seuil --------------------
const AirbusCard: React.FC<{ readonly at: number }> = ({ at }) => {
  const f = useAbs();
  const p = ramp(f, at, at + 11);
  const draw = ramp(f, at + 6, at + 34, [0, 1], CAM);
  // la courbe monte, franchit le seuil en pointillé au tiers de sa course
  const pts = [[0, 190], [50, 170], [100, 182], [150, 140], [200, 100], [250, 108], [300, 54], [350, 30]] as const;
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  const cross = ramp(f, at + 18, at + 28);
  return (
    <div style={{ position: "absolute", left: 1330, top: 280, width: 500, height: 440, borderRadius: 30, background: COLORS.night, opacity: p, translate: `0 ${(1 - p) * 70}px`, boxShadow: "0 40px 80px -30px rgba(0,30,10,0.6)", padding: "34px 40px", boxSizing: "border-box" }}>
      <div style={{ fontFamily: display, fontWeight: 900, fontSize: 84, letterSpacing: "-0.04em", color: "#fff", lineHeight: 1 }}>Airbus</div>
      <svg viewBox="0 0 360 230" width={420} style={{ marginTop: 18, overflow: "visible" }}>
        <line x1={0} y1={112} x2={360} y2={112} stroke="#96A2B9" strokeWidth={2.5} strokeDasharray="8 8" />
        <text x={2} y={102} fontFamily={sans} fontWeight={600} fontSize={17} fill="#96A2B9">seuil</text>
        <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} fill="none" stroke={COLORS.up} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={188} cy={112} r={9 + 16 * (1 - cross)} fill={COLORS.up} opacity={cross > 0 ? 0.35 + 0.65 * cross : 0} />
      </svg>
      <div style={{ position: "absolute", right: 36, bottom: 30, fontFamily: sans, fontWeight: 600, fontSize: 30, color: COLORS.up, opacity: cross }}>seuil franchi</div>
    </div>
  );
};

const Ripples: React.FC<{ readonly at: number; readonly x: number; readonly y: number }> = ({ at, x, y }) => {
  const f = useAbs() - at;
  if (f < 0 || f > 40) return null;
  return (
    <>
      {[0, 6, 12].map((d) => {
        const p = clamp01((f - d) / 26);
        return <div key={d} style={{ position: "absolute", left: x - 220 * p, top: y - 220 * p, width: 440 * p, height: 440 * p, borderRadius: "50%", border: `${7 - 4 * p}px solid #fff`, opacity: p > 0 ? (1 - p) * 0.9 : 0 }} />;
      })}
    </>
  );
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const S14: React.FC = () => {
  const tAl = W("L14", "alerte"), tAir = W("L14", "Airbus");
  const ev = useEvents("alerts", { click: 54 });  // l'image du clic dans la séquence, calée sur « alerte »
  return (
    <World color={GREEN}>
      <SmallHugo at={0} />
      <SiteWindow
        name="alerts" box={{ x: 280, y: 120, w: 980, h: 760 }} sync={[tAl, ev.click]} len={120} hold={ev.click + 18} enter={1110} cursor
        cam={[{ f: 1110, cx: 1330, cy: 450, z: 2.4 }]}
        marks={[{ rect: [1196, 296, 1448, 644], at: tAl, until: tAl + 22, pad: 8 }]}
      >
        <Ripples at={tAl + 3} x={478} y={399} />
      </SiteWindow>
      <AirbusCard at={tAir} />
      <Sweep from={1185} to={1200} color={COLORS.sami} />
    </World>
  );
};
