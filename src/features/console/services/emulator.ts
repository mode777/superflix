import type { EmulatorSettings, RuntimeState, SaveSlot } from '../types';

export interface LoadRomOptions {
  gameId?: string;
  fileName?: string;
  /** Initial battery save to mount before the first frame. */
  sram?: Blob | null;
}

/**
 * Everything the console view needs from an emulator backend. The production
 * implementation wraps Nostalgist/RetroArch; tests can substitute a mock.
 */
export interface EmulatorService {
  attachCanvas(canvas: HTMLCanvasElement): Promise<void>;
  /** Size the drawing buffer, e.g. `n * 256` by `n * 224`. */
  resizeVideo(width: number, height: number): void;
  loadRom(
    rom: File | Blob | ArrayBuffer | Uint8Array | string,
    opts?: LoadRomOptions,
  ): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  reset(): Promise<void>;
  destroy(): void;
  getCanvas(): HTMLCanvasElement | null;
  getRuntime(): RuntimeState;
  subscribeRuntime(listener: () => void): () => void;

  saveState(slot: SaveSlot): Promise<Blob>;
  loadState(slot: SaveSlot, blob?: Blob): Promise<void>;
  deleteState(slot: SaveSlot): void;
  listSavedSlots(gameId?: string): SaveSlot[];

  saveSram(): Promise<Blob | null>;
  loadSram(blob: Blob): Promise<void>;
  getSram(): Blob | null;

  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  toggleMute(): void;
  setCrt(enabled: boolean): void;
  getSettings(): EmulatorSettings;
  subscribeSettings(listener: () => void): () => void;
}
