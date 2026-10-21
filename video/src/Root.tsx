import { Composition } from "remotion";
import { FPS, H, TOTAL, W } from "./kit";
import { Trailer } from "./Trailer";

// La bande-annonce v4 : 1920 × 1080, 60 images par seconde (le mouvement des interfaces reste fluide), 33,33 s, sans props
export const RemotionRoot: React.FC = () => {
  return <Composition id="Trailer" component={Trailer} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />;
};
