import { useCallback, useEffect, useRef } from 'react';
import { emulatorService } from '../services';
import { useRomStore } from '../romStore';

/**
 * Boots the emulator when a game has a ROM (local file or remote URL) and a
 * canvas. The effect is keyed by game + ROM identity so a new file reloads the
 * core without re-running on every parent render.
 */
export function useEmulator(
  gameId: string | undefined,
  romUrl: string | undefined,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
) {
  const localRom = useRomStore((state) => (gameId ? state.roms[gameId] : undefined));
  const bootedRef = useRef<string | null>(null);

  const bootKey = gameId ? `${gameId}:${localRom?.nonce ?? romUrl ?? 'none'}` : null;

  useEffect(() => {
    if (!gameId || !bootKey) return;
    const canvas = canvasRef.current;
    const source = localRom?.file ?? romUrl;
    if (!canvas || !source) return;
    if (bootedRef.current === bootKey) return;

    bootedRef.current = bootKey;
    let cancelled = false;

    void (async () => {
      try {
        await emulatorService.attachCanvas(canvas);
        if (cancelled) return;
        await emulatorService.loadRom(source, {
          gameId,
          fileName: localRom?.fileName,
        });
      } catch (error) {
        console.error('Emulator boot failed:', error);
        bootedRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bootKey, gameId, localRom, romUrl, canvasRef]);

  useEffect(() => {
    return () => {
      emulatorService.destroy();
    };
  }, []);

  const loadLocalRom = useCallback(
    (file: File) => {
      if (!gameId) return;
      useRomStore.getState().setRom(gameId, file);
    },
    [gameId],
  );

  return {
    localRom,
    hasRom: Boolean(localRom?.file ?? romUrl),
    loadLocalRom,
  };
}
