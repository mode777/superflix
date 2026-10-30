// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { fetchDatasetImages, fetchDatasetRecord, listDatasetTitles, resolveDatasetSlug } from './dataset';
import { DATASET_BASE_URL } from '@/lib/snes-dataset';

const base = DATASET_BASE_URL;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function imageResponse(): Response {
  return new Response(new Blob(['png'], { type: 'image/png' }), {
    status: 200,
    headers: { 'content-type': 'image/png' },
  });
}

describe('resolveDatasetSlug', () => {
  it('resolves by checksum without loading the title index', async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe(`${base}/by-crc.json`);
      return jsonResponse({ '2D206BF7': 'chrono-trigger' });
    });

    await expect(resolveDatasetSlug('2d206bf7', 'Chrono Trigger', fetcher)).resolves.toBe(
      'chrono-trigger',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('falls back to the title index when the checksum is unknown', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('by-crc.json')) return jsonResponse({});
      expect(url).toBe(`${base}/index.json`);
      return jsonResponse({ 'Chrono Trigger': 'chrono-trigger' });
    });

    await expect(
      resolveDatasetSlug('FFFFFFFF', 'Chrono Trigger (USA) (Rev 1)', fetcher),
    ).resolves.toBe('chrono-trigger');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('matches display-title keys against the published index shape', async () => {
    // Regression: the published index.json maps display titles to slugs, so a
    // slugified key access never hits; matching must normalize both sides.
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('by-crc.json')) return jsonResponse({});
      return jsonResponse({
        '2020 Super Baseball': '2020-super-baseball',
        'Super Metroid': 'super-metroid',
      });
    });

    await expect(
      resolveDatasetSlug(undefined, 'super metroid (Japan, USA) [!]', fetcher),
    ).resolves.toBe('super-metroid');
  });

  it('applies the article fix when matching titles', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('by-crc.json')) return jsonResponse({});
      return jsonResponse({ 'Combatribes, The': 'the-combatribes' });
    });

    await expect(resolveDatasetSlug(undefined, 'Combatribes, The (USA)', fetcher)).resolves.toBe(
      'the-combatribes',
    );
  });

  it('matches a leading-article title against a trailing-article index key', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('by-crc.json')) return jsonResponse({});
      return jsonResponse({ 'Combatribes, The': 'the-combatribes' });
    });

    await expect(resolveDatasetSlug(undefined, 'The Combatribes (USA)', fetcher)).resolves.toBe(
      'the-combatribes',
    );
  });

  it('returns null when neither lookup matches', async () => {
    const fetcher = vi.fn(async () => jsonResponse({}));

    await expect(resolveDatasetSlug('AAAAAAAA', 'Unknown Game', fetcher)).resolves.toBeNull();
  });

  it('rejects when an index cannot be fetched', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('network down');
    });

    await expect(resolveDatasetSlug('AAAAAAAA', 'Game', fetcher)).rejects.toThrow('network down');
  });

  it('rejects when an index returns a non-OK status', async () => {
    const fetcher = vi.fn(async () => jsonResponse({}, 500));

    await expect(resolveDatasetSlug('AAAAAAAA', 'Game', fetcher)).rejects.toThrow('HTTP 500');
  });

  it('caches the indexes per fetcher across calls', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('by-crc.json')) return jsonResponse({ '2D206BF7': 'chrono-trigger' });
      return jsonResponse({});
    });

    await resolveDatasetSlug('2D206BF7', 'A', fetcher);
    await resolveDatasetSlug('2D206BF7', 'B', fetcher);
    await resolveDatasetSlug('AAAAAAAA', 'C', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2); // by-crc once, index once
  });
});

describe('listDatasetTitles', () => {
  it('lists the title index sorted alphabetically', async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe(`${base}/index.json`);
      return jsonResponse({
        'Zoop!': 'zoop',
        'Chrono Trigger': 'chrono-trigger',
        '2020 Super Baseball': '2020-super-baseball',
      });
    });

    await expect(listDatasetTitles(fetcher)).resolves.toEqual([
      { title: '2020 Super Baseball', slug: '2020-super-baseball' },
      { title: 'Chrono Trigger', slug: 'chrono-trigger' },
      { title: 'Zoop!', slug: 'zoop' },
    ]);
  });

  it('reuses the cached index across calls', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ 'Chrono Trigger': 'chrono-trigger' }));

    await listDatasetTitles(fetcher);
    await listDatasetTitles(fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects when the index cannot be fetched', async () => {
    const fetcher = vi.fn(async () => jsonResponse({}, 503));

    await expect(listDatasetTitles(fetcher)).rejects.toThrow('HTTP 503');
  });
});

describe('fetchDatasetRecord', () => {
  it('parses the record', async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe(`${base}/chrono-trigger/data.json`);
      return jsonResponse({ title: 'Chrono Trigger', description: 'Time travel RPG' });
    });

    await expect(fetchDatasetRecord('chrono-trigger', fetcher)).resolves.toMatchObject({
      title: 'Chrono Trigger',
    });
  });

  it('maps 404 to null', async () => {
    const fetcher = vi.fn(async () => jsonResponse({}, 404));

    await expect(fetchDatasetRecord('missing', fetcher)).resolves.toBeNull();
  });

  it('rejects on other error statuses', async () => {
    const fetcher = vi.fn(async () => jsonResponse({}, 503));

    await expect(fetchDatasetRecord('chrono-trigger', fetcher)).rejects.toThrow('HTTP 503');
  });
});

describe('fetchDatasetImages', () => {
  it('downloads only advertised image files', async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url.startsWith(`${base}/chrono-trigger/`)).toBe(true);
      return imageResponse();
    });

    const images = await fetchDatasetImages(
      'chrono-trigger',
      { thumb: 'thumb.png', snap: 'snap.png' },
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(images.map((image) => image.kind)).toEqual(['thumb', 'snap']);
    expect(images[0]?.fileName).toBe('chrono-trigger-thumb.png');
  });

  it('skips missing and non-image responses', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('thumb.png')) return new Response('', { status: 404 });
      if (url.endsWith('box.jpeg')) {
        return new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } });
      }
      return imageResponse();
    });

    const images = await fetchDatasetImages(
      'chrono-trigger',
      { thumb: 'thumb.png', box: 'box.jpeg', snap: 'snap.png' },
      fetcher,
    );

    expect(images.map((image) => image.kind)).toEqual(['snap']);
  });

  it('resolves to an empty list when the record has no images', async () => {
    const fetcher = vi.fn();

    await expect(fetchDatasetImages('game', undefined, fetcher)).resolves.toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('skips an image whose request fails without rejecting', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('thumb.png')) throw new Error('network down');
      return imageResponse();
    });

    const images = await fetchDatasetImages('game', { thumb: 'thumb.png', snap: 'snap.png' }, fetcher);

    expect(images.map((image) => image.kind)).toEqual(['snap']);
  });
});
