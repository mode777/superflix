import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

type SyncState = {
  status: SyncStatus;
  error: string | null;
  setStatus: (status: SyncStatus, error?: string | null) => void;
};

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  error: null,
  setStatus: (status, error = null) => set({ status, error }),
}));

export function setSyncStatus(status: SyncStatus, error: string | null = null): void {
  useSyncStore.getState().setStatus(status, error);
}
