# Design

## Context

See proposal.md — Why. The current implementation lives in `src/features/console/services/nostalgistEmulatorService.ts`:

- `loadRom()` passes `audio_volume: volumeToDb(settings.volume)` (dB, 0 = unity) into `Nostalgist.launch`.
- `setVolume()` clamps the slider value, then derives a command count as `|delta| / 5` (capped at 20) and sends that many `VOLUME_UP`/`VOLUME_DOWN` commands.

Each RetroArch volume command moves `settings->floats.audio_volume` by 0.5 dB (clamped to −80…+12 dB) and calls `audio_set_float(AUDIO_ACTION_VOLUME_GAIN, new_volume)`. A full 100-point drag therefore produces at most 20 steps (10 dB), and a drag from 80 to 0 produces 16 steps (8 dB ≈ 0.4 amplitude). The slider can never reach silence, and the number shown in the UI is not the gain actually applied.

The project pins RetroArch/Snes9x `v1.22.0` (`scripts/fetch-core.mjs`). Its Emscripten build exports `Module._cmd_set_volume(float db)`, which is implemented as `audio_set_float(AUDIO_ACTION_VOLUME_GAIN, db)` — an absolute gain write that scales flushed audio regardless of the audio driver. Nostalgist 0.23 exposes the module through the public `getEmscriptenModule()` accessor; it does not expose it in its exported-command map, so the existing code never uses it.

## Goals / Non-Goals

**Goals:**

- Slider position maps to a deterministic, absolute output level; 0 and mute are truly silent.
- Volume and mute survive core start and ROM reloads within the session, with UI and audio agreeing.
- The emulator boundary (`EmulatorService`) and the player UI stay unchanged.
- The mechanism is unit-testable without a browser audio stack.

**Non-Goals:**

- Persisting volume/mute across page reloads (settings remain session-only, as today).
- A perceptual/loudness-normalized curve, per-game volume, or keyboard volume shortcuts.
- Changing RetroArch's own menu volume state or syncing it back to the settings file.
- Any change to save states, SRAM, CRT overlay, or the core fetch pipeline.

## Decisions

### D1: Apply absolute dB through the core's exported volume hook

`setVolume()`/`setMuted()` compute a target dB and write it with `_cmd_set_volume(db)` obtained from `emulator.getEmscriptenModule()`. This is idempotent, does not depend on command-queue timing or on the previous value, and immediately affects the gain applied during audio flush.

The alternative — keeping `VOLUME_UP`/`VOLUME_DOWN` but computing `round(|ΔdB| / 0.5)` steps — was rejected: it requires tracking RetroArch's dB state across launches, mutes, and dropped commands, and a single missed command leaves the slider permanently lying about the output. The other alternative, relaunching the core with a different `audio_volume` config, resets the session and cannot work while playing.

The absolute call is made through a narrow, explicitly typed adapter (`{ _cmd_set_volume?: (db: number) => void }`) rather than `any`, because Nostalgist's type definitions only declare the cheat exports.

**Fallback:** if a future core stops exporting `_cmd_set_volume`, the helper falls back to the supported `VOLUME_UP`/`VOLUME_DOWN` commands, sending `round(|targetDb − appliedDb| / 0.5)` steps in the right direction and recording the resulting `appliedDb`. The service also records `appliedDb` after an absolute write, so both paths agree and the fallback is exercised by tests.

### D2: Linear amplitude mapping with a hard floor

```
volumeToDb(v) = v <= 0 ? -80 : max(-80, 20 * log10(v / 100))
```

100 → 0 dB (unity), 50 → −6.02 dB (half amplitude), 0 → −80 dB (RetroArch's own minimum, effectively silent). This matches the launch-time `audio_volume` value the player already writes, so a relaunch and a live change produce the same loudness. A squared/perceptual curve was considered but rejected: it would make the label disagree with the dB value stored in RetroArch's config and adds no value for a 0–100 control.

Mute resolves to the same −80 dB floor via `effectiveDb(volume, muted)`, independent of the slider value, so unmuting restores the previous level by construction.

### D3: Mute is gain-based, not a toggle command

Mute stops relying on RetroArch's `MUTE` toggle and the launch-time `audio_mute_enable` flag. Both carry state the UI does not own (a config bool plus a runtime toggle), which can desync after a relaunch or a dropped command. Writing −80 dB through the same absolute path makes mute an ordinary function of `(volume, muted)`.

`audio_mute_enable` is therefore always `false` in `retroarchConfig`, and `audio_volume` continues to carry the current slider dB as the launch baseline.

### D4: Re-apply after launch and after start

The core boots paused (`runEmulatorManually: true`), so the launch config is applied before any audio is produced. `loadRom()` calls the volume helper right after `Nostalgist.launch()` resolves, and `play()` calls it again after `start()`/`resume()`, because audio-driver initialization can reset the gain from the settings value. The same helper runs on every `setVolume`/`setMuted` while a core exists; when no core exists it only updates settings, which the next launch then reads.

### D5: Keep the code at the emulator boundary

The mapping and the apply helper live in a new pure module under `src/features/console/services/` (`volume.ts`) with no React or Nostalgist singleton dependency, so Node tests can exercise both application paths. `NostalgistEmulatorService` remains the only caller; the UI keeps calling `emulatorService.setVolume()`/`toggleMute()` and stays free of emulator details.

## Risks / Trade-offs

- [`_cmd_set_volume` is an Emscripten-frontend detail, not a documented Nostalgist API] → it is present in the pinned v1.22.0 core (verified in `public/cores/snes9x_libretro.js`), the helper type-checks its existence, and the relative-command fallback preserves behavior if it disappears.
- [Absolute writes bypass `settings->floats.audio_volume`] → nothing in the app reloads RetroArch's config during a session; any launch re-seeds `audio_volume` from the same mapping and re-applies the gain after start, so a jump cannot occur.
- [Fallback step count can be large (up to ~160 commands for 0↔100)] → commands are queued and parsed in one poll and are only used when the absolute export is missing; acceptable for a rare compatibility path.
- [Automated tests cannot hear audio] → unit tests cover the dB math and both apply paths with fakes; the e2e test asserts playback stays healthy through slider/mute changes; a manual pass with the bundled demo ROM verifies audible silence and level changes.

## Migration Plan

Ship in one change; no data migration. Rollback is reverting the service and helper changes — the UI and stored settings are untouched. `docs/controllers.md` is updated in the same change so the documented behavior matches the implementation.

## Open Questions

- None blocking.
