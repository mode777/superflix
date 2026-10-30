# Proposal

## Why

The CRT look is fixed at build time. `CRT_PARAMS` is baked into the shader
source, so changing scanline strength, blur, vignette or ghosting requires a
code change and a release. The player already lets users turn the effect on and
off; it should also let them tune its most visible properties without waiting
for a deploy, while the tuned reference stays the default.

## What Changes

- Add a **CRT controls** panel to the player with five user-facing settings:
  scanline strength, horizontal blur, vertical blur, vignette and ghosting.
  The current tuned values are the defaults. The two blur axes are independent;
  the default remains horizontal-dominant.
- Apply a change to a running game without restarting it by rewriting the
  emulator's shader preset and asking RetroArch to reload it. When no game is
  running, store the value and apply it at the next launch.
- Persist the values per browser, clamp stale or out-of-range stored values,
  and offer a one-click reset to the reference look.
- Keep everything else fixed: the shadow mask, tint, gain curve, filmic
  tonemap, gamma, grain, flicker, and the one-scanline-per-source-line anchor.
- Keep the existing CRT on/off toggle and its default unchanged.
- Extend the emulator boundary so the UI never talks to RetroArch directly,
  and cover the parameter mapping, persistence, service reload, panel and
  live-adjust flow with tests.

Out of scope: exposing the tonemap, gamma, mask or grain parameters;
per-account or cloud sync of the values; shareable presets; changing the
reference look or the CRT default; server-side configuration.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `player-crt`: adds user-adjustable parameters with the reference values as
  defaults, live apply and per-browser persistence/reset, and marks the
  reference look as the default while keeping the non-exposed terms fixed.

## Impact

- `src/features/console/crt/preset.ts` — shader builder and preset installer
  accept a parameter set; a pure mapping turns the user-facing controls into
  the full `CRT_PARAMS`.
- `src/features/console/services/emulator.ts` and
  `nostalgistEmulatorService.ts` — `setCrtParams`, preset rewrite and reload.
- `src/features/console/types.ts` and a new CRT-parameter module — override
  type, defaults, validation and browser storage.
- `src/features/console/components/GameWindow.tsx` / `ConsoleView.tsx` — the
  panel and its control-bar entry point.
- Tests, e2e, and `docs/controllers.md` for the new controls.
- `openspec/specs/player-crt/spec.md` after the delta is applied.

This change depends on `stabilize-crt-effect-scale` being archived first: that
change introduces the `blurX`/`blurY` parameters and the source-line anchor
this panel exposes. The `Reference look` delta below is written against the
post-archive text. No new dependency or backend is required.
