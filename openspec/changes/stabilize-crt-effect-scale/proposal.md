# Proposal

## Why

The CRT effect's scanline pitch is measured in output pixels
(`uv.y * OutputSize.y * 1.5`). `OutputSize` is the emulator's real,
device-pixel backbuffer, not the requested 1440x960 canvas box: the core's
Emscripten platform layer reports the canvas CSS size multiplied by
`devicePixelRatio`. The same frame therefore gets roughly 229 scanlines at
DPR 1, 458 at DPR 2 and 688 at DPR 3. On a phone that over-dense pattern is
minified below the display's Nyquist limit and aliases into coarse bands; on a
retina screen it reads as fine lines. This contradicts `player-crt`'s "Fixed
output frame" requirement and the player documentation's promise that display
density does not change the look. The same output-space basis also makes the
shadow mask, per-scanline jitter and ghost-blur radius change with the surface.

Separately, the effect has no base-image blur (only the ghost halo is blurred),
so the picture reads sharper and harsher than the reference and than the
requested softer, horizontally dominant beam.

## What Changes

- Anchor the scanline phase to the emulated frame's line count (`InputSize.y`:
  224 NTSC, 239 PAL, 448 hi-res) instead of `OutputSize.y`, so one scanline is
  drawn per source line on every display.
- Express the shadow mask, per-scanline horizontal jitter and blur radii in the
  fixed 1440x960 frame or source units instead of output pixels, so they no
  longer change with device pixel ratio or window size.
- Add an anisotropic beam blur to the sampled picture, stronger horizontally
  than vertically, applied to the base colour as well as the ghost halo and
  kept in frame units.
- Keep the emulator's backbuffer at device resolution; do not pin the canvas to
  1440x960 physical pixels. The effect's coordinate space stays fixed while the
  rendering resolution may follow the display, which keeps the picture sharp
  and does not rework the canvas sizing.
- Update the shader-source tests, the player documentation, and e2e coverage
  for a non-1 device pixel ratio.

Out of scope: pinning the drawing buffer to 1440x960 device pixels (the
alternative fix), grain/flicker/vignette/tonemap changes, chroma offsets, the
CRT toggle, and reduced-motion behaviour.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `player-crt`: the fixed-frame and reference-look requirements now define the
  scanline, mask, jitter and blur basis in frame or source units; new
  requirements cover the surface-independent pattern and the anisotropic beam
  blur.

## Impact

- `src/features/console/crt/preset.ts` — shader phases, mask, jitter, blur
  kernel and new `CRT_PARAMS` entries.
- `src/features/console/crt/preset.test.ts` — pin the source-line anchor, the
  frame-relative terms and the horizontal-greater-than-vertical blur.
- `e2e/` — add a DPR 2 / phone-sized CRT case in a new spec file; the DPR 1
  `player.spec.ts` assertion stays.
- `docs/controllers.md`, `README.md` and `AGENTS.md` — describe source-line
  scanlines, the stable pattern and the softer beam, and correct the stale
  "CSS overlay" wording.
- `openspec/specs/player-crt/spec.md` — updated requirements after the delta is
  applied.
- No dependency, schema, backend or deployment changes.
