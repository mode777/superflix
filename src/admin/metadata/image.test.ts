// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downscaleImage, fitDimensions } from './image';
import type { ArtworkImage } from './provider';

const image: ArtworkImage = {
  blob: new Blob(['x'], { type: 'image/png' }),
  fileName: 'super-mario-world-usa-boxart.png',
  kind: 'boxart',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fitDimensions', () => {
  it('keeps small images untouched', () => {
    expect(fitDimensions(320, 240, 640)).toEqual({ width: 320, height: 240 });
  });

  it('scales down preserving aspect ratio', () => {
    expect(fitDimensions(1280, 960, 640)).toEqual({ width: 640, height: 480 });
  });

  it('handles invalid dimensions', () => {
    expect(fitDimensions(0, 240, 640)).toEqual({ width: 0, height: 0 });
  });
});

describe('downscaleImage', () => {
  it('returns null when the image cannot be decoded (degradation)', async () => {
    vi.stubGlobal('createImageBitmap', undefined);

    await expect(downscaleImage(image, 640)).resolves.toBeNull();
  });

  it('re-encodes to WebP at the requested width', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 1280, height: 960, close: vi.fn() })),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback: BlobCallback) => callback(new Blob(['webp'], { type: 'image/webp' })),
    );

    const result = await downscaleImage(image, 640);

    expect(result?.blob.type).toBe('image/webp');
    expect(result?.fileName).toBe('super-mario-world-usa-boxart.webp');
    expect(result?.kind).toBe('boxart');
  });

  it('returns null when encoding produces nothing', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 1280, height: 960, close: vi.fn() })),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback: BlobCallback) => callback(null),
    );

    await expect(downscaleImage(image, 640)).resolves.toBeNull();
  });
});
