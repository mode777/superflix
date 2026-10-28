import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { AmbientBackground } from '@/components/media/AmbientBackground';
import { RomDropzone } from '@/admin/RomDropzone';
import { CatalogTab } from '@/admin/catalog/CatalogTab';
import { formatBytes } from '@/lib/format';
import { loadDatFromUrl, enrichIndex } from '@/lib/snes/dat';
import { identifyRom } from '@/lib/snes/identify';
import type { RomIdentification } from '@/lib/snes/types';
import { showToast } from '@/lib/toast';
import { useLocalGameStore } from '@/features/console/localGameStore';
import { useRomStore } from '@/features/console/romStore';
import { useAdminAuthStore } from '@/admin/lib/authStore';
import { adminAuth } from '@/admin/lib/pb-auth';
import { precheckImport, createCatalogRecord, attachVariant, buildCatalogDraft } from '@/admin/lib/importer';
import { cleanDatName, deriveRegion } from '@/features/games/slug';
import type { Game } from '@/types/games';

const ENRICHMENT_DATS = ['developer', 'publisher', 'genre', 'releaseyear', 'maxusers'] as const;

type AdminTab = 'identify' | 'catalog';

type ImportState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'uploading'; progress: number }
  | { status: 'done'; slug: string; title: string }
  | { status: 'duplicate'; slug: string; title: string }
  | { status: 'variant'; slug: string; title: string }
  | { status: 'error'; message: string };

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

function toGame(result: RomIdentification, file: File): Game {
  const title = cleanDatName(
    result.match?.name ?? result.header?.title ?? file.name.replace(/\.[^.]+$/, ''),
  );
  const slug = `local-${result.hashes.crc32.toLowerCase()}`;
  const year = result.match?.fields.releaseyear?.slice(0, 4) ?? '';
  const region = deriveRegion(result.match?.region, result.header?.region);

  return {
    id: slug,
    slug,
    title,
    region,
    genre: result.match?.fields.genre ?? 'Unknown',
    developer: result.match?.fields.developer ?? '',
    publisher: result.match?.fields.publisher ?? '',
    release: year ? `${year}-01-01` : '',
    description: `Imported locally from ${file.name}. Add a description and artwork in the catalog editor.`,
    players: result.match?.fields.maxusers ?? result.match?.fields.users ?? '',
    coverColors: ['#22262b', '#d92d3a'],
    screenshots: [],
    romCrc32: result.hashes.crc32,
    romSize: result.normalizedSize,
    header: result.header,
  };
}

function HashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-24 shrink-0 text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
        {label}
      </dt>
      <dd className="break-all font-mono text-body-md text-on-surface">{value || '—'}</dd>
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
        {label}
      </span>
      <span className="text-body-md text-on-surface">{value}</span>
    </div>
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

function tabClass(active: boolean): string {
  return active
    ? 'rounded-lg bg-white/[0.08] px-4 py-2 text-body-md font-semibold text-on-surface'
    : 'rounded-lg px-4 py-2 text-body-md text-on-surface-variant transition hover:text-on-surface';
}

export default function AdminView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const adminUser = useAdminAuthStore((state) => state.user);
  const [tab, setTab] = useState<AdminTab>('identify');
  const datQuery = useQuery({
    queryKey: ['snes-dat-index'],
    queryFn: loadDatIndex,
    staleTime: Infinity,
    retry: false,
  });

  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<RomIdentification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importState, setImportState] = useState<ImportState>({ status: 'idle' });

  const handleFile = async (next: File) => {
    setFile(next);
    setResult(null);
    setError(null);
    setImportState({ status: 'idle' });
    setBusy(true);

    try {
      const bytes = new Uint8Array(await next.arrayBuffer());
      const identification = await identifyRom(bytes, datQuery.data, next.name);
      setResult(identification);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePlay = () => {
    if (!file || !result) return;
    const game = toGame(result, file);
    useLocalGameStore.getState().setGame(game);
    useRomStore.getState().setRom(game.slug, file);
    navigate(`/play/${game.slug}`);
  };

  const handleCopy = async () => {
    if (!file || !result) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({ file: file.name, ...result }, null, 2),
      );
      showToast('Identification JSON copied.', { kind: 'success' });
    } catch {
      showToast('Could not copy to the clipboard.', { kind: 'error' });
    }
  };

  const handleImport = async () => {
    if (!file || !result) return;

    const slug = buildCatalogDraft(result, file.name).slug;
    setImportState({ status: 'checking' });

    try {
      const disposition = await precheckImport(slug, result.hashes.crc32);

      if (disposition.kind === 'duplicate') {
        setImportState({
          status: 'duplicate',
          slug: disposition.game.slug,
          title: disposition.game.title,
        });
        showToast('That ROM is already in the catalog.', { kind: 'info' });
        return;
      }

      if (disposition.kind === 'variant') {
        setImportState({ status: 'uploading', progress: 0 });
        await attachVariant(disposition.game, result, file, (progress) =>
          setImportState({ status: 'uploading', progress }),
        );
        setImportState({
          status: 'variant',
          slug: disposition.game.slug,
          title: disposition.game.title,
        });
        void queryClient.invalidateQueries({ queryKey: ['games'] });
        showToast('Added as a ROM variant.', { kind: 'success' });
        return;
      }

      setImportState({ status: 'uploading', progress: 0 });
      const { game } = await createCatalogRecord(result, file, (progress) =>
        setImportState({ status: 'uploading', progress }),
      );
      setImportState({ status: 'done', slug: game.slug, title: game.title });
      void queryClient.invalidateQueries({ queryKey: ['games'] });
      showToast(`Added ${game.title} to the catalog.`, { kind: 'success' });
    } catch (err) {
      setImportState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not add the ROM to the catalog.',
      });
    }
  };

  const header = result?.header ?? null;
  const importing =
    importState.status === 'checking' || importState.status === 'uploading';

  return (
    <>
      <AmbientBackground accent="#5b9dff" secondary="#d92d3a" />
      <main className="relative mx-auto max-w-page px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-label-caps uppercase tracking-[0.2em] text-primary">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                fingerprint
              </span>
              Importer
            </span>
            <h1 className="mt-4 text-headline-xl-mobile font-extrabold tracking-tight text-on-surface md:text-headline-xl">
              {tab === 'identify' ? 'Identify a ROM' : 'Manage the catalog'}
            </h1>
            <p className="mt-3 max-w-2xl text-body-lg text-on-surface-variant">
              {tab === 'identify'
                ? 'Drop a Super Nintendo ROM. The copier header is stripped, CRC32/MD5/SHA1 are computed, and the internal header is parsed against the No-Intro index — all in your browser.'
                : 'Edit metadata, replace a ROM file, or remove a game. Changes are written with the dedicated superuser client.'}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="max-w-[220px] truncate text-body-md text-on-surface-variant">
              {adminUser?.email ?? 'Superuser'}
            </span>
            <button
              type="button"
              onClick={() => adminAuth.signOut()}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-body-md text-on-surface-variant transition hover:border-white/20 hover:text-on-surface"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="mt-6 inline-flex gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'identify'}
            onClick={() => setTab('identify')}
            className={tabClass(tab === 'identify')}
          >
            Identify
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'catalog'}
            onClick={() => setTab('catalog')}
            className={tabClass(tab === 'catalog')}
          >
            Catalog
          </button>
        </div>

        {tab === 'catalog' ? (
          <CatalogTab />
        ) : (
          <>
            <div className="mt-6">
              <DatStatus
                isLoading={datQuery.isLoading}
                isError={datQuery.isError}
                count={datQuery.data?.entries.length ?? 0}
              />
            </div>

            <div className="mt-6">
              <RomDropzone
                onFile={(next) => void handleFile(next)}
                disabled={busy || datQuery.isLoading}
              />
            </div>

            {busy && (
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-body-md text-on-surface-variant">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                Hashing and matching…
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-xl border border-error/25 bg-error-container/10 px-4 py-3 text-body-md text-error">
                {error}
              </div>
            )}

            {result && file && (
              <section className="mt-8 flex flex-col gap-6">
                <div className="glass-panel rounded-2xl p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-label-caps uppercase tracking-[0.18em] text-on-surface-variant">
                        Identification
                      </p>
                      <h2 className="mt-1 truncate text-headline-lg text-on-surface">
                        {result.match
                          ? cleanDatName(result.match.name)
                          : header?.title || file.name}
                      </h2>
                      <p className="mt-1 text-body-md text-on-surface-variant">
                        {file.name} • {formatBytes(result.fileSize)}
                        {result.hadCopierHeader && ' • 512-byte copier header stripped'}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-label-caps uppercase tracking-[0.16em] ${
                        result.match
                          ? 'bg-favorite/15 text-favorite'
                          : 'bg-secondary/15 text-secondary'
                      }`}
                    >
                      {result.match ? `Matched by ${result.matchBy}` : 'No DAT match'}
                    </span>
                  </div>

                  {result.match && (
                    <div className="mt-5 grid gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 sm:grid-cols-2 lg:grid-cols-4">
                      <HeaderStat label="DAT name" value={result.match.name} />
                      <HeaderStat label="Region" value={result.match.region ?? '—'} />
                      <HeaderStat
                        label="DAT size"
                        value={result.match.rom.size ? formatBytes(result.match.rom.size) : '—'}
                      />
                      <HeaderStat label="Serial" value={result.match.serial ?? '—'} />
                    </div>
                  )}

                  {(result.match?.fields.developer || result.match?.fields.genre) && (
                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <HeaderStat
                        label="Developer"
                        value={result.match?.fields.developer ?? '—'}
                      />
                      <HeaderStat
                        label="Publisher"
                        value={result.match?.fields.publisher ?? '—'}
                      />
                      <HeaderStat label="Genre" value={result.match?.fields.genre ?? '—'} />
                      <HeaderStat
                        label="Released"
                        value={result.match?.fields.releaseyear ?? '—'}
                      />
                    </div>
                  )}

                  {header ? (
                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <HeaderStat label="Internal title" value={header.title || '—'} />
                      <HeaderStat
                        label="Mapper"
                        value={`${header.mapper}${header.fastRom ? ' (FastROM)' : ''}`}
                      />
                      <HeaderStat
                        label="Region"
                        value={`${header.regionLabel} (0x${header.regionCode
                          .toString(16)
                          .padStart(2, '0')})`}
                      />
                      <HeaderStat label="Revision" value={`1.${header.version}`} />
                      <HeaderStat label="Cartridge" value={header.cartridgeTypeLabel} />
                      <HeaderStat label="Battery" value={header.hasBattery ? 'Yes' : 'No'} />
                      <HeaderStat
                        label="SRAM"
                        value={
                          header.sramSize ? `${(header.sramSize / 1024).toFixed(0)} KB` : 'None'
                        }
                      />
                      <HeaderStat label="Game code" value={header.gameCode ?? '—'} />
                    </div>
                  ) : (
                    <p className="mt-5 rounded-xl border border-secondary/20 bg-secondary/5 px-4 py-3 text-body-md text-secondary">
                      No valid internal header was found. The hashes still identify the file, but
                      the region/revision fields are unavailable.
                    </p>
                  )}
                </div>

                <div className="glass-panel rounded-2xl p-6">
                  <h2 className="text-headline-lg text-on-surface">Hashes</h2>
                  <dl className="mt-4 flex flex-col gap-3">
                    <HashRow label="CRC32" value={result.hashes.crc32} />
                    <HashRow label="MD5" value={result.hashes.md5} />
                    <HashRow label="SHA1" value={result.hashes.sha1} />
                    {result.hadCopierHeader && (
                      <HashRow label="Raw CRC32" value={result.rawCrc32} />
                    )}
                  </dl>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleImport()}
                    disabled={importing}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary to-tertiary-container px-5 py-2.5 text-body-md font-semibold text-on-primary transition hover:brightness-110 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                      add_to_photos
                    </span>
                    {importing ? 'Adding…' : 'Add to catalog'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePlay}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-5 py-2.5 text-body-md font-semibold text-on-surface transition hover:border-white/25 hover:bg-white/[0.08]"
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                      play_arrow
                    </span>
                    Play locally
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="rounded-lg border border-white/15 bg-white/[0.04] px-5 py-2.5 text-body-md font-semibold text-on-surface transition hover:border-white/25 hover:bg-white/[0.08]"
                  >
                    Copy JSON
                  </button>
                </div>

                {importState.status === 'uploading' && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between text-body-md text-on-surface-variant">
                      <span>Uploading ROM…</span>
                      <span>{importState.progress}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${importState.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {importState.status === 'checking' && (
                  <p className="text-body-md text-on-surface-variant">Checking for duplicates…</p>
                )}

                {importState.status === 'duplicate' && (
                  <div className="rounded-xl border border-secondary/25 bg-secondary/5 px-4 py-3 text-body-md text-secondary">
                    This ROM is already in the catalog as{' '}
                    <strong>{importState.title}</strong>.{' '}
                    <Link
                      to={`/game/${importState.slug}`}
                      className="underline underline-offset-2 hover:text-on-surface"
                    >
                      Open existing game
                    </Link>
                    .
                  </div>
                )}

                {importState.status === 'variant' && (
                  <div className="rounded-xl border border-favorite/25 bg-favorite/5 px-4 py-3 text-body-md text-favorite">
                    Added as a regional variant of <strong>{importState.title}</strong>.{' '}
                    <Link
                      to={`/game/${importState.slug}`}
                      className="underline underline-offset-2"
                    >
                      Open the game
                    </Link>
                    .
                  </div>
                )}

                {importState.status === 'done' && (
                  <div className="rounded-xl border border-favorite/25 bg-favorite/5 px-4 py-3 text-body-md text-favorite">
                    <strong>{importState.title}</strong> is now in the catalog.{' '}
                    <Link
                      to={`/game/${importState.slug}`}
                      className="underline underline-offset-2"
                    >
                      Open the game
                    </Link>{' '}
                    or{' '}
                    <button
                      type="button"
                      onClick={() => setTab('catalog')}
                      className="underline underline-offset-2"
                    >
                      manage the catalog
                    </button>
                    .
                  </div>
                )}

                {importState.status === 'error' && (
                  <div className="rounded-xl border border-error/25 bg-error-container/10 px-4 py-3 text-body-md text-error">
                    {importState.message}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
