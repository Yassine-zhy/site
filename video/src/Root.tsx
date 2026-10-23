import { Composition } from "remotion";
import { FPS, H, TOTAL, W } from "./kit";
import { LI_TOTAL, LinkedIn } from "./LinkedIn";
import { PIXEL_TOTAL, Pixel } from "./Pixel";
import { Trailer } from "./Trailer";
import { TSFX_TOTAL, TrailerSfx } from "./TrailerSfx";

// La bande-annonce v4 : 1920 × 1080, 60 images par seconde (le mouvement des interfaces reste fluide), 33,33 s, sans props
// La pub pixel art : 1080 × 1350 (4:5), 60 im/s, 47,8 s (le montage est dans pixel/montage.ts)
// La version LinkedIn : 4:5 vertical, 1080 × 1350, 61 s (accroche, bande-annonce incrustée, carte de fin)
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Trailer" component={Trailer} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
      <Composition id="TrailerSfx" component={TrailerSfx} durationInFrames={TSFX_TOTAL} fps={FPS} width={W} height={H} />
      <Composition id="LinkedIn" component={LinkedIn} durationInFrames={LI_TOTAL} fps={FPS} width={1080} height={1350} />
      <Composition id="Pixel" component={Pixel} durationInFrames={PIXEL_TOTAL} fps={60} width={1080} height={1350} />
      <Composition id="PixelSansMusique" component={Pixel} durationInFrames={PIXEL_TOTAL} fps={60} width={1080} height={1350} defaultProps={{ music: false }} />
    </>
  );
};
