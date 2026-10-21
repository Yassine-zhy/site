// S18 à S22 : le drop (trois façons), les maquettes qui répondent au clic, « Et ce site ? », le terminal, la signature
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import {
  Burst, COLORS, Character, Kinetic, Logo, OUT, Pill, W, Wordmark, WorldName, WORLDS, clamp, display, lerp, mono, ramp, sans, useAbs, useSceneFrom,
} from "../kit";
import { Model, SiteWindow, useEvents } from "../site";

// --- S18 : « Un seul site. Trois façons de comprendre les marchés. » Le drop, puis trois panneaux qui claquent sur les temps -----
const Thumb: React.FC<{ readonly who: WorldName }> = ({ who }) => {
  const box: React.CSSProperties = { position: "absolute", left: 40, right: 40, bottom: 40, height: 210, borderRadius: 20, background: COLORS.night, padding: 24, boxSizing: "border-box", boxShadow: "0 24px 50px -24px rgba(0,0,0,0.6)" };
  if (who === "ines") {
    return (
      <div style={box}>
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 25, color: COLORS.ink, background: "#151d30", borderRadius: 12, padding: "12px 16px" }}>Qu'est-ce qui fait bouger le CAC 40 ?</div>
        <div style={{ marginTop: 18, height: 12, width: "90%", borderRadius: 6, background: "#33415f" }} />
        <div style={{ marginTop: 12, height: 12, width: "64%", borderRadius: 6, background: "#33415f" }} />
        <div style={{ marginTop: 18, display: "flex", gap: 10 }}>{[1, 2, 3].map((n) => <div key={n} style={{ width: 54, height: 22, borderRadius: 7, background: COLORS.brand, opacity: 0.8 }} />)}</div>
      </div>
    );
  }
  if (who === "hugo") {
    return (
      <div style={{ ...box, display: "flex", alignItems: "center", gap: 28 }}>
        <svg viewBox="0 0 100 100" width={150} height={150}>
          <circle cx={50} cy={50} r={36} fill="none" stroke="#1d2a47" strokeWidth={18} />
          <circle cx={50} cy={50} r={36} fill="none" stroke={COLORS.up} strokeWidth={18} strokeDasharray="110 226" transform="rotate(-90 50 50)" />
          <circle cx={50} cy={50} r={36} fill="none" stroke={COLORS.brand} strokeWidth={18} strokeDasharray="70 226" strokeDashoffset={-114} transform="rotate(-90 50 50)" />
        </svg>
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 28, lineHeight: 1.25, color: COLORS.ink }}>Portefeuille<br />virtuel</div>
      </div>
    );
  }
  return (
    <div style={{ ...box, display: "flex", alignItems: "flex-end", gap: 12, paddingBottom: 26 }}>
      {[22, 34, 46, 60, 76, 96, 120].map((h, i) => (
        <div key={i} style={{ width: 40, height: h, borderRadius: 6, background: "#fff", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: Math.max(4, h * (0.08 + i * 0.045)), borderRadius: 6, background: COLORS.brand }} />
        </div>
      ))}
    </div>
  );
};

export const S18: React.FC = () => {
  const f = useAbs();
  const PANELS: { who: WorldName; name: string; at: number }[] = [
    { who: "ines", name: "Inès", at: 1530 }, { who: "hugo", name: "Hugo", at: 1545 }, { who: "sami", name: "Sami", at: 1560 },
  ];
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 90, top: 220 }}>
        <Kinetic toks={[{ t: "Un", at: W("L18", "Un") }, { t: "seul", at: W("L18", "seul") }, { t: "site.", at: W("L18", "site"), br: true }]} size={400} exit={1524} />
      </div>
      <div style={{ position: "absolute", left: 96, top: 44 }}>
        <Kinetic toks={[{ t: "Un", at: 1532 }, { t: "seul", at: 1534 }, { t: "site.", at: 1536 }]} size={130} />
      </div>
      {PANELS.map((p, i) => {
        const t = ramp(f, p.at, p.at + 9, [0, 1], OUT);
        return (
          <div key={p.who} style={{ position: "absolute", left: 96 + i * 584, top: 230, width: 560, height: 720, borderRadius: 32, background: WORLDS[p.who], overflow: "hidden", translate: `0 ${(1 - t) * 900}px`, boxShadow: "0 40px 80px -30px rgba(0,0,0,0.7)" }}>
            <div style={{ position: "absolute", left: 40, top: 26, fontFamily: display, fontWeight: 900, fontSize: 78, letterSpacing: "-0.04em", color: "#fff" }}>{p.name}</div>
            <div style={{ position: "absolute", inset: 0 }}>
              <Character name={p.who} cx={p.who === "sami" ? 360 : 340} cy={290} d={380} at={p.at} rise={false} disc="rgba(255,255,255,0.2)" />
            </div>
            <Thumb who={p.who} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// --- S19 : « Et chaque page a sa maquette 3D, qui répond au clic. » Une rafale de maquettes, puis le vrai clic sur le globe -----
const BURST: readonly (readonly [string, string])[] = [["globe", "Marchés"], ["city", "L'accueil"], ["coins", "Crypto"], ["bell", "Alertes"], ["ridges", "Économie"], ["books", "Glossaire"], ["paper", "Le brief"]];
export const BURST_STEP = 7;  // images par maquette : le clic tombe à 55,26 s, il faut que la rafale soit finie avant
export const S19: React.FC = () => {
  const f = useAbs();
  const from = useSceneFrom();
  const ev = useEvents("globe", { click: 99 });
  const tClic = W("L19", "clic");
  const tWin = from + BURST.length * BURST_STEP;  // la rafale finie, le site
  const k = clamp(Math.floor((f - from) / BURST_STEP), 0, BURST.length - 1);
  const lab = ramp(f, from + k * BURST_STEP, from + k * BURST_STEP + 4);
  return (
    <AbsoluteFill>
      {f < tWin ? (
        <>
          {BURST.map(([name], i) => (
            <Sequence key={name} from={i * BURST_STEP} durationInFrames={BURST_STEP} name={`maquette ${name}`}>
              <Model name={name} trim={20} />
            </Sequence>
          ))}
          <div style={{ position: "absolute", left: 96, bottom: 190, fontFamily: display, fontWeight: 900, fontSize: 84, letterSpacing: "-0.04em", color: COLORS.ink, opacity: lab, translate: `0 ${(1 - lab) * 24}px`, textShadow: "0 4px 30px #000" }}>{BURST[k][1]}</div>
        </>
      ) : (
        <SiteWindow
          name="globe" box={{ x: 210, y: 90, w: 1500, h: 800 }} sync={[tClic, ev.click]} len={150} hold={148} enter={tWin} cursor
          cam={[{ f: tWin, cx: 1420, cy: 410, z: 2.0 }, { f: tClic + 6, cx: 1420, cy: 410, z: 2.0 }, { f: tClic + 42, cx: 700, cy: 540, z: 1.5 }]}
          marks={[{ rect: [308, 460, 606, 630], at: tClic + 38, pad: 8 }]}
        />
      )}
    </AbsoluteFill>
  );
};

// --- S20 : « Et ce site ? » Coupe sur noir, le texte seul ---------------------------------------------------------------------------
export const S20: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.night, alignItems: "center", justifyContent: "center", display: "flex" }}>
    <Kinetic toks={[{ t: "Et", at: W("L20", "Et") }, { t: "ce", at: W("L20", "ce") }, { t: "site ?", at: W("L20", "site") }]} size={330} align="center" />
  </AbsoluteFill>
);

// --- S21 : « C'est un projet d'étudiant, codé avec Claude Code. » Un terminal : « claude », puis de vrais chemins du projet ---------
const PATHS = ["app.py", "theme.py", "scene3d.py", "static/fv3d/models.js", "static/fv3d/vitrines.js", "tools/music.py", "video/src/Trailer.tsx"];
export const S21: React.FC = () => {
  const f = useAbs();
  const t0 = 1762;
  const typed = "claude";
  const nChars = clamp(Math.floor((f - t0) / 3), 0, typed.length);
  const tClaude = W("L20b", "Claude"), tStud = W("L20b", "d'étudiant");
  const lit = ramp(f, tClaude, tClaude + 8);
  const card = ramp(f, tStud, tStud + 11);
  const caret = Math.floor(f / 8) % 2 === 0;
  const lines = PATHS.map((p, i) => ({ p, at: 1786 + i * 9 }));
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 96, top: 140, width: 1130, height: 760, borderRadius: 22, background: "#0A0E18", boxShadow: "0 60px 120px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)", overflow: "hidden", opacity: ramp(f, 1755, 1765) }}>
        <div style={{ height: 52, background: "#0F1524", display: "flex", alignItems: "center", gap: 10, paddingLeft: 22, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {["#FF6375", "#F5B544", "#34D17F"].map((c) => <span key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c, opacity: 0.85 }} />)}
          <span style={{ fontFamily: mono, fontSize: 20, color: "#6b7694", marginLeft: 18 }}>finveille</span>
        </div>
        <div style={{ padding: "30px 38px", fontFamily: mono, fontSize: 32, lineHeight: "50px", color: COLORS.ink }}>
          <div><span style={{ color: COLORS.up }}>~/finveille</span> <span style={{ color: "#6b7694" }}>$</span> {typed.slice(0, nChars)}{caret && nChars < typed.length + 1 && f < 1790 ? <span style={{ background: COLORS.ink, color: COLORS.ink }}>_</span> : null}</div>
          {f >= 1782 ? <div style={{ color: lerpColor(lit) }}>✻ Claude Code</div> : null}
          {lines.map((l) => (f >= l.at ? (
            <div key={l.p} style={{ opacity: ramp(f, l.at, l.at + 4), translate: `0 ${(1 - ramp(f, l.at, l.at + 4)) * 14}px` }}>
              <span style={{ color: COLORS.up }}>●</span> <span style={{ color: "#6b7694" }}>Write(</span>{l.p}<span style={{ color: "#6b7694" }}>)</span>
            </div>
          ) : null))}
        </div>
      </div>
      <div style={{ position: "absolute", left: 1290, top: 250, width: 534, borderRadius: 28, background: "#fff", opacity: card, translate: `0 ${(1 - card) * 60}px`, padding: "34px 34px 38px", boxSizing: "border-box", boxShadow: "0 40px 80px -30px #000" }}>
        <div style={{ width: 92, height: 92, borderRadius: 46, background: `linear-gradient(135deg, #3b6cff, #1536b4)`, color: "#fff", fontFamily: display, fontWeight: 900, fontSize: 38, display: "flex", alignItems: "center", justifyContent: "center" }}>YZ</div>
        <div style={{ marginTop: 22, fontFamily: display, fontWeight: 900, fontSize: 56, letterSpacing: "-0.035em", lineHeight: 1, color: COLORS.night }}>Yassine Zouhair</div>
        <div style={{ marginTop: 12, fontFamily: sans, fontWeight: 600, fontSize: 36, color: "#3b5bdb" }}>étudiant en finance</div>
      </div>
      <div style={{ position: "absolute", left: 1290, top: 620, fontFamily: display, fontWeight: 900, fontSize: 132, lineHeight: 0.92, letterSpacing: "-0.045em", color: lerpColor(lit), textShadow: lit > 0.1 ? `0 0 ${60 * lit}px ${COLORS.brand}` : undefined, scale: String(lerp(0.96, 1, lit)), transformOrigin: "0 50%" }}>
        Claude<br />Code
      </div>
    </AbsoluteFill>
  );
};
// Du gris éteint au blanc allumé
const lerpColor = (t: number) => {
  const a = [0x3a, 0x45, 0x62], b = [0xff, 0xff, 0xff];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
};

// --- S22 : « FinVeille. Gratuit, et en français. » Impact : éclat, logo, nom, adresse, deux pastilles ----------------------------
export const S22: React.FC = () => {
  const f = useAbs();
  const flash = ramp(f, 1860, 1866, [0.55, 0]);
  const dom = ramp(f, 1878, 1890);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(900px 700px at 50% 38%, ${COLORS.brand}33, transparent 70%)`, opacity: ramp(f, 1860, 1880) }} />
      <Burst at={1860} />
      <Logo cx={960} cy={300} size={230} at={1860} id="s22" />
      <Wordmark top={430} size={196} at={W("L21", "FinVeille")} />
      <div style={{ position: "absolute", left: 0, width: 1920, top: 700, textAlign: "center", fontFamily: sans, fontWeight: 600, fontSize: 56, color: COLORS.brand, opacity: dom, translate: `0 ${(1 - dom) * 20}px` }}>finveille.streamlit.app</div>
      <div style={{ position: "absolute", left: 0, width: 1920, top: 800, display: "flex", justifyContent: "center", gap: 28 }}>
        <Pill text="Gratuit" at={W("L21", "Gratuit")} color={COLORS.night} size={62} />
        <Pill text="En français" at={W("L21", "en")} color={COLORS.night} size={62} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};
