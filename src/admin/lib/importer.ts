import { deriveRegion, deriveSlug, titleFromIdentification } from '@/features/games/slug';
import { stripCopierHeader } from '@/lib/snes/copier';
import { hashRom } from '@/lib/snes/hash';
import { parseSnesHeader } from '@/lib/snes/header';
import type { RomIdentification, SnesHeader } from '@/lib/snes/types';
import type { Region } from '@/types/games';
import { adminClient } from './pb';
import { AuthExpiredError, updateRecord, uploadRecord, type MultipartValue, type UploadProgress } from './upload';
import { toFile } from '../metadata/image';
import type { ArtworkImage } from '../metadata/provider';

export interface CatalogGameRecord {
  id: string;
  slug: string;
  title: string;
}

export type ImportDisposition =
  | { kind: 'create' }
  | { kind: 'duplicate'; game: CatalogGameRecord }
  | { kind: 'variant'; game: CatalogGameRecord };

export interface CatalogDraft {
  title: string;
  slug: string;
  region: Region;
  genre: string;
  developer: string;
  publisher: string;
  release: string;
  description: string;
  players: string;
  crc32: string;
  md5: string;
  sha1: string;
  size: number;
  header: SnesHeader | null;
  revision: number;
}

type RecordLike = Record<string, unknown>;

function summarize(record: RecordLike): CatalogGameRecord {
  return {
    id: String(record.id ?? ''),
    slug: String(record.slug ?? ''),
    title: String(record.title ?? ''),
  };
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { status?: number }).status === 404
  );
}

async function findGame(filter: string): Promise<CatalogGameRecord | null> {
  try {
    return summarize(await adminClient.collection('games').getFirstListItem(filter));
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/**
 * Decide whether an import should create a game, open an existing one (same
 * CRC32), or attach a regional variant (same slug, different CRC32).
 */
export async function precheckImport(slug: string, crc32: string): Promise<ImportDisposition> {
  const byCrc = await findGameByCrc(crc32);
  if (byCrc) return { kind: 'duplicate', game: byCrc };

  const bySlug = await findGame(adminClient.filter('slug = {:value}', { value: slug }));
  if (bySlug) return { kind: 'variant', game: bySlug };

  return { kind: 'create' };
}

/** Catalog lookup by headerless CRC32, used by the staging scan to flag known ROMs. */
export async function findGameByCrc(crc32: string): Promise<CatalogGameRecord | null> {
  return findGame(adminClient.filter('rom_crc32 = {:value}', { value: crc32 }));
}

/** Build catalog values from an identification result (pure, testable). */
export function buildCatalogDraft(
  result: RomIdentification,
  fallbackName: string,
): CatalogDraft {
  const fields = result.match?.fields ?? {};
  const title = titleFromIdentification(result.match?.name, result.header?.title, fallbackName);
  const year = fields.releaseyear?.slice(0, 4) ?? '';
  const players = fields.maxusers ?? fields.users ?? '';

  return {
    title,
    slug: deriveSlug(result.match?.name ?? title, result.hashes.crc32),
    region: deriveRegion(result.match?.region, result.header?.region),
    genre: fields.genre ?? 'Unknown',
    developer: fields.developer ?? '',
    publisher: fields.publisher ?? '',
    release: year ? `${year}-01-01 00:00:00.000Z` : '',
    description: '',
    players,
    crc32: result.hashes.crc32,
    md5: result.hashes.md5,
    sha1: result.hashes.sha1,
    size: result.normalizedSize,
    header: result.header,
    revision: result.header?.version ?? 0,
  };
}

/** PocketBase `games` fields for a draft (JSON parts are serialized). */
export function toGameFields(draft: CatalogDraft): Record<string, MultipartValue> {
  const fields: Record<string, MultipartValue> = {
    title: draft.title,
    slug: draft.slug,
    region: draft.region,
    genre: draft.genre,
    developer: draft.developer,
    publisher: draft.publisher,
    description: draft.description,
    players: draft.players,
    rom_crc32: draft.crc32,
    rom_md5: draft.md5,
    rom_sha1: draft.sha1,
    rom_size: draft.size,
  };

  if (draft.release) fields.release = draft.release;
  if (draft.header) fields.rom_header = JSON.stringify(draft.header);

  return fields;
}

/** PocketBase `roms` fields for a draft. */
export function toRomFields(
  draft: CatalogDraft,
  gameId: string,
  isPrimary: boolean,
): Record<string, MultipartValue> {
  return {
    game: gameId,
    region: draft.region,
    revision: draft.revision,
    crc32: draft.crc32,
    md5: draft.md5,
    sha1: draft.sha1,
    size: draft.size,
    is_primary: isPrimary,
    ...(draft.header ? { header: JSON.stringify(draft.header) } : {}),
  };
}

function normalizedFile(bytes: Uint8Array, slug: string): File {
  const { rom } = stripCopierHeader(bytes);
  return new File([rom as unknown as BlobPart], `${slug}.sfc`, {
    type: 'application/octet-stream',
  });
}

/** A draft staged for review: editable values plus the held identification, file, and previewed artwork. */
export interface StagedDraft {
  /** Catalog values as reviewed (identification defaults, dataset preview, admin edits). */
  values: CatalogDraft;
  identification: RomIdentification;
  file: File;
  /** Dataset slug the preview resolved to; records the enrichment provenance at commit. */
  metadataId?: string;
  /** Previewed cover to store at commit (null when the dataset had none). */
  cover?: ArtworkImage | null;
  /** Previewed screenshots to store at commit. */
  screenshots?: ArtworkImage[];
}

/**
 * Create a catalog record from a staged draft as reviewed: edited field values
 * take precedence over dataset values, and the previewed artwork is uploaded
 * in the same multipart request as the ROM.
 */
export async function createCatalogRecord(
  draft: StagedDraft,
  onProgress?: UploadProgress,
): Promise<{ game: CatalogGameRecord }> {
  const values = draft.values;
  const normalized = normalizedFile(new Uint8Array(await draft.file.arrayBuffer()), values.slug);

  const created = await uploadRecord<RecordLike>(
    'games',
    {
      ...toGameFields(values),
      // Provenance records the dataset resolution the reviewed draft came from.
      ...(draft.metadataId
        ? {
            metadata_source: 'snes-dataset',
            metadata_id: draft.metadataId,
            scraped_at: new Date().toISOString().replace('T', ' '),
          }
        : {}),
    },
    {
      rom: normalized,
      ...(draft.cover ? { cover_image: toFile(draft.cover) } : {}),
      ...(draft.screenshots && draft.screenshots.length > 0
        ? { screenshots: draft.screenshots.map(toFile) }
        : {}),
    },
    onProgress,
  );
  const game = summarize(created);

  await adminClient.collection('roms').create(toRomFields(values, game.id, true));

  return { game };
}

/** Attach a staged draft's ROM as an additional regional/revision variant. */
export async function attachVariant(
  game: CatalogGameRecord,
  draft: StagedDraft,
  onProgress?: UploadProgress,
): Promise<{ game: CatalogGameRecord }> {
  const values = draft.values;
  const suffix = `${values.slug}-${values.region.toLowerCase()}-rev${values.revision}`;
  const normalized = normalizedFile(new Uint8Array(await draft.file.arrayBuffer()), suffix);

  await uploadRecord(
    'roms',
    toRomFields(values, game.id, false),
    { file: normalized },
    onProgress,
  );

  return { game };
}

/** Replace a game's ROM file and update its checksum/size fields. */
export async function replaceGameRom(
  gameId: string,
  file: File,
  onProgress?: UploadProgress,
): Promise<void> {
  const { rom } = stripCopierHeader(new Uint8Array(await file.arrayBuffer()));
  const hashes = await hashRom(rom);
  const header = parseSnesHeader(rom);

  await updateRecord(
    'games',
    gameId,
    {
      rom_crc32: hashes.crc32,
      rom_md5: hashes.md5,
      rom_sha1: hashes.sha1,
      rom_size: rom.length,
      ...(header ? { rom_header: JSON.stringify(header) } : {}),
    },
    {
      rom: new File([rom as unknown as BlobPart], `${gameId}.sfc`, {
        type: 'application/octet-stream',
      }),
    },
    onProgress,
  );
}

/** A queued draft as handed to the batch commit. */
export interface StagedItem {
  id: string;
  draft: StagedDraft;
}

export interface CommitEvents {
  /** Upload percent (0–100) of one entry's multipart request. */
  onEntryProgress?: (id: string, percent: number) => void;
  /** Batch fraction (0–1): finished entries plus the running upload's share. */
  onTotalProgress?: (fraction: number) => void;
  /** Commit-phase transition of one entry. */
  onEntryState?: (
    id: string,
    status: 'uploading' | 'done' | 'duplicate' | 'variant' | 'error',
    data?: { error?: string; result?: { slug: string; title: string } },
  ) => void;
}

export interface CommitSummary {
  added: number;
  duplicates: number;
  variants: number;
  failed: number;
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : 'Could not add the ROM to the catalog.';

/**
 * Commit staged drafts one at a time (so the single in-flight multipart upload
 * maps onto the per-game progress bar), applying the duplicate/variant rules
 * per entry. One entry failing marks only that entry `error`; an expired
 * admin session stops the rest of the batch, which would all fail the same way.
 */
export async function commitStagedDrafts(
  items: StagedItem[],
  events: CommitEvents = {},
): Promise<CommitSummary> {
  const summary: CommitSummary = { added: 0, duplicates: 0, variants: 0, failed: 0 };
  /** CRC32s committed earlier in this very batch, so the same ROM twice in a folder cannot create two records. */
  const batchGames = new Map<string, CatalogGameRecord>();
  const total = items.length;

  for (const [index, item] of items.entries()) {
    const { id, draft } = item;
    const report: UploadProgress = (percent) => {
      events.onEntryProgress?.(id, percent);
      events.onTotalProgress?.((index + percent / 100) / total);
    };
    events.onEntryState?.(id, 'uploading');

    try {
      const crc = draft.values.crc32;
      const inBatch = batchGames.get(crc);
      const disposition = inBatch
        ? { kind: 'duplicate' as const, game: inBatch }
        : await precheckImport(draft.values.slug, crc);

      if (disposition.kind === 'duplicate') {
        summary.duplicates += 1;
        events.onEntryState?.(id, 'duplicate', {
          result: { slug: disposition.game.slug, title: disposition.game.title },
        });
        continue;
      }

      if (disposition.kind === 'variant') {
        await attachVariant(disposition.game, draft, report);
        summary.variants += 1;
        events.onEntryState?.(id, 'variant', {
          result: { slug: disposition.game.slug, title: disposition.game.title },
        });
        continue;
      }

      const { game } = await createCatalogRecord(draft, report);
      batchGames.set(crc, game);
      summary.added += 1;
      events.onEntryState?.(id, 'done', {
        result: { slug: game.slug, title: game.title },
      });
    } catch (error) {
      summary.failed += 1;
      events.onEntryState?.(id, 'error', { error: messageOf(error) });
      if (error instanceof AuthExpiredError) {
        for (const remaining of items.slice(index + 1)) {
          summary.failed += 1;
          events.onEntryState?.(remaining.id, 'error', { error: messageOf(error) });
        }
        return summary;
      }
    } finally {
      events.onEntryProgress?.(id, 100);
      events.onTotalProgress?.((index + 1) / total);
    }
  }

  return summary;
}
