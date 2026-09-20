import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
} from "remotion";
import { FigureIcon, STUDIO_BACKGROUND } from "./GroupSplit";

// ---------------------------------------------------------------------------
// ADJUSTABLE CONSTANTS
// ---------------------------------------------------------------------------
const FPS = 30;
export const DURATION_IN_FRAMES = 1140; // exactly 38s
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

// --- phase boundaries (seconds -> frames) -----------------------------------
const P1_END = Math.round(5 * FPS); // 150 — groups appear + split
const P2_END = Math.round(11 * FPS); // 330 — bowls + day counter
const P3_END = Math.round(15 * FPS); // 450 — fade to stillness
const P4_END = Math.round(24 * FPS); // 720 — reward/preference meters
const P5_END = Math.round(28 * FPS); // 840 — scales slide in
// P6 runs to DURATION_IN_FRAMES (1140) — pull back wide, hold

// --- caption timings (defaults match the phases above; independently tunable) --
export const CAPTION_TIMINGS: [start: number, end: number][] = [
  [0, P1_END],
  [P1_END, P2_END],
  [P2_END, P3_END],
  [P3_END, P4_END],
  [P4_END, P5_END],
  [P5_END, DURATION_IN_FRAMES],
];

const CAPTIONS = [
  "A group of scientists took 49 healthy, normal-weight adults and split them into two groups.",
  "For eight weeks, one group ate a high-fat, high-sugar snack twice a day, while the other ate a low-fat, low-sugar snack.",
  "And the interesting part was what happened to their brains.",
  "The group eating the high-fat, high-sugar foods became more responsive to food rewards and developed a stronger preference for those foods.",
  "And they didn't even gain weight during the study.",
  "So while dopamine isn't something you want to 'lower,' constantly stimulating your reward system with highly palatable foods may make sticking to a cut harder.",
];

// --- group / grid geometry ---------------------------------------------------
export const GRID_COLS = 7;
export const GRID_ROWS = 7; // 49 figures
export const GRID_LEFT_COLS = 4; // columns 0..3 become the left group
export const GRID_CENTER_X = 540;
export const GRID_CENTER_Y = 720;
export const FIGURE_H_SPACING = 76;
export const FIGURE_V_SPACING = 76;
export const FIGURE_SIZE = 54;
export const FIGURE_COLOR = "#5b5b60";
export const GROUP_SPLIT_OFFSET_X = 160; // extra px each side slides apart

// --- tints ---------------------------------------------------------------------
export const LEFT_TINT = "#e0b877"; // soft amber (high-fat/high-sugar side)
export const RIGHT_TINT = "#7ea6d6"; // soft blue (low-fat/low-sugar side)
export const MUTED_TEXT_COLOR = "#8a8a8f";
export const TEXT_COLOR = "#3c3c40";

// --- bowl + day counter (phase 2) ---------------------------------------------
const BOWL_Y = 340;
const BOWL_WIDTH = 150;
const BOWL_HEIGHT = 78;
const COUNTER_Y = 415;
export const STUDY_TOTAL_DAYS = 56; // 8 weeks

// --- meters (phase 4 onward) ----------------------------------------------------
const METERS_BASELINE_Y = 1245;
export const METER_TRACK_HEIGHT = 230; // px, full scale for both meters
export const METER_WIDTH = 22;
export const METER_GAP = 190; // px between the two meters on one side
export const REWARD_RESPONSE_LEFT = 0.88; // fraction of track height, left side
export const REWARD_RESPONSE_RIGHT = 0.1; // right side stays "nearly flat"
export const PREFERENCE_LEFT = 0.74;
export const PREFERENCE_RIGHT = 0.14;
export const METER_ACTIVE_COLOR = "#c98a3d"; // deepened amber, the rising side
export const METER_FLAT_COLOR = "#9fb3c8"; // muted blue-grey, the flat side

// --- scales (phase 5 onward) -----------------------------------------------------
const SCALE_Y = 1473;
export const SCALE_DIAMETER = 260;
export const SCALE_DISPLAY_VALUE = "142.0"; // identical, unchanged on both sides
export const SCALE_DISC_TOP = "#ffffff";
export const SCALE_DISC_BOTTOM = "#e7e7e8";

// --- caption block ------------------------------------------------------------
const CAPTION_Y = 1725;
const CAPTION_WIDTH = 880;
const CAPTION_FONT_SIZE = 32;

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';

// ---------------------------------------------------------------------------
// Small helpers — springs everywhere are tuned to avoid overshoot ("no bounce").
// ---------------------------------------------------------------------------
const settle = (frame: number, start: number, duration: number) =>
  spring({
    frame: Math.max(0, frame - start),
    fps: FPS,
    config: { damping: 22, stiffness: 120, mass: 1 },
    durationInFrames: duration,
  });

const fadeWindow = (
  frame: number,
  inStart: number,
  inEnd: number,
  outStart: number,
  outEnd: number,
) =>
  Math.min(
    interpolate(frame, [inStart, inEnd], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    interpolate(frame, [outStart, outEnd], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

// ---------------------------------------------------------------------------
// Phase 1: 49 figures pop in, then split into two groups.
// ---------------------------------------------------------------------------
type Side = "left" | "right";

const sideCenterX = (side: Side) => {
  const cols = side === "left" ? [0, GRID_LEFT_COLS - 1] : [GRID_LEFT_COLS, GRID_COLS - 1];
  const avgCol = (cols[0] + cols[1]) / 2;
  const localX = GRID_CENTER_X + (avgCol - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING;
  return localX + (side === "left" ? -GROUP_SPLIT_OFFSET_X : GROUP_SPLIT_OFFSET_X);
};

const FigureGrid: React.FC = () => {
  const frame = useCurrentFrame();

  const popIn = interpolate(frame, [0, 22], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const splitT = settle(frame, 40, P1_END - 40);

  const figures = Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => ({
    row: Math.floor(i / GRID_COLS),
    col: i % GRID_COLS,
  }));

  return (
    <>
      {figures.map(({ row, col }) => {
        const side: Side = col < GRID_LEFT_COLS ? "left" : "right";
        const baseX = GRID_CENTER_X + (col - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING;
        const baseY = GRID_CENTER_Y + (row - (GRID_ROWS - 1) / 2) * FIGURE_V_SPACING;
        const targetOffset = side === "left" ? -GROUP_SPLIT_OFFSET_X : GROUP_SPLIT_OFFSET_X;
        const x = baseX + interpolate(splitT, [0, 1], [0, targetOffset]);

        return (
          <div
            key={`${row}-${col}`}
            style={{
              position: "absolute",
              left: x,
              top: baseY,
              transform: `translate(-50%, -50%) scale(${popIn})`,
              opacity: popIn,
            }}
          >
            <FigureIcon size={FIGURE_SIZE} color={FIGURE_COLOR} />
          </div>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------------------
// Phase 2: a bowl over each group, tinted, with a day counter beneath it.
// ---------------------------------------------------------------------------
const Bowl: React.FC<{ side: Side }> = ({ side }) => {
  const tint = side === "left" ? LEFT_TINT : RIGHT_TINT;
  const x = sideCenterX(side);

  return (
    <div style={{ position: "absolute", left: x, top: BOWL_Y, transform: "translate(-50%, -50%)" }}>
      <div
        style={{
          width: BOWL_WIDTH,
          height: BOWL_HEIGHT,
          background: "#ffffff",
          border: `3px solid ${tint}`,
          borderTop: "none",
          borderRadius: `0 0 ${BOWL_WIDTH / 2}px ${BOWL_WIDTH / 2}px`,
          boxShadow: "0 10px 18px rgba(0,0,0,0.08)",
        }}
      />
      <div
        style={{
          width: BOWL_WIDTH + 16,
          height: 14,
          marginTop: -9,
          marginLeft: -8,
          background: "#ffffff",
          border: `3px solid ${tint}`,
          borderRadius: 7,
        }}
      />
    </div>
  );
};

const DayCounter: React.FC<{ side: Side }> = ({ side }) => {
  const frame = useCurrentFrame();
  const x = sideCenterX(side);
  const local = frame - P1_END;
  const day = Math.min(
    STUDY_TOTAL_DAYS,
    Math.max(1, Math.round(interpolate(local, [10, P2_END - P1_END - 20], [1, STUDY_TOTAL_DAYS], {
      easing: Easing.out(Easing.quad),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }))),
  );
  const label = day >= STUDY_TOTAL_DAYS ? "8 WEEKS" : `DAY ${day}`;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: COUNTER_Y,
        transform: "translate(-50%, -50%)",
        fontFamily: FONT_STACK,
        fontSize: 18,
        fontWeight: 600,
        letterSpacing: 2,
        color: MUTED_TEXT_COLOR,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
};

const BowlsAndCounters: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = fadeWindow(frame, P1_END, P1_END + 16, P2_END, P2_END + 30);
  if (opacity <= 0) return null;
  return (
    <div style={{ opacity }}>
      <Bowl side="left" />
      <Bowl side="right" />
      <DayCounter side="left" />
      <DayCounter side="right" />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Phase 4: two meters per side — reward response + preference.
// ---------------------------------------------------------------------------
const Meter: React.FC<{
  x: number;
  finalFraction: number;
  color: string;
  label: string;
  active: boolean;
}> = ({ x, finalFraction, color, label, active }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [P3_END, P3_END + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (opacity <= 0) return null;

  const t = interpolate(frame, [P3_END, P4_END - 40], [0, 1], {
    easing: active ? Easing.out(Easing.cubic) : Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const height = t * finalFraction * METER_TRACK_HEIGHT;

  return (
    <div style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: METERS_BASELINE_Y - METER_TRACK_HEIGHT,
          width: 2,
          height: METER_TRACK_HEIGHT,
          transform: "translateX(-50%)",
          borderLeft: "2px dashed rgba(120,120,124,0.3)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x,
          top: METERS_BASELINE_Y - height,
          width: METER_WIDTH,
          height,
          transform: "translateX(-50%)",
          borderRadius: METER_WIDTH / 2,
          background: color,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x,
          top: METERS_BASELINE_Y + 22,
          width: 150,
          transform: "translate(-50%, 0)",
          fontFamily: FONT_STACK,
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          color: MUTED_TEXT_COLOR,
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
    </div>
  );
};

const Meters: React.FC = () => {
  const leftX = sideCenterX("left");
  const rightX = sideCenterX("right");
  return (
    <>
      <Meter
        x={leftX - METER_GAP / 2}
        finalFraction={REWARD_RESPONSE_LEFT}
        color={METER_ACTIVE_COLOR}
        label="food reward response"
        active
      />
      <Meter
        x={leftX + METER_GAP / 2}
        finalFraction={PREFERENCE_LEFT}
        color={METER_ACTIVE_COLOR}
        label="preference for these foods"
        active
      />
      <Meter
        x={rightX - METER_GAP / 2}
        finalFraction={REWARD_RESPONSE_RIGHT}
        color={METER_FLAT_COLOR}
        label="food reward response"
        active={false}
      />
      <Meter
        x={rightX + METER_GAP / 2}
        finalFraction={PREFERENCE_RIGHT}
        color={METER_FLAT_COLOR}
        label="preference for these foods"
        active={false}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Phase 5: two scales slide in from below, settling on identical numbers.
// ---------------------------------------------------------------------------
const Scale: React.FC<{ side: Side }> = ({ side }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [P4_END, P4_END + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (opacity <= 0) return null;

  const t = settle(frame, P4_END, P5_END - P4_END);
  const y = interpolate(t, [0, 1], [SCALE_Y + 220, SCALE_Y]);
  const x = sideCenterX(side);

  return (
    <div style={{ position: "absolute", left: x, top: y, opacity, transform: "translate(-50%, -50%)" }}>
      <div
        style={{
          position: "relative",
          width: SCALE_DIAMETER,
          height: SCALE_DIAMETER,
          borderRadius: "50%",
          background: `radial-gradient(circle at 38% 32%, ${SCALE_DISC_TOP} 0%, ${SCALE_DISC_TOP} 45%, ${SCALE_DISC_BOTTOM} 100%)`,
          boxShadow: "0 14px 26px rgba(0,0,0,0.14)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "26%",
            transform: "translate(-50%, -50%)",
            width: SCALE_DIAMETER * 0.62,
            height: SCALE_DIAMETER * 0.24,
            borderRadius: SCALE_DIAMETER * 0.12,
            background: "linear-gradient(180deg, #f6f6f4 0%, #e8e8e6 100%)",
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT_STACK,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 1,
            color: "#5a5a5e",
          }}
        >
          {SCALE_DISPLAY_VALUE}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Captions
// ---------------------------------------------------------------------------
const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      {CAPTIONS.map((text, i) => {
        const [start, end] = CAPTION_TIMINGS[i];
        const opacity = fadeWindow(frame, start, start + 14, end - 14, end);
        if (opacity <= 0) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: CANVAS_WIDTH / 2,
              top: CAPTION_Y,
              width: CAPTION_WIDTH,
              transform: "translate(-50%, -50%)",
              opacity,
              fontFamily: FONT_STACK,
              fontSize: CAPTION_FONT_SIZE,
              fontWeight: 500,
              lineHeight: 1.4,
              textAlign: "center",
              color: TEXT_COLOR,
            }}
          >
            {text}
          </div>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
const Background: React.FC = () => (
  <AbsoluteFill style={{ background: STUDIO_BACKGROUND }} />
);

export const RewardStudy: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#dcdcdd" }}>
    <Background />
    <FigureGrid />
    <BowlsAndCounters />
    <Meters />
    <Scale side="left" />
    <Scale side="right" />
    <Captions />
  </AbsoluteFill>
);

export const RewardStudyComposition: React.FC = () => (
  <Composition
    id="RewardStudy"
    component={RewardStudy}
    durationInFrames={DURATION_IN_FRAMES}
    fps={FPS}
    width={CANVAS_WIDTH}
    height={CANVAS_HEIGHT}
  />
);
