import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { SAVE_SLOTS, type EmulatorSettings, type RuntimeState, type SaveSlot } from '../types';
import type { SyncStatus } from '../services/syncStore';
import { usePlayerScale } from '../hooks/usePlayerScale';
import { CrtControls } from './CrtControls';
import type { CrtOverrides } from '../crt/params';

interface GameWindowProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  runtime: RuntimeState;
  settings: EmulatorSettings;
  title: string;
  hasRom: boolean;
  savedSlots: SaveSlot[];
  syncStatus?: SyncStatus;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSave: (slot: SaveSlot) => void;
  onLoad: (slot: SaveSlot) => void;
  onDelete: (slot: SaveSlot) => void;
  onVolume: (value: number) => void;
  onToggleMute: () => void;
  onToggleCrt: () => void;
  onCrtParams: (patch: Partial<CrtOverrides>) => void;
  onResetCrtParams: () => void;
  onDownloadSram: () => void;
  onUploadSram: (file: File) => void;
  onPickRom: (file: File) => void;
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function ControlButton({
  icon,
  label,
  onClick,
  disabled,
  active,
  expanded,
  buttonRef,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  expanded?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-expanded={expanded}
      className={cn(
        'flex h-9 w-9 scroll-mt-24 items-center justify-center rounded-lg border transition-colors',
        active
          ? 'border-primary/40 bg-primary/15 text-primary'
          : 'border-white/10 bg-white/[0.04] text-on-surface-variant hover:border-white/20 hover:text-on-surface',
        'disabled:cursor-not-allowed disabled:opacity-35',
      )}
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}

export function GameWindow({
  canvasRef,
  runtime,
  settings,
  title,
  hasRom,
  savedSlots,
  syncStatus,
  onPlay,
  onPause,
  onReset,
  onSave,
  onLoad,
  onDelete,
  onVolume,
  onToggleMute,
  onToggleCrt,
  onCrtParams,
  onResetCrtParams,
  onDownloadSram,
  onUploadSram,
  onPickRom,
}: GameWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const romInputRef = useRef<HTMLInputElement>(null);
  const sramInputRef = useRef<HTMLInputElement>(null);
  const [slot, setSlot] = useState<SaveSlot>('slot1');
  const [sramOpen, setSramOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [crtOpen, setCrtOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const crtButtonRef = useRef<HTMLButtonElement>(null);

  usePlayerScale(containerRef, stageRef, canvasRef, settings.crt);

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const closeCrt = useCallback(() => {
    setCrtOpen(false);
    crtButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!crtOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        closeCrt();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCrt();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [crtOpen, closeCrt]);

  const isPlaying = runtime.status === 'playing';
  const isBusy = runtime.status === 'loading';
  const canControl = hasRom && !isBusy && runtime.status !== 'error';
  const hasSave = savedSlots.includes(slot);

  const toggleFullscreen = () => {
    const element = containerRef.current;
    if (!element) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void element.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div
        ref={containerRef}
        data-testid="player-surface"
        className="player-surface relative mx-auto aspect-[4/3] w-full max-w-[calc(72vh*4/3)] bg-black"
        onDoubleClick={toggleFullscreen}
      >
        <div ref={stageRef} data-testid="player-stage" className="player-stage">
          <canvas
            ref={canvasRef}
            aria-label={`${title} game screen`}
            data-testid="player-canvas"
            className="block"
          />
        </div>

        {!hasRom && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/75 p-6 text-center">
            <span
              className="material-symbols-outlined text-[44px] text-primary/80"
              aria-hidden="true"
            >
              sports_esports
            </span>
            <h2 className="text-headline-lg text-on-surface">Attach a ROM to play</h2>
            <p className="max-w-sm text-body-md text-on-surface-variant">
              Drop a <code className="text-primary">.sfc</code> or{' '}
              <code className="text-primary">.smc</code> file here, or pick one from disk. It stays
              in your browser.
            </p>
            <button
              type="button"
              onClick={() => romInputRef.current?.click()}
              className="rounded-lg bg-gradient-to-br from-primary to-tertiary-container px-4 py-2 text-body-md font-semibold text-on-primary transition hover:brightness-110"
            >
              Choose ROM
            </button>
          </div>
        )}

        {hasRom && runtime.status === 'paused' && (
          <button
            type="button"
            onClick={onPlay}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/45 text-on-surface transition hover:bg-black/35"
            aria-label="Resume game"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary shadow-2xl">
              <span className="material-symbols-outlined text-[34px]" aria-hidden="true">
                play_arrow
              </span>
            </span>
            <span className="text-label-caps uppercase tracking-[0.2em]">Resume</span>
          </button>
        )}

        {isBusy && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/75">
            <span className="h-9 w-9 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <span className="text-body-md text-on-surface-variant">Loading core and ROM…</span>
          </div>
        )}

        {runtime.status === 'error' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/80 p-6 text-center">
            <span className="material-symbols-outlined text-[36px] text-error" aria-hidden="true">
              error
            </span>
            <h2 className="text-headline-lg text-on-surface">Could not start the emulator</h2>
            <p className="max-w-lg text-body-md text-on-surface-variant">{runtime.error}</p>
          </div>
        )}

        <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
          {syncStatus && syncStatus !== 'idle' && (
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-label-caps uppercase tracking-wider backdrop-blur',
                syncStatus === 'error'
                  ? 'bg-error-container/70 text-error'
                  : syncStatus === 'synced'
                    ? 'bg-favorite/20 text-favorite'
                    : 'bg-black/50 text-white/80',
              )}
              data-testid="sync-status"
            >
              {syncStatus === 'syncing' ? 'Syncing…' : syncStatus}
            </span>
          )}
          <span
            className="rounded-full bg-black/50 px-2.5 py-1 text-label-caps uppercase tracking-wider text-white/80 backdrop-blur"
            data-testid="runtime-status"
            role="status"
            aria-live="polite"
          >
            {runtime.status === 'playing' ? 'Live' : runtime.status}
          </span>
          <ControlButton
            icon={isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            label="Toggle fullscreen"
            onClick={toggleFullscreen}
          />
        </div>

        <input
          ref={romInputRef}
          type="file"
          accept=".sfc,.smc,.fig,.swc,.bin"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onPickRom(file);
            event.target.value = '';
          }}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-white/5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <ControlButton
            icon={isPlaying ? 'pause' : 'play_arrow'}
            label={isPlaying ? 'Pause' : 'Play'}
            onClick={isPlaying ? onPause : onPlay}
            disabled={!canControl}
            active={isPlaying}
          />
          <ControlButton
            icon="restart_alt"
            label="Reset game"
            onClick={onReset}
            disabled={!canControl}
          />
          <ControlButton
            icon={settings.crt ? 'tv' : 'tv_off'}
            label="Toggle CRT scanlines"
            onClick={onToggleCrt}
            active={settings.crt}
          />
          <div className="relative" ref={panelRef}>
            <ControlButton
              buttonRef={crtButtonRef}
              icon="tune"
              label="Tune CRT"
              onClick={() => setCrtOpen((open) => !open)}
              active={crtOpen}
              expanded={crtOpen}
            />
            {crtOpen && (
              <div className="fixed inset-x-3 bottom-3 z-30 rounded-xl border border-white/10 bg-surface-container-high p-3 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-full sm:left-0 sm:mb-2 sm:w-72">
                <span className="mb-2 block text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
                  Tune CRT
                </span>
                <CrtControls
                  values={settings.crtParams}
                  onChange={onCrtParams}
                  onReset={onResetCrtParams}
                />
              </div>
            )}
          </div>
          <ControlButton
            icon={settings.muted ? 'volume_off' : 'volume_up'}
            label={settings.muted ? 'Unmute' : 'Mute'}
            onClick={onToggleMute}
            active={settings.muted}
          />

          <label className="ml-1 flex items-center gap-2 text-on-surface-variant">
            <span className="sr-only">Volume</span>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.volume}
              onChange={(event) => onVolume(Number(event.target.value))}
              className="h-1.5 w-24 accent-[var(--color-primary)]"
              aria-label="Volume"
            />
            <span className="w-8 text-right text-label-caps tabular-nums">{settings.volume}</span>
          </label>

          <span className="ml-auto text-body-md tabular-nums text-on-surface-variant">
            {formatTime(runtime.elapsedMs)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
          <label className="flex items-center gap-2 text-body-md text-on-surface-variant">
            <span className="text-label-caps uppercase tracking-[0.16em]">Save slot</span>
            <select
              value={slot}
              onChange={(event) => setSlot(event.target.value as SaveSlot)}
              className="rounded-lg border border-white/10 bg-surface-container-lowest px-2 py-1.5 text-body-md text-on-surface focus:border-primary/60 focus:outline-none"
            >
              {SAVE_SLOTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => onSave(slot)}
            disabled={!canControl}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-body-md text-on-surface-variant transition hover:border-white/20 hover:text-on-surface disabled:opacity-35"
          >
            Save state
          </button>
          <button
            type="button"
            onClick={() => onLoad(slot)}
            disabled={!canControl || !hasSave}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-body-md text-on-surface-variant transition hover:border-white/20 hover:text-on-surface disabled:opacity-35"
          >
            Load state
          </button>
          <button
            type="button"
            onClick={() => onDelete(slot)}
            disabled={!hasSave}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-body-md text-on-surface-variant transition hover:border-white/20 hover:text-on-surface disabled:opacity-35"
          >
            Delete
          </button>

          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setSramOpen((open) => !open)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-body-md text-on-surface-variant transition hover:border-white/20 hover:text-on-surface"
            >
              Battery save
            </button>
            {sramOpen && (
              <div className="absolute bottom-full right-0 z-30 mb-2 w-56 rounded-xl border border-white/10 bg-surface-container-high p-2 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setSramOpen(false);
                    onDownloadSram();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-body-md text-on-surface hover:bg-white/10"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Download .srm
                </button>
                <button
                  type="button"
                  onClick={() => sramInputRef.current?.click()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-body-md text-on-surface hover:bg-white/10"
                >
                  <span className="material-symbols-outlined text-[18px]">upload</span>
                  Load .srm
                </button>
              </div>
            )}
            <input
              ref={sramInputRef}
              type="file"
              accept=".srm,.sav"
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUploadSram(file);
                event.target.value = '';
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
