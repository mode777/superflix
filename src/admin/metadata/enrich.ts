import { mapDatasetRecord, type DatasetRecord } from '@/lib/snes-dataset';
import type { Region } from '@/types/games';
import { updateRecord, type MultipartValue } from '@/admin/lib/upload';
import {
  downscaleImage,
  MAX_COVER_WIDTH,
  MAX_SCREENSHOTS,
  MAX_SCREENSHOT_WIDTH,
  toFile,
} from './image';
import type { ArtworkImage } from './provider';
import { buildArtworkPayload } from './artwork';
import {
  fetchDatasetImages,
  fetchDatasetRecord,
  resolveDatasetSlug,
  type DatasetFetcher,
  type DatasetImage,
} from './dataset';

export interface EnrichGameInput {
  id: string;
  /** Stored headerless CRC32 (`games.rom_crc32`). Checked before any title lookup. */
  crc32?: string;
  title: string;
  region?: Region;
  /** Explicitly chosen dataset slug (manual match): skips resolution entirely. */
  slug?: string;
  /** Dataset slug recorded by a previous enrichment; verified before reuse. */
  metadataId?: string;
  /** Exact No-Intro name, used only for the complementary libretro artwork fallback. */
  noIntroName?: string;
  /** True when `metadata_source` is `manual`: never touch the cover. */
  manualCover?: boolean;
}

export interface EnrichmentResult {
  /** The game was identified in the dataset. */
  resolved: boolean;
  metadata: boolean;
  cover: boolean;
  screenshots: number;
  /** The dataset could not be reached (as opposed to the game not being in it). */
  unavailable?: boolean;
}

const defaultFetcher: DatasetFetcher = (url) => fetch(url);

const noResult: EnrichmentResult = { resolved: false, metadata: false, cover: false, screenshots: 0 };

/** The `roms[].file` entries are No-Intro filenames — exactly what libretro-thumbnails indexes. */
function noIntroNameFromRecord(record: DatasetRecord, crc32?: string): string | null {
  const roms = Array.isArray(record.roms) ? record.roms : [];
  const checksum = crc32?.trim().toUpperCase();
  const match = checksum
    ? roms.find((rom) => typeof rom?.crc32 === 'string' && rom.crc32.toUpperCase() === checksum)
    : undefined;
  const file = match?.file ?? roms[0]?.file;
  if (typeof file !== 'string' || file === '') return null;
  return file.replace(/\.[a-z0-9]+$/i, '');
}

/** Dataset image kinds (`thumb`/`box`/`snap`) onto the provider's artwork kinds. */
function toArtwork(image: DatasetImage): ArtworkImage {
  return {
    blob: image.blob,
    fileName: image.fileName,
    kind: image.kind === 'snap' ? 'snap' : 'boxart',
  };
}

async function downscale(image: DatasetImage | null, maxWidth: number): Promise<ArtworkImage | null> {
  if (!image) return null;
  return downscaleImage(toArtwork(image), maxWidth);
}

async function applyRecord(
  input: EnrichGameInput,
  slug: string,
  record: DatasetRecord,
  fetcher: DatasetFetcher,
): Promise<EnrichmentResult> {
  // Only non-empty dataset values are written: an import would overwrite them
  // with the same identification defaults anyway, and a sync must not wipe a
  // field the dataset does not cover.
  const mapped = mapDatasetRecord(record, input.region ?? 'NTSC-U');
  const fields = Object.fromEntries(
    Object.entries(mapped).filter(([, value]) => value !== ''),
  ) as Record<string, MultipartValue>;
  const metadata = Object.keys(fields).length > 0;

  const datasetImages = await fetchDatasetImages(slug, record.images, fetcher);
  // Cover order (spec: big box preferred over thumbnail): dataset box first,
  // then the complementary provider's boxart, and the small thumb only when
  // neither yields a cover.
  const boxImage = datasetImages.find((image) => image.kind === 'box') ?? null;
  const thumbImage = datasetImages.find((image) => image.kind === 'thumb') ?? null;
  const snap = datasetImages.find((image) => image.kind === 'snap') ?? null;
  let finalCover = input.manualCover ? null : await downscale(boxImage, MAX_COVER_WIDTH);
  const screenshots: ArtworkImage[] = [];
  const scaledSnap = await downscale(snap, MAX_SCREENSHOT_WIDTH);
  if (scaledSnap) screenshots.push(scaledSnap);

  // Complementary provider fills what the dataset lacks: extra screenshots
  // (title screen) and the cover when the dataset has no big box.
  if (!input.manualCover && (!finalCover || screenshots.length < MAX_SCREENSHOTS)) {
    const fallbackName = noIntroNameFromRecord(record, input.crc32) ?? input.title;
    const fallback = await buildArtworkPayload(fallbackName, { skipCover: Boolean(finalCover) });
    if (fallback) {
      if (!finalCover && fallback.cover) finalCover = fallback.cover;
      for (const image of fallback.screenshots) {
        if (screenshots.length >= MAX_SCREENSHOTS) break;
        screenshots.push(image);
      }
    }
  }

  if (!input.manualCover && !finalCover && thumbImage) {
    finalCover = await downscale(thumbImage, MAX_COVER_WIDTH);
  }

  if (!metadata && !finalCover && screenshots.length === 0) {
    return { resolved: true, metadata: false, cover: false, screenshots: 0 };
  }

  // A manual override keeps its `metadata_source: manual` marker; only the
  // other fields and images are refreshed (spec: manual cover override).
  const provenance: Record<string, MultipartValue> = {
    metadata_id: slug,
    scraped_at: new Date().toISOString().replace('T', ' '),
  };
  if (!input.manualCover) provenance.metadata_source = 'snes-dataset';

  await updateRecord('games', input.id, {
    ...fields,
    ...provenance,
  }, {
    ...(finalCover ? { cover_image: toFile(finalCover) } : {}),
    ...(screenshots.length > 0 ? { screenshots: screenshots.map(toFile) } : {}),
  });

  return {
    resolved: true,
    metadata,
    cover: Boolean(finalCover),
    screenshots: screenshots.length,
  };
}

/**
 * Enrich one catalog game from snes-dataset, with libretro-thumbnails filling
 * artwork gaps. Never throws: every outcome — including network failure —
 * resolves to a reportable result (spec: enrichment never blocks catalog writes).
 */
export async function enrichGame(
  input: EnrichGameInput,
  options: { fetcher?: DatasetFetcher } = {},
): Promise<EnrichmentResult> {
  const fetcher = options.fetcher ?? defaultFetcher;

  try {
    // An explicit manual match skips resolution entirely: the admin chose this
    // slug, so a missing record reports "not in dataset" instead of silently
    // resolving elsewhere.
    if (input.slug) {
      const chosen = await fetchDatasetRecord(input.slug, fetcher);
      if (!chosen) return noResult;
      return await applyRecord(input, input.slug, chosen, fetcher);
    }

    // A slug from a previous run is verified first; stale slugs (including
    // pre-dataset records whose metadata_id holds a No-Intro name) fall
    // through to checksum lookup.
    if (input.metadataId) {
      const record = await fetchDatasetRecord(input.metadataId, fetcher);
      if (record) return applyRecord(input, input.metadataId!, record, fetcher);
    }

    const slug = await resolveDatasetSlug(input.crc32, input.title, fetcher);
    if (!slug) return noResult;

    const record = await fetchDatasetRecord(slug, fetcher);
    if (!record) return { resolved: true, metadata: false, cover: false, screenshots: 0 };

    return await applyRecord(input, slug, record, fetcher);
  } catch {
    return { ...noResult, unavailable: true };
  }
}

/** Human-readable summary for toasts. */
export function describeEnrichment(result: EnrichmentResult | undefined): string {
  if (!result) return 'enrichment unavailable';
  if (result.unavailable) return 'dataset unreachable';
  if (!result.resolved) return 'not in dataset';
  const parts: string[] = [];
  if (result.metadata) parts.push('metadata');
  if (result.cover) parts.push('cover');
  if (result.screenshots > 0) {
    parts.push(`${result.screenshots} screenshot${result.screenshots === 1 ? '' : 's'}`);
  }
  return parts.length > 0 ? parts.join(' + ') : 'no dataset data';
}
