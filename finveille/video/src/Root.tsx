import { Composition } from "remotion";
import { TOTAL, Trailer } from "./Trailer";

// La bande-annonce : 1920 × 1080 (LinkedIn, YouTube), 30 images par seconde, 34 mesures de 60 images
export const RemotionRoot: React.FC = () => {
  return <Composition id="Trailer" component={Trailer} durationInFrames={TOTAL} fps={30} width={1920} height={1080} />;
};
