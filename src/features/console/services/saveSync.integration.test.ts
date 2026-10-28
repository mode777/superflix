// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { idbDelete } from '@/lib/idb';
import { pb } from '@/lib/pb';
import { adminClient } from '@/admin/lib/pb';
import * as saveSync from './saveSync';

/**
 * Live PocketBase acceptance test for cloud saves (M3).
 *
 *   npm run pb:serve
 *   PB_INTEGRATION=1 npx vitest run src/features/console/services/saveSync.integration.test.ts
 */
const enabled = process.env.PB_INTEGRATION === '1';
const adminEmail = process.env.PB_ADMIN_EMAIL ?? 'admin@example.com';
const adminPassword = process.env.PB_ADMIN_PASSWORD ?? 'test-password-123';

const stamp = Date.now();
const slug = `sync-test-${stamp}`;
const userEmail = `sync-${stamp}@example.com`;
const password = 'password123';

let gameId: string | null = null;
let userId: string | null = null;

const blobOf = (text: string) => new Blob([text], { type: 'application/octet-stream' });

describe.skipIf(!enabled)('cloud save sync against a live PocketBase', () => {
  beforeAll(async () => {
    await adminClient.collection('_superusers').authWithPassword(adminEmail, adminPassword);

    const game = await adminClient.collection('games').create({
      title: 'Sync Test',
      slug,
      region: 'NTSC-U',
      rom_crc32: `SYNC${stamp}`.slice(0, 12),
    });
    gameId = game.id;

    const created = await pb.collection('users').create({
      email: userEmail,
      password,
      passwordConfirm: password,
    });
    userId = created.id;

    await pb.collection('users').authWithPassword(userEmail, password);
  });

  afterAll(async () => {
    if (gameId) {
      for (const collection of ['save_state', 'sram']) {
        const records = await adminClient
          .collection(collection)
          .getFullList({ filter: adminClient.filter('game = {:game}', { game: gameId }) })
          .catch(() => []);
        for (const record of records) {
          await adminClient.collection(collection).delete(record.id).catch(() => undefined);
        }
      }
      await adminClient.collection('games').delete(gameId).catch(() => undefined);
    }
    if (userId) await adminClient.collection('users').delete(userId).catch(() => undefined);

    pb.authStore.clear();
    adminClient.authStore.clear();
  });

  it('saves, syncs both slot 1 and battery saves, and loads on a fresh device', async () => {
    await saveSync.saveState(slug, 'slot1', blobOf('state-A'));

    const stateRecord = await pb
      .collection('save_state')
      .getFirstListItem(pb.filter('type = "slot1" && game = {:game} && user = {:user}', {
        game: gameId,
        user: userId,
      }));
    expect(stateRecord.core).toBe('snes9x');
    expect(stateRecord.data).toBeTruthy();

    await saveSync.saveSram(slug, blobOf('sram-A'));
    const sramRecord = await pb
      .collection('sram')
      .getFirstListItem(pb.filter('game = {:game} && user = {:user}', {
        game: gameId,
        user: userId,
      }));
    expect(sramRecord.data).toBeTruthy();

    // "Browser B": local cache is gone, the cloud copy must be used.
    await idbDelete(`state:${slug}:slot1`);
    await idbDelete(`sram:${slug}`);

    const state = await saveSync.loadState(slug, 'slot1');
    expect(await state.text()).toBe('state-A');

    const sram = await saveSync.availableSram(slug);
    expect(await sram?.text()).toBe('sram-A');
  });
});
