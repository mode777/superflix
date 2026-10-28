import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AmbientBackground } from '@/components/media/AmbientBackground';
import { RomDropzone } from '@/admin/RomDropzone';
import { formatBytes } from '@/lib/format';
import { loadDatFromUrl } from '@/lib/snes/dat';
import { identifyRom } from '@/lib/snes/identify';
import type { RomIdentification } from '@/lib/snes/types';
import { showToast } from '@/lib/toast';
import { useLocalGameStore } from '@/features/console/localGameStore';
import { useRomStore } from '@/features/console/romStore';
import { useAdminAuthStore } from '@/admin/lib/authStore';
import { adminAuth } from '@/admin/lib/pb-auth';
import type { Game, Region } from '@/types/games';

function cleanDatName(name: string): string {
  let result = name;
  while (/\s*\([^)]*\)\s*$/.test(result)) result = result.replace(/\s*\([^)]*\)\s*$/, '');
  while (/\s*\[[^\]]*\]\s*$/.test(result)) result = result.replace(/\s*\[[^\]]*\]\s*$/, '');
  return result.trim() || name;
}

function toGame(result: RomIdentification, file: File): Game {
  const title = cleanDatName(
    result.match?.name ?? result.header?.title ?? file.name.replace(/\.[^.]+$/, ''),
  );
  const slug = `local-${result.hashes.crc32.toLowerCase()}`;
  const year = result.match?.fields.releaseyear?.slice(0, 4) ?? '';
  const region: Region =
    result.header?.region === 'NTSC-J' || result.header?.region === 'PAL'
      ? result.header.region
      : 'NTSC-U';

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
    players: result.match?.fields.maxusers ?? '',
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
        <span>No-Intro index ready — {count.toLocaleString()} SNES entries.</span>
      )}
    </div>
  );
}

export default function AdminView() {
  const navigate = useNavigate();
  const adminUser = useAdminAuthStore((state) => state.user);
  const datQuery = useQuery({
    queryKey: ['snes-no-intro-dat'],
    queryFn: () =>
      loadDatFromUrl(new URL('data/no-intro-snes.dat', document.baseURI).toString()),
    staleTime: Infinity,
    retry: false,
  });

  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<RomIdentification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (next: File) => {
    setFile(next);
    setResult(null);
    setError(null);
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

  const header = result?.header ?? null;

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
              Identify a ROM
            </h1>
            <p className="mt-3 max-w-2xl text-body-lg text-on-surface-variant">
              Drop a Super Nintendo ROM. The copier header is stripped, CRC32/MD5/SHA1 are
              computed, and the internal header is parsed against the No-Intro index — all in your
              browser.
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
                  No valid internal header was found. The hashes still identify the file, but the
                  region/revision fields are unavailable.
                </p>
              )}
            </div>

            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-headline-lg text-on-surface">Hashes</h2>
              <dl className="mt-4 flex flex-col gap-3">
                <HashRow label="CRC32" value={result.hashes.crc32} />
                <HashRow label="MD5" value={result.hashes.md5} />
                <HashRow label="SHA1" value={result.hashes.sha1} />
                {result.hadCopierHeader && <HashRow label="Raw CRC32" value={result.rawCrc32} />}
              </dl>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handlePlay}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary to-tertiary-container px-5 py-2.5 text-body-md font-semibold text-on-primary transition hover:brightness-110"
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

            <p className="text-body-md text-on-surface-variant/80">
              “Play locally” keeps the ROM in memory for this session. To add it to the catalog,
              upload the ROM to PocketBase and create a `games` record — the schema and importer
              contract are documented in the README.
            </p>
          </section>
        )}
      </main>
    </>
  );
}
