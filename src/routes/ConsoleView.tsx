import { useCallback, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AmbientBackground } from '@/components/media/AmbientBackground';
import { MetadataPanel } from '@/components/media/MetadataPanel';
import { EmptyState } from '@/components/EmptyState';
import { GameWindow } from '@/features/console/components/GameWindow';
import { useEmulator } from '@/features/console/hooks/useEmulator';
import { useRuntime } from '@/features/console/hooks/useRuntime';
import { useSaveStates } from '@/features/console/hooks/useSaveStates';
import { useSettings } from '@/features/console/hooks/useSettings';
import { emulatorService } from '@/features/console/services';
import type { SaveSlot } from '@/features/console/types';
import { useGame } from '@/features/games/useGame';
import { downloadBlob } from '@/lib/download';
import { showToast } from '@/lib/toast';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function ConsoleView() {
  const { slug } = useParams<{ slug: string }>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { data: game, isLoading, isError } = useGame(slug);
  const { hasRom, loadLocalRom } = useEmulator(game?.slug, game?.romUrl, canvasRef);
  const runtime = useRuntime();
  const settings = useSettings();
  const saves = useSaveStates(game?.slug);

  useEffect(() => {
    document.title = game ? `Play ${game.title} — Superflix` : 'Superflix — Super Nintendo Catalog';
    return () => {
      document.title = 'Superflix — Super Nintendo Catalog';
    };
  }, [game]);

  const handlePlay = useCallback(async () => {
    try {
      await emulatorService.play();
    } catch (error) {
      showToast(errorMessage(error, 'Could not start playback.'), { kind: 'error' });
    }
  }, []);

  const handlePause = useCallback(() => {
    emulatorService.pause();
  }, []);

  const handleReset = useCallback(async () => {
    try {
      await emulatorService.reset();
      showToast('Game reset.', { kind: 'info' });
    } catch (error) {
      showToast(errorMessage(error, 'Could not reset the game.'), { kind: 'error' });
    }
  }, []);

  const handleSave = useCallback(
    async (slot: SaveSlot) => {
      try {
        await saves.save(slot);
        showToast(`Saved to ${slot}.`, { kind: 'success' });
      } catch (error) {
        showToast(errorMessage(error, 'Could not save state.'), { kind: 'error' });
      }
    },
    [saves],
  );

  const handleLoad = useCallback(
    async (slot: SaveSlot) => {
      try {
        await saves.load(slot);
        showToast(`Loaded ${slot}.`, { kind: 'success' });
      } catch (error) {
        showToast(errorMessage(error, 'Could not load state.'), { kind: 'error' });
      }
    },
    [saves],
  );

  const handleDelete = useCallback(
    (slot: SaveSlot) => {
      saves.remove(slot);
      showToast(`Deleted ${slot}.`, { kind: 'info' });
    },
    [saves],
  );

  const handleDownloadSram = useCallback(async () => {
    try {
      const blob = await emulatorService.saveSram();
      if (!blob) {
        showToast('No battery save is available yet.', { kind: 'info' });
        return;
      }
      downloadBlob(blob, `${game?.slug ?? 'game'}.srm`);
      showToast('Battery save downloaded.', { kind: 'success' });
    } catch (error) {
      showToast(errorMessage(error, 'Could not export the battery save.'), { kind: 'error' });
    }
  }, [game?.slug]);

  const handleUploadSram = useCallback(async (file: File) => {
    try {
      await emulatorService.loadSram(file);
      showToast('Battery save loaded. Press Play.', { kind: 'success' });
    } catch (error) {
      showToast(errorMessage(error, 'Could not load the battery save.'), { kind: 'error' });
    }
  }, []);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-page px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
        <div className="aspect-video animate-pulse rounded-2xl bg-surface-container-high" />
      </main>
    );
  }

  if (isError || !game) {
    return (
      <main className="mx-auto max-w-page px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
        <EmptyState
          icon="sports_esports"
          title="Game not found"
          description="Import a ROM first, then open the player from its detail page."
          action={
            <Link
              to="/admin"
              className="mt-2 rounded-lg bg-primary px-4 py-2 text-body-md font-semibold text-on-primary"
            >
              Import a ROM
            </Link>
          }
        />
      </main>
    );
  }

  const year = game.release ? game.release.slice(0, 4) : '';

  return (
    <>
      <AmbientBackground accent="#d92d3a" secondary="#5b9dff" />
      <main className="relative mx-auto max-w-page px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
        <Link
          to={`/game/${game.slug}`}
          className="inline-flex items-center gap-1 text-body-md text-on-surface-variant transition hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            arrow_back
          </span>
          Back to details
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-headline-xl-mobile font-extrabold tracking-tight text-on-surface md:text-headline-xl">
              {game.title}
            </h1>
            <p className="mt-1 text-body-lg text-on-surface-variant">
              {[game.developer, year].filter(Boolean).join(' • ')}
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
            {hasRom ? `${game.region} • ROM attached` : 'No ROM attached'}
          </span>
        </div>

        <div className="mt-6">
          <GameWindow
            canvasRef={canvasRef}
            runtime={runtime}
            settings={settings}
            title={game.title}
            hasRom={hasRom}
            savedSlots={saves.slots}
            onPlay={() => void handlePlay()}
            onPause={handlePause}
            onReset={() => void handleReset()}
            onSave={(slot) => void handleSave(slot)}
            onLoad={(slot) => void handleLoad(slot)}
            onDelete={handleDelete}
            onVolume={(value) => emulatorService.setVolume(value)}
            onToggleMute={() => emulatorService.toggleMute()}
            onToggleCrt={() => emulatorService.setCrt(!settings.crt)}
            onDownloadSram={() => void handleDownloadSram()}
            onUploadSram={(file) => void handleUploadSram(file)}
            onPickRom={loadLocalRom}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="glass-panel rounded-2xl p-6">
            <h2 className="text-headline-lg text-on-surface">About</h2>
            <p className="mt-3 whitespace-pre-line text-body-lg leading-relaxed text-on-surface-variant">
              {game.description || 'No description yet.'}
            </p>
            {!hasRom && (
              <p className="mt-4 rounded-xl border border-secondary/20 bg-secondary/5 px-4 py-3 text-body-md text-secondary">
                This entry has no ROM attached. Use “Choose ROM” above to play a local file — it is
                never uploaded.
              </p>
            )}
          </section>

          <section className="glass-panel rounded-2xl p-6">
            <h2 className="text-headline-lg text-on-surface">Details</h2>
            <div className="mt-4">
              <MetadataPanel game={game} />
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
