// S9 à S11 : le monde violet d'Inès (20 ans, un oral de marchés), l'assistant qui répond avec ses sources
import React from "react";
import { COLORS, Character, Kinetic, Label, Pill, Sweep, W, World, display, ramp, sans, useAbs } from "../kit";
import { SiteWindow, useEvents } from "../site";

const VIOLET = COLORS.ines;

// Une carte d'agenda blanche (S9) : l'oral de demain
const Agenda: React.FC<{ readonly at: number }> = ({ at }) => {
  const f = useAbs();
  const p = ramp(f, at, at + 11);
  return (
    <div style={{ position: "absolute", left: 96, top: 700, width: 760, height: 200, borderRadius: 28, background: "#fff", opacity: p, translate: `${(1 - p) * -90}px 0`, display: "flex", alignItems: "center", gap: 34, padding: "0 40px", boxShadow: "0 30px 60px -24px rgba(20,0,80,0.55)" }}>
      <div style={{ width: 112, height: 124, borderRadius: 18, border: `5px solid ${VIOLET}`, overflow: "hidden", flex: "none" }}>
        <div style={{ height: 38, background: VIOLET }} />
        <div style={{ fontFamily: display, fontWeight: 900, fontSize: 56, color: VIOLET, textAlign: "center", lineHeight: "78px" }}>9 h</div>
      </div>
      <div>
        <div style={{ fontFamily: display, fontWeight: 900, fontSize: 62, letterSpacing: "-0.035em", color: COLORS.night, lineHeight: 1 }}>Oral de marchés</div>
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 40, color: VIOLET, marginTop: 12 }}>demain, 9 h</div>
      </div>
    </div>
  );
};

// --- S9 : « Voici Inès. Vingt ans. Un oral de marchés demain matin. » ---------------------------------------------------------
export const S9: React.FC = () => {
  const tIn = W("L09", "Inès");
  return (
    <World color={VIOLET}>
      <Character name="ines" cx={1400} cy={520} d={780} at={tIn} disc="rgba(255,255,255,0.18)" />
      <Label text="Voici" at={W("L09", "Voici")} size={56} style={{ position: "absolute", left: 100, top: 150 }} />
      <div style={{ position: "absolute", left: 90, top: 196 }}>
        <Kinetic toks={[{ t: "Inès", at: tIn }]} size={360} shadow="0 8px 40px rgba(20,0,80,0.25)" />
      </div>
      <div style={{ position: "absolute", left: 96, top: 560 }}>
        <Pill text="20 ans" at={W("L09", "Vingt")} color={VIOLET} size={84} />
      </div>
      <Agenda at={W("L09", "oral")} />
    </World>
  );
};

// --- S10 : « Elle demande à l'assistant ce qui fait bouger le CAC 40. » La question se tape dans le vrai site ---------------------
// ai.mp4 : événements de ai.events.json (clic, typing, send, answer) ; valeurs de secours = celles du dernier tournage. La frappe
// (une lettre par image) est calée sur « demande » et ralentie pour finir sur « CAC 40 » ; la fin de frappe = l'envoi moins 5 images.
export const AI_FALLBACK = { click: 12, typing: 14, send: 69, answer: 69 };
export const S10: React.FC = () => {
  const tDem = W("L10", "demande");
  const ev = useEvents("ai", AI_FALLBACK);
  const typedEnd = ev.send - 5;
  const rate = (typedEnd - ev.typing) / (W("L10", "40", "t1") - tDem);
  return (
    <World color={VIOLET}>
      <div style={{ position: "absolute", left: 60, top: 110 }}>
        <Character name="ines" cx={105} cy={105} d={190} at={735} rise={false} disc="rgba(255,255,255,0.18)" />
        <Label text="Inès" at={738} size={44} style={{ position: "absolute", left: 24, top: 218 }} />
      </div>
      <SiteWindow
        name="ai" box={{ x: 330, y: 110, w: 1494, h: 800 }} sync={[tDem, ev.typing]} rate={rate} len={177} hold={typedEnd} enter={735} cursor
        cam={[{ f: 735, cx: 650, cy: 420, z: 2.2 }]}
        marks={[{ rect: [326, 506, 1100, 574], at: tDem, until: tDem + 90, pad: 8 }]}
      />
    </World>
  );
};

// --- S11 : « Une réponse claire, sources à l'appui. » La réponse, puis les sources citées l'une après l'autre ---------------------
export const S11: React.FC = () => {
  const tSrc = W("L11", "sources");
  const ev = useEvents("ai", AI_FALLBACK);
  return (
    <World color={VIOLET}>
      <div style={{ position: "absolute", left: 60, top: 110 }}>
        <Character name="ines" cx={105} cy={105} d={190} at={0} rise={false} disc="rgba(255,255,255,0.18)" />
        <Label text="Inès" at={0} size={44} style={{ position: "absolute", left: 24, top: 218 }} />
      </div>
      <SiteWindow
        name="ai" box={{ x: 330, y: 110, w: 1494, h: 800 }} sync={[855, ev.answer]} len={177} hold={ev.answer + 44} enter={855}
        cam={[{ f: 866, cx: 800, cy: 390, z: 1.45 }, { f: tSrc, cx: 800, cy: 540, z: 1.6 }]}
        marks={[
          { rect: [394, 548, 780, 614], at: tSrc, until: 927, pad: 6 },
          { rect: [796, 548, 1180, 614], at: tSrc + 9, until: 927, pad: 6 },
        ]}
      />
      <Sweep from={915} to={930} color={COLORS.hugo} />
    </World>
  );
};
