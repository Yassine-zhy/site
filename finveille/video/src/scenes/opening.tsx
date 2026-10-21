// S1 à S4 : l'accroche (le déluge de dépêches, le temps qui manque, ce qui compte)
import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS, IN, Kinetic, Label, W, display, lerp, ramp, sans, toks, useAbs } from "../kit";
import { HeroCards, Wall } from "../wall";

// Un voile de nuit à gauche : le grand texte reste lisible sur le mur
const LeftShade: React.FC<{ readonly w?: number }> = ({ w = 1180 }) => (
  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: w, background: `linear-gradient(90deg, ${COLORS.night}F2 0%, ${COLORS.night}CC 55%, ${COLORS.night}00 100%)` }} />
);

// --- S1 : « Chaque jour, des milliers d'articles sur les marchés. » ------------------------------------------------------------
export const S1: React.FC = () => (
  <AbsoluteFill>
    <Wall mode="open" />
    <LeftShade />
    <div style={{ position: "absolute", left: 96, top: 236 }}>
      <Kinetic toks={toks("L01", 0, 5, [2, 4], ["Chaque", "jour,", "des", "milliers", "d'articles."])} size={176} exit={108} />
    </div>
    <div style={{ position: "absolute", left: 100, top: 790 }}>
      <Kinetic toks={toks("L01", 5, 8)} size={64} weight={600} font={sans} tracking="-0.01em" color={COLORS.brand} exit={110} />
    </div>
  </AbsoluteFill>
);

// --- S2 : « En anglais. Sur des dizaines de sites. À toute heure. » ------------------------------------------------------------
const EN = ["Stocks slide as yields climb", "Fed signals patience on rates", "Oil edges lower on demand worries", "Tech rally lifts the Nasdaq", "Dollar firm ahead of jobs data", "Bank earnings beat forecasts"];
const English: React.FC = () => {
  const f = useAbs();
  const t0 = W("L02", "anglais");
  return (
    <>
      {EN.map((t, i) => {
        const p = ramp(f, t0 + i * 3, t0 + i * 3 + 9);
        const out = ramp(f, 142 + i, 150 + i, [0, 1], IN);
        return (
          <div key={t} style={{ position: "absolute", left: 1010, top: 190 + i * 112, width: 800, height: 92, borderRadius: 16, background: "#0E1628", border: `1.5px solid ${COLORS.line}`, display: "flex", alignItems: "center", paddingLeft: 34, opacity: p * (1 - out), translate: `${(1 - p) * 120 + out * 80}px 0` }}>
            <div style={{ width: 8, height: 44, borderRadius: 4, background: COLORS.brand, marginRight: 24 }} />
            <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 38, color: COLORS.ink }}>{t}</div>
          </div>
        );
      })}
    </>
  );
};

const Tabs: React.FC = () => {
  const f = useAbs();
  const t0 = W("L02", "dizaines");
  const tOut = W("L02", "toute");
  const out = ramp(f, tOut - 4, tOut + 4, [0, 1], IN);
  const N = 40;
  return (
    <>
      {Array.from({ length: N }, (_, i) => {
        const at = t0 + 26 * Math.pow(i / N, 1.3);  // les onglets se multiplient de plus en plus vite
        const p = ramp(f, at, at + 6);
        const slot = (i * 17) % N;
        const x = 1010 + (slot % 5) * 160, y = 180 + Math.floor(slot / 5) * 64;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: 150, height: 52, borderRadius: "12px 12px 4px 4px", background: i % 7 === 0 ? "#18233f" : "#111a2f", border: `1.5px solid ${COLORS.line}`, opacity: p * (1 - out), scale: String(lerp(0.7, 1, p)), display: "flex", alignItems: "center", gap: 10, paddingLeft: 12 }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, background: ["#FF6375", COLORS.brand, "#FFA94D", COLORS.up, "#9B7BFF"][i % 5] }} />
            <div style={{ width: 70 - (i % 4) * 10, height: 8, borderRadius: 4, background: BAR_GRAY }} />
          </div>
        );
      })}
    </>
  );
};
const BAR_GRAY = "#33415f";

const Clock: React.FC = () => {
  const f = useAbs();
  const t0 = W("L02", "toute"), tH = W("L02", "heure");
  const p = ramp(f, t0, t0 + 10);
  const turn = Math.pow(Math.max(0, f - t0), 1.18) * 21;  // la grande aiguille tourne de plus en plus vite
  const R = 250, cx = 1420, cy = 470;
  return (
    <div style={{ opacity: p, scale: String(lerp(0.85, 1, p)) }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
        <circle cx={cx} cy={cy} r={R} fill="#0E1628" stroke={COLORS.brand} strokeWidth={8} />
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2 - Math.PI / 2, long = i % 6 === 0;
          return <line key={i} x1={cx + Math.cos(a) * (R - (long ? 46 : 26))} y1={cy + Math.sin(a) * (R - (long ? 46 : 26))} x2={cx + Math.cos(a) * (R - 12)} y2={cy + Math.sin(a) * (R - 12)} stroke={long ? COLORS.ink : COLORS.muted} strokeWidth={long ? 6 : 3} strokeLinecap="round" />;
        })}
        {[["24", 0], ["6", 90], ["12", 180], ["18", 270]].map(([t, deg]) => {
          const a = ((deg as number) - 90) * (Math.PI / 180);
          return <text key={t} x={cx + Math.cos(a) * (R - 84)} y={cy + Math.sin(a) * (R - 84) + 17} textAnchor="middle" fontFamily={display} fontWeight={800} fontSize={48} fill={COLORS.ink}>{t}</text>;
        })}
        <g transform={`rotate(${turn} ${cx} ${cy})`}>
          <line x1={cx} y1={cy + 26} x2={cx} y2={cy - R + 52} stroke={COLORS.up} strokeWidth={9} strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r={14} fill={COLORS.up} />
      </svg>
      <div style={{ position: "absolute", left: cx - 300, width: 600, top: cy + R + 36 }}>
        <Label text="24 h sur 24" at={tH} size={56} style={{ textAlign: "center", fontFamily: display, fontWeight: 900, letterSpacing: "-0.03em" }} />
      </div>
    </div>
  );
};

export const S2: React.FC = () => (
  <AbsoluteFill>
    <Wall mode="open" />
    <LeftShade w={1080} />
    <div style={{ position: "absolute", left: 96, top: 360 }}>
      <Kinetic toks={toks("L02", 0, 2, [1])} size={220} exit={W("L02", "sur") - 2} />
    </div>
    <div style={{ position: "absolute", left: 96, top: 230 }}>
      <Kinetic toks={toks("L02", 2, 7, [4, 5])} size={206} exit={W("L02", "À") - 2} />
    </div>
    <div style={{ position: "absolute", left: 96, top: 360 }}>
      <Kinetic toks={toks("L02", 7, 10, [9])} size={220} />
    </div>
    <English />
    <Tabs />
    <Clock />
  </AbsoluteFill>
);

// --- S3 : « Et toi, tu as dix minutes. » Bleu marque plein cadre, un décompte à chaque temps -------------------------------------
const Digits: React.FC<{ readonly from: string; readonly to: string; readonly at: number; readonly size: number }> = ({ from, to, at, size }) => {
  const f = useAbs();
  const p = ramp(f, at, at + 7);
  const row: React.CSSProperties = { fontFamily: display, fontWeight: 900, fontSize: size, letterSpacing: "-0.05em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: COLORS.night, whiteSpace: "nowrap" };
  return (
    <div style={{ position: "relative", width: 1760, height: size * 0.92, overflow: "hidden" }}>
      <div style={{ ...row, position: "absolute", left: 0, top: 0, translate: `0 ${-p * 100}%` }}>{from}</div>
      <div style={{ ...row, position: "absolute", left: 0, top: 0, translate: `0 ${(1 - p) * 100}%` }}>{to}</div>
    </div>
  );
};
export const S3: React.FC = () => {
  const f = useAbs();
  const show = ramp(f, 225, 235);
  return (
    <AbsoluteFill style={{ background: COLORS.brand }}>
      <div style={{ position: "absolute", left: 96, top: 120 }}>
        <Kinetic toks={[{ t: "Et toi ?", at: W("L03", "toi") - 3 }]} size={70} font={sans} weight={600} tracking="-0.01em" color={COLORS.night} />
      </div>
      <div style={{ position: "absolute", left: 80, top: 290, opacity: show, translate: `0 ${(1 - show) * 60}px` }}>
        <Digits from="10:00" to="09:59" at={240} size={560} />
      </div>
    </AbsoluteFill>
  );
};

// --- S4 : « Pour comprendre ce qui compte. » Tout s'éteint, trois cartes s'allument, puis tout est aspiré en une ligne -----------
export const S4: React.FC = () => {
  const f = useAbs();
  const tSq = 330;  // 11,0 s
  const sy = f < tSq ? 1 : lerp(1, 0.006, ramp(f, tSq, tSq + 22, [0, 1], IN));
  const sx = f < tSq + 22 ? 1 : lerp(1, 0.02, ramp(f, tSq + 22, 359, [0, 1], IN));
  const line = ramp(f, tSq + 14, tSq + 24);
  const lineW = f < tSq + 22 ? 1920 : lerp(1920, 20, ramp(f, tSq + 22, 359, [0, 1], IN));
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, transformOrigin: "50% 50%", transform: `scale(${sx}, ${sy})`, filter: f > tSq ? `brightness(${1 + 0.9 * ramp(f, tSq, tSq + 20)})` : undefined }}>
        <Wall mode="close" />
        <HeroCards />
      </div>
      {f >= tSq + 14 ? (
        <div style={{ position: "absolute", left: 960 - lineW / 2, top: 538, width: lineW, height: 4, borderRadius: 2, background: "#fff", opacity: line, boxShadow: `0 0 36px 8px ${COLORS.brand}, 0 0 90px 20px ${COLORS.brand}88` }} />
      ) : null}
    </AbsoluteFill>
  );
};

