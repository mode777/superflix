import { useCallback, useEffect, useState } from 'react';
import { emulatorService } from '../services';
import * as saveSync from '../services/saveSync';
import type { SaveSlot } from '../types';

export function useSaveStates(gameId: string | undefined) {
  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const memorySlots = emulatorService.listSavedSlots(gameId);

  const refresh = useCallback(async () => {
    if (!gameId) {
      setSlots([]);
      return;
    }
    setSlots(await saveSync.listSlots(gameId));
  }, [gameId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!gameId) {
        if (!cancelled) setSlots([]);
        return;
      }
      const stored = await saveSync.listSlots(gameId);
      if (!cancelled) setSlots(stored);
    })();

    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const save = useCallback(
    async (slot: SaveSlot) => {
      if (!gameId) throw new Error('No game is loaded.');
      const blob = await emulatorService.saveState(slot);
      await saveSync.saveState(gameId, slot, blob);
      await refresh();
    },
    [gameId, refresh],
  );

  const load = useCallback(
    async (slot: SaveSlot) => {
      if (!gameId) throw new Error('No game is loaded.');
      const blob = await saveSync.loadState(gameId, slot);
      await emulatorService.loadState(slot, blob);
    },
    [gameId],
  );

  const remove = useCallback(
    async (slot: SaveSlot) => {
      if (!gameId) return;
      emulatorService.deleteState(slot);
      await saveSync.deleteState(gameId, slot);
      await refresh();
    },
    [gameId, refresh],
  );

  const merged = Array.from(new Set([...slots, ...memorySlots]));
  return { slots: merged, save, load, remove };
}
