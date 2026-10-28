import { imageNameStem, thumbnailUrl, type ArtworkKind } from '@/lib/thumbnails';

export interface ArtworkImage {
  blob: Blob;
  fileName: string;
  kind: ArtworkKind;
}

export interface ArtworkResult {
  cover: ArtworkImage | null;
  /** Ordered: title screen first, then in-game snaps. */
  screenshots: ArtworkImage[];
}

export interface ArtworkProvider {
  readonly id: string;
  /** Never rejects: missing/failed images resolve to empty results. */
  fetchArtwork(noIntroName: string): Promise<ArtworkResult>;
}

export type ArtworkFetcher = (url: string) => Promise<Response>;

async function fetchImage(
  fetchImpl: ArtworkFetcher,
  noIntroName: string,
  kind: ArtworkKind,
): Promise<ArtworkImage | null> {
  try {
    const response = await fetchImpl(thumbnailUrl(noIntroName, kind));
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return null;

    const blob = await response.blob();
    if (blob.size === 0) return null;

    return {
      blob,
      fileName: `${imageNameStem(noIntroName)}-${kind}.png`,
      kind,
    };
  } catch {
    return null;
  }
}

/** libretro-thumbnails provider: exact No-Intro name, no API key. */
export function createLibretroProvider(
  fetchImpl: ArtworkFetcher = (url) => fetch(url),
): ArtworkProvider {
  return {
    id: 'libretro-thumbnails',

    async fetchArtwork(noIntroName: string): Promise<ArtworkResult> {
      const [boxart, title, snap] = await Promise.all([
        fetchImage(fetchImpl, noIntroName, 'boxart'),
        fetchImage(fetchImpl, noIntroName, 'title'),
        fetchImage(fetchImpl, noIntroName, 'snap'),
      ]);

      return {
        cover: boxart,
        screenshots: [title, snap].filter((image): image is ArtworkImage => image !== null),
      };
    },
  };
}

export const libretroProvider = createLibretroProvider();
