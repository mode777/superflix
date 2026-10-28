import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  emulator: {
    saveState: vi.fn(async () => new Blob(['state'])),
    loadState: vi.fn(async () => undefined),
    deleteState: vi.fn(),
    listSavedSlots: vi.fn(() => ['auto'] as const),
  },
  sync: {
    listSlots: vi.fn(async () => ['slot2']),
    saveState: vi.fn(async () => undefined),
    loadState: vi.fn(async () => new Blob(['cloud'])),
    deleteState: vi.fn(async () => undefined),
  },
}));

vi.mock('../services', () => ({ emulatorService: mocks.emulator }));
vi.mock('../services/saveSync', () => mocks.sync);

const { useSaveStates } = await import('./useSaveStates');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.emulator.listSavedSlots.mockReturnValue(['auto']);
  mocks.sync.listSlots.mockResolvedValue(['slot2']);
});

describe('useSaveStates', () => {
  it('merges memory slots with locally stored slots', async () => {
    const { result } = renderHook(() => useSaveStates('mario'));

    await waitFor(() =>
      expect(result.current.slots).toEqual(expect.arrayContaining(['auto', 'slot2'])),
    );
  });

  it('saves through the service and the sync layer', async () => {
    const { result } = renderHook(() => useSaveStates('mario'));

    await act(async () => {
      await result.current.save('slot2');
    });

    expect(mocks.emulator.saveState).toHaveBeenCalledWith('slot2');
    expect(mocks.sync.saveState).toHaveBeenCalledWith('mario', 'slot2', expect.any(Blob));
  });

  it('loads through the sync layer and applies the blob to the emulator', async () => {
    const { result } = renderHook(() => useSaveStates('mario'));

    await act(async () => {
      await result.current.load('slot2');
    });

    expect(mocks.sync.loadState).toHaveBeenCalledWith('mario', 'slot2');
    expect(mocks.emulator.loadState).toHaveBeenCalledWith('slot2', expect.any(Blob));
  });

  it('deletes locally and in the cloud', async () => {
    const { result } = renderHook(() => useSaveStates('mario'));

    await act(async () => {
      await result.current.remove('slot2');
    });

    expect(mocks.emulator.deleteState).toHaveBeenCalledWith('slot2');
    expect(mocks.sync.deleteState).toHaveBeenCalledWith('mario', 'slot2');
  });
});
