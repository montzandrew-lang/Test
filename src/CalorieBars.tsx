import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
  random,
  spring,
  useCurrentFrame,
} from "remotion";
import {
  FIGURE_COLOR,
  FIGURE_H_SPACING,
  FIGURE_SIZE,
  FIGURE_V_SPACING,
  FigureIcon,
  GRID_CENTER_X,
  GRID_CENTER_Y,
  GRID_COLS,
  GRID_ROWS,
  GROUP_A_LABEL,
  GROUP_A_TINT,
  GROUP_B_LABEL,
  GROUP_B_TINT,
  Group,
  LABEL_COLOR,
  LABEL_FONT_SIZE,
  SPLIT_OFFSET_X,
  STUDIO_BACKGROUND,
  getGroupLabelY,
  getGroupPanelRect,
  groupPanelX,
} from "./GroupSplit";

// ---------------------------------------------------------------------------
// ADJUSTABLE CONSTANTS
// ---------------------------------------------------------------------------
const FPS = 30;
export const DURATION_IN_FRAMES = 90; // exactly 3s

const LINE_FADE_END = Math.round(0.4 * FPS); // 12
const BAR_A_START = Math.round(0.4 * FPS); // 12
const BAR_A_END = Math.round(1.6 * FPS); // 48
const BAR_B_START = Math.round(0.8 * FPS); // 24
const BAR_B_END = Math.round(2.4 * FPS); // 72
const HOLD_START = BAR_B_END; // 72 — numbers settle beneath the bars

export const LINE_Y = 1380; // px, dashed line position below the groups
export const LINE_MARGIN_X = 80; // px inset from each screen edge
export const LINE_LABEL = "maintenance calories";
export const LINE_COLOR = "#9a9a9f";

export const BAR_WIDTH = 14;
export const BAR_A_DEPTH = 210; // px the Group A bar grows down
export const BAR_B_DEPTH = 430; // px the Group B bar grows down (~2x A)
export const BAR_A_FINAL_VALUE = -450;
export const BAR_B_FINAL_VALUE = -900;
export const BAR_A_COLOR = "#4a82ff"; // solid version of GROUP_A_TINT's hue
export const BAR_B_COLOR = "#3ab585"; // solid version of GROUP_B_TINT's hue

export const NUMBER_FONT_SIZE = 32;
const NUMBER_SIDE_GAP = 18; // px to the right of the bar tip, during growth
const NUMBER_BENEATH_GAP = 40; // px below the bar's final tip, once settled

export const SHAKE_MAGNITUDE = 4; // px, on Group B's impact
const SHAKE_DURATION = 6; // frames

const Background: React.FC = () => (
  <AbsoluteFill style={{ background: STUDIO_BACKGROUND }} />
);

// The previous segment's end state, held static — same geometry helpers so
// it lines up exactly with where GroupSplit.tsx leaves off.
const StaticFigure: React.FC<{ row: number; col: number }> = ({
  row,
  col,
}) => {
  const group: Group = col < GRID_COLS / 2 ? "A" : "B";
  const x =
    GRID_CENTER_X +
    (col - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING +
    (group === "A" ? -SPLIT_OFFSET_X : SPLIT_OFFSET_X);
  const y = GRID_CENTER_Y + (row - (GRID_ROWS - 1) / 2) * FIGURE_V_SPACING;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
      }}
    >
      <FigureIcon size={FIGURE_SIZE} color={FIGURE_COLOR} />
    </div>
  );
};

const StaticGroupPanel: React.FC<{ group: Group }> = ({ group }) => {
  const { left, top, width, height } = getGroupPanelRect(group);
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        borderRadius: 32,
        background: group === "A" ? GROUP_A_TINT : GROUP_B_TINT,
      }}
    />
  );
};

const StaticGroupLabel: React.FC<{ group: Group }> = ({ group }) => (
  <div
    style={{
      position: "absolute",
      left: groupPanelX(group),
      top: getGroupLabelY(),
      transform: "translate(-50%, 0)",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
      fontSize: LABEL_FONT_SIZE,
      fontWeight: 600,
      letterSpacing: 2,
      color: LABEL_COLOR,
      whiteSpace: "nowrap",
    }}
  >
    {group === "A" ? GROUP_A_LABEL : GROUP_B_LABEL}
  </div>
);

const StartingScene: React.FC = () => {
  const figures = Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => ({
    row: Math.floor(i / GRID_COLS),
    col: i % GRID_COLS,
  }));

  return (
    <>
      <StaticGroupPanel group="A" />
      <StaticGroupPanel group="B" />
      {figures.map(({ row, col }) => (
        <StaticFigure key={`${row}-${col}`} row={row} col={col} />
      ))}
      <StaticGroupLabel group="A" />
      <StaticGroupLabel group="B" />
    </>
  );
};

const DashedLine: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, LINE_FADE_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: LINE_MARGIN_X,
          right: LINE_MARGIN_X,
          top: LINE_Y,
          borderTop: `2px dashed ${LINE_COLOR}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: GRID_CENTER_X,
          top: LINE_Y - 34,
          transform: "translateX(-50%)",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: LINE_COLOR,
          whiteSpace: "nowrap",
        }}
      >
        {LINE_LABEL}
      </div>
    </div>
  );
};

const NumberReadout: React.FC<{
  group: Group;
  value: number;
  barBottomY: number;
  finalBarBottomY: number;
}> = ({ group, value, barBottomY, finalBarBottomY }) => {
  const frame = useCurrentFrame();
  const barX = groupPanelX(group);

  const settleProgress = interpolate(
    frame,
    [HOLD_START, HOLD_START + 8],
    [0, 1],
    { easing: Easing.out(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const sideX = barX + BAR_WIDTH / 2 + NUMBER_SIDE_GAP;
  const sideY = barBottomY;
  const beneathX = barX;
  const beneathY = finalBarBottomY + NUMBER_BENEATH_GAP;

  const x = interpolate(settleProgress, [0, 1], [sideX, beneathX]);
  const y = interpolate(settleProgress, [0, 1], [sideY, beneathY]);

  const settleSpring = spring({
    frame: Math.max(0, frame - HOLD_START),
    fps: FPS,
    config: { damping: 10, stiffness: 260, mass: 0.5 },
    durationInFrames: 8,
  });
  const scale = frame < HOLD_START ? 1 : interpolate(settleSpring, [0, 1], [0.85, 1]);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
        fontSize: NUMBER_FONT_SIZE,
        fontWeight: 700,
        color: group === "A" ? BAR_A_COLOR : BAR_B_COLOR,
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </div>
  );
};

const Bar: React.FC<{ group: Group }> = ({ group }) => {
  const frame = useCurrentFrame();
  const isA = group === "A";
  const start = isA ? BAR_A_START : BAR_B_START;
  const end = isA ? BAR_A_END : BAR_B_END;
  const depth = isA ? BAR_A_DEPTH : BAR_B_DEPTH;
  const finalValue = isA ? BAR_A_FINAL_VALUE : BAR_B_FINAL_VALUE;
  const color = isA ? BAR_A_COLOR : BAR_B_COLOR;

  // Bar A: smooth, controlled ease-out growth.
  // Bar B: a near-critically-damped spring for a firm, (almost) no-overshoot stop.
  const progress = isA
    ? interpolate(frame, [start, end], [0, 1], {
        easing: Easing.out(Easing.cubic),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : Math.min(
        1,
        spring({
          frame: Math.max(0, frame - start),
          fps: FPS,
          config: { damping: 22, stiffness: 180, mass: 0.7 },
          durationInFrames: end - start,
        }),
      );

  const height = progress * depth;
  const barX = groupPanelX(group);
  const value = Math.round(progress * finalValue);

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: barX,
          top: LINE_Y,
          width: BAR_WIDTH,
          height,
          transform: "translateX(-50%)",
          borderRadius: BAR_WIDTH / 2,
          background: color,
        }}
      />
      <NumberReadout
        group={group}
        value={value}
        barBottomY={LINE_Y + height}
        finalBarBottomY={LINE_Y + depth}
      />
    </>
  );
};

export const CalorieBars: React.FC = () => {
  const frame = useCurrentFrame();

  const shakeFrame = frame - BAR_B_END;
  let shakeX = 0;
  let shakeY = 0;
  if (shakeFrame >= 0 && shakeFrame < SHAKE_DURATION) {
    const decay = 1 - shakeFrame / SHAKE_DURATION;
    shakeX = (random(`shake-x-${shakeFrame}`) - 0.5) * 2 * SHAKE_MAGNITUDE * decay;
    shakeY = (random(`shake-y-${shakeFrame}`) - 0.5) * 2 * SHAKE_MAGNITUDE * decay;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#dcdcdd", overflow: "hidden" }}>
      <AbsoluteFill
        style={{ transform: `scale(1.02) translate(${shakeX}px, ${shakeY}px)` }}
      >
        <Background />
        <StartingScene />
        <DashedLine />
        <Bar group="A" />
        <Bar group="B" />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const CalorieBarsComposition: React.FC = () => (
  <Composition
    id="CalorieBars"
    component={CalorieBars}
    durationInFrames={DURATION_IN_FRAMES}
    fps={FPS}
    width={1080}
    height={1920}
  />
);
