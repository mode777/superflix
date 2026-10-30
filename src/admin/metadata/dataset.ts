import {
  DATASET_BASE_URL,
  matchDatasetTitle,
  normalizeNoIntroName,
  type DatasetRecord,
  type DatasetTitleEntry,
} from '@/lib/snes-dataset';

export type DatasetFetcher = (url: string) => Promise<Response>;

export interface DatasetImage {
  blob: Blob;
  fileName: string;
  kind: 'thumb' | 'box' | 'snap';
}

const defaultFetcher: DatasetFetcher = (url) => fetch(url);

async function jsonMap(fetcher: DatasetFetcher, path: string): Promise<Record<string, string>> {
  const response = await fetcher(`${DATASET_BASE_URL}/${path}`);
  if (!response.ok) {
    throw new Error(`snes-dataset ${path}: HTTP ${response.status}`);
  }
  return (await response.json()) as Record<string, string>;
}

// Session-wide memoization: both indexes are fetched once per fetcher (in
// production, once per session) and reused by every enrichment call. A failed
// load clears the cache entry so a later call retries.
interface IndexCaches {
  byCrc?: Promise<Record<string, string>>;
  index?: Promise<Record<string, string>>;
  titles?: Promise<DatasetTitleEntry[]>;
}

const cachesByFetcher = new WeakMap<DatasetFetcher, IndexCaches>();

function cachesFor(fetcher: DatasetFetcher): IndexCaches {
  let caches = cachesByFetcher.get(fetcher);
  if (!caches) {
    caches = {};
    cachesByFetcher.set(fetcher, caches);
  }
  return caches;
}

function loadByCrc(fetcher: DatasetFetcher): Promise<Record<string, string>> {
  const caches = cachesFor(fetcher);
  caches.byCrc ??= jsonMap(fetcher, 'by-crc.json');
  caches.byCrc.catch(() => {
    caches.byCrc = undefined;
  });
  return caches.byCrc;
}

function loadIndex(fetcher: DatasetFetcher): Promise<Record<string, string>> {
  const caches = cachesFor(fetcher);
  caches.index ??= jsonMap(fetcher, 'index.json');
  caches.index.catch(() => {
    caches.index = undefined;
  });
  return caches.index;
}

/**
 * Every title index entry as `{ title, slug }`, sorted alphabetically by
 * display title — the manual match picker's data source. Reuses the session
 * cache: the index is fetched once per fetcher, the sorted list memoized with
 * it. Network failures reject.
 */
export function listDatasetTitles(
  fetcher: DatasetFetcher = defaultFetcher,
): Promise<DatasetTitleEntry[]> {
  const caches = cachesFor(fetcher);
  caches.titles ??= loadIndex(fetcher).then((index) =>
    Object.entries(index)
      .map(([title, slug]) => ({ title, slug }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  );
  caches.titles.catch(() => {
    caches.titles = undefined;
  });
  return caches.titles;
}

/**
 * Resolve a game to its dataset slug: by exact headerless CRC32 first
 * (`by-crc.json`), then by matching the cleaned title against the title
 * index's display-title entries (`index.json`). Returns null when the game is
 * not in the dataset; network failures reject.
 */
export async function resolveDatasetSlug(
  crc32: string | undefined,
  fallbackName: string,
  fetcher: DatasetFetcher = defaultFetcher,
): Promise<string | null> {
  const checksum = (crc32 ?? '').trim().toUpperCase();
  if (/^[0-9A-F]{8}$/.test(checksum)) {
    const byCrc = await loadByCrc(fetcher);
    const hit = byCrc[checksum];
    if (hit) return hit;
  }

  const base = normalizeNoIntroName(fallbackName ?? '');
  if (!base) return null;

  const index = await loadIndex(fetcher);
  const entries = Object.entries(index).map(([title, slug]) => ({ title, slug }));
  return matchDatasetTitle(base, entries)?.slug ?? null;
}

/** Full metadata for one slug; null when the folder has no `data.json`. */
export async function fetchDatasetRecord(
  slug: string,
  fetcher: DatasetFetcher = defaultFetcher,
): Promise<DatasetRecord | null> {
  const response = await fetcher(`${DATASET_BASE_URL}/${slug}/data.json`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`snes-dataset ${slug}/data.json: HTTP ${response.status}`);
  }
  return (await response.json()) as DatasetRecord;
}

/**
 * Download the locally hosted images a record advertises (`thumb`/`box`/`snap`).
 * Missing or non-image files are skipped; network failures reject.
 */
export async function fetchDatasetImages(
  slug: string,
  images: DatasetRecord['images'],
  fetcher: DatasetFetcher = defaultFetcher,
): Promise<DatasetImage[]> {
  const entries: Array<{ kind: DatasetImage['kind']; file: string }> = [];
  if (typeof images?.thumb === 'string') entries.push({ kind: 'thumb', file: images.thumb });
  if (typeof images?.box === 'string') entries.push({ kind: 'box', file: images.box });
  if (typeof images?.snap === 'string') entries.push({ kind: 'snap', file: images.snap });

  const results = await Promise.all(
    entries.map(async ({ kind, file }): Promise<DatasetImage | null> => {
      try {
        const response = await fetcher(`${DATASET_BASE_URL}/${slug}/${file}`);
        if (!response.ok) return null;
        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.startsWith('image/')) return null;
        const blob = await response.blob();
        if (blob.size === 0) return null;
        return { blob, fileName: `${slug}-${kind}.png`, kind };
      } catch {
        return null;
      }
    }),
  );

  return results.filter((image): image is DatasetImage => image !== null);
}
