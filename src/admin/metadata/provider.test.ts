// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createLibretroProvider } from './provider';

function imageResponse(): Response {
  return new Response(new Blob(['png-bytes'], { type: 'image/png' }), {
    status: 200,
    headers: { 'content-type': 'image/png' },
  });
}

describe('libretro artwork provider', () => {
  it('maps boxart to the cover and title/snap to ordered screenshots', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('Named_Boxarts')) return imageResponse();
      if (url.includes('Named_Titles')) return imageResponse();
      return imageResponse();
    });

    const provider = createLibretroProvider(fetchImpl);
    const result = await provider.fetchArtwork('Super Mario World (USA)');

    expect(provider.id).toBe('libretro-thumbnails');
    expect(result.cover?.kind).toBe('boxart');
    expect(result.screenshots.map((image) => image.kind)).toEqual(['title', 'snap']);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('never rejects when the host is unreachable', async () => {
    const provider = createLibretroProvider(async () => {
      throw new Error('network down');
    });

    await expect(provider.fetchArtwork('Game')).resolves.toEqual({
      cover: null,
      screenshots: [],
    });
  });

  it('ignores missing files and non-image responses', async () => {
    const provider = createLibretroProvider(async () =>
      new Response('not an image', { status: 200, headers: { 'content-type': 'text/html' } }),
    );

    await expect(provider.fetchArtwork('Game')).resolves.toEqual({
      cover: null,
      screenshots: [],
    });
  });

  it('treats 404 as no artwork', async () => {
    const provider = createLibretroProvider(
      async () => new Response('', { status: 404 }),
    );

    await expect(provider.fetchArtwork('Game')).resolves.toEqual({
      cover: null,
      screenshots: [],
    });
  });
});
