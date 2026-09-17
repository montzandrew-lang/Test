import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
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
import { StaticCalorieBars } from "./CalorieBars";

// ---------------------------------------------------------------------------
// ADJUSTABLE CONSTANTS
// ---------------------------------------------------------------------------
const FPS = 30;
export const DURATION_IN_FRAMES = 362; // exactly 12.07s
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

// --- phase boundaries (seconds -> frames) -----------------------------------
const F_BARS_END = Math.round(1 * FPS); // 30 — calorie bars fully faded
const F_PUSH_A1_END = Math.round(3.5 * FPS); // 105 — push-in on A, fat-loss meter
const F_NEUTRAL1_END = Math.round(4.2 * FPS); // 126 — back to neutral
const F_PUSH_B1_END = Math.round(6.7 * FPS); // 201 — push-in on B, fat-loss meter
const F_NEUTRAL2_END = Math.round(7.4 * FPS); // 222 — back to neutral
const F_PUSH_A2_END = Math.round(9.8 * FPS); // 294 — push-in on A, muscle meter
const F_CUT_B_END = Math.round(11.2 * FPS); // 336 — hard cut to B, muscle flatline

// --- camera ------------------------------------------------------------------
export const ZOOM_SCALE = 1.48; // >=~1.45 keeps the other group fully off-frame when pushed in
export const ZOOM_TARGET_OFFSET_X = 0; // nudge the focus point, per group, if needed
export const ZOOM_TARGET_OFFSET_Y = 0;
const CAMERA_PUSH_CONFIG = { damping: 28, stiffness: 55, mass: 1 }; // slow, cinematic
const CAMERA_OUT_CONFIG = { damping: 24, stiffness: 90, mass: 1 }; // smooth, a touch brisker

// --- percentage values (all four adjustable here) ----------------------------
export const FAT_LOSS_A_VALUE = -31;
export const FAT_LOSS_B_VALUE = -21;
export const MUSCLE_A_VALUE = 2;
export const MUSCLE_B_VALUE = 0;

// --- meter scale + geometry ---------------------------------------------------
export const FAT_LOSS_SCALE_MIN = -40; // the meter track represents 0 .. this
export const MUSCLE_SCALE_MAX = 3; // the meter track represents 0 .. this
const FAT_METER_GAP_FROM_CENTER = 70; // px either side of the canvas centerline
const FAT_METER_TOP_Y = 600;
const FAT_METER_TRACK_HEIGHT = 280;
const MUSCLE_METER_BASELINE_Y = 1450;
const MUSCLE_METER_TRACK_HEIGHT = 110;
const METER_BAR_WIDTH = 12;
const METER_VALUE_FONT_SIZE = 30;

// --- colors --------------------------------------------------------------------
export const FAT_LOSS_A_COLOR = "#4a82ff";
export const FAT_LOSS_B_COLOR = "#3ab585";
export const MUSCLE_COLOR_ACTIVE = "#2ecc71"; // vivid growth green (Group A)
export const MUSCLE_COLOR_FLAT = "#9aa39a"; // muted, anticlimactic (Group B)
export const GLOW_COLOR = "rgba(46,204,113,0.55)";

// --- figure reaction sensitivities ---------------------------------------------
const SLIM_SENSITIVITY = 0.0022; // scaleX reduction per % of fat lost
const MUSCLE_GROW_SENSITIVITY = 0.012; // scale increase per % of muscle gained
const DESATURATION_B = 0.55; // saturate() level Group B settles to in phase 7

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Ramps 0 -> target over [start, end], holding at 0 before and at target after.
const rampValue = (
  frame: number,
  start: number,
  end: number,
  target: number,
) =>
  interpolate(frame, [start, end], [0, target], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const phaseSpring = (
  frame: number,
  start: number,
  length: number,
  config: { damping: number; stiffness: number; mass: number },
) =>
  spring({
    frame: Math.max(0, frame - start),
    fps: FPS,
    config,
    durationInFrames: length,
  });

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------
type CamState = { x: number; y: number; scale: number };

const lerpState = (a: CamState, b: CamState, t: number): CamState => ({
  x: interpolate(t, [0, 1], [a.x, b.x]),
  y: interpolate(t, [0, 1], [a.y, b.y]),
  scale: interpolate(t, [0, 1], [a.scale, b.scale]),
});

const groupFocus = (group: Group): CamState => {
  const rect = getGroupPanelRect(group);
  return {
    x: groupPanelX(group) + ZOOM_TARGET_OFFSET_X,
    y: rect.top + rect.height / 2 + ZOOM_TARGET_OFFSET_Y,
    scale: ZOOM_SCALE,
  };
};

const CENTER_STATE: CamState = {
  x: CANVAS_WIDTH / 2,
  y: CANVAS_HEIGHT / 2,
  scale: 1,
};

const computeCamera = (frame: number): CamState => {
  const focusA = groupFocus("A");
  const focusB = groupFocus("B");

  if (frame < F_BARS_END) return CENTER_STATE;

  if (frame < F_PUSH_A1_END) {
    const t = phaseSpring(frame, F_BARS_END, F_PUSH_A1_END - F_BARS_END, CAMERA_PUSH_CONFIG);
    return lerpState(CENTER_STATE, focusA, t);
  }

  if (frame < F_NEUTRAL1_END) {
    const t = phaseSpring(frame, F_PUSH_A1_END, F_NEUTRAL1_END - F_PUSH_A1_END, CAMERA_OUT_CONFIG);
    return lerpState(focusA, CENTER_STATE, t);
  }

  if (frame < F_PUSH_B1_END) {
    const t = phaseSpring(frame, F_NEUTRAL1_END, F_PUSH_B1_END - F_NEUTRAL1_END, CAMERA_PUSH_CONFIG);
    return lerpState(CENTER_STATE, focusB, t);
  }

  if (frame < F_NEUTRAL2_END) {
    const t = phaseSpring(frame, F_PUSH_B1_END, F_NEUTRAL2_END - F_PUSH_B1_END, CAMERA_OUT_CONFIG);
    return lerpState(focusB, CENTER_STATE, t);
  }

  if (frame < F_PUSH_A2_END) {
    const t = phaseSpring(frame, F_NEUTRAL2_END, F_PUSH_A2_END - F_NEUTRAL2_END, CAMERA_PUSH_CONFIG);
    return lerpState(CENTER_STATE, focusA, t);
  }

  if (frame < F_CUT_B_END) {
    // Deliberate hard cut — no easing, straight to Group B, fully zoomed.
    return focusB;
  }

  const t = phaseSpring(frame, F_CUT_B_END, DURATION_IN_FRAMES - F_CUT_B_END, CAMERA_OUT_CONFIG);
  return lerpState(focusB, CENTER_STATE, t);
};

const World: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { x: tx, y: ty, scale } = computeCamera(frame);
  const panX = CANVAS_WIDTH / 2 - tx;
  const panY = CANVAS_HEIGHT / 2 - ty;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transformOrigin: `${tx}px ${ty}px`,
        transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
      }}
    >
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Group state: how far each group has progressed through fat-loss / muscle
// ---------------------------------------------------------------------------
const fatLossValueAt = (frame: number, group: Group) => {
  if (group === "A") return rampValue(frame, 55, 95, FAT_LOSS_A_VALUE);
  return rampValue(frame, 151, 186, FAT_LOSS_B_VALUE);
};

const muscleAValueAt = (frame: number) => rampValue(frame, 247, 280, MUSCLE_A_VALUE);

// Group B's muscle meter: a small attempt, a twitch, then flatlines at 0.
const muscleBValueAt = (frame: number) => {
  const twitchStart = 302;
  if (frame < twitchStart) return 0;
  const local = frame - twitchStart;
  if (local < 6) {
    return interpolate(local, [0, 6], [0, 0.4], { extrapolateRight: "clamp" });
  }
  return interpolate(local, [6, 9, 12, 18], [0.4, 0.1, 0.25, MUSCLE_B_VALUE], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

// ---------------------------------------------------------------------------
// Figures + panel, reacting to that group's current numbers
// ---------------------------------------------------------------------------
const GroupFigures: React.FC<{ group: Group }> = ({ group }) => {
  const frame = useCurrentFrame();
  const fatLoss = fatLossValueAt(frame, group);
  const slimScaleX = 1 + fatLoss * SLIM_SENSITIVITY; // fatLoss is negative -> shrinks

  const muscle = group === "A" ? muscleAValueAt(frame) : muscleBValueAt(frame);
  const muscleScale = group === "A" ? 1 + muscle * MUSCLE_GROW_SENSITIVITY : 1;

  const desaturate =
    group === "B"
      ? interpolate(frame, [F_PUSH_A2_END, F_CUT_B_END], [1, DESATURATION_B], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  const cx = groupPanelX(group);
  const cy = GRID_CENTER_Y;

  const figures = Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => ({
    row: Math.floor(i / GRID_COLS),
    col: i % GRID_COLS,
  })).filter(({ col }) => (col < GRID_COLS / 2) === (group === "A"));

  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        transform: `translate(-50%, -50%) scale(${slimScaleX * muscleScale}, ${muscleScale})`,
        filter: `saturate(${desaturate})`,
      }}
    >
      {figures.map(({ row, col }) => {
        const x =
          GRID_CENTER_X +
          (col - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING +
          (group === "A" ? -SPLIT_OFFSET_X : SPLIT_OFFSET_X) -
          cx;
        const y = GRID_CENTER_Y + (row - (GRID_ROWS - 1) / 2) * FIGURE_V_SPACING - cy;
        return (
          <div
            key={`${row}-${col}`}
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
      })}
    </div>
  );
};

const GroupPanel: React.FC<{ group: Group }> = ({ group }) => {
  const frame = useCurrentFrame();
  const { left, top, width, height } = getGroupPanelRect(group);
  const baseTint = group === "A" ? GROUP_A_TINT : GROUP_B_TINT;

  let background = baseTint;
  let boxShadow = "none";

  if (group === "A") {
    const muscle = muscleAValueAt(frame);
    const brightT = interpolate(muscle, [0, MUSCLE_A_VALUE], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const alpha = interpolate(brightT, [0, 1], [0.14, 0.32]);
    background = `rgba(74,130,255,${alpha})`;

    // Glow pulse right as the muscle meter lands.
    const glow = interpolate(frame, [278, 288, 312], [0, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    boxShadow = `0 0 ${60 * glow}px ${20 * glow}px ${GLOW_COLOR}`;
  }

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        borderRadius: 32,
        background,
        boxShadow,
      }}
    />
  );
};

const GroupLabel: React.FC<{ group: Group }> = ({ group }) => (
  <div
    style={{
      position: "absolute",
      left: groupPanelX(group),
      top: getGroupLabelY(),
      transform: "translate(-50%, 0)",
      fontFamily: FONT_STACK,
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

// ---------------------------------------------------------------------------
// Meters
// ---------------------------------------------------------------------------
const FatLossMeter: React.FC<{ group: Group }> = ({ group }) => {
  const frame = useCurrentFrame();
  const value = fatLossValueAt(frame, group);
  const color = group === "A" ? FAT_LOSS_A_COLOR : FAT_LOSS_B_COLOR;
  const x =
    CANVAS_WIDTH / 2 + (group === "A" ? -FAT_METER_GAP_FROM_CENTER : FAT_METER_GAP_FROM_CENTER);
  const height = (value / FAT_LOSS_SCALE_MIN) * FAT_METER_TRACK_HEIGHT;
  const opacity = interpolate(Math.abs(value), [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: FAT_METER_TOP_Y,
          width: 2,
          height: FAT_METER_TRACK_HEIGHT,
          transform: "translateX(-50%)",
          borderLeft: "2px dashed rgba(120,120,124,0.35)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x,
          top: FAT_METER_TOP_Y,
          width: METER_BAR_WIDTH,
          height,
          transform: "translateX(-50%)",
          borderRadius: METER_BAR_WIDTH / 2,
          background: color,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x,
          top: FAT_METER_TOP_Y + height + 30,
          transform: "translate(-50%, -50%)",
          fontFamily: FONT_STACK,
          fontSize: METER_VALUE_FONT_SIZE,
          fontWeight: 700,
          color,
          whiteSpace: "nowrap",
        }}
      >
        {Math.round(value)}%
      </div>
    </div>
  );
};

const MuscleMeter: React.FC<{ group: Group; startFrame: number }> = ({
  group,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const value = group === "A" ? muscleAValueAt(frame) : muscleBValueAt(frame);
  const color = group === "A" ? MUSCLE_COLOR_ACTIVE : MUSCLE_COLOR_FLAT;
  const x = groupPanelX(group);
  const height = (value / MUSCLE_SCALE_MAX) * MUSCLE_METER_TRACK_HEIGHT;
  // Faded in on a timer, not by value magnitude — Group B's meter settles at
  // exactly 0 and must still read as "flatlined", not "not there".
  const opacity = interpolate(frame, [startFrame, startFrame + 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: MUSCLE_METER_BASELINE_Y - MUSCLE_METER_TRACK_HEIGHT,
          width: 2,
          height: MUSCLE_METER_TRACK_HEIGHT,
          transform: "translateX(-50%)",
          borderLeft: "2px dashed rgba(120,120,124,0.35)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x,
          top: MUSCLE_METER_BASELINE_Y - height,
          width: METER_BAR_WIDTH,
          height,
          transform: "translateX(-50%)",
          borderRadius: METER_BAR_WIDTH / 2,
          background: color,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x,
          top: MUSCLE_METER_BASELINE_Y - height - 30,
          transform: "translate(-50%, -50%)",
          fontFamily: FONT_STACK,
          fontSize: METER_VALUE_FONT_SIZE,
          fontWeight: 700,
          color,
          whiteSpace: "nowrap",
        }}
      >
        {value >= 0 ? "+" : ""}
        {value.toFixed(value === 0 ? 0 : 1)}%
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
const Background: React.FC = () => (
  <AbsoluteFill style={{ background: STUDIO_BACKGROUND }} />
);

const FadingCalorieBars: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, F_BARS_END], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (opacity <= 0) return null;
  return (
    <div style={{ opacity }}>
      <StaticCalorieBars />
    </div>
  );
};

export const ProgressReveal: React.FC = () => {
  const frame = useCurrentFrame();
  // The fat-loss meters sit close to the canvas centerline, so a push-in on
  // the *other* group doesn't fully clip them off frame the way it does the
  // groups themselves — explicitly hide the off-focus one during those
  // pushes so it doesn't peek in at the edge.
  const hideFatA = frame >= F_NEUTRAL1_END && frame < F_PUSH_B1_END; // B push (P4)
  const hideFatAOnCut = frame >= F_PUSH_A2_END && frame < F_CUT_B_END; // cut to B (P7)
  const hideFatB = frame >= F_NEUTRAL2_END && frame < F_PUSH_A2_END; // A push (P6)
  const showMuscleA = frame >= 237;
  const showMuscleB = frame >= F_PUSH_A2_END;

  return (
    <AbsoluteFill style={{ backgroundColor: "#dcdcdd", overflow: "hidden" }}>
      <Background />
      <World>
        <FadingCalorieBars />
        <GroupPanel group="A" />
        <GroupPanel group="B" />
        <GroupFigures group="A" />
        <GroupFigures group="B" />
        <GroupLabel group="A" />
        <GroupLabel group="B" />
        {!hideFatA && !hideFatAOnCut && <FatLossMeter group="A" />}
        {!hideFatB && <FatLossMeter group="B" />}
        {showMuscleA && <MuscleMeter group="A" startFrame={237} />}
        {showMuscleB && <MuscleMeter group="B" startFrame={F_PUSH_A2_END} />}
      </World>
    </AbsoluteFill>
  );
};

export const ProgressRevealComposition: React.FC = () => (
  <Composition
    id="ProgressReveal"
    component={ProgressReveal}
    durationInFrames={DURATION_IN_FRAMES}
    fps={FPS}
    width={CANVAS_WIDTH}
    height={CANVAS_HEIGHT}
  />
);
