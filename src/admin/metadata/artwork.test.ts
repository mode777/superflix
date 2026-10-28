// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyArtwork, buildArtworkPayload, provenanceFields, uploadManualCover } from './artwork';
import { downscaleImage } from './image';
import type { ArtworkImage, ArtworkProvider, ArtworkResult } from './provider';

const { updateRecord } = vi.hoisted(() => ({ updateRecord: vi.fn() }));
vi.mock('@/admin/lib/upload', () => ({ updateRecord }));

vi.mock('./image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./image')>();
  return {
    ...actual,
    downscaleImage: vi.fn(async (image: ArtworkImage) => image),
  };
});

const image = (kind: ArtworkImage['kind'], index = 0): ArtworkImage => ({
  blob: new Blob([`${kind}-${index}`], { type: 'image/png' }),
  fileName: `game-${kind}-${index}.png`,
  kind,
});

function providerWith(result: ArtworkResult): ArtworkProvider {
  return { id: 'test-provider', fetchArtwork: vi.fn(async () => result) };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateRecord.mockResolvedValue({});
});

describe('buildArtworkPayload', () => {
  it('caps screenshots at five and keeps the cover', async () => {
    const provider = providerWith({
      cover: image('boxart'),
      screenshots: Array.from({ length: 7 }, (_, index) => image('snap', index)),
    });

    const payload = await buildArtworkPayload('Game', { provider });

    expect(payload?.cover?.kind).toBe('boxart');
    expect(payload?.screenshots).toHaveLength(5);
  });

  it('skips the cover while refreshing after a manual override', async () => {
    const provider = providerWith({
      cover: image('boxart'),
      screenshots: [image('title')],
    });

    const payload = await buildArtworkPayload('Game', { provider, skipCover: true });

    expect(payload?.cover).toBeNull();
    expect(payload?.screenshots).toHaveLength(1);
  });

  it('returns null when nothing usable was produced', async () => {
    const provider = providerWith({ cover: null, screenshots: [] });

    await expect(buildArtworkPayload('Game', { provider })).resolves.toBeNull();
  });

  it('skips individual images that fail to decode', async () => {
    vi.mocked(downscaleImage)
      .mockResolvedValueOnce(image('boxart'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(image('snap'));

    const provider = providerWith({
      cover: image('boxart'),
      screenshots: [image('title'), image('snap')],
    });

    const payload = await buildArtworkPayload('Game', { provider });
    expect(payload?.screenshots).toHaveLength(1);
  });
});

describe('applyArtwork', () => {
  it('uploads cover + screenshots with provenance', async () => {
    const provider = providerWith({
      cover: image('boxart'),
      screenshots: [image('title'), image('snap')],
    });

    await expect(applyArtwork('g1', 'Super Mario World (USA)', { provider })).resolves.toBe(true);

    const [collection, id, fields, files] = updateRecord.mock.calls[0]!;
    expect(collection).toBe('games');
    expect(id).toBe('g1');
    expect(fields.metadata_source).toBe('test-provider');
    expect(fields.metadata_id).toBe('Super Mario World (USA)');
    expect(fields.scraped_at).toMatch(/^\d{4}-\d{2}-\d{2} /);
    expect((files.cover_image as File).name).toBe('game-boxart-0.png');
    expect((files.screenshots as File[]).map((file) => file.name)).toEqual([
      'game-title-0.png',
      'game-snap-0.png',
    ]);
  });

  it('does not touch the record when nothing was fetched', async () => {
    const provider = providerWith({ cover: null, screenshots: [] });

    await expect(applyArtwork('g1', 'Game', { provider })).resolves.toBe(false);
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it('returns false instead of throwing on transport errors', async () => {
    updateRecord.mockRejectedValue(new Error('offline'));

    await expect(
      applyArtwork('g1', 'Game', {
        provider: providerWith({ cover: image('boxart'), screenshots: [] }),
      }),
    ).resolves.toBe(false);
  });

  it('skips the cover for a manual-override refresh', async () => {
    const provider = providerWith({
      cover: image('boxart'),
      screenshots: [image('title')],
    });

    await applyArtwork('g1', 'Game', { provider, skipCover: true });

    const files = updateRecord.mock.calls[0]![3];
    expect(files.cover_image).toBeUndefined();
    expect(files.screenshots).toHaveLength(1);
  });
});

describe('provenanceFields', () => {
  it('records the provider, exact name, and timestamp', () => {
    const fields = provenanceFields(
      { id: 'libretro-thumbnails', fetchArtwork: vi.fn() },
      'Game (USA)',
    );

    expect(fields.metadata_source).toBe('libretro-thumbnails');
    expect(fields.metadata_id).toBe('Game (USA)');
    expect(fields.scraped_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  });
});

describe('uploadManualCover', () => {
  it('stores the cover and marks provenance as manual', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'cover.png', { type: 'image/png' });

    await uploadManualCover('g1', file);

    expect(updateRecord).toHaveBeenCalledWith(
      'games',
      'g1',
      { metadata_source: 'manual' },
      { cover_image: file },
    );
  });
});
