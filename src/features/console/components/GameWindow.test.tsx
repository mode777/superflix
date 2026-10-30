import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GameWindow } from './GameWindow';
import { DEFAULT_CRT_OVERRIDES } from '../crt/params';

function renderWindow(overrides: Partial<ComponentProps<typeof GameWindow>> = {}) {
  return render(
    <GameWindow
      canvasRef={{ current: null }}
      runtime={{ status: 'paused', gameId: 'mario', elapsedMs: 0, error: null }}
      settings={{ crt: false, volume: 50, muted: false, crtParams: DEFAULT_CRT_OVERRIDES }}
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
      onCrtParams={vi.fn()}
      onResetCrtParams={vi.fn()}
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

  it('renders the game canvas as the only presentation layer', () => {
    renderWindow({ settings: { crt: true, volume: 50, muted: false, crtParams: DEFAULT_CRT_OVERRIDES } });

    const stage = screen.getByTestId('player-stage');
    expect(stage.querySelector('canvas')).toBe(screen.getByTestId('player-canvas'));
    expect(stage.querySelector('.crt-overlay')).toBeNull();
    expect(stage.querySelectorAll('canvas')).toHaveLength(1);
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
    renderWindow({ settings: { crt: false, volume: 50, muted: true, crtParams: DEFAULT_CRT_OVERRIDES }, onToggleMute });

    fireEvent.click(screen.getByRole('button', { name: 'Unmute' }));

    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });
});

describe('GameWindow CRT controls', () => {
  it('opens the panel, reports a change and resets', () => {
    const onCrtParams = vi.fn();
    const onResetCrtParams = vi.fn();
    renderWindow({ onCrtParams, onResetCrtParams });

    fireEvent.click(screen.getByRole('button', { name: 'Tune CRT' }));
    expect(screen.getByRole('group', { name: 'CRT settings' })).toBeInTheDocument();

    const slider = screen.getByRole('slider', { name: 'Scanlines' });
    fireEvent.input(slider, { target: { value: '40' } });
    fireEvent.pointerUp(slider);
    expect(onCrtParams).toHaveBeenCalledWith({ scanlineStrength: 0.4 });

    fireEvent.click(screen.getByRole('button', { name: 'Reset to reference' }));
    expect(onResetCrtParams).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    renderWindow();
    const trigger = screen.getByRole('button', { name: 'Tune CRT' });
    fireEvent.click(trigger);
    expect(screen.getByRole('group', { name: 'CRT settings' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'CRT settings' })).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });
});
