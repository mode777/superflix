import { useCallback, useEffect, useRef } from 'react';
import { emulatorService } from '../services';
import * as saveSync from '../services/saveSync';

/**
 * Persists the current session on page hide and route change. Never saves a
 * session that never started. Registered before the emulator boot effect so
 * the route-leave save runs before the emulator is destroyed.
 */
export function useAutosave(gameSlug: string | undefined, didStart: boolean) {
  const startedRef = useRef(false);
  const slugRef = useRef(gameSlug);

  useEffect(() => {
    slugRef.current = gameSlug;
  }, [gameSlug]);

  useEffect(() => {
    if (didStart) startedRef.current = true;
  }, [didStart]);

  const saveNow = useCallback(async () => {
    const slug = slugRef.current;
    if (!startedRef.current || !slug) return;

    try {
      const state = await emulatorService.saveState('auto');
      await saveSync.saveState(slug, 'auto', state);
      const sram = await emulatorService.saveSram();
      if (sram) await saveSync.saveSram(slug, sram);
    } catch {
      // Autosave is best effort and must never interrupt playback.
    }
  }, []);

  useEffect(() => {
    const handler = () => void saveNow();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') handler();
    };

    window.addEventListener('pagehide', handler);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('pagehide', handler);
      document.removeEventListener('visibilitychange', onVisibility);
      handler();
    };
  }, [saveNow]);

  return saveNow;
}
