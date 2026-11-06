// Scènes 4 et 5 (8 temps, puis 1 temps : un seul plan) : sur le gris papier, les icônes reviennent et se rangent en anneau qui
// tourne en perspective (ellipse ; celles du fond plus petites et floues, celles de devant plus grandes et nettes), de plus en
// plus vite, avec une traînée grise floue ; « et si tout tenait au même endroit ? » en dessous. L'anneau ralentit et le logo se
// reconstitue en pixels au centre, sur un temps (`LOGO_POP`) ; on a ensuite le temps de lire. Pendant la scène 5, la caméra fonce
// à travers le logo (×1 → ×12 en 14 images, puis le bleu remplit l'écran et un éclat blanc coupe sur la scène suivante). Avant de
// foncer, la caméra recule un peu (anticipation) ; le logo se pose avec un petit punch d'échelle. L'entrée se fait en « cut the
// curve » vers la gauche, dans le sens de la sortie de la scène 3. Le temps est celui du plan : 0 = début de la scène 4 (c'est
// là que la musique repart fort), la scène 5 commence à `ZOOM_AT`.
import React from "react";
import { LogoMark, CAM, IN, LIN, clamp, lerp, pop, ramp } from "../kit";
import { Icon, Layer, PWord, Shot, Words, pixelClip, punch } from "./fx";
import { SCENE, span } from "./montage";
import { SpriteName } from "./sprites";
import { random } from "remotion";

export const RING_SLOW = 150, LOGO_POP = 200, ZOOM_AT = SCENE.zoomLogo.from - SCENE.anneau.from, ZOOM_END = span("anneau", "zoomLogo").len;
export const RING_WORDS = [12, 18, 24, 30, 42, 48, 54];
const NAMES: readonly SpriteName[] = ["piece", "graphique", "cloche", "journal", "telephone", "bitcoin", "billet", "globe", "loupe", "tirelire"];
const CX = 540, CY = 590, RX = 385, RY = 178;

// La vitesse de l'anneau en degrés par image : elle accélère de 0 à 120, tient jusqu'à RING_SLOW, retombe en 34 images ; l'angle est la somme
const speed = (u: number) => (u < 0 ? 0 : 1.2 + 10.5 * ramp(u, 0, 120, 0, 1, IN) * (1 - ramp(u, RING_SLOW, RING_SLOW + 34, 0, 1)));
export const ringNorm = (u: number) => speed(u) / 11.7;  // la vitesse de l'anneau, de 0 à 1 (le son la suit)
const angle = (f: number) => { let a = 0; for (let u = 0; u < f; u++) a += speed(u); return a; };

// La caméra : elle recule un peu pendant les 18 images avant ZOOM_AT (anticipation), puis fonce dans le logo (×12 en 14 images,
// accélération forte) et continue jusqu'à la fin de la scène 5
const ANTI = 0.955;
const camScale = (f: number) => {
  if (f < ZOOM_AT - 18) return 1;
  if (f < ZOOM_AT) return lerp(1, ANTI, ramp(f, ZOOM_AT - 18, ZOOM_AT, 0, 1, CAM));
  if (f < ZOOM_AT + 14) return ANTI * Math.exp(Math.log(12 / ANTI) * ramp(f, ZOOM_AT, ZOOM_AT + 14, 0, 1, IN));
  return 12 * Math.exp(Math.log(4) * ramp(f, ZOOM_AT + 14, ZOOM_END, 0, 1, LIN));
};

export const Anneau: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f >= ZOOM_END) return null;
  const base = angle(f), w = speed(f);
  const items = NAMES.map((name, i) => {
    const th = ((base + i * 36) * Math.PI) / 180;
    const depth = Math.sin(th);
    const e = ramp(f, i * 3, 36 + i * 3, 0, 1);
    const sx = 110 + random(`rsx${i}`) * 860, sy = 140 + random(`rsy${i}`) * 1060;
    const x = lerp(sx, CX + RX * Math.cos(th), e), y = lerp(sy, CY + RY * Math.sin(th), e);
    const k = lerp(0.62, 1.22, (depth + 1) / 2);
    return { name, th, depth, x, y, e, k, rot: (1 - e) * (random(`rr${i}`) * 200 - 100) + 4 * Math.sin(f / 20 + i), size: 104 * lerp(1, k, e), blur: e * Math.max(0, -depth) * 3.2 + e * clamp((w - 3) * 0.35, 0, 3) };
  });
  // La traînée : trois bouts d'arc de plus en plus pâles derrière chaque icône, floutés ; seulement quand l'anneau tourne vite
  const trail = clamp((w - 2.5) / 6, 0, 1);
  const arc = (a0: number, a1: number) => {
    const pts = Array.from({ length: 7 }, (_, s) => { const t = lerp(a0, a1, s / 6); return `${CX + RX * Math.cos(t)} ${CY + RY * Math.sin(t)}`; });
    return `M ${pts.join(" L ")}`;
  };
  const delta = ((clamp(w * 6, 0, 80) * Math.PI) / 180);
  const ringE = ramp(f, 30, 60);
  const s = camScale(f), k = ZOOM_AT;
  const logoP = ramp(f, LOGO_POP - 26, LOGO_POP, 0, 1, LIN);
  const words: PWord[] = [
    { t: "et", at: RING_WORDS[0] }, { t: "si", at: RING_WORDS[1] }, { t: "tout", at: RING_WORDS[2] }, { t: "tenait", at: RING_WORDS[3] },
    { t: "au", at: RING_WORDS[4], br: true }, { t: "même", at: RING_WORDS[5] }, { t: "endroit ?", at: RING_WORDS[6] },
  ];
  const sorted = [...items].sort((a, b) => a.depth - b.depth);
  const logoScale = (0.88 + 0.12 * pop(f, LOGO_POP - 2, 12, 170)) * punch(f, ZOOM_AT - 12, 0.08, 3, 16);
  return (
    <>
      <Shot f={f} from={0} to={ZOOM_END} enter="left">
        <div style={{ position: "absolute", inset: 0, transformOrigin: `${CX}px ${CY}px`, scale: String(s) }}>
          {trail > 0.02 && ringE > 0.5 && (
            <svg width={1080} height={1350} style={{ position: "absolute", inset: 0, overflow: "visible", filter: "blur(16px)", opacity: Math.min(1, trail * 1.1) }}>
              {items.map((it, i) => [0, 1, 2].map((j) => (
                <path key={`${i}${j}`} d={arc(it.th - (delta * (j + 1)) / 3, it.th - (delta * j) / 3)} fill="none" stroke="#7E8499" strokeLinecap="round"
                  strokeWidth={78 * it.k} opacity={0.62 * (1 - j * 0.28) * (0.4 + 0.6 * (it.depth + 1) / 2)} />
              )))}
            </svg>
          )}
          <Layer f={f} k={0.5}>
            {sorted.map((it) => <Icon key={it.name} name={it.name} x={it.x} y={it.y} size={it.size} rot={it.rot} blur={it.blur} opacity={lerp(0.75, 1, (it.depth + 1) / 2)} scale={clamp(it.e * 3, 0, 1)} />)}
            {logoP > 0.001 && (
              <div style={{ position: "absolute", left: CX - 75, top: CY - 75, width: 150, height: 150, scale: String(logoScale), clipPath: pixelClip(150, 150, 10, logoP, "logo") }}>
                <LogoMark size={150} p={1} id="px" />
              </div>
            )}
          </Layer>
          <Layer f={f} k={0.9}>
            <div style={{ position: "absolute", left: 0, right: 0, top: 985, opacity: 1 - ramp(f, ZOOM_AT, ZOOM_AT + 6) }}><Words words={words} f={f} /></div>
          </Layer>
        </div>
      </Shot>
      {f >= k + 20 && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: ramp(f, k + 24, ZOOM_END - 1, 0, 1, LIN) }} />}
    </>
  );
};
