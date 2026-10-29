import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GameWindow } from './GameWindow';

function renderWindow(overrides: Partial<ComponentProps<typeof GameWindow>> = {}) {
  return render(
    <GameWindow
      canvasRef={{ current: null }}
      runtime={{ status: 'paused', gameId: 'mario', elapsedMs: 0, error: null }}
      settings={{ crt: false, volume: 50, muted: false }}
      title="Gothicvania"
      hasRom
      savedSlots={[]}
      onPlay={vi.fn()}
      onPause={vi.fn()}
      onReset={vi.fn()}
      onSave={vi.fn()}
      onLoad={vi.fn()}
      onDelete={vi.fn()}
      onVolume={vi.fn()}
      onToggleMute={vi.fn()}
      onToggleCrt={vi.fn()}
      onDownloadSram={vi.fn()}
      onUploadSram={vi.fn()}
      onPickRom={vi.fn()}
      {...overrides}
    />,
  );
}

describe('GameWindow sync status', () => {
  it('shows the sync status chip while syncing', () => {
    renderWindow({ syncStatus: 'syncing' });
    expect(screen.getByTestId('sync-status')).toHaveTextContent('Syncing');
  });

  it('shows an error chip', () => {
    renderWindow({ syncStatus: 'error' });
    expect(screen.getByTestId('sync-status')).toHaveTextContent('error');
  });

  it('hides the chip when idle', () => {
    renderWindow({ syncStatus: 'idle' });
    expect(screen.queryByTestId('sync-status')).not.toBeInTheDocument();
  });
});

describe('GameWindow video layout', () => {
  it('keeps the canvas inside the 4:3 stage with a smooth final filter', () => {
    renderWindow();

    const stage = screen.getByTestId('player-stage');
    const canvas = screen.getByTestId('player-canvas');

    expect(stage).toContainElement(canvas);
    expect(getComputedStyle(canvas).imageRendering).not.toBe('pixelated');
  });

  it('lets the CRT overlay sit over the canvas stage', () => {
    renderWindow({ settings: { crt: true, volume: 50, muted: false } });

    const stage = screen.getByTestId('player-stage');
    expect(stage.querySelector('.crt-overlay')).not.toBeNull();
  });
});

describe('GameWindow audio controls', () => {
  it('reports slider moves as volume values', () => {
    const onVolume = vi.fn();
    renderWindow({ onVolume });

    fireEvent.change(screen.getByRole('slider', { name: 'Volume' }), {
      target: { value: '25' },
    });

    expect(onVolume).toHaveBeenCalledWith(25);
  });

  it('toggles mute from the volume button', () => {
    const onToggleMute = vi.fn();
    renderWindow({ onToggleMute });

    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));

    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });

  it('labels the control for the opposite action while muted', () => {
    const onToggleMute = vi.fn();
    renderWindow({ settings: { crt: false, volume: 50, muted: true }, onToggleMute });

    fireEvent.click(screen.getByRole('button', { name: 'Unmute' }));

    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });
});
