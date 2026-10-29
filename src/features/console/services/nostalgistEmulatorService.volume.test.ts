import { beforeEach, describe, expect, it, vi } from 'vitest';
import { volumeToDb } from './volume';

const h = vi.hoisted(() => {
  const setVolume = vi.fn();
  const sendCommand = vi.fn();
  const emulator = {
    getStatus: vi.fn((): 'initial' | 'paused' | 'running' | 'terminated' => 'initial'),
    start: vi.fn(async () => {}),
    resume: vi.fn(),
    pause: vi.fn(),
    restart: vi.fn(),
    exit: vi.fn(),
    sendCommand,
    getEmscriptenModule: vi.fn(() => ({ _cmd_set_volume: setVolume })),
  };
  const launch = vi.fn(async (_options: unknown) => emulator);
  return { setVolume, sendCommand, emulator, launch };
});

vi.mock('nostalgist', () => ({
  Nostalgist: {
    configure: vi.fn(),
    launch: h.launch,
  },
}));

const { NostalgistEmulatorService } = await import('./nostalgistEmulatorService');

async function boot(service: InstanceType<typeof NostalgistEmulatorService>) {
  await service.attachCanvas(document.createElement('canvas'));
  await service.loadRom(new Uint8Array([0x00]), { gameId: 'game1', fileName: 'game.sfc' });
}

function lastLaunchConfig() {
  const call = h.launch.mock.calls.at(-1);
  return (call?.[0] as { retroarchConfig: { audio_volume: number; audio_mute_enable: boolean } })
    .retroarchConfig;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.emulator.getStatus.mockReturnValue('initial');
});

describe('NostalgistEmulatorService volume', () => {
  it('applies the default volume after the ROM loads', async () => {
    const service = new NostalgistEmulatorService();
    await boot(service);

    expect(h.setVolume).toHaveBeenLastCalledWith(volumeToDb(80));
    expect(lastLaunchConfig().audio_volume).toBeCloseTo(volumeToDb(80), 6);
    expect(lastLaunchConfig().audio_mute_enable).toBe(false);
  });

  it('applies an absolute dB value for each slider position', async () => {
    const service = new NostalgistEmulatorService();
    await boot(service);

    service.setVolume(50);
    expect(h.setVolume).toHaveBeenLastCalledWith(volumeToDb(50));
    expect(service.getSettings().volume).toBe(50);

    service.setVolume(0);
    expect(h.setVolume).toHaveBeenLastCalledWith(-80);
    expect(service.getSettings().volume).toBe(0);
  });

  it('mutes through gain instead of the MUTE toggle', async () => {
    const service = new NostalgistEmulatorService();
    await boot(service);

    service.setMuted(true);
    expect(h.setVolume).toHaveBeenLastCalledWith(-80);
    expect(h.sendCommand).not.toHaveBeenCalledWith('MUTE');

    service.setMuted(false);
    expect(h.setVolume).toHaveBeenLastCalledWith(volumeToDb(80));
    expect(service.getSettings().volume).toBe(80);
  });

  it('restores the slider level when unmuting after a volume change', async () => {
    const service = new NostalgistEmulatorService();
    await boot(service);

    service.setVolume(35);
    service.toggleMute();
    expect(h.setVolume).toHaveBeenLastCalledWith(-80);

    service.toggleMute();
    expect(h.setVolume).toHaveBeenLastCalledWith(volumeToDb(35));
    expect(service.getSettings().volume).toBe(35);
  });

  it('re-applies the level once playback starts', async () => {
    const service = new NostalgistEmulatorService();
    await boot(service);
    service.setVolume(25);
    vi.clearAllMocks();

    await service.play();
    expect(h.emulator.start).toHaveBeenCalled();
    expect(h.setVolume).toHaveBeenLastCalledWith(volumeToDb(25));
  });

  it('keeps a muted player silent when playback starts', async () => {
    const service = new NostalgistEmulatorService();
    await boot(service);
    service.setMuted(true);
    vi.clearAllMocks();

    await service.play();
    expect(h.setVolume).toHaveBeenLastCalledWith(-80);
  });

  it('applies the current level after a ROM reload', async () => {
    const service = new NostalgistEmulatorService();
    service.setVolume(20);
    await boot(service);

    expect(lastLaunchConfig().audio_volume).toBeCloseTo(volumeToDb(20), 6);
    expect(h.setVolume).toHaveBeenLastCalledWith(volumeToDb(20));
  });

  it('only updates settings before an emulator exists', () => {
    const service = new NostalgistEmulatorService();
    service.setVolume(40);
    service.toggleMute();

    expect(service.getSettings()).toMatchObject({ volume: 40, muted: true });
    expect(h.setVolume).not.toHaveBeenCalled();
    expect(h.sendCommand).not.toHaveBeenCalled();
  });

  it('notifies settings subscribers without disturbing playback', async () => {
    const service = new NostalgistEmulatorService();
    await boot(service);
    const listener = vi.fn();
    const unsubscribe = service.subscribeSettings(listener);

    service.setVolume(10);
    service.toggleMute();
    unsubscribe();
    service.setVolume(90);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(h.emulator.pause).not.toHaveBeenCalled();
    expect(h.emulator.restart).not.toHaveBeenCalled();
  });
});
