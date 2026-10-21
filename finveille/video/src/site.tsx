// Les séquences filmées dans le vrai site : fenêtre arrondie, caméra recadrée sur ce que la voix nomme, cadre de surbrillance, curseur.
import { Video } from "@remotion/media";
import React, { useEffect, useState } from "react";
import { Freeze, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { CAM, COLORS, IN, OUT, clamp, lerp, ramp, sans, useAbs } from "./kit";

// --- Lecture d'un JSON de public/ au rendu (delayRender : le rendu attend la réponse) --------------------------------------
const jsonCache = new Map<string, unknown>();
export const useJson = <T,>(path: string | undefined): T | null => {
  const [data, setData] = useState<T | null>(() => (path !== undefined && jsonCache.has(path) ? (jsonCache.get(path) as T) : null));
  const [handle] = useState(() => (path !== undefined && !jsonCache.has(path) ? delayRender(`json ${path}`) : null));
  useEffect(() => {
    if (handle === null || path === undefined) return;
    fetch(staticFile(path))
      .then((r) => r.json())
      .then((d) => {
        jsonCache.set(path, d);
        setData(d as T);
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  }, [handle, path]);
  return data;
};

// Les événements d'une séquence (images où le clic, la frappe, l'envoi, la réponse ont lieu), avec une valeur de secours
export const useEvents = <T extends Record<string, number>>(name: string, fallback: T): T => {
  const ev = useJson<Partial<T>>(`footage/${name}.events.json`);
  return { ...fallback, ...(ev ?? {}) };
};

// --- La caméra : un centre et un zoom (1 = la séquence entière sur la largeur de la fenêtre), en coordonnées 1920 × 1080 ------
export type CamKey = { readonly f: number; readonly cx: number; readonly cy: number; readonly z: number };
export const camAt = (keys: readonly CamKey[], f: number) => {
  if (f <= keys[0].f) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i].f) {
      const a = keys[i - 1], b = keys[i];
      const t = CAM((f - a.f) / Math.max(1, b.f - a.f));
      return { f, cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), z: lerp(a.z, b.z, t) };
    }
  }
  return keys[keys.length - 1];
};

export type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
export type Rect = readonly [number, number, number, number];  // x0, y0, x1, y1 dans la séquence d'origine
export type Mark = { readonly rect: Rect; readonly at: number; readonly until?: number; readonly pad?: number };
const BAR = 38;

type CursorRow = readonly [number, number, number, number];

const SiteWindow: React.FC<{
  readonly name: string;  // footage/<name>.mp4
  readonly box: Box;
  readonly sync: readonly [number, number];  // [image absolue, image de la séquence qui y tombe]
  readonly len: number;  // images de la séquence
  readonly cam: readonly CamKey[];
  readonly rate?: number; readonly hold?: number;  // vitesse de lecture ; dernière image de la séquence qu'on laisse jouer
  readonly marks?: readonly Mark[]; readonly cursor?: boolean;
  readonly enter?: number; readonly exit?: number;  // arrivée et sortie (images absolues)
  readonly children?: React.ReactNode;
}> = ({ name, box, sync, len, cam, rate = 1, hold, marks = [], cursor = false, enter, exit, children }) => {
  const f = useAbs();
  const local = useCurrentFrame();
  const rows = useJson<CursorRow[]>(cursor ? `footage/${name}.cursor.json` : undefined);
  const ffAt = (abs: number) => sync[1] + (abs - sync[0]) * rate;
  const hi = Math.min(len - 1, hold ?? len - 1);
  const ff = clamp(ffAt(f), 0, hi);
  const tb = clamp(Math.round(ffAt(f - local)), 0, hi);
  const F = Math.max(0, (ff - tb) / rate);

  const ch = box.h - BAR;
  const c = camAt(cam, f);
  const s = (box.w / 1920) * c.z;  // pixels d'écran par pixel de la séquence
  const vw = box.w / s, vh = ch / s;
  const cx = vw >= 1920 ? 960 : clamp(c.cx, vw / 2, 1920 - vw / 2), cy = vh >= 1080 ? 540 : clamp(c.cy, vh / 2, 1080 - vh / 2);
  const ox = cx - vw / 2, oy = cy - vh / 2;
  const sx = (x: number) => (x - ox) * s, sy = (y: number) => (y - oy) * s;

  const inT = enter === undefined ? 1 : ramp(f, enter, enter + 12);
  const outT = exit === undefined ? 0 : ramp(f, exit, exit + 9, [0, 1], IN);
  const op = inT * (1 - outT);

  return (
    <div
      style={{
        position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, opacity: op,
        transform: `translateY(${(1 - inT) * 90 + outT * 40}px) scale(${lerp(0.93, 1, inT)})`,
      }}
    >
      <div style={{ position: "absolute", inset: 0, borderRadius: 22, overflow: "hidden", background: "#0a0f1b", boxShadow: "0 60px 120px -30px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.10)" }}>
        <div style={{ position: "absolute", left: 0, top: BAR, width: box.w, height: ch, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transformOrigin: "0 0", transform: `translate(${-ox * s}px, ${-oy * s}px) scale(${s})` }}>
            <Freeze frame={F}>
              <Video src={staticFile(`footage/${name}.mp4`)} trimBefore={tb} playbackRate={rate} muted objectFit="fill" style={{ width: 1920, height: 1080 }} />
            </Freeze>
          </div>
          {rows ? <Cursor rows={rows} idx={ff} rate={rate} s={s} sx={sx} sy={sy} /> : null}
          <svg width={box.w} height={ch} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            {marks.map((m, i) => (
              <Frame key={i} rect={m.rect} at={m.at} until={m.until} pad={m.pad ?? 10} sx={sx} sy={sy} s={s} />
            ))}
          </svg>
        </div>
        <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: BAR, background: "#0b1120", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", left: 18, display: "flex", gap: 8 }}>
            {["#FF6375", "#F5B544", "#34D17F"].map((col) => <span key={col} style={{ width: 11, height: 11, borderRadius: "50%", background: col, opacity: 0.8 }} />)}
          </div>
          <div style={{ padding: "0 18px", height: 24, borderRadius: 12, background: "#151d30", display: "flex", alignItems: "center", gap: 8, fontFamily: sans, fontWeight: 500, fontSize: 15, color: COLORS.muted }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.dot }} />
            finveille.streamlit.app
          </div>
        </div>
      </div>
      {children}
    </div>
  );
};
export { SiteWindow };

// --- Le cadre de surbrillance : contour bleu de 4 px, coins de 12 px, qui se dessine en 8 images -------------------------------
const Frame: React.FC<{
  readonly rect: Rect; readonly at: number; readonly until?: number; readonly pad: number;
  readonly sx: (x: number) => number; readonly sy: (y: number) => number; readonly s: number;
}> = ({ rect, at, until, pad, sx, sy }) => {
  const f = useAbs();
  const draw = ramp(f, at, at + 8, [0, 1], OUT);
  const gone = until === undefined ? 0 : ramp(f, until, until + 6, [0, 1], IN);
  if (f < at || gone >= 1) return null;
  const x = sx(rect[0]) - pad, y = sy(rect[1]) - pad, w = sx(rect[2]) - sx(rect[0]) + pad * 2, h = sy(rect[3]) - sy(rect[1]) + pad * 2;
  return (
    <g opacity={1 - gone}>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={COLORS.brand} fillOpacity={0.1 * draw} />
      <rect x={x} y={y} width={w} height={h} rx={12} fill="none" stroke={COLORS.brand} strokeWidth={4} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw}
        style={{ filter: "drop-shadow(0 0 12px rgba(109,147,255,0.9))" }} />
    </g>
  );
};

// --- Le curseur : flèche blanche cernée de noir, d'après <nom>.cursor.json, avec un cercle qui s'élargit au clic ---------------
const isDown = (b: number) => b > 0;
const Cursor: React.FC<{
  readonly rows: readonly CursorRow[]; readonly idx: number; readonly rate: number; readonly s: number;
  readonly sx: (x: number) => number; readonly sy: (y: number) => number;
}> = ({ rows, idx, rate, s, sx, sy }) => {
  if (rows.length === 0 || idx < rows[0][0]) return null;
  let j = 0;
  while (j < rows.length - 1 && rows[j + 1][0] <= idx) j++;
  const a = rows[j], b = rows[Math.min(j + 1, rows.length - 1)];
  const t = b[0] > a[0] ? clamp((idx - a[0]) / (b[0] - a[0]), 0, 1) : 0;
  const x = sx(lerp(a[1], b[1], t)), y = sy(lerp(a[2], b[2], t));
  let press = -1;  // l'image où le bouton s'est enfoncé le plus récemment
  for (let i = 0; i <= j; i++) if (isDown(rows[i][3]) && (i === 0 || !isDown(rows[i - 1][3]))) press = rows[i][0];
  const age = press < 0 ? 99 : (idx - press) / rate;
  const ring = ramp(age, 0, 16);
  const k = clamp(s * 1.25, 0.9, 2.2);
  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none" }}>
      {age < 17 ? (
        <div style={{ position: "absolute", left: -44 * k, top: -44 * k, width: 88 * k, height: 88 * k, borderRadius: "50%", border: `3px solid ${COLORS.brand}`, background: `${COLORS.brand}33`, opacity: 1 - ring, transform: `scale(${lerp(0.2, 1, ring)})` }} />
      ) : null}
      <svg width={24 * k} height={32 * k} viewBox="0 0 24 32" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.6))" }}>
        <path d="M2 2 L2 24 L8 18.5 L12.5 28.5 L16.5 26.7 L12 17 L20 17 Z" fill="#fff" stroke="#0b1020" strokeWidth={2} strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// --- Une maquette 3D en plein cadre (models/<nom>.mp4, 75 images) ------------------------------------------------------------
export const Model: React.FC<{ readonly name: string; readonly trim?: number; readonly style?: React.CSSProperties; readonly fit?: "cover" | "contain" }> = ({ name, trim = 0, style, fit = "cover" }) => (
  <Video src={staticFile(`models/${name}.mp4`)} trimBefore={trim} muted objectFit={fit} style={{ width: 1920, height: 1080, ...style }} />
);
