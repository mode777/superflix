import { updateRecord } from '@/admin/lib/upload';
import { downscaleImage, MAX_COVER_WIDTH, MAX_SCREENSHOTS, MAX_SCREENSHOT_WIDTH, toFile } from './image';
import { libretroProvider, type ArtworkImage, type ArtworkProvider } from './provider';

export interface ArtworkOptions {
  provider?: ArtworkProvider;
  /** Keep the existing (manual) cover and only refresh screenshots/provenance. */
  skipCover?: boolean;
}

export interface ArtworkPayload {
  cover: ArtworkImage | null;
  screenshots: ArtworkImage[];
}

/**
 * Fetch artwork by exact No-Intro name and downscale it to catalog quality.
 * Returns null when nothing usable was produced, so imports can degrade.
 */
export async function buildArtworkPayload(
  noIntroName: string,
  options: ArtworkOptions = {},
): Promise<ArtworkPayload | null> {
  const provider = options.provider ?? libretroProvider;
  const result = await provider.fetchArtwork(noIntroName);

  const cover =
    !options.skipCover && result.cover
      ? await downscaleImage(result.cover, MAX_COVER_WIDTH)
      : null;

  const screenshots: ArtworkImage[] = [];
  for (const candidate of result.screenshots.slice(0, MAX_SCREENSHOTS)) {
    const scaled = await downscaleImage(candidate, MAX_SCREENSHOT_WIDTH);
    if (scaled) screenshots.push(scaled);
  }

  if (!cover && screenshots.length === 0) return null;
  return { cover, screenshots };
}

/** Provenance written whenever artwork is scraped. */
export function provenanceFields(
  provider: ArtworkProvider,
  noIntroName: string,
): Record<string, string> {
  return {
    metadata_source: provider.id,
    metadata_id: noIntroName,
    scraped_at: new Date().toISOString().replace('T', ' '),
  };
}

/**
 * Attach artwork to an existing game record. Never throws: artwork is an
 * enhancement, so failures return false and leave the record untouched.
 */
export async function applyArtwork(
  gameId: string,
  noIntroName: string | undefined,
  options: ArtworkOptions = {},
): Promise<boolean> {
  if (!noIntroName) return false;

  try {
    const payload = await buildArtworkPayload(noIntroName, options);
    if (!payload) return false;

    const files: Record<string, Blob | Blob[]> = {};
    if (payload.cover) files.cover_image = toFile(payload.cover);
    if (payload.screenshots.length > 0) {
      files.screenshots = payload.screenshots.map(toFile);
    }

    await updateRecord(
      'games',
      gameId,
      provenanceFields(options.provider ?? libretroProvider, noIntroName),
      files,
    );
    return true;
  } catch {
    return false;
  }
}

/** Manual cover override: provenance switches to `manual`. */
export async function uploadManualCover(gameId: string, file: File): Promise<void> {
  await updateRecord('games', gameId, { metadata_source: 'manual' }, { cover_image: file });
}
