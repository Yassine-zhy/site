// Scène « Les marchés » (temps 28 - 44) : la séance du CAC 40 en direct (courbe, compteur, bandeaux de cotations), puis la
// carte du CAC 40 valeur par valeur (40 tuiles qui se retournent en vague, puis qui changent de valeur à chaque temps).
// Visible de b(27.5) à b(44.5) ; le montage fait l'entrée (zoom) et la sortie (glissé).
import React from "react";
import { Easing, useCurrentFrame } from "remotion";
import { BEAT, C, CAM, Halo, H, LIN, Sparks, Title, W, b, clamp, display, glass, lerp, mix, mixHex, num, pop, ramp, rgba, rnd, sans } from "../kit";

const NN = " ";  // espace fine insécable
const pct = (v: number, d = 2) => `${v > 0 ? "+" : ""}${num(v, d)}${NN}%`;
const T0 = b(27.5), PART2 = b(36), T1 = b(44.5);

// --- La séance : une série de prix (plausible, qui finit à 7 838,49) -----------------------------------------------------------
const N = 140, PREV = 7790.19, LAST = 7838.49, PMIN = 7772, PMAX = 7850;
const X0 = 140, X1 = 1780, YB = 920, YT = 560;
const ANCH: readonly (readonly [number, number])[] = [
  [0, PREV], [0.07, 7797], [0.15, 7783], [0.26, 7792], [0.37, 7812], [0.46, 7805], [0.57, 7821], [0.67, 7829], [0.77, 7846], [0.86, 7835], [1, LAST],
];
const base = (t: number) => {
  let i = 0;
  while (i < ANCH.length - 2 && ANCH[i + 1][0] <= t) i++;
  const [t0, v0] = ANCH[i], [t1, v1] = ANCH[i + 1];
  return lerp(v0, v1, (1 - Math.cos(Math.PI * clamp((t - t0) / (t1 - t0), 0, 1))) / 2);
};
const noisy = Array.from({ length: N }, (_, i) => base(i / (N - 1)) + (rnd(`cac${i}`) - 0.5) * 6 * Math.sin(Math.PI * (i / (N - 1))));
const S = noisy.map((v, i) => (i === 0 || i === N - 1 ? v : (noisy[i - 1] + 2 * v + noisy[i + 1]) / 4));
S[0] = PREV;
S[N - 1] = LAST;
const priceAt = (p: number) => {
  const x = p * (N - 1), i = Math.min(N - 2, Math.floor(x));
  return lerp(S[i], S[i + 1], x - i);
};
const yOf = (v: number) => YB - ((v - PMIN) / (PMAX - PMIN)) * (YB - YT);
const xOf = (p: number) => X0 + p * (X1 - X0);
const DRAW = Easing.bezier(0.3, 0, 0.35, 1);
const STEPS = [3.6, 3.3, -1.6, 5.2, 2.5];  // les hausses et baisses de l’indice, à chaque temps de b(39) à b(43)
const HOURS: readonly (readonly [string, number])[] = [["9 h", 0], ["11 h", 120], ["13 h", 240], ["15 h", 360], ["17 h 30", 510]]
  .map(([t, m]) => [(t as string).replace(" ", NN), m as number] as const);

// Le cours affiché : suit la courbe, puis vit (petits ticks) et monte par à-coups pendant la carte
const livePrice = (f: number) => {
  const p = ramp(f, b(28.5), b(33), 0, 1, DRAW);
  let v = priceAt(p);
  v += ramp(f, b(33.5), b(34.5)) * 0.9 * (Math.sin(f / 9) * 0.6 + Math.sin(f / 4.7 + 1) * 0.4);
  STEPS.forEach((s, k) => { v += s * ramp(f, b(39 + k), b(39 + k) + 12); });
  return v;
};

// --- Les cotations des bandeaux ---------------------------------------------------------------------------------------------------
type Quote = { readonly n: string; readonly l: string; readonly v: number };
const QUOTES: readonly Quote[] = [
  { n: "CAC 40", l: num(7838.49, 2), v: 0.62 }, { n: "DAX", l: num(25304), v: 0.41 }, { n: "FTSE 100", l: num(10733), v: 0.28 },
  { n: "Euro Stoxx 50", l: num(6121.66, 2), v: 0.55 }, { n: "S&P 500", l: num(6712), v: 0.33 }, { n: "Nasdaq", l: num(26425), v: 0.71 },
  { n: "Nikkei 225", l: num(64621), v: -0.18 }, { n: "EUR/USD", l: num(1.1225, 4), v: 0.12 },
  { n: "Or", l: `${num(4132.9, 2)}${NN}$`, v: 0.44 }, { n: "Bitcoin", l: `${num(108400)}${NN}$`, v: -0.36 },
];
const ITEM_W = 520, PERIOD = ITEM_W * QUOTES.length;

const Band: React.FC<{
  readonly f: number; readonly y: number; readonly angle: number; readonly dir: 1 | -1; readonly speed: number; readonly shift: number; readonly exit: number;
}> = ({ f, y, angle, dir, speed, shift, exit }) => {
  const x = (f * speed + shift * ITEM_W) % PERIOD;
  const items = [...QUOTES.slice(shift % QUOTES.length), ...QUOTES.slice(0, shift % QUOTES.length)];
  // Deux fois la série pour que la boucle soit sans coupure
  return (
    <div style={{
      position: "absolute", left: 960 - 1500, top: y - 32 + exit * dir * -260 + Math.sin(f / 50 + shift) * 6, width: 3000, height: 64, borderRadius: 32, overflow: "hidden",
      rotate: `${angle}deg`, opacity: 0.94 * (1 - exit), filter: exit > 0.01 ? `blur(${exit * 16}px)` : undefined,
      maskImage: "linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent)",
      ...glass(1.5, 14, "#ffffff"),
    }}>
      <div style={{ display: "flex", height: "100%", translate: `${dir === -1 ? -x : x - PERIOD}px 0` }}>
        {[0, 1].flatMap((r) => items.map((q, i) => (
          <div key={`${r}${i}`} style={{ width: ITEM_W, flex: "none", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", columnGap: 16, fontFamily: sans, fontWeight: 600, fontSize: 28, whiteSpace: "nowrap" }}>
            <span style={{ color: C.ink }}>{q.n}</span>
            <span style={{ color: C.muted, fontWeight: 500 }}>{q.l}</span>
            <span style={{ color: q.v >= 0 ? C.up : C.down }}>{pct(q.v)}</span>
            <span style={{ position: "absolute", right: 0, top: 18, bottom: 18, width: 1.5, background: C.line }} />
          </div>
        )))}
      </div>
    </div>
  );
};

// --- La carte du CAC 40 ------------------------------------------------------------------------------------------------------------
const NAMES = [
  "LVMH", "L’Oréal", "Hermès", "TotalEnergies", "Sanofi", "Airbus", "Schneider", "Air Liquide",
  "BNP Paribas", "AXA", "Safran", "Essilor\nLuxottica", "Vinci", "Kering", "Société Générale", "Crédit Agricole",
  "Danone", "Capgemini", "Orange", "Bouygues", "Engie", "Pernod Ricard", "Saint-Gobain", "Stellantis",
  "Thales", "Michelin", "Publicis", "Veolia", "Legrand", "Dassault Systèmes", "STMicro", "ArcelorMittal",
  "Renault", "Eurofins", "Unibail", "Teleperformance", "Accor", "Carrefour", "Bureau Veritas", "Edenred",
];
const VARS = [
  0.74, 0.41, 0.88, 0.19, -0.32, 0.95, 0.67, 0.28,
  0.54, 0.36, 0.81, 0.47, 0.23, -0.61, 1.12, 0.69,
  0.15, 1.34, 0.22, -0.18, 0.31, -0.44, 0.78, 1.58,
  0.62, 0.39, 0.86, 0.12, 0.57, -0.27, 1.76, 0.93,
  0.71, 0.46, 0.35, -0.83, 0.64, 0.09, 0.52, 0.25,
];
// Les changements de valeur : à chaque temps de b(39) à b(43), deux ou trois tuiles
type Ev = { readonly at: number; readonly from: number; readonly to: number };
const EVENTS: Ev[][] = VARS.map(() => []);
{
  const cur = [...VARS];
  for (let k = 39; k <= 43; k++) {
    const used = new Set<number>();
    for (let j = 0; j < (k % 2 ? 3 : 2); j++) {
      let i = Math.floor(rnd(`ev${k}_${j}`) * 40);
      while (used.has(i)) i = (i + 1) % 40;
      used.add(i);
      const mag = 0.35 + rnd(`mg${k}_${j}`) * 1.2;
      let to = Math.round((rnd(`sg${k}_${j}`) < 0.7 ? mag : -mag * 0.7) * 100) / 100;
      if (Math.abs(to - cur[i]) < 0.4) to = -to;
      EVENTS[i].push({ at: b(k) + j * 5, from: cur[i], to });
      cur[i] = to;
    }
  }
}
const COLS = 8, TW = 196, TH = 112, GAP = 10, GX = (W - (COLS * TW + (COLS - 1) * GAP)) / 2, GY = 340;
const DARK = "#10131b";
const nameStyle = (n: string): React.CSSProperties => {
  const wrap = n.includes(" ") && n.length > 13;
  return { fontSize: n.includes("\n") || wrap ? 22 : n.length > 14 ? 20 : 22, whiteSpace: n.includes("\n") ? "pre-line" : wrap ? "normal" : "nowrap" };
};
const Tile: React.FC<{ readonly f: number; readonly i: number }> = ({ f, i }) => {
  const col = i % COLS, row = Math.floor(i / COLS);
  const p = ramp(f, PART2 + ((col + row) / 11) * 35, PART2 + ((col + row) / 11) * 35 + 22);
  if (p <= 0) return null;
  let v = VARS[i], fl = 0;
  for (const e of EVENTS[i]) {
    if (f >= e.at) { v = lerp(e.from, e.to, ramp(f, e.at, e.at + 16)); fl = 1 - ramp(f, e.at, e.at + 26); }
  }
  const tint = mixHex(C.down, C.up, (clamp(v / 0.08, -1, 1) + 1) / 2);
  const a = 0.2 + 0.4 * clamp(Math.abs(v) / 1.8, 0, 1);
  const bob = Math.sin(f / 50 + col * 0.5 + row * 0.8) * 2.5;
  return (
    <div style={{
      position: "absolute", left: GX + col * (TW + GAP), top: GY + row * (TH + GAP), width: TW, height: TH, borderRadius: 18, boxSizing: "border-box",
      transform: `translateY(${bob}px) perspective(800px) rotateX(${(1 - p) * 90}deg) scale(${1 + 0.06 * fl})`, opacity: clamp(p * 3, 0, 1),
      background: `linear-gradient(160deg, ${mix(DARK, tint, a + 0.1)}, ${mix(DARK, tint, a - 0.06)})`,
      border: `1.5px solid rgba(255,255,255,${0.14 + 0.4 * fl})`,
      boxShadow: `0 0 ${10 + 36 * fl}px ${rgba(tint, 0.14 + 0.55 * fl)}, 0 18px 30px -18px rgba(0,0,0,0.9)`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", rowGap: 6, padding: "0 8px", textAlign: "center",
    }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 16, background: "#ffffff", opacity: (1 - p) * 0.5 + fl * 0.16 }} />
      <div style={{ position: "relative", fontFamily: sans, fontWeight: 600, lineHeight: 1.05, color: C.ink, ...nameStyle(NAMES[i]) }}>{NAMES[i]}</div>
      <div style={{ position: "relative", fontFamily: sans, fontWeight: 600, fontSize: 22, color: "rgba(255,255,255,0.92)", fontVariantNumeric: "tabular-nums" }}>{pct(v)}</div>
    </div>
  );
};

export const Marches: React.FC = () => {
  const f = useCurrentFrame();
  if (f < T0 || f > T1) return null;

  const p = ramp(f, b(28.5), b(33), 0, 1, DRAW);
  const price = livePrice(f);
  const headX = xOf(p), headY = yOf(price);
  const ph = (f / BEAT) % 1;

  // Chemin de la courbe jusqu’à la tête
  const pts: (readonly [number, number])[] = [];
  const kmax = Math.floor(p * (N - 1));
  for (let i = 0; i <= kmax; i++) pts.push([xOf(i / (N - 1)), yOf(S[i])]);
  if (p * (N - 1) > kmax) pts.push([headX, headY]); else if (pts.length) pts[pts.length - 1] = [headX, headY];
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const area = `${line}L${headX.toFixed(1)} ${YB}L${X0} ${YB}Z`;

  // La caméra : dérive lente, puis poussée sur la carte
  const cam = 1 + 0.01 * ramp(f, T0, PART2, 0, 1, LIN) + 0.04 * ramp(f, PART2, T1, 0, 1, LIN);
  const chartOut = ramp(f, b(35.6), b(36.9), 0, 1, CAM);
  const bandOut = ramp(f, b(35.3), b(36.4), 0, 1, CAM);
  const counterIn = ramp(f, b(29.2), b(30.4));
  const shrink = ramp(f, PART2, b(37.3), 0, 1, CAM);
  const cs = lerp(1, 0.8, shrink);
  const pill = pop(f, b(30));
  const vari = (price / PREV - 1) * 100;

  return (
    <div style={{ position: "absolute", inset: 0, transform: `scale(${cam}) translateX(${-ramp(f, T0, T1, 0, 14, LIN)}px)` }}>
      {/* Lueurs et poussières de lumière */}
      <Halo x={960} y={760} r={760} color={C.up} a={0.1 * (1 - chartOut)} />
      <Halo x={960} y={640} r={900} color={C.brand} a={0.13 * ramp(f, PART2, b(38))} />
      <div style={{ position: "absolute", inset: 0, opacity: 1 - ramp(f, b(35.5), b(37)) }}><Sparks f={f} n={36} seed="mk" color={C.up} a={0.55} /></div>
      <div style={{ position: "absolute", inset: 0, opacity: ramp(f, b(36.5), b(38.5)) }}><Sparks f={f} n={36} seed="mb" color={C.brand} a={0.5} /></div>

      {/* Les deux bandeaux de cotations, en diagonale, derrière la courbe */}
      {f < b(37) && (
        <>
          <Band f={f} y={395} angle={-5} dir={-1} speed={5.2} shift={0} exit={bandOut} />
          <Band f={f} y={470} angle={4} dir={1} speed={4.2} shift={4} exit={bandOut} />
        </>
      )}

      {/* La courbe de séance */}
      {f < b(37.5) && (
        <div style={{ position: "absolute", inset: 0, translate: `0 ${chartOut * 240}px`, opacity: 1 - chartOut, filter: chartOut > 0.01 ? `blur(${chartOut * 14}px)` : undefined, transformOrigin: "50% 100%", scale: `1 ${1 - 0.35 * chartOut}` }}>
          <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <defs>
              <linearGradient id="mkArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={C.up} stopOpacity="0.34" /><stop offset="1" stopColor={C.up} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={X0} x2={X1} y1={YT + i * 90} y2={YT + i * 90} stroke="#fff" strokeOpacity={i === 4 ? 0.16 : 0.06} strokeWidth={1.5} />)}
            {HOURS.map(([t, m]) => {
              const x = X0 + (m / 510) * (X1 - X0), vis = clamp((headX - x + 50) / 70, 0, 1);
              return (
                <g key={t} opacity={0.35 + 0.65 * vis}>
                  <line x1={x} x2={x} y1={YT} y2={YB} stroke="#fff" strokeOpacity={0.05} strokeWidth={1.5} />
                  <text x={x} y={YB + 46} fill={C.muted} fontFamily={sans} fontWeight={500} fontSize={26} textAnchor={m === 510 ? "end" : "middle"} dx={m === 510 ? 10 : 0}>{t}</text>
                </g>
              );
            })}
            {/* Le cours de clôture de la veille */}
            <line x1={X0} x2={X1} y1={yOf(PREV)} y2={yOf(PREV)} stroke={C.amber} strokeOpacity={0.35} strokeWidth={2} strokeDasharray="4 12" strokeDashoffset={-f * 0.6} strokeLinecap="round" />
            {p > 0.002 && (
              <>
                <path d={area} fill="url(#mkArea)" />
                <path d={line} fill="none" stroke={C.up} strokeOpacity={0.12} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
                <path d={line} fill="none" stroke={C.up} strokeOpacity={0.25} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
                <path d={line} fill="none" stroke={C.up} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                <line x1={headX} x2={headX} y1={headY} y2={YB} stroke={C.up} strokeOpacity={0.3} strokeWidth={2} strokeDasharray="3 8" />
                <circle cx={headX} cy={headY} r={14 + 34 * ph} fill="none" stroke={C.up} strokeOpacity={0.55 * (1 - ph)} strokeWidth={3} />
                <circle cx={headX} cy={headY} r={20 + 4 * Math.sin(f / 9)} fill={C.up} fillOpacity={0.2} />
                <circle cx={headX} cy={headY} r={10} fill={C.up} />
                <circle cx={headX} cy={headY} r={4.5} fill="#fff" />
              </>
            )}
          </svg>
          <Halo x={headX} y={headY} r={190} color={C.up} a={0.3 + 0.1 * Math.sin(f / 9)} />
        </div>
      )}

      {/* Les titres */}
      <div style={{ position: "absolute", left: 110, top: 95 }}>
        {f < b(36.8) && (
          <Title f={f} size={120} out={b(35.6)} words={[
            { t: "Les", at: b(28.5) }, { t: "marchés,", at: b(28.5) + 3 },
            { t: "en", at: b(29), br: true }, { t: "direct.", at: b(29) + 3, color: C.up },
          ]} />
        )}
      </div>
      <div style={{ position: "absolute", left: 110, top: 95 }}>
        {f >= b(36.3) && (
          <Title f={f} size={112} words={[
            { t: "Le", at: b(36.5) }, { t: "CAC", at: b(36.5) + 3 }, { t: "40,", at: b(36.5) + 6 },
            { t: "valeur", at: b(37), br: true }, { t: "par", at: b(37) + 3 }, { t: "valeur.", at: b(37) + 6, color: C.brand },
          ]} />
        )}
      </div>

      {/* Le compteur du CAC 40 : gros, puis il rapetisse en haut à droite et continue de vivre */}
      <div style={{
        position: "absolute", right: 90, top: 100, textAlign: "right", transformOrigin: "100% 0", scale: String(cs),
        opacity: clamp(counterIn * 1.4, 0, 1), translate: `0 ${(1 - counterIn) * 40}px`, filter: counterIn < 0.999 ? `blur(${(1 - counterIn) * 16}px)` : undefined,
      }}>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", columnGap: 20 }}>
          <div style={{
            transform: `scale(${pill})`, opacity: clamp(pill * 2, 0, 1), fontFamily: sans, fontWeight: 600, fontSize: 34, color: C.up, padding: "6px 22px", borderRadius: 999,
            background: rgba(C.up, 0.16), border: `1.5px solid ${rgba(C.up, 0.55)}`, boxShadow: `0 0 ${24 + 14 * Math.sin(f / 9)}px ${rgba(C.up, 0.3)}`,
          }}>{pct(Math.max(vari, 0))}</div>
          <div style={{ display: "flex", alignItems: "center", columnGap: 14, fontFamily: sans, fontWeight: 600, fontSize: 34, color: C.muted }}>
            <span style={{ width: 14, height: 14, borderRadius: 7, background: C.dot, boxShadow: `0 0 ${10 + 12 * (1 - ph)}px ${C.dot}` }} />CAC 40
          </div>
        </div>
        <div style={{
          fontFamily: display, fontWeight: 800, fontSize: 100, letterSpacing: "-0.03em", lineHeight: 1.05, color: C.ink,
          textShadow: `0 0 44px ${rgba(C.up, 0.3)}`, marginTop: 6,
        }}>{num(price, 2).split(NN).map((t, i) => <span key={i} style={{ marginLeft: i ? "0.2em" : 0 }}>{t}</span>)}</div>
      </div>

      {/* La carte du CAC 40 */}
      {f >= PART2 && (
        <div style={{ position: "absolute", inset: 0 }}>
          {NAMES.map((_, i) => <Tile key={i} f={f} i={i} />)}
          {/* Un reflet qui passe sur la carte */}
          <div style={{ position: "absolute", left: GX, top: GY, width: COLS * TW + (COLS - 1) * GAP, height: 5 * TH + 4 * GAP, overflow: "hidden", borderRadius: 18, pointerEvents: "none" }}>
            {[[b(38.3), b(40.6)], [b(41.4), b(43.9)]].map(([a, z], k) => (
              <div key={k} style={{
                position: "absolute", top: -200, height: 900, width: 360, rotate: "18deg", mixBlendMode: "screen",
                left: lerp(-500, 1900, ramp(f, a, z, 0, 1, Easing.inOut(Easing.quad))), opacity: f >= a && f <= z ? 1 : 0,
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
              }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
