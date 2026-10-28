import { create } from 'zustand';
import type { Game } from '@/types/games';

interface LocalGameStore {
  games: Record<string, Game>;
  setGame: (game: Game) => void;
}

/**
 * Games imported locally (before they exist in PocketBase). This keeps the
 * "drop a ROM → identify → play" demo working without a backend.
 */
export const useLocalGameStore = create<LocalGameStore>((set) => ({
  games: {},
  setGame: (game) =>
    set((state) => ({
      games: { ...state.games, [game.slug]: game },
    })),
}));
