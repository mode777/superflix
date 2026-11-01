# Tasks

## 1. Shader and parameters

- [x] 1.1 Add `FRAME_WIDTH` / `FRAME_HEIGHT` defines interpolated from `CRT_OUTPUT`, replace `ghostBlur` with `blurX` and `blurY` in `CRT_PARAMS`, and verify `npm run typecheck` passes
- [x] 1.2 Anchor the scanline phase to `max(InputSize.y, 1.0)` and keep the roll term, then verify the generated source contains the source-line phase and no `uv.y * OutputSize.y`
- [x] 1.3 Express the shadow mask, scanline jitter and blur offsets in frame units (`uv.x * FRAME_WIDTH`, `uv.y * lines`, `BLUR_X / FRAME_WIDTH`, `BLUR_Y / FRAME_HEIGHT`), and verify no scanline, mask, jitter or blur term still reads `gl_FragCoord` or `OutputSize` (grain keeps `uv * OutputSize` by design)
- [x] 1.4 Add the 5-tap anisotropic kernel (centre 2, horizontal 1, vertical 0.5) and apply it to the base colour and the ghost halo, then verify the generated source uses `BLUR_X` / `BLUR_Y` and `CRT_PARAMS` satisfies `blurX > blurY`
- [x] 1.5 Extend `src/features/console/crt/preset.test.ts` to pin the source-line anchor, the frame constants, the mask/jitter basis and the anisotropy, and verify `npm test` passes

## 2. Documentation and e2e coverage

- [x] 2.1 Update `docs/controllers.md`, `README.md` and `AGENTS.md` so the CRT description says source-line scanlines (including the 239-line PAL and 448-line hi-res counts), a stable pattern and a softer horizontally dominant beam, no longer calls the effect a CSS overlay, and corrects the hi-res/PAL sentence to say the line count follows the frame; verify the documented wording matches the shader terms
- [x] 2.2 Add `e2e/player-dpr.spec.ts` with `deviceScaleFactor: 2` and a 390x844 viewport that plays the demo, toggles CRT and confirms the canvas is still the only rendering surface with a 3:2 aspect; verify it passes on the verification box with `CHROME_SHELL_PATH` set after `npm run core:fetch`

## 3. Integration verification

- [x] 3.1 Run `npm run typecheck`, `npm run lint` and `npm test` and confirm they pass
- [ ] 3.2 Capture the player at DPR 1, 2 and 3 and at a phone-sized viewport on the verification box, count the scanline periods, and confirm the phone no longer shows the coarse low-frequency bands; tune `blurX` / `blurY` if needed and record the final values in `CRT_PARAMS`
- [x] 3.3 Compare the before/after captures for horizontal versus vertical edge softening and confirm the scanlines remain visible and the picture is not washed out
- [ ] 3.4 Confirm the CRT toggle, the reduced-motion still variant and the phone frame rate are unchanged by the new blur and pattern defaults

## Workflow follow-up

- Archive the change after review with `/opsx-archive stabilize-crt-effect-scale` and verify `openspec/specs/player-crt/spec.md` contains the modified and added requirements with no delta headers.
- If phone captures still show mask moiré, open a separate change for the mask pitch (for example, tying it to the source pixel grid) rather than changing it here.
- If the DPR-scaled backbuffer cannot hold 60 fps with the new blur, open the buffer-pinning follow-up described in `design.md` D4.
