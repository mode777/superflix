# Proposal

## Why

The player's CRT effect is a CSS overlay: a repeating 1px black line at the
source-line pitch plus a radial vignette, multiply-blended over the canvas. It
is cheap and stable, but it is not a CRT — no beam profile, no shadow mask, no
gamma shaping, no halation.

The goal is the tuned `newpixie-crt` look that `psflix` ships. Two approaches
were investigated and both failed on this platform:

- **Own WebGL2 layer** (canvas handoff): the emulator canvas's framebuffer is
  not readable from JavaScript in any environment tested, so the layer rendered
  black.
- **Multi-pass preset inside RetroArch**: the shipped core is GLES2/WebGL1 and
  creates shader render targets with `GL_BGRA_EXT`, which WebGL does not expose
  (`EXT_texture_format_BGRA8888` is absent), so every FBO is incomplete and
  multi-pass shaders render black. Verified with a spike on the verification
  box.

A spike also proved the remaining viable path: a **single-pass GLSL preset
inside RetroArch** renders correctly, `FrameCount`/`OutputSize` are live, and
`SHADER_TOGGLE` switches it at runtime. That is what this change now does.

## What Changes

- Replace the CSS scanline overlay with a single-pass GLSL ES 1.00 shader that
  RetroArch applies to its own output. The preset and shader are written into
  the emulator's virtual filesystem at launch and selected as the global shader
  preset.
- Keep the tuned `newpixie-crt` values for everything that is a per-pixel
  function of the current frame: rolling scanlines (`scanline_strength` 1.0), a
  3px shadow mask, the `0.95/1.05/0.95` tint, the gain curve, filmic tonemap
  (`toe` 0.013, `shoulder` 5.6), `gamma` 1.18, grain, flicker, and `vignette`
  0.35. Chroma bleed and `ghosting` 0.3 are sampled inline from the current
  frame instead of a blurred buffer.
- **Drop the temporal accumulation pass.** `acc_modulate` 0.5 (the phosphor
  trail) needs a previous-frame render target, which the broken FBO path
  cannot provide. The picture is a pure function of the current frame; the only
  visible difference from the reference is the absence of the one-to-three
  frame smear on moving content.
- Render into a fixed 1440x960 canvas that CSS fits to the 4:3 stage, so the
  scanline count (~229) does not change with window size, device pixel ratio or
  fullscreen.
- Toggle CRT with RetroArch's `SHADER_TOGGLE` command. Turning it off shows the
  raw emulator picture; no relaunch, no state loss.
- Remove the second CRT canvas, the WebGL2 layer, the frame copy and the CSS
  overlay.
- If the preset fails to load, RetroArch falls back to its stock output (no
  effect) and playback continues.

## Capabilities

### New Capabilities

- `player-crt`: how the console player achieves the CRT presentation — the
  single-pass effect and its reference look, the fixed output frame, how the
  canvas is sized and fitted, the toggle, reduced-motion selection, and failure
  behaviour.

### Modified Capabilities

(none as a merged capability — `player-video` is not yet in `openspec/specs/`;
this change adds a CRT-mode exception to its whole-pixel render scale, see the
note in the design and archive `player-integer-scaling` first)

## Impact

- New `src/features/console/crt/preset.ts` — the tuned parameters, the GLSL
  source builder and the `.glslp` preset.
- `src/features/console/services/nostalgistEmulatorService.ts` — shader option,
  `SHADER_TOGGLE`, launch video options.
- `src/features/console/hooks/usePlayerScale.ts` — fixed 1440x960 buffer in CRT
  mode, unchanged integer path otherwise.
- `src/features/console/components/GameWindow.tsx`, `src/styles/index.css` —
  removal of the effect canvas and the CSS overlay.
- Tests: preset parity test, service shader/toggle tests, scale-hook tests, the
  Playwright player spec.
- Docs: `docs/controllers.md`, `ATTRIBUTION.md`.
- No backend, schema, dependency or asset changes; the shader is bundled as a
  string, not a public file.
