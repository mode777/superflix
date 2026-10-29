# Design

## Context

See `proposal.md` — Why. Two earlier approaches were tried and rejected on
evidence gathered on the verification box:

1. **Own WebGL2 layer fed by a 256x224 copy of the emulator canvas.** The
   emulator canvas renders in RetroArch's WebGL1 context; sampling it from
   JavaScript returned an empty buffer by every route (`drawImage`,
   `texImage2D`, `readPixels` on its own context, `captureStream`,
   `toDataURL`), across chrome-headless-shell, full Chromium, and Chromium
   under Xvfb with a real window, with and without
   `preserveDrawingBuffer: true`. The picture exists only in the compositor.
2. **Four-pass GLSL preset inside RetroArch.** Compiles and loads, but every
   render target fails: this build is GLES2/WebGL1 (`HAVE_OPENGLES3 ?= 0`), and
   RetroArch's GLES FBO path uses `GL_BGRA_EXT`
   (`gfx/common/gl2_common.h`), which WebGL does not expose
   (`EXT_texture_format_BGRA8888` is absent from the live context). Result:
   `Framebuffer is incomplete: Attachment has zero size`, black screen.

The spike also proved the surviving path: a **single-pass** preset renders
correctly in this build (no FBOs are created), `FrameCount`, `OutputSize` and
`Texture` are live, and `SHADER_TOGGLE` switches it at runtime.

Also relevant: `src/features/console/services/emulator.ts` is the only path to
the emulator, the service already owns launch options and `sendCommand`, and
`perspectives` from the earlier draft — the integer-scale path in
`usePlayerScale` stays intact for the non-CRT case.

## Goals / Non-Goals

**Goals:**

- The tuned `newpixie-crt` look, minus anything that needs more than one pass.
- Zero frame copies and zero extra canvases; the emulator is the only renderer.
- A deterministic look: fixed 1440x960 buffer, independent of window and DPR.
- A toggle that does not restart the game.
- Honest failure: if the preset cannot be applied the game still plays.

**Non-Goals:**

- Phosphor persistence / temporal accumulation (needs a feedback FBO).
- The bezel (`crtframe.png`) and the `use_frame` path.
- User-facing shader parameters.
- Changing the emulator boundary or the non-CRT scaling behaviour.

## Decisions

### D1. One pass, tuned constants baked in

The reference chain is accumulate -> blurH -> blurV -> composite. With no FBOs
nothing can render to a texture, so the port collapses to the composite pass
with its two inputs substituted:

```
reference                              port
accum1 (previous frame + source)  ->   Texture (the core frame)
blur2  (blurred current frame)    ->   a 5-tap blur of Texture at the ghost offset
curvature 0 (identity)            ->   omitted
use_frame / wiggle                ->   omitted
```

The per-pixel terms are copied verbatim from `psflix`'s
`worker/gl/crt-shader.ts` (tint, gain curve, filmic tonemap, gamma, mask,
scanlines, noise, flicker, vignette), with the scanline formula in its
`scanline_strength`-parameterised form. Constants live in
`src/features/console/crt/preset.ts` and are interpolated into the GLSL source,
so they stay single-sourced and testable.

Alternatives: a hand-simplified CRT shader (rejected — it would lose the tuned
character); a three-pass chain without feedback (rejected — any non-final pass
needs an FBO).

### D2. GLSL ES 1.00, libretro shader format

The core exposes a WebGL1 context, so the source is legacy GLSL:

- `#ifdef VERTEX` / `#ifdef FRAGMENT` sections (the backend defines one per
  compile), `attribute`/`varying`, `texture2D`, `gl_FragColor`.
- `#ifdef GL_FRAGMENT_PRECISION_HIGH precision highp float; #else mediump`.
  The rolling scanline's `sin` argument reaches ~3e4, which mediump cannot
  resolve; highp is required for the roll and the grain.
- No `#version` directive: on GLES the backend forces 100 anyway, and the
  tester proved the legacy syntax compiles.
- Uniforms used: `Texture`, `OutputSize`, `FrameCount`. `SourceSize` is not
  needed because the effect is per-pixel in output space.

### D3. Loading the preset

`Nostalgist.launch({ shader: 'newpixie-crt', resolveShader })`, where
`resolveShader` returns two `File` objects (the `.glslp` and the `.glsl`) built
from the preset module. Nostalgist writes them into
`<bundle>/shaders/shaders_glsl/` and points `userdata/config/global.glslp` at
the preset; RetroArch loads the global preset at video init.

The `.glslp` declares a single pass with no `scale_type`: `shaders = 1`,
`shader0 = shaders/newpixie-crt.glsl`, `filter_linear0 = false`. Setting
`scale_type0 = viewport` on the only pass rendered black in this build, so the
pass stays at the default that the spike proved.

Alternative: writing the files by hand through `getEmscriptenFS()`. That works
(the spike used it) but hardcodes Nostalgist's internal paths; the `shader`
option is the supported surface.

### D4. Output frame and geometry

CRT mode: canvas buffer 1440x960 and a CSS transform onto the 4:3 stage. The
emulator sizes its drawing buffer from the element's CSS box, so the box is the
buffer size — the same mechanism as the integer path, just with a fixed size.
A custom 3:2 aspect (`aspect_ratio_index: 20`, `video_aspect_ratio: 1.5`,
`video_scale_integer: false`) makes RetroArch's viewport fill the canvas;
without it the emulator letterboxes a 1:1 or 4:3 rect inside the buffer.
`OutputSize` is therefore 1440x960 and the scanline count is the reference's
~229 at every window size and DPR.

Net geometry: the 256x224 frame is drawn across 3:2 and then CSS-stretched into
4:3, giving `(4/3) / (256/224) = 7/6`, exactly the SNES 8:7 pixel-aspect
correction.

`video_smooth: true` so the effect samples the core texture linearly, matching
the reference port (which filters its source with `LINEAR`). With the integer
buffer in the non-CRT case the filter is a no-op at exact texel centres.

Non-CRT mode keeps the existing whole-pixel buffer and CSS transform.

Alternative: a 4:3 fixed buffer (1440x1080). Rejected: it changes the scanline
count away from the reference.

### D5. Toggle

`emulatorService.setCrt` flips the setting and calls
`sendCommand('SHADER_TOGGLE')`, which the spike confirmed switches the effect
at runtime without touching the core. Turning CRT off also resizes the canvas
back to the integer buffer (the scale hook observes the setting).

### D6. Reduced motion

The shader's time term is compiled from the preset module
(`buildShaderSource({ still })`): when the user prefers reduced motion, the
scanline phase, grain and flicker are constant. The choice is made at launch
via `matchMedia`, because RetroArch offers no runtime uniform override. The
preference is therefore sampled per game launch, not per toggle.

### D7. Failure containment

The preset is validated only by the emulator. If it fails to compile or apply,
RetroArch logs `[GLSL] Failed…` and falls back to its stock output; the game
continues. The service forwards error logs to the console but never throws.
There is no overlay fallback any more: the CSS scanline layer is removed, so a
failed effect means "no effect", not "a different effect".

## Risks / Trade-offs

- [No phosphor trail] -> accepted and documented; the rest of the tuned look is
  preserved. Revisit only if a future core ships WebGL2.
- [Mediump devices lose scanline phase precision] -> `highp` is selected when
  the driver exposes it; otherwise the roll degrades but the still variant is
  unaffected.
- [Shader runs inside a wasm black box] -> the preset is one file, the constants
  are in one module, and the spike showed the exact failure strings to watch.
- [Canvas resize on toggle] -> `resizeVideo` is already the service's public
  path; the emulator handles it without a relaunch (verified in the e2e).
- [1440x960 is soft on 4K] -> accepted for look stability, as in the reference.
- [Hi-res 512x448 frames] -> sampled at native resolution by `Texture`; the
  effect stays correct but the mask/scanlines are computed in output space, so
  hi-res detail is preserved only as far as the 1440x960 buffer allows.
- [Reduced-motion changes require a relaunch] -> documented; the media query is
  read at launch.
- [Pending `player-video` requirement conflict] -> archive
  `player-integer-scaling` before this change: its whole-pixel render scale
  applies only when CRT is off.

## Migration Plan

No data migration. The `crt` setting keeps its meaning and default. Rollback is
toggling CRT off (raw picture) or reverting the release; the removed CSS layer
is unchanged in Git history.

## Open Questions

- Whether the scanline count should follow the source's 224 lines instead of the
  1440x960 buffer (~229) once the core can host a multi-pass chain.
