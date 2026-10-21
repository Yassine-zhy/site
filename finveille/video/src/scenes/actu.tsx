// Scène « L’actu » (temps 11,5 à 28,5) : l’ouverture de l’app projette un mur de dépêches en perspective, qui défile ;
// la ligne du titre tourne de rubrique en rubrique, les sources passent en bandeaux, puis tout se range en un seul fil.
import React from "react";
import { useCurrentFrame } from "remotion";
import {
  C, CAM, Halo, LIN, OUT, IN, Sparks, Title, b, clamp, focus, glass, lerp, mixHex, pop, ramp, rgba, rnd, sans, display,
} from "../kit";

const TEAL = "#3DD6C6";
const F0 = b(11.5), F1 = b(28.5), T_REG = b(24);  // fenêtre de la scène ; début du regroupement

// --- Les rubriques et les dépêches ----------------------------------------------------------------------------------------
const RUB = [
  { name: "Marchés", color: C.brand }, { name: "Économie", color: C.violet },
  { name: "Entreprises", color: C.amber }, { name: "Crypto", color: TEAL },
] as const;
type Dep = { readonly r: number; readonly src: string; readonly title: string; readonly min: number };
const DEPS: readonly Dep[] = [
  { r: 0, src: "BFM Bourse", title: "Le CAC 40 ouvre en hausse, porté par le luxe", min: 2 },
  { r: 0, src: "CNBC Marchés", title: "Wall Street termine dans le vert", min: 14 },
  { r: 0, src: "BFM Bourse", title: "Les valeurs bancaires reprennent des couleurs", min: 27 },
  { r: 0, src: "CNBC Marchés", title: "Le pétrole recule après les stocks américains", min: 41 },
  { r: 0, src: "Nasdaq", title: "Stocks rally as tech leads gains", min: 6 },
  { r: 1, src: "Le Monde Économie", title: "Inflation : ce que disent les derniers chiffres", min: 9 },
  { r: 1, src: "BCE", title: "La BCE publie ses projections économiques", min: 22 },
  { r: 1, src: "Réserve fédérale (Fed)", title: "La Fed publie le compte rendu de sa réunion", min: 35 },
  { r: 1, src: "The Economist", title: "What higher rates mean for borrowers", min: 48 },
  { r: 1, src: "Le Monde Économie", title: "Emploi : le marché du travail ralentit", min: 17 },
  { r: 2, src: "BFM Bourse", title: "LVMH publie ses ventes du trimestre", min: 4 },
  { r: 2, src: "BBC Business", title: "Airbus steps up aircraft deliveries", min: 31 },
  { r: 2, src: "CNBC Entreprises", title: "Résultats : ce qu’il faut retenir cette semaine", min: 12 },
  { r: 2, src: "Le Monde Économie", title: "TotalEnergies : les chiffres clés des résultats", min: 54 },
  { r: 3, src: "CoinDesk", title: "Bitcoin : la volatilité repart à la hausse", min: 3 },
  { r: 3, src: "Cointelegraph", title: "Ethereum : ce qui change avec la mise à jour", min: 19 },
  { r: 3, src: "CoinDesk", title: "Les ETF bitcoin attirent de nouveaux flux", min: 38 },
  { r: 3, src: "Cointelegraph", title: "Stablecoins : la régulation se précise", min: 45 },
];

// --- Le mur : 4 colonnes de 11 cartes qui bouclent, chacune à sa vitesse et à sa profondeur -----------------------------------
const NC = 4, NR = 11, PW = 178, LW = NR * PW, YMIN = -520, XP = 560, OX = 1150, OY = 540;
const SPEED = [1.5, 2.3, 1.1, 1.9], ZC = [70, -90, 30, -170], STAG = [0, 90, 40, 130];
const SPAWN = { x: 930, y: 540 };  // le centre de l’écran, en coordonnées du mur
const colX = (c: number) => OX + (c - 1.5) * XP;
const wrapY = (v: number) => YMIN + ((((v - YMIN) % LW) + LW) % LW);
const y0 = (c: number, j: number, t: number) => wrapY(j * PW + STAG[c] - SPEED[c] * t);

// L’ordre du fil (« Tout »), puis un ordre par rubrique choisie : les cartes de la rubrique montent en tête
const ORDER0 = Array.from({ length: DEPS.length }, (_, i) => (i * 7) % DEPS.length);
const ORDERS = [ORDER0, ...[0, 1, 2].map((k) => [...ORDER0.filter((id) => DEPS[id].r === k), ...ORDER0.filter((id) => DEPS[id].r !== k)])];

type Inst = { readonly n: number; readonly id: number; readonly c: number; readonly j: number; readonly sd: number; readonly rot: number; readonly rep: boolean; readonly td: number };
const INST: readonly Inst[] = (() => {
  const base = Array.from({ length: NC * NR }, (_, n) => { const c = Math.floor(n / NR), j = n % NR; return { n, id: (c * 5 + j * 7) % DEPS.length, c, j }; });
  const dist = (i: { c: number; j: number }) => Math.hypot(colX(i.c) - SPAWN.x, y0(i.c, i.j, 0) - SPAWN.y);
  const rank = [...base].sort((p, q) => dist(p) - dist(q)).map((i) => i.n);
  // l’instance qui porte chaque dépêche jusqu’au fil : la plus proche du milieu de l’écran au départ du regroupement
  const repOf = DEPS.map((_, id) => base.filter((i) => i.id === id)
    .sort((p, q) => (Math.abs(y0(p.c, p.j, T_REG - F0) - 540) + 0.15 * Math.abs(colX(p.c) - 1150)) - (Math.abs(y0(q.c, q.j, T_REG - F0) - 540) + 0.15 * Math.abs(colX(q.c) - 1150)))[0].n);
  return base.map((i) => {
    const rep = repOf[i.id] === i.n;
    return { ...i, sd: Math.min(rank.indexOf(i.n), 28) * 2, rot: (rnd(`ar${i.n}`) - 0.5) * 60, rep, td: rep ? ORDER0.indexOf(i.id) * 0.8 : (i.n % 8) * 1.2 };
  });
})();

// --- Le fil final : une colonne à droite -----------------------------------------------------------------------------------
const COLX = 1515, COLY = 304, PF = 198, CSC = 1.2;
const colScroll = (f: number) => 70 - 0.5 * Math.max(0, f - T_REG);
const slotAt = (id: number, f: number) => {
  let s = ORDERS[0].indexOf(id);
  for (let k = 0; k < 3; k++) {
    const prev = ORDERS[k].indexOf(id), next = ORDERS[k + 1].indexOf(id), t = b(25 + k) + Math.min(next, 12) * 0.8;
    s += (next - prev) * ramp(f, t, t + 30, 0, 1, CAM);
  }
  return s;
};

// Une rubrique s’allume à son temps (flot), puis à son onglet (fil)
const lit1 = (r: number, f: number) => ramp(f, b(16 + r), b(16 + r) + 10) * (1 - ramp(f, b(17 + r), b(17 + r) + 10));
const lit3 = (r: number, f: number) => (r > 2 ? 0 : ramp(f, b(25 + r), b(25 + r) + 12) * (r < 2 ? 1 - ramp(f, b(26 + r), b(26 + r) + 12) : 1));

// La couleur du moment (lueurs, poussières, soulignement)
const accentAt = (f: number) => {
  if (f < b(21)) {
    const cols = [C.brand, C.violet, C.amber, TEAL, C.brand];
    return cols.reduce((c, col, k) => (k === 0 ? c : mixHex(c, col, ramp(f, b(16 + k), b(16 + k) + 14, 0, 1, CAM))), C.brand);
  }
  const cols = [C.brand, C.violet, C.amber];
  return cols.reduce((c, col, k) => (k === 0 ? c : mixHex(c, col, ramp(f, b(25 + k), b(25 + k) + 14, 0, 1, CAM))), C.brand);
};

// --- Une carte de dépêche -------------------------------------------------------------------------------------------------
const CardFace: React.FC<{ readonly d: Dep; readonly lit: number; readonly dark: number }> = ({ d, lit, dark }) => {
  const col = RUB[d.r].color;
  return (
    <div style={{
      position: "absolute", left: -260, top: -75, width: 520, height: 150, borderRadius: 22, padding: "16px 24px", fontFamily: sans,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      ...glass(lerp(1.5, 2.5, lit), lerp(14, 46, lit), mixHex("#ffffff", col, lit), [mixHex("#181a22", col, lit * 0.2), mixHex("#0d0e14", col, lit * 0.14)]),
    }}>
      <div style={{ display: "flex", alignItems: "center", lineHeight: 1, height: 22 }}>
        <span style={{ width: 10, height: 10, borderRadius: 5, background: col, boxShadow: `0 0 10px ${rgba(col, 0.9)}`, marginRight: 10 }} />
        <span style={{ fontWeight: 600, fontSize: 22, color: mixHex(col, "#ffffff", 0.35) }}>{RUB[d.r].name}</span>
        <span style={{ marginLeft: "auto", fontWeight: 500, fontSize: 20, color: C.dim }}>il y a {d.min} min</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 28, lineHeight: 1.2, color: C.ink, height: 67, overflow: "hidden" }}>{d.title}</div>
      <div style={{ fontWeight: 500, fontSize: 20, lineHeight: 1, color: C.muted, height: 20 }}>{d.src}</div>
      {dark > 0.005 && <div style={{ position: "absolute", inset: 0, borderRadius: 20, background: `rgba(5,6,10,${dark})` }} />}
    </div>
  );
};

// --- Les bandeaux de sources ------------------------------------------------------------------------------------------------
const SRC: readonly (readonly [string, string])[] = [
  ["BFM Bourse", C.brand], ["Le Monde Économie", C.violet], ["CNBC", C.brand], ["BBC Business", C.amber], ["The Economist", C.violet],
  ["Nasdaq", C.brand], ["CoinDesk", TEAL], ["Cointelegraph", TEAL], ["BCE", C.violet], ["Réserve fédérale", C.violet],
];
const CW = 360, CH = 88, CP = 404, LB = SRC.length * CP;
const Band: React.FC<{ readonly f: number; readonly y: number; readonly dir: 1 | -1; readonly speed: number; readonly shift: number; readonly delay: number; readonly rev?: boolean }> = ({ f, y, dir, speed, shift, delay, rev }) => {
  const p = ramp(f, b(20) + delay, b(20) + delay + 36), q = ramp(f, T_REG - 16, T_REG + 2, 0, 1, IN);
  if (p <= 0 || q >= 1) return null;
  const dx = -dir * (1 - p) * 1000 + dir * q * 1500;
  const list = rev ? [...SRC].reverse() : SRC;
  return (
    <div style={{
      position: "absolute", left: 0, top: y - CH, width: 1920, height: 2 * CH, ...focus(Math.min(p * 1.6, 1) * (1 - q), 16),
      maskImage: "linear-gradient(90deg, transparent 0%, #000 11%, #000 89%, transparent 100%)",
      WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 11%, #000 89%, transparent 100%)",
    }}>
      {list.map(([name, col], i) => {
        const x = -380 + ((((i * CP + shift + dir * speed * (f - b(20)) + 380) % LB) + LB) % LB) + dx;
        const mid = Math.exp(-Math.pow((x + CW / 2 - 960) / 520, 2));
        return (
          <div key={name} style={{
            position: "absolute", left: x, top: CH - CH / 2, width: CW, height: CH, borderRadius: CH / 2, scale: String(1 + 0.12 * mid),
            display: "flex", alignItems: "center", justifyContent: "center", gap: 14, fontFamily: sans, fontWeight: 600, fontSize: 30, color: C.ink,
            ...glass(lerp(1.5, 2.5, mid), lerp(10, 34, mid), mixHex("#ffffff", col, 0.25 + 0.6 * mid)),
          }}>
            <span style={{ width: 14, height: 14, borderRadius: 7, background: col, boxShadow: `0 0 14px ${rgba(col, 0.9)}` }} />
            {name}
          </div>
        );
      })}
    </div>
  );
};

// --- Les onglets du fil -----------------------------------------------------------------------------------------------------
const TABS = ["Tout", "Marchés", "Économie", "Entreprises", "Crypto"];
const TCOL = [C.ink, C.brand, C.violet, C.amber, TEAL];
const TW = [76, 120, 128, 160, 102], TBW = 624, TBH = 68, TLEFT = COLX - TBW / 2, TTOP = 116;
const TC: number[] = (() => { let a = (TBW - TW.reduce((s, w) => s + w, 0)) / 2; return TW.map((w) => { const c = a + w / 2; a += w; return c; }); })();
const interp = (arr: readonly number[], idx: number) => { const k = clamp(idx, 0, 4), i = Math.min(Math.floor(k), 3); return lerp(arr[i], arr[i + 1], k - i); };
const Tabs: React.FC<{ readonly f: number }> = ({ f }) => {
  const pin = ramp(f, T_REG + 10, T_REG + 36);
  const idx = pop(f, b(25)) + pop(f, b(26)) + pop(f, b(27));
  const k = clamp(idx, 0, 4), i = Math.min(Math.floor(k), 3);
  const col = mixHex(TCOL[i], TCOL[i + 1], k - i), cx = interp(TC, idx), w = interp(TW, idx);
  return (
    <div style={{ position: "absolute", left: TLEFT, top: TTOP, width: TBW, height: TBH, borderRadius: TBH / 2, translate: `0 ${(1 - pin) * -40}px`, ...focus(pin), ...glass(1.5, 22, "#ffffff") }}>
      <div style={{ position: "absolute", left: cx - w / 2 + 4, top: 9, width: w - 8, height: 46, borderRadius: 23, background: rgba(idx < 0.5 ? "#FFFFFF" : col, 0.13) }} />
      {TABS.map((t, n) => (
        <div key={t} style={{
          position: "absolute", left: TC[n] - TW[n] / 2, top: 0, width: TW[n], height: TBH - 6, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: sans, fontWeight: 600, fontSize: 24, color: mixHex(C.muted, C.ink, clamp(1 - Math.abs(idx - n), 0, 1)),
        }}>{t}</div>
      ))}
      <div style={{ position: "absolute", left: cx - w * 0.35, bottom: 9, width: w * 0.7, height: 4, borderRadius: 2, background: col, boxShadow: `0 0 14px ${col}, 0 0 36px ${rgba(col, 0.6)}` }} />
    </div>
  );
};

// La roue des rubriques : un mot sort vers le haut pendant que le suivant monte du bas, à la même vitesse (jamais superposés)
type Spin = { readonly t: string; readonly at: number; readonly color?: string };
const Wheel: React.FC<{ readonly f: number; readonly size: number; readonly words: readonly Spin[]; readonly end: number }> = ({ f, size, words, end }) => {
  const d = size * 1.45;
  return (
    <div style={{ position: "relative", height: size, width: size * 9, overflow: "hidden", paddingTop: "0.12em", marginTop: "-0.12em", paddingBottom: "0.16em", marginBottom: "-0.16em", boxSizing: "content-box", fontFamily: display, fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: "-0.035em", color: C.ink, whiteSpace: "nowrap" }}>
      {words.map((w, k) => {
        const up = ramp(f, w.at, w.at + 14, 0, 1, CAM), down = ramp(f, k < words.length - 1 ? words[k + 1].at : end, (k < words.length - 1 ? words[k + 1].at : end) + 14, 0, 1, CAM);
        if (up <= 0 || down >= 1) return null;
        return <span key={w.t} style={{ position: "absolute", left: 0, top: "0.12em", color: w.color, translate: `0 ${(1 - up) * d - down * d}px` }}>{w.t}</span>;
      })}
    </div>
  );
};

// Un reflet qui traverse l’écran en diagonale
const Sweep: React.FC<{ readonly f: number; readonly at: number }> = ({ f, at }) => {
  const p = ramp(f, at, at + 46, 0, 1, CAM);
  if (p <= 0 || p >= 1) return null;
  return <div style={{ position: "absolute", top: -200, left: lerp(-700, 2300, p), width: 420, height: 1500, rotate: "18deg", mixBlendMode: "screen", background: "linear-gradient(90deg, transparent, rgba(190,210,255,0.13), transparent)" }} />;
};

// --- La scène -------------------------------------------------------------------------------------------------------------------
export const Actu: React.FC = () => {
  const f = useCurrentFrame();
  if (f < F0 || f > F1) return null;

  const acc = accentAt(f);
  const drift = ramp(f, b(12), b(24), 0, 1, LIN);
  const eW = ramp(f, T_REG, T_REG + 58, 0, 1, CAM);
  // un petit coup de caméra sur chaque temps de la roue
  const punch = [b(16), b(17), b(18), b(19), b(20), T_REG].reduce((s, t) => s + (f >= t ? 0.014 * (1 - ramp(f, t, t + 18)) : 0), 0);
  const sW = lerp(lerp(0.82, 0.95, drift) + punch, 1, eW), axW = lerp(lerp(15, 19, drift), 0, eW), azW = lerp(lerp(-8, -12, drift), 0, eW);
  const txW = lerp(lerp(150, 90, drift), 0, eW), tyW = lerp(lerp(40, -30, drift), 0, eW);
  const flat = eW >= 0.999;

  const dark = 0.6 * ramp(f, b(20), b(20) + 14) * (1 - ramp(f, T_REG, T_REG + 24));
  const dim1 = ramp(f, b(16), b(16) + 10) * (1 - ramp(f, b(20), b(20) + 12));
  const sel = ramp(f, b(25), b(25) + 12);
  const vp = ramp(f, b(12.6), b(13.4)), p2 = ramp(f, b(20), b(20) + 14) * (1 - ramp(f, T_REG, T_REG + 24));

  const finalPos = (id: number) => ({ x: COLX, y: COLY + slotAt(id, f) * PF + colScroll(f) });
  const cards = INST.map((i) => {
    const r = DEPS[i.id].r;
    const eS = ramp(f, F0 + i.sd, F0 + i.sd + 40, 0, 1, OUT);
    const e = ramp(f, T_REG + i.td, T_REG + i.td + 42, 0, 1, CAM);
    if (eS <= 0.003) return null;
    // le mur : l’instance défile, puis (au regroupement) continue sa course sans reboucler
    const tf = Math.min(f, T_REG + i.td);
    const wx = colX(i.c) + Math.sin(f / 70 + i.n) * 4;
    const wy = y0(i.c, i.j, tf - F0) - SPEED[i.c] * Math.max(0, f - T_REG - i.td) + Math.sin(f / 38 + i.n * 1.7) * 6 * (1 - e);
    const fx = lerp(SPAWN.x, wx, eS), fy = lerp(SPAWN.y, wy, eS);
    const tg = finalPos(i.id);
    const x = lerp(fx, tg.x, e), y = lerp(fy, tg.y, e);
    const lit = Math.max(lit1(r, f), i.rep ? lit3(r, f) : 0);
    const edge = clamp((y - 215) / 60, 0, 1) * (1 - clamp((y - 1000) / 180, 0, 1));
    let o = clamp(eS * 4, 0, 1) * (1 - 0.65 * dim1 * (1 - lit)) * lerp(1, edge, e);
    o *= i.rep ? 1 - 0.25 * sel * (1 - lit3(r, f)) : 1 - clamp((e - 0.4) / 0.55, 0, 1);
    if (o < 0.01) return null;
    const sc = eS * lerp(1, CSC, e) * (1 + 0.03 * lit) * (i.rep ? 1 : lerp(1, 0.9, e));
    const z = lerp(0, ZC[i.c], eS) * (1 - e);
    return (
      <div key={i.n} style={{ position: "absolute", left: 0, top: 0, opacity: o, transform: `translate3d(${x}px, ${y}px, ${z}px) rotate(${(1 - eS) * i.rot}deg) scale(${sc})` }}>
        <CardFace d={DEPS[i.id]} lit={lit} dark={dark} />
      </div>
    );
  });

  const ts = {} as const;
  const T1 = 400;  // haut du titre du flot (centré verticalement : 2 lignes de 140)
  const wheel: readonly Spin[] = [
    { t: "financière.", at: b(14) }, { t: "Marchés.", at: b(16), color: C.brand }, { t: "Économie.", at: b(17), color: C.violet },
    { t: "Entreprises.", at: b(18), color: C.amber }, { t: "Crypto.", at: b(19), color: TEAL },
  ];

  return (
    <>
      {/* le mur de cartes, en perspective */}
      <div style={{ position: "absolute", inset: 0, perspective: 1600, perspectiveOrigin: "50% 50%" }}>
        <div style={{
          position: "absolute", inset: 0, transformStyle: "preserve-3d", transformOrigin: `${OX}px ${OY}px`,
          transform: flat ? "none" : `translate3d(${txW}px, ${tyW}px, 0) rotateX(${axW}deg) rotateZ(${azW}deg) scale(${sW})`,
        }}>{cards}</div>
      </div>
      {/* voiles de lisibilité */}
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, rgba(5,6,10,${0.96 * vp}) 0%, rgba(5,6,10,${0.9 * vp}) 32%, rgba(5,6,10,${0.5 * vp}) 56%, rgba(5,6,10,0) 78%)` }} />
      <div style={{ position: "absolute", inset: 0, background: `rgba(5,6,10,${0.22 * p2})` }} />
      <Halo x={COLX} y={560} r={600} color={acc} a={0.26 * eW} />
      <Sparks f={f} n={34} seed="actu" color={acc} a={0.55} />

      {/* 1. le flot : « Toute l’actu » puis la roue des rubriques */}
      <div style={{ position: "absolute", left: 120, top: T1 }}>
        <Title f={f} size={140} out={b(20) - 4} style={ts} words={[{ t: "Toute", at: b(13) }, { t: "l’actu", at: b(13.5) }]} />
      </div>
      <div style={{ position: "absolute", left: 120, top: T1 + 140 }}>
        <Wheel f={f} size={140} words={wheel} end={b(20)} />
      </div>

      {/* 2. les sources */}
      <div style={{ position: "absolute", left: 120, top: 120 }}>
        <Title f={f} size={130} out={T_REG - 8} style={ts} words={[
          { t: "Les", at: b(20.25) }, { t: "sources", at: b(20.25) + 3 },
          { t: "qui", at: b(20.75), br: true }, { t: "comptent.", at: b(20.75) + 3, color: C.brand },
        ]} />
      </div>
      <Band f={f} y={650} dir={-1} speed={4.4} shift={0} delay={8} />
      <Band f={f} y={820} dir={1} speed={3.6} shift={200} delay={14} rev />

      {/* 3. le fil */}
      <div style={{ position: "absolute", left: 110, top: 360 }}>
        <Title f={f} size={120} style={ts} words={[
          { t: "Réunies", at: T_REG },
          { t: "dans", at: b(24.5), br: true }, { t: "un", at: b(24.5) + 3 }, { t: "seul", at: b(24.5) + 6 }, { t: "fil.", at: b(24.5) + 9, color: C.brand },
        ]} />
      </div>
      <Tabs f={f} />

      <Sweep f={f} at={b(20)} />
      <Sweep f={f} at={T_REG} />
    </>
  );
};
