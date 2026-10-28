import { create } from 'zustand';

export interface LocalRom {
  file: File;
  fileName: string;
  size: number;
  /** Changes on every selection so re-picking the same file reloads it. */
  nonce: number;
}

interface RomStore {
  roms: Record<string, LocalRom>;
  setRom: (slug: string, file: File) => void;
  clearRom: (slug: string) => void;
}

export const useRomStore = create<RomStore>((set) => ({
  roms: {},
  setRom: (slug, file) =>
    set((state) => ({
      roms: {
        ...state.roms,
        [slug]: { file, fileName: file.name, size: file.size, nonce: Date.now() },
      },
    })),
  clearRom: (slug) =>
    set((state) => {
      const next = { ...state.roms };
      delete next[slug];
      return { roms: next };
    }),
}));
