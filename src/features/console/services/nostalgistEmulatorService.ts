import { Nostalgist } from 'nostalgist';
import type { EmulatorService, LoadRomOptions } from './emulator';
import { applyEmulatorVolume, effectiveDb, volumeToDb } from './volume';
import { installPreset, type PresetFileSystem } from '../crt/preset';
import {
  clampCrtOverrides,
  readStoredCrtOverrides,
  resolveCrtParams,
  writeStoredCrtOverrides,
  type CrtOverrides,
} from '../crt/params';
import { SAVE_SLOTS, type EmulatorSettings, type RuntimeState, type SaveSlot } from '../types';

const CORE = 'snes9x';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Self-host the core so the player does not depend on jsDelivr at runtime.
// Run `npm run core:fetch` before starting the app.
if (typeof document !== 'undefined') {
  const coreBase = new URL('cores/', document.baseURI).toString();
  Nostalgist.configure({
    resolveCoreJs: (core) =>
      typeof core === 'string' ? `${coreBase}${core}_libretro.js` : core.js,
    resolveCoreWasm: (core) =>
      typeof core === 'string' ? `${coreBase}${core}_libretro.wasm` : core.wasm,
  });
}

/**
 * Nostalgist/RetroArch-backed SNES player. Deliberately much smaller than the
 * PSxAnywhere facade: ROMs are small, there is no BIOS, no disc, no memcard,
 * and no SharedArrayBuffer streaming layer.
 */
export class NostalgistEmulatorService implements EmulatorService {
  private canvas: HTMLCanvasElement | null = null;
  private emulator: Nostalgist | null = null;
  /** Drawing-buffer size requested by the layout, kept across ROM loads. */
  private videoSize: { width: number; height: number } | null = null;
  /** Emulator FS and preset path, retained so shader params can reload live. */
  private shaderFs: PresetFileSystem | null = null;
  private presetPath: string | null = null;
  private shaderStill = false;
  private currentRom: { input: File | string; gameId: string; fileName: string } | null = null;
  private runtime: RuntimeState = { status: 'idle', gameId: null, elapsedMs: 0, error: null };
  private readonly runtimeListeners = new Set<() => void>();
  private readonly settingsListeners = new Set<() => void>();
  private settings: EmulatorSettings = {
    crt: true,
    volume: 80,
    muted: false,
    crtParams: readStoredCrtOverrides(),
  };
  /** dB currently written to the core, or the launch baseline before it starts. */
  private appliedDb = volumeToDb(this.settings.volume);
  /** Save states keyed by `${gameId}:${slot}`. */
  private readonly states = new Map<string, Blob>();
  private sram: Blob | null = null;
  private startedAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  async attachCanvas(canvas: HTMLCanvasElement): Promise<void> {
    if (this.canvas === canvas) return;
    this.canvas = canvas;
    if (this.emulator) this.destroy();
  }

  resizeVideo(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    const next = { width: Math.round(width), height: Math.round(height) };
    if (
      this.videoSize &&
      this.videoSize.width === next.width &&
      this.videoSize.height === next.height
    ) {
      return;
    }
    this.videoSize = next;
    this.emulator?.resize(next);
  }

  async loadRom(
    rom: File | Blob | ArrayBuffer | Uint8Array | string,
    opts: LoadRomOptions = {},
  ): Promise<void> {
    if (!this.canvas) throw new Error('Attach a canvas before loading a ROM');

    this.destroy();
    this.sram = opts.sram ?? null;
    this.setRuntime({ status: 'loading', gameId: opts.gameId ?? null, error: null });

    let input: File | string;
    if (typeof rom === 'string') {
      input = typeof document !== 'undefined' ? new URL(rom, document.baseURI).toString() : rom;
    } else if (rom instanceof File) {
      input = rom;
    } else {
      const name = opts.fileName ?? 'game.sfc';
      input = new File([rom as BlobPart], name, { type: 'application/octet-stream' });
    }

    const fileName =
      typeof input === 'string' ? (input.split('/').pop() ?? 'game.sfc') : input.name;
    this.currentRom = { input, gameId: opts.gameId ?? '', fileName };

    try {
      this.emulator = await Nostalgist.launch({
        core: CORE,
        rom: input,
        element: this.canvas,
        // Nostalgist defaults the canvas to `image-rendering: pixelated`; the
        // fractional fit after the integer stage must stay smooth.
        style: { imageRendering: 'auto' },
        ...(this.videoSize ? { size: this.videoSize } : {}),
        sram: opts.sram ?? undefined,
        sramType: 'srm',
        runEmulatorManually: true,
        // The CRT effect is a single-pass GLSL preset applied by the emulator
        // itself. It has to be in the virtual filesystem before video starts,
        // so it is written here rather than after launch. See crt/preset.ts.
        beforeLaunch: (nostalgist) => {
          this.shaderStill = prefersReducedMotion();
          const fs = nostalgist.getEmscriptenFS() as PresetFileSystem;
          this.shaderFs = fs;
          this.presetPath = installPreset(fs, {
            still: this.shaderStill,
            params: resolveCrtParams(this.settings.crtParams),
          });
        },
        retroarchConfig: {
          audio_volume: volumeToDb(this.settings.volume),
          audio_mute_enable: false,
          savestate_thumbnail_enable: true,
          rewind_enable: true,
          // A custom 3:2 viewport fills the 1440x960 effect buffer edge to
          // edge; the canvas is then fitted to the 4:3 stage, which supplies
          // the SNES aspect correction.
          aspect_ratio_index: 20,
          video_aspect_ratio: '1.500000',
          video_scale_integer: false,
          video_force_aspect: true,
          // Linear sampling feeds the effect a smooth source, matching the
          // reference port. At whole-pixel sizes this is a no-op.
          video_smooth: true,
        },
        onLog: (log) => {
          if (log.level === 'error') console.error(`[snes] ${log.message}`);
        },
      });

      if (opts.sram) this.sram = opts.sram;
      // Nostalgist's postRun sizes the canvas to the element (or launch size);
      // re-assert the layout's whole-pixel size after the core is running.
      if (this.videoSize) this.emulator.resize(this.videoSize);
      this.applyVolume();
      this.startedAt = performance.now();
      this.setRuntime({ status: 'paused', gameId: opts.gameId ?? null, elapsedMs: 0 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emulator = null;
      this.setRuntime({ status: 'error', gameId: null, error: message });
      throw error;
    }
  }

  async play(): Promise<void> {
    if (!this.emulator) return;
    const status = this.emulator.getStatus();
    if (status === 'initial') {
      await this.emulator.start();
    } else if (status === 'paused') {
      this.emulator.resume();
    }
    this.applyVolume();
    this.startedAt = performance.now() - this.runtime.elapsedMs;
    this.setRuntime({ status: 'playing', error: null });
    this.startTimer();
  }

  pause(): void {
    if (!this.emulator) return;
    this.emulator.pause();
    this.stopTimer();
    this.setRuntime({
      status: 'paused',
      elapsedMs: performance.now() - this.startedAt,
    });
  }

  async reset(): Promise<void> {
    if (!this.emulator) return;
    this.emulator.restart();
    this.applyVolume();
    this.startedAt = performance.now();
    this.setRuntime({ status: 'playing', elapsedMs: 0, error: null });
    this.startTimer();
  }

  destroy(): void {
    this.stopTimer();
    if (this.emulator) {
      try {
        this.emulator.exit({ removeCanvas: false });
      } catch {
        // The emulator may not have been started yet.
      }
      this.emulator = null;
    }
    this.currentRom = null;
    this.sram = null;
    this.shaderFs = null;
    this.presetPath = null;
    this.shaderStill = false;
    this.appliedDb = volumeToDb(this.settings.volume);
    this.setRuntime({ status: 'idle', gameId: null, elapsedMs: 0, error: null });
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  getRuntime(): RuntimeState {
    return this.runtime;
  }

  subscribeRuntime(listener: () => void): () => void {
    this.runtimeListeners.add(listener);
    return () => this.runtimeListeners.delete(listener);
  }

  async saveState(slot: SaveSlot): Promise<Blob> {
    if (!this.emulator) throw new Error('No emulator is running');
    const { state } = await this.emulator.saveState();
    this.states.set(this.stateKey(slot), state);
    return state;
  }

  async loadState(slot: SaveSlot, blob?: Blob): Promise<void> {
    if (!this.emulator) throw new Error('No emulator is running');
    const state = blob ?? this.states.get(this.stateKey(slot));
    if (!state) throw new Error(`No save state in ${slot}`);
    await this.emulator.loadState(state);
  }

  deleteState(slot: SaveSlot): void {
    this.states.delete(this.stateKey(slot));
  }

  listSavedSlots(gameId?: string): SaveSlot[] {
    const prefix = `${gameId ?? this.currentRom?.gameId ?? ''}:`;
    return [...this.states.keys()]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length) as SaveSlot)
      .filter((slot) => SAVE_SLOTS.some((item) => item.value === slot));
  }

  async saveSram(): Promise<Blob | null> {
    if (!this.emulator) return this.sram;
    this.sram = await this.emulator.saveSRAM();
    return this.sram;
  }

  async loadSram(blob: Blob): Promise<void> {
    this.sram = blob;
    if (!this.currentRom) return;
    const { input, gameId, fileName } = this.currentRom;
    await this.loadRom(input, { gameId, fileName, sram: blob });
  }

  getSram(): Blob | null {
    return this.sram;
  }

  setVolume(volume: number): void {
    const next = Math.min(100, Math.max(0, Math.round(volume)));
    this.setSettings({ volume: next });
    this.applyVolume();
  }

  setMuted(muted: boolean): void {
    this.setSettings({ muted });
    this.applyVolume();
  }

  toggleMute(): void {
    this.setMuted(!this.settings.muted);
  }

  setCrt(enabled: boolean): void {
    if (this.settings.crt === enabled) return;
    this.setSettings({ crt: enabled });
    // RetroArch swaps the loaded preset for its stock output; the core keeps
    // running, so save state, SRAM and audio are untouched. The command exists
    // in RetroArch 1.22 but not in Nostalgist's typed command union.
    this.sendRawCommand('SHADER_TOGGLE');
  }

  setCrtParams(patch: Partial<CrtOverrides>): void {
    const next = clampCrtOverrides({ ...this.settings.crtParams, ...patch });
    const current = this.settings.crtParams;
    if (
      next.scanlineStrength === current.scanlineStrength &&
      next.softness === current.softness &&
      next.vignette === current.vignette &&
      next.ghosting === current.ghosting
    ) {
      return;
    }

    this.setSettings({ crtParams: next });
    writeStoredCrtOverrides(next);

    if (!this.shaderFs || !this.presetPath) return;
    installPreset(this.shaderFs, {
      still: this.shaderStill,
      params: resolveCrtParams(next),
    });

    if (this.emulator && this.settings.crt) {
      // The spike against this build proved SET_SHADER reloads the rewritten
      // preset without restarting the core.
      this.sendRawCommand(`SET_SHADER ${this.presetPath}`);
    }
  }

  private sendRawCommand(command: string): void {
    const emulator = this.emulator as unknown as { sendCommand(command: string): void } | null;
    emulator?.sendCommand(command);
  }

  getSettings(): EmulatorSettings {
    return this.settings;
  }

  subscribeSettings(listener: () => void): () => void {
    this.settingsListeners.add(listener);
    return () => this.settingsListeners.delete(listener);
  }

  private stateKey(slot: SaveSlot, gameId = this.currentRom?.gameId ?? ''): string {
    return `${gameId}:${slot}`;
  }

  private startTimer(): void {
    this.stopTimer();
    this.timer = setInterval(() => {
      if (this.runtime.status === 'playing') {
        this.setRuntime({ elapsedMs: performance.now() - this.startedAt });
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private setRuntime(patch: Partial<RuntimeState>): void {
    this.runtime = { ...this.runtime, ...patch };
    for (const listener of this.runtimeListeners) listener();
  }

  private setSettings(patch: Partial<EmulatorSettings>): void {
    this.settings = { ...this.settings, ...patch };
    for (const listener of this.settingsListeners) listener();
  }

  private applyVolume(): void {
    if (!this.emulator) return;
    const target = effectiveDb(this.settings.volume, this.settings.muted);
    this.appliedDb = applyEmulatorVolume(this.emulator, target, this.appliedDb);
  }
}
