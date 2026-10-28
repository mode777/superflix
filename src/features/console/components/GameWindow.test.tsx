import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameWindow } from './GameWindow';

function renderWindow(syncStatus?: 'idle' | 'syncing' | 'synced' | 'error') {
  return render(
    <GameWindow
      canvasRef={{ current: null }}
      runtime={{ status: 'paused', gameId: 'mario', elapsedMs: 0, error: null }}
      settings={{ crt: false, volume: 50, muted: false }}
      title="Gothicvania"
      hasRom
      savedSlots={[]}
      syncStatus={syncStatus}
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
    />,
  );
}

describe('GameWindow sync status', () => {
  it('shows the sync status chip while syncing', () => {
    renderWindow('syncing');
    expect(screen.getByTestId('sync-status')).toHaveTextContent('Syncing');
  });

  it('shows an error chip', () => {
    renderWindow('error');
    expect(screen.getByTestId('sync-status')).toHaveTextContent('error');
  });

  it('hides the chip when idle', () => {
    renderWindow('idle');
    expect(screen.queryByTestId('sync-status')).not.toBeInTheDocument();
  });
});
