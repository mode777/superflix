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

  it('pins the video pipeline so the effect fills the canvas', async () => {
    const service = new NostalgistEmulatorService();
    await boot(service);

    const options = h.launch.mock.calls.at(-1)?.[0] as {
      retroarchConfig: Record<string, unknown>;
      shader?: string;
      style?: { imageRendering?: string };
    };
    const config = options.retroarchConfig;

    expect(config.aspect_ratio_index).toBe(20);
    expect(config.video_aspect_ratio).toBe('1.500000');
    expect(config.video_scale_integer).toBe(false);
    expect(config.video_force_aspect).toBe(true);
    expect(config.video_smooth).toBe(true);
    expect(options.style?.imageRendering).toBe('auto');
  });

  it('installs the CRT preset into the emulator filesystem before launch', async () => {
    const service = new NostalgistEmulatorService();
    await boot(service);

    const options = h.launch.mock.calls.at(-1)?.[0] as {
      beforeLaunch?: (nostalgist: { getEmscriptenFS: () => unknown }) => void;
    };
    const files = new Map<string, string>();
    options.beforeLaunch?.({
      getEmscriptenFS: () => ({
        mkdirTree: () => {},
        writeFile: (path: string, data: string) => files.set(path, data),
      }),
    });

    const shaderDir = '/home/web_user/retroarch/bundle/shaders/shaders_glsl';
    expect(files.get(`${shaderDir}/newpixie-crt.glslp`)).toContain('shaders = 1');
    expect(files.get(`${shaderDir}/shaders/newpixie-crt.glsl`)).toContain('#ifdef FRAGMENT');
    expect(files.get('/home/web_user/retroarch/userdata/config/global.glslp')).toBe(
      `#reference ${shaderDir}/newpixie-crt.glslp\n`,
    );
  });

  it('toggles the effect with RetroArch command instead of relaunching', async () => {
    const service = new NostalgistEmulatorService();
    await boot(service);
    const launches = h.launch.mock.calls.length;

    service.setCrt(false);
    expect(service.getSettings().crt).toBe(false);
    expect(h.emulator.sendCommand).toHaveBeenCalledWith('SHADER_TOGGLE');

    service.setCrt(false);
    expect(h.emulator.sendCommand).toHaveBeenCalledTimes(1);

    service.setCrt(true);
    expect(service.getSettings().crt).toBe(true);
    expect(h.emulator.sendCommand).toHaveBeenCalledTimes(2);
    expect(h.launch).toHaveBeenCalledTimes(launches);
  });
});
