// All display-overlay positioning/styling lives here so it can be tuned
// without touching animation logic.

export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const FPS = 30;
export const DURATION_IN_FRAMES = 69; // 2.3s @ 30fps

// --- Phase boundaries (in frames) ---
export const PHASE_STEADY_END = 12; // 0.0s - 0.4s: steady "84.6"
export const PHASE_GLITCH_END = 45; // 0.4s - 1.5s: glitching digits
export const PHASE_BLACK_END = 51; // 1.5s - 1.7s: cut to black
// 1.7s - 2.3s (PHASE_BLACK_END -> DURATION_IN_FRAMES): "LIAR" holds

// --- Display overlay position/size ---
// Tune these to line up with the scale's screen in scale.png.
export const DISPLAY_CENTER_X = 398;
export const DISPLAY_CENTER_Y = 500;

// --- Patch covering the original "84.6" baked into the photo ---
export const PATCH_WIDTH = 220;
export const PATCH_HEIGHT = 80;
export const PATCH_RADIUS = 34;
export const PATCH_COLOR = "#f4f2ec";

// --- Digit/text styling ---
export const REAL_VALUE = "84.6";
export const LIAR_TEXT = "LIAR";
export const FONT_SIZE = 46;
export const LIAR_FONT_SIZE = 40;
export const TEXT_COLOR = "#fdfbf4";
export const GLOW_COLOR = "rgba(255, 249, 235, 0.85)";
export const GLOW_COLOR_SOFT = "rgba(255, 249, 235, 0.45)";
