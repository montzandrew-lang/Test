// Deterministic "random" glitch helpers. Frame-seeded so renders are
// reproducible (no Math.random / Date.now — Remotion frames must be pure).

export const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898) * 43758.5453123;
  return x - Math.floor(x);
};

// Builds the list of frame offsets (relative to the glitch phase's start)
// at which the digits "flip" to a new random value. Gaps shrink over time
// so the cycling accelerates.
export const buildFlipOffsets = (phaseLengthInFrames: number): number[] => {
  const offsets: number[] = [0];
  let cursor = 0;
  let gap = 7;
  while (cursor < phaseLengthInFrames) {
    gap = Math.max(1, Math.round(gap * 0.78));
    cursor += gap;
    if (cursor < phaseLengthInFrames) {
      offsets.push(cursor);
    }
  }
  return offsets;
};

// Random-looking weight near the real value, e.g. "83.1", "85.9".
export const glitchValueForSeed = (seed: number): string => {
  const value = 80 + seededRandom(seed) * 10;
  return value.toFixed(1);
};
