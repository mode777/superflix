import {
  deriveRegion,
  deriveSlug,
  cleanDatName,
  slugify,
  titleFromFileName,
} from '@/features/games/slug';
import { stripCopierHeader } from '@/lib/snes/copier';
import { hashRom } from '@/lib/snes/hash';
import { parseSnesHeader } from '@/lib/snes/header';
import type { RomIdentification, SnesHeader } from '@/lib/snes/types';
import type { Region } from '@/types/games';
import { adminClient } from './pb';
import { updateRecord, uploadRecord, type MultipartValue, type UploadProgress } from './upload';
import { applyArtwork } from '../metadata/artwork';

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
  const byCrc = await findGame(adminClient.filter('rom_crc32 = {:value}', { value: crc32 }));
  if (byCrc) return { kind: 'duplicate', game: byCrc };

  const bySlug = await findGame(adminClient.filter('slug = {:value}', { value: slug }));
  if (bySlug) return { kind: 'variant', game: bySlug };

  return { kind: 'create' };
}

/** Build catalog values from an identification result (pure, testable). */
export function buildCatalogDraft(
  result: RomIdentification,
  fallbackName: string,
): CatalogDraft {
  const fields = result.match?.fields ?? {};
  const fileNameTitle = titleFromFileName(fallbackName);
  const rawTitle =
    result.match?.name ??
    (slugify(fileNameTitle) ? fileNameTitle : result.header?.title?.trim() || fileNameTitle);
  const title = cleanDatName(rawTitle);
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

/**
 * Read a ROM file, strip its copier header, and upload the normalized image
 * with fields matching the stored bytes.
 */
export async function createCatalogRecord(
  result: RomIdentification,
  file: File,
  onProgress?: UploadProgress,
): Promise<{ game: CatalogGameRecord }> {
  const draft = buildCatalogDraft(result, file.name);
  const normalized = normalizedFile(new Uint8Array(await file.arrayBuffer()), draft.slug);

  const created = await uploadRecord<RecordLike>(
    'games',
    toGameFields(draft),
    { rom: normalized },
    onProgress,
  );
  const game = summarize(created);

  await adminClient.collection('roms').create(toRomFields(draft, game.id, true));

  // Artwork is best-effort: failures never fail the import.
  await applyArtwork(game.id, result.match?.name);

  return { game };
}

/** Attach an additional regional/revision ROM to an existing game. */
export async function attachVariant(
  game: CatalogGameRecord,
  result: RomIdentification,
  file: File,
  onProgress?: UploadProgress,
): Promise<{ game: CatalogGameRecord }> {
  const draft = buildCatalogDraft(result, file.name);
  const suffix = `${draft.slug}-${draft.region.toLowerCase()}-rev${draft.revision}`;
  const normalized = normalizedFile(new Uint8Array(await file.arrayBuffer()), suffix);

  await uploadRecord(
    'roms',
    toRomFields(draft, game.id, false),
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
