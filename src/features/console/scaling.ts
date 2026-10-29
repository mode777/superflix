/**
 * Video scaling math for the console player.
 *
 * The emulator renders into a buffer that is a whole-number multiple of the
 * SNES native frame (256x224); CSS then fits that buffer to the 4:3 player
 * area with smooth interpolation. Keeping the first stage integral is what
 * makes pixel interiors hard; the fractional remainder is softened exactly
 * once by the browser.
 *
 * This module is framework-free so it can be unit tested in Node.
 */

/** SNES frame the scale is selected from. */
export const NATIVE_FRAME = { width: 256, height: 224 } as const;

/** CRT-correct display shape for the 256x224 frame (8:7 pixel aspect). */
export const DISPLAY_ASPECT = 4 / 3;

/** Upper bound on the integral stage: 8x is 2048x1792. */
export const MAX_RENDER_SCALE = 8;

export interface StageSize {
  width: number;
  height: number;
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Largest 4:3 stage that fits inside the surface's content box, centred by the
 * caller. Returns a zero size for an unmeasured or invalid surface.
 */
export function fitStage(surfaceWidth: number, surfaceHeight: number): StageSize {
  if (!isPositiveFinite(surfaceWidth) || !isPositiveFinite(surfaceHeight)) {
    return { width: 0, height: 0 };
  }
  const width = Math.min(surfaceWidth, surfaceHeight * DISPLAY_ASPECT);
  return { width, height: width / DISPLAY_ASPECT };
}

/**
 * Whole-number multiple of the native frame that fits the stage, measured in
 * device pixels so high-DPI displays get the extra density. Clamped to 1..8.
 */
export function selectRenderScale(
  stageWidth: number,
  stageHeight: number,
  devicePixelRatio = 1,
): number {
  if (!isPositiveFinite(stageWidth) || !isPositiveFinite(stageHeight)) return 1;
  const dpr = isPositiveFinite(devicePixelRatio) ? devicePixelRatio : 1;
  const fit = Math.min(
    (stageWidth * dpr) / NATIVE_FRAME.width,
    (stageHeight * dpr) / NATIVE_FRAME.height,
  );
  const scale = Math.floor(fit);
  return Math.min(MAX_RENDER_SCALE, Math.max(1, scale));
}
