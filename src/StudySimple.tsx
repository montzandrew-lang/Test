import React from "react";
import {
  AbsoluteFill,
  Composition,
  interpolate,
  random,
  spring,
  useCurrentFrame,
} from "remotion";

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

export const CROSSFADE_DURATION = 10; // simple crossfade at every scene change

// --- accents: one color per group ---------------------------------------------
export const LEFT_ACCENT = "#e0299b"; // magenta — high-fat group
export const RIGHT_ACCENT = "#2f6bff"; // blue — low-fat group
export const NO_CHANGE_ACCENT = "#7ed321"; // lime
export const PULSE_COUNT = 2; // highlights pulse exactly twice

// --- camera: fixed pivot, scale changes only, spring with no overshoot --------
export const PUSH_IN_SCALE = 1.18; // scene 3's slow push-in
export const ZOOM_OUT_SCALE = 0.95; // scene 7's final wide reveal
const CAMERA_CONFIG = { damping: 20, stiffness: 100, mass: 1 }; // critically damped — no bounce
const CAMERA_PIVOT = { x: 540, y: 1000 };

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
const IDLE_BOB_AMPLITUDE = 3;
const IDLE_BOB_SPEED = 0.5;
const IDLE_BREATHE_AMPLITUDE = 0.03;
const IDLE_BREATHE_SPEED = 0.4;

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

const LEFT_X =
  GRID_CENTER_X + ((GRID_LEFT_COLS - 1) / 2 - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING - GROUP_SPLIT_OFFSET_X;
const RIGHT_X =
  GRID_CENTER_X +
  ((GRID_LEFT_COLS + (GRID_COLS - 1)) / 2 - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING +
  GROUP_SPLIT_OFFSET_X;

const BOWL_Y = 280;
const COUNTER_Y = 350;

export const METERS_BASELINE_Y = 1275;
export const METER_TRACK_HEIGHT = 230;
const METER_GAP = 190;
const METER_WIDTH = 24;
export const METER_LEFT_FRACTIONS: [number, number] = [0.86, 0.72];
export const METER_RIGHT_FRACTIONS: [number, number] = [0.12, 0.16];

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

const clamp01 = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const settle = (frame: number, start: number, duration: number) =>
  spring({
    frame: Math.max(0, frame - start),
    fps: FPS,
    config: CAMERA_CONFIG,
    durationInFrames: Math.max(1, duration),
  });

// A single flat pulse-twice envelope for highlight outlines: fade in, then
// two clean width pulses, then hold steady — no glow, no strobing.
const pulseTwice = (frame: number, start: number, periodFrames = 14) => {
  const local = frame - start;
  const total = PULSE_COUNT * periodFrames;
  if (local < 0 || local > total) return 0;
  return (Math.sin((local / periodFrames) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
};

// Fades a scene's own content in/out across the shared crossfade boundaries.
const sceneOpacity = (
  frame: number,
  [start, end]: readonly [number, number],
  isFirst = false,
  isLast = false,
) => {
  const fadeIn = isFirst ? 1 : clamp01(frame, start, start + CROSSFADE_DURATION);
  const fadeOut = isLast ? 1 : 1 - clamp01(frame, end, end + CROSSFADE_DURATION);
  return fadeIn * fadeOut;
};

// The groups/meters/scales are "everything" that scene 6 fades away and
// scene 7 brings back — one shared envelope instead of repeating it per part.
const persistentOpacity = (frame: number) => {
  const [, s5end] = SCENES.s5;
  const [, s6end] = SCENES.s6;
  if (frame < s5end) return 1;
  if (frame < s5end + CROSSFADE_DURATION) return interpolate(frame, [s5end, s5end + CROSSFADE_DURATION], [1, 0]);
  if (frame < s6end) return 0;
  if (frame < s6end + CROSSFADE_DURATION) return interpolate(frame, [s6end, s6end + CROSSFADE_DURATION], [0, 1]);
  return 1;
};

// ---------------------------------------------------------------------------
// Camera — fixed pivot, scale only, always a critically-damped spring.
// ---------------------------------------------------------------------------
const cameraScale = (frame: number) => {
  const [s3start, s3end] = SCENES.s3;
  const [s7start, s7end] = SCENES.s7;
  if (frame < s3start) return 1;
  if (frame < s3end) return interpolate(settle(frame, s3start, s3end - s3start), [0, 1], [1, PUSH_IN_SCALE]);
  if (frame < s7start) return PUSH_IN_SCALE;
  const t = settle(frame, s7start, s7end - s7start);
  return interpolate(t, [0, 1], [PUSH_IN_SCALE, ZOOM_OUT_SCALE]);
};

const World: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const scale = cameraScale(frame);
  const panX = CANVAS_WIDTH / 2 - CAMERA_PIVOT.x;
  const panY = CANVAS_HEIGHT / 2 - CAMERA_PIVOT.y;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transformOrigin: `${CAMERA_PIVOT.x}px ${CAMERA_PIVOT.y}px`,
        transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
      }}
    >
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------
const Figure3D: React.FC<{ seed: string; color: string }> = ({ seed, color }) => {
  const frame = useCurrentFrame();
  const heightVar = 0.9 + random(`h-${seed}`) * 0.22;
  const posture = (random(`r-${seed}`) - 0.5) * 8;
  const phase = random(`p-${seed}`) * Math.PI * 2;
  const t = frame / FPS;

  const bob = Math.sin(t * IDLE_BOB_SPEED * Math.PI * 2 + phase) * IDLE_BOB_AMPLITUDE;
  const breathe = 1 + Math.sin(t * IDLE_BREATHE_SPEED * Math.PI * 2 + phase * 1.3) * IDLE_BREATHE_AMPLITUDE;

  const light = shade(color, 55);
  const dark = shade(color, -35);

  return (
    <div style={{ transform: `translateY(${bob}px) rotate(${posture}deg) scale(${heightVar * breathe})` }}>
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

const SLOTS = Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => {
  const row = Math.floor(i / GRID_COLS);
  const col = i % GRID_COLS;
  const seed = `cluster-${row}-${col}`;
  return {
    row,
    col,
    clusterX: GRID_CENTER_X + (random(`${seed}-x`) - 0.5) * 560,
    clusterY: GRID_CENTER_Y + (random(`${seed}-y`) - 0.5) * 420,
  };
});

const FigureField: React.FC = () => {
  const frame = useCurrentFrame();
  const splitT = settle(frame, 20, SCENES.s1[1] - 20);
  const popIn = interpolate(settle(frame, 0, 18), [0, 1], [0, 1]);

  return (
    <>
      {SLOTS.map(({ row, col, clusterX, clusterY }, i) => {
        const side: "left" | "right" = col < GRID_LEFT_COLS ? "left" : "right";
        const gridX =
          GRID_CENTER_X + (col - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING + (side === "left" ? -GROUP_SPLIT_OFFSET_X : GROUP_SPLIT_OFFSET_X);
        const gridY = GRID_CENTER_Y + (row - (GRID_ROWS - 1) / 2) * FIGURE_V_SPACING;

        const cascade = clamp01(splitT, 0, 1);
        const perFigureDelay = ((row + col) / (GRID_ROWS + GRID_COLS)) * 0.3;
        const localT = interpolate(cascade, [perFigureDelay, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const x = interpolate(localT, [0, 1], [clusterX, gridX]);
        const y = interpolate(localT, [0, 1], [clusterY, gridY]);

        return (
          <div
            key={`${row}-${col}`}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `translate(-50%, -50%) scale(${popIn})`,
              opacity: popIn,
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
// Highlight outline — fades in, pulses twice, holds. No glow, no strobing.
// ---------------------------------------------------------------------------
const HighlightBox: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  startFrame: number;
}> = ({ x, y, width, height, color, startFrame }) => {
  const frame = useCurrentFrame();
  if (frame < startFrame) return null;
  const opacity = clamp01(frame, startFrame, startFrame + 12);
  const pulse = pulseTwice(frame, startFrame + 12);
  const borderWidth = 2.5 + pulse * 2;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        borderRadius: 14,
        border: `${borderWidth}px solid ${color}`,
        opacity,
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// Scene 2: bowl + week counter
// ---------------------------------------------------------------------------
const Bowl: React.FC<{ side: "left" | "right"; color: string }> = ({ side, color }) => {
  const frame = useCurrentFrame();
  const x = side === "left" ? LEFT_X : RIGHT_X;
  const opacity = clamp01(frame, SCENES.s2[0] + 6, SCENES.s2[0] + 26);

  return (
    <div style={{ position: "absolute", left: x, top: BOWL_Y, transform: "translate(-50%, -50%)", opacity }}>
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
  );
};

const WeekCounter: React.FC = () => {
  const frame = useCurrentFrame();
  const start = SCENES.s2[0] + 20;
  const end = start + 90;
  const opacity = clamp01(frame, start, start + 14);
  const t = settle(frame, start, end - start);
  const week = Math.max(1, Math.round(interpolate(t, [0, 1], [1, 8])));

  return (
    <div
      style={{
        position: "absolute",
        left: GRID_CENTER_X,
        top: COUNTER_Y,
        transform: "translate(-50%, -50%)",
        fontFamily: FONT_STACK,
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: 2,
        color: "#5a5a5e",
        opacity,
        whiteSpace: "nowrap",
      }}
    >
      WEEK {week}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 4: meters
// ---------------------------------------------------------------------------
const Meter: React.FC<{ x: number; finalFraction: number; color: string; startFrame: number }> = ({
  x,
  finalFraction,
  color,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  if (frame < startFrame) return null;
  const t = settle(frame, startFrame, 60);
  const height = t * finalFraction * METER_TRACK_HEIGHT;
  const value = Math.round(t * finalFraction * 100);

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
          background: `linear-gradient(180deg, ${shade(color, 30)} 0%, ${color} 100%)`,
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
          color,
          whiteSpace: "nowrap",
        }}
      >
        {value}%
      </div>
      <HighlightBox
        x={x - 40}
        y={METERS_BASELINE_Y - METER_TRACK_HEIGHT - 20}
        width={80}
        height={METER_TRACK_HEIGHT + 40}
        color={color}
        startFrame={startFrame + 62}
      />
    </div>
  );
};

const MetersPanel: React.FC<{ side: "left" | "right"; startFrame: number }> = ({ side, startFrame }) => {
  const x = side === "left" ? LEFT_X : RIGHT_X;
  const color = side === "left" ? LEFT_ACCENT : RIGHT_ACCENT;
  const [fA, fB] = side === "left" ? METER_LEFT_FRACTIONS : METER_RIGHT_FRACTIONS;
  return (
    <>
      <Meter x={x - METER_GAP / 2} finalFraction={fA} color={color} startFrame={startFrame} />
      <Meter x={x + METER_GAP / 2} finalFraction={fB} color={color} startFrame={startFrame} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 5: scales
// ---------------------------------------------------------------------------
const Scale: React.FC<{ side: "left" | "right" }> = ({ side }) => {
  const frame = useCurrentFrame();
  const startFrame = SCENES.s5[0] + 4;
  if (frame < startFrame) return null;
  const x = side === "left" ? LEFT_X : RIGHT_X;
  const t = settle(frame, startFrame, 26);
  const y = interpolate(t, [0, 1], [SCALE_Y + 220, SCALE_Y]);
  const opacity = clamp01(frame, startFrame, startFrame + 10);

  return (
    <div style={{ position: "absolute", left: x, top: y, opacity, transform: "translate(-50%, -50%)" }}>
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
          {SCALE_DISPLAY_VALUE}
        </div>
      </div>
    </div>
  );
};

const NoChangeOutline: React.FC = () => {
  const left = LEFT_X - SCALE_DIAMETER / 2 - 24;
  const width = RIGHT_X - LEFT_X + SCALE_DIAMETER + 48;
  const frame = useCurrentFrame();
  const startFrame = SCENES.s5[0] + 34;
  const opacity = clamp01(frame, startFrame, startFrame + 16);
  return (
    <div
      style={{
        position: "absolute",
        left,
        top: SCALE_Y - SCALE_DIAMETER / 2 - 24,
        width,
        height: SCALE_DIAMETER + 48,
        border: `3px solid ${NO_CHANGE_ACCENT}`,
        borderRadius: 24,
        opacity,
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// Scene 6: the word
// ---------------------------------------------------------------------------
const TypographicWord: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = sceneOpacity(frame, SCENES.s6);
  if (opacity <= 0) return null;

  const strikeStart = SCENES.s6[0] + 26;
  const strikeT = clamp01(frame, strikeStart, strikeStart + 14);
  const desaturate = interpolate(frame, [strikeStart + 14, strikeStart + 30], [1, 0.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: GRID_CENTER_X,
        top: 900,
        transform: "translate(-50%, -50%)",
        opacity,
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
            background: LEFT_ACCENT,
            transform: "translateY(-50%)",
          }}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
const Background: React.FC<{ desaturate?: number }> = ({ desaturate = 1 }) => (
  <AbsoluteFill
    style={{
      background: "radial-gradient(120% 90% at 50% 15%, #e9e9ea 0%, #dcdcdd 55%, #d2d2d3 100%)",
      filter: `saturate(${desaturate})`,
    }}
  />
);

export const StudySimple: React.FC = () => {
  const frame = useCurrentFrame();

  // Scene 3: everything except the two groups desaturates.
  const s3In = clamp01(frame, SCENES.s3[0], SCENES.s3[0] + CROSSFADE_DURATION);
  const s3Out = 1 - clamp01(frame, SCENES.s3[1], SCENES.s3[1] + CROSSFADE_DURATION);
  const chromeDesaturate = 1 - s3In * s3Out * 0.85;

  const contentOpacity = persistentOpacity(frame);
  const showBowls = frame < SCENES.s3[0] + CROSSFADE_DURATION;
  const showMeters = frame >= SCENES.s4[0];
  const showScales = frame >= SCENES.s5[0];

  return (
    <AbsoluteFill style={{ backgroundColor: "#dcdcdd", overflow: "hidden" }}>
      <Background />
      <World>
        <div style={{ opacity: contentOpacity }}>
          <FigureField />

          {showBowls && (
            <div style={{ opacity: sceneOpacity(frame, SCENES.s2) * chromeDesaturate, filter: `saturate(${chromeDesaturate})` }}>
              <Bowl side="left" color={LEFT_ACCENT} />
              <Bowl side="right" color={RIGHT_ACCENT} />
              <WeekCounter />
            </div>
          )}

          {showMeters && <MetersPanel side="left" startFrame={SCENES.s4[0] + 10} />}
          {showMeters && <MetersPanel side="right" startFrame={SCENES.s4[0] + 180} />}

          {showScales && (
            <>
              <Scale side="left" />
              <Scale side="right" />
              <NoChangeOutline />
            </>
          )}
        </div>
      </World>

      <TypographicWord />
    </AbsoluteFill>
  );
};

export const StudySimpleComposition: React.FC = () => (
  <Composition
    id="StudySimple"
    component={StudySimple}
    durationInFrames={DURATION_IN_FRAMES}
    fps={FPS}
    width={CANVAS_WIDTH}
    height={CANVAS_HEIGHT}
  />
);
