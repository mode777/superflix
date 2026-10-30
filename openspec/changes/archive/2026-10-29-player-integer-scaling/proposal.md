# Proposal

## Why

The player's canvas is sized once, at launch, to the element's CSS dimensions and then stretched by CSS with nearest-neighbour filtering. Any later layout change (window resize, fullscreen, the control bar rewrapping) becomes a non-integer nearest-neighbour stretch of a bitmap that was never aligned to the SNES's 256×224 grid, producing uneven pixel columns/rows and shimmer. The backing store also bears no relation to the native frame, so RetroArch's own scaling adds blur that varies with the window size at launch, and the 16:9 frame does not match the console's 4:3 output. The result is inconsistent, "awkward" sizing exactly when users look at it: boot, resize and fullscreen.

The agreed direction: render at a whole-pixel multiple of the native frame, then let one interpolated CSS scale consume the remaining fraction (fill the frame, slight smoothing). This keeps pixel interiors hard and edges soft, with no letterboxing at normal sizes.

## What Changes

- Render the emulator into an integer multiple of the native frame: `n × 256 × 224`, where `n` is the largest integer that fits the player area (measured in device pixels), clamped to 1–8. `n` is recomputed on resize; the canvas is resized only when `n` changes.
- Present the canvas with bilinear scaling (`image-rendering: auto`) so the fractional remainder is interpolated. The final stage is never nearest-neighbour.
- Make the player frame 4:3 (CRT-correct 8:7 pixel aspect) and keep it within the viewport, instead of `aspect-video` with a fixed 16:9 box.
- Pin RetroArch's video behaviour instead of inheriting build defaults: 1:1 pixel aspect, integer scaling inside the canvas, smoothing off for the integer stage. The first stage is then deterministic.
- Degrade gracefully for non-224-line and 512×448 hi-res output: those frames integer-snap inside the same buffer (with bars) rather than being fractionally stretched.
- Tie the CRT scanline pitch to the rendered source-line height so the overlay no longer beats against the new scale.
- Not changed: no new player controls or settings; one fixed display behaviour (no crisp-vs-smooth toggle); save states, SRAM, audio, catalog and admin flows are untouched; settings still reset on reload.

## Capabilities

### New Capabilities

- `player-video`: how the console player turns the emulator's native output into the on-screen frame — integer-scale selection, the interpolated remainder, 4:3 geometry, resize and fullscreen behaviour, hi-res/PAL fallback, and CRT scanline alignment.

### Modified Capabilities

(none — `metadata-enrichment` and `player-audio` are unrelated capabilities)

## Impact

- `src/features/console/services/emulator.ts` — the service contract gains viewport sizing/resize.
- `src/features/console/services/nostalgistEmulatorService.ts` — launch size, pinned RetroArch video options, runtime canvas resize.
- `src/features/console/components/GameWindow.tsx` — 4:3 player frame, ResizeObserver-driven scale selection, `image-rendering: auto`, scanline-pitch custom property.
- `src/styles/index.css` — CRT overlay consumes the scanline-pitch variable.
- `e2e/player.spec.ts` — assertions on canvas dimensions and the active filter after a resize.
- New unit test for the pure scale-selection math (device pixels, clamping, hi-res fallbacks).
- `docs/controllers.md` — describe the display behaviour (integer scale + smoothing, 4:3, fullscreen).
- No dependencies, schema, database, or asset changes.
