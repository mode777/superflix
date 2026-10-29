// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { describeEnrichment, enrichGame } from './enrich';
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

const image = (kind: ArtworkImage['kind']): ArtworkImage => ({
  blob: new Blob([kind], { type: 'image/png' }),
  fileName: `game-${kind}.png`,
  kind,
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
};

const input = { id: 'game-1', crc32: '2D206BF7', title: 'Chrono Trigger', region: 'NTSC-U' as const };

function mockDataset(
  {
    slug = 'chrono-trigger',
    record = fullRecord as DatasetRecord | null,
    images = [datasetImage('thumb'), datasetImage('box'), datasetImage('snap')],
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
  updateRecord.mockResolvedValue({});
  vi.mocked(buildArtworkPayload).mockResolvedValue(null);
});

describe('enrichGame', () => {
  it('writes metadata, cover, and screenshot with provenance on a full match', async () => {
    mockDataset();
    const result = await enrichGame(input);

    expect(result).toEqual({ resolved: true, metadata: true, cover: true, screenshots: 1 });
    expect(updateRecord).toHaveBeenCalledWith(
      'games',
      'game-1',
      expect.objectContaining({
        description: 'Time travel RPG',
        genre: 'Role-Playing',
        developer: 'Square',
        publisher: 'Square',
        players: '1',
        release: '1995-08-11 00:00:00.000Z',
        metadata_source: 'snes-dataset',
        metadata_id: 'chrono-trigger',
        scraped_at: expect.any(String),
      }),
      {
        cover_image: expect.any(File),
        screenshots: [expect.any(File)],
      },
    );
    const files = updateRecord.mock.calls[0][3] as { cover_image: File; screenshots: File[] };
    expect(files.cover_image.name).toBe('slug-thumb.png');
    expect(files.screenshots[0]?.name).toBe('slug-snap.png');
  });

  it('falls back to the libretro provider for a missing screenshot', async () => {
    mockDataset({ images: [datasetImage('thumb')] });
    vi.mocked(buildArtworkPayload).mockResolvedValue({
      cover: null,
      screenshots: [image('title')],
    });

    const result = await enrichGame(input);

    expect(result.screenshots).toBe(1);
    expect(buildArtworkPayload).toHaveBeenCalledWith('Chrono Trigger (USA)', { skipCover: true });
    const files = updateRecord.mock.calls[0][3] as { screenshots: File[] };
    expect(files.screenshots).toHaveLength(1);
  });

  it('adopts the libretro cover when the dataset has no box art', async () => {
    mockDataset({ images: [datasetImage('snap')] });
    vi.mocked(buildArtworkPayload).mockResolvedValue({
      cover: image('boxart'),
      screenshots: [],
    });

    const result = await enrichGame(input);

    expect(result.cover).toBe(true);
    expect(buildArtworkPayload).toHaveBeenCalledWith('Chrono Trigger (USA)', { skipCover: false });
    const files = updateRecord.mock.calls[0][3] as { cover_image: File };
    expect(files.cover_image.name).toBe('game-boxart.png');
  });

  it('writes metadata only when the record has no images and no fallback', async () => {
    mockDataset({ record: { ...fullRecord, images: undefined } as DatasetRecord, images: [] });

    const result = await enrichGame(input);

    expect(result).toEqual({ resolved: true, metadata: true, cover: false, screenshots: 0 });
    const files = updateRecord.mock.calls[0][3] as Record<string, unknown>;
    expect(files).toEqual({});
  });

  it('keeps a manual cover while updating everything else', async () => {
    mockDataset();
    const result = await enrichGame({ ...input, manualCover: true });

    expect(result.cover).toBe(false);
    expect(buildArtworkPayload).not.toHaveBeenCalled(); // never touches the cover
    const fields = updateRecord.mock.calls[0][2] as Record<string, unknown>;
    const files = updateRecord.mock.calls[0][3] as Record<string, unknown>;
    expect(fields.metadata_source).toBeUndefined(); // manual marker preserved
    expect(fields.metadata_id).toBe('chrono-trigger');
    expect(files.cover_image).toBeUndefined();
    expect(files.screenshots).toHaveLength(1);
  });

  it('returns not-found without writing when the game is absent from the dataset', async () => {
    mockDataset({ slug: null });

    const result = await enrichGame(input);

    expect(result).toEqual({ resolved: false, metadata: false, cover: false, screenshots: 0 });
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it('verifies a stale metadataId hint before falling back to the checksum', async () => {
    mockDataset();
    // First fetch (old hint) misses, second fetch (resolved slug) hits.
    vi.mocked(fetchDatasetRecord)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(fullRecord as DatasetRecord);

    const result = await enrichGame({ ...input, metadataId: 'super-metroid' });

    expect(fetchDatasetRecord).toHaveBeenNthCalledWith(1, 'super-metroid', expect.any(Function));
    expect(fetchDatasetRecord).toHaveBeenNthCalledWith(2, 'chrono-trigger', expect.any(Function));
    expect(result.resolved).toBe(true);
    expect(updateRecord).toHaveBeenCalledWith(
      'games',
      'game-1',
      expect.objectContaining({ metadata_id: 'chrono-trigger' }),
      expect.anything(),
    );
  });

  it('does not write anything when a resolved record is empty', async () => {
    mockDataset({ record: { title: 'Empty Game' } as DatasetRecord, images: [] });

    const result = await enrichGame(input);

    expect(result).toEqual({ resolved: true, metadata: false, cover: false, screenshots: 0 });
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it('reports unavailability instead of throwing when the dataset is unreachable', async () => {
    mockDataset({ resolveError: true });

    const result = await enrichGame(input);

    expect(result).toEqual({
      resolved: false,
      metadata: false,
      cover: false,
      screenshots: 0,
      unavailable: true,
    });
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it('reports unavailability when the image download fails mid-enrichment', async () => {
    mockDataset({ images: 'network-error' });

    const result = await enrichGame(input);

    expect(result.unavailable).toBe(true);
    expect(updateRecord).not.toHaveBeenCalled();
  });
});

describe('describeEnrichment', () => {
  it('summarizes the four outcome shapes', () => {
    expect(describeEnrichment(undefined)).toBe('enrichment unavailable');
    expect(
      describeEnrichment({ resolved: false, metadata: false, cover: false, screenshots: 0, unavailable: true }),
    ).toBe('dataset unreachable');
    expect(describeEnrichment({ resolved: false, metadata: false, cover: false, screenshots: 0 })).toBe(
      'not in dataset',
    );
    expect(describeEnrichment({ resolved: true, metadata: true, cover: true, screenshots: 2 })).toBe(
      'metadata + cover + 2 screenshots',
    );
    expect(describeEnrichment({ resolved: true, metadata: true, cover: false, screenshots: 0 })).toBe(
      'metadata',
    );
  });
});
