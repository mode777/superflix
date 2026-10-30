# Design

## Context

See `proposal.md` — Why. The current path is:

```
CRT_PARAMS (constants) -> buildShaderSource() -> installPreset() in beforeLaunch
                       -> RetroArch loads global.glslp at video init
```

`CRT_PARAMS` is interpolated into the GLSL as `#define`s, and the only runtime
control is `emulatorService.setCrt()`, which sends `SHADER_TOGGLE`. The
settings live in the service's memory (`EmulatorSettings`) and are not
persisted. The UI is the player control bar in `GameWindow.tsx`; the
"Battery save" popover is the existing pattern for a small settings panel.

This change depends on `stabilize-crt-effect-scale` being archived first: that
change adds `blurX`/`blurY` and the one-line-per-source-line anchor, and the
`Reference look` text below is written against its post-archive form.

The RetroArch wasm contains the `SET_SHADER` command and a "Watch Shader Files
for Changes" option (`video_shader_watch_files`). `SET_SHADER <path>` is the
supported way to load a preset directly; a file-watch flag is a possible
fallback but the Emscripten memory FS may not deliver native watch events.

## Goals / Non-Goals

**Goals:**

- Five user-facing controls: scanline strength, horizontal blur, vertical blur,
  vignette and ghosting, with the reference values as defaults.
- Changes apply to a running game without restarting it.
- Per-browser persistence, validation/clamping, and a reset to the defaults.
- Keep the service boundary: the UI never talks to RetroArch, and the shader
  builder stays pure and testable.
- Keep the non-exposed terms fixed and the panel keyboard accessible.

**Non-Goals:**

- Exposing tonemap, gamma, mask, grain or flicker values.
- Per-account/cloud sync or shareable presets.
- Changing the CRT default, the reference look, or the on/off toggle.
- Server-side or per-game configuration.

## Decisions

### D1. Independent horizontal and vertical blur sliders

Expose normalized `hBlur` and `vBlur` in `0..1` and map each to its shader
radius independently:

```
blurX = hBlur * 12.0
blurY = vBlur * 12.0
```

- Default `hBlur = 0.3` gives `blurX = 3.6`; default `vBlur = 0.15`
  gives `blurY = 1.8`. The default vignette is 0.4 and ghosting 0.3.
- The axes are independent, so the user can make the vertical radius larger
  than the horizontal. The reference default remains horizontal-dominant, and
  the `Anisotropic beam blur` delta now explicitly permits an override.
- `scanlineStrength`, `vignette` and `ghosting` pass through directly. The
  tonemap, gamma, mask, grain and flicker parameters are not exposed.

The user-facing type is the overrides, not the full shader params:

```ts
interface CrtOverrides {
  scanlineStrength: number; // 0..1
  hBlur: number;            // 0..1 -> blurX 0..12
  vBlur: number;            // 0..1 -> blurY 0..12
  vignette: number;         // 0..1
  ghosting: number;         // 0..1
}
```

`resolveCrtParams(overrides)` returns the full `CRT_PARAMS` shape. The pure
module owns the defaults, clamping and the `hBlur/vBlur -> blurX/blurY`
mapping. The UI shows percentages; the stored values are normalized.

### D2. Per-browser persistence

Store the overrides in `localStorage` under a versioned key
(`superflix.crt-params.v1`), read once at module initialisation, and write on
each change. There is no account requirement for the player, so local storage is
the lowest-friction default; PocketBase sync would be a separate feature and
is explicitly out of scope.

- Parse defensively: missing, malformed, non-finite or out-of-range values fall
  back to the reference defaults; unknown fields are ignored.
- Migrate the v0.8.0 `softness` shape on read: `hBlur = softness` and
  `vBlur = softness * (2.5 / 6)`, so values saved before the separate sliders
  keep their look.
- Clamp every value on read and write.
- Guard `typeof localStorage` and try/catch so private mode or tests do not
  break playback; an unavailable store simply keeps the in-memory value.
- The versioned key leaves room for a future migration without resurrecting
  stale shapes.

### D3. Live apply by rewriting the preset and sending `SET_SHADER`

The service stores the Emscripten FS and the preset path captured in
`beforeLaunch`. `setCrtParams(patch)`:

1. Resolves the overrides to full params and updates `EmulatorSettings`, so
   the UI updates immediately and the value is persisted.
2. If no game is running, stops; the next launch writes the params in
   `beforeLaunch`.
3. Rewrites the `.glsl`/`.glslp` through `installPreset(fs, { params, still })`.
4. If CRT is on, sends `SET_SHADER <presetPath>`; if CRT is off, the rewritten
   global preset is picked up when the effect is next toggled on.

`buildShaderSource({ params, still })` and `installPreset(fs, { params, still })`
take the resolved params; `CRT_PARAMS` stays the default so existing tests and
callers keep the reference look.

A **spike is the first task**: prove that rewriting the preset and sending
`SET_SHADER` recompiles and applies the new values in this WebGL1/GLSL build
without a relaunch. If that fails, try `SHADER_TOGGLE` off/on after the
rewrite. If neither works, stop and revisit the live-apply requirement rather
than silently turning the panel into a next-launch-only setting.

The slider's label updates on every `input`, but the service is called on
`change` (pointer release / keyboard step) or after a short debounce. That
avoids recompiling the shader on every pixel of a drag while keeping the
"no restart" behavior. A recompile may briefly hitch; that is acceptable for a
deliberate adjustment.

The reduced-motion choice is still sampled at launch; live rewrites reuse the
same `still` flag so the effect does not start rolling for a user who asked it
not to.

### D4. Panel UI

Add a "Tune CRT" control next to the existing TV toggle. It opens a small
popover, following the `Battery save` pattern, with five native range inputs,
a live percentage label each, a "Reset to defaults" button and a short
caption. The TV button remains the on/off toggle; the panel is a separate
button so the two actions are not confused.

- Use the existing theme tokens (`bg-surface-container-high`, `text-on-surface`,
  `text-body-md`, `border-white/10`, etc.), not hard-coded colours.
- Native range inputs keep keyboard operability and visible focus; each gets a
  `<label>` or `aria-label` and an `aria-valuetext` percentage.
- Close on outside click or Escape, and return focus to the trigger. The panel
  is not a modal, so the existing modal focus rules do not apply, but the
  existing accessibility checks still must pass.
- On viewports below the `sm` breakpoint the panel is a fixed bottom sheet, so
  the 288px popover cannot overflow a phone; above it, the popover anchors above
  the Tune button. The control bar already wraps.

### D5. Tests and the service boundary

- `params.test.ts`: defaults, clamping, malformed storage, the v0.8.0
  `softness` migration, and independent H/V mapping.
- `preset.test.ts`: builder uses the supplied params and still defaults to the
  reference.
- Service test: `setCrtParams` before launch stores only; while running with
  CRT on it writes the preset and sends `SET_SHADER`; with CRT off it writes
  but does not load.
- Component test: the panel renders five labelled controls, updates the
  settings, resets, and persists.
- e2e: open the panel, adjust a slider while playing, confirm playback
  continues, reload and confirm the value persists, reset and confirm the
  default. Extend the existing a11y run to include the open panel.

## Risks / Trade-offs

- [`SET_SHADER` does not reload the rewritten preset in this build] -> the
  spike resolved this: rewriting the preset and sending `SET_SHADER` changed the
  picture from red to blue without a relaunch. The toggle fallback remains
  documented; if a future build regresses, pause and revise the live-apply spec
  rather than shipping a misleading panel.
- [Live recompile hitches or flashes] -> apply on `change`/debounce, not on
  every drag pixel; keep the current picture if a reload fails.
- [A user picks a look they dislike] -> reset button, clamped ranges, fixed
  tonemap; the reference remains one click away.
- [Stored values drift across app versions] -> versioned key and defensive
  parsing with defaults.
- [Private-mode localStorage is unavailable] -> catch and keep the value in
  memory for the session.
- [Persisted values are per browser, not per account] -> documented; cloud
  sync is out of scope.
- [Independent blur can produce a harsh or vertically smeared look] -> the
  reference defaults are one click away, every value is clamped, and the spec
  permits the override deliberately.
- [v0.8.0 stored values use `softness`] -> the parser migrates them to
  `hBlur`/`vBlur` with the reference ratio, so existing looks survive.

## Migration Plan

The storage key is unchanged; existing v0.8.0 values with `softness` are read
as `hBlur = softness` and `vBlur = softness * (2.5 / 6)`. New writes use
`hBlur`/`vBlur`. Removing the key or the feature returns to the compiled
`CRT_PARAMS` defaults. No backend, schema or deployment change is needed.

## Open Questions

- The exact H/V ranges (`0..12` frame pixels) and the default vertical value
  may need a tuning pass on the verification box. The mapping is isolated in
  one pure function, so the numbers can change without a spec or storage
  change.
