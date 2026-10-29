# Tasks

## 1. Volume math and apply helper

- [x] 1.1 Create `src/features/console/services/volume.ts` exporting `volumeToDb(volume)`, `effectiveDb(volume, muted)`, and `applyEmulatorVolume(emulator, targetDb, appliedDb)` (absolute `_cmd_set_volume` path plus a dB-accurate `VOLUME_UP`/`VOLUME_DOWN` fallback returning the new applied dB); verify `npm run typecheck` passes and no `any` is introduced
- [x] 1.2 Add `volume.test.ts` covering 100→0 dB, 50→−6.02 dB, 0→−80 dB, clamping, mute resolving to the −80 dB floor, the absolute hook being called with the target dB, and the fallback sending the expected count/direction from a prior dB; verify with `npm test`

## 2. Emulator service integration

- [x] 2.1 Replace the `|delta| / 5` command heuristic in `nostalgistEmulatorService.ts` with the helper, track the applied dB, make `setMuted` gain-based instead of sending `MUTE`, set `audio_mute_enable: false` in `retroarchConfig`, and re-apply volume after `loadRom()` and after `play()` starts; verify `npm run typecheck` and `npm run lint` pass
- [x] 2.2 Add `nostalgistEmulatorService.volume.test.ts` mocking `nostalgist` to assert `setVolume`/`setMuted` write the expected absolute dB, no `MUTE` command is sent, and `play()` re-applies the current level; verify with `npm test`

## 3. Player UI, e2e, and docs

- [x] 3.1 Extend `GameWindow.test.tsx` to move the volume slider and activate mute, asserting `onVolume` receives the new value and `onToggleMute` fires; verify with `npm test`
- [x] 3.2 Extend `e2e/player.spec.ts` to set the slider to 0 and back to 100 and toggle mute twice after playback starts, asserting the player stays live with no error overlay; verify with `npm run test:e2e`
- [x] 3.3 Update `docs/controllers.md` to describe absolute volume, silence at 0/mute, and unmute restoring the previous level; verify the wording matches the shipped behavior

## 4. Gates and manual verification

- [x] 4.1 Run `npm run typecheck && npm run lint && npm test && npm run build` and confirm all pass
- [x] 4.2 With the bundled demo ROM in a real browser, confirm 100 is full volume, 50 is noticeably quieter, 0 is silent, mute silences and unmute restores, and a muted player stays silent when Play is pressed

## Workflow follow-up

- Archive the change after review and a green gate.
