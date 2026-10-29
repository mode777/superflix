import { describe, expect, it, vi } from 'vitest';
import {
  MIN_VOLUME_DB,
  VOLUME_COMMAND_STEP_DB,
  applyEmulatorVolume,
  effectiveDb,
  volumeToDb,
  type VolumeCapableEmulator,
} from './volume';

function fakeEmulator(module: unknown, sendCommand = vi.fn()) {
  const emulator: VolumeCapableEmulator = {
    getEmscriptenModule: () => module,
    sendCommand,
  };
  return { emulator, sendCommand };
}

describe('volumeToDb', () => {
  it('uses unity gain at 100', () => {
    expect(volumeToDb(100)).toBe(0);
  });

  it('halves amplitude at 50', () => {
    expect(volumeToDb(50)).toBeCloseTo(-6.0206, 3);
  });

  it('is silent at 0', () => {
    expect(volumeToDb(0)).toBe(MIN_VOLUME_DB);
  });

  it('clamps out-of-range and non-finite values', () => {
    expect(volumeToDb(-25)).toBe(MIN_VOLUME_DB);
    expect(volumeToDb(140)).toBe(0);
    expect(volumeToDb(Number.NaN)).toBe(MIN_VOLUME_DB);
  });

  it('gets monotonically quieter as the slider decreases', () => {
    const levels = [100, 80, 60, 40, 20, 10, 1, 0].map(volumeToDb);
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]).toBeLessThan(levels[i - 1]);
    }
  });
});

describe('effectiveDb', () => {
  it('follows the slider when unmuted', () => {
    expect(effectiveDb(70, false)).toBeCloseTo(volumeToDb(70), 6);
  });

  it('resolves to the silence floor when muted', () => {
    expect(effectiveDb(70, true)).toBe(MIN_VOLUME_DB);
    expect(effectiveDb(0, true)).toBe(MIN_VOLUME_DB);
  });
});

describe('applyEmulatorVolume', () => {
  it('writes the absolute dB through the core hook', () => {
    const setVolume = vi.fn();
    const { emulator, sendCommand } = fakeEmulator({ _cmd_set_volume: setVolume });

    expect(applyEmulatorVolume(emulator, -6.0206, 0)).toBe(-6.0206);
    expect(setVolume).toHaveBeenCalledWith(-6.0206);
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it('falls back to 0.5 dB relative commands when the hook is absent', () => {
    const { emulator, sendCommand } = fakeEmulator({});

    expect(applyEmulatorVolume(emulator, -6, 0)).toBeCloseTo(-6, 6);
    expect(sendCommand).toHaveBeenCalledTimes(12);
    expect(sendCommand).toHaveBeenCalledWith('VOLUME_DOWN');
  });

  it('moves up from the previously applied level', () => {
    const { emulator, sendCommand } = fakeEmulator({});

    expect(applyEmulatorVolume(emulator, 0, -6)).toBeCloseTo(0, 6);
    expect(sendCommand).toHaveBeenCalledTimes(12);
    expect(sendCommand).toHaveBeenCalledWith('VOLUME_UP');
  });

  it('sends no commands when already at the target', () => {
    const { emulator, sendCommand } = fakeEmulator({});

    expect(applyEmulatorVolume(emulator, -6, -6)).toBe(-6);
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it('falls back when the hook throws', () => {
    const { emulator, sendCommand } = fakeEmulator({
      _cmd_set_volume: () => {
        throw new Error('not ready');
      },
    });

    expect(applyEmulatorVolume(emulator, -8, 0)).toBeCloseTo(-8, 6);
    expect(sendCommand).toHaveBeenCalledTimes(16);
  });

  it('keeps the current level when the module cannot be read', () => {
    const emulator: VolumeCapableEmulator = {
      getEmscriptenModule: () => {
        throw new Error('emulator is not ready');
      },
      sendCommand: vi.fn(),
    };

    expect(applyEmulatorVolume(emulator, -20, -2)).toBe(-2);
    expect(emulator.sendCommand).not.toHaveBeenCalled();
  });

  it('keeps the current level when commands cannot be sent', () => {
    const { emulator } = fakeEmulator({}, vi.fn(() => {
      throw new Error('command queue closed');
    }));

    expect(applyEmulatorVolume(emulator, -20, -2)).toBe(-2);
  });

  it('is a no-op without an emulator', () => {
    expect(applyEmulatorVolume(null, -6, -1)).toBe(-1);
    expect(applyEmulatorVolume(undefined, -6, -1)).toBe(-1);
  });

  it('uses the documented step size', () => {
    expect(VOLUME_COMMAND_STEP_DB).toBe(0.5);
  });
});
