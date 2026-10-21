// La scène « Tes outils » (temps 55,5 - 72,5) : une question et sa réponse sourcée, les alertes de cours, le portefeuille
// d’entraînement. Trois sous-parties enchaînées sans coupe : le champ et la carte glissent vers le haut pendant que la
// cloche monte ; le carré de la cloche devient le cercle de l’anneau pendant que les notifications partent à droite.
import React from "react";
import { useCurrentFrame } from "remotion";
import {
  At, C, CAM, Glyph, Halo, IN, LIN, LogoMark, OUT, Sparks, Title, b, clamp, display, glass, lerp, mix, mixHex, num, pop, ramp, rgba, sans,
} from "../kit";

const FINE = " ";  // espace fine insécable
const QUESTION = `Pourquoi l’or monte-t-il${FINE}?`;
const BLUE_FILL = ["#141a2e", "#0b0e19"] as const;
const AMBER_FILL = ["#221b10", "#100d08"] as const;
const TEAL = "#3DD6C6";
const SMOOTH = { WebkitFontSmoothing: "antialiased", whiteSpace: "nowrap" } as const;

// Entrée (p : 0 → 1, mise au point) et sortie (k : 0 → 1, vers le haut en se floutant) d’un élément
const fx = (p: number, k = 0, px = 16): React.CSSProperties => ({
  opacity: clamp(p * 1.4, 0, 1) * clamp(1 - k * 1.3, 0, 1),
  filter: p >= 0.999 && k <= 0.001 ? undefined : `blur(${(1 - clamp(p, 0, 1)) * px + k * 18}px)`,
});

// Un sous-titre : monte en se mettant au point, repart vers le haut
const Sub: React.FC<{ readonly f: number; readonly at: number; readonly top: number; readonly out?: number; readonly size?: number; readonly children: React.ReactNode }> = ({
  f, at, top, out, size = 40, children,
}) => {
  const p = ramp(f, at, at + 20), k = out === undefined ? 0 : ramp(f, out, out + 14, 0, 1, IN);
  return (
    <div style={{ position: "absolute", left: 110, top, fontFamily: sans, fontWeight: 500, fontSize: size, color: C.muted, translate: `0 ${(1 - p) * 20 - k * 40}px`, ...fx(p, k, 10), ...SMOOTH }}>
      {children}
    </div>
  );
};

// --- 1. La question ------------------------------------------------------------------------------------------------------------
const SOURCES = ["BFM Bourse", "Le Monde Économie", "CNBC Marchés"];
const BAR_W = [1, 0.9, 0.6];  // longueur des lignes en chargement, en part de la largeur utile
const MAX_BAR = 940;

const Question: React.FC<{ readonly f: number }> = ({ f }) => {
  const k = ramp(f, b(62), b(62.75), 0, 1, CAM);  // la partie remonte et se floute
  if (k >= 1) return null;
  const cam = ramp(f, b(56), b(62), 0, 1, LIN);  // dérive de caméra : un lent zoom

  // Le champ
  const fp = ramp(f, b(55.8), b(56.5)), fs = pop(f, b(55.8));
  const n = Math.round(ramp(f, b(57), b(59), 0, QUESTION.length, LIN));
  const typing = f > b(57) && f < b(59.1);
  const blink = typing || Math.floor(f / 20) % 2 === 0 ? 1 : 0.1;
  const cursor = blink * (1 - ramp(f, b(59.5), b(60)));
  const keyIn = pop(f, b(58.6));
  const press = ramp(f, b(59.25), b(59.25) + 4) * (1 - ramp(f, b(59.25) + 7, b(59.25) + 18));
  const flash = f < b(59.25) ? 0 : Math.exp(-(f - b(59.25)) / 16);

  // La carte de réponse
  const cp = ramp(f, b(59.5), b(60.2)), cs = pop(f, b(59.5), 15, 150);
  const reveal = ramp(f, b(59.65), b(60.4));

  return (
    <div style={{ position: "absolute", inset: 0, transformOrigin: "50% 55%", scale: String(lerp(1, 1.035, cam)) }}>
      <Halo x={960} y={560} r={620} color={C.brand} a={(0.12 + 0.05 * Math.sin(f / 30) + 0.22 * flash) * ramp(f, b(55.5), b(57)) * (1 - k)} />

      {/* Le champ de recherche */}
      <At x={960} y={520 - k * 380} style={{
        width: 1100, height: 112, borderRadius: 56, display: "flex", alignItems: "center", padding: "0 30px 0 44px", gap: 26,
        scale: String(lerp(0.9, 1, fs) * (1 + 0.012 * flash)), translate: `-50% calc(-50% + ${(1 - fs) * 50}px)`, ...fx(fp, k, 20), ...glass(2.5, 28 + 30 * flash, C.brand, BLUE_FILL),
      }}>
        <Glyph name="search" size={52} color={C.brand} stroke={2.2} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", fontFamily: sans, fontWeight: 500, fontSize: 44, color: C.ink, ...SMOOTH }}>
          <span>{QUESTION.slice(0, n)}</span>
          <span style={{ width: 4, height: 52, marginLeft: 5, borderRadius: 2, background: C.brand, boxShadow: `0 0 14px ${C.brand}`, opacity: cursor }} />
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 12, height: 62, padding: "0 22px", borderRadius: 20, fontFamily: sans, fontWeight: 600, fontSize: 26,
          color: mix(C.muted, "#ffffff", press), border: `1.5px solid ${rgba(C.brand, 0.35 + 0.5 * press)}`,
          background: `rgba(109,147,255,${0.1 + 0.4 * press})`, scale: String(lerp(0.7, 1, keyIn) * (1 - 0.1 * press)),
          opacity: clamp(keyIn * 1.5, 0, 1), translate: `0 ${press * 3}px`, ...SMOOTH,
        }}>
          Entrée<span style={{ fontSize: 34, lineHeight: 1 }}>↵</span>
        </div>
      </At>

      {/* La carte de réponse */}
      <At x={960} y={745 - k * 470} style={{
        width: 1100, height: 280, borderRadius: 44, padding: "0 40px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 20,
        translate: `-50% calc(-50% + ${(1 - cs) * 80}px)`, scale: String(lerp(0.94, 1, cs)), ...fx(cp, k, 16), ...glass(2.5, 24, C.brand, BLUE_FILL),
      }}>
        <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 32, color: C.ink, clipPath: `inset(-6px ${(1 - reveal) * 100}% -6px 0)`, ...SMOOTH }}>
          D’après les dépêches du moment{FINE}:
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {BAR_W.map((w, i) => {
            const g = ramp(f, b(59.9) + i * 7, b(59.9) + i * 7 + 24);
            const bw = w * MAX_BAR * g;
            const lit = pop(f, b(60.5) + i * 14, 12, 190), litT = clamp(lit, 0, 1);
            const appear = pop(f, b(59.9) + i * 7 + 16, 14, 190);
            const sx = ((f * 8 + i * 210) % (MAX_BAR + 360)) - 180;  // le reflet qui passe
            const since = f - (b(60.5) + i * 14);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 18, height: 38 }}>
                <div style={{ position: "relative", width: bw, height: 22, borderRadius: 11, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: sx, width: 170, height: 22, background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.30), transparent)" }} />
                </div>
                <div style={{
                  position: "relative", width: 38, height: 38, borderRadius: 19, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box",
                  fontFamily: sans, fontWeight: 700, fontSize: 24, color: mix(C.dim, "#ffffff", litT),
                  background: mix("#1c2030", C.brand, litT), border: `2px solid ${mix("#3a4054", C.brand, litT)}`,
                  boxShadow: `0 0 ${22 * litT}px ${rgba(C.brand, 0.8 * litT)}`, opacity: clamp(appear * 1.6, 0, 1), scale: String(lerp(0.4, 1, appear) * (1 + 0.18 * (lit - 1))),
                }}>
                  {i + 1}
                  {since >= 0 && since < 30 && (
                    <span style={{ position: "absolute", inset: -2, borderRadius: "50%", border: `2px solid ${C.brand}`, scale: String(1 + since / 12), opacity: 0.8 * (1 - since / 30) }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </At>

      {/* Les sources */}
      <At x={960} y={945 - k * 520} style={{ display: "flex", gap: 22 }}>
        {SOURCES.map((s, i) => {
          const at = b(60.5) + i * 14;
          const c = pop(f, at, 12, 190), p = ramp(f, at, at + 14);
          return (
            <div key={s} style={{
              display: "flex", alignItems: "center", gap: 14, height: 70, padding: "0 30px 0 13px", borderRadius: 35, fontFamily: sans, fontWeight: 500, fontSize: 30, color: C.ink,
              translate: `0 ${(1 - c) * 44 + (p >= 1 ? Math.sin(f / 30 + i * 1.6) * 3 : 0)}px`, scale: String(lerp(0.7, 1, c)), ...fx(p, k, 12), ...glass(2, 18, "#ffffff", ["#1b1d26", "#11121a"]), ...SMOOTH,
            }}>
              <span style={{ width: 44, height: 44, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", background: C.brand, color: "#fff", fontWeight: 700, fontSize: 25, boxShadow: `0 0 18px ${rgba(C.brand, 0.7)}` }}>
                {i + 1}
              </span>
              {s}
            </div>
          );
        })}
      </At>

      <div style={{ position: "absolute", left: 110 + cam * 8, top: 110 }}>
        <Title f={f} size={120} out={b(62)} words={[{ t: "Pose", at: b(56) }, { t: "ta", at: b(56.5) }, { t: "question.", at: b(56.5) + 4, color: C.brand }]} />
      </div>
      <Sub f={f} at={b(58)} top={252} out={b(62)}>Des réponses, sources à l’appui.</Sub>
    </div>
  );
};

// --- 2. Les alertes -------------------------------------------------------------------------------------------------------------
const Wave: React.FC<{ readonly f: number; readonly at: number; readonly x: number; readonly y: number }> = ({ f, at, x, y }) => {
  const t = (f - at) / 44;
  if (t < 0 || t >= 1) return null;
  const r = ramp(f, at, at + 44, 110, 470);
  return <div style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, boxSizing: "border-box", borderRadius: "50%", border: `${3 - 2 * t}px solid ${C.amber}`, opacity: 0.7 * (1 - t) }} />;
};

const NOTIFS = [
  { at: 63.75, body: `Airbus a franchi 180,00${FINE}€`, id: "n1" },
  { at: 65.75, body: `Bitcoin a dépassé 100${FINE}000${FINE}$`, id: "n2" },
] as const;

const Notifs: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f < b(63.75) - 2 || f > b(67.9)) return null;
  const push = pop(f, b(65.75), 14, 150);
  return (
    <>
      {NOTIFS.map((nf, i) => {
        const c = pop(f, b(nf.at), 12, 150), p = ramp(f, b(nf.at), b(nf.at) + 16);
        const gone = ramp(f, b(67) + i * 4, b(67.6) + i * 4, 0, 1, IN);
        const base = i === 0 ? lerp(565, 685, push) : 535;
        const y = base - (1 - c) * 260 + Math.sin(f / 36 + i * 2) * 4;
        return (
          <At key={nf.id} x={1260 + gone * 900} y={y} style={{
            width: 760, height: 124, borderRadius: 34, display: "flex", alignItems: "center", gap: 24, padding: "0 32px", boxSizing: "border-box",
            scale: String(lerp(0.92, 1, c) * (i === 0 ? lerp(1, 0.97, push) : 1)), opacity: clamp(p * 1.6, 0, 1) * (1 - gone), filter: gone > 0.001 ? `blur(${gone * 16}px)` : p < 1 ? `blur(${(1 - p) * 12}px)` : undefined,
            ...glass(2, 22, "#ffffff", ["#1b1d26", "#11121a"]),
          }}>
            <LogoMark size={64} p={1} id={nf.id} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, fontFamily: sans, ...SMOOTH }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 32, fontWeight: 600, color: C.ink }}>Alerte de cours</span>
                <span style={{ fontSize: 26, fontWeight: 500, color: C.dim }}>maintenant</span>
              </div>
              <span style={{ fontSize: 30, fontWeight: 500, color: C.muted }}>{nf.body}</span>
            </div>
          </At>
        );
      })}
    </>
  );
};

// --- 3. Le portefeuille ---------------------------------------------------------------------------------------------------------
const PARTS = [
  { name: "Actions", share: 55, color: C.brand },
  { name: "ETF", share: 30, color: C.up },
  { name: "Crypto", share: 15, color: TEAL },
] as const;
const X = 1250, R = 165, GAP = 3.2;
const N = 64, CW = 640, CH = 170;  // courbe : nombre de points, largeur et hauteur du tracé

// La valeur du portefeuille au fil de la courbe, u de 0 à 1 (10 000 → 10 842 aux quatre cinquièmes, puis 10 871)
const worth = (u: number) => {
  const trend = u < 0.82 ? 10000 + 842 * Math.pow(u / 0.82, 0.95) : 10842 + 29 * ((u - 0.82) / 0.18);
  return trend + (46 * Math.sin(u * 41) + 28 * Math.sin(u * 17 + 1)) * Math.min(1, u * 5) * (1 - u * 0.5);
};
const PTS = Array.from({ length: N }, (_, i) => {
  const u = i / (N - 1);
  return [u * CW, CH - 14 - ((worth(u) - 9960) / (10930 - 9960)) * (CH - 28)] as const;
});
const LINE = PTS.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

const Portfolio: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f < b(67.3)) return null;
  const draw = ramp(f, b(67.6), b(69), 0, 100, CAM);
  const spin = (f - b(67.5)) * 0.1;
  let start = 0;
  const arcs = PARTS.map((p) => {
    const a = start;
    start += p.share;
    return { ...p, len: clamp(draw - a, 0, p.share - GAP), from: a };
  });

  const v = f < b(69.4) ? ramp(f, b(68), b(69.4), 10000, 10842, OUT) : ramp(f, b(69.4), b(72.5), 10842, 10871, LIN);
  const ct = ramp(f, b(67.9), b(67.9) + 16);
  const gain = pop(f, b(69.3), 11, 200);

  // La carte de la courbe
  const cp = ramp(f, b(69), b(69.8)), cs = pop(f, b(69), 15, 150);
  const g1 = f < b(70.2) ? ramp(f, b(69.3), b(70.2), 0, 0.82, OUT) : ramp(f, b(70.2), b(72.5), 0.82, 1, LIN);
  const pos = g1 * (N - 1), i0 = Math.min(N - 2, Math.floor(pos)), fr = pos - i0;
  const tipX = lerp(PTS[i0][0], PTS[i0 + 1][0], fr), tipY = lerp(PTS[i0][1], PTS[i0 + 1][1], fr);
  const area = `${LINE} L${CW} ${CH} L0 ${CH} Z`;

  return (
    <>
      <div style={{ position: "absolute", left: 110 - (f - b(67)) * 0.04, top: 110 }}>
        <Title f={f} size={120} words={[{ t: "Entraîne-toi", at: b(67.5) }, { t: "sans", at: b(68), br: true }, { t: "risque.", at: b(68) + 4, color: C.up }]} />
      </div>
      <Sub f={f} at={b(69)} top={385} size={38}>Un portefeuille virtuel, de vrais cours.</Sub>

      {/* La carte de la courbe de valeur */}
      <At x={110 + 360} y={690 - (f - b(69)) * 0.02} style={{
        width: 720, height: 300, borderRadius: 40, padding: "28px 40px 0", boxSizing: "border-box",
        translate: `-50% calc(-50% + ${(1 - cs) * 60}px)`, scale: String(lerp(0.94, 1, cs)), ...fx(cp, 0, 16), ...glass(2.5, 24, C.up, ["#12201b", "#0a1310"]),
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: sans, fontWeight: 500, fontSize: 28, marginBottom: 14, ...SMOOTH }}>
          <span style={{ color: C.ink }}>Évolution</span>
          <span style={{ color: C.dim }}>Départ{FINE}: 10{FINE}000{FINE}€</span>
        </div>
        <svg width={CW} height={CH} viewBox={`0 0 ${CW} ${CH}`} style={{ display: "block", overflow: "visible" }}>
          <defs>
            <linearGradient id="oa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.up} stopOpacity={0.34} /><stop offset="1" stopColor={C.up} stopOpacity={0} /></linearGradient>
            <clipPath id="oc"><rect x={0} y={-20} width={tipX} height={CH + 40} /></clipPath>
          </defs>
          <line x1={0} x2={CW} y1={CH - 14 - ((10000 - 9960) / 970) * (CH - 28)} y2={CH - 14 - ((10000 - 9960) / 970) * (CH - 28)} stroke="rgba(255,255,255,0.16)" strokeWidth={2} strokeDasharray="6 8" />
          <g clipPath="url(#oc)">
            <path d={area} fill="url(#oa)" />
            <path d={LINE} fill="none" stroke={C.up} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 8px ${C.up})` }} />
          </g>
          <circle cx={tipX} cy={tipY} r={14 + 3 * Math.sin(f / 7)} fill={C.up} opacity={0.25} />
          <circle cx={tipX} cy={tipY} r={7.5} fill="#fff" />
        </svg>
      </At>

      {/* La légende des trois parts */}
      <At x={X} y={815} style={{ display: "flex", gap: 38 }}>
        {PARTS.map((p, i) => {
          const q = ramp(f, b(68.8) + i * 6, b(68.8) + i * 6 + 14);
          return (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: sans, fontWeight: 500, fontSize: 30, color: C.ink, translate: `0 ${(1 - q) * 18}px`, ...fx(q, 0, 8), ...SMOOTH }}>
              <span style={{ width: 16, height: 16, borderRadius: 8, background: p.color, boxShadow: `0 0 12px ${p.color}` }} />
              {p.name}
              <span style={{ color: C.muted }}>{p.share}{FINE}%</span>
            </div>
          );
        })}
      </At>
      {/* L’anneau et la valeur sont portés par le cercle (voir Hub) ; on leur donne ici leurs données */}
      <RingContent f={f} arcs={arcs} spin={spin} ct={ct} v={v} gain={gain} />
    </>
  );
};

// Le contenu du cercle : l’anneau, la valeur, le gain (placé au centre du cercle, qui se pose en (1250, 540))
const RingContent: React.FC<{
  readonly f: number; readonly arcs: readonly { readonly name: string; readonly color: string; readonly len: number; readonly from: number }[];
  readonly spin: number; readonly ct: number; readonly v: number; readonly gain: number;
}> = ({ f, arcs, spin, ct, v, gain }) => {
  const m = ramp(f, b(67), b(67.75), 0, 1, CAM);
  const cy = lerp(600, 540, m) + Math.sin(f / 40) * 7;
  const ringOp = ramp(f, b(67.45), b(67.9));
  const pct = (v - 10000) / 100;
  return (
    <>
      <At x={X} y={cy} style={{ opacity: ringOp, rotate: `${spin}deg` }}>
        <svg width={400} height={400} viewBox="0 0 400 400" style={{ display: "block", overflow: "visible" }}>
          <circle cx={200} cy={200} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={26} />
          {arcs.map((a) => (
            <circle key={a.name} cx={200} cy={200} r={R} fill="none" stroke={a.color} strokeWidth={26} strokeLinecap="round" pathLength={100}
              strokeDasharray={`${a.len} ${100 - a.len}`} strokeDashoffset={25 - a.from - GAP / 2} opacity={a.len > 0.2 ? 1 : 0}
              style={{ filter: `drop-shadow(0 0 10px ${a.color})` }} />
          ))}
        </svg>
      </At>
      <At x={X} y={cy} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, ...fx(ct, 0, 12) }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 56, letterSpacing: "-0.03em", color: C.ink, ...SMOOTH }}>
          {num(Math.round(v))}{FINE}€
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, fontFamily: sans, fontWeight: 600, fontSize: 30, color: C.up, padding: "6px 18px", borderRadius: 22,
          background: "rgba(52,209,127,0.16)", opacity: clamp(gain * 1.5, 0, 1), scale: String(lerp(0.5, 1, gain)), ...SMOOTH,
        }}>
          <Glyph name="arrowUp" size={22} color={C.up} />
          +{num(pct, 2)}{FINE}%
        </div>
      </At>
    </>
  );
};

// --- La cloche, qui devient le cercle du portefeuille -----------------------------------------------------------------------------
const Hub: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f < b(62)) return null;
  const p = ramp(f, b(62.3), b(63.2));
  const m = ramp(f, b(67), b(67.75), 0, 1, CAM);
  const x = lerp(640, X, m), size = lerp(200, 400, m), radius = lerp(52, 200, m);
  const fy = Math.sin(f / 40) * 7;
  const y = lerp(600, 540, m) + fy + (1 - OUT(p)) * 200;
  const tint = mixHex(C.amber, "#ffffff", m);
  const fill: [string, string] = [mixHex(AMBER_FILL[0], "#181a22", m), mixHex(AMBER_FILL[1], "#0d0e14", m)];

  // La cloche sonne deux fois : rotation amortie, lueur qui flashe
  const ring = (at: number, amp: number) => (f < at ? 0 : amp * Math.sin((2 * Math.PI * (f - at)) / 14) * Math.exp(-(f - at) / 24));
  const angle = ring(b(63.5), 18) + ring(b(65.5), 9);
  const kick = (at: number, amp: number) => (f < at ? 0 : amp * Math.exp(-(f - at) / 20));
  const haloA = (0.16 * p + kick(b(63.5), 0.7) + kick(b(65.5), 0.4)) * (1 - m);
  const bellOut = ramp(f, b(67), b(67.45), 0, 1, IN);

  // La pastille de compte sur la cloche
  const cnt = f < b(65.75) ? 1 : 2;
  const bump = pop(f, cnt === 1 ? b(63.75) : b(65.75), 10, 220);
  const badgeOut = 1 - ramp(f, b(66.9), b(67.3));

  return (
    <>
      <Halo x={640} y={600 + fy} r={400} color={C.amber} a={haloA} />
      <Halo x={X} y={540 + fy} r={lerp(300, 460, m)} color={C.up} a={0.26 * m + 0.05 * m * Math.sin(f / 25)} />
      <Wave f={f} at={b(63.5)} x={640} y={600 + fy} />
      <Wave f={f} at={b(63.5) + 9} x={640} y={600 + fy} />
      <Wave f={f} at={b(65.5)} x={640} y={600 + fy} />
      <At x={x} y={y} style={{
        width: size, height: size, borderRadius: radius, scale: String(lerp(0.8, 1, OUT(p))), ...fx(p, 0, 24), ...glass(2.5, 26 + 26 * m, tint, fill),
      }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 1 - bellOut, scale: String(lerp(1, 0.7, bellOut)) }}>
          <div style={{ transformOrigin: "50% 8%", rotate: `${angle}deg` }}>
            <Glyph name="bell" size={104} stroke={2.2} color="#FFD18A" />
          </div>
        </div>
        {bump > 0 && badgeOut > 0 && (
          <div style={{
            position: "absolute", right: -16, top: -16, width: 54, height: 54, borderRadius: 27, display: "flex", alignItems: "center", justifyContent: "center",
            background: C.down, color: "#fff", fontFamily: sans, fontWeight: 700, fontSize: 32, boxShadow: `0 0 22px ${rgba(C.down, 0.7)}`,
            scale: String(lerp(0.3, 1, bump) * badgeOut), opacity: clamp(bump * 1.5, 0, 1) * badgeOut,
          }}>
            {cnt}
          </div>
        )}
      </At>
    </>
  );
};

export const Outils: React.FC = () => {
  const f = useCurrentFrame();
  if (f < b(55.5) || f > b(72.5)) return null;

  const sparkColor = f < b(65) ? mixHex(C.brand, C.amber, ramp(f, b(62), b(63.5))) : mixHex(C.amber, C.up, ramp(f, b(67), b(68.5)));

  return (
    <>
      <div style={{ opacity: ramp(f, b(55.5), b(56.3)) }}>
        <Sparks f={f} n={46} seed="outils" color={sparkColor} a={0.65} />
      </div>
      <Question f={f} />
      <Hub f={f} />
      <Notifs f={f} />
      {f >= b(62.4) && f <= b(67.4) && (
        <>
          <div style={{ position: "absolute", left: 110 + (f - b(62.5)) * 0.04, top: 110 }}>
            <Title f={f} size={120} out={b(66.9)} words={[{ t: "Reçois", at: b(62.5) }, { t: "tes", at: b(63) }, { t: "alertes.", at: b(63) + 4, color: C.amber }]} />
          </div>
          <Sub f={f} at={b(64)} top={252} out={b(66.9)}>Fixe un seuil, on te prévient.</Sub>
        </>
      )}
      <Portfolio f={f} />
    </>
  );
};
