import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  Img,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { loadFont } from "@remotion/fonts";

// Self-hosted at public/fonts/Doto-Variable.woff2 so the render never
// depends on fetching fonts.gstatic.com at render time.
const fontFamily = "Doto";
loadFont({
  family: fontFamily,
  url: staticFile("fonts/Doto-Variable.woff2"),
  weight: "100 900",
  style: "normal",
});

// ---------------------------------------------------------------------------
// ADJUSTABLE CONSTANTS
// Tweak these to line the overlay up with the scale's physical display once
// you drop in the real photo (see USE_PHOTO_BACKGROUND below).
// ---------------------------------------------------------------------------
export const DISPLAY_X = 540; // center x, px (frame is 1080 wide)
export const DISPLAY_Y = 636; // center y, px (frame is 1920 tall)
export const DISPLAY_WIDTH = 250; // patch width covering the original digits
export const DISPLAY_HEIGHT = 92; // patch height covering the original digits
export const DISPLAY_FONT_SIZE = 62;
export const DISPLAY_ROTATION = 0; // deg, in case the scale is shot at a slight angle

// No scale.jpeg has been added to this project yet, so the background below
// is a CSS/SVG recreation of the reference photo. Drop the real file at
// public/scale.jpeg and flip this to true to use it instead — the digit
// patch and overlay positions above will still work the same way.
const USE_PHOTO_BACKGROUND = false;
const PHOTO_SRC = "scale.jpeg";

const START_VALUE = "84.6";
const LIAR_TEXT = "LIAR";

const FPS = 30;
const STEADY_END = Math.round(0.4 * FPS); // 12 — steady 84.6
const GLITCH_END = Math.round(1.5 * FPS); // 45 — glitching stops
const BLACKOUT_END = Math.round(1.7 * FPS); // 51 — display back on, shows LIAR
export const DURATION_IN_FRAMES = Math.round(2.3 * FPS); // 69

const GLOW = [
  "0 0 2px rgba(255,255,255,1)",
  "0 0 6px rgba(255,251,240,0.9)",
  "0 0 16px rgba(255,244,214,0.75)",
  "0 0 34px rgba(255,238,190,0.4)",
].join(", ");

// A handful of "glitch" frames with random-ish readings, spaced so they land
// sparsely at first and tightly together by the end (i.e. accelerating).
// Built with Remotion's seeded `random()` so every render is identical.
const GLITCH_READING_COUNT = 15;
const glitchSchedule: { frame: number; value: string }[] = (() => {
  const span = GLITCH_END - STEADY_END;
  const ease = Easing.in(Easing.cubic);
  const frames = new Set<number>();
  for (let i = 0; i < GLITCH_READING_COUNT; i++) {
    frames.add(STEADY_END + Math.round(ease(i / GLITCH_READING_COUNT) * span));
  }
  return Array.from(frames)
    .sort((a, b) => a - b)
    .map((frame) => {
      const jitter = (random(`glitch-value-${frame}`) - 0.5) * 6.4; // +/-3.2
      return { frame, value: (84.6 + jitter).toFixed(1) };
    });
})();

const readingForFrame = (frame: number) => {
  let current = START_VALUE;
  for (const entry of glitchSchedule) {
    if (frame >= entry.frame) current = entry.value;
    else break;
  }
  return current;
};

const lastChangeFrame = (frame: number) => {
  let last = STEADY_END;
  for (const entry of glitchSchedule) {
    if (frame >= entry.frame) last = entry.frame;
    else break;
  }
  return last;
};

const Digits: React.FC<{
  text: string;
  jitterX?: number;
  rgbSplit?: number;
  scale?: number;
  opacity?: number;
}> = ({ text, jitterX = 0, rgbSplit = 0, scale = 1, opacity = 1 }) => {
  const baseStyle: React.CSSProperties = {
    fontFamily,
    fontVariationSettings: '"ROND" 100, "wght" 520',
    fontSize: DISPLAY_FONT_SIZE,
    letterSpacing: 4,
    lineHeight: 1,
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        transform: `translateX(${jitterX}px) scale(${scale})`,
        opacity,
      }}
    >
      {rgbSplit > 0.02 && (
        <>
          <span
            style={{
              ...baseStyle,
              position: "absolute",
              inset: 0,
              color: "rgba(255,70,70,0.65)",
              transform: `translateX(${-2.5 * rgbSplit}px)`,
              mixBlendMode: "lighten",
            }}
          >
            {text}
          </span>
          <span
            style={{
              ...baseStyle,
              position: "absolute",
              inset: 0,
              color: "rgba(70,170,255,0.65)",
              transform: `translateX(${2.5 * rgbSplit}px)`,
              mixBlendMode: "lighten",
            }}
          >
            {text}
          </span>
        </>
      )}
      <span
        style={{
          ...baseStyle,
          position: "relative",
          color: "#fdfaf1",
          textShadow: GLOW,
        }}
      >
        {text}
      </span>
    </div>
  );
};

const Display: React.FC = () => {
  const frame = useCurrentFrame();

  if (frame < STEADY_END) {
    return <Digits text={START_VALUE} />;
  }

  if (frame < GLITCH_END) {
    const reading = readingForFrame(frame);
    const changedAt = lastChangeFrame(frame);
    const framesSinceChange = frame - changedAt;
    const decay = interpolate(framesSinceChange, [0, 3], [1, 0], {
      extrapolateRight: "clamp",
    });
    const jitterX = (random(`jitter-${frame}`) - 0.5) * 10 * decay;
    return <Digits text={reading} jitterX={jitterX} rgbSplit={decay} />;
  }

  if (frame < BLACKOUT_END) {
    return null; // display is cut to black
  }

  const framesIntoLiar = frame - BLACKOUT_END;
  const pop = spring({
    frame: framesIntoLiar,
    fps: FPS,
    config: { damping: 11, stiffness: 260, mass: 0.5 },
    durationInFrames: 8,
  });
  const scale = interpolate(pop, [0, 1], [1.35, 1]);
  const opacity = interpolate(framesIntoLiar, [0, 2], [0, 1], {
    extrapolateRight: "clamp",
  });

  return <Digits text={LIAR_TEXT} scale={scale} opacity={opacity} />;
};

const DisplayPatch: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div
    style={{
      position: "absolute",
      left: DISPLAY_X - DISPLAY_WIDTH / 2,
      top: DISPLAY_Y - DISPLAY_HEIGHT / 2,
      width: DISPLAY_WIDTH,
      height: DISPLAY_HEIGHT,
      borderRadius: DISPLAY_HEIGHT / 2,
      transform: `rotate(${DISPLAY_ROTATION}deg)`,
      background: dark
        ? "#161616"
        : "linear-gradient(180deg, #d8d8d4 0%, #cfcfcb 55%, #c7c7c3 100%)",
      boxShadow: dark
        ? "inset 0 2px 6px rgba(0,0,0,0.6)"
        : "inset 0 2px 6px rgba(0,0,0,0.22), inset 0 -1px 1px rgba(255,255,255,0.5)",
    }}
  />
);

const Background: React.FC = () => {
  if (USE_PHOTO_BACKGROUND) {
    return (
      <AbsoluteFill>
        <Img
          src={staticFile(PHOTO_SRC)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(120% 90% at 50% 15%, #e9e9ea 0%, #dcdcdd 55%, #d2d2d3 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 520,
          width: 900,
          height: 900,
          borderRadius: "50%",
          transform: "translateX(-50%)",
          background:
            "radial-gradient(circle at 38% 32%, #ffffff 0%, #f4f4f4 45%, #e7e7e8 78%, #dcdcdd 100%)",
          boxShadow:
            "28px 46px 70px rgba(0,0,0,0.16), inset 0 2px 3px rgba(255,255,255,0.9), inset 0 -18px 30px rgba(0,0,0,0.05)",
        }}
      />
    </AbsoluteFill>
  );
};

export const ScaleReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const isBlackout = frame >= GLITCH_END && frame < BLACKOUT_END;

  return (
    <AbsoluteFill style={{ backgroundColor: "#dcdcdd" }}>
      <Background />
      <DisplayPatch dark={isBlackout} />
      <div
        style={{
          position: "absolute",
          left: DISPLAY_X,
          top: DISPLAY_Y,
          transform: "translate(-50%, -50%)",
        }}
      >
        <Display />
      </div>
    </AbsoluteFill>
  );
};

export const ScaleRevealComposition: React.FC = () => (
  <Composition
    id="ScaleReveal"
    component={ScaleReveal}
    durationInFrames={DURATION_IN_FRAMES}
    fps={FPS}
    width={1080}
    height={1920}
  />
);
