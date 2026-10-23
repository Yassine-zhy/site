// La version LinkedIn de la bande-annonce de FinVeille : 1080 × 1350 (4:5 vertical), 60 im/s, 3 660 images (61 s).
// Même identité que le film (fond nuit et halos, verre lumineux, titres Schibsted Grotesk) ; tout est calé sur le
// numéro de l'image, jamais sur l'horloge. La bande-annonce 1920 × 1080 y est incrustée telle quelle (sa musique et
// ses sons viennent avec elle) ; les sous-titres suivent ses scènes, décalés de l'accroche.
//
// | partie   | images        | ce qu'on voit                                                                          |
// | -------- | ------------- | -------------------------------------------------------------------------------------- |
// | accroche | 0 - 240       | « Combien d'applis pour suivre la bourse ? » ; six onglets en verre surgissent, un       |
// |          |               | compteur monte à 12 ; ils se dispersent : « Et l'info importante ? » - « Ratée. »        |
// | film     | 240 - 3 420   | la bande-annonce dans une fenêtre arrondie (1000 px) ; le bandeau de la marque en haut,  |
// |          |               | les sous-titres en bas, une barre de progression ; le fond suit la couleur de la scène   |
// | fin      | 3 420 - 3 660 | la fenêtre se réduit et s'efface ; le logo, « Conçu et développé par », les technos, l'adresse |
import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import {
  At, Backdrop, C, CAM, FPS, GlowKey, Glyph, GlyphName, H, Halo, IN, LIN, LogoMark, Sparks, Title, TOTAL, W, b, clamp, count, display,
  focus, glass, lerp, mix, pop, ramp, rgba, rnd, sans,
} from "./kit";
import { GLOW, Trailer } from "./Trailer";

// --- Le cadre et les trois parties -----------------------------------------------------------------------------------------
const LW = 1080, LH = 1350;
const s = (seconds: number) => Math.round(seconds * FPS);  // des secondes en images
const HOOK = s(4);  // l'accroche : 0 → 240
const END = HOOK + TOTAL;  // la bande-annonce finit ici ; la carte de fin dure 4 s
export const LI_TOTAL = HOOK + TOTAL + s(4);

// Le fond : des halos bleus pour l'accroche, puis la couleur de chaque scène du film (GLOW, décalée de l'accroche), puis le bleu
const LI_GLOW: readonly GlowKey[] = [
  [0, C.brand, 0.5], [s(2.6), C.brand, 0.95],
  ...GLOW.map(([at, color, a]) => [at + HOOK, color, a] as const),
  [END + 70, C.brand, 0.95], [LI_TOTAL, C.brand, 0.7],
];

const GRAD = `linear-gradient(100deg, ${C.brand}, ${C.violet})`;
// Un mot en couleur dégradée (la marque)
const Grad: React.FC<{ readonly children: React.ReactNode }> = ({ children }) => (
  <span style={{ background: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent" }}>{children}</span>
);

// Les poussières de lumière du kit sont calées sur 1920 × 1080 : on les agrandit pour remplir le cadre vertical
const SPARK_K = LH / H;
const FillSparks: React.FC<{ readonly f: number; readonly n: number; readonly seed: string; readonly color: string; readonly a: number }> = (props) => (
  <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0", transform: `translate(${(LW - W * SPARK_K) / 2}px, 0) scale(${SPARK_K})` }}>
    <Sparks {...props} />
  </div>
);

// Le grain du fond (kit) est une grille de 1 536 px de haut, posée au hasard : dans un cadre de 1 350 px elle laisse parfois une
// bande sans grain en bas (elle paraît plus noire). On y pose une rangée de grain, avec les mêmes décalages que le kit.
const GrainStrip: React.FC<{ readonly f: number }> = ({ f }) => {
  const gx = Math.floor(rnd(`gx${Math.floor(f / 2)}`) * 256), gy = Math.floor(rnd(`gy${Math.floor(f / 2)}`) * 256);
  const top = gy + 5 * 256;
  if (top >= LH) return null;
  return (
    <div style={{ position: "absolute", left: 0, top, width: LW, height: LH - top, opacity: 0.045, mixBlendMode: "screen", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: gx - 256, top: 0, width: 9 * 256, display: "flex" }}>
        {Array.from({ length: 9 }, (_, i) => <Img key={i} src={staticFile("grain.png")} style={{ width: 256, height: 256, display: "block" }} />)}
      </div>
    </div>
  );
};

// --- 1. L'accroche -----------------------------------------------------------------------------------------------------------
type Tab = { readonly label: string; readonly icon: GlyphName; readonly tint: string; readonly x: number; readonly y: number; readonly rot: number; readonly at: number };
// Six onglets, au-dessus et au-dessous du titre ; `at` : l'image où chacun surgit (dans le désordre)
const TABS: readonly Tab[] = [
  { label: "Newsletter", icon: "news", tint: C.brand, x: 270, y: 335, rot: -5, at: s(1.5) },
  { label: "Crypto", icon: "coin", tint: "#3DD6C6", x: 810, y: 305, rot: 4, at: s(1.3) },
  { label: "X / Twitter", icon: "bell", tint: "#ffffff", x: 540, y: 435, rot: -2, at: s(1.87) },
  { label: "CAC 40", icon: "chart", tint: C.up, x: 290, y: 955, rot: 5, at: s(1.7) },
  { label: "Taux BCE", icon: "bank", tint: C.violet, x: 790, y: 1015, rot: -4, at: s(2.28) },
  { label: "Résultats", icon: "calc", tint: C.amber, x: 520, y: 1135, rot: 3, at: s(2.07) },
];
const SCATTER = s(2.6);  // les onglets se dispersent
const TITLE2 = s(2.8);  // le second titre arrive
const RATEE = s(3.3);  // « Ratée. »

const TabPill: React.FC<{ readonly tab: Tab; readonly index: number; readonly f: number }> = ({ tab, index, f }) => {
  const p = pop(f, tab.at, 12, 160);
  const away = ramp(f, SCATTER + index * 4, SCATTER + index * 4 + 30, 0, 1, IN);
  const dx = tab.x - LW / 2, dy = tab.y - LH / 2, len = Math.hypot(dx, dy);
  const bob = Math.sin(f / 17 + index * 2) * 6;
  return (
    <At x={tab.x} y={tab.y} style={{
      transform: `translate(${(dx / len) * 1000 * away}px, ${bob + (dy / len) * 700 * away + 500 * away * away}px) rotate(${tab.rot + away * tab.rot * 5}deg) scale(${lerp(0.5, 1, clamp(p, 0, 1.2))})`,
      ...focus(clamp(p * 1.3, 0, 1) * (1 - away), 20),
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 14, padding: "16px 34px 16px 26px", borderRadius: 999, ...glass(1.5, 18, tab.tint),
        fontFamily: sans, fontWeight: 600, fontSize: 34, color: C.ink, whiteSpace: "nowrap",
      }}>
        <Glyph name={tab.icon} size={34} color={tab.tint} />{tab.label}
      </div>
    </At>
  );
};

const Hook: React.FC<{ readonly f: number }> = ({ f }) => {
  const fade = 1 - ramp(f, s(3.7), HOOK, 0, 1, IN);  // tout s'en va juste avant le film
  const hit = f - RATEE;
  const shake = hit < 0 ? 0 : Math.exp(-hit / 11);
  const rp = pop(f, RATEE, 11, 220);
  const counter = ramp(f, s(1.3), s(1.3) + 18) * (1 - ramp(f, SCATTER, SCATTER + 20, 0, 1, IN));
  return (
    <AbsoluteFill>
      <FillSparks f={f} n={26} seed="hook" color="#b8c8ff" a={0.35 * fade} />
      <At x={LW / 2} y={LH / 2 + 10}>
        <Title f={f} size={104} align="center" out={SCATTER - 6} words={[
          { t: "Combien", at: 6 }, { t: "d’applis", at: 10 },
          { t: "pour", at: 20, br: true }, { t: "suivre", at: 24 },
          { t: "la", at: 34, br: true }, { t: "bourse", at: 38, color: C.brand }, { t: "?", at: 42 },
        ]} />
      </At>

      {TABS.map((tab, i) => <TabPill key={tab.label} tab={tab} index={i} f={f} />)}
      <At x={LW / 2} y={150} style={{ ...focus(counter, 16), scale: String(lerp(0.9, 1, counter)) }}>
        <div style={{ textAlign: "center", whiteSpace: "nowrap" }}>
          <div style={{ fontFamily: display, fontWeight: 900, fontSize: 170, lineHeight: 0.95, letterSpacing: "-0.05em", color: mix(C.ink, C.down, ramp(f, s(1.3), s(2.5))) }}>
            {count(f, s(1.3), s(2.5), 1, 12)}
          </div>
          <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 30, color: C.muted }}>onglets ouverts</div>
        </div>
      </At>

      {f >= TITLE2 && (
        <>
          <At x={LW / 2} y={LH / 2 - 120}>
            <Title f={f} size={128} align="center" out={s(3.7)} words={[
              { t: "Et", at: TITLE2 }, { t: "l’info", at: TITLE2 + 4 },
              { t: "importante", at: TITLE2 + 12, color: C.brand, br: true }, { t: "?", at: TITLE2 + 16 },
            ]} />
          </At>
          <Halo x={LW / 2} y={LH / 2 + 190} r={420} color={C.down} a={0.4 * shake * fade} />
          <At x={LW / 2} y={LH / 2 + 190} style={{
            transform: `translate(${Math.sin(f * 2.1) * 10 * shake}px, ${Math.cos(f * 2.7) * 6 * shake}px) rotate(${Math.sin(f * 1.7) * 1.6 * shake}deg) scale(${lerp(1.5, 1, rp)})`,
            ...focus(clamp(rp * 1.3, 0, 1) * fade, 16),
            fontFamily: display, fontWeight: 900, fontSize: 210, letterSpacing: "-0.045em", lineHeight: 1, color: C.down, whiteSpace: "nowrap",
            textShadow: `0 0 50px ${rgba(C.down, 0.45)}`,
          }}>
            Ratée.
          </At>
        </>
      )}
    </AbsoluteFill>
  );
};

// --- 2. Le film : la fenêtre, le bandeau, les sous-titres, la progression --------------------------------------------------
const WIN_W = 1000, WIN_H = (WIN_W * H) / W, WIN_X = (LW - WIN_W) / 2, WIN_Y = 300, WIN_R = 28;

// La bande-annonce 1920 × 1080 réduite à 1000 px de large ; elle monte et se précise à son entrée, se réduit et s'efface à sa fin
const Window: React.FC<{ readonly f: number }> = ({ f }) => {
  const enter = ramp(f, HOOK, HOOK + s(0.6));
  const leave = ramp(f, END, END + s(0.5), 0, 1, CAM);
  if (f < HOOK || f >= END + s(0.5)) return null;
  return (
    <div style={{
      position: "absolute", left: WIN_X, top: WIN_Y, width: WIN_W, height: WIN_H, borderRadius: WIN_R, overflow: "hidden", background: "#000",
      boxShadow: `0 40px 90px -20px rgba(0,0,0,0.85), 0 0 80px ${rgba(C.brand, 0.16)}`,
      translate: `0 ${(1 - enter) * 60}px`, scale: String(lerp(1, 0.82, leave)),
      ...focus(enter * (1 - leave), 16),
    }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0", transform: `scale(${WIN_W / W})` }}>
        <Sequence from={HOOK} durationInFrames={TOTAL}><Trailer /></Sequence>
      </div>
      <div style={{ position: "absolute", inset: 0, borderRadius: WIN_R, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.10)", pointerEvents: "none" }} />
    </div>
  );
};

// Les sous-titres, calés sur les scènes du film : [début en temps musical, fin (undefined : jusqu'à la fin), avant, mot clé, après]
type Sub = readonly [number, number | undefined, string, string, string];
const SUBS: readonly Sub[] = [
  [0, 12, "Je vous présente ", "FinVeille", "."],
  [12, 28, "", "43 sources", " d’actualité financière, en un seul fil."],
  [28, 44, "Les marchés ", "en direct", ", de Tokyo à New York."],
  [44, 56, "L’économie et la crypto, ", "expliquées", "."],
  [56, 72, "Un assistant IA qui ", "cite ses sources", ", et des alertes de cours."],
  [72, 84, "Sur ordinateur ", "comme sur téléphone", "."],
  [84, undefined, "", "Gratuit", ", sans publicité. Lien en commentaire 👇"],
];

const Subtitle: React.FC<{ readonly sub: Sub; readonly f: number }> = ({ sub, f }) => {
  const from = HOOK + b(sub[0]), to = sub[1] === undefined ? END : HOOK + b(sub[1]);
  if (f < from || f > to) return null;
  const inn = ramp(f, from, from + s(0.3));
  const out = ramp(f, to - s(0.2), to, 0, 1, LIN);
  return (
    <div style={{
      position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
      translate: `0 ${(1 - inn) * 24}px`, opacity: inn * (1 - out),
      fontFamily: display, fontWeight: 700, fontSize: 52, lineHeight: 1.18, letterSpacing: "-0.02em", color: C.ink, textWrap: "balance",
    }}>
      <div>{sub[2]}<Grad>{sub[3]}</Grad>{sub[4]}</div>
    </div>
  );
};

// Le bandeau de la marque, les sous-titres et la barre de progression : fixes pendant tout le film
const Chrome: React.FC<{ readonly f: number }> = ({ f }) => {
  const show = ramp(f, HOOK, HOOK + s(0.5)) * (1 - ramp(f, END, END + s(0.4), 0, 1, IN));
  if (f < HOOK || show <= 0) return null;
  const progress = ramp(f, HOOK, END, 0, 1, LIN);
  return (
    <AbsoluteFill style={{ opacity: show }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 70, height: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <LogoMark size={64} p={ramp(f, HOOK + 4, HOOK + 40, 0, 1, LIN)} id="lt" />
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 60, letterSpacing: "-0.04em", lineHeight: 1 }}>
            <span style={{ color: C.ink }}>Fin</span><Grad>Veille</Grad>
          </div>
        </div>
        <div style={{ width: 820, textAlign: "center", fontFamily: sans, fontWeight: 500, fontSize: 28, lineHeight: 1.3, color: C.muted, textWrap: "balance" }}>
          Toute la finance qui compte, en un seul site
        </div>
      </div>
      <div style={{ position: "absolute", left: 90, top: 920, width: 900, height: 280 }}>
        {SUBS.map((sub) => <Subtitle key={sub[0]} sub={sub} f={f} />)}
      </div>
      <div style={{ position: "absolute", left: WIN_X, top: 1267, width: WIN_W, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
        <div style={{ width: `${progress * 100}%`, height: "100%", borderRadius: 3, background: GRAD, boxShadow: `0 0 14px ${rgba(C.brand, 0.7)}` }} />
      </div>
    </AbsoluteFill>
  );
};

// --- 3. La carte de fin ------------------------------------------------------------------------------------------------------
const STACK: readonly (readonly [string, string])[] = [["Python", C.amber], ["Streamlit", C.down], ["PostgreSQL", C.brand], ["IA", C.violet]];
const LOGO_AT = s(0.4);  // l'apparition du logo, en images depuis la fin du film

const EndCard: React.FC<{ readonly f: number }> = ({ f }) => {
  const e = f - END;
  if (e < 0) return null;
  const logo = pop(e, LOGO_AT, 14, 150);
  const url = ramp(e, 130, 148), more = ramp(e, 150, 168);
  return (
    <AbsoluteFill>
      <FillSparks f={f} n={34} seed="liend" color="#b8c8ff" a={0.45} />
      <Halo x={LW / 2} y={330} r={560} color={C.brand} a={0.34 * ramp(e, LOGO_AT, LOGO_AT + 40)} />
      <At x={LW / 2} y={330} style={{ scale: String(lerp(0.8, 1, logo)), ...focus(clamp(logo * 1.3, 0, 1), 16) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <div style={{ filter: "drop-shadow(0 0 30px rgba(59,108,255,0.6))" }}><LogoMark size={140} p={ramp(e, LOGO_AT, LOGO_AT + 40, 0, 1, LIN)} id="le" /></div>
          <div style={{ fontFamily: display, fontWeight: 900, fontSize: 112, letterSpacing: "-0.04em", lineHeight: 1, whiteSpace: "nowrap" }}>
            <span style={{ color: C.ink }}>Fin</span><Grad>Veille</Grad>
          </div>
        </div>
      </At>
      <At x={LW / 2} y={560}>
        <Title f={e} size={96} align="center" words={[{ t: "Conçu", at: 50 }, { t: "et", at: 54 }, { t: "développé", at: 60, color: C.brand }]} />
      </At>
      <At x={LW / 2} y={685} style={{ ...focus(ramp(e, 78, 96), 14), translate: `-50% calc(-50% + ${(1 - ramp(e, 78, 96)) * 16}px)`, fontFamily: sans, fontWeight: 500, fontSize: 46, color: C.muted, whiteSpace: "nowrap" }}>
        par <span style={{ color: C.ink, fontWeight: 600 }}>Yassine Zouhair</span>
      </At>
      <At x={LW / 2} y={830}>
        <div style={{ display: "flex", gap: 18 }}>
          {STACK.map(([label, tint], i) => {
            const p = pop(e, 100 + i * 9, 14, 170);
            return (
              <div key={label} style={{
                padding: "16px 34px", borderRadius: 999, ...glass(1.5, 16, tint), fontFamily: sans, fontWeight: 600, fontSize: 34, color: C.ink, whiteSpace: "nowrap",
                scale: String(lerp(0.6, 1, p)), ...focus(clamp(p * 1.3, 0, 1), 12),
              }}>
                {label}
              </div>
            );
          })}
        </div>
      </At>
      <At x={LW / 2} y={990} style={{ ...focus(url, 14), translate: `-50% calc(-50% + ${(1 - url) * 16}px)`, fontFamily: sans, fontWeight: 600, fontSize: 54, color: C.brand, whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
        finveille.streamlit.app
      </At>
      <At x={LW / 2} y={1082} style={{ ...focus(more, 14), translate: `-50% calc(-50% + ${(1 - more) * 12}px)`, fontFamily: sans, fontWeight: 500, fontSize: 38, color: C.muted, whiteSpace: "nowrap" }}>
        Vos retours m’intéressent !
      </At>
    </AbsoluteFill>
  );
};

// --- Le son de l'accroche et de la carte de fin : [fichier de public/sfx, image, volume] ----------------------------------------
const SFX: readonly (readonly [string, number, number])[] = [
  ...TABS.map((t) => ["tick", t.at, 0.3] as const),
  ["bell", s(1.5), 0.25], ["bell", s(2.2), 0.25], ["impact", RATEE, 0.5], ["whoosh", s(3.9), 0.35], ["click", END + LOGO_AT, 0.3],
];
const Sound: React.FC = () => (
  <>
    {SFX.map(([name, at, volume], i) => (
      <Sequence key={i} from={at} durationInFrames={s(3)} layout="none">
        <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
      </Sequence>
    ))}
  </>
);

export const LinkedIn: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <Backdrop f={f} glow={LI_GLOW} />
      <GrainStrip f={f} />
      {f < HOOK && <Hook f={f} />}
      <Window f={f} />
      <Chrome f={f} />
      <EndCard f={f} />
      <Sound />
    </AbsoluteFill>
  );
};
