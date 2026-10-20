import { Composition } from "remotion";
import data from "../public/data.json";
import { TOTAL, Trailer } from "./Trailer";

// La bande-annonce : 1920 × 1080 (LinkedIn, YouTube), 30 images par seconde
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Trailer"
      component={Trailer}
      durationInFrames={TOTAL}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ data }}
    />
  );
};
