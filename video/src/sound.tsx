// Le son : la voix (une <Audio> par phrase), la musique baissée sous la voix, les bruitages calés sur les images
import { Audio } from "@remotion/media";
import React from "react";
import { Sequence, staticFile } from "remotion";
import { CAM, VO, fr, lerp, ramp } from "./kit";

export const TOTAL = 1980;
const VOL = { music: 0.85, ducked: 0.32, voice: 0.65, whoosh: 0.4, impact: 0.8, click: 0.6, bell: 0.5, keys: 0.25, tick: 0.22 };

// Les intervalles de voix (images), fusionnés quand deux phrases se touchent presque : la musique ne « pompe » pas entre deux mots
const VOICE = VO.map((p) => [fr(p.start), fr(p.start + p.dur)] as [number, number]).reduce<[number, number][]>((acc, [a, b]) => {
  const last = acc[acc.length - 1];
  if (last && a - last[1] < 14) last[1] = b;
  else acc.push([a, b]);
  return acc;
}, []);
// Le niveau de la musique sous la voix, par intervalle (image de début → volume). Le plan fixe 0,32 ; mais la musique est bien
// plus forte dans la seconde moitié (le drop) : on a mesuré la voix et la musique de chaque intervalle (ffmpeg, niveau RMS) et
// baissé la musique juste assez pour qu'elle reste 8 dB sous la voix (0,32 au plus). Le mélangeur de Remotion relève les voix
// (mono) d'environ 2,8 dB : la voix est donc à 0,65 pour garder de la marge avant l'écrêtage (crête mesurée sur le rendu). Les intervalles absents gardent 0,32.
const DUCK_LEVEL: Record<number, number> = {
  360: 0.18, 480: 0.26, 630: 0.18, 855: 0.18, 930: 0.18, 1200: 0.18, 1395: 0.15, 1500: 0.12, 1710: 0.32, 1755: 0.22, 1860: 0.16,
};
// Attaque 4 images avant la voix, relâchement 10 images après : 1 = musique baissée
const lin = (t: number) => t;
const duckedTo = (f: number) => {
  let v = VOL.music, d = 0;
  for (const [a, b] of VOICE) {
    const e = ramp(f, a - 4, a, [0, 1], lin) * (1 - ramp(f, b, b + 10, [0, 1], lin));
    if (e > d) { d = e; v = DUCK_LEVEL[a] ?? VOL.ducked; }
  }
  return lerp(VOL.music, v, d);
};
export const musicVolume = (f: number) => duckedTo(f) * ramp(f, 65 * 30, 66 * 30, [1, 0], CAM);

const Sfx: React.FC<{ readonly file: string; readonly at: number; readonly volume: number }> = ({ file, at, volume }) => (
  <Sequence from={at} name={`son ${file}`}>
    <Audio src={staticFile(`sfx/${file}.wav`)} volume={volume} />
  </Sequence>
);

// Les repères du film (secondes → images) : souffles avant les changements de monde, impacts du logo
const WHOOSH = [12.0, 21.0, 31.0, 40.0, 50.0].map((t) => fr(t) - 15);
const IMPACT = [12.0, 62.0].map(fr);

export const Sound: React.FC<{ readonly typing: readonly [number, number]; readonly clicks: readonly number[]; readonly bells: readonly number[]; readonly ticks: readonly number[] }> = ({ typing, clicks, bells, ticks }) => {
  const keys: number[] = [];
  for (let t = typing[0]; t < typing[1]; t += 5) keys.push(t);
  return (
    <>
      <Audio src={staticFile("music.mp3")} volume={musicVolume} />
      {VO.map((p) => (
        <Sequence key={p.id} from={fr(p.start)} name={`voix ${p.id}`}>
          <Audio src={staticFile(`vo/${p.id}.wav`)} volume={VOL.voice} />
        </Sequence>
      ))}
      {WHOOSH.map((f) => <Sfx key={`w${f}`} file="whoosh" at={f} volume={VOL.whoosh} />)}
      {IMPACT.map((f) => <Sfx key={`i${f}`} file="impact" at={f} volume={VOL.impact} />)}
      {ticks.map((f) => <Sfx key={`t${f}`} file="tick" at={f} volume={VOL.tick} />)}
      {clicks.map((f) => <Sfx key={`c${f}`} file="click" at={f} volume={VOL.click} />)}
      {bells.map((f) => <Sfx key={`b${f}`} file="bell" at={f} volume={VOL.bell} />)}
      {keys.map((f) => <Sfx key={`k${f}`} file="keys" at={f} volume={VOL.keys} />)}
    </>
  );
};
