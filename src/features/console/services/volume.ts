/**
 * Volume mapping and application for the emulator player.
 *
 * The 0-100 slider is an absolute loudness control, not a relative nudge:
 * 100 is unity gain (0 dB), 50 is half amplitude (-6 dB), and 0 is the
 * quietest level RetroArch accepts (-80 dB), which is silence to the ear.
 *
 * RetroArch's Emscripten build exposes `_cmd_set_volume(db)`, which writes
 * the gain used when audio is flushed. Cores without that export fall back
 * to the relative VOLUME_UP/VOLUME_DOWN commands, one 0.5 dB step each.
 */

/** Quietest volume RetroArch accepts, in dB. */
export const MIN_VOLUME_DB = -80;

/** Amount one VOLUME_UP/VOLUME_DOWN command changes the volume, in dB. */
export const VOLUME_COMMAND_STEP_DB = 0.5;

/** The parts of an emulator needed to change its output volume. */
export interface VolumeCapableEmulator {
  getEmscriptenModule(): unknown;
  sendCommand(command: 'VOLUME_UP' | 'VOLUME_DOWN'): void;
}

interface VolumeModule {
  _cmd_set_volume?: (db: number) => void;
}

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 0;
  return Math.min(100, Math.max(0, volume));
}

/** Map a 0-100 slider value to the dB value RetroArch expects. */
export function volumeToDb(volume: number): number {
  const clamped = clampVolume(volume);
  if (clamped <= 0) return MIN_VOLUME_DB;
  return Math.max(MIN_VOLUME_DB, 20 * Math.log10(clamped / 100));
}

/** The dB actually applied for a slider value and mute state. */
export function effectiveDb(volume: number, muted: boolean): number {
  return muted ? MIN_VOLUME_DB : volumeToDb(volume);
}

function absoluteVolumeHook(module: unknown): ((db: number) => void) | null {
  if (!module || typeof module !== 'object') return null;
  const hook = (module as VolumeModule)._cmd_set_volume;
  return typeof hook === 'function' ? hook : null;
}

/**
 * Apply `targetDb` to the emulator and return the dB now believed to be
 * active. Prefers the absolute core hook; otherwise nudges the volume with
 * relative commands from `appliedDb`. Never throws: a failed change leaves
 * playback running and reports the level still in effect.
 */
export function applyEmulatorVolume(
  emulator: VolumeCapableEmulator | null | undefined,
  targetDb: number,
  appliedDb: number,
): number {
  if (!emulator) return appliedDb;

  let module: unknown;
  try {
    module = emulator.getEmscriptenModule();
  } catch {
    return appliedDb;
  }

  const hook = absoluteVolumeHook(module);
  if (hook) {
    try {
      hook.call(module, targetDb);
      return targetDb;
    } catch {
      // Fall through to the relative commands below.
    }
  }

  const delta = targetDb - appliedDb;
  const steps = Math.round(Math.abs(delta) / VOLUME_COMMAND_STEP_DB);
  if (steps === 0) return appliedDb;

  try {
    const command = delta > 0 ? 'VOLUME_UP' : 'VOLUME_DOWN';
    for (let i = 0; i < steps; i += 1) emulator.sendCommand(command);
  } catch {
    return appliedDb;
  }
  return appliedDb + Math.sign(delta) * steps * VOLUME_COMMAND_STEP_DB;
}
