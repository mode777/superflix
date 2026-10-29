// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { adminClient } from '@/admin/lib/pb';
import { enrichGame } from './enrich';
import { uploadManualCover } from './artwork';
import { createCatalogRecord } from '@/admin/lib/importer';
import { identifyRom } from '@/lib/snes/identify';
import type { DatasetRecord } from '@/lib/snes-dataset';

interface GameRecord extends DatasetRecord {
  id: string;
  slug: string;
  region: string;
  cover_image: string;
  screenshots: string[];
  metadata_source: string;
  metadata_id: string;
  scraped_at: string;
  rom_crc32: string;
  release: string;
}

vi.mock('./image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./image')>();
  return {
    ...actual,
    downscaleImage: vi.fn(async (image: Parameters<typeof actual.downscaleImage>[0]) => image),
  };
});

/**
 * Live acceptance for dataset enrichment against a local PocketBase **and** the
 * real snes-dataset API:
 *
 *   npm run pb:serve            (or: bin/pocketbase serve --http=127.0.0.1:8090)
 *   PB_INTEGRATION=1 npx vitest run src/admin/metadata/enrich.integration.test.ts
 *
 * Skipped by default so the normal suite stays hermetic. No ROM download is
 * needed: the dataset-hit path fabricates a record with a checksum that exists
 * in the dataset, the miss path uses the bundled gothicvania homebrew ROM.
 */
const enabled = process.env.PB_INTEGRATION === '1';
const email = process.env.PB_ADMIN_EMAIL ?? 'admin@example.com';
const password = process.env.PB_ADMIN_PASSWORD ?? 'test-password-123';
const romPath = path.resolve(process.cwd(), 'public/roms/gothicvania.sfc');
const CHRONO_TRIGGER_USA_CRC = '2D206BF7';

describe.skipIf(!enabled)('dataset enrichment against live PocketBase + snes-dataset', () => {
  const createdIds: string[] = [];

  beforeAll(async () => {
    await adminClient.collection('_superusers').authWithPassword(email, password);
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await adminClient.collection('games').delete(id).catch(() => undefined);
    }
    adminClient.authStore.clear();
  });

  async function createGame(overrides: Record<string, unknown> = {}): Promise<GameRecord> {
    // games.rom_crc32 is unique: clear leftovers from earlier runs/tests.
    try {
      const existing = await adminClient
        .collection('games')
        .getFirstListItem(
          adminClient.filter('rom_crc32 = {:crc}', { crc: CHRONO_TRIGGER_USA_CRC }),
        );
      await adminClient.collection('games').delete(existing.id);
    } catch {
      /* none present */
    }

    const record = await adminClient.collection('games').create({
      title: 'Chrono Trigger',
      slug: `chrono-trigger-acceptance-${Date.now()}-${createdIds.length}`,
      region: 'NTSC-U',
      description: '',
      rom_crc32: CHRONO_TRIGGER_USA_CRC,
      ...overrides,
    });
    createdIds.push(record.id);
    return record as unknown as GameRecord;
  }

  it('enriches a dataset hit: metadata + cover + screenshot + provenance', async () => {
    const record = await createGame();

    const result = await enrichGame({
      id: record.id,
      crc32: CHRONO_TRIGGER_USA_CRC,
      title: 'Chrono Trigger',
      region: 'NTSC-U',
      noIntroName: 'Chrono Trigger (USA)',
    });

    expect(result).toMatchObject({ resolved: true, metadata: true, cover: true });
    expect(result.screenshots).toBeGreaterThan(0);

    const stored = (await adminClient
      .collection('games')
      .getOne(record.id)) as unknown as GameRecord;
    expect(String(stored.description)).toContain('Crono');
    expect(stored.metadata_source).toBe('snes-dataset');
    expect(stored.metadata_id).toBe('chrono-trigger');
    expect(stored.scraped_at).toBeTruthy();
    expect(String(stored.cover_image)).not.toBe('');
    expect((stored.screenshots as string[]).length).toBeGreaterThan(0);
    expect(String(stored.release)).toMatch(/^1995-08-11 00:00:00/);
  }, 30_000);

  it('re-syncs by the stored slug and keeps a manual cover untouched', async () => {
    const record = await createGame();

    // First enrichment populates everything and records the slug.
    await enrichGame({
      id: record.id,
      crc32: CHRONO_TRIGGER_USA_CRC,
      title: 'Chrono Trigger',
      region: 'NTSC-U',
    });

    // Admin uploads a manual cover; provenance flips to manual.
    // A real 1x1 PNG: PocketBase rejects uploads it cannot mime-sniff.
    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const png = new Blob([pngBytes], { type: 'image/png' });
    await uploadManualCover(record.id, new File([png], 'manual.png', { type: 'image/png' }));
    const afterManual = (await adminClient
      .collection('games')
      .getOne(record.id)) as unknown as GameRecord;
    expect(afterManual.metadata_source).toBe('manual');
    const manualCoverName = String(afterManual.cover_image);

    // Sync again: slug hint resolves directly, cover stays manual.
    const result = await enrichGame({
      id: record.id,
      crc32: CHRONO_TRIGGER_USA_CRC,
      title: 'Chrono Trigger',
      region: 'NTSC-U',
      metadataId: String(afterManual.metadata_id),
      manualCover: true,
    });

    expect(result.resolved).toBe(true);
    expect(result.cover).toBe(false);
    const stored = (await adminClient
      .collection('games')
      .getOne(record.id)) as unknown as GameRecord;
    expect(String(stored.cover_image)).toBe(manualCoverName);
    expect(stored.metadata_source).toBe('manual');
    expect(String(stored.description)).toContain('Crono');
    expect((stored.screenshots as string[]).length).toBeGreaterThan(0);
  }, 30_000);

  it('imports an uncovered ROM metadata-only and reports it', async () => {
    const bytes = new Uint8Array(readFileSync(romPath));
    const file = new File([bytes as unknown as BlobPart], 'gothicvania.sfc');
    const identification = await identifyRom(bytes, undefined, file.name);

    const { game, enrichment } = await createCatalogRecord(identification, file);
    createdIds.push(game.id);

    // gothicvania is homebrew and not in the dataset: import still succeeds.
    expect(enrichment.resolved).toBe(false);
    expect(enrichment.unavailable).toBeFalsy();

    const stored = (await adminClient.collection('games').getOne(game.id)) as unknown as GameRecord;
    expect(stored.title).toBe('Gothicvania');
    expect(String(stored.description)).toBe('');
    expect(String(stored.cover_image)).toBe('');
  }, 30_000);
});
