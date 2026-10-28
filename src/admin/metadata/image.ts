import type { ArtworkImage } from './provider';

export const MAX_COVER_WIDTH = 640;
export const MAX_SCREENSHOT_WIDTH = 640;
export const MAX_SCREENSHOTS = 5;

/** Scale dimensions down to `maxWidth`, preserving the aspect ratio. */
export function fitDimensions(
  width: number,
  height: number,
  maxWidth: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0 || maxWidth <= 0) return { width: 0, height: 0 };
  if (width <= maxWidth) return { width, height };

  return {
    width: maxWidth,
    height: Math.max(1, Math.round((height * maxWidth) / width)),
  };
}

/**
 * Re-encode an image at catalog quality (WebP, max width) via canvas.
 * Returns null when the browser cannot decode/encode the image; callers skip
 * the image and keep the rest of the artwork.
 */
export async function downscaleImage(
  image: ArtworkImage,
  maxWidth: number,
): Promise<ArtworkImage | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return null;

  try {
    const bitmap = await createImageBitmap(image.blob);
    const size = fitDimensions(bitmap.width, bitmap.height, maxWidth);
    if (!size.width || !size.height) return null;

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;

    const context = canvas.getContext('2d');
    if (!context) return null;

    context.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.82),
    );
    if (!blob) return null;

    return {
      ...image,
      blob,
      fileName: `${image.fileName.replace(/\.[^.]+$/, '')}.webp`,
    };
  } catch {
    return null;
  }
}

/** Wrap a processed image as an uploadable File (keeps the extension/mime). */
export function toFile(image: ArtworkImage): File {
  return new File([image.blob], image.fileName, {
    type: image.blob.type || 'image/webp',
  });
}
