# Tasks

## 1. Scale math

- [x] 1.1 Add `src/features/console/scaling.ts`: native frame constants (256×224), an 8× cap, `fitStage(surfaceWidth, surfaceHeight)` returning the largest 4:3 stage that fits, `selectRenderScale(stageWidth, stageHeight, dpr)` returning `clamp(floor(min(w * dpr / 256, h * dpr / 224)), 1, 8)`, and `scanlinePitch(stageHeight, lines = 224)`; guard zero, negative and non-finite input; verify `npm run typecheck` passes
- [x] 1.2 Add `src/features/console/scaling.test.ts` covering 984×738 at DPR 1 → 3, the same CSS size at DPR 2 → 6, the 8× cap, the 1× floor for tiny or invalid areas, `fitStage` for a 1312×738 surface → 984×738 and a 1920×1080 fullscreen surface → 1440×1080, and a 738 px stage → 3.29 px scanline pitch; verify `npm test` passes

## 2. Emulator service

- [x] 2.1 Add `resizeVideo(width, height): void` to `EmulatorService` and implement it in `NostalgistEmulatorService`: remember the requested size, apply it immediately through `emulator.resize(...)` when a core is running, re-apply it after `loadRom()` finishes, pass the remembered size as the Nostalgist `size` launch option, and skip identical sizes; verify `npm run typecheck` passes
- [x] 2.2 Add `nostalgistEmulatorService.video.test.ts` using the same `vi.mock('nostalgist')` pattern as the volume test: a size requested before load appears in the launch options and is applied after load, a repeated identical resize does not call `resize`, and resizing during playback neither relaunches nor changes the runtime status; verify `npm test` passes
- [x] 2.3 Pin the video options in the launch config — `aspect_ratio_index: 21`, `video_scale_integer: true`, `video_force_aspect: true`, `video_smooth: false` — and extend the video test to assert them; confirm the existing volume tests still pass so the launch config changes do not regress audio; verify `npm test` passes

## 3. Player layout and wiring

- [x] 3.1 Restructure `GameWindow` into a fullscreen surface plus a 4:3 stage: the surface is `relative` with a 4:3 ratio and a viewport-relative max height outside fullscreen, and `:fullscreen` makes it `100vw × 100vh`; the stage holds the canvas and CRT overlay; move status chips, overlays and the fullscreen button to the surface corners; remove `aspect-video` and the `pixelated` filter; keep the canvas element stable across renders (no key, no conditional mount) so `attachCanvas` is not forced to destroy the emulator; verify `GameWindow.test.tsx` renders and the canvas does not compute to `image-rendering: pixelated`
- [x] 3.2 Add `usePlayerScale(surfaceRef, stageRef)` in `src/features/console/hooks/`: measure the surface, size the stage to the 4:3 fit, select the render scale, set `--crt-line-pitch` on the stage, and call `emulatorService.resizeVideo(256 * scale, 224 * scale)` only when that pixel size changes; observe with `ResizeObserver` plus `resize`, `fullscreenchange` and a re-registered `matchMedia('(resolution: Xdppx)')` listener; feature-detect `ResizeObserver` and `matchMedia` and do nothing when absent; verify a hook test with a stubbed observer and a mocked 1312×738 rect asserts one `resizeVideo(768, 672)` call and no second call for an unchanged size
- [x] 3.3 Update `.crt-overlay` in `src/styles/index.css` to use `var(--crt-line-pitch, 3px)` as the scanline period and pass the hook's pitch into the stage style; verify the hook test asserts the stage's `--crt-line-pitch` value and a manual check at 3× shows one scanline per source line
- [x] 3.4 Update `docs/controllers.md` to describe the display behaviour: whole-pixel render scale, smooth fractional fit, 4:3 geometry, re-scaling in fullscreen, and the smaller letterboxed result for hi-res/PAL screens; verify every statement matches the shipped player

## 4. Integration verification

- [x] 4.1 Extend `e2e/player.spec.ts` to assert, after playback starts at 1280×800 and again at 900×700, that `canvas.width`/`height` are `n × 256`/`n × 224` with `1 <= n <= 8`, that computed `image-rendering` is not `pixelated`, and that the runtime stays live; verify with `npm run test:e2e` (uses `CHROME_SHELL_PATH` on the verification box)
- [x] 4.2 Manually verify with the bundled demo in a real browser: a 1080p fullscreen toggle keeps playback running and re-scales, DPR 2 stays crisp, CRT scanlines align, a 512×448 or PAL screen letterboxes instead of stretching, and the controls stay visible at 1280×720 and at a phone-width viewport
- [x] 4.3 Run `npm run typecheck && npm run lint && npm test && npm run build` and confirm all pass

## Workflow follow-up

- Run `openspec validate player-integer-scaling --strict` before archiving.
- Archive the change after review and a green gate.
