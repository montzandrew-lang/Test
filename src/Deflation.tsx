import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
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
export const DURATION_IN_FRAMES = 302; // exactly 10.08s
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

// --- phase boundaries (seconds -> frames) -----------------------------------
const F1_END = Math.round(1.2 * FPS); // 36 — cools to a lone figure
const F2_END = Math.round(3.2 * FPS); // 96 — deficit bar to -50%
const F3_END = Math.round(5.2 * FPS); // 156 — scale cutaway, weight countdown
const F4_END = Math.round(7.2 * FPS); // 216 — undercut, slump, negative muscle
const F5_END = Math.round(8.6 * FPS); // 258 — bottom bar fills then snaps

// --- grading -------------------------------------------------------------------
export const DARK_BACKGROUND =
  "radial-gradient(120% 90% at 50% 15%, #454b56 0%, #383d46 55%, #2c303a 100%)";
export const TEXT_COLOR = "#c7cdd8";
export const MUTED_TEXT_COLOR = "#8b93a3";
export const LONE_FIGURE_COLOR = "#7d859a";
export const DEFICIT_BAR_COLOR = "#6c7891";
export const GHOST_BAR_COLOR = "rgba(150,155,165,0.28)";
export const SCALE_DISC_TOP = "#565d6b";
export const SCALE_DISC_BOTTOM = "#383d46";
export const SCALE_DISPLAY_BG = "#2a2e37";
export const SCALE_GLOW_COLOR = "rgba(150,195,255,0.5)"; // brief phase-3 "win" glow only
export const MUSCLE_NEGATIVE_COLOR = "#5b6470";
export const PROGRESS_BAR_COLOR = "#565f70";
export const VIGNETTE_MAX_OPACITY = 0.45;

// --- values --------------------------------------------------------------------
export const DEFICIT_FINAL_VALUE = -50; // %
export const GHOST_BAR_DEPTH = 430; // px — callback to the calorie segment's deepest bar
export const DEFICIT_BAR_DEPTH = 520; // px — deliberately deeper than the ghost
export const START_WEIGHT = 185.0;
export const END_WEIGHT = 175.0; // exactly -10 lbs
export const WEEK_COUNT_MAX = 3;
export const MUSCLE_NEGATIVE_VALUE = -3; // %
export const MUSCLE_SCALE_MIN = -6; // the meter's track represents 0 .. this

// --- the persistent bottom progress bar -----------------------------------------
export const PROGRESS_BAR_FILL_RATE = 0.0038; // fraction of width filled per frame
export const PROGRESS_BAR_MAX_FILL = 0.97; // how full it gets before it snaps
export const PROGRESS_BAR_SNAP_FRAME = 250; // the exact frame it hard-resets to empty
const PROGRESS_BAR_HEIGHT = 6;

// --- geometry --------------------------------------------------------------------
const LONE_FIGURE_X = 420;
const LONE_FIGURE_Y = 700;
const LINE_Y = 620;
const LINE_MARGIN_X = 110;
const BAR_X = 660;
const BAR_WIDTH = 14;
const MUSCLE_X = 180;
const METER_VALUE_FONT_SIZE = 30;

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
// Same LED font used for the scale segment — loaded as a side effect of
// ScaleReveal.tsx, which Root.tsx always imports.
const LED_FONT = "Doto";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const rampValue = (frame: number, start: number, end: number, target: number) =>
  interpolate(frame, [start, end], [0, target], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

// ---------------------------------------------------------------------------
// Phase 1: the previous segment's groups, cooling and thinning to one figure
// ---------------------------------------------------------------------------
const loneFigureOrigin = () => {
  const row = 1;
  const col = 1;
  const x =
    GRID_CENTER_X + (col - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING - SPLIT_OFFSET_X;
  const y = GRID_CENTER_Y + (row - (GRID_ROWS - 1) / 2) * FIGURE_V_SPACING;
  return { row, col, x, y };
};

const LONE = loneFigureOrigin();

const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const brightOpacity = interpolate(frame, [0, F1_END], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: DARK_BACKGROUND }}>
      <AbsoluteFill style={{ background: STUDIO_BACKGROUND, opacity: brightOpacity }} />
    </AbsoluteFill>
  );
};

const GroupBFading: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 26], [1, 0], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (opacity <= 0) return null;
  const { left, top, width, height } = getGroupPanelRect("B");

  const figures = Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => ({
    row: Math.floor(i / GRID_COLS),
    col: i % GRID_COLS,
  })).filter(({ col }) => col >= GRID_COLS / 2);

  return (
    <div style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left,
          top,
          width,
          height,
          borderRadius: 32,
          background: GROUP_B_TINT,
        }}
      />
      {figures.map(({ row, col }) => {
        const x =
          GRID_CENTER_X + (col - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING + SPLIT_OFFSET_X;
        const y = GRID_CENTER_Y + (row - (GRID_ROWS - 1) / 2) * FIGURE_V_SPACING;
        return (
          <div
            key={`${row}-${col}`}
            style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)" }}
          >
            <FigureIcon size={FIGURE_SIZE} color={FIGURE_COLOR} />
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: groupPanelX("B"),
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
        {GROUP_B_LABEL}
      </div>
    </div>
  );
};

// Group A: panel + label dissolve, its 11 other figures fade out one by one
// (slow, staggered), the lone figure drifts to its resting place.
const GroupADissolving: React.FC = () => {
  const frame = useCurrentFrame();
  const chromeOpacity = interpolate(frame, [14, F1_END], [1, 0], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const others = Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => ({
    row: Math.floor(i / GRID_COLS),
    col: i % GRID_COLS,
  }))
    .filter(({ col }) => col < GRID_COLS / 2)
    .filter(({ row, col }) => !(row === LONE.row && col === LONE.col));

  const staggerCount = others.length; // 11
  const staggerEnd = F1_END - 8; // leave a little breathing room before phase 1 ends

  return (
    <>
      {chromeOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            ...(() => {
              const { left, top, width, height } = getGroupPanelRect("A");
              return { left, top, width, height };
            })(),
            borderRadius: 32,
            background: GROUP_A_TINT,
            opacity: chromeOpacity,
          }}
        />
      )}
      {others.map(({ row, col }, i) => {
        const x = GRID_CENTER_X + (col - (GRID_COLS - 1) / 2) * FIGURE_H_SPACING - SPLIT_OFFSET_X;
        const y = GRID_CENTER_Y + (row - (GRID_ROWS - 1) / 2) * FIGURE_V_SPACING;
        const delay = (i / staggerCount) * staggerEnd;
        const opacity = interpolate(frame, [delay, delay + 10], [1, 0], {
          easing: Easing.inOut(Easing.quad),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        if (opacity <= 0) return null;
        return (
          <div
            key={`${row}-${col}`}
            style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", opacity }}
          >
            <FigureIcon size={FIGURE_SIZE} color={FIGURE_COLOR} />
          </div>
        );
      })}
      {chromeOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: groupPanelX("A"),
            top: getGroupLabelY(),
            transform: "translate(-50%, 0)",
            fontFamily: FONT_STACK,
            fontSize: LABEL_FONT_SIZE,
            fontWeight: 600,
            letterSpacing: 2,
            color: LABEL_COLOR,
            whiteSpace: "nowrap",
            opacity: chromeOpacity,
          }}
        >
          {GROUP_A_LABEL}
        </div>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// The lone figure — present from phase 1 onward, reacting to phases 2 and 4.
// ---------------------------------------------------------------------------
const LoneFigure: React.FC = () => {
  const frame = useCurrentFrame();

  const moveT = interpolate(frame, [0, F1_END], [0, 1], {
    easing: Easing.inOut(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(moveT, [0, 1], [LONE.x, LONE_FIGURE_X]);
  const y = interpolate(moveT, [0, 1], [LONE.y, LONE_FIGURE_Y]);

  const deficit = rampValue(frame, F1_END, F2_END, DEFICIT_FINAL_VALUE);
  const slimScaleX = 1 + deficit * 0.003; // slims as the deficit deepens

  // Phase 4: posture slumps, tint desaturates further.
  const slumpT = interpolate(frame, [F3_END, F4_END], [0, 1], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const slumpRotate = interpolate(slumpT, [0, 1], [0, 5]);
  const slumpDrop = interpolate(slumpT, [0, 1], [0, 22]);
  const slumpSquash = interpolate(slumpT, [0, 1], [1, 0.93]);
  const desaturate = interpolate(slumpT, [0, 1], [1, 0.5]);

  // Crossfade from the original figure color to the drained tone across
  // phase 1, rather than snapping to it — it should look identical to its
  // siblings at frame 0.
  const coolT = interpolate(frame, [0, F1_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + slumpDrop,
        transform: `translate(-50%, -50%) rotate(${slumpRotate}deg) scale(${slimScaleX}, ${slumpSquash})`,
        filter: `saturate(${desaturate})`,
      }}
    >
      <div style={{ position: "relative" }}>
        <FigureIcon size={FIGURE_SIZE} color={FIGURE_COLOR} />
        <div style={{ position: "absolute", inset: 0, opacity: coolT }}>
          <FigureIcon size={FIGURE_SIZE} color={LONE_FIGURE_COLOR} />
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Phase 2: dashed line + deficit bar (with the previous segment's bar
// ghosted behind it), phases 2 onward keep it visible, settled.
// ---------------------------------------------------------------------------
const DashedLineAndBars: React.FC = () => {
  const frame = useCurrentFrame();
  const lineOpacity = interpolate(frame, [F1_END, F1_END + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (lineOpacity <= 0) return null;

  // Driven by the same eased time fraction so the two bars grow in lockstep
  // and both land cleanly on their stated depths.
  const progressT = interpolate(frame, [F1_END, F2_END], [0, 1], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const deficit = progressT * DEFICIT_FINAL_VALUE;
  const deficitHeight = progressT * DEFICIT_BAR_DEPTH;
  const ghostHeight = progressT * GHOST_BAR_DEPTH;

  return (
    <div style={{ opacity: lineOpacity }}>
      <div
        style={{
          position: "absolute",
          left: LINE_MARGIN_X,
          right: LINE_MARGIN_X,
          top: LINE_Y,
          borderTop: `2px dashed ${MUTED_TEXT_COLOR}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: GRID_CENTER_X,
          top: LINE_Y - 34,
          transform: "translateX(-50%)",
          fontFamily: FONT_STACK,
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: MUTED_TEXT_COLOR,
          whiteSpace: "nowrap",
        }}
      >
        maintenance calories
      </div>
      {/* Ghost of the previous segment's deepest bar, low opacity, offset
          beside the live bar so both stay visible at once — an opaque bar
          directly behind a shorter one would just hide it entirely. */}
      <div
        style={{
          position: "absolute",
          left: BAR_X - 26,
          top: LINE_Y,
          width: BAR_WIDTH,
          height: ghostHeight,
          transform: "translateX(-50%)",
          borderRadius: BAR_WIDTH / 2,
          background: GHOST_BAR_COLOR,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: BAR_X,
          top: LINE_Y,
          width: BAR_WIDTH,
          height: deficitHeight,
          transform: "translateX(-50%)",
          borderRadius: BAR_WIDTH / 2,
          background: DEFICIT_BAR_COLOR,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: BAR_X,
          top: LINE_Y + deficitHeight + 30,
          transform: "translate(-50%, -50%)",
          fontFamily: FONT_STACK,
          fontSize: METER_VALUE_FONT_SIZE,
          fontWeight: 700,
          color: TEXT_COLOR,
          whiteSpace: "nowrap",
        }}
      >
        {Math.round(deficit)}%
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Phase 4: a meter that only goes negative, appearing beside the figure.
// ---------------------------------------------------------------------------
const NegativeMuscleMeter: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [F3_END, F3_END + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (opacity <= 0) return null;

  const value = rampValue(frame, F3_END, F4_END, MUSCLE_NEGATIVE_VALUE);
  const height = (value / MUSCLE_SCALE_MIN) * 160;

  return (
    <div style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: MUSCLE_X,
          top: LINE_Y,
          width: BAR_WIDTH,
          height,
          transform: "translateX(-50%)",
          borderRadius: BAR_WIDTH / 2,
          background: MUSCLE_NEGATIVE_COLOR,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: MUSCLE_X,
          top: LINE_Y + height + 30,
          transform: "translate(-50%, -50%)",
          fontFamily: FONT_STACK,
          fontSize: METER_VALUE_FONT_SIZE,
          fontWeight: 700,
          color: TEXT_COLOR,
          whiteSpace: "nowrap",
        }}
      >
        {value.toFixed(1)}%
      </div>
    </div>
  );
};

// A brief warm-cool glow that drains away right as phase 4 begins — the
// residue of the scale beat's "win" glow, fading for good.
const DrainingGlow: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity =
    frame < F3_END
      ? 0
      : interpolate(frame, [F3_END, F3_END + 16], [0.5, 0], {
          extrapolateRight: "clamp",
        });
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: LONE_FIGURE_X,
        top: LONE_FIGURE_Y,
        width: 1,
        height: 1,
        borderRadius: "50%",
        boxShadow: `0 0 140px 90px ${SCALE_GLOW_COLOR}`,
        opacity,
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// Phase 3: hard cut to the scale, color-graded dark. Fast weight countdown,
// a small week counter, and a brief glow on the falling number.
// ---------------------------------------------------------------------------
const DISPLAY_X = 540;
const DISPLAY_Y = 750;
const DISPLAY_WIDTH = 260;
const DISPLAY_HEIGHT = 96;

const ScaleCutaway: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - F2_END;
  const duration = F3_END - F2_END;

  const t = interpolate(local, [0, duration * 0.55], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const weight = START_WEIGHT - t * (START_WEIGHT - END_WEIGHT);

  const week = Math.min(
    WEEK_COUNT_MAX,
    Math.floor(interpolate(local, [4, duration - 10], [0, WEEK_COUNT_MAX], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })) + 1,
  );

  const glow = interpolate(local, [0, 14, duration - 20, duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: DARK_BACKGROUND }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 700,
          width: 900,
          height: 900,
          borderRadius: "50%",
          transform: "translateX(-50%)",
          background: `radial-gradient(circle at 38% 32%, ${SCALE_DISC_TOP} 0%, ${SCALE_DISC_TOP} 45%, ${SCALE_DISC_BOTTOM} 100%)`,
          boxShadow: "28px 46px 70px rgba(0,0,0,0.35)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: DISPLAY_X - DISPLAY_WIDTH / 2,
          top: DISPLAY_Y - DISPLAY_HEIGHT / 2,
          width: DISPLAY_WIDTH,
          height: DISPLAY_HEIGHT,
          borderRadius: DISPLAY_HEIGHT / 2,
          background: SCALE_DISPLAY_BG,
          boxShadow: "inset 0 2px 6px rgba(0,0,0,0.5)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: DISPLAY_X,
          top: DISPLAY_Y,
          transform: "translate(-50%, -50%)",
          fontFamily: LED_FONT,
          fontVariationSettings: '"ROND" 100, "wght" 520',
          fontSize: 58,
          letterSpacing: 4,
          color: "#eef3fb",
          textShadow: `0 0 4px rgba(255,255,255,0.8), 0 0 ${18 * glow}px ${8 * glow}px ${SCALE_GLOW_COLOR}`,
          whiteSpace: "nowrap",
        }}
      >
        {weight.toFixed(1)}
      </div>
      <div
        style={{
          position: "absolute",
          left: DISPLAY_X + DISPLAY_WIDTH / 2 + 50,
          top: DISPLAY_Y,
          transform: "translate(-50%, -50%)",
          fontFamily: FONT_STACK,
          fontSize: 22,
          fontWeight: 600,
          color: MUTED_TEXT_COLOR,
          whiteSpace: "nowrap",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.8 }}>WEEK</div>
        <div>{week}</div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// A persistent thin progress bar along the bottom edge — fills continuously
// from frame 0, then snaps to empty in a single frame (no easing).
// ---------------------------------------------------------------------------
const BottomProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const fill =
    frame < PROGRESS_BAR_SNAP_FRAME
      ? Math.min(PROGRESS_BAR_MAX_FILL, frame * PROGRESS_BAR_FILL_RATE)
      : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        bottom: 0,
        width: CANVAS_WIDTH * fill,
        height: PROGRESS_BAR_HEIGHT,
        background: PROGRESS_BAR_COLOR,
      }}
    />
  );
};

const Vignette: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [F5_END, DURATION_IN_FRAMES], [0, VIGNETTE_MAX_OPACITY], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (opacity <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        opacity,
        background: "radial-gradient(120% 80% at 50% 42%, transparent 45%, #000 115%)",
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
const LoneFigureScene: React.FC = () => (
  <>
    <Backdrop />
    <GroupBFading />
    <GroupADissolving />
    <LoneFigure />
    <DashedLineAndBars />
    <NegativeMuscleMeter />
    <DrainingGlow />
  </>
);

export const Deflation: React.FC = () => {
  const frame = useCurrentFrame();
  const showScale = frame >= F2_END && frame < F3_END;

  return (
    <AbsoluteFill style={{ backgroundColor: "#2c303a", overflow: "hidden" }}>
      {showScale ? <ScaleCutaway /> : <LoneFigureScene />}
      <Vignette />
      <BottomProgressBar />
    </AbsoluteFill>
  );
};

export const DeflationComposition: React.FC = () => (
  <Composition
    id="Deflation"
    component={Deflation}
    durationInFrames={DURATION_IN_FRAMES}
    fps={FPS}
    width={CANVAS_WIDTH}
    height={CANVAS_HEIGHT}
  />
);
