import React from "react";
import {
  AbsoluteFill,
  Easing,
  Composition,
  interpolate,
  random,
  spring,
  useCurrentFrame,
} from "remotion";
import { STUDIO_BACKGROUND } from "./GroupSplit";

// ---------------------------------------------------------------------------
// ADJUSTABLE CONSTANTS
// ---------------------------------------------------------------------------
const FPS = 30;
export const DURATION_IN_FRAMES = 1140; // exactly 38s
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

// --- phase boundaries (seconds -> frames) -----------------------------------
const P1_END = Math.round(5 * FPS); // 150 — scatter -> select -> split
const P2_END = Math.round(11 * FPS); // 330 — bowls + day counters
const P3_END = Math.round(15 * FPS); // 450 — desaturate, hold
const P4_END = Math.round(24 * FPS); // 720 — reward meters
const P5_END = Math.round(28 * FPS); // 840 — scales
// P6 runs to DURATION_IN_FRAMES (1140) — wide pull-back + connecting line

// --- cursor / motion feel -----------------------------------------------------
export const CURSOR_SPEED = 1; // >1 = faster moves between waypoints, <1 = slower
export const CURSOR_SPRING = { damping: 13, stiffness: 170, mass: 1 }; // slight overshoot, weight
const CURSOR_SIZE = 34;

// --- zoom levels ----------------------------------------------------------------
export const ZOOM_SELECT = 1.12; // brief zoom while the selection box closes
export const ZOOM_GROUP = 1.8; // phase 2 bowl beats
export const ZOOM_METERS = 2.2; // phase 4 meter beats
export const ZOOM_SCALES = 1.6; // phase 5 scale beat
export const ZOOM_FINAL = 1.15; // phase 6 final push on the connection
const CAMERA_CONFIG = { damping: 20, stiffness: 130, mass: 1 };
const CAMERA_CALM_CONFIG = { damping: 26, stiffness: 110, mass: 1 }; // "same move but calmer"

// --- accent palette -----------------------------------------------------------
export const ACCENT_BLUE = "#2f6bff";
export const ACCENT_MAGENTA = "#ff2fb0";
export const ACCENT_LIME = "#7ed321";
export const ACCENT_GREY = "#9aa0aa";
export const PULSE_RATE_PER_SEC = 2.5; // rhythmic, not strobing
const PULSE_PERIOD = FPS / PULSE_RATE_PER_SEC;

// --- figures --------------------------------------------------------------------
export const FIGURE_COLORS = [
  "#7c93c9", // slate blue
  "#c98a8a", // dusty rose
  "#8fae7d", // sage
  "#cdae76", // warm sand
  "#74b0ac", // soft teal
  "#a888b0", // mauve
  "#c99a5b", // ochre
  "#6f8fae", // denim
];
export const IDLE_INTENSITY = 1; // multiplies bob/breathe amplitude
const IDLE_BOB_AMPLITUDE = 3.2;
const IDLE_BOB_SPEED = 0.55; // hz
const IDLE_BREATHE_AMPLITUDE = 0.035;
const IDLE_BREATHE_SPEED = 0.42; // hz

// --- geometry --------------------------------------------------------------------
const GRID_COLS = 7;
const GRID_ROWS = 7;
const GRID_LEFT_COLS = 4;
const GRID_CENTER_X = 540;
const GRID_CENTER_Y = 670;
const FIGURE_H_SPACING = 80;
const FIGURE_V_SPACING = 82;
const GROUP_SPLIT_OFFSET_X = 190;
const FIGURE_W = 36;
const FIGURE_H = 60;

const BOWL_Y = 300;
const COUNTER_Y = 364;
const STUDY_TOTAL_DAYS = 56;

const METERS_BASELINE_Y = 1245;
const METER_TRACK_HEIGHT = 230;
const METER_GAP = 190;
const METER_WIDTH = 24;

const SCALE_Y = 1473;
const SCALE_DIAMETER = 260;
const SCALE_DISPLAY_VALUE = "142.0";

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
};

const settle = (frame: number, start: number, duration: number, config = CAMERA_CONFIG) =>
  spring({
    frame: Math.max(0, frame - start),
    fps: FPS,
    config,
    durationInFrames: Math.max(1, duration / CURSOR_SPEED),
  });

const clamp01 = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const pulseWave = (frame: number, start: number, cycles: number) => {
  const local = frame - start;
  const totalDuration = cycles * PULSE_PERIOD;
  if (local < 0 || local > totalDuration) return 0;
  return (Math.sin((local / PULSE_PERIOD) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
};

// ---------------------------------------------------------------------------
// Camera — same scale+pan-about-pivot technique used elsewhere in this repo.
// ---------------------------------------------------------------------------
type CamState = { x: number; y: number; scale: number };
const CENTER_STATE: CamState = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, scale: 1 };

const lerpState = (a: CamState, b: CamState, t: number): CamState => ({
  x: interpolate(t, [0, 1], [a.x, b.x]),
  y: interpolate(t, [0, 1], [a.y, b.y]),
  scale: interpolate(t, [0, 1], [a.scale, b.scale]),
});

// Precise side centers (see FigureField for the identical per-figure formula).
const LEFT_X =
  GRID_CENTER_X + ((GRID_LEFT_COLS - 1) / 2 - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING - GROUP_SPLIT_OFFSET_X;
const RIGHT_X =
  GRID_CENTER_X +
  ((GRID_LEFT_COLS + (GRID_COLS - 1)) / 2 - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING +
  GROUP_SPLIT_OFFSET_X;

const SELECT_FOCUS: CamState = { x: GRID_CENTER_X, y: GRID_CENTER_Y, scale: ZOOM_SELECT };
const LEFT_GROUP_FOCUS: CamState = { x: LEFT_X, y: GRID_CENTER_Y, scale: ZOOM_GROUP };
const RIGHT_GROUP_FOCUS: CamState = { x: RIGHT_X, y: GRID_CENTER_Y, scale: ZOOM_GROUP };
const LEFT_METERS_FOCUS: CamState = {
  x: LEFT_X,
  y: METERS_BASELINE_Y - METER_TRACK_HEIGHT / 2,
  scale: ZOOM_METERS,
};
const RIGHT_METERS_FOCUS: CamState = {
  x: RIGHT_X,
  y: METERS_BASELINE_Y - METER_TRACK_HEIGHT / 2,
  scale: ZOOM_METERS,
};
const SCALES_FOCUS: CamState = { x: GRID_CENTER_X, y: SCALE_Y, scale: ZOOM_SCALES };
const CONNECTION_FOCUS: CamState = {
  x: GRID_CENTER_X,
  y: (METERS_BASELINE_Y + SCALE_Y) / 2,
  scale: ZOOM_FINAL,
};

const computeCamera = (frame: number): CamState => {
  if (frame < 60) return CENTER_STATE;
  if (frame < 95) return lerpState(CENTER_STATE, SELECT_FOCUS, settle(frame, 60, 35));
  if (frame < 122) return lerpState(SELECT_FOCUS, CENTER_STATE, settle(frame, 95, 27));
  if (frame < P1_END) return CENTER_STATE;

  if (frame < 184) return CENTER_STATE;
  if (frame < 220) return lerpState(CENTER_STATE, LEFT_GROUP_FOCUS, settle(frame, 184, 36));
  if (frame < 262) return LEFT_GROUP_FOCUS;
  if (frame < 276) return lerpState(LEFT_GROUP_FOCUS, RIGHT_GROUP_FOCUS, settle(frame, 262, 14, CAMERA_CALM_CONFIG));
  if (frame < 306) return RIGHT_GROUP_FOCUS;
  if (frame < P2_END) return lerpState(RIGHT_GROUP_FOCUS, CENTER_STATE, settle(frame, 306, 24));

  if (frame < P3_END) {
    const t = clamp01(frame, P2_END, P3_END);
    return lerpState(CENTER_STATE, { ...CENTER_STATE, scale: 1.08 }, t);
  }

  if (frame < 476) return lerpState({ ...CENTER_STATE, scale: 1.08 }, LEFT_METERS_FOCUS, settle(frame, P3_END, 26));
  if (frame < 655) return LEFT_METERS_FOCUS;
  if (frame < 668) return lerpState(LEFT_METERS_FOCUS, RIGHT_METERS_FOCUS, settle(frame, 655, 13, CAMERA_CALM_CONFIG));
  if (frame < P4_END) return RIGHT_METERS_FOCUS;

  if (frame < 780) return lerpState(RIGHT_METERS_FOCUS, SCALES_FOCUS, settle(frame, P4_END, 60));
  if (frame < P5_END) return SCALES_FOCUS;

  if (frame < 880) return lerpState(SCALES_FOCUS, CENTER_STATE, settle(frame, P5_END, 40));
  if (frame < 1010) return CENTER_STATE;
  return lerpState(CENTER_STATE, CONNECTION_FOCUS, settle(frame, 1010, 50));
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
// Figures — capsule bodies, soft shading, idle breathing/bob, individuality.
// ---------------------------------------------------------------------------
const Figure3D: React.FC<{ seed: string; color: string }> = ({ seed, color }) => {
  const frame = useCurrentFrame();
  const heightVar = 0.88 + random(`h-${seed}`) * 0.26;
  const posture = (random(`r-${seed}`) - 0.5) * 10;
  const phase = random(`p-${seed}`) * Math.PI * 2;
  const t = frame / FPS;

  const bob =
    Math.sin(t * IDLE_BOB_SPEED * Math.PI * 2 + phase) * IDLE_BOB_AMPLITUDE * IDLE_INTENSITY;
  const breathe =
    1 + Math.sin(t * IDLE_BREATHE_SPEED * Math.PI * 2 + phase * 1.3) * IDLE_BREATHE_AMPLITUDE * IDLE_INTENSITY;

  const light = shade(color, 55);
  const dark = shade(color, -35);

  return (
    <div
      style={{
        transform: `translateY(${bob}px) rotate(${posture}deg) scale(${heightVar * breathe})`,
      }}
    >
      <div
        style={{
          width: FIGURE_W * 0.68,
          height: FIGURE_W * 0.68,
          borderRadius: "50%",
          margin: "0 auto 3px",
          background: `radial-gradient(circle at 35% 30%, ${light} 0%, ${color} 65%, ${dark} 100%)`,
          boxShadow: "0 3px 5px rgba(0,0,0,0.16)",
        }}
      />
      <div
        style={{
          width: FIGURE_W,
          height: FIGURE_H,
          borderRadius: FIGURE_W / 2,
          background: `linear-gradient(155deg, ${light} 0%, ${color} 55%, ${dark} 100%)`,
          boxShadow: "0 8px 14px rgba(0,0,0,0.2)",
        }}
      />
    </div>
  );
};

type FigureSlot = { row: number; col: number; scatterX: number; scatterY: number };

const buildSlots = (): FigureSlot[] =>
  Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => {
    const row = Math.floor(i / GRID_COLS);
    const col = i % GRID_COLS;
    const seed = `scatter-${row}-${col}`;
    return {
      row,
      col,
      scatterX: 170 + random(`${seed}-x`) * 740,
      scatterY: 430 + random(`${seed}-y`) * 480,
    };
  });

const SLOTS = buildSlots();

const FigureField: React.FC = () => {
  const frame = useCurrentFrame();
  // Everyone travels from their scattered start straight to their grid slot
  // in one cascade — no intermediate "tidy grid" pose.
  const splitT = settle(frame, 66, P1_END - 66);

  return (
    <>
      {SLOTS.map(({ row, col, scatterX, scatterY }, i) => {
        const side: "left" | "right" = col < GRID_LEFT_COLS ? "left" : "right";
        const gridX =
          GRID_CENTER_X +
          (col - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING +
          (side === "left" ? -GROUP_SPLIT_OFFSET_X : GROUP_SPLIT_OFFSET_X);
        const gridY = GRID_CENTER_Y + (row - (GRID_ROWS - 1) / 2) * FIGURE_V_SPACING;

        const popIn = interpolate(frame, [0, 20], [0, 1], {
          easing: Easing.out(Easing.cubic),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        // Highlight pulse right after the click (frame 62-90), all 49 at once.
        const highlightT = pulseWave(frame, 66, 2);

        const cascade = clamp01(splitT, 0, 1);
        const perFigureDelay = ((row + col) / (GRID_ROWS + GRID_COLS)) * 0.35;
        const localT = interpolate(cascade, [perFigureDelay, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const x = interpolate(localT, [0, 1], [scatterX, gridX]);
        const y = interpolate(localT, [0, 1], [scatterY, gridY]);

        return (
          <div
            key={`${row}-${col}`}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `translate(-50%, -50%) scale(${popIn})`,
              opacity: popIn,
              filter: highlightT > 0 ? `drop-shadow(0 0 ${10 * highlightT}px ${ACCENT_BLUE})` : undefined,
            }}
          >
            <Figure3D seed={`fig-${row}-${col}`} color={FIGURE_COLORS[i % FIGURE_COLORS.length]} />
          </div>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------------------
// Selection box (phase 1): drags open, flashes accent blue as it closes.
// ---------------------------------------------------------------------------
const SelectionBox: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [26, 34, 66, 78], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (opacity <= 0) return null;

  const t = interpolate(frame, [28, 58], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x0 = 180;
  const y0 = 430;
  const x1 = interpolate(t, [0, 1], [x0, 900]);
  const y1 = interpolate(t, [0, 1], [y0, 850]);

  const flash = pulseWave(frame, 58, 1.4);

  return (
    <div
      style={{
        position: "absolute",
        left: Math.min(x0, x1),
        top: Math.min(y0, y1),
        width: Math.abs(x1 - x0),
        height: Math.abs(y1 - y0),
        border: `2.5px solid ${ACCENT_BLUE}`,
        background: `rgba(47,107,255,${0.05 + flash * 0.1})`,
        borderRadius: 10,
        opacity,
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// Cursor — the whole video is driven by this. Position via spring segments
// with slight overshoot; clicks produce a ripple + a scale-pop on target.
// ---------------------------------------------------------------------------
type CursorKF = { frame: number; x: number; y: number; click?: boolean };

const CURSOR_KEYFRAMES: CursorKF[] = [
  { frame: 0, x: -60, y: -60 },
  { frame: 20, x: 150, y: 380 },
  { frame: 28, x: 180, y: 430 },
  { frame: 58, x: 900, y: 850 },
  { frame: 62, x: 900, y: 850, click: true },
  { frame: 95, x: 540, y: 610 },
  { frame: P1_END, x: 540, y: 610 },
  { frame: 176, x: LEFT_X, y: 700 },
  { frame: 184, x: LEFT_X, y: 700, click: true },
  { frame: 260, x: LEFT_X, y: 700 },
  { frame: 288, x: RIGHT_X, y: 700 },
  { frame: 296, x: RIGHT_X, y: 700, click: true },
  { frame: P2_END, x: RIGHT_X, y: 700 },
  { frame: P3_END, x: GRID_CENTER_X, y: GRID_CENTER_Y },
  { frame: 468, x: LEFT_X, y: METERS_BASELINE_Y - 120 },
  { frame: 476, x: LEFT_X, y: METERS_BASELINE_Y - 120, click: true },
  { frame: 652, x: LEFT_X, y: METERS_BASELINE_Y - 120 },
  { frame: 666, x: RIGHT_X, y: METERS_BASELINE_Y - 120 },
  { frame: 674, x: RIGHT_X, y: METERS_BASELINE_Y - 120, click: true },
  { frame: P4_END, x: RIGHT_X, y: METERS_BASELINE_Y - 120 },
  { frame: 733, x: GRID_CENTER_X, y: 1300 },
  { frame: 748, x: GRID_CENTER_X, y: SCALE_Y },
  { frame: 754, x: GRID_CENTER_X, y: SCALE_Y, click: true },
  { frame: P5_END, x: GRID_CENTER_X, y: SCALE_Y },
  { frame: 878, x: LEFT_X, y: METERS_BASELINE_Y - 120 },
  { frame: 950, x: RIGHT_X + 50, y: SCALE_Y },
  { frame: 1010, x: GRID_CENTER_X, y: (METERS_BASELINE_Y + SCALE_Y) / 2 },
  { frame: DURATION_IN_FRAMES, x: GRID_CENTER_X, y: (METERS_BASELINE_Y + SCALE_Y) / 2 },
];

export const CLICK_FRAMES = CURSOR_KEYFRAMES.filter((k) => k.click).map((k) => k.frame);

const cursorPosition = (frame: number) => {
  let prev = CURSOR_KEYFRAMES[0];
  let next = CURSOR_KEYFRAMES[CURSOR_KEYFRAMES.length - 1];
  for (let i = 0; i < CURSOR_KEYFRAMES.length - 1; i++) {
    if (frame >= CURSOR_KEYFRAMES[i].frame && frame <= CURSOR_KEYFRAMES[i + 1].frame) {
      prev = CURSOR_KEYFRAMES[i];
      next = CURSOR_KEYFRAMES[i + 1];
      break;
    }
  }
  const duration = Math.max(1, next.frame - prev.frame);
  const t = settle(frame, prev.frame, duration, CURSOR_SPRING);
  // Anticipation: a small pull-back just before arrival on a click waypoint.
  const anticipation = next.click
    ? interpolate(frame, [next.frame - 10, next.frame - 3, next.frame], [0, -1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }) * 10
    : 0;
  const dirX = next.x - prev.x;
  const dirY = next.y - prev.y;
  const dirLen = Math.max(1, Math.hypot(dirX, dirY));
  return {
    x: interpolate(t, [0, 1], [prev.x, next.x]) - (dirX / dirLen) * anticipation,
    y: interpolate(t, [0, 1], [prev.y, next.y]) - (dirY / dirLen) * anticipation,
  };
};

export const clickPopScale = (frame: number) => {
  for (const clickFrame of CLICK_FRAMES) {
    const local = frame - clickFrame;
    if (local >= 0 && local < 16) {
      const s = spring({
        frame: local,
        fps: FPS,
        config: { damping: 9, stiffness: 260, mass: 0.6 },
      });
      return interpolate(s, [0, 1], [1, 1.14]);
    }
  }
  return 1;
};

const CursorRipples: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      {CLICK_FRAMES.map((clickFrame) => {
        const local = frame - clickFrame;
        if (local < 0 || local > 22) return null;
        const { x, y } = cursorPosition(clickFrame);
        const t = local / 22;
        return (
          <div
            key={clickFrame}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: interpolate(t, [0, 1], [8, 70]),
              height: interpolate(t, [0, 1], [8, 70]),
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              border: `2.5px solid ${ACCENT_BLUE}`,
              opacity: interpolate(t, [0, 1], [0.6, 0]),
            }}
          />
        );
      })}
    </>
  );
};

const Cursor: React.FC = () => {
  const frame = useCurrentFrame();
  const { x, y } = cursorPosition(frame);
  const isClicking = CLICK_FRAMES.some((f) => frame >= f && frame - f < 8);
  const pressScale = isClicking ? 0.86 : 1;

  return (
    <>
      <CursorRipples />
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: `translate(-4px, -2px) scale(${pressScale})`,
          filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.28))",
        }}
      >
        <svg width={CURSOR_SIZE} height={CURSOR_SIZE} viewBox="0 0 24 24">
          <path
            d="M4 2 L4 20 L9 15.5 L12.5 22 L15.5 20.5 L12 14 L19 14 Z"
            fill="#232326"
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Highlight outline — draws itself, then pulses N times.
// ---------------------------------------------------------------------------
const HighlightBox: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  startFrame: number;
  drawDuration?: number;
  pulseCount?: number;
}> = ({ x, y, width, height, color, startFrame, drawDuration = 18, pulseCount = 2 }) => {
  const frame = useCurrentFrame();
  if (frame < startFrame) return null;

  const perimeter = 2 * (width + height);
  const drawT = interpolate(frame, [startFrame, startFrame + drawDuration], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pulse = pulseWave(frame, startFrame + drawDuration, pulseCount);
  const fadeOutStart = startFrame + drawDuration + pulseCount * PULSE_PERIOD + 6;
  const fadeOut = interpolate(frame, [fadeOutStart, fadeOutStart + 20], [1, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = drawT * fadeOut;
  const strokeWidth = 3 + pulse * 2;

  return (
    <svg
      style={{ position: "absolute", left: x, top: y, overflow: "visible" }}
      width={width}
      height={height}
    >
      <rect
        x={strokeWidth / 2}
        y={strokeWidth / 2}
        width={width - strokeWidth}
        height={height - strokeWidth}
        rx={14}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={perimeter}
        strokeDashoffset={perimeter * (1 - drawT)}
        opacity={opacity}
      />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Phase 2: bowl + day counter
// ---------------------------------------------------------------------------
const Bowl: React.FC<{ side: "left" | "right"; startFrame: number; color: string }> = ({
  side,
  startFrame,
  color,
}) => {
  const frame = useCurrentFrame();
  if (frame < startFrame) return null;
  const x = side === "left" ? LEFT_X : RIGHT_X;

  const drop = spring({
    frame: frame - startFrame,
    fps: FPS,
    config: { damping: 10, stiffness: 220, mass: 0.7 },
  });
  const y = interpolate(drop, [0, 1], [BOWL_Y - 160, BOWL_Y]);
  const scale = interpolate(drop, [0, 0.7, 1], [0.6, 1.08, 1]);

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <div
          style={{
            width: 150,
            height: 78,
            background: "#ffffff",
            border: `3px solid ${color}`,
            borderTop: "none",
            borderRadius: "0 0 75px 75px",
            boxShadow: "0 10px 18px rgba(0,0,0,0.1)",
          }}
        />
        <div
          style={{
            width: 166,
            height: 14,
            marginTop: -9,
            marginLeft: -8,
            background: "#ffffff",
            border: `3px solid ${color}`,
            borderRadius: 7,
          }}
        />
      </div>
      <HighlightBox
        x={x - 95}
        y={BOWL_Y - 55}
        width={190}
        height={110}
        color={ACCENT_MAGENTA}
        startFrame={startFrame + 14}
        pulseCount={2}
      />
    </>
  );
};

const DayCounter: React.FC<{ side: "left" | "right"; startFrame: number }> = ({
  side,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  if (frame < startFrame) return null;
  const x = side === "left" ? LEFT_X : RIGHT_X;
  const local = frame - startFrame;

  const t = interpolate(local, [6, 46], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const day = Math.max(1, Math.round(interpolate(t, [0, 1], [1, STUDY_TOTAL_DAYS])));
  const blur = interpolate(t, [0, 0.6, 1], [0, 3, 0]);
  const label = t >= 1 ? "8 WEEKS" : `DAY ${day}`;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: COUNTER_Y,
        transform: "translate(-50%, -50%)",
        fontFamily: FONT_STACK,
        fontSize: 19,
        fontWeight: 700,
        letterSpacing: 2,
        color: "#6a6a6f",
        filter: `blur(${blur}px)`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Phase 4: meters with gradient fill + flaring top edge on the active side.
// ---------------------------------------------------------------------------
const Meter: React.FC<{
  x: number;
  finalFraction: number;
  active: boolean;
  label: string;
  startFrame: number;
}> = ({ x, finalFraction, active, label, startFrame }) => {
  const frame = useCurrentFrame();
  if (frame < startFrame) return null;
  const local = frame - startFrame;

  const t = interpolate(local, [0, 46], [0, 1], {
    easing: active ? Easing.out(Easing.cubic) : Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const height = t * finalFraction * METER_TRACK_HEIGHT;
  const value = Math.round(t * finalFraction * 100);
  const flare = active ? pulseWave(frame, startFrame, 6) : 0;

  const gradient = active
    ? `linear-gradient(180deg, ${ACCENT_MAGENTA} 0%, #ff7a3d 55%, #ffb84d 100%)`
    : `linear-gradient(180deg, ${ACCENT_GREY} 0%, #b7bcc4 100%)`;

  return (
    <div>
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
          background: gradient,
          boxShadow: active ? `0 0 ${10 + flare * 14}px ${ACCENT_MAGENTA}` : "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x,
          top: METERS_BASELINE_Y - height - 34,
          transform: "translate(-50%, -50%)",
          fontFamily: FONT_STACK,
          fontSize: 22,
          fontWeight: 700,
          color: active ? "#c94f8f" : "#8a9099",
          whiteSpace: "nowrap",
        }}
      >
        {value}%
      </div>
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
          color: "#8a8a8f",
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
      <HighlightBox
        x={x - 40}
        y={METERS_BASELINE_Y - METER_TRACK_HEIGHT - 20}
        width={80}
        height={METER_TRACK_HEIGHT + 40}
        color={active ? ACCENT_MAGENTA : ACCENT_GREY}
        startFrame={startFrame + 48}
        pulseCount={active ? 3 : 1}
      />
    </div>
  );
};

const MetersPanel: React.FC<{ side: "left" | "right"; startFrame: number }> = ({
  side,
  startFrame,
}) => {
  const x = side === "left" ? LEFT_X : RIGHT_X;
  const active = side === "left";
  return (
    <>
      <Meter
        x={x - METER_GAP / 2}
        finalFraction={active ? 0.88 : 0.1}
        active={active}
        label="food reward response"
        startFrame={startFrame}
      />
      <Meter
        x={x + METER_GAP / 2}
        finalFraction={active ? 0.74 : 0.14}
        active={active}
        label="preference for these foods"
        startFrame={startFrame}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Phase 5: scales — numbers cycle fast, then settle unchanged.
// ---------------------------------------------------------------------------
const Scale: React.FC<{ side: "left" | "right"; startFrame: number }> = ({
  side,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  if (frame < startFrame) return null;
  const x = side === "left" ? LEFT_X : RIGHT_X;
  const local = frame - startFrame;

  const drop = spring({
    frame: local,
    fps: FPS,
    config: { damping: 11, stiffness: 200, mass: 0.7 },
  });
  const y = interpolate(drop, [0, 1], [SCALE_Y + 200, SCALE_Y]);
  const popScale = interpolate(drop, [0, 0.7, 1], [0.7, 1.06, 1]);

  const cycling = local < 40;
  const display = cycling
    ? (130 + random(`cycle-${Math.floor(local / 2)}`) * 30).toFixed(1)
    : SCALE_DISPLAY_VALUE;

  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${popScale})` }}>
      <div
        style={{
          position: "relative",
          width: SCALE_DIAMETER,
          height: SCALE_DIAMETER,
          borderRadius: "50%",
          background: "radial-gradient(circle at 38% 32%, #ffffff 0%, #ffffff 45%, #e7e7e8 100%)",
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
          {display}
        </div>
      </div>
    </div>
  );
};

const NoChangeOutline: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const left = LEFT_X - SCALE_DIAMETER / 2 - 24;
  const width = RIGHT_X - LEFT_X + SCALE_DIAMETER + 48;
  return (
    <HighlightBox
      x={left}
      y={SCALE_Y - SCALE_DIAMETER / 2 - 24}
      width={width}
      height={SCALE_DIAMETER + 48}
      color={ACCENT_LIME}
      startFrame={startFrame}
      drawDuration={26}
      pulseCount={3}
    />
  );
};

// ---------------------------------------------------------------------------
// Phase 3: desaturate everything except the two groups.
// ---------------------------------------------------------------------------
// Phase 3 only ("everything desaturates except the two groups") — fully
// lifted again by the time phase 4's vivid meter gradients appear.
const Desaturator: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const fadeIn = clamp01(frame, P2_END, P2_END + 30);
  const fadeOut = clamp01(frame, P3_END, P3_END + 30);
  const amount = fadeIn * (1 - fadeOut);
  return <div style={{ filter: `saturate(${1 - amount * 0.85})` }}>{children}</div>;
};

// ---------------------------------------------------------------------------
// Phase 6: connecting line between the meters and the scales.
// ---------------------------------------------------------------------------
const ConnectingLine: React.FC = () => {
  const frame = useCurrentFrame();
  const start = 878;
  if (frame < start) return null;

  const t = interpolate(frame, [start, start + 60], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x1 = LEFT_X;
  const y1 = METERS_BASELINE_Y - 110;
  const x2 = RIGHT_X + 50;
  const y2 = SCALE_Y;
  const cx = interpolate(t, [0, 1], [x1, x2]);
  const cy = interpolate(t, [0, 1], [y1, y2]);

  const pulse = pulseWave(frame, start + 60, 3);

  return (
    <svg style={{ position: "absolute", inset: 0, overflow: "visible" }} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
      <line
        x1={x1}
        y1={y1}
        x2={cx}
        y2={cy}
        stroke={ACCENT_BLUE}
        strokeWidth={3 + pulse * 2}
        strokeDasharray="10 8"
        strokeLinecap="round"
        opacity={0.85}
      />
      <circle cx={x1} cy={y1} r={6} fill={ACCENT_BLUE} />
      {t >= 1 && <circle cx={x2} cy={y2} r={6} fill={ACCENT_BLUE} />}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
const RawBackground: React.FC = () => <AbsoluteFill style={{ background: STUDIO_BACKGROUND }} />;
const Background: React.FC = () => (
  <Desaturator>
    <RawBackground />
  </Desaturator>
);

export const DashboardDemo: React.FC = () => {
  const frame = useCurrentFrame();

  const showBowls = frame >= P1_END && frame < P2_END + 20;
  const showMeters = frame >= P3_END;
  const showScales = frame >= 700;
  const showNoChange = frame >= 796;

  return (
    <AbsoluteFill style={{ backgroundColor: "#dcdcdd", overflow: "hidden" }}>
      <Background />
      <World>
        <FigureField />
        <Desaturator>
          {showBowls && (
            <>
              <Bowl side="left" startFrame={184} color={ACCENT_MAGENTA} />
              <Bowl side="right" startFrame={296} color={ACCENT_BLUE} />
              <DayCounter side="left" startFrame={196} />
              <DayCounter side="right" startFrame={308} />
            </>
          )}
          {showMeters && (
            <>
              <MetersPanel side="left" startFrame={476} />
              <MetersPanel side="right" startFrame={674} />
            </>
          )}
          {showScales && (
            <>
              <Scale side="left" startFrame={754} />
              <Scale side="right" startFrame={754} />
            </>
          )}
          {showNoChange && <NoChangeOutline startFrame={796} />}
          {frame < P1_END && <SelectionBox />}
          <ConnectingLine />
        </Desaturator>
      </World>
      <Cursor />
    </AbsoluteFill>
  );
};

export const DashboardDemoComposition: React.FC = () => (
  <Composition
    id="DashboardDemo"
    component={DashboardDemo}
    durationInFrames={DURATION_IN_FRAMES}
    fps={FPS}
    width={CANVAS_WIDTH}
    height={CANVAS_HEIGHT}
  />
);
