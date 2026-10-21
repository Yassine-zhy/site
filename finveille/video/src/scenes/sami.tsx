// S15 à S17 : le monde orange de Sami (19 ans, du bitcoin un peu vite), le vocabulaire, ce que 100 € par mois deviennent
import React from "react";
import { COLORS, Character, Kinetic, Label, Pill, W, World, display, lerp, ramp, rnd, sans, useAbs, clamp } from "../kit";
import { Model } from "../site";

const ORANGE = COLORS.sami;
const BG = `linear-gradient(160deg, ${ORANGE} 0%, #F5640F 100%)`;  // un orange un peu plus profond vers le bas : le blanc se lit mieux

const SmallSami: React.FC<{ readonly at: number }> = ({ at }) => (
  <div style={{ position: "absolute", left: 60, top: 110 }}>
    <Character name="sami" cx={105} cy={105} d={190} at={at} rise={false} disc="rgba(255,255,255,0.2)" />
    <Label text="Sami" at={at + 3} size={44} style={{ position: "absolute", left: 24, top: 218 }} />
  </div>
);

// Une pièce de bitcoin dessinée (disque orangé, anneau, B barré)
const Coin: React.FC<{ readonly size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible", filter: "drop-shadow(0 14px 18px rgba(80,20,0,0.45))" }}>
    <defs><linearGradient id="coin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFD27A" /><stop offset="1" stopColor="#F2900F" /></linearGradient></defs>
    <circle cx={50} cy={50} r={48} fill="url(#coin)" stroke="#B86608" strokeWidth={3} />
    <circle cx={50} cy={50} r={39} fill="none" stroke="#FFF1CC" strokeWidth={2.5} opacity={0.85} />
    <g fill="none" stroke="#8A4A05" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M41 28 V72 M41 28 H55 Q66 28 66 38 Q66 48 55 48 H41 M41 48 H58 Q70 48 70 60 Q70 72 58 72 H41" />
      <path d="M48 20 V28 M58 20 V28 M48 72 V80 M58 72 V80" strokeWidth={5} />
    </g>
  </svg>
);

// --- S15 : « Et voici Sami. Dix-neuf ans. Il a acheté du bitcoin... un peu vite. » ---------------------------------------------
export const S15: React.FC = () => {
  const f = useAbs();
  const tSami = W("L15", "Sami"), tBtc = W("L15", "bitcoin"), tVite = W("L15", "vite"), tUn = W("L15", "un");
  // la pièce tombe sur « bitcoin », rebondit une fois
  const fall = clamp((f - tBtc) / 11, 0, 1);
  const bounce = f > tBtc + 11 ? Math.abs(Math.sin(clamp((f - tBtc - 11) / 9, 0, 1) * Math.PI)) * 34 * (1 - clamp((f - tBtc - 11) / 9, 0, 1)) : 0;
  const coinY = lerp(-260, 690, fall * fall) - bounce;
  // la courbe rouge monte un peu, puis plonge sur « vite »
  const pts = [[330, 780], [400, 752], [470, 720], [540, 690], [610, 668], [670, 676], [730, 730], [790, 800], [850, 830], [910, 880], [1010, 905]] as const;
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  const draw = ramp(f, tUn, tVite + 12, [0, 1], Easing01);
  const shake = f === tVite || f === tVite + 1 ? (f === tVite ? 1 : -1) : 0;
  return (
    <World color={ORANGE}>
      <div style={{ position: "absolute", inset: 0, background: BG, transform: `translate(${shake * 11}px, ${shake * -7}px)` }}>
        <Character name="sami" cx={1450} cy={430} d={700} at={tSami} disc="rgba(255,255,255,0.2)" />
        <Label text="Et voici" at={W("L15", "voici")} size={56} style={{ position: "absolute", left: 100, top: 96 }} />
        <div style={{ position: "absolute", left: 90, top: 138 }}>
          <Kinetic toks={[{ t: "Sami", at: tSami }]} size={330} shadow="0 8px 40px rgba(110,30,0,0.28)" />
        </div>
        <div style={{ position: "absolute", left: 96, top: 456 }}>
          <Pill text="19 ans" at={W("L15", "Dix-neuf")} color="#C9480A" size={72} />
        </div>
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
          <line x1={96} y1={930} x2={1060} y2={930} stroke="rgba(255,255,255,0.45)" strokeWidth={3} opacity={ramp(f, tBtc, tBtc + 10)} />
          <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} fill="none" stroke="#fff" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" opacity={draw > 0 ? 0.5 : 0} />
          <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} fill="none" stroke={COLORS.down} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" opacity={draw > 0 ? 1 : 0} />
        </svg>
        <div style={{ position: "absolute", left: 330 - 95, top: coinY - 95, opacity: f >= tBtc ? 1 : 0 }}>
          <Coin size={190} />
        </div>
      </div>
    </World>
  );
};
const Easing01 = (t: number) => t * t * (3 - 2 * t);

// --- S16 : « Lui, il apprend enfin le vocabulaire, » Un tableau à palettes qui défile sur les temps ---------------------------------
const WORDS16 = ["PER", "ETF", "Dividende", "Volatilité", "Obligation"];
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SplitFlap: React.FC<{ readonly at: number }> = ({ at }) => {
  const f = useAbs();
  const idx = clamp(Math.floor((f - at) / 15), 0, WORDS16.length - 1);
  const word = WORDS16[idx].toUpperCase();
  const t0 = at + idx * 15;
  const CELLS = 10, cw = 118, ch = 168, gap = 10;
  const total = CELLS * (cw + gap) - gap;
  const off = Math.floor((CELLS - word.length) / 2);
  return (
    <div style={{ position: "absolute", left: 960 - total / 2, top: 250, display: "flex", gap, padding: 22, margin: -22, borderRadius: 30, background: "#0C0F18", boxShadow: "0 40px 80px -30px rgba(80,20,0,0.6)" }}>
      {Array.from({ length: CELLS }, (_, i) => {
        const target = i >= off && i < off + word.length ? word[i - off] : " ";
        const settle = t0 + 4 + i * 0.5;
        const flipping = f < settle && idx >= 0 && (f >= t0 || idx === 0 && f < at + 4);
        const prevWord = idx > 0 ? WORDS16[idx - 1].toUpperCase() : "";
        const prevOff = Math.floor((CELLS - prevWord.length) / 2);
        const prev = idx > 0 && i >= prevOff && i < prevOff + prevWord.length ? prevWord[i - prevOff] : " ";
        const shown = f < at ? " " : flipping ? (prev === " " && target === " " ? " " : ALPHA[Math.floor(rnd(`sf${i}-${f}`) * 26)]) : target;
        const dip = flipping ? 0.55 + 0.45 * Math.abs(Math.cos((f - t0) * 1.4)) : 1;
        return (
          <div key={i} style={{ position: "relative", width: cw, height: ch, borderRadius: 14, background: "linear-gradient(180deg, #1c2130 0%, #1c2130 49%, #10131c 51%, #161a26 100%)", overflow: "hidden", fontFamily: display, fontWeight: 900, fontSize: 132, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: "-0.03em" }}>
            <span style={{ display: "inline-block", scale: `1 ${dip}`, lineHeight: 1 }}>{shown === " " ? "" : shown}</span>
            <div style={{ position: "absolute", left: 0, right: 0, top: ch / 2 - 2, height: 4, background: "#06080e" }} />
          </div>
        );
      })}
    </div>
  );
};

export const S16: React.FC = () => {
  const f = useAbs();
  const p = ramp(f, 1320, 1336);
  return (
    <World color={ORANGE}>
      <div style={{ position: "absolute", inset: 0, background: BG }}>
        <SmallSami at={0} />
        <SplitFlap at={1320} />
        <div style={{ position: "absolute", left: 560, top: 520, width: 800, height: 400, borderRadius: 28, overflow: "hidden", background: COLORS.night, boxShadow: "0 40px 80px -30px rgba(80,20,0,0.6)", opacity: p, translate: `0 ${(1 - p) * 60}px` }}>
          <div style={{ position: "absolute", left: -(1920 - 800) / 2 - 20, top: -(1080 - 400) / 2 - 20, width: 1920, height: 1080, scale: "0.78" }}>
            <Model name="books" />
          </div>
          <div style={{ position: "absolute", left: 28, bottom: 22, fontFamily: sans, fontWeight: 600, fontSize: 34, color: COLORS.ink }}>Glossaire</div>
        </div>
      </div>
    </World>
  );
};

// --- S17 : « et voit ce que cent euros par mois deviennent en dix ans. » Dix barres qui montent de plus en plus vite -------------
const rate = 0.06 / 12;
const fv = (years: number) => 100 * ((Math.pow(1 + rate, 12 * years) - 1) / rate);  // illustratif : aucun montant final n'est affiché
const INTERVALS = [0, 15, 14, 12, 11, 10, 9, 8, 7, 6];
const BAR_AT = INTERVALS.reduce<number[]>((acc, d) => [...acc, (acc.length ? acc[acc.length - 1] : 1395) + d], []);
export const S17: React.FC = () => {
  const f = useAbs();
  const BW = 80, GAP = 26, X0 = 760, BASE = 810, MAXH = 580;
  const full = fv(10);
  const tCent = W("L17", "cent"), tDeviennent = W("L17", "deviennent"), tDix = W("L17", "dix"), tAns = W("L17", "ans");
  return (
    <World color={ORANGE}>
      <div style={{ position: "absolute", inset: 0, background: BG }}>
        <SmallSami at={0} />
        <div style={{ position: "absolute", left: 96, top: 380 }}>
          <Kinetic toks={[{ t: "100 €", at: tCent }, { t: "par mois", at: tCent + 8, br: true }]} size={118} />
        </div>
        <div style={{ position: "absolute", left: 96, top: 660, opacity: ramp(f, tDeviennent, tDeviennent + 10), translate: `0 ${(1 - ramp(f, tDeviennent, tDeviennent + 10)) * 30}px` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: display, fontWeight: 900, fontSize: 56, letterSpacing: "-0.03em", color: "#fff" }}>
            <span style={{ width: 34, height: 34, borderRadius: 8, background: "#fff", display: "inline-block" }} />12 000 € versés
          </div>
        </div>
        <div style={{ position: "absolute", left: 96, top: 750, opacity: ramp(f, tAns, tAns + 10), translate: `0 ${(1 - ramp(f, tAns, tAns + 10)) * 30}px` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: display, fontWeight: 900, fontSize: 56, letterSpacing: "-0.03em", color: "#fff" }}>
            <span style={{ width: 34, height: 34, borderRadius: 8, background: COLORS.brand, display: "inline-block" }} />+ les intérêts composés
          </div>
        </div>
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
          <line x1={X0 - 16} y1={BASE + 2} x2={X0 + 10 * (BW + GAP) - GAP + 16} y2={BASE + 2} stroke="rgba(255,255,255,0.6)" strokeWidth={4} strokeLinecap="round" />
          {BAR_AT.map((at, k) => {
            const p = ramp(f, at, at + 11);
            const total = (fv(k + 1) / full) * MAXH * p, paid = ((1200 * (k + 1)) / full) * MAXH * p;
            const x = X0 + k * (BW + GAP);
            return (
              <g key={k}>
                <rect x={x} y={BASE - paid} width={BW} height={paid} rx={6} fill="#fff" />
                <rect x={x} y={BASE - total} width={BW} height={Math.max(0, total - paid)} rx={6} fill={COLORS.brand} />
              </g>
            );
          })}
          {f >= tDix ? (
            <g opacity={ramp(f, tDix, tDix + 8)}>
              <path d={`M${X0} ${BASE + 30} v16 H${X0 + 10 * (BW + GAP) - GAP} v-16`} fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ) : null}
        </svg>
        <div style={{ position: "absolute", left: X0, width: 10 * (BW + GAP) - GAP, top: BASE + 56, textAlign: "center", fontFamily: display, fontWeight: 900, fontSize: 64, letterSpacing: "-0.03em", color: "#fff", opacity: ramp(f, tDix, tDix + 10) }}>10 ans</div>
      </div>
    </World>
  );
};
