/**
 * jsDelivr mirror of the libretro-thumbnails GitHub repository. The primary
 * host (thumbnails.libretro.com) sends no CORS headers, so browser fetches
 * fail; this mirror serves the identical files with `access-control-allow-origin: *`.
 * raw.githubusercontent.com (same repository) is a verified backup mirror.
 */
export const LIBRETRO_THUMBNAIL_BASE =
  'https://cdn.jsdelivr.net/gh/libretro-thumbnails/Nintendo_-_Super_Nintendo_Entertainment_System@master';

export const LIBRETRO_THUMBNAIL_SYSTEM = 'Nintendo - Super Nintendo Entertainment System';

export type ArtworkKind = 'boxart' | 'snap' | 'title';

const KIND_DIRECTORIES: Record<ArtworkKind, string> = {
  boxart: 'Named_Boxarts',
  snap: 'Named_Snaps',
  title: 'Named_Titles',
};

/**
 * libretro-thumbnails URL for a No-Intro name. The name must be used exactly
 * (only URL-encoded), because the host stores files by the DAT name.
 */
export function thumbnailUrl(
  noIntroName: string,
  kind: ArtworkKind,
  base: string = LIBRETRO_THUMBNAIL_BASE,
): string {
  const encoded = encodeURIComponent(noIntroName).replace(/'/g, '%27');
  return `${base.replace(/\/$/, '')}/${KIND_DIRECTORIES[kind]}/${encoded}.png`;
}

/** A filesystem-safe stem for uploaded image names. */
export function imageNameStem(noIntroName: string): string {
  return (
    noIntroName
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'artwork'
  );
}
