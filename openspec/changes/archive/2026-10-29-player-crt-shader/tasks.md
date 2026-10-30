# Tasks

## 1. Shader preset module

- [x] 1.1 Add `src/features/console/crt/preset.ts`: the tuned parameter table (vignette 0.35, ghosting 0.3, scanline strength 1.0, filmic toe 0.013 / shoulder 5.6, gamma 1.18, ghost blur 4), `buildShaderSource({ still })` emitting a GLSL ES 1.00 single pass with `#ifdef VERTEX` / `#ifdef FRAGMENT`, and `buildPreset()` with one pass and no `scale_type`; verify the dumped source compiles or renders in the emulator
- [x] 1.2 Add `installPreset(fs)` writing `<bundle>/shaders/shaders_glsl/newpixie-crt.glslp`, `.../shaders/newpixie-crt.glsl` and `<userdata>/config/global.glslp`; verify with `src/features/console/crt/preset.test.ts` (7 tests: pinned values, both stages, baked `#define`s, no feedback/previous-pass inputs, still variant, single-pass preset, install paths)
- [x] 1.3 Prove the shader in the emulator before wiring it: a standalone spike page (outside the repo) loaded the same source through `beforeLaunch` + `global.glslp`; it rendered with scanlines, chroma bleed and vignette, and `SHADER_TOGGLE` switched it at runtime

## 2. Service wiring

- [x] 2.1 `NostalgistEmulatorService` installs the preset in `beforeLaunch` (before video initialises), choosing the still variant when `prefers-reduced-motion: reduce` matches; verify the launch options carry `beforeLaunch` and that the hook test sees the three files written
- [x] 2.2 `setCrt` flips the setting and sends RetroArch's `SHADER_TOGGLE` (only on change, and only when a core exists), so the effect toggles without a relaunch; verify with the service test (one command per change, no extra launches) and confirm the game keeps running
- [x] 2.3 Pin the video pipeline so the effect fills the canvas: custom 3:2 aspect, integer scaling off, smooth source sampling; verify the launch-config test and the rendered picture (no letterbox bars inside the buffer)

## 3. Player sizing

- [x] 3.1 `usePlayerScale` takes the CRT setting: with CRT on it renders a fixed 1440x960 buffer as the canvas CSS box with a transform onto the 4:3 stage; with CRT off it keeps the whole-pixel multiple and the existing transform; verify the hook tests (CRT on requests 1440x960 and sets the transform, CRT off unchanged)
- [x] 3.2 Remove the now-unused scanline-pitch math (`scanlinePitch`, `DEFAULT_SCANLINE_PITCH`) and the `--crt-line-pitch` property; verify `npm run typecheck` and the scale tests

## 4. Remove the WebGL2 layer

- [x] 4.1 Delete `crt/crt-shader.ts`, `crt/gl.ts`, `crt/layer.ts` and their tests, plus `hooks/useCrtShader.ts` and its test; verify no imports remain and `npm run typecheck` passes
- [x] 4.2 Remove the second canvas, the CSS overlay and the `.crt-canvas` rules from `GameWindow` and `index.css`; verify the component test renders exactly one canvas in the stage and no overlay

## 5. Documentation

- [x] 5.1 Rewrite the CRT entry in `docs/controllers.md`: effect on by default, single-pass, fixed 1440x960, no phosphor trail, toggle shows the raw picture, no shader pipeline means the raw picture; verify every statement against the shipped player
- [x] 5.2 Update `ATTRIBUTION.md` for the single-pass GLSL port and state that no bezel artwork is bundled; verify `public/` has no shader or bezel assets

## 6. Verification

- [x] 6.1 Run `npm run typecheck && npm run lint && npm test && npm run build` locally and confirm all pass (238 tests, 5 skipped)
- [x] 6.2 Run `npm run test:e2e` on the verification box with `CHROME_SHELL_PATH`: playback renders the 1440x960 effect buffer, resizing keeps it, toggling off returns a whole-pixel canvas, toggling back restores the effect, and the runtime stays live — passes
- [x] 6.3 Capture the picture on the verification box with the effect on and off and confirm the look and orientation: scanlines, chroma fringing, vignette and soft glow, upright, no black frames, raw picture when off

## Workflow follow-up

- Archive `player-integer-scaling` first so its `player-video` delta merges before this change's CRT-mode exception to the whole-pixel render scale.
- Run `openspec validate player-crt-shader --strict` and archive the change after review.
