// Scènes 4 et 5 (420 → 640) : sur le gris papier, les icônes reviennent et se rangent en anneau qui tourne en perspective
// (ellipse ; celles du fond plus petites et floues, celles de devant plus grandes et nettes), de plus en plus vite, avec une
// traînée grise floue ; « et si tout tenait au même endroit ? » en dessous. À 560 l'anneau ralentit et le logo se
// reconstitue en pixels au centre. De 600 à 640, la caméra fonce à travers le logo (×1 → ×12 en 14 images, puis le bleu
// remplit l'écran et un éclat blanc coupe sur la scène suivante). Avant de foncer, la caméra recule un peu (anticipation) ; le
// logo se pose avec un petit punch d'échelle. L'entrée se fait en « cut the curve » vers la gauche, dans le sens de la sortie de
// la scène 3.
import React from "react";
import { LogoMark, CAM, IN, LIN, clamp, lerp, pop, ramp } from "../kit";
import { Icon, Layer, PWord, Shot, Words, pixelClip, punch } from "./fx";
import { SpriteName } from "./sprites";
import { random } from "remotion";

export const RING_FROM = 420, RING_SLOW = 560, ZOOM_AT = 600, ZOOM_END = 640;
const NAMES: readonly SpriteName[] = ["piece", "graphique", "cloche", "journal", "telephone", "bitcoin", "billet", "globe", "loupe", "tirelire"];
const CX = 540, CY = 590, RX = 385, RY = 178;

// La vitesse de l'anneau en degrés par image : elle accélère de 420 à 540, retombe de 548 à 578 ; l'angle est la somme
const speed = (u: number) => (u < RING_FROM ? 0 : 1.2 + 10.5 * ramp(u, RING_FROM, 540, 0, 1, IN) * (1 - ramp(u, 548, 578, 0, 1)));
const angle = (f: number) => { let a = 0; for (let u = RING_FROM; u < f; u++) a += speed(u); return a; };

// La caméra : elle recule un peu de 588 à 600 (anticipation), puis fonce dans le logo (×12 en 14 images, accélération forte)
// et continue jusqu'à 640
const ANTI = 0.955;
const camScale = (f: number) => {
  if (f < 588) return 1;
  if (f < ZOOM_AT) return lerp(1, ANTI, ramp(f, 588, ZOOM_AT, 0, 1, CAM));
  if (f < ZOOM_AT + 14) return ANTI * Math.exp(Math.log(12 / ANTI) * ramp(f, ZOOM_AT, ZOOM_AT + 14, 0, 1, IN));
  return 12 * Math.exp(Math.log(4) * ramp(f, ZOOM_AT + 14, ZOOM_END, 0, 1, LIN));
};

export const Anneau: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f < RING_FROM || f >= ZOOM_END) return null;
  const base = angle(f), w = speed(f);
  const items = NAMES.map((name, i) => {
    const th = ((base + i * 36) * Math.PI) / 180;
    const depth = Math.sin(th);
    const e = ramp(f, RING_FROM + i * 3, RING_FROM + 36 + i * 3, 0, 1);
    const sx = 110 + random(`rsx${i}`) * 860, sy = 140 + random(`rsy${i}`) * 1060;
    const x = lerp(sx, CX + RX * Math.cos(th), e), y = lerp(sy, CY + RY * Math.sin(th), e);
    const k = lerp(0.62, 1.22, (depth + 1) / 2);
    return { name, th, depth, x, y, e, k, rot: (1 - e) * (random(`rr${i}`) * 200 - 100) + 4 * Math.sin(f / 20 + i), size: 112 * lerp(1, k, e), blur: e * Math.max(0, -depth) * 3.2 + e * clamp((w - 3) * 0.35, 0, 3) };
  });
  // La traînée : trois bouts d'arc de plus en plus pâles derrière chaque icône, floutés ; seulement quand l'anneau tourne vite
  const trail = clamp((w - 2.5) / 6, 0, 1);
  const arc = (a0: number, a1: number) => {
    const pts = Array.from({ length: 7 }, (_, s) => { const t = lerp(a0, a1, s / 6); return `${CX + RX * Math.cos(t)} ${CY + RY * Math.sin(t)}`; });
    return `M ${pts.join(" L ")}`;
  };
  const delta = ((clamp(w * 6, 0, 80) * Math.PI) / 180);
  const ringE = ramp(f, RING_FROM + 30, RING_FROM + 60);
  const s = camScale(f), k = ZOOM_AT;
  const logoP = ramp(f, 564, 590, 0, 1, LIN);
  const words: PWord[] = [{ t: "et", at: 438 }, { t: "si", at: 445 }, { t: "tout", at: 452 }, { t: "tenait", at: 459 }, { t: "au", at: 466 }, { t: "même", at: 473 }, { t: "endroit ?", at: 480 }];
  const sorted = [...items].sort((a, b) => a.depth - b.depth);
  const logoScale = (0.88 + 0.12 * pop(f, 562, 12, 170)) * punch(f, 588, 0.08, 3, 16);
  return (
    <>
      <Shot f={f} from={RING_FROM} to={ZOOM_END} enter="left">
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
            <div style={{ position: "absolute", left: 0, right: 0, top: 990, opacity: 1 - ramp(f, ZOOM_AT, ZOOM_AT + 6) }}><Words words={words} f={f} /></div>
          </Layer>
        </div>
      </Shot>
      {f >= k + 24 && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: ramp(f, k + 28, ZOOM_END - 1, 0, 1, LIN) }} />}
    </>
  );
};
