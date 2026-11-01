import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { RomDropzone } from '@/admin/RomDropzone';
import { DatasetMatchModal, type DatasetMatch } from '@/admin/DatasetMatchModal';
import {
  buildCatalogDraft,
  commitStagedDrafts,
  type CatalogDraft,
  type StagedDraft,
} from '@/admin/lib/importer';
import { useImportQueue } from '@/admin/lib/useImportQueue';
import type { QueueEntry } from '@/admin/lib/importQueue';
import { previewEnrichment } from '@/admin/metadata/enrich';
import type { RomCandidate } from '@/admin/lib/romIntake';
import { enrichIndex, loadDatFromUrl } from '@/lib/snes/dat';
import type { Game, Region } from '@/types/games';
import { formatBytes } from '@/lib/format';
import { showToast } from '@/lib/toast';
import { useLocalGameStore } from '@/features/console/localGameStore';
import { useRomStore } from '@/features/console/romStore';

const ENRICHMENT_DATS = ['developer', 'publisher', 'genre', 'releaseyear', 'maxusers'] as const;

function datUrl(name: string): string {
  return new URL(`data/${name}.dat`, document.baseURI).toString();
}

async function loadDatIndex() {
  const [base, ...enrichment] = await Promise.all([
    loadDatFromUrl(datUrl('no-intro-snes')),
    ...ENRICHMENT_DATS.map((name) => loadDatFromUrl(datUrl(name)).catch(() => null)),
  ]);
  const entries = enrichment.flatMap((index) => index?.entries ?? []);
  return enrichIndex(base, entries);
}

/** Catalog draft seeded from identification, filled with the fetched dataset values. */
function seedDraft(entry: QueueEntry): CatalogDraft {
  const base = entry.identification
    ? buildCatalogDraft(entry.identification, entry.file.name)
    : null;
  if (!base) throw new Error('Draft seeded before identification finished.');
  const fetched = entry.preview?.fields ?? {};
  const value = (key: keyof CatalogDraft): string => {
    const fetchedValue = fetched[key];
    return typeof fetchedValue === 'string' && fetchedValue !== '' ? fetchedValue : '';
  };
  return {
    ...base,
    ...(value('description') ? { description: value('description') } : {}),
    ...(value('genre') ? { genre: value('genre') } : {}),
    ...(value('developer') ? { developer: value('developer') } : {}),
    ...(value('publisher') ? { publisher: value('publisher') } : {}),
    ...(value('players') ? { players: value('players') } : {}),
    ...(value('release') ? { release: value('release') } : {}),
  };
}

function toStagedDraft(entry: QueueEntry, values: CatalogDraft): StagedDraft {
  return {
    values,
    identification: entry.identification!,
    file: entry.file,
    metadataId: entry.preview?.resolved ? entry.preview.slug : undefined,
    cover: entry.preview?.cover ?? null,
    screenshots: entry.preview?.screenshots ?? [],
  };
}

/** The admin "Play locally" flow is implemented in ImportQueueTab via the local stores. */

function toDateInput(value: string): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function fieldClass(): string {
  return 'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-body-md text-on-surface outline-none transition focus:border-primary/60';
}

/**
 * Object URL for a preview blob; empty in environments without the API. The
 * URL is derived during render (memoized by blob) and revoked on cleanup.
 */
function useBlobUrl(blob?: Blob | null): string {
  const url = useMemo(() => {
    if (!blob || typeof URL.createObjectURL !== 'function') return '';
    return URL.createObjectURL(blob);
  }, [blob]);

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  return url;
}

const CHIP_LABELS: Record<QueueEntry['status'], string> = {
  pending: 'Queued',
  identifying: 'Identifying',
  previewing: 'Fetching metadata',
  ready: 'Ready',
  failed: 'Failed',
  uploading: 'Uploading',
  done: 'Added',
  duplicate: 'Duplicate',
  variant: 'Variant',
  error: 'Error',
};

function chipClass(status: QueueEntry['status']): string {
  switch (status) {
    case 'ready':
    case 'done':
      return 'bg-favorite/15 text-favorite';
    case 'failed':
    case 'error':
      return 'bg-error-container/20 text-error';
    case 'duplicate':
    case 'variant':
      return 'bg-secondary/15 text-secondary';
    case 'uploading':
      return 'bg-primary/15 text-primary';
    default:
      return 'bg-white/[0.06] text-on-surface-variant';
  }
}

function StatusChip({ status }: { status: QueueEntry['status'] }) {
  const busy = status === 'identifying' || status === 'previewing';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-label-caps uppercase tracking-[0.14em] ${chipClass(status)}`}
    >
      {busy && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
      {CHIP_LABELS[status]}
    </span>
  );
}

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-body-md text-on-surface-variant">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function DraftCard({
  entry,
  committing,
  progress,
  onValues,
  onAdd,
  onRematch,
  onRemove,
  onPlay,
}: {
  entry: QueueEntry;
  committing: boolean;
  progress?: number;
  onValues: (id: string, values: CatalogDraft) => void;
  onAdd: (id: string) => void;
  onRematch: (id: string) => void;
  onRemove: (id: string) => void;
  onPlay: (entry: QueueEntry) => void;
}) {
  const identification = entry.identification;

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label-caps uppercase tracking-[0.18em] text-on-surface-variant">
            {entry.path}
          </p>
          <h3 className="mt-1 truncate text-headline-lg text-on-surface">
            {(identification ? seedDraft(entry).title : '') || entry.file.name}
          </h3>
          <p className="mt-1 text-body-md text-on-surface-variant">
            {entry.file.name} • {formatBytes(identification?.fileSize ?? entry.file.size)}
            {identification?.hadCopierHeader && ' • 512-byte copier header stripped'}
            {identification ? ` • CRC32 ${identification.hashes.crc32}` : ''}
          </p>
        </div>
        <StatusChip status={entry.status} />
      </div>

      {entry.status === 'failed' && (
        <p className="mt-4 rounded-xl border border-error/25 bg-error-container/10 px-4 py-3 text-body-md text-error">
          {entry.error || 'This file could not be identified.'}
        </p>
      )}

      {entry.previewFailed && (
        <p className="mt-4 rounded-xl border border-secondary/25 bg-secondary/5 px-4 py-3 text-body-md text-secondary">
          Metadata could not be fetched from the dataset. You can still edit the
          identification values below and add the game.
        </p>
      )}

      {!entry.previewFailed && entry.preview && !entry.preview.resolved && (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-body-md text-on-surface-variant">
          Not found in the dataset — showing identification values. Use “Match in dataset…” to
          pick the right entry manually.
        </p>
      )}

      {(entry.status === 'done' || entry.status === 'duplicate' || entry.status === 'variant') &&
        entry.result && (
          <p className="mt-4 rounded-xl border border-favorite/25 bg-favorite/5 px-4 py-3 text-body-md text-favorite">
            {entry.status === 'done' && (
              <>
                <strong>{entry.result.title}</strong> is now in the catalog.{' '}
              </>
            )}
            {entry.status === 'duplicate' && (
              <>
                Already in the catalog as <strong>{entry.result.title}</strong>.{' '}
              </>
            )}
            {entry.status === 'variant' && (
              <>
                Added as a variant of <strong>{entry.result.title}</strong>.{' '}
              </>
            )}
            <Link
              to={`/game/${entry.result.slug}`}
              className="underline underline-offset-2 hover:text-on-surface"
            >
              Open the game
            </Link>
            .
          </p>
        )}

      {entry.status === 'error' && (
        <p className="mt-4 rounded-xl border border-error/25 bg-error-container/10 px-4 py-3 text-body-md text-error">
          {entry.error || 'Could not add this game.'}
        </p>
      )}

      {identification && entry.status !== 'failed' && (
        <DraftForm
          entry={entry}
          committing={committing}
          progress={progress}
          onValues={onValues}
          onAdd={onAdd}
          onRematch={onRematch}
          onRemove={onRemove}
          onPlay={onPlay}
        />
      )}
    </div>
  );
}

/**
 * Editable review form for an identified draft. Mounts only once the entry's
 * identification exists, so the form state always has a full seed; a manual
 * re-match remounts the whole card via its key, re-seeding from the new
 * preview.
 */
function DraftForm({
  entry,
  committing,
  progress,
  onValues,
  onAdd,
  onRematch,
  onRemove,
  onPlay,
}: {
  entry: QueueEntry;
  committing: boolean;
  progress?: number;
  onValues: (id: string, values: CatalogDraft) => void;
  onAdd: (id: string) => void;
  onRematch: (id: string) => void;
  onRemove: (id: string) => void;
  onPlay: (entry: QueueEntry) => void;
}) {
  const [form, setForm] = useState<CatalogDraft>(() => seedDraft(entry));
  const coverUrl = useBlobUrl(entry.preview?.cover?.blob ?? null);
  const screenshotUrls = entry.preview?.screenshots ?? [];
  const header = entry.identification?.header ?? null;
  const matched = Boolean(entry.identification?.match);

  const update = (key: keyof CatalogDraft, value: string) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      onValues(entry.id, next);
      return next;
    });
  };

  return (
    <>
      {entry.status === 'uploading' && (
        <div className="mt-4">
          <ProgressBar percent={progress ?? 0} label={`Uploading ${form.title}…`} />
        </div>
      )}
      {(coverUrl || screenshotUrls.length > 0) && (
            <div className="mt-5 flex flex-wrap items-start gap-4">
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt="Box art preview"
                  className="h-40 w-auto rounded-lg border border-white/10 object-cover"
                />
              )}
              {screenshotUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {screenshotUrls.map((image, index) => (
                    <ScreenshotThumb key={image.fileName} image={image} index={index} />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
                Title
              </span>
              <input
                value={form.title}
                onChange={(event) => update('title', event.target.value)}
                className={fieldClass()}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
                Region
              </span>
              <select
                value={form.region}
                onChange={(event) => update('region', event.target.value)}
                className={fieldClass()}
              >
                <option value="NTSC-U">NTSC-U</option>
                <option value="NTSC-J">NTSC-J</option>
                <option value="PAL">PAL</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
                Genre
              </span>
              <input
                value={form.genre}
                onChange={(event) => update('genre', event.target.value)}
                className={fieldClass()}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
                Players
              </span>
              <input
                value={form.players}
                onChange={(event) => update('players', event.target.value)}
                className={fieldClass()}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
                Developer
              </span>
              <input
                value={form.developer}
                onChange={(event) => update('developer', event.target.value)}
                className={fieldClass()}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
                Publisher
              </span>
              <input
                value={form.publisher}
                onChange={(event) => update('publisher', event.target.value)}
                className={fieldClass()}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
                Release
              </span>
              <input
                type="date"
                value={toDateInput(form.release)}
                onChange={(event) =>
                  update('release', event.target.value ? `${event.target.value} 00:00:00.000Z` : '')
                }
                className={fieldClass()}
              />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
              <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
                Description
              </span>
              <textarea
                rows={2}
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                className={fieldClass()}
              />
            </label>
          </div>

          {header && (
            <p className="mt-4 text-body-md text-on-surface-variant">
              {header.mapper}
              {header.fastRom ? ' (FastROM)' : ''} • {header.regionLabel} • Rev 1.
              {header.version}
              {header.hasBattery ? ' • Battery' : ''}
              {header.sramSize ? ` • ${(header.sramSize / 1024).toFixed(0)} KB SRAM` : ''}
            </p>
          )}
          {!matched && !header && (
            <p className="mt-4 text-body-md text-on-surface-variant">
              No valid internal header and no DAT match — the hashes still identify the file.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onAdd(entry.id)}
              disabled={committing || entry.status === 'uploading'}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary to-tertiary-container px-4 py-2 text-body-md font-semibold text-on-primary transition hover:brightness-110 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                add_to_photos
              </span>
              {entry.status === 'error' ? 'Retry' : 'Add to catalog'}
            </button>
            <button
              type="button"
              onClick={() => onRematch(entry.id)}
              disabled={committing}
              className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-body-md font-semibold text-on-surface transition hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-50"
            >
              Match in dataset…
            </button>
            <button
              type="button"
              onClick={() => onPlay(entry)}
              disabled={committing}
              className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-body-md font-semibold text-on-surface transition hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-50"
            >
              Play locally
            </button>
            <button
              type="button"
              onClick={() => onRemove(entry.id)}
              disabled={committing || entry.status === 'uploading'}
              className="ml-auto rounded-lg border border-error/30 px-4 py-2 text-body-md text-error transition hover:bg-error/10 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
    </>
  );
}

function ScreenshotThumb({ image, index }: { image: { blob: Blob; fileName: string }; index: number }) {
  const url = useBlobUrl(image.blob);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={`Screenshot preview ${index + 1}`}
      className="h-24 w-auto rounded-lg border border-white/10 object-cover"
    />
  );
}

/** The identify tab: staged queue with review-before-commit and batch progress. */
export function ImportQueueTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { queue, snapshot } = useImportQueue();
  const { entries, scan } = snapshot;
  const datQuery = useQuery({
    queryKey: ['snes-dat-index'],
    queryFn: loadDatIndex,
    staleTime: Infinity,
    retry: false,
  });

  const [committing, setCommitting] = useState(false);
  const [totalPercent, setTotalPercent] = useState<number | null>(null);
  const [entryProgress, setEntryProgress] = useState<Record<string, number>>({});
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchTitle, setMatchTitle] = useState('');
  const draftsRef = useRef(new Map<string, CatalogDraft>());

  const registerValues = useCallback((id: string, values: CatalogDraft) => {
    draftsRef.current.set(id, values);
  }, []);

  const draftFor = useCallback(
    (entry: QueueEntry): CatalogDraft => draftsRef.current.get(entry.id) ?? seedDraft(entry),
    [],
  );

  const handleFiles = (candidates: RomCandidate[]) => {
    queue.addCandidates(candidates);
    void queue.scanAll({ datIndex: datQuery.data });
  };

  const commit = async (ids: string[]) => {
    const items = ids
      .map((id) => entries.find((entry) => entry.id === id))
      .filter((entry): entry is QueueEntry => Boolean(entry?.identification))
      .map((entry) => ({ id: entry.id, draft: toStagedDraft(entry, draftFor(entry)) }));
    if (items.length === 0) return;

    setCommitting(true);
    setTotalPercent(0);
    try {
      const summary = await commitStagedDrafts(items, {
        onEntryProgress: (id, percent) =>
          setEntryProgress((current) => ({ ...current, [id]: percent })),
        onTotalProgress: (fraction) => setTotalPercent(Math.round(fraction * 100)),
        onEntryState: (id, status, data) => queue.setCommitState(id, status, data),
      });
      const parts = [`added ${summary.added}`];
      if (summary.duplicates > 0) parts.push(`${summary.duplicates} duplicate${summary.duplicates === 1 ? '' : 's'}`);
      if (summary.variants > 0) parts.push(`${summary.variants} variant${summary.variants === 1 ? '' : 's'}`);
      if (summary.failed > 0) parts.push(`${summary.failed} failed`);
      showToast(`Batch finished — ${parts.join(', ')}.`, {
        kind: summary.failed > 0 ? 'info' : 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['games'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-games'] });
    } finally {
      setCommitting(false);
      setTotalPercent(null);
    }
  };

  const rematch = async (match: DatasetMatch) => {
    const id = matchId;
    setMatchId(null);
    if (!id) return;
    const entry = entries.find((candidate) => candidate.id === id);
    if (!entry?.identification) return;
    const values = draftFor(entry);
    const preview = await previewEnrichment({
      crc32: entry.identification.hashes.crc32,
      title: values.title,
      region: values.region as Region,
      slug: match.slug,
    });
    queue.applyPreview(id, preview);
    showToast(
      preview.unavailable
        ? 'Dataset unreachable — keeping the edited values.'
        : preview.resolved
          ? 'Draft updated from the chosen dataset entry.'
          : 'That entry has no dataset record; the draft is unchanged.',
      { kind: preview.resolved && !preview.unavailable ? 'success' : 'info' },
    );
  };

  const play = (entry: QueueEntry) => {
    if (!entry.identification) return;
    const title = draftFor(entry).title;
    const slug = `local-${entry.identification.hashes.crc32.toLowerCase()}`;
    const year = entry.identification.match?.fields.releaseyear?.slice(0, 4) ?? '';
    const game: Game = {
      id: slug,
      slug,
      title,
      region: draftFor(entry).region as Region,
      genre: entry.identification.match?.fields.genre ?? 'Unknown',
      developer: entry.identification.match?.fields.developer ?? '',
      publisher: entry.identification.match?.fields.publisher ?? '',
      release: year ? `${year}-01-01` : '',
      description: '',
      players: entry.identification.match?.fields.maxusers ?? entry.identification.match?.fields.users ?? '',
      coverColors: ['#22262b', '#d92d3a'],
      screenshots: [],
      romCrc32: entry.identification.hashes.crc32,
      romSize: entry.identification.normalizedSize,
      header: entry.identification.header,
    };
    useLocalGameStore.getState().setGame(game);
    useRomStore.getState().setRom(game.slug, entry.file);
    navigate(`/play/${game.slug}`);
  };

  const readyIds = entries.filter((entry) => entry.status === 'ready').map((entry) => entry.id);
  const scanRunning = scan.total > 0 && scan.done < scan.total;
  const matchEntry = matchId ? entries.find((entry) => entry.id === matchId) : null;

  const openMatch = (id: string) => {
    const entry = entries.find((candidate) => candidate.id === id);
    setMatchTitle(entry ? draftFor(entry).title : '');
    setMatchId(id);
  };

  return (
    <>
      <div className="mt-6">
        <DatStatus
          isLoading={datQuery.isLoading}
          isError={datQuery.isError}
          count={datQuery.data?.entries.length ?? 0}
        />
      </div>

      <div className="mt-6">
        <RomDropzone onFiles={handleFiles} disabled={datQuery.isLoading} />
      </div>

      {entries.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-body-md text-on-surface-variant">
            {scanRunning
              ? `Identifying ${scan.done} of ${scan.total}…`
              : `Found ${entries.length} game${entries.length === 1 ? '' : 's'} — review each draft below, then add them.`}
          </p>
          {readyIds.length > 0 && (
            <button
              type="button"
              onClick={() => void commit(readyIds)}
              disabled={committing}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary to-tertiary-container px-5 py-2.5 text-body-md font-semibold text-on-primary transition hover:brightness-110 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                library_add
              </span>
              {committing ? 'Adding…' : `Add ${readyIds.length} ready game${readyIds.length === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      )}

      {scanRunning && (
        <div className="mt-4">
          <ProgressBar percent={Math.round((scan.done / scan.total) * 100)} label="Identifying queue…" />
        </div>
      )}

      {committing && totalPercent !== null && (
        <div className="mt-4">
          <ProgressBar percent={totalPercent} label="Total upload progress" />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {entries.map((entry) => (
          <DraftCard
            key={`${entry.id}:${entry.preview?.slug ?? ''}`}
            entry={entry}
            committing={committing}
            progress={entryProgress[entry.id]}
            onValues={registerValues}
            onAdd={(id) => void commit([id])}
            onRematch={openMatch}
            onRemove={(id) => {
              draftsRef.current.delete(id);
              queue.remove(id);
            }}
            onPlay={play}
          />
        ))}
      </div>

      <DatasetMatchModal
        open={Boolean(matchEntry)}
        initialQuery={matchTitle}
        onSelect={(match) => void rematch(match)}
        onDismiss={() => setMatchId(null)}
      />
    </>
  );
}

function DatStatus({
  isLoading,
  isError,
  count,
}: {
  isLoading: boolean;
  isError: boolean;
  count: number;
}) {
  const tone = isError
    ? 'border-error/25 bg-error-container/10 text-error'
    : isLoading
      ? 'border-white/10 bg-white/[0.03] text-on-surface-variant'
      : 'border-favorite/25 bg-favorite/5 text-favorite';

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-body-md ${tone}`}>
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
        {isLoading ? 'hourglass_top' : 'database'}
      </span>
      {isError ? (
        <span>
          No-Intro DAT not found. Run <code className="font-mono">npm run dats:fetch</code> and
          reload this page. You can still identify the header and hashes without it.
        </span>
      ) : isLoading ? (
        <span>Loading the No-Intro index…</span>
      ) : (
        <span>
          No-Intro index ready — {count.toLocaleString()} SNES entries (with libretro metadata
          when available).
        </span>
      )}
    </div>
  );
}
