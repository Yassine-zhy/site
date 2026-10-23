// Un sprite pixel art dessiné en SVG : chaque pixel est un carré net, regroupé par couleur en un seul tracé. L'épaisseur 3D
// (l'effet voxel) est faite en redessinant le sprite `depth` fois, décalé d'un pixel vers le bas et la droite, dans une
// teinte plus sombre. Le sprite de 24 × 24 pixels est centré dans une boîte de `size` px (l'épaisseur déborde un peu).
import React from "react";
import { mix } from "../kit";
import { Palette, Sprite as SpriteData } from "./sprites";

type Run = { readonly x: number; readonly y: number; readonly w: number; readonly ch: string };
const RUNS = new WeakMap<SpriteData, readonly Run[]>();
const runsOf = (s: SpriteData): readonly Run[] => {
  const cached = RUNS.get(s);
  if (cached) return cached;
  const runs: Run[] = [];
  s.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === ".") { x++; continue; }
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w++;
      runs.push({ x, y, w, ch });
      x += w;
    }
  });
  RUNS.set(s, runs);
  return runs;
};

const layerPaths = (runs: readonly Run[], pal: Palette, dx: number, keyPrefix: string) => {
  const byColor = new Map<string, string>();
  for (const r of runs) {
    const c = pal[r.ch];
    byColor.set(c, `${byColor.get(c) ?? ""}M${r.x + dx} ${r.y + dx}h${r.w}v1h${-r.w}z`);
  }
  return [...byColor.entries()].map(([c, d]) => <path key={keyPrefix + c} d={d} fill={c} stroke={c} strokeWidth={0.04} />);
};
// L'épaisseur : la silhouette entière, d'une seule teinte (la couleur « de côté » du sprite, assombrie), un tracé par couche
const silhouette = (runs: readonly Run[], dx: number) => runs.map((r) => `M${r.x + dx} ${r.y + dx}h${r.w}v1h${-r.w}z`).join("");

export const Sprite: React.FC<{
  readonly sprite: SpriteData; readonly size: number; readonly depth?: number; readonly rot?: number; readonly blur?: number;
  readonly opacity?: number; readonly scaleX?: number; readonly palette?: Palette; readonly shade?: number; readonly glow?: string;
  readonly style?: React.CSSProperties;
}> = ({ sprite, size, depth = 5, rot = 0, blur = 0, opacity = 1, scaleX = 1, palette, shade = 0.3, glow, style }) => {
  const pal = palette ? { ...sprite.palette, ...palette } : sprite.palette;
  const runs = runsOf(sprite), side = pal.side ?? pal.c ?? pal.k;
  const unit = size / 24, box = (24 + depth) * unit;
  const filters = [blur > 0.05 ? `blur(${blur}px)` : "", glow ? `drop-shadow(0 0 ${size * 0.06}px ${glow}) drop-shadow(0 0 ${size * 0.22}px ${glow})` : ""].filter(Boolean).join(" ");
  return (
    <div style={{ width: size, height: size, position: "relative", opacity, transform: `rotate(${rot}deg) scaleX(${scaleX})`, filter: filters || undefined, ...style }}>
      <svg width={box} height={box} viewBox={`0 0 ${24 + depth} ${24 + depth}`} shapeRendering="crispEdges"
        style={{ position: "absolute", left: (-depth * unit) / 2, top: (-depth * unit) / 2, overflow: "visible" }}>
        {Array.from({ length: depth }, (_, i) => depth - i).map((k) => (
          <path key={k} d={silhouette(runs, k)} fill={mix(side, "#000000", Math.min(0.9, shade + 0.05 * k))} stroke={mix(side, "#000000", Math.min(0.9, shade + 0.05 * k))} strokeWidth={0.04} />
        ))}
        <g>{layerPaths(runs, pal, 0, "f")}</g>
      </svg>
    </div>
  );
};

// Le centre visuel d'un sprite épais centré en (x, y) : la face claire est décalée d'un demi-pixel d'épaisseur vers le haut et la
// gauche, et l'épaisseur sombre ne compte qu'en partie dans ce que l'œil voit (`share` : 0 = la face seule, 0,5 = toute la boîte)
export const visualCenter = (x: number, y: number, size: number, depth: number, share = 0.25): readonly [number, number] => {
  const o = ((share - 0.5) * depth * size) / 24;
  return [x + o, y + o];
};
