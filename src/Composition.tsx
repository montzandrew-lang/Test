import { Composition, staticFile, AbsoluteFill, Img } from "remotion";
import { loadFont } from "@remotion/google-fonts/ShareTechMono";
import { DisplayOverlay } from "./DisplayOverlay";
import {
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
  FPS,
  DURATION_IN_FRAMES,
} from "./scaleConfig";

loadFont();

type Props = {};

export const MyComposition = () => {
  return (
    <Composition
      id="ScaleLiar"
      component={ScaleLiarScene}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
    />
  );
};

export const ScaleLiarScene: React.FC<Props> = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#e9e9e6" }}>
      <Img
        src={staticFile("scale.png")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      <DisplayOverlay />
    </AbsoluteFill>
  );
};
