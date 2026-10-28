// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { identifyRom } from '@/lib/snes/identify';
import { adminClient } from './pb';
import { createCatalogRecord, precheckImport, replaceGameRom } from './importer';
import { applyArtwork } from '../metadata/artwork';
import type { ArtworkProvider } from '../metadata/provider';

vi.mock('@/admin/metadata/image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/admin/metadata/image')>();
  return { ...actual, downscaleImage: async (image: unknown) => image };
});

/**
 * Live PocketBase acceptance test for the catalog importer.
 *
 * Run with a local PocketBase instance:
 *   npm run pb:serve
 *   PB_INTEGRATION=1 npx vitest run src/admin/lib/importer.integration.test.ts
 *
 * Skipped by default so the normal suite stays hermetic.
 */
const enabled = process.env.PB_INTEGRATION === '1';
const email = process.env.PB_ADMIN_EMAIL ?? 'admin@example.com';
const password = process.env.PB_ADMIN_PASSWORD ?? 'test-password-123';
const romPath = path.resolve(process.cwd(), 'public/roms/gothicvania.sfc');

describe.skipIf(!enabled)('catalog importer against a live PocketBase', () => {
  let createdId: string | null = null;

  beforeAll(async () => {
    await adminClient.collection('_superusers').authWithPassword(email, password);

    const existing = await adminClient
      .collection('games')
      .getFullList({ filter: adminClient.filter('slug = {:slug}', { slug: 'gothicvania' }) });
    for (const record of existing) await adminClient.collection('games').delete(record.id);
  });

  afterAll(async () => {
    if (createdId) {
      await adminClient.collection('games').delete(createdId).catch(() => undefined);
      createdId = null;
    }
    adminClient.authStore.clear();
  });

  it('imports the demo ROM, persists it, and reports the duplicate on re-import', async () => {
    const bytes = new Uint8Array(readFileSync(romPath));
    const file = new File([bytes as unknown as BlobPart], 'gothicvania.sfc');
    const identification = await identifyRom(bytes, undefined, file.name);

    const disposition = await precheckImport('gothicvania', identification.hashes.crc32);
    expect(disposition.kind).toBe('create');

    const progress: number[] = [];
    const { game } = await createCatalogRecord(identification, file, (percent) =>
      progress.push(percent),
    );
    createdId = game.id;

    expect(game.slug).toBe('gothicvania');
    expect(progress.at(-1)).toBe(100);

    const stored = await adminClient.collection('games').getOne(game.id);
    expect(stored.title).toBe('Gothicvania');
    expect(stored.rom_crc32).toBe('88D63376');
    expect(stored.rom_size).toBe(524288);
    expect(stored.rom_header).toBeTruthy();

    const roms = await adminClient
      .collection('roms')
      .getFullList({ filter: adminClient.filter('game = {:game}', { game: game.id }) });
    expect(roms).toHaveLength(1);
    expect(roms[0]?.is_primary).toBe(true);
    expect(roms[0]?.crc32).toBe('88D63376');

    // Public read: the catalog and the ROM file must be reachable without auth.
    const publicGames = await fetch(
      `${adminClient.baseURL}/api/collections/games/records?filter=${encodeURIComponent(
        `slug = "${game.slug}"`,
      )}`,
    );
    expect(publicGames.status).toBe(200);
    const payload = (await publicGames.json()) as { items: Array<Record<string, unknown>> };
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]?.slug).toBe('gothicvania');

    const romUrl = `${adminClient.baseURL}/api/files/games/${game.id}/${String(
      payload.items[0]?.rom,
    )}`;
    const romResponse = await fetch(romUrl, { method: 'HEAD' });
    expect(romResponse.status).toBe(200);

    const again = await precheckImport('gothicvania', identification.hashes.crc32);
    expect(again.kind).toBe('duplicate');
    if (again.kind === 'duplicate') expect(again.game.id).toBe(game.id);

    // Catalog management paths used by the admin editor.
    await adminClient.collection('games').update(game.id, { title: 'Gothicvania (Demo)' });
    const renamed = await adminClient
      .collection('games')
      .getFirstListItem(adminClient.filter('slug = {:slug}', { slug: 'gothicvania' }));
    expect(renamed.title).toBe('Gothicvania (Demo)');

    await replaceGameRom(game.id, file);
    const replaced = await adminClient.collection('games').getOne(game.id);
    expect(replaced.rom_crc32).toBe('88D63376');
    expect(replaced.rom_size).toBe(524288);

    // Artwork + provenance path (downscaling stubbed; the PocketBase PATCH is real).
    const png = Uint8Array.from(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ),
    );
    const provider: ArtworkProvider = {
      id: 'integration-provider',
      fetchArtwork: async () => ({
        cover: { blob: new Blob([png], { type: 'image/png' }), fileName: 'cover.png', kind: 'boxart' },
        screenshots: [
          { blob: new Blob([png], { type: 'image/png' }), fileName: 'shot.png', kind: 'title' },
        ],
      }),
    };
    await expect(applyArtwork(game.id, 'Gothicvania', { provider })).resolves.toBe(true);
    const withArt = await adminClient.collection('games').getOne(game.id);
    expect(withArt.metadata_source).toBe('integration-provider');
    expect(withArt.metadata_id).toBe('Gothicvania');
    expect(withArt.scraped_at).toBeTruthy();
    expect(withArt.cover_image).toBeTruthy();
    expect(withArt.screenshots).toHaveLength(1);

    await adminClient.collection('games').delete(game.id);
    createdId = null;
    const gone = await fetch(
      `${adminClient.baseURL}/api/collections/games/records?filter=${encodeURIComponent(
        'slug = "gothicvania"',
      )}`,
    );
    const gonePayload = (await gone.json()) as { items: unknown[] };
    expect(gonePayload.items).toHaveLength(0);
  });
});
