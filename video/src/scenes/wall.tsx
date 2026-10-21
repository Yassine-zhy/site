// La scène D (temps 16 - 23,1) : le mur des 15 maquettes 3D. Un seul plan (la vidéo models-grid.mp4, masquée en tuiles arrondies)
// que la caméra incline, survole de gauche à droite, puis plonge dans la cloche, qui prolonge en plein écran (models/bell.mp4).
import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";
import { C, CAM, b, clamp, count, display, focus, glass, lerp, life, pop, ramp, rgba, sans } from "../kit";

// --- La grille : 15 tuiles 600 × 390, 5 colonnes × 3 lignes, 54 px d'écart, dans un plan de 3216 × 1278 -------------------------
const GW = 3216, GH = 1278, TW = 600, TH = 390, RX = 34;
const TILES = Array.from({ length: 15 }, (_, i) => {
  const col = i % 5, row = Math.floor(i / 5);
  return { col, row, x: col * 654, y: row * 444, dist: Math.hypot(col - 2, row - 1) };
});
const T0 = b(16);  // la vidéo du mur démarre ici

// Les images-clés de la caméra : centre du plan (cx, cy), inclinaison θ, rotation φ, échelle s
type Key = readonly [number, number, number, number, number, number];
const KEYS: readonly Key[] = [
  [b(16), 1608, 639, 0, 0, 1], [b(16.75), 1608, 639, 0, 0, 1], [b(17.5), 900, 640, 48, -12, 0.62],
  [b(20.5), 2300, 640, 52, -8, 0.7], [b(22), 2262, 639, 0, 0, 3.3],
];
const camera = (f: number) => {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= f) i++;
  const [a, ...ka] = KEYS[i], [z, ...kz] = KEYS[i + 1];
  const t = CAM(clamp((f - a) / (z - a), 0, 1));
  const [cx, cy, th, ph, s0] = ka, [cx1, cy1, th1, ph1, s1] = kz;
  // l'échelle s'interpole en géométrique : le zoom paraît régulier
  return { cx: lerp(cx, cx1, t), cy: lerp(cy, cy1, t), th: lerp(th, th1, t), ph: lerp(ph, ph1, t), s: Math.exp(lerp(Math.log(s0), Math.log(s1), t)) };
};

// Le survol : 9 tuiles de gauche à droite (en alternant les lignes), réparties de b(17,5) à b(20) ; la dernière est la cloche
const HOVER = [[0, 1], [1, 0], [1, 2], [2, 0], [2, 2], [2, 1], [3, 0], [3, 2], [3, 1]] as const;
const HOVER_AT: Record<number, number> = Object.fromEntries(
  HOVER.map(([col, row], k) => [row * 5 + col, Math.round(b(17.5) + (k * (b(20) - b(17.5))) / 8)]),
);
const UP = 8, DOWN = b(1);  // se soulève en 8 images, redescend sur un temps
const lift = (f: number, i: number) => {
  const t0 = HOVER_AT[i];
  return t0 === undefined ? 0 : ramp(f, t0, t0 + UP) * (1 - ramp(f, t0 + UP, t0 + UP + DOWN, 0, 1, CAM));
};

// Le masque des tuiles : une image SVG de 15 rectangles arrondis dont l'opacité varie d'une tuile à l'autre
const maskOf = (alpha: readonly number[]) => {
  const rects = TILES.map((t, i) => (alpha[i] > 0.002
    ? `<rect x='${t.x}' y='${t.y}' width='${TW}' height='${TH}' rx='${RX}' fill='#fff' fill-opacity='${alpha[i].toFixed(3)}'/>` : "")).join("");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${GW}' height='${GH}' viewBox='0 0 ${GW} ${GH}'>${rects}</svg>`;
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  return { WebkitMaskImage: url, maskImage: url, WebkitMaskSize: `${GW}px ${GH}px`, maskSize: `${GW}px ${GH}px`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat" } as React.CSSProperties;
};

// La vidéo des 15 maquettes (dans un Sequence qui la cale sur le début du mur), éventuellement décalée pour n'en montrer qu'une tuile
const Grid: React.FC<{ readonly style?: React.CSSProperties }> = ({ style }) => (
  <Sequence from={T0} layout="none">
    <Video src={staticFile("models-grid.mp4")} muted objectFit="fill" style={{ position: "absolute", width: GW, height: GH, ...style }} />
  </Sequence>
);

export const Wall: React.FC = () => {
  const f = useCurrentFrame();
  if (f < T0 || f >= b(23.1)) return null;

  const cam = camera(f);

  // Apparition : la tuile centrale d'abord (quand la réponse a déjà rétréci), les autres décalées de 4 images par tuile de distance
  const appear = TILES.map((t) => ramp(f, T0 + 10 + Math.round(4 * t.dist), T0 + 10 + Math.round(4 * t.dist) + 20));
  const appearing = f < T0 + 40;
  // Une tuile survolée est remplacée dans le plan par sa propre copie, qui se soulève ; le trou est comblé par la copie
  const copyOn = (i: number) => HOVER_AT[i] !== undefined && f >= HOVER_AT[i] - 8 && f < HOVER_AT[i] + UP + DOWN + 6;
  const holed = (i: number) => HOVER_AT[i] !== undefined && f >= HOVER_AT[i] && f < HOVER_AT[i] + UP + DOWN + 3;
  const baseAlpha = TILES.map((_, i) => (holed(i) ? 0 : appear[i]));
  const blurAlpha = TILES.map((_, i) => clamp(appear[i] * 1.4, 0, 1) * (1 - appear[i]));

  // La légende de verre
  const pill = life(f, b(18), 14, b(20.25), b(20.75) - b(20.25));
  const pillIn = pop(f, b(18));

  // La cloche en plein écran : même phase de boucle que dans le mur (temps local du mur = f − b(16), boucle de 150 images)
  const bellAt = b(21.75);
  const bellFrom = T0 + Math.floor((bellAt - T0) / 150) * 150;
  const bellA = ramp(f, bellAt, b(22.25), 0, 1, CAM);

  // La sortie : la cloche se floute et s'éteint (la cloche vectorielle de la scène E prend le relais)
  const out = ramp(f, b(22.25), b(23), 0, 1, CAM);

  return (
    <AbsoluteFill style={{ opacity: 1 - out, filter: out > 0.001 ? `blur(${24 * out}px)` : undefined }}>
      <AbsoluteFill style={{ perspective: 1800 }}>
        <div style={{
          position: "absolute", left: 960 - cam.cx, top: 540 - cam.cy, width: GW, height: GH, transformStyle: "preserve-3d",
          transformOrigin: `${cam.cx}px ${cam.cy}px`, transform: `rotateX(${cam.th}deg) rotateZ(${cam.ph}deg) scale(${cam.s})`,
        }}>
          {/* la vidéo, masquée en tuiles */}
          <div style={{ position: "absolute", left: 0, top: 0, width: GW, height: GH, ...maskOf(baseAlpha) }}>
            <Grid style={{ left: 0, top: 0 }} />
          </div>
          {/* pendant l'apparition, une copie floue donne la mise au point */}
          {appearing && (
            <div style={{ position: "absolute", left: 0, top: 0, width: GW, height: GH, filter: "blur(16px)", ...maskOf(blurAlpha) }}>
              <Grid style={{ left: 0, top: 0 }} />
            </div>
          )}
          {/* les cadres, et la copie soulevée des tuiles survolées */}
          {TILES.map((t, i) => {
            const L = lift(f, i), p = appear[i];
            return (
              <div key={i} style={{
                position: "absolute", left: t.x, top: t.y, width: TW, height: TH,
                transform: L > 0 ? `translateZ(${40 * L}px) scale(${lerp(1, 1.04, L)})` : undefined,
              }}>
                {copyOn(i) && (
                  <div style={{ position: "absolute", inset: 0, borderRadius: RX, overflow: "hidden" }}>
                    <Grid style={{ left: -t.x, top: -t.y }} />
                  </div>
                )}
                <div style={{
                  position: "absolute", inset: 0, boxSizing: "border-box", borderRadius: RX, ...focus(p, 14),
                  border: `2px solid rgba(${lerp(255, 109, L)},${lerp(255, 147, L)},${lerp(255, 255, L)},${lerp(0.14, 0.95, L)})`,
                  boxShadow: L > 0.001 ? `0 0 ${40 * L}px ${rgba(C.brand, 0.75 * L)}, inset 0 0 ${24 * L}px ${rgba(C.brand, 0.18 * L)}` : undefined,
                }} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* la légende, dans l'écran */}
      {pill > 0.001 && (
        <div style={{ position: "absolute", left: 960, top: 150, translate: "-50% -50%", transform: `scale(${lerp(0.88, 1, pillIn)})`, ...focus(pill, 16) }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, padding: "14px 36px 16px 30px", borderRadius: 999, whiteSpace: "nowrap", ...glass(1.5, 22) }}>
            <span style={{ fontFamily: display, fontWeight: 800, fontSize: 44, lineHeight: "52px", color: C.ink, width: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {count(f, b(18), b(19), 0, 17)}
            </span>
            <span style={{ fontFamily: sans, fontWeight: 500, fontSize: 30, color: C.muted, WebkitFontSmoothing: "antialiased" }}>maquettes 3D, une par page</span>
          </div>
        </div>
      )}

      {/* la plongée s'achève sur la cloche seule, en plein écran, qui coïncide avec la tuile */}
      {f >= bellFrom && bellA > 0 && (
        <AbsoluteFill style={{ opacity: bellA }}>
          <Sequence from={bellFrom} layout="none">
            <Video src={staticFile("models/bell.mp4")} muted loop objectFit="fill"
              style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transform: "scale(1.19)", transformOrigin: "50% 50%" }} />
          </Sequence>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
