import { useCallback, useReducer } from 'react';
import { emulatorService } from '../services';
import type { SaveSlot } from '../types';

export function useSaveStates(gameId: string | undefined) {
  const [, forceRender] = useReducer((value: number) => value + 1, 0);
  const slots = emulatorService.listSavedSlots(gameId);

  const refresh = useCallback(() => forceRender(), []);

  const save = useCallback(
    async (slot: SaveSlot) => {
      await emulatorService.saveState(slot);
      refresh();
    },
    [refresh],
  );

  const load = useCallback(async (slot: SaveSlot) => {
    await emulatorService.loadState(slot);
  }, []);

  const remove = useCallback(
    (slot: SaveSlot) => {
      emulatorService.deleteState(slot);
      refresh();
    },
    [refresh],
  );

  return { slots, save, load, remove };
}
