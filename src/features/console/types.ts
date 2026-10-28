export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export type SaveSlot = 'auto' | 'slot1' | 'slot2' | 'slot3';

export const SAVE_SLOTS: { value: SaveSlot; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'slot1', label: 'Slot 1' },
  { value: 'slot2', label: 'Slot 2' },
  { value: 'slot3', label: 'Slot 3' },
];

export interface RuntimeState {
  status: PlayerStatus;
  gameId: string | null;
  elapsedMs: number;
  error: string | null;
}

export interface EmulatorSettings {
  crt: boolean;
  volume: number;
  muted: boolean;
}
