# Tasks

## 0. Prerequisite

- [x] 0.1 Confirm `stabilize-crt-effect-scale` is archived and `openspec/specs/player-crt/spec.md` contains the source-line and anisotropic-blur requirements (including `blurX`/`blurY`); if not, pause and archive or sync that change first

## 1. Prove live reload

- [x] 1.1 With the bundled demo running, rewrite the preset with changed parameters and send `SET_SHADER <presetPath>`; verify the picture changes, playback continues and the emulator does not relaunch. If `SET_SHADER` does not recompile, test `SHADER_TOGGLE` off/on; if neither works, pause and revise the live-apply spec before UI work

## 2. Parameter model and shader source

- [x] 2.1 Add `src/features/console/crt/params.ts` with the normalized `CrtOverrides` type, reference defaults, clamping, defensive parse/serialize and `resolveCrtParams` (softness to `blurX`/`blurY`, vertical never above horizontal), and verify unit tests cover defaults, bounds, malformed input and the ratio
- [x] 2.2 Extend `buildShaderSource` and `installPreset` to accept a resolved parameter set while keeping `CRT_PARAMS` as the default, and verify `preset.test.ts` still passes plus a test that overrides reach the generated source

## 3. Service, state and persistence

- [x] 3.1 Add `crtParams` to `EmulatorSettings` and `setCrtParams` to `EmulatorService`/`NostalgistEmulatorService`, load the stored overrides at startup, persist on change, and verify service tests cover before-launch storage, a running game with CRT on sending `SET_SHADER`, and CRT off writing without loading
- [x] 3.2 Pass the resolved params from `beforeLaunch` into `installPreset` and retain the Emscripten FS/preset path for later reloads, and verify the launch test asserts the preset source contains the current values

## 4. Player controls

- [x] 4.1 Add a "Tune CRT" popover to the player control bar with scanline strength, softness, vignette and ghosting range inputs, a live percentage label each, and a reset-to-reference action; verify a component test covers rendering, changing a value, reset and persistence callbacks
- [x] 4.2 Make the panel keyboard accessible with labels, visible focus and focus return to the trigger, and add or extend an accessibility check that opens the panel; verify the check passes
- [x] 4.3 Document the controls and their reference defaults in `docs/controllers.md` and verify the wording matches the labels and defaults

## 5. Integration verification

- [x] 5.1 Add an e2e test that opens the panel, adjusts a control while the demo is running, confirms playback continues, reloads and confirms the value persists, then resets and confirms the reference value
- [x] 5.2 Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and the e2e suite and confirm they pass
- [x] 5.3 Capture the player at default, minimum and maximum values on the verification box and confirm the picture changes without a reload, the blur stays horizontal-dominant, the panel fits a phone viewport and the console has no shader errors

## Workflow follow-up

- Archive `stabilize-crt-effect-scale` before archiving this change so the `player-crt` `Reference look` base matches the delta.
- Archive this change after review and verification.
- If the live-reload spike fails, update the proposal and spec to a next-launch behavior before implementing the panel.
