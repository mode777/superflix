import type { Region } from '@/types/games';

/**
 * snes-dataset static "API" (CC0 metadata, images publisher-copyrighted):
 * https://github.com/mode777/snes-dataset — CORS-open, keyless, no rate limit.
 */
export const DATASET_BASE_URL = 'https://mode777.github.io/snes-dataset';

export interface DatasetRomEntry {
  crc32?: string;
  md5?: string;
  sha1?: string;
  region?: string;
  file?: string;
}

export interface DatasetRecord {
  title?: string;
  aliases?: string[];
  year?: number | null;
  release_dates?: Record<string, string>;
  developer?: string[];
  publisher?: string[];
  genre?: string[];
  tags?: string[];
  description?: string | null;
  description_source?: string;
  players?: string | null;
  languages?: string[];
  roms?: DatasetRomEntry[];
  gf_score?: number | null;
  metascore?: number | null;
  cover_urls?: string[];
  sources?: string[];
  images?: { thumb?: string; box?: string; snap?: string };
}

/** Catalog field values produced from a dataset record. Empty means "not provided". */
export interface MappedDatasetFields {
  description: string;
  genre: string;
  developer: string;
  publisher: string;
  players: string;
  /** PocketBase date string (`YYYY-MM-DD 00:00:00.000Z`) or '' when unknown. */
  release: string;
}

function foldAccents(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Slug used by snes-dataset folders: accents folded, lowercased, runs of
 * non-alphanumerics collapsed to one dash. Leading articles move to the front
 * first, because No-Intro stores `Magical Quest Starring Mickey Mouse, The`.
 */
export function datasetSlugFromTitle(title: string): string {
  const folded = foldAccents(title.trim());
  const withArticle = folded.replace(
    /^(.+), (The|A|An|Les|La|Le|Los|Las|Der|Die|Das|El)$/i,
    (_, rest: string, article: string) => `${article} ${rest}`,
  );
  return withArticle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Strip region/revision/dump tags: `Super Metroid (Japan, USA) [!]` -> `Super Metroid`. */
export function normalizeNoIntroName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** One `index.json` entry: the display title as key, the dataset folder slug as value. */
export interface DatasetTitleEntry {
  title: string;
  slug: string;
}

/**
 * First entry whose title equals the given title under the shared
 * normalization (leading-article move, accent folding, case and punctuation
 * collapse) — the published `index.json` keys are display titles, not slugs,
 * so both sides must be normalized before comparing. Null when nothing matches.
 */
export function matchDatasetTitle(
  title: string,
  entries: readonly DatasetTitleEntry[],
): DatasetTitleEntry | null {
  const normalized = datasetSlugFromTitle(title);
  if (!normalized) return null;
  for (const entry of entries) {
    if (datasetSlugFromTitle(entry.title) === normalized) return entry;
  }
  return null;
}

/** Dataset `release_dates` keys to try, most specific first, for a catalog region. */
export function regionToDateKeys(region: Region): string[] {
  switch (region) {
    case 'NTSC-J':
      return ['japan'];
    case 'PAL':
      return ['pal', 'europe'];
    default:
      return ['north_america', 'usa'];
  }
}

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

/** Parse the dataset's loose date strings (`1995-08-22`, `August 11, 1995`, `August 1995`, `1995`). */
export function parseLooseDate(value: string): string | null {
  const text = value.trim();
  if (!text) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) {
    const [, year, month, day] = iso;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const yearOnly = /^(\d{4})$/.exec(text);
  if (yearOnly) return `${yearOnly[1]}-01-01`;

  const monthDayYear = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(text);
  if (monthDayYear) {
    const month = MONTHS[monthDayYear[1]!.toLowerCase()];
    if (month !== undefined) {
      return `${monthDayYear[3]}-${String(month + 1).padStart(2, '0')}-${monthDayYear[2]!.padStart(2, '0')}`;
    }
  }

  const monthYear = /^([A-Za-z]+)\s+(\d{4})$/.exec(text);
  if (monthYear) {
    const month = MONTHS[monthYear[1]!.toLowerCase()];
    if (month !== undefined) {
      return `${monthYear[2]}-${String(month + 1).padStart(2, '0')}-01`;
    }
  }

  return null;
}

function pocketbaseDate(iso: string): string {
  return `${iso} 00:00:00.000Z`;
}

/** First parseable date for a catalog region, falling back to first release and year. */
export function releaseDateForRegion(
  dates: Record<string, string> | undefined,
  region: Region,
  fallbackYear?: number | null,
): string {
  for (const key of regionToDateKeys(region)) {
    const raw = dates?.[key];
    if (raw) {
      const parsed = parseLooseDate(raw);
      if (parsed) return pocketbaseDate(parsed);
    }
  }

  const firstRelease = dates?.first_release;
  if (firstRelease) {
    const parsed = parseLooseDate(firstRelease);
    if (parsed) return pocketbaseDate(parsed);
  }

  if (typeof fallbackYear === 'number' && fallbackYear > 0) {
    return pocketbaseDate(`${fallbackYear}-01-01`);
  }

  return '';
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstText(value: unknown): string {
  return Array.isArray(value) ? text(value.find((item) => text(item) !== '')) : text(value);
}

function joinedList(value: unknown): string {
  if (!Array.isArray(value)) return text(value);
  return value
    .map((item) => text(item))
    .filter((item) => item !== '')
    .join(', ');
}

/**
 * Map a snes-dataset `data.json` record onto catalog fields. Fields the dataset
 * does not provide map to '' so callers can skip writing them.
 */
export function mapDatasetRecord(record: DatasetRecord, region: Region): MappedDatasetFields {
  return {
    description: text(record.description),
    genre: joinedList(record.genre),
    developer: firstText(record.developer),
    publisher: firstText(record.publisher),
    players: text(record.players),
    release: releaseDateForRegion(record.release_dates, region, record.year ?? null),
  };
}
