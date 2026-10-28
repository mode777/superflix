import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  emulator: {
    saveState: vi.fn(async () => new Blob(['state'])),
    saveSram: vi.fn(async () => new Blob(['sram'])),
  },
  sync: {
    saveState: vi.fn(async () => undefined),
    saveSram: vi.fn(async () => undefined),
  },
}));

vi.mock('../services', () => ({ emulatorService: mocks.emulator }));
vi.mock('../services/saveSync', () => mocks.sync);

const { useAutosave } = await import('./useAutosave');

const firePageHide = () => window.dispatchEvent(new Event('pagehide'));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.emulator.saveState.mockResolvedValue(new Blob(['state']));
  mocks.emulator.saveSram.mockResolvedValue(new Blob(['sram']));
});

describe('useAutosave', () => {
  it('never saves a session that was not started', async () => {
    renderHook(() => useAutosave('mario', false));

    firePageHide();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.emulator.saveState).not.toHaveBeenCalled();
    expect(mocks.sync.saveState).not.toHaveBeenCalled();
  });

  it('persists state and SRAM on page hide once playback started', async () => {
    renderHook(() => useAutosave('mario', true));

    firePageHide();

    await waitFor(() => expect(mocks.emulator.saveState).toHaveBeenCalledWith('auto'));
    expect(mocks.sync.saveState).toHaveBeenCalledWith('mario', 'auto', expect.any(Blob));
    expect(mocks.sync.saveSram).toHaveBeenCalledWith('mario', expect.any(Blob));
  });

  it('saves on route change (unmount) after starting', async () => {
    const { unmount } = renderHook(() => useAutosave('mario', true));

    unmount();

    await waitFor(() => expect(mocks.emulator.saveState).toHaveBeenCalledWith('auto'));
  });

  it('does not save when there is no game slug', async () => {
    renderHook(() => useAutosave(undefined, true));

    firePageHide();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.emulator.saveState).not.toHaveBeenCalled();
  });
});
