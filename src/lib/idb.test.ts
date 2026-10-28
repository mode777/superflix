import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { idbDelete, idbGet, idbKeys, idbSet } from './idb';

describe('IndexedDB cache', () => {
  it('stores and reads values', async () => {
    await idbSet('test:one', { blob: 'x', savedAt: 1 });
    await expect(idbGet('test:one')).resolves.toEqual({ blob: 'x', savedAt: 1 });
  });

  it('overwrites existing values', async () => {
    await idbSet('test:two', { savedAt: 1 });
    await idbSet('test:two', { savedAt: 2 });

    await expect(idbGet('test:two')).resolves.toEqual({ savedAt: 2 });
  });

  it('deletes values', async () => {
    await idbSet('test:three', true);
    await idbDelete('test:three');

    await expect(idbGet('test:three')).resolves.toBeUndefined();
  });

  it('lists keys', async () => {
    await idbSet('test:list:a', true);
    await idbSet('test:list:b', true);

    const keys = await idbKeys();
    expect(keys).toEqual(expect.arrayContaining(['test:list:a', 'test:list:b']));
  });

  it('persists pending-sync flags', async () => {
    await idbSet('pending:state:game:slot1', true);
    await expect(idbGet<boolean>('pending:state:game:slot1')).resolves.toBe(true);
  });
});
