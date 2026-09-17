import React, { useMemo } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import {
  DISPLAY_CENTER_X,
  DISPLAY_CENTER_Y,
  PATCH_WIDTH,
  PATCH_HEIGHT,
  PATCH_RADIUS,
  PATCH_COLOR,
  REAL_VALUE,
  LIAR_TEXT,
  FONT_SIZE,
  LIAR_FONT_SIZE,
  TEXT_COLOR,
  GLOW_COLOR,
  GLOW_COLOR_SOFT,
  PHASE_STEADY_END,
  PHASE_GLITCH_END,
  PHASE_BLACK_END,
} from "./scaleConfig";
import { buildFlipOffsets, glitchValueForSeed } from "./glitch";

const glowTextShadow = (intensity: number) =>
  `0 0 ${6 * intensity}px ${GLOW_COLOR}, 0 0 ${16 * intensity}px ${GLOW_COLOR_SOFT}, 0 0 ${32 * intensity}px ${GLOW_COLOR_SOFT}`;

const baseTextStyle: React.CSSProperties = {
  fontFamily: "'Share Tech Mono', monospace",
  fontWeight: 400,
  letterSpacing: 2,
  color: TEXT_COLOR,
  userSelect: "none",
  whiteSpace: "nowrap",
};

const Patch: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: DISPLAY_CENTER_X - PATCH_WIDTH / 2,
      top: DISPLAY_CENTER_Y - PATCH_HEIGHT / 2,
      width: PATCH_WIDTH,
      height: PATCH_HEIGHT,
      borderRadius: PATCH_RADIUS,
      backgroundColor: PATCH_COLOR,
    }}
  />
);

const GLITCH_START = PHASE_STEADY_END;
const GLITCH_LENGTH = PHASE_GLITCH_END - PHASE_STEADY_END;
const FLIP_OFFSETS = buildFlipOffsets(GLITCH_LENGTH);

// How many frames after a flip the jitter/RGB-split effect stays visible.
const FLIP_EFFECT_FRAMES = 3;

const useGlitchState = (frame: number) => {
  return useMemo(() => {
    const localFrame = frame - GLITCH_START;

    let flipIndex = 0;
    let framesSinceFlip = localFrame;
    for (let i = 0; i < FLIP_OFFSETS.length; i++) {
      if (FLIP_OFFSETS[i] <= localFrame) {
        flipIndex = i;
        framesSinceFlip = localFrame - FLIP_OFFSETS[i];
      }
    }

    const value = flipIndex === 0 ? REAL_VALUE : glitchValueForSeed(flipIndex);
    const isFresh = framesSinceFlip < FLIP_EFFECT_FRAMES;
    const effectStrength = isFresh
      ? interpolate(framesSinceFlip, [0, FLIP_EFFECT_FRAMES], [1, 0], {
          extrapolateRight: "clamp",
        })
      : 0;

    return { value, effectStrength };
  }, [frame]);
};

const DisplayText: React.FC<{
  text: string;
  fontSize: number;
  jitterX?: number;
  rgbSplit?: number;
  glowIntensity?: number;
}> = ({ text, fontSize, jitterX = 0, rgbSplit = 0, glowIntensity = 1 }) => {
  const wrapperStyle: React.CSSProperties = {
    position: "absolute",
    left: DISPLAY_CENTER_X,
    top: DISPLAY_CENTER_Y,
    transform: `translate(-50%, -50%) translateX(${jitterX}px)`,
  };

  if (rgbSplit <= 0.01) {
    return (
      <div style={wrapperStyle}>
        <span
          style={{
            ...baseTextStyle,
            fontSize,
            textShadow: glowTextShadow(glowIntensity),
          }}
        >
          {text}
        </span>
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <span
        style={{
          ...baseTextStyle,
          fontSize,
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translateX(${-rgbSplit}px)`,
          color: "rgba(255, 70, 70, 0.85)",
          textShadow: "none",
          mixBlendMode: "screen",
        }}
      >
        {text}
      </span>
      <span
        style={{
          ...baseTextStyle,
          fontSize,
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translateX(${rgbSplit}px)`,
          color: "rgba(70, 160, 255, 0.85)",
          textShadow: "none",
          mixBlendMode: "screen",
        }}
      >
        {text}
      </span>
      <span
        style={{
          ...baseTextStyle,
          fontSize,
          position: "relative",
          textShadow: glowTextShadow(glowIntensity),
        }}
      >
        {text}
      </span>
    </div>
  );
};

export const DisplayOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const glitch = useGlitchState(frame);

  // Phase 3: cut to black — patch stays, no text.
  if (frame >= PHASE_GLITCH_END && frame < PHASE_BLACK_END) {
    return <Patch />;
  }

  // Phase 4: "LIAR" snaps in and holds.
  if (frame >= PHASE_BLACK_END) {
    const snapProgress = interpolate(frame, [PHASE_BLACK_END, PHASE_BLACK_END + 3], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const scale = interpolate(snapProgress, [0, 1], [1.4, 1]);
    return (
      <>
        <Patch />
        <div
          style={{
            position: "absolute",
            left: DISPLAY_CENTER_X,
            top: DISPLAY_CENTER_Y,
            transform: `translate(-50%, -50%) scale(${scale})`,
            opacity: snapProgress,
          }}
        >
          <span
            style={{
              ...baseTextStyle,
              fontSize: LIAR_FONT_SIZE,
              letterSpacing: 6,
              textShadow: glowTextShadow(1),
            }}
          >
            {LIAR_TEXT}
          </span>
        </div>
      </>
    );
  }

  // Phase 1 (steady) and Phase 2 (glitching).
  const isGlitching = frame >= GLITCH_START;
  const jitterX = isGlitching ? (seededJitter(frame) * glitch.effectStrength) : 0;
  const rgbSplit = isGlitching ? 4 * glitch.effectStrength : 0;

  return (
    <>
      <Patch />
      <DisplayText
        text={isGlitching ? glitch.value : REAL_VALUE}
        fontSize={FONT_SIZE}
        jitterX={jitterX}
        rgbSplit={rgbSplit}
        glowIntensity={1}
      />
    </>
  );
};

// Small deterministic per-frame jitter (distinct from the value's random seed).
const seededJitter = (frame: number): number => {
  const x = Math.sin(frame * 78.233) * 43758.5453123;
  const raw = x - Math.floor(x);
  return (raw - 0.5) * 6; // +/- 3px
};
