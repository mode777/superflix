import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const resize = vi.fn();
  const emulator = {
    getStatus: vi.fn((): 'initial' | 'paused' | 'running' | 'terminated' => 'initial'),
    start: vi.fn(async () => {}),
    resume: vi.fn(),
    pause: vi.fn(),
    restart: vi.fn(),
    exit: vi.fn(),
    resize,
    sendCommand: vi.fn(),
    getEmscriptenModule: vi.fn(() => ({ _cmd_set_volume: vi.fn() })),
  };
  const launch = vi.fn(async (_options: unknown) => emulator);
  return { resize, emulator, launch };
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

function lastLaunchOptions() {
  return h.launch.mock.calls.at(-1)?.[0] as
    { size?: { width: number; height: number } } | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.emulator.getStatus.mockReturnValue('initial');
});

describe('NostalgistEmulatorService video sizing', () => {
  it('launches at the size requested before the ROM loads and re-applies it', async () => {
    const service = new NostalgistEmulatorService();
    service.resizeVideo(768, 672);

    // Nothing to resize until a core exists.
    expect(h.resize).not.toHaveBeenCalled();

    await boot(service);

    expect(lastLaunchOptions()?.size).toEqual({ width: 768, height: 672 });
    expect(h.resize).toHaveBeenCalledWith({ width: 768, height: 672 });
  });

  it('applies a resize immediately while a core is running', async () => {
    const service = new NostalgistEmulatorService();
    await boot(service);
    h.resize.mockClear();

    service.resizeVideo(1024, 896);

    expect(h.resize).toHaveBeenCalledTimes(1);
    expect(h.resize).toHaveBeenCalledWith({ width: 1024, height: 896 });
  });

  it('skips a repeated identical size', async () => {
    const service = new NostalgistEmulatorService();
    await boot(service);
    h.resize.mockClear();

    service.resizeVideo(1024, 896);
    service.resizeVideo(1024, 896);
    service.resizeVideo(1024.4, 896.4);

    expect(h.resize).toHaveBeenCalledTimes(1);
  });

  it('does not relaunch or disturb playback when resized', async () => {
    const service = new NostalgistEmulatorService();
    await boot(service);
    await service.play();
    const launches = h.launch.mock.calls.length;

    service.resizeVideo(512, 448);

    expect(h.launch).toHaveBeenCalledTimes(launches);
    expect(service.getRuntime().status).toBe('playing');
  });

  it('ignores unmeasured or invalid sizes', async () => {
    const service = new NostalgistEmulatorService();
    await boot(service);
    h.resize.mockClear();

    service.resizeVideo(0, 0);
    service.resizeVideo(Number.NaN, 672);
    service.resizeVideo(-768, 672);

    expect(h.resize).not.toHaveBeenCalled();
  });

  it('pins the video pipeline to a whole-pixel, unsmoothed first stage', async () => {
    const service = new NostalgistEmulatorService();
    await boot(service);

    const config = (h.launch.mock.calls.at(-1)?.[0] as { retroarchConfig: Record<string, unknown> })
      .retroarchConfig;

    expect(config.aspect_ratio_index).toBe(21);
    expect(config.video_scale_integer).toBe(true);
    expect(config.video_force_aspect).toBe(true);
    expect(config.video_smooth).toBe(false);

    const options = h.launch.mock.calls.at(-1)?.[0] as {
      style?: { imageRendering?: string };
    };
    expect(options.style?.imageRendering).toBe('auto');
  });
});
