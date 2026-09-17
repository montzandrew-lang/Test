import React from "react";
import {
  AbsoluteFill,
  Composition,
  interpolate,
  spring,
  useCurrentFrame,
} from "remotion";

// ---------------------------------------------------------------------------
// ADJUSTABLE CONSTANTS
// ---------------------------------------------------------------------------
const FPS = 30;
export const DURATION_IN_FRAMES = Math.round(2.74 * FPS); // 82

const POP_END = Math.round(0.6 * FPS); // 18 — grid has popped in
const SPLIT_END = Math.round(1.8 * FPS); // 54 — groups have finished separating

export const GRID_ROWS = 4;
export const GRID_COLS = 6;
export const GRID_CENTER_X = 540; // px, frame is 1080 wide
export const GRID_CENTER_Y = 900; // px, frame is 1920 tall
export const FIGURE_H_SPACING = 108; // px between figure columns
export const FIGURE_V_SPACING = 176; // px between figure rows
export const FIGURE_SIZE = 92; // px, width/height of each icon
export const FIGURE_COLOR = "#5b5b60"; // soft dark grey

export const SPLIT_OFFSET_X = 130; // extra px each group's block slides apart
export const GROUP_A_TINT = "rgba(74,130,255,0.14)"; // soft blue
export const GROUP_B_TINT = "rgba(58,181,133,0.16)"; // soft green
export const LABEL_FONT_SIZE = 36;
export const LABEL_GAP = 54; // px from the bottom figure row to the label
export const LABEL_COLOR = "#3c3c40";
export const PANEL_PADDING = 40; // px of tint panel around each group's figures + label

// Same studio backdrop reused by later segments for visual continuity.
export const STUDIO_BACKGROUND =
  "radial-gradient(120% 90% at 50% 15%, #e9e9ea 0%, #dcdcdd 55%, #d2d2d3 100%)";

export const GROUP_A_LABEL = "GROUP A";
export const GROUP_B_LABEL = "GROUP B";

export type Group = "A" | "B";

const staggerDelay = (row: number, col: number) => (row + col) * 0.9;

const popSpringFor = (frame: number, delay: number) =>
  spring({
    frame: Math.max(0, frame - delay),
    fps: FPS,
    config: { damping: 10, stiffness: 210, mass: 0.5 },
  });

const splitSpringFor = (frame: number) =>
  spring({
    frame: Math.max(0, frame - POP_END),
    fps: FPS,
    config: { damping: 15, stiffness: 180, mass: 0.7 },
    durationInFrames: SPLIT_END - POP_END,
  });

const labelSpringFor = (frame: number) =>
  spring({
    frame: Math.max(0, frame - SPLIT_END),
    fps: FPS,
    config: { damping: 11, stiffness: 260, mass: 0.5 },
    durationInFrames: 8,
  });

export const FigureIcon: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <circle cx="50" cy="27" r="21" fill={color} />
    <path
      d="M50 47 C24 47 12 68 12 100 L88 100 C88 68 76 47 50 47 Z"
      fill={color}
    />
  </svg>
);

const Figure: React.FC<{ row: number; col: number }> = ({ row, col }) => {
  const frame = useCurrentFrame();
  const group: Group = col < GRID_COLS / 2 ? "A" : "B";

  const baseX = GRID_CENTER_X + (col - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING;
  const baseY = GRID_CENTER_Y + (row - (GRID_ROWS - 1) / 2) * FIGURE_V_SPACING;

  const pop = popSpringFor(frame, staggerDelay(row, col));
  const split = splitSpringFor(frame);
  const splitOffset = interpolate(
    split,
    [0, 1],
    [0, group === "A" ? -SPLIT_OFFSET_X : SPLIT_OFFSET_X],
  );

  return (
    <div
      style={{
        position: "absolute",
        left: baseX + splitOffset,
        top: baseY,
        transform: `translate(-50%, -50%) scale(${pop})`,
      }}
    >
      <FigureIcon size={FIGURE_SIZE} color={FIGURE_COLOR} />
    </div>
  );
};

// Pure geometry helpers, exported so later segments can line up with this
// grid's final, settled layout without duplicating the numbers.
export const groupPanelX = (group: Group) => {
  const edgeCol = group === "A" ? (GRID_COLS / 2 - 1) / 2 : GRID_COLS / 2 + (GRID_COLS / 2 - 1) / 2;
  const centerX =
    GRID_CENTER_X + (edgeCol - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING;
  return centerX + (group === "A" ? -SPLIT_OFFSET_X : SPLIT_OFFSET_X);
};

export const getGroupPanelRect = (group: Group) => {
  const halfCols = GRID_COLS / 2;
  const width = (halfCols - 1) * FIGURE_H_SPACING + FIGURE_SIZE + PANEL_PADDING * 2;
  const top =
    GRID_CENTER_Y -
    ((GRID_ROWS - 1) / 2) * FIGURE_V_SPACING -
    FIGURE_SIZE / 2 -
    PANEL_PADDING;
  const height =
    (GRID_ROWS - 1) * FIGURE_V_SPACING +
    FIGURE_SIZE / 2 +
    LABEL_GAP +
    LABEL_FONT_SIZE * 1.4 +
    PANEL_PADDING * 2;
  const centerX = groupPanelX(group);
  return { left: centerX - width / 2, top, width, height, centerX };
};

export const getGroupLabelY = () =>
  GRID_CENTER_Y + ((GRID_ROWS - 1) / 2) * FIGURE_V_SPACING + FIGURE_SIZE / 2 + LABEL_GAP;

const GroupPanel: React.FC<{ group: Group }> = ({ group }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [SPLIT_END, SPLIT_END + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
        opacity,
      }}
    />
  );
};

const GroupLabel: React.FC<{ group: Group }> = ({ group }) => {
  const frame = useCurrentFrame();
  const pop = labelSpringFor(frame);
  const scale = interpolate(pop, [0, 1], [1.3, 1]);
  const opacity = interpolate(
    Math.max(0, frame - SPLIT_END),
    [0, 2],
    [0, 1],
    { extrapolateRight: "clamp" },
  );

  const y = getGroupLabelY();

  return (
    <div
      style={{
        position: "absolute",
        left: groupPanelX(group),
        top: y,
        transform: `translate(-50%, 0) scale(${scale})`,
        opacity,
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
};

const Background: React.FC = () => (
  <AbsoluteFill style={{ background: STUDIO_BACKGROUND }} />
);

export const GroupSplit: React.FC = () => {
  const figures = Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => ({
    row: Math.floor(i / GRID_COLS),
    col: i % GRID_COLS,
  }));

  return (
    <AbsoluteFill style={{ backgroundColor: "#dcdcdd" }}>
      <Background />
      <GroupPanel group="A" />
      <GroupPanel group="B" />
      {figures.map(({ row, col }) => (
        <Figure key={`${row}-${col}`} row={row} col={col} />
      ))}
      <GroupLabel group="A" />
      <GroupLabel group="B" />
    </AbsoluteFill>
  );
};

export const GroupSplitComposition: React.FC = () => (
  <Composition
    id="GroupSplit"
    component={GroupSplit}
    durationInFrames={DURATION_IN_FRAMES}
    fps={FPS}
    width={1080}
    height={1920}
  />
);
