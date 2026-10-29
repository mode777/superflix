# Proposal

## Why

The player's volume slider and mute button change the on-screen number and icon but barely change what you hear, and setting the slider to 0 still leaves audible game audio. The service translates a 0–100 slider into a handful of relative `VOLUME_UP`/`VOLUME_DOWN` RetroArch commands (`|delta| / 5`, capped at 20 commands). Each command only moves volume by a small fixed dB step, so a full 0–100 drag changes loudness by at most ~10 dB — roughly a third of the amplitude — never silence. The UI value and RetroArch's actual volume therefore drift apart, and the slider cannot be trusted.

## What Changes

- Replace relative volume commands with **absolute dB application**: map the 0–100 slider to dB (`20 * log10(v / 100)`, floor −80 dB) and set that gain directly through the pinned core's exported volume hook, with a dB-accurate relative-command fallback for cores that do not export it.
- Make **0 and mute actually silent**, and unmute restore the previous slider value. Mute no longer relies on RetroArch's toggle command or a launch-time config flag that can desync from the UI.
- Re-apply the current volume/mute after the core starts (and when the ROM reloads) so launch state, UI state, and audible gain stay identical.
- Keep the existing settings surface and UI; no new controls, no layout change.
- Add unit tests for the mapping and for both volume-application paths, plus a player e2e check that exercising the slider and mute does not disturb playback; update the player documentation to describe the real behavior.

Not **BREAKING**: the `EmulatorService` interface, settings shape, and player UI are unchanged. Settings still reset on page reload (unchanged, out of scope).

## Capabilities

### New Capabilities

- `player-audio`: How the browser player applies volume and mute to emulator audio — a slider-to-dB contract, silence at zero/muted, and consistency between UI state and audible output before and after playback starts.

### Modified Capabilities

(none — the only merged capability is `metadata-enrichment`, which is unrelated)

## Impact

- `src/features/console/services/nostalgistEmulatorService.ts` — absolute volume application, launch/start re-application, removal of step-count heuristics and the `MUTE` toggle path.
- `src/features/console/services/volume.ts` (new) — pure slider→dB/effective-gain mapping and the core-agnostic volume-applying helper.
- `src/features/console/services/emulator.ts` — unchanged contract, confirmed by typecheck.
- `src/routes/ConsoleView.tsx`, `src/features/console/components/GameWindow.tsx` — unchanged wiring; verified end to end.
- Tests: new `volume` unit tests and an extended `GameWindow` interaction test; `e2e/player.spec.ts` gains a slider/mute playback check.
- `docs/controllers.md` — replace the "approximate emulator volume" wording.
- No new dependencies, no PocketBase/schema changes, no new assets.
