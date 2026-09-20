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
import { STUDIO_BACKGROUND } from "./GroupSplit";

// ---------------------------------------------------------------------------
// ADJUSTABLE CONSTANTS
// ---------------------------------------------------------------------------
const FPS = 30;
export const DURATION_IN_FRAMES = 978; // exactly 32.6s
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

// --- scene boundaries (frames) — independently adjustable ---------------------
export const SCENES = {
  s1: [0, 136],
  s2: [136, 313],
  s3: [313, 419],
  s4: [419, 670],
  s5: [670, 731],
  s6: [732, 808],
  s7: [808, DURATION_IN_FRAMES],
} as const;

// --- transitions: [center frame, duration] ------------------------------------
export const TRANSITION_DURATION = 12; // 8-14 frames, per spec
const T1 = [SCENES.s1[1], TRANSITION_DURATION] as const; // panel drop
const T2 = [SCENES.s2[1], TRANSITION_DURATION] as const; // swipe left
const T3 = [SCENES.s3[1], TRANSITION_DURATION] as const; // expand-to-fill
const T4 = [SCENES.s4[1], TRANSITION_DURATION] as const; // collapse + pull out
const T5 = [SCENES.s5[1], TRANSITION_DURATION] as const; // swipe up
const T6 = [SCENES.s6[1], TRANSITION_DURATION] as const; // drag away + reveal

// --- cursor / motion feel -----------------------------------------------------
export const CURSOR_SPEED = 1;
export const CURSOR_SPRING = { damping: 13, stiffness: 170, mass: 1 };
const CURSOR_SIZE = 34;

// --- zoom levels ----------------------------------------------------------------
export const ZOOM_GROUP = 2.2; // scene 4's "already at 2.2x from the expand"
const CAMERA_CONFIG = { damping: 20, stiffness: 130, mass: 1 };
const CAMERA_FAST_CONFIG = { damping: 15, stiffness: 220, mass: 0.9 }; // transition-speed camera moves

// --- accent palette -----------------------------------------------------------
export const ACCENT_BLUE = "#2f6bff";
export const ACCENT_MAGENTA = "#ff2fb0";
export const ACCENT_LIME = "#7ed321";
export const ACCENT_GREY = "#9aa0aa";
export const PULSE_RATE_PER_SEC = 2.6; // max 3/sec per spec
const PULSE_PERIOD = FPS / PULSE_RATE_PER_SEC;

// --- figures --------------------------------------------------------------------
export const FIGURE_COLORS = [
  "#7c93c9",
  "#c98a8a",
  "#8fae7d",
  "#cdae76",
  "#74b0ac",
  "#a888b0",
  "#c99a5b",
  "#6f8fae",
];
export const IDLE_INTENSITY = 1;
const IDLE_BOB_AMPLITUDE = 3.2;
const IDLE_BOB_SPEED = 0.55;
const IDLE_BREATHE_AMPLITUDE = 0.035;
const IDLE_BREATHE_SPEED = 0.42;

// --- geometry --------------------------------------------------------------------
const GRID_COLS = 7;
const GRID_ROWS = 7;
const GRID_LEFT_COLS = 4;
const GRID_CENTER_X = 540;
const GRID_CENTER_Y = 700;
const FIGURE_H_SPACING = 80;
const FIGURE_V_SPACING = 82;
const GROUP_SPLIT_OFFSET_X = 190;
const FIGURE_W = 36;
const FIGURE_H = 60;

const LEFT_X =
  GRID_CENTER_X + ((GRID_LEFT_COLS - 1) / 2 - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING - GROUP_SPLIT_OFFSET_X;
const RIGHT_X =
  GRID_CENTER_X +
  ((GRID_LEFT_COLS + (GRID_COLS - 1)) / 2 - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING +
  GROUP_SPLIT_OFFSET_X;

const BOWL_Y = 250;
const CALENDAR_Y = 345;
const STUDY_TOTAL_DAYS = 56;

const METERS_BASELINE_Y = 1275;
const METER_TRACK_HEIGHT = 230;
const METER_GAP = 190;
const METER_WIDTH = 24;

const SCALE_Y = 1503;
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
  const total = cycles * PULSE_PERIOD;
  if (local < 0 || local > total) return 0;
  return (Math.sin((local / PULSE_PERIOD) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
};

// A transition's local progress: 0 before it starts, 0..1 through its window
// (eased, with a touch of overshoot), 1 after.
const transitionT = (frame: number, [center, duration]: readonly [number, number]) => {
  const start = center - duration / 2;
  return settle(frame, start, duration, { damping: 14, stiffness: 200, mass: 0.9 });
};
const transitionActive = (frame: number, [center, duration]: readonly [number, number]) => {
  const start = center - duration / 2;
  return frame >= start - 2 && frame <= center + duration;
};

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------
type CamState = { x: number; y: number; scale: number };
const CENTER_STATE: CamState = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, scale: 1 };
const LEFT_FOCUS: CamState = { x: LEFT_X, y: GRID_CENTER_Y, scale: ZOOM_GROUP };
const RIGHT_FOCUS: CamState = { x: RIGHT_X, y: GRID_CENTER_Y, scale: ZOOM_GROUP };
const CONNECTION_FOCUS: CamState = {
  x: GRID_CENTER_X,
  y: (METERS_BASELINE_Y + SCALE_Y) / 2,
  scale: 1.15,
};

const lerpState = (a: CamState, b: CamState, t: number): CamState => ({
  x: interpolate(t, [0, 1], [a.x, b.x]),
  y: interpolate(t, [0, 1], [a.y, b.y]),
  scale: interpolate(t, [0, 1], [a.scale, b.scale]),
});

const computeCamera = (frame: number): CamState => {
  // Scenes 1-3: framed center, no travel during scene 3 itself.
  if (frame < T3[0] - T3[1] / 2) return CENTER_STATE;
  // T3: expand-to-fill onto the left group.
  if (frame < SCENES.s4[0] + 20) {
    const t = transitionT(frame, T3);
    return lerpState(CENTER_STATE, LEFT_FOCUS, t);
  }
  // Scene 4a/b: held on the left group.
  const dragStart = 636;
  if (frame < dragStart) return LEFT_FOCUS;
  // Scene 4c: cursor drags the whole canvas right onto the right group.
  if (frame < SCENES.s4[1]) {
    const t = settle(frame, dragStart, SCENES.s4[1] - dragStart, CAMERA_FAST_CONFIG);
    return lerpState(LEFT_FOCUS, RIGHT_FOCUS, t);
  }
  // Scene 5: no camera travel at all, per spec.
  if (frame < SCENES.s5[1]) return RIGHT_FOCUS;
  // Scene 6: typographic beat — center frame (camera itself doesn't matter
  // here since the word renders outside World, but it should still arrive
  // at CENTER_STATE in sync with T6, the scene-6-to-7 drag-away transition,
  // so scene 7 genuinely opens "already zooming out" as spec'd).
  if (frame < SCENES.s7[0] + 40) {
    const t = transitionT(frame, T6);
    return lerpState(RIGHT_FOCUS, CENTER_STATE, t);
  }
  // Scene 7: hold wide, then slow push-in on the connection.
  if (frame < 900) return CENTER_STATE;
  const t = clamp01(frame, 900, DURATION_IN_FRAMES - 10);
  return lerpState(CENTER_STATE, CONNECTION_FOCUS, t);
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
// Figures — persistent across every scene; camera does the framing work.
// ---------------------------------------------------------------------------
const Figure3D: React.FC<{
  seed: string;
  color: string;
  wireframe?: boolean;
  lean?: number; // extra rotation, degrees
}> = ({ seed, color, wireframe = false, lean = 0 }) => {
  const frame = useCurrentFrame();
  const heightVar = 0.88 + random(`h-${seed}`) * 0.26;
  const posture = (random(`r-${seed}`) - 0.5) * 10;
  const phase = random(`p-${seed}`) * Math.PI * 2;
  const t = frame / FPS;

  const bob = Math.sin(t * IDLE_BOB_SPEED * Math.PI * 2 + phase) * IDLE_BOB_AMPLITUDE * IDLE_INTENSITY;
  const breathe =
    1 + Math.sin(t * IDLE_BREATHE_SPEED * Math.PI * 2 + phase * 1.3) * IDLE_BREATHE_AMPLITUDE * IDLE_INTENSITY;

  const light = shade(color, 55);
  const dark = shade(color, -35);

  return (
    <div
      style={{
        transform: `translateY(${bob}px) rotate(${posture + lean}deg) scale(${heightVar * breathe})`,
      }}
    >
      <div
        style={{
          width: FIGURE_W * 0.68,
          height: FIGURE_W * 0.68,
          borderRadius: "50%",
          margin: "0 auto 3px",
          background: wireframe ? "transparent" : `radial-gradient(circle at 35% 30%, ${light} 0%, ${color} 65%, ${dark} 100%)`,
          border: wireframe ? `1.5px solid ${ACCENT_BLUE}` : "none",
          boxShadow: wireframe ? `0 0 8px ${ACCENT_BLUE}` : "0 3px 5px rgba(0,0,0,0.16)",
        }}
      />
      <div
        style={{
          width: FIGURE_W,
          height: FIGURE_H,
          borderRadius: FIGURE_W / 2,
          background: wireframe ? "transparent" : `linear-gradient(155deg, ${light} 0%, ${color} 55%, ${dark} 100%)`,
          border: wireframe ? `1.5px solid ${ACCENT_BLUE}` : "none",
          boxShadow: wireframe ? `0 0 10px ${ACCENT_BLUE}` : "0 8px 14px rgba(0,0,0,0.2)",
        }}
      />
    </div>
  );
};

type Slot = { row: number; col: number; scatterX: number; scatterY: number };
const SLOTS: Slot[] = Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => {
  const row = Math.floor(i / GRID_COLS);
  const col = i % GRID_COLS;
  const seed = `scatter-${row}-${col}`;
  return {
    row,
    col,
    scatterX: 170 + random(`${seed}-x`) * 740,
    scatterY: 460 + random(`${seed}-y`) * 480,
  };
});

const figureGridPos = (row: number, col: number) => {
  const side: "left" | "right" = col < GRID_LEFT_COLS ? "left" : "right";
  const x =
    GRID_CENTER_X + (col - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING + (side === "left" ? -GROUP_SPLIT_OFFSET_X : GROUP_SPLIT_OFFSET_X);
  const y = GRID_CENTER_Y + (row - (GRID_ROWS - 1) / 2) * FIGURE_V_SPACING;
  return { x, y, side };
};

const FigureField: React.FC = () => {
  const frame = useCurrentFrame();
  const splitT = settle(frame, 66, SCENES.s1[1] - 66);

  // Scene 3: scan-line wireframe sweep.
  const scanActive = frame >= SCENES.s3[0] && frame < SCENES.s3[1];
  const scanT = clamp01(frame, SCENES.s3[0] + 10, SCENES.s3[1] - 10);
  const scanY = interpolate(scanT, [0, 1], [GRID_CENTER_Y - 260, GRID_CENTER_Y + 260]);

  // Scene 4a: figures lean toward incoming food (left group only).
  const leanT = clamp01(frame, SCENES.s4[0], SCENES.s4[0] + 70);
  const leanFadeOut = 1 - clamp01(frame, SCENES.s4[0] + 60, SCENES.s4[0] + 90);

  return (
    <>
      {SLOTS.map(({ row, col, scatterX, scatterY }, i) => {
        const { x: gridX, y: gridY, side } = figureGridPos(row, col);

        const popIn = interpolate(frame, [0, 20], [0, 1], {
          easing: Easing.out(Easing.cubic),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const clickHighlight = pulseWave(frame, 66, 2);

        const cascade = clamp01(splitT, 0, 1);
        const perFigureDelay = ((row + col) / (GRID_ROWS + GRID_COLS)) * 0.35;
        const localT = interpolate(cascade, [perFigureDelay, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const x = interpolate(localT, [0, 1], [scatterX, gridX]);
        const y = interpolate(localT, [0, 1], [scatterY, gridY]);

        const wireframe = scanActive && Math.abs(gridY - scanY) < 46;
        const lean = side === "left" ? leanT * leanFadeOut * 10 : 0;

        return (
          <div
            key={`${row}-${col}`}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `translate(-50%, -50%) scale(${popIn})`,
              opacity: popIn,
              filter: clickHighlight > 0 ? `drop-shadow(0 0 ${10 * clickHighlight}px ${ACCENT_BLUE})` : undefined,
            }}
          >
            <Figure3D seed={`fig-${row}-${col}`} color={FIGURE_COLORS[i % FIGURE_COLORS.length]} wireframe={wireframe} lean={lean} />
          </div>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------------------
// Cursor — drives the whole video, including every transition.
// ---------------------------------------------------------------------------
type CursorKF = { frame: number; x: number; y: number; click?: boolean };

const CURSOR_KEYFRAMES: CursorKF[] = [
  { frame: 0, x: -60, y: -60 },
  { frame: 20, x: 150, y: 400 },
  { frame: 28, x: 180, y: 460 },
  { frame: 58, x: 900, y: 880 },
  { frame: 62, x: 900, y: 880, click: true },
  { frame: 95, x: 540, y: 640 },
  { frame: 124, x: 540, y: 90 }, // T1: grabs the top edge
  { frame: 138, x: 540, y: 340 }, // drags the calendar panel down
  { frame: 250, x: 540, y: 340 },
  { frame: 301, x: 900, y: 500 }, // T2: swipe left starts
  { frame: 315, x: 160, y: 500 },
  { frame: 340, x: 60, y: 700 }, // S3: cursor rests still at the edge
  { frame: 407, x: 60, y: 700 },
  { frame: 415, x: LEFT_X, y: GRID_CENTER_Y }, // T3: click to expand
  { frame: 421, x: LEFT_X, y: GRID_CENTER_Y, click: true },
  { frame: 470, x: LEFT_X, y: GRID_CENTER_Y - 120 },
  { frame: 560, x: LEFT_X, y: METERS_BASELINE_Y - 120 },
  { frame: 636, x: RIGHT_X, y: METERS_BASELINE_Y - 120 }, // 4c: drag hard right
  { frame: 658, x: RIGHT_X, y: METERS_BASELINE_Y - 120 },
  { frame: 665, x: RIGHT_X, y: METERS_BASELINE_Y - 120, click: true }, // T4: collapse
  { frame: 700, x: GRID_CENTER_X, y: SCALE_Y },
  { frame: 731, x: GRID_CENTER_X, y: SCALE_Y },
  { frame: 719, x: 540, y: 1600 },
  { frame: 733, x: 540, y: 200 }, // T5: swipe up
  { frame: 760, x: GRID_CENTER_X - 60, y: 900 },
  { frame: 768, x: GRID_CENTER_X + 60, y: 900 }, // strikes through the word
  { frame: 796, x: GRID_CENTER_X + 60, y: 900 },
  { frame: 810, x: 1160, y: 900 }, // T6: drags the word offscreen right
  { frame: 860, x: LEFT_X, y: METERS_BASELINE_Y - 100 },
  { frame: 920, x: GRID_CENTER_X, y: SCALE_Y },
  { frame: 960, x: GRID_CENTER_X, y: (METERS_BASELINE_Y + SCALE_Y) / 2 },
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
  for (const f of CLICK_FRAMES) {
    const local = frame - f;
    if (local >= 0 && local < 16) {
      const s = spring({ frame: local, fps: FPS, config: { damping: 9, stiffness: 260, mass: 0.6 } });
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
  holdAfter?: boolean;
}> = ({ x, y, width, height, color, startFrame, drawDuration = 18, pulseCount = 2, holdAfter = false }) => {
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
  const fadeOut = holdAfter
    ? 1
    : interpolate(frame, [fadeOutStart, fadeOutStart + 20], [1, 0.35], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const opacity = drawT * fadeOut;
  const strokeWidth = 3 + pulse * 2;

  return (
    <svg style={{ position: "absolute", left: x, top: y, overflow: "visible" }} width={width} height={height}>
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
// Scene 1: marquee selection + corner counter
// ---------------------------------------------------------------------------
const MarqueeSelection: React.FC = () => {
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
  const y0 = 460;
  const x1 = interpolate(t, [0, 1], [x0, 900]);
  const y1 = interpolate(t, [0, 1], [y0, 880]);
  const flash = pulseWave(frame, 58, 1.4);
  const count = Math.round(interpolate(t, [0, 1], [0, 49]));

  return (
    <>
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
      <div
        style={{
          position: "absolute",
          left: 900,
          top: 70,
          transform: "translate(-50%, -50%)",
          fontFamily: FONT_STACK,
          fontSize: 30,
          fontWeight: 800,
          color: ACCENT_BLUE,
          opacity,
        }}
      >
        {count}
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 2: bowls + calendar time-lapse strip
// ---------------------------------------------------------------------------
const Bowl: React.FC<{ side: "left" | "right"; startFrame: number; color: string }> = ({ side, startFrame, color }) => {
  const frame = useCurrentFrame();
  if (frame < startFrame) return null;
  const x = side === "left" ? LEFT_X : RIGHT_X;
  const drop = spring({ frame: frame - startFrame, fps: FPS, config: { damping: 10, stiffness: 220, mass: 0.7 } });
  const y = interpolate(drop, [0, 1], [BOWL_Y - 160, BOWL_Y]);
  const scale = interpolate(drop, [0, 0.7, 1], [0.6, 1.08, 1]);

  return (
    <>
      <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div
          style={{
            width: 140,
            height: 72,
            background: "#ffffff",
            border: `3px solid ${color}`,
            borderTop: "none",
            borderRadius: "0 0 70px 70px",
            boxShadow: "0 10px 18px rgba(0,0,0,0.1)",
          }}
        />
        <div
          style={{
            width: 156,
            height: 13,
            marginTop: -8,
            marginLeft: -8,
            background: "#ffffff",
            border: `3px solid ${color}`,
            borderRadius: 7,
          }}
        />
      </div>
      <HighlightBox x={x - 90} y={BOWL_Y - 50} width={180} height={100} color={color} startFrame={startFrame + 14} pulseCount={2} />
    </>
  );
};

const SNACK_COLORS = [ACCENT_MAGENTA, "#ff9a3d"];

const CalendarStrip: React.FC = () => {
  const frame = useCurrentFrame();
  const start = 156;
  const slamFrame = 296;
  if (frame < start) return null;
  const local = frame - start;

  // Days scroll past, accelerating, then the whole track compresses shut.
  const scrollT = interpolate(local, [0, slamFrame - start - 14], [0, 1], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const day = Math.max(1, Math.round(interpolate(scrollT, [0, 1], [1, STUDY_TOTAL_DAYS])));
  const blur = interpolate(scrollT, [0, 0.15, 0.85, 1], [0, 4, 4, 0]);

  const slamT = interpolate(frame, [slamFrame - 8, slamFrame + 4], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const trackScaleX = interpolate(slamT, [0, 1], [1, 0.18]);

  const opacity = interpolate(frame, [start, start + 10, 313 - 6, 313], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (opacity <= 0) return null;

  // A couple of snack dots popping onto each track — twice on the left, once on the right.
  const snackPop = (seed: number) => {
    const p = (local * 2.3 + seed * 37) % 40;
    return p < 6 ? interpolate(p, [0, 3, 6], [0, 1, 0]) : 0;
  };

  return (
    <div style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: GRID_CENTER_X,
          top: CALENDAR_Y,
          transform: `translate(-50%, -50%) scaleX(${trackScaleX})`,
          width: 720,
          height: 46,
          borderRadius: 23,
          background: "#ffffff",
          boxShadow: "0 8px 16px rgba(0,0,0,0.08)",
          filter: `blur(${blur}px)`,
        }}
      />
      {[LEFT_X, RIGHT_X].map((x, side) => (
        <React.Fragment key={x}>
          {(side === 0 ? [0, 1] : [0]).map((k) => (
            <div
              key={k}
              style={{
                position: "absolute",
                left: x + k * 14 - 7,
                top: CALENDAR_Y,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: SNACK_COLORS[k],
                transform: "translate(-50%, -50%)",
                opacity: snackPop(side * 5 + k),
              }}
            />
          ))}
        </React.Fragment>
      ))}
      <div
        style={{
          position: "absolute",
          left: GRID_CENTER_X,
          top: CALENDAR_Y,
          transform: "translate(-50%, -50%)",
          fontFamily: FONT_STACK,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 1,
          color: "#5a5a5e",
          opacity: 1 - slamT,
        }}
      >
        DAY {day}
      </div>
      <div
        style={{
          position: "absolute",
          left: GRID_CENTER_X,
          top: CALENDAR_Y,
          transform: "translate(-50%, -50%)",
          fontFamily: FONT_STACK,
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: 2,
          color: "#3c3c40",
          opacity: slamT,
        }}
      >
        WEEK 8
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 4: food icons (magnetic pull on the left, indifferent fall on the right)
// ---------------------------------------------------------------------------
const FOOD_COUNT = 6;
const FoodIcons: React.FC = () => {
  const frame = useCurrentFrame();
  const magnetActive = frame >= SCENES.s4[0] && frame < 636;
  const fallActive = frame >= 636 && frame < SCENES.s4[1];
  if (!magnetActive && !fallActive) return null;

  const targetX = magnetActive ? LEFT_X : RIGHT_X;

  return (
    <>
      {Array.from({ length: FOOD_COUNT }, (_, i) => {
        const seed = `food-${i}`;
        const startX = targetX + (random(`${seed}-sx`) - 0.5) * 900;
        const startY = 200 + random(`${seed}-sy`) * 200;
        const localStart = (magnetActive ? SCENES.s4[0] : 636) + i * 8;
        const local = frame - localStart;
        if (local < 0) return null;

        if (magnetActive) {
          const t = spring({ frame: local, fps: FPS, config: { damping: 9, stiffness: 90, mass: 1 } });
          const wobble = Math.sin(local / 4 + i) * (1 - Math.min(1, local / 40)) * 14;
          const fx = GRID_CENTER_X + (i - FOOD_COUNT / 2) * 30 - GRID_CENTER_X + targetX;
          const fy = GRID_CENTER_Y + (random(`${seed}-fy`) - 0.5) * 260;
          const x = interpolate(t, [0, 1], [startX, fx]) + wobble;
          const y = interpolate(t, [0, 1], [startY, fy]);
          const opacity = interpolate(local, [0, 10, 55, 70], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return <FoodDot key={i} x={x} y={y} opacity={opacity} color={SNACK_COLORS[i % 2]} />;
        }

        // Indifferent side: icons just fall straight down and past.
        const y = interpolate(local, [0, 60], [180, 1400], { extrapolateRight: "clamp" });
        const opacity = interpolate(local, [0, 8, 50, 60], [0, 0.9, 0.9, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const x = targetX + (random(`${seed}-fx`) - 0.5) * 260;
        return <FoodDot key={i} x={x} y={y} opacity={opacity} color={SNACK_COLORS[i % 2]} />;
      })}
    </>
  );
};

const FoodDot: React.FC<{ x: number; y: number; opacity: number; color: string }> = ({ x, y, opacity, color }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: 20,
      height: 20,
      borderRadius: "50%",
      background: color,
      boxShadow: `0 3px 6px rgba(0,0,0,0.2)`,
      transform: "translate(-50%, -50%)",
      opacity,
    }}
  />
);

// ---------------------------------------------------------------------------
// Meters (scene 4b) and Scales (scene 5) — shared shapes.
// ---------------------------------------------------------------------------
const Meter: React.FC<{ x: number; finalFraction: number; active: boolean; label: string; startFrame: number }> = ({
  x,
  finalFraction,
  active,
  label,
  startFrame,
}) => {
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
        holdAfter
      />
    </div>
  );
};

const MetersPanel: React.FC<{ side: "left" | "right"; startFrame: number }> = ({ side, startFrame }) => {
  const x = side === "left" ? LEFT_X : RIGHT_X;
  const active = side === "left";
  return (
    <>
      <Meter x={x - METER_GAP / 2} finalFraction={active ? 0.88 : 0.1} active={active} label="food reward response" startFrame={startFrame} />
      <Meter x={x + METER_GAP / 2} finalFraction={active ? 0.74 : 0.14} active={active} label="preference for these foods" startFrame={startFrame} />
    </>
  );
};

const Scale: React.FC<{ side: "left" | "right"; startFrame: number }> = ({ side, startFrame }) => {
  const frame = useCurrentFrame();
  if (frame < startFrame) return null;
  const x = side === "left" ? LEFT_X : RIGHT_X;
  const local = frame - startFrame;

  // Single decisive slam — no bounce-settle, a hard stop.
  const slam = interpolate(local, [0, 7], [0, 1], {
    easing: Easing.out(Easing.circle),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(slam, [0, 1], [SCALE_Y - 400, SCALE_Y]);
  const squash = interpolate(local, [7, 10, 14], [1.15, 0.94, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const cycling = local < 16;
  const display = cycling ? (130 + random(`cycle-${Math.floor(local)}`) * 30).toFixed(1) : SCALE_DISPLAY_VALUE;

  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${squash})` }}>
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
  const frame = useCurrentFrame();
  if (frame < startFrame) return null;
  // Snaps around both at once — instant, then pulses. No draw-on animation here.
  const pulse = pulseWave(frame, startFrame, 4);
  return (
    <div
      style={{
        position: "absolute",
        left,
        top: SCALE_Y - SCALE_DIAMETER / 2 - 24,
        width,
        height: SCALE_DIAMETER + 48,
        border: `${3 + pulse * 2}px solid ${ACCENT_LIME}`,
        borderRadius: 24,
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// Scene 6: typographic beat
// ---------------------------------------------------------------------------
// Scene 6 is "no figures, no UI" — but FigureField renders persistently for
// every other scene's continuity, so it has to be explicitly hidden here.
// Fades in sync with T5 (the swipe-up that reveals scene 6) and back out in
// sync with T6 (the drag-away that reveals scene 7's dashboard behind it).
const Scene6Cover: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = clamp01(frame, T5[0] - T5[1] / 2, T5[0] + T5[1] / 2);
  const fadeOut = clamp01(frame, T6[0] - T6[1] / 2, T6[0] + T6[1] / 2);
  const opacity = fadeIn * (1 - fadeOut);
  if (opacity <= 0) return null;
  return <AbsoluteFill style={{ background: STUDIO_BACKGROUND, opacity }} />;
};

const TypographicWord: React.FC = () => {
  const frame = useCurrentFrame();
  const start = SCENES.s6[0];
  const end = SCENES.s6[1];
  if (frame < start - 6 || frame > end + TRANSITION_DURATION) return null;

  const pop = spring({ frame: frame - start, fps: FPS, config: { damping: 11, stiffness: 220, mass: 0.7 } });
  const scale = interpolate(pop, [0, 1], [0.7, 1]);

  const strikeT = interpolate(frame, [760, 768], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const desaturate = interpolate(frame, [768, 790], [1, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Dragged away by the cursor during T6.
  const dragT = clamp01(frame, T6[0] - T6[1] / 2, T6[0] + T6[1] / 2);
  const dragX = interpolate(dragT, [0, 1], [0, 620]);

  return (
    <div
      style={{
        position: "absolute",
        left: GRID_CENTER_X + dragX,
        top: 900,
        transform: `translate(-50%, -50%) scale(${scale})`,
        filter: `saturate(${desaturate})`,
      }}
    >
      <div
        style={{
          position: "relative",
          fontFamily: FONT_STACK,
          fontSize: 108,
          fontWeight: 800,
          letterSpacing: -1,
          color: "#2c2c30",
        }}
      >
        LOWER
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            width: `${strikeT * 100}%`,
            height: 6,
            background: ACCENT_MAGENTA,
            transform: "translateY(-50%)",
          }}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 7: connecting line
// ---------------------------------------------------------------------------
const ConnectingLine: React.FC = () => {
  const frame = useCurrentFrame();
  const start = 858;
  if (frame < start) return null;
  const t = interpolate(frame, [start, start + 55], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x1 = LEFT_X;
  const y1 = METERS_BASELINE_Y - 110;
  const x2 = LEFT_X;
  const y2 = SCALE_Y;
  const cy = interpolate(t, [0, 1], [y1, y2]);
  const pulse = pulseWave(frame, start + 55, 3);

  return (
    <svg style={{ position: "absolute", inset: 0, overflow: "visible" }} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
      <line x1={x1} y1={y1} x2={x2} y2={cy} stroke={ACCENT_BLUE} strokeWidth={3 + pulse * 2} strokeDasharray="10 8" strokeLinecap="round" opacity={0.85} />
      <circle cx={x1} cy={y1} r={6} fill={ACCENT_BLUE} />
      {t >= 1 && <circle cx={x2} cy={y2} r={6} fill={ACCENT_BLUE} />}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Transitions — the cursor's physical actions between scenes.
// ---------------------------------------------------------------------------
const PanelDropTransition: React.FC = () => {
  const frame = useCurrentFrame();
  if (!transitionActive(frame, T1)) return null;
  const t = transitionT(frame, T1);
  const y = interpolate(t, [0, 1], [-CANVAS_HEIGHT, 0]);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: y,
        width: CANVAS_WIDTH,
        height: 700,
        background: "#ffffff",
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        boxShadow: "0 20px 40px rgba(0,0,0,0.12)",
      }}
    />
  );
};

const SwipeTransition: React.FC<{ centerDuration: readonly [number, number]; axis: "x" | "y"; sign: 1 | -1; children: React.ReactNode }> = ({
  centerDuration,
  axis,
  sign,
  children,
}) => {
  const frame = useCurrentFrame();
  if (!transitionActive(frame, centerDuration)) return null;
  const t = transitionT(frame, centerDuration);
  const dist = (axis === "x" ? CANVAS_WIDTH : CANVAS_HEIGHT) + 200;
  const offset = interpolate(t, [0, 1], [0, sign * dist]);
  const transform = axis === "x" ? `translateX(${offset}px)` : `translateY(${offset}px)`;
  return <div style={{ position: "absolute", inset: 0, transform }}>{children}</div>;
};

// The collapse half of this transition is applied directly to the real
// MetersPanel components (see meterCollapseScale) so what visibly shrinks is
// the actual meters — not a mismatched duplicate (wrong colors/heights)
// drawn on top of them. Only the "pull the scales out" half draws new
// content here, since nothing already on screen shows that yet.
const meterCollapseScale = (frame: number) => {
  if (!transitionActive(frame, T4)) return 1;
  const t = transitionT(frame, T4);
  return 1 - clamp01(t, 0, 0.5) * 2;
};

const CollapsePullTransition: React.FC = () => {
  const frame = useCurrentFrame();
  if (!transitionActive(frame, T4)) return null;
  const t = transitionT(frame, T4);
  const pullOut = clamp01(t, 0.5, 1) * 2;

  return (
    <>
      {pullOut > 0 &&
        [LEFT_X, RIGHT_X].map((x) => (
          <div
            key={x}
            style={{
              position: "absolute",
              left: x,
              top: METERS_BASELINE_Y,
              width: SCALE_DIAMETER * pullOut,
              height: SCALE_DIAMETER * pullOut,
              borderRadius: "50%",
              background: "#ffffff",
              boxShadow: "0 10px 20px rgba(0,0,0,0.14)",
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
    </>
  );
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
const Background: React.FC = () => <AbsoluteFill style={{ background: STUDIO_BACKGROUND }} />;

export const ScenesDemo: React.FC = () => {
  const frame = useCurrentFrame();

  const inS1 = frame < SCENES.s1[1];
  // Each of these stops rendering the instant its own swipe/collapse
  // transition takes over — otherwise an un-swiped duplicate sits underneath
  // the transition overlay and the "reveal" reads as nothing happening.
  const inS2 = frame >= SCENES.s2[0] && frame < T2[0] - T2[1] / 2;
  const inS4 = frame >= SCENES.s4[0] - 2 && frame < SCENES.s4[1];
  const inS5 = frame >= SCENES.s5[0] - 2 && frame < T5[0] - T5[1] / 2;
  const inS6 = frame >= SCENES.s6[0] - 8 && frame < SCENES.s6[1] + TRANSITION_DURATION;
  const inS7 = frame >= SCENES.s7[0] - 4;

  return (
    <AbsoluteFill style={{ backgroundColor: "#dcdcdd", overflow: "hidden" }}>
      <Background />
      <World>
        <FigureField />

        {inS1 && <MarqueeSelection />}

        {inS2 && (
          <>
            <Bowl side="left" startFrame={184} color={ACCENT_MAGENTA} />
            <Bowl side="right" startFrame={230} color={ACCENT_BLUE} />
            <CalendarStrip />
          </>
        )}

        {inS4 && (
          <>
            <FoodIcons />
            <div
              style={{
                transform: `scaleY(${meterCollapseScale(frame)})`,
                transformOrigin: `${GRID_CENTER_X}px ${METERS_BASELINE_Y}px`,
              }}
            >
              {frame >= 470 && <MetersPanel side="left" startFrame={470} />}
              {frame >= 636 && <MetersPanel side="right" startFrame={660} />}
            </div>
          </>
        )}
        {inS7 && (
          <>
            <MetersPanel side="left" startFrame={470} />
            <MetersPanel side="right" startFrame={660} />
          </>
        )}

        {(inS5 || inS7) && (
          <>
            <Scale side="left" startFrame={SCENES.s5[0] + 4} />
            <Scale side="right" startFrame={SCENES.s5[0] + 4} />
            <NoChangeOutline startFrame={SCENES.s5[0] + 20} />
          </>
        )}

        {inS7 && <ConnectingLine />}
      </World>

      <Scene6Cover />
      {inS6 && <TypographicWord />}

      <SwipeTransition centerDuration={T2} axis="x" sign={-1}>
        <Background />
        <World>
          <FigureField />
          <Bowl side="left" startFrame={184} color={ACCENT_MAGENTA} />
          <Bowl side="right" startFrame={230} color={ACCENT_BLUE} />
          <CalendarStrip />
        </World>
      </SwipeTransition>

      <SwipeTransition centerDuration={T5} axis="y" sign={-1}>
        <Background />
        <World>
          <FigureField />
          <Scale side="left" startFrame={SCENES.s5[0] + 4} />
          <Scale side="right" startFrame={SCENES.s5[0] + 4} />
          <NoChangeOutline startFrame={SCENES.s5[0] + 20} />
        </World>
      </SwipeTransition>

      <PanelDropTransition />
      <CollapsePullTransition />

      <Cursor />
    </AbsoluteFill>
  );
};

export const ScenesDemoComposition: React.FC = () => (
  <Composition
    id="ScenesDemo"
    component={ScenesDemo}
    durationInFrames={DURATION_IN_FRAMES}
    fps={FPS}
    width={CANVAS_WIDTH}
    height={CANVAS_HEIGHT}
  />
);
