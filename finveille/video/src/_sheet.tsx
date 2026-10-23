import React from "react";
import { Composition, registerRoot } from "remotion";
import { Sprite } from "./pixel/Sprite";
import { SPRITES, SPRITE_NAMES, BELL_BLUE } from "./pixel/sprites";
const Sheet: React.FC = () => (
  <div style={{ width: 1500, height: 900, background: "#E6E8EE", display: "flex", flexWrap: "wrap", gap: 20, padding: 20, alignContent: "flex-start" }}>
    {SPRITE_NAMES.map((n) => <div key={n} style={{ width: 270, height: 270, display: "grid", placeItems: "center" }}><Sprite sprite={SPRITES[n]} size={216} depth={5} /></div>)}
    <div style={{ width: 270, height: 270, background: "#060912", display: "grid", placeItems: "center" }}><Sprite sprite={SPRITES.cloche} size={216} palette={BELL_BLUE} glow="#2451DE" /></div>
  </div>
);
registerRoot(() => <Composition id="Sheet" component={Sheet} durationInFrames={1} fps={60} width={1500} height={1150} />);
