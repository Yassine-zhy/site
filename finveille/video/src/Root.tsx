import { Composition } from "remotion";
import { TOTAL, Trailer } from "./Trailer";

// La bande-annonce v3 : 1920 × 1080, 30 images par seconde, 66 s = 1 980 images, sans props
export const RemotionRoot: React.FC = () => {
  return <Composition id="Trailer" component={Trailer} durationInFrames={TOTAL} fps={30} width={1920} height={1080} />;
};
