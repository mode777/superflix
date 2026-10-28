import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSyncStore } from './syncStore';

const h = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  const state = {
    gameId: 'game1',
    existingState: null as Record<string, unknown> | null,
    existingSram: null as Record<string, unknown> | null,
    failPush: false,
    created: [] as Array<{ collection: string; data: Record<string, unknown> }>,
    updated: [] as Array<{ collection: string; id: string; data: Record<string, unknown> }>,
    deleted: [] as Array<{ collection: string; id: string }>,
    fetchCalls: 0,
  };
  const authStore = {
    isValid: false,
    record: { id: 'u1', email: 'player@example.com' } as Record<string, unknown> | null,
  };
  const collection = vi.fn((name: string) => {
    if (name === 'games') {
      return {
        getFirstListItem: vi.fn(async () => ({ id: state.gameId })),
      };
    }
    const existing = () => (name === 'save_state' ? state.existingState : state.existingSram);
    return {
      getFirstListItem: vi.fn(async () => {
        const record = existing();
        if (!record) throw { status: 404 };
        return record;
      }),
      create: vi.fn(async (data: Record<string, unknown>) => {
        if (state.failPush) throw new Error('offline');
        state.created.push({ collection: name, data });
        return { id: 'new' };
      }),
      update: vi.fn(async (id: string, data: Record<string, unknown>) => {
        if (state.failPush) throw new Error('offline');
        state.updated.push({ collection: name, id, data });
        return { id };
      }),
      delete: vi.fn(async (id: string) => {
        state.deleted.push({ collection: name, id });
      }),
    };
  });
  const files = {
    getURL: (_record: unknown, filename: string) => `http://pb.test/files/${filename}`,
  };
  return { store, state, authStore, collection, files };
});

vi.mock('@/lib/pb', () => ({
  pb: {
    collection: h.collection,
    authStore: h.authStore,
    files: h.files,
    filter: (_expression: string, params: Record<string, string>) => JSON.stringify(params),
  },
}));

vi.mock('@/lib/idb', () => ({
  idbGet: async (key: string) => h.store.get(key),
  idbSet: async (key: string, value: unknown) => {
    h.store.set(key, value);
  },
  idbDelete: async (key: string) => {
    h.store.delete(key);
  },
  idbKeys: async () => [...h.store.keys()],
}));

const saveSync = await import('./saveSync');

const blobOf = (text: string) => new Blob([text], { type: 'application/octet-stream' });
const LOCAL_DATE = '2026-10-28 10:00:00.000Z';

beforeEach(() => {
  h.store.clear();
  h.state.gameId = 'game1';
  h.state.existingState = null;
  h.state.existingSram = null;
  h.state.failPush = false;
  h.state.created.length = 0;
  h.state.updated.length = 0;
  h.state.deleted.length = 0;
  h.state.fetchCalls = 0;
  h.authStore.isValid = false;
  useSyncStore.getState().setStatus('idle');

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      h.state.fetchCalls += 1;
      return new Response('cloud', { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saveState', () => {
  it('saves locally without a cloud record for guests', async () => {
    await saveSync.saveState('mario', 'slot1', blobOf('state'));

    expect(h.state.created).toHaveLength(0);
    expect(h.store.get('state:mario:slot1')).toMatchObject({ core: 'snes9x' });
    expect(useSyncStore.getState().status).toBe('idle');
  });

  it('pushes to the cloud for signed-in users', async () => {
    h.authStore.isValid = true;

    await saveSync.saveState('mario', 'slot1', blobOf('state'));

    expect(h.state.created).toHaveLength(1);
    expect(h.state.created[0]?.collection).toBe('save_state');
    expect(h.state.created[0]?.data).toMatchObject({
      type: 'slot1',
      game: 'game1',
      user: 'u1',
      core: 'snes9x',
    });
    expect(useSyncStore.getState().status).toBe('synced');
  });

  it('updates the existing cloud record for the slot', async () => {
    h.authStore.isValid = true;
    h.state.existingState = { id: 's1', core: 'snes9x', data: 'file', updated: LOCAL_DATE };

    await saveSync.saveState('mario', 'slot1', blobOf('state'));

    expect(h.state.updated[0]?.id).toBe('s1');
  });

  it('keeps the local save and marks it pending when the push fails, then retries', async () => {
    h.authStore.isValid = true;
    h.state.failPush = true;

    await saveSync.saveState('mario', 'slot1', blobOf('state'));

    expect(useSyncStore.getState().status).toBe('error');
    expect(h.store.get('pending:state:mario:slot1')).toBe(true);
    expect(h.store.get('state:mario:slot1')).toBeTruthy();

    h.state.failPush = false;
    await saveSync.flushPending('mario');

    expect(h.state.created).toHaveLength(1);
    expect(h.store.get('pending:state:mario:slot1')).toBe(false);
    expect(useSyncStore.getState().status).toBe('synced');
  });
});

describe('loadState', () => {
  it('returns a newer local copy without downloading', async () => {
    h.authStore.isValid = true;
    h.store.set('state:mario:slot1', {
      blob: blobOf('local'),
      savedAt: Date.parse(LOCAL_DATE) + 60_000,
      core: 'snes9x',
    });
    h.state.existingState = { id: 's1', core: 'snes9x', data: 'file', updated: LOCAL_DATE };

    const blob = await saveSync.loadState('mario', 'slot1');

    expect(await blob.text()).toBe('local');
    expect(h.state.fetchCalls).toBe(0);
  });

  it('fetches and caches the cloud copy on a local miss', async () => {
    h.authStore.isValid = true;
    h.state.existingState = {
      id: 's1',
      collectionId: 'c1',
      core: 'snes9x',
      data: 'save.bin',
      updated: LOCAL_DATE,
    };

    const blob = await saveSync.loadState('mario', 'slot1');

    expect(await blob.text()).toBe('cloud');
    const cached = h.store.get('state:mario:slot1') as { savedAt: number };
    expect(cached.savedAt).toBe(Date.parse(LOCAL_DATE));
  });

  it('lets a newer cloud copy win over an older local copy (last write wins)', async () => {
    h.authStore.isValid = true;
    h.store.set('state:mario:slot1', {
      blob: blobOf('local-old'),
      savedAt: Date.parse(LOCAL_DATE) - 60_000,
      core: 'snes9x',
    });
    h.state.existingState = {
      id: 's1',
      collectionId: 'c1',
      core: 'snes9x',
      data: 'save.bin',
      updated: LOCAL_DATE,
    };

    const blob = await saveSync.loadState('mario', 'slot1');

    expect(await blob.text()).toBe('cloud');
  });

  it('refuses a state saved by a different core', async () => {
    h.authStore.isValid = true;
    h.state.existingState = {
      id: 's1',
      collectionId: 'c1',
      core: 'other-core',
      data: 'save.bin',
      updated: LOCAL_DATE,
    };

    await expect(saveSync.loadState('mario', 'slot1')).rejects.toThrow(/created on other-core/);
  });

  it('throws when no local or cloud copy exists', async () => {
    await expect(saveSync.loadState('mario', 'slot1')).rejects.toThrow(
      'No saved state in this slot.',
    );
  });

  it('deletes local and cloud copies', async () => {
    h.authStore.isValid = true;
    h.store.set('state:mario:slot1', { blob: blobOf('x'), savedAt: 1, core: 'snes9x' });
    h.state.existingState = { id: 's1', core: 'snes9x', data: 'file', updated: LOCAL_DATE };

    await saveSync.deleteState('mario', 'slot1');

    expect(h.store.get('state:mario:slot1')).toBeUndefined();
    expect(h.state.deleted[0]).toEqual({ collection: 'save_state', id: 's1' });
  });
});

describe('slots and SRAM', () => {
  it('lists locally stored slots', async () => {
    h.store.set('state:mario:slot1', {});
    h.store.set('state:mario:auto', {});
    h.store.set('state:mario:unknown', {});
    h.store.set('state:zelda:slot2', {});

    await expect(saveSync.listSlots('mario')).resolves.toEqual(
      expect.arrayContaining(['slot1', 'auto']),
    );
    await expect(saveSync.listSlots('mario')).resolves.not.toContain('unknown');
  });

  it('syncs battery saves for signed-in users', async () => {
    h.authStore.isValid = true;

    await saveSync.saveSram('mario', blobOf('sram'));

    expect(h.state.created[0]?.collection).toBe('sram');
    expect(h.state.created[0]?.data).toMatchObject({ game: 'game1', user: 'u1' });
  });

  it('offers a cached cloud battery save on a miss', async () => {
    h.authStore.isValid = true;
    h.state.existingSram = {
      id: 'r1',
      collectionId: 'c1',
      data: 'save.srm',
      updated: LOCAL_DATE,
    };

    const blob = await saveSync.availableSram('mario');

    expect(await blob?.text()).toBe('cloud');
    expect(h.store.get('sram:mario')).toBeTruthy();
  });
});
