// La bande-annonce de FinVeille (guide 32), en motion design avec Remotion.
// Une idée par scène ; le texte d'un côté, une séquence filmée dans le vrai site de l'autre (tools/footage.py) ;
// les chiffres de la séance viennent de public/data.json (écrit par le même outil).
import { Audio, Video } from "@remotion/media";
import { loadFont } from "@remotion/fonts";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Les polices de la marque, embarquées (public/fonts) : le rendu n'a pas besoin d'Internet
const display = "Schibsted Grotesk", sans = "IBM Plex Sans";
loadFont({ family: display, url: staticFile("fonts/SchibstedGrotesk.woff2"), weight: "400 900" });
loadFont({ family: sans, url: staticFile("fonts/IBMPlexSans.woff2"), weight: "100 700" });

export const COLORS = {
  night: "#060912", ink: "#E8EDF6", muted: "#96A2B9", line: "#24304A", brand: "#6D93FF", up: "#34D17F", down: "#FF6375",
};

type Mover = { readonly name: string; readonly change: number };
export type Data = {
  readonly date: string; readonly index: number | null; readonly change: number | null;
  readonly up: number; readonly down: number; readonly top: Mover[]; readonly bottom: Mover[];
};

const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const OUT = Easing.bezier(0.16, 1, 0.3, 1);
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const NNBSP = "\u202f";  // l'espace fine insécable avant « % »
const frNumber = (v: number, d = 2) => Math.abs(v).toFixed(d).replace(".", ",");
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${frNumber(v)}${NNBSP}%`;
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

// --- Le fond : la nuit, un quadrillage de salle des marchés, un halo qui dérive ------------------------------------
const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.night, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${COLORS.line}55 1px, transparent 1px), linear-gradient(90deg, ${COLORS.line}55 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          backgroundPosition: `0px ${-(frame * 0.6) % 64}px`,
          maskImage: "radial-gradient(70% 70% at 60% 45%, #000, transparent 80%)",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 600px at ${62 + Math.sin(frame / 90) * 8}% ${38 + Math.cos(frame / 110) * 6}%, ${COLORS.brand}2e, transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// --- Le texte qui monte, mot à mot, derrière un cache ----------------------------------------------------------------
const Words: React.FC<{
  readonly text: string; readonly start?: number; readonly size: number; readonly color?: string;
  readonly font?: string; readonly weight?: number; readonly gap?: number;
}> = ({ text, start = 0, size, color = COLORS.ink, font = display, weight = 700, gap = 3 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1.04, letterSpacing: "-0.04em", color }}>
      {text.split(" ").map((word, i) => {
        const t = interpolate(frame, [start + i * gap, start + i * gap + 22], [0, 1], { ...clampOpts, easing: OUT });
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.08em" }}>
            <span style={{ display: "inline-block", translate: `0 ${(1 - t) * 105}%`, opacity: t }}>{word}&nbsp;</span>
          </span>
        );
      })}
    </div>
  );
};

// --- Un nombre en rouleaux, comme sur un tableau de cotation --------------------------------------------------------
const Odometer: React.FC<{ readonly value: string; readonly start: number; readonly size: number; readonly color: string }> = ({ value, start, size, color }) => {
  const frame = useCurrentFrame();
  const chars = value.split("");
  return (
    <span style={{ display: "inline-flex", fontFamily: display, fontWeight: 800, fontSize: size, color, letterSpacing: "-0.04em", lineHeight: 1 }}>
      {chars.map((ch, i) => {
        if (!/\d/.test(ch)) return <span key={i}>{ch}</span>;
        const d = Number(ch);
        const t = interpolate(frame, [start + (chars.length - i) * 3, start + (chars.length - i) * 3 + 34], [0, 1], { ...clampOpts, easing: OUT });
        return (
          <span key={i} style={{ position: "relative", display: "inline-block", height: "1em", overflow: "hidden" }}>
            <span style={{ visibility: "hidden" }}>{ch}</span>
            <span style={{ position: "absolute", left: 0, top: 0, translate: `0 ${-(d + 10 * (1 - t)) * 10 / 2}%` }}>
              {Array.from({ length: 20 }, (_, k) => (
                <span key={k} style={{ display: "block", height: "1em" }}>{k % 10}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
};

// --- Une séquence du site, dans une fenêtre de navigateur -------------------------------------------------------------
const Browser: React.FC<{ readonly src: string; readonly side: "left" | "right"; readonly skip?: number }> = ({ src, side, skip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const turn = interpolate(frame, [0, 6 * fps], [side === "right" ? -9 : 9, side === "right" ? -3 : 3], clampOpts);
  return (
    <div
      style={{
        position: "absolute", top: 150, [side]: 110, width: 1180, height: 712, borderRadius: 26, overflow: "hidden",
        border: `1px solid ${COLORS.line}`, background: "#0a0f1b",
        boxShadow: `0 60px 120px -40px #000, 0 0 0 1px #ffffff0d inset, 0 40px 120px -60px ${COLORS.brand}88`,
        transform: `perspective(2200px) rotateY(${turn}deg) translateY(${(1 - enter) * 80}px) scale(${0.94 + enter * 0.06})`,
        opacity: enter,
      }}
    >
      <div style={{ height: 46, display: "flex", alignItems: "center", gap: 9, padding: "0 18px", borderBottom: `1px solid ${COLORS.line}`, background: "#0d1322" }}>
        {["#ff6375", "#f5b54e", "#34d17f"].map((c) => (
          <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c, opacity: 0.85 }} />
        ))}
        <span style={{ marginLeft: 18, padding: "5px 16px", borderRadius: 999, background: "#141c2c", color: COLORS.muted, fontFamily: sans, fontSize: 17 }}>
          FinVeille
        </span>
      </div>
      <Video src={staticFile(src)} trimBefore={skip} objectFit="cover" style={{ width: "100%", height: 666 }} muted />
    </div>
  );
};

// Une scène « séquence » : la fenêtre d'un côté, le propos de l'autre
const FootageScene: React.FC<{
  readonly src: string; readonly side: "left" | "right"; readonly kicker: string; readonly title: string; readonly note?: string;
  readonly skip?: number;  // images à sauter au début de la séquence
}> = ({ src, side, kicker, title, note, skip }) => {
  const frame = useCurrentFrame();
  const textSide = side === "right" ? "left" : "right";
  return (
    <AbsoluteFill>
      <Backdrop />
      <Browser src={src} side={side} skip={skip} />
      <div style={{ position: "absolute", top: 300, [textSide]: 140, width: 470 }}>
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 30, color: COLORS.brand, opacity: interpolate(frame, [4, 20], [0, 1], clampOpts) }}>
          {kicker}
        </div>
        <div style={{ marginTop: 22 }}>
          <Words text={title} start={8} size={74} />
        </div>
        {note ? (
          <div style={{ marginTop: 30, fontFamily: sans, fontSize: 30, lineHeight: 1.45, color: COLORS.muted, opacity: interpolate(frame, [30, 48], [0, 1], clampOpts) }}>
            {note}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// --- 1. L'ouverture : la séance, en un chiffre ----------------------------------------------------------------------
const Open: React.FC<{ readonly data: Data }> = ({ data }) => {
  const frame = useCurrentFrame();
  const change = data.change ?? 0;
  const color = change >= 0 ? COLORS.up : COLORS.down;
  const verb = change >= 0.05 ? "progresse de" : change <= -0.05 ? "recule de" : "est stable, à";
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ padding: "0 180px", justifyContent: "center" }}>
        <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 36, color: COLORS.brand, opacity: interpolate(frame, [0, 14], [0, 1], clampOpts) }}>
          {dayLabel(data.date).replace(/^./, (c) => c.toUpperCase())}, à la Bourse de Paris
        </div>
        <div style={{ marginTop: 26 }}>
          <Words text={`Le CAC 40 ${verb}`} start={6} size={150} />
        </div>
        <div style={{ marginTop: 6 }}>
          <Odometer value={`${frNumber(change)}${NNBSP}%`} start={22} size={250} color={color} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// --- 2. La marque --------------------------------------------------------------------------------------------------
const Brand: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <Img src={staticFile("logo.svg")} style={{ width: 170, height: 170, scale: String(0.5 + pop * 0.5), rotate: `${(1 - pop) * -10}deg`, filter: `drop-shadow(0 30px 70px ${COLORS.brand}aa)` }} />
        <div style={{ marginTop: 40, fontFamily: display, fontWeight: 800, fontSize: 168, letterSpacing: "-0.055em", color: COLORS.ink, opacity: interpolate(frame, [8, 22], [0, 1], clampOpts), translate: `0 ${interpolate(frame, [8, 30], [40, 0], { ...clampOpts, easing: OUT })}px` }}>
          Fin<span style={{ color: COLORS.brand }}>Veille</span>
        </div>
        <div style={{ marginTop: 18, fontFamily: sans, fontSize: 46, color: COLORS.muted, opacity: interpolate(frame, [24, 40], [0, 1], clampOpts) }}>
          La séance, racontée.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// --- 3. Les chiffres : qui monte, qui baisse -----------------------------------------------------------------------
const Movers: React.FC<{ readonly data: Data }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const max = Math.max(...[...data.top, ...data.bottom].map((m) => Math.abs(m.change)), 0.01);
  const row = (m: Mover, i: number, side: "up" | "down") => {
    const grow = spring({ frame: frame - 18 - i * 4, fps, config: { damping: 200 } });
    const width = (Math.abs(m.change) / max) * 320 * grow;
    const color = side === "up" ? COLORS.up : COLORS.down;
    return (
      <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 24, flexDirection: side === "up" ? "row" : "row-reverse", height: 84 }}>
        <div style={{ width: 290, textAlign: side === "up" ? "right" : "left", fontFamily: sans, fontWeight: 500, fontSize: 32, color: COLORS.ink }}>{m.name}</div>
        <div style={{ width: 320, display: "flex", justifyContent: side === "up" ? "flex-start" : "flex-end" }}>
          <div style={{ width, height: 30, borderRadius: 6, background: color }} />
        </div>
        <div style={{ width: 150, textAlign: side === "up" ? "left" : "right", fontFamily: display, fontWeight: 700, fontSize: 36, color, opacity: grow }}>{signed(m.change)}</div>
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ padding: "0 140px", flexDirection: "column", justifyContent: "center" }}>
        <Words text={`${data.up} valeurs montent, ${data.down} baissent.`} size={92} />
        <div style={{ marginTop: 80, display: "flex", justifyContent: "space-between" }}>
          <div>{data.bottom.map((m, i) => row(m, i, "down"))}</div>
          <div>{data.top.map((m, i) => row(m, i, "up"))}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// --- La fin : la signature -----------------------------------------------------------------------------------------
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phone = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill>
      <Backdrop />
      <Img
        src={staticFile("mobile.jpg")}
        style={{ position: "absolute", left: 200, top: 120, width: 380, borderRadius: 54, border: "12px solid #141c2c", boxShadow: "0 60px 140px -40px #000",
          translate: `0 ${(1 - phone) * 120}px`, rotate: `${(1 - phone) * -6}deg`, opacity: phone }}
      />
      <div style={{ position: "absolute", left: 720, top: 330, width: 1050 }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 160, letterSpacing: "-0.055em", color: COLORS.ink, opacity: interpolate(frame, [6, 20], [0, 1], clampOpts) }}>
          Fin<span style={{ color: COLORS.brand }}>Veille</span>
        </div>
        <div style={{ marginTop: 24 }}>
          <Words text="Un projet étudiant de Yassine Zouhair" start={16} size={56} font={sans} weight={500} color={COLORS.muted} gap={2} />
        </div>
        <div style={{ marginTop: 44, display: "flex", gap: 16, opacity: interpolate(frame, [40, 56], [0, 1], clampOpts) }}>
          {["Python", "Streamlit", "Three.js", "GSAP", "IA"].map((t) => (
            <span key={t} style={{ padding: "12px 26px", border: `1px solid ${COLORS.line}`, borderRadius: 999, fontFamily: sans, fontSize: 28, color: COLORS.ink, background: "#0d1322" }}>{t}</span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// --- Le montage ----------------------------------------------------------------------------------------------------
// la séquence Crypto commence une seconde plus tard : le changement de page y laisse un reste du tableau au tournage
const CRYPTO_SKIP = 30;
// Le montage suit la musique (tools/music.py, 120 battements par minute) : une mesure = 2 s = 60 images. Chaque scène
// dure un nombre entier de mesures, plus le fondu qui la relie à la suivante : toutes les coupes tombent sur un temps fort.
export const TRANSITION = 15;
const BAR = 60;
const bars = (n: number, last = false) => n * BAR + (last ? 0 : TRANSITION);
export const SCENES = { open: bars(2), brand: bars(2), story: bars(6), movers: bars(2), feed: bars(2), markets: bars(3),
  crypto: bars(2), ai: bars(2), outro: bars(3, true) };
export const TOTAL = Object.values(SCENES).reduce((a, b) => a + b, 0) - TRANSITION * (Object.keys(SCENES).length - 1);

export const Trailer: React.FC<{ readonly data: Data }> = ({ data }) => {
  const t = linearTiming({ durationInFrames: TRANSITION });
  const headline = data.top[0] ? `${data.top[0].name}, ${signed(data.top[0].change)}` : "";
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.night }}>
      <Audio src={staticFile("music.mp3")} volume={(f) => interpolate(f, [TOTAL - 50, TOTAL], [1, 0], clampOpts)} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENES.open}><Open data={data} /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={t} />
        <TransitionSeries.Sequence durationInFrames={SCENES.brand}><Brand /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={t} />
        <TransitionSeries.Sequence durationInFrames={SCENES.story}>
          <FootageScene src="footage/story.mp4" side="right" kicker="L'accueil raconte la séance"
            title="Le CAC 40 en maquette." note={`Une tour par valeur : sa hauteur suit son poids, son toit la séance. La caméra file vers la plus forte hausse${headline ? ` (${headline})` : ""}, puis la plus forte baisse.`} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={t} />
        <TransitionSeries.Sequence durationInFrames={SCENES.movers}><Movers data={data} /></TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={t} />
        <TransitionSeries.Sequence durationInFrames={SCENES.feed}>
          <FootageScene src="footage/feed.mp4" side="left" kicker="Le fil" title="L'actualité, triée et expliquée." note="Douze sources, classées par rubrique, résumées en un clic." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={t} />
        <TransitionSeries.Sequence durationInFrames={SCENES.markets}>
          <FootageScene src="footage/markets.mp4" side="right" kicker="Marchés" title="Un globe de bureau, une épingle par place." note="Verte si l'indice monte, rouge s'il baisse. Il tourne sous la souris." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={t} />
        <TransitionSeries.Sequence durationInFrames={SCENES.crypto}>
          <FootageScene src="footage/crypto.mp4" skip={CRYPTO_SKIP} side="left" kicker="Crypto" title="Trois pièces, gravées à leur symbole." note="Le filet de chaque pièce dit sa séance sur 24 heures ; survolée, elle donne son cours." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={t} />
        <TransitionSeries.Sequence durationInFrames={SCENES.ai}>
          <FootageScene src="footage/ai.mp4" side="right" kicker="Assistant IA" title="Une IA qui cite ses sources." note="Chaque réponse renvoie aux dépêches qui la fondent." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={t} />
        <TransitionSeries.Sequence durationInFrames={SCENES.outro}><Outro /></TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

