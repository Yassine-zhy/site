// La caméra dans la fenêtre : un zoom sur une zone du vrai site, par une transformation CSS de la vidéo (la fenêtre garde son
// cadre et coupe ce qui dépasse). La caméra est décrite par des images clés : le centre (x, y, en fraction de la vidéo) et le
// grossissement `s` ; entre deux clés elle glisse (courbe douce, grossissement interpolé en logarithme : pas de saut), ou elle
// COUPE si `dur` vaut 0. Les clés tombent sur des temps de la musique (voir montage.ts). Un léger flottement continu (souffle
// de ±2 % et dérive de quelques pixels) empêche l'image de se figer, et un flou de mouvement accompagne les glissements rapides.
import React from "react";
import { CAM, clamp, lerp, ramp } from "../kit";

// at : l'image (locale) où le mouvement commence ; dur : sa durée (0 = coupe franche)
export type Cam = { readonly at: number; readonly dur: number; readonly x: number; readonly y: number; readonly s: number };

// La première clé est l'état de départ ; les suivantes sont des mouvements, dans l'ordre
export const camera = (f: number, keys: readonly Cam[]): { readonly x: number; readonly y: number; readonly s: number } => {
  let a = keys[0];
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    const t = k.dur > 0 ? ramp(f, k.at, k.at + k.dur, 0, 1, CAM) : f >= k.at ? 1 : 0;
    if (t <= 0) return a;
    if (t < 1) return { x: lerp(a.x, k.x, t), y: lerp(a.y, k.y, t), s: Math.exp(lerp(Math.log(a.s), Math.log(k.s), t)) };
    a = k;
  }
  return a;
};

export const ZoomView: React.FC<{
  readonly f: number; readonly w: number; readonly h: number; readonly keys: readonly Cam[]; readonly children: React.ReactNode;
}> = ({ f, w, h, keys, children }) => {
  // le souffle : lent, continu (jamais de saut entre deux images)
  const view = (g: number) => {
    const c = camera(g, keys), s = c.s * (1 + 0.02 * Math.sin(g / 47));
    const x = clamp(c.x + 0.004 * Math.sin(g / 61 + 1), 0.5 / s, 1 - 0.5 / s), y = clamp(c.y + 0.004 * Math.sin(g / 53), 0.5 / s, 1 - 0.5 / s);
    return { s, tx: w / 2 - x * w * s, ty: h / 2 - y * h * s };
  };
  const v = view(f), p = view(f - 1);
  const move = Math.hypot(v.tx - p.tx, v.ty - p.ty) + Math.abs(Math.log(v.s / p.s)) * w * 0.5;  // px par image
  const blur = clamp((move - 1.5) * 0.06, 0, 2.5);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, transformOrigin: "0 0", translate: `${v.tx}px ${v.ty}px`, scale: String(v.s), filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}>
        {children}
      </div>
    </div>
  );
};
