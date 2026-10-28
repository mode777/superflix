import { Nostalgist } from 'nostalgist';
import type { EmulatorService, LoadRomOptions } from './emulator';
import { SAVE_SLOTS, type EmulatorSettings, type RuntimeState, type SaveSlot } from '../types';

const CORE = 'snes9x';

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

function volumeToDb(volume: number): number {
  if (volume <= 0) return -80;
  return Math.max(-80, 20 * Math.log10(volume / 100));
}

/**
 * Nostalgist/RetroArch-backed SNES player. Deliberately much smaller than the
 * PSxAnywhere facade: ROMs are small, there is no BIOS, no disc, no memcard,
 * and no SharedArrayBuffer streaming layer.
 */
export class NostalgistEmulatorService implements EmulatorService {
  private canvas: HTMLCanvasElement | null = null;
  private emulator: Nostalgist | null = null;
  private currentRom: { input: File | string; gameId: string; fileName: string } | null = null;
  private runtime: RuntimeState = { status: 'idle', gameId: null, elapsedMs: 0, error: null };
  private readonly runtimeListeners = new Set<() => void>();
  private readonly settingsListeners = new Set<() => void>();
  private settings: EmulatorSettings = { crt: true, volume: 80, muted: false };
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
      input = rom;
    } else if (rom instanceof File) {
      input = rom;
    } else {
      const name = opts.fileName ?? 'game.sfc';
      input = new File([rom as BlobPart], name, { type: 'application/octet-stream' });
    }

    const fileName = typeof input === 'string' ? input.split('/').pop() ?? 'game.sfc' : input.name;
    this.currentRom = { input, gameId: opts.gameId ?? '', fileName };

    try {
      this.emulator = await Nostalgist.launch({
        core: CORE,
        rom: input,
        element: this.canvas,
        sram: opts.sram ?? undefined,
        sramType: 'srm',
        runEmulatorManually: true,
        retroarchConfig: {
          audio_volume: volumeToDb(this.settings.volume),
          audio_mute_enable: this.settings.muted,
          savestate_thumbnail_enable: true,
          rewind_enable: true,
        },
        onLog: (log) => {
          if (log.level === 'error') console.error(`[snes] ${log.message}`);
        },
      });

      if (opts.sram) this.sram = opts.sram;
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
    if (this.emulator && next !== this.settings.volume) {
      const delta = next - this.settings.volume;
      const command = delta > 0 ? 'VOLUME_UP' : 'VOLUME_DOWN';
      const steps = Math.min(20, Math.max(1, Math.round(Math.abs(delta) / 5)));
      for (let i = 0; i < steps; i += 1) this.emulator.sendCommand(command);
    }
    this.setSettings({ volume: next });
  }

  setMuted(muted: boolean): void {
    if (this.emulator && muted !== this.settings.muted) this.emulator.sendCommand('MUTE');
    this.setSettings({ muted });
  }

  toggleMute(): void {
    this.setMuted(!this.settings.muted);
  }

  setCrt(enabled: boolean): void {
    this.setSettings({ crt: enabled });
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
}
