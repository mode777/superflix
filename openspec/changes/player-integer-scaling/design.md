# Design

## Context

See `proposal.md` for the motivation and `specs/player-video/spec.md` for the behavioural contract.

Current state that shapes the approach:

- `GameWindow.tsx` gives the canvas `h-full w-full` inside an `aspect-video` box and sets `imageRendering: 'pixelated'`. The canvas element is created once by React and passed to the service through `useEmulator`; `attachCanvas()` destroys the emulator if the element changes, so the same element must be resized in place, never replaced.
- Nostalgist 0.23 sizes the canvas once: `launch()` records `element.offsetWidth/offsetHeight` (or the `size` launch option) and `postRun()` calls `Module.setCanvasSize(...)`. It installs no resize listener; `emulator.resize({ width, height })` is public and calls the same hook. The Emscripten glue sets the drawing buffer and leaves CSS sizing to the page when no forced aspect ratio is set.
- The bundled Snes9x/RetroArch build understands `video_smooth`, `video_scale_integer`, `video_force_aspect`, `video_aspect_ratio_auto` and `aspect_ratio_index` (21 = 1:1 PAR). The app currently pins none of them, so the first-stage scaling is whatever the build defaults are.
- Fullscreen is requested on the video container, not the canvas, and the container is `aspect-video`, so the browser forces it to the screen's shape.

Pipeline today:

```
core 256x224 --> canvas = launch element size (e.g. 1312x738) --> CSS fill
                 frozen; RA's own filter applies                 pixelated
```

After this change:

```
core 256x224 --> canvas = n x 256x224 (nearest) --> CSS fill 4:3 area (bilinear)
                 n = clamp(floor(area_h_device / 224), 1, 8)
```

## Goals / Non-Goals

**Goals:**

- Deterministic two-stage resampling: whole-pixel first stage, one smooth fractional fit.
- Correct 4:3 geometry with the game image filling the area at normal sizes.
- Resize and fullscreen re-scale without touching the emulator instance.
- A pure, unit-testable scale-selection function; the React layer only wires it to layout and the service.

**Non-Goals:**

- Detecting the core's current geometry, or per-resolution buffers. Hi-res/PAL output reuses the same buffer via RetroArch's integer scaling.
- A user-facing "crisp vs smooth" or aspect-ratio setting. One fixed behaviour.
- Changing audio, save states, SRAM, catalog, or admin code. Settings persistence stays out of scope.
- A shader-based scaler or a second canvas/WebGL display pass.

## Decisions

### 1. Measure the 4:3 stage, not the card, and size it in JS

The video surface (fullscreen target) is black and relative; inside it a stage element holds the canvas and CRT overlay. The stage's CSS width/height are computed from the surface's content box so it is always exactly 4:3 and centred:

```
surface (fullscreen target, black)
+------------------------------------------------+
|                 stage (4:3)                    |
| +--------------------------------------------+ |
| | canvas: layout n*256 x n*224,              | |
| |         transform scale(stage / buffer)    | |
| +--------------------------------------------+ |
|  overlays / status / fullscreen button         |
+------------------------------------------------+
```

The canvas's **layout box** stays at the whole-pixel buffer size (`n*256 x n*224`) and a CSS `transform: scale(...)` stretches it to the stage. This is not cosmetic: Nostalgist and RetroArch size the drawing buffer from the canvas element's layout box at start-up, so an explicit `resize()` to anything else is overridden. Keeping the layout box integral makes the emulator's own behaviour and the intended buffer agree, and the transform is what applies the smooth fractional remainder.

Non-fullscreen the surface itself is `aspect-ratio: 4/3`, so stage == surface (no bars). In fullscreen the surface becomes the screen (`width:100vw; height:100vh; aspect-ratio:auto`) and the stage shrinks to `min(100%, 100vh * 4/3)` wide, leaving bars only where the monitor is wider than 4:3 — unavoidable and correct.

Alternatives considered:

- **Keep the 16:9 card and letterbox the canvas inside it.** Rejected: the game area would be a sub-rectangle of the card, violating the fill requirement and leaving permanent side bars.
- **CSS-only aspect (nested `aspect-ratio` + `max-height`).** Rejected: combining `aspect-ratio`, `max-height` and `width:100%` either breaks the ratio or needs `object-fit`, which divs do not have. Explicit px sizing is simpler and gives the exact displayed height needed for the scanline pitch.
- **Make the stage itself the fullscreen element.** Rejected: fullscreen forces the element to the screen shape, destroying 4:3.

The surface is observed with a `ResizeObserver`; a `window` `resize` listener and `fullscreenchange` re-run the same measurement as a fallback (and to catch DPR changes via `matchMedia('(resolution: Xdppx)')` re-registration).

### 2. Pure `selectRenderScale` function

New framework-free module `src/features/console/scaling.ts`:

- `NATIVE = { width: 256, height: 224 }`, `MAX_SCALE = 8`.
- Input: stage width/height in CSS px, `devicePixelRatio`.
- `scale = clamp(floor(min(w * dpr / 256, h * dpr / 224)), 1, 8)`.
- Zero/negative/non-finite input returns 1; `dpr` is floored at 1.

Because the stage is 4:3 and 256/224 = 8/7 < 4/3, height always binds in practice; the `min` keeps it honest during mid-layout measurements.

Alternatives considered:

- **Fixed 3×.** Rejected: at 1080p fullscreen it needs ~1.9× smoothing, and at 4K ~3.8×; the accepted "slight smoothing" budget stops around 1.5×.
- **Largest integer that fits, with letterboxing (no smoothing).** Rejected: the agreed behaviour is fill-the-frame with slight smoothing.
- **Uncapped.** Rejected: the cap bounds the buffer (8× = 2048×1792) while still leaving ≤1.4× residual at 4K.

The selected `scale` feeds three outputs: canvas backing size `{256 * scale, 224 * scale}`, the stage style, and the scanline pitch `stageHeight / 224`.

### 3. Canvas resizing through the service boundary

`EmulatorService` gains `resizeVideo(width: number, height: number): void`. `NostalgistEmulatorService`:

- Stores the requested size (`null` until the first layout).
- Applies it immediately when an emulator exists (`this.emulator.resize(...)`), skipping no-op sizes.
- Re-applies it after a successful `loadRom()` because Nostalgist's `postRun` resets the canvas to the element size.
- Passes the current requested size (when known) as the `size` launch option so the first frames are already at the right size.
- Never recreates the canvas or the `Nostalgist` instance; playback and save states are untouched.

Because RetroArch re-derives the buffer from the canvas layout box when the core starts, the durable guarantee is the layout-size strategy in decision 1; `resizeVideo` keeps the buffer aligned as the scale changes and as the canvas box is re-measured.

The React layer calls this only when the computed pixel size changes, guarded by `requestAnimationFrame` coalescing. `GameWindow` remains free of Nostalgist imports, preserving the boundary in the project rules.

Nostalgist also applies `image-rendering: pixelated` to the canvas by default; the launch passes `style: { imageRendering: 'auto' }` and the scale hook re-asserts it, so the transform stays smooth.

Alternatives considered:

- **Call `Nostalgist` directly from the component.** Rejected by the emulator-boundary rule.
- **Relaunch on resize.** Rejected: loses pause/save-state continuity and is far slower.
- **Let the canvas stay at element size and only change CSS.** That is the current bug.

### 4. Pin RetroArch's video options

Launch configuration additions:

- `aspect_ratio_index: 21` — 1:1 pixel aspect, so the core image fills our buffer without RetroArch letterboxing. CSS owns the 8:7 → 4:3 correction.
- `video_scale_integer: true` — with a buffer that is already an exact multiple for 256×224, this is a no-op; for 512×448 or non-224-line output it forces a whole multiple with bars instead of a fractional stretch.
- `video_force_aspect: true` — keep X and Y on the same integer step.
- `video_smooth: false` — the first stage must be nearest-neighbour.

`image-rendering` on the canvas becomes `auto` (smooth) for the second stage. The CRT overlay is not affected.

Alternatives considered:

- **Let RetroArch apply 4:3 (`aspect_ratio_index: 0` or core-provided).** Rejected: the vertical scale would no longer be an integer multiple of 224 lines, reintroducing uneven scanlines in the first stage.
- **`video_smooth: true` and rely on CSS.** Rejected: RA would blur the integer stage before the browser's fractional fit, doubling the softness.

Risk note: if the build ignores `aspect_ratio_index: 21`, fall back to `video_aspect_ratio: "256/224"` (or the equivalent ratio string) and re-verify that a 3× buffer fills exactly.

### 5. Hi-res and PAL reuse the same buffer

No geometry detection. The buffer is always built from 256×224; RetroArch's integer scaling fits 512×448 (usually at 1×) or 239-line output inside it with bars, and the CSS stage smooths the result. This satisfies "whole pixels, letterbox the remainder" without plumbing the core's AV info, which Nostalgist does not expose.

Consequence recorded as a known limitation: hi-res and PAL screens are smaller than the area and may show bars until the game returns to 256×224.

### 6. Scanline pitch from the stage

`GameWindow` sets `--crt-line-pitch` on the stage (`stageHeightCss / 224` px). `.crt-overlay` uses that variable in `repeating-linear-gradient` instead of the fixed `3px`, so one gradient period matches one source line at any scale. The overlay keeps its current colours, blend mode and vignette.

Alternative considered: leave the overlay fixed. Rejected: at 3.29 px per line a 3 px gradient produces a slow beat pattern, which is more distracting than the scaling it is meant to complement.

### 7. Layout sizing

The card keeps the page's width constraints, but the surface's width is capped at `72vh * 4/3`, so the 4:3 game area fits the viewport height on short screens and is centred rather than sitting inside a wider black box:

- `aspect-ratio: 4/3` with `width: 100%` and that max width; the game area equals the surface outside fullscreen.
- `:fullscreen` removes the cap and switches to `100vw × 100vh`, and the stage letterboxes inside the screen when the monitor is wider than 4:3.

The exact cap is visual tuning, not a behavioural decision.

## Risks / Trade-offs

- **RetroArch re-sizes the drawing buffer from the canvas layout box at start** → keep the canvas layout box at the whole-pixel buffer and let the CSS transform do the fractional fit; verified on the verification box at 1280×800 and 900×700.
- **RetroArch ignores one of the pinned options in this wasm build** → verify the demo at 1×, 2×, 3× and fullscreen; fall back to `video_aspect_ratio` and `video_smooth:false` only, and document the effective behaviour.
- **`emulator.resize()` reinitialises the GL surface and may blink** → resize only when `scale` changes, coalesce per frame, and verify fullscreen entering/exiting on the demo before calling the change done.
- **ResizeObserver feedback loop** → the observed surface is sized by layout, not by the canvas; the stage is sized from the surface, so setting the canvas backing store cannot re-trigger the observer.
- **jsdom has no ResizeObserver** → feature-detect; without it the component keeps the default scale and a no-op observer, so existing component tests still render.
- **DPR change without a resize event** (dragging between monitors) → re-register the `matchMedia` resolution listener on each measurement; otherwise the scale stays at the old density until the next resize.
- **4:3 is taller than 16:9** → the viewport-relative cap shrinks the card width on short screens; check the controls and metadata panel at 1280×720 and mobile.
- **Hi-res/PAL frames are letterboxed** → accepted trade-off; called out in the docs so it is not reported as a bug.

## Migration Plan

No data, schema or deployment changes. The change is a single frontend release; rollback is reverting the commit, which restores the previous canvas sizing with no persisted state involved.

## Open Questions

- Exact `max-height` cap and whether the card should centre in the page or align left — visual tuning during implementation.
- Whether hi-res/PAL output ever needs its own buffer/scale, if the letterboxed result proves noticeable in practice.
