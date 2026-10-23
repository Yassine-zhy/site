// Scènes 6, 7 et 8 (640 → 1180) : une fenêtre arrondie (860 px) sur le gris papier, qui montre l'application.
//   6 (640 → 820)  : le blanc de l'éclat s'efface, elle se reconstitue en pixels (elle monte, grossit, son ombre s'installe) et
//                    montre le fil ; « 43 sources. » « un seul fil. » ; trois icônes (journal, globe, loupe) tournent autour
//                    d'elle, sur une ellipse plus large que la fenêtre : elles passent par-dessus (les plus lointaines sont
//                    plus petites et plus floues) et ne disparaissent jamais derrière
//   7 (820 → 1000) : coupe franche ; la carte des marchés ; « les marchés, en direct. » ; une bougie et un graphique flottent
//   8 (1000 → 1180): la fenêtre se dissout en pixels puis revient avec l'assistant ; « une question ? » puis « il te dit où
//                    il l'a lu. », avec un trait à la main qui entoure « où »
import React from "react";
import { BACK, Hand, Icon, Layer, PCX, PWord, Shot, Words, Win, Footage, bob, punch } from "./fx";
import { CAM, IN, LIN, ramp } from "../kit";
import { SpriteName } from "./sprites";

export const FEN_FROM = 640, FEN_TO = 1180;
export const FEN = { dissolve: 1000, reform: 1024 };  // la dissolution de la scène 8 et le retour de la fenêtre
const WX = PCX, WY = 790, WW = 860, WH = 484;
const ORBIT: readonly SpriteName[] = ["journal", "globe", "loupe"];
// Le cercle à la main de « où » : tracé dans une boîte de 76 × 58, posé dans la boîte du mot (en % de sa largeur)
const CIRCLE = "M 14 31 C 10 10 58 2 66 24 C 74 50 20 58 9 36 C 4 22 28 6 52 6";

export const Fenetre: React.FC<{ readonly f: number }> = ({ f }) => {
  if (f < FEN_FROM || f >= FEN_TO) return null;
  const scene = f < 820 ? 6 : f < 1000 ? 7 : 8;
  // La visibilité de la fenêtre (1 = nette, 0 = dissoute) et la séquence montrée
  const p = scene === 6 ? ramp(f, 640, 652, 0, 1, LIN) : scene === 7 ? 1 : f < FEN.reform ? 1 - ramp(f, FEN.dissolve, FEN.dissolve + 12, 0, 1, LIN) : ramp(f, FEN.reform, FEN.reform + 12, 0, 1, LIN);
  const name = scene === 6 ? "feed" : scene === 7 ? "heatmap" : f < FEN.reform ? "heatmap" : "ai";
  const from = scene === 6 ? 640 : scene === 7 ? 820 : f < FEN.reform ? 820 : FEN.reform;
  const frames = scene === 6 ? 180 : scene === 7 ? 192 : 1180 - FEN.reform;
  // Sa présence : à l'arrivée elle monte et se pose (avec dépassement) ; à 820 un punch ; sinon elle avance très lentement vers nous
  const lift = scene === 6 ? ramp(f, 640, 676, 0, 1, BACK) : scene === 8 && f >= FEN.reform ? ramp(f, FEN.reform, FEN.reform + 30, 0.55, 1, BACK) : 1;
  const sceneFrom = scene === 6 ? 640 : scene === 7 ? 820 : 1000;
  const wscale = (1 + 0.016 * ((f - sceneFrom) / 180)) * (scene === 7 ? punch(f, 820, 0.035, 3, 18) : scene === 8 ? punch(f, FEN.reform + 4, 0.03, 3, 16) : 1);
  const wy = WY + bob(f, 4, 4, 52);  // elle flotte à peine

  // L'orbite des trois icônes : une ellipse plus large et plus haute que la fenêtre ; en bas (devant) elles sont plus grandes et nettes,
  // en haut (derrière) plus petites, pâles et floues. Elles restent toujours visibles : entre le texte (≤ 360) et la fenêtre (≥ 531)
  // ou en dessous, et dans les marges de 70 px.
  const orb = ORBIT.map((n, i) => {
    const phi = ((f * 0.7 + i * 120) * Math.PI) / 180, depth = Math.sin(phi), q = (depth + 1) / 2;
    return { n, depth, q, x: WX + 405 * Math.cos(phi), y: WY + 18 + 365 * Math.sin(phi), size: 100 * (0.8 + 0.3 * q) };
  });
  const orbOut = 1 - ramp(f, 806, 819, 0, 1, IN);
  const orbitEl = scene === 6 && orb.sort((a, b) => a.depth - b.depth).map((o) => (
    <Icon key={o.n} name={o.n} x={o.x} y={o.y} size={o.size} blur={(1 - o.q) * 2.2} opacity={0.78 + 0.22 * o.q} rot={bob(f, o.x, 5, 30)} scale={ramp(f, 646, 668, 0, 1, BACK) * orbOut} />
  ));

  const t6: PWord[] = [{ t: "43", at: 650 }, { t: "sources.", at: 657 }, { t: "un", at: 690, br: true }, { t: "seul", at: 696 }, { t: "fil.", at: 702 }];
  const t7: PWord[] = [{ t: "les", at: 826 }, { t: "marchés,", at: 832 }, { t: "en", at: 839 }, { t: "direct.", at: 845 }];
  const t8a: PWord[] = [{ t: "une", at: 1006 }, { t: "question ?", at: 1013 }];
  const ring = <Hand key="ou" d={CIRCLE} box={[76, 58]} p={ramp(f, 1112, 1140, 0, 1, CAM)} style={{ left: "-21%", top: "6%", width: "142%" }} />;
  const t8b: PWord[] = [{ t: "il", at: 1090 }, { t: "te", at: 1096 }, { t: "dit", at: 1102 }, { t: "où", at: 1108, deco: ring }, { t: "il", at: 1114 }, { t: "l'a", at: 1120 }, { t: "lu.", at: 1126 }];
  return (
    <>
      {/* le blanc de l'éclat de la scène 5 s'efface sous la fenêtre qui se reconstitue */}
      {f < 662 && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: ramp(f, 640, 660, 1, 0, LIN) }} />}
      <Shot f={f} from={FEN_FROM} to={FEN_TO} exit="fwd">
        <Layer f={f} k={0.6}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 215 }}>
            {scene === 6 && <Words words={t6} f={f} out={810} />}
            {scene === 7 && <Words words={t7} f={f} out={990} />}
            {scene === 8 && <><Words words={t8a} f={f} out={1082} /><div style={{ position: "absolute", left: 0, right: 0, top: 0 }}><Words words={t8b} f={f} /></div></>}
          </div>
        </Layer>
        <Layer f={f} k={0.45}>
          <Win cx={WX} cy={wy} w={WW} h={WH} p={p} seed={`w${scene}${f < FEN.reform ? 0 : 1}`} lift={lift} scale={wscale}>
            <Footage name={name} from={from} frames={frames} w={WW} h={WH} />
          </Win>
        </Layer>
        <Layer f={f} k={1}>
          {orbitEl}
          {scene === 7 && (
            <>
              <Icon name="bougie" x={150} y={440 + bob(f, 0, 9, 40)} size={132} rot={-8 + bob(f, 1, 4, 55)} scale={ramp(f, 822, 840, 0, 1, BACK) * (1 - ramp(f, 986, 999, 0, 1, IN))} />
              <Icon name="graphique" x={935} y={1175 + bob(f, 2, 9, 44)} size={132} rot={7 + bob(f, 3, 4, 50)} scale={ramp(f, 828, 846, 0, 1, BACK) * (1 - ramp(f, 986, 999, 0, 1, IN))} />
            </>
          )}
        </Layer>
      </Shot>
    </>
  );
};
