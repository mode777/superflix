// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { previewEnrichment } from './enrich';
import { buildArtworkPayload } from './artwork';
import { fetchDatasetImages, fetchDatasetRecord, resolveDatasetSlug, type DatasetImage } from './dataset';
import type { DatasetRecord } from '@/lib/snes-dataset';
import type { ArtworkImage } from './provider';

const { updateRecord } = vi.hoisted(() => ({ updateRecord: vi.fn() }));
vi.mock('@/admin/lib/upload', () => ({ updateRecord }));

vi.mock('./image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./image')>();
  return {
    ...actual,
    downscaleImage: vi.fn(async (image: ArtworkImage) => image),
  };
});

vi.mock('./artwork', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./artwork')>();
  return {
    ...actual,
    buildArtworkPayload: vi.fn(),
  };
});

vi.mock('./dataset', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dataset')>();
  return {
    ...actual,
    resolveDatasetSlug: vi.fn(),
    fetchDatasetRecord: vi.fn(),
    fetchDatasetImages: vi.fn(),
  };
});

const datasetImage = (kind: DatasetImage['kind']): DatasetImage => ({
  blob: new Blob([`dataset-${kind}`], { type: 'image/png' }),
  fileName: `slug-${kind}.png`,
  kind,
});

const fullRecord = {
  title: 'Chrono Trigger',
  description: 'Time travel RPG',
  genre: ['Role-Playing'],
  developer: ['Square'],
  publisher: ['Square'],
  players: '1',
  release_dates: { north_america: 'August 11, 1995' },
  roms: [{ crc32: '2D206BF7', file: 'Chrono Trigger (USA).sfc' }],
  images: { thumb: 'thumb.png', box: 'box.jpeg', snap: 'snap.png' },
} as DatasetRecord;

const input = { crc32: '2D206BF7', title: 'Chrono Trigger', region: 'NTSC-U' as const };

function mockDataset(
  {
    slug = 'chrono-trigger',
    record = fullRecord,
    images = [datasetImage('box'), datasetImage('snap')],
    resolveError,
  }: {
    slug?: string | null;
    record?: DatasetRecord | null;
    images?: DatasetImage[] | 'network-error';
    resolveError?: boolean;
  } = {},
) {
  vi.mocked(resolveDatasetSlug).mockImplementation(async () => {
    if (resolveError) throw new Error('network down');
    return slug;
  });
  vi.mocked(fetchDatasetRecord).mockImplementation(async (requested: string) => {
    if (record === null || requested !== slug) return null;
    return record;
  });
  vi.mocked(fetchDatasetImages).mockImplementation(async () => {
    if (images === 'network-error') throw new Error('network down');
    return images;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buildArtworkPayload).mockResolvedValue(null);
});

describe('previewEnrichment', () => {
  it('resolves checksum-first and returns fields and artwork without writing', async () => {
    mockDataset();

    const preview = await previewEnrichment(input);

    expect(resolveDatasetSlug).toHaveBeenCalledWith('2D206BF7', 'Chrono Trigger', expect.any(Function));
    expect(preview).toMatchObject({
      resolved: true,
      slug: 'chrono-trigger',
      fields: expect.objectContaining({
        description: 'Time travel RPG',
        genre: 'Role-Playing',
        release: '1995-08-11 00:00:00.000Z',
      }),
    });
    expect(preview.cover?.fileName).toBe('slug-box.png');
    expect(preview.screenshots.map((image) => image.fileName)).toEqual(['slug-snap.png']);
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it('honors an explicit manual-match slug without resolving', async () => {
    mockDataset({ slug: 'chosen-game' });

    const preview = await previewEnrichment({ ...input, slug: 'chosen-game' });

    expect(resolveDatasetSlug).not.toHaveBeenCalled();
    expect(preview).toMatchObject({ resolved: true, slug: 'chosen-game' });
    expect(preview.cover).not.toBeNull();
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it('reports a dead explicit slug instead of falling back to checksum', async () => {
    mockDataset({ slug: 'gone-game', record: null });

    const preview = await previewEnrichment({ ...input, slug: 'gone-game' });

    expect(preview).toEqual({ resolved: false, fields: {}, cover: null, screenshots: [] });
    expect(resolveDatasetSlug).not.toHaveBeenCalled();
  });

  it('falls through a stale metadataId hint to the checksum', async () => {
    mockDataset();
    vi.mocked(fetchDatasetRecord)
      .mockResolvedValueOnce(null) // stale hint misses
      .mockResolvedValueOnce(fullRecord);

    const preview = await previewEnrichment({ ...input, metadataId: 'super-metroid' });

    expect(fetchDatasetRecord).toHaveBeenNthCalledWith(1, 'super-metroid', expect.any(Function));
    expect(fetchDatasetRecord).toHaveBeenNthCalledWith(2, 'chrono-trigger', expect.any(Function));
    expect(preview).toMatchObject({ resolved: true, slug: 'chrono-trigger' });
  });

  it('returns resolved-but-empty when the resolved record cannot be fetched', async () => {
    mockDataset();
    vi.mocked(fetchDatasetRecord).mockResolvedValue(null);

    const preview = await previewEnrichment(input);

    expect(preview).toEqual({ resolved: true, fields: {}, cover: null, screenshots: [] });
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it('returns not-found without writing when the game is absent from the dataset', async () => {
    mockDataset({ slug: null });

    const preview = await previewEnrichment(input);

    expect(preview).toEqual({ resolved: false, fields: {}, cover: null, screenshots: [] });
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it('reports unavailability without writing when the dataset is unreachable', async () => {
    mockDataset({ resolveError: true });

    const preview = await previewEnrichment(input);

    expect(preview).toEqual({
      resolved: false,
      fields: {},
      cover: null,
      screenshots: [],
      unavailable: true,
    });
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it('reports unavailability when artwork downloads fail mid-preview', async () => {
    mockDataset({ images: 'network-error' });

    const preview = await previewEnrichment(input);

    expect(preview.unavailable).toBe(true);
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it('returns metadata only for a record without images', async () => {
    mockDataset({ record: { ...fullRecord, images: undefined } as DatasetRecord, images: [] });

    const preview = await previewEnrichment(input);

    expect(preview).toMatchObject({ resolved: true, slug: 'chrono-trigger' });
    expect(preview.cover).toBeNull();
    expect(preview.screenshots).toEqual([]);
    expect(preview.fields.description).toBe('Time travel RPG');
  });
});
