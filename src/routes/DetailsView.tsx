import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AmbientBackground } from '@/components/media/AmbientBackground';
import { CoverArt } from '@/components/media/CoverArt';
import { MetadataPanel } from '@/components/media/MetadataPanel';
import { ScreenshotCarousel } from '@/components/media/ScreenshotCarousel';
import { EmptyState } from '@/components/EmptyState';
import { useGame } from '@/features/games/useGame';
import type { SnesHeader } from '@/lib/snes/types';

function RomHeaderPanel({ header }: { header: SnesHeader }) {
  const rows = [
    { label: 'Mapper', value: `${header.mapper}${header.fastRom ? ' (FastROM)' : ''}` },
    { label: 'Internal title', value: header.title },
    { label: 'Region code', value: `0x${header.regionCode.toString(16).padStart(2, '0')}` },
    { label: 'Revision', value: `1.${header.version}` },
    { label: 'Cartridge', value: header.cartridgeTypeLabel },
    { label: 'Battery', value: header.hasBattery ? 'Yes' : 'No' },
    { label: 'SRAM', value: header.sramSize ? `${(header.sramSize / 1024).toFixed(0)} KB` : 'None' },
    { label: 'Game code', value: header.gameCode ?? '—' },
  ];

  return (
    <section className="mt-12">
      <h2 className="text-headline-lg text-on-surface">ROM header</h2>
      <div className="glass-panel mt-4 grid gap-x-8 gap-y-4 rounded-2xl p-6 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-1">
            <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
              {row.label}
            </span>
            <span className="text-body-md text-on-surface">{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DetailsView() {
  const { slug } = useParams<{ slug: string }>();
  const { data: game, isLoading, isError } = useGame(slug);

  useEffect(() => {
    document.title = game ? `${game.title} — Superflix` : 'Superflix — Super Nintendo Catalog';
    return () => {
      document.title = 'Superflix — Super Nintendo Catalog';
    };
  }, [game]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-page px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
        <div className="grid animate-pulse gap-8 lg:grid-cols-[360px_1fr]">
          <div className="aspect-[4/3] rounded-2xl bg-surface-container-high" />
          <div className="flex flex-col gap-4">
            <div className="h-10 w-2/3 rounded bg-surface-container-high" />
            <div className="h-5 w-1/3 rounded bg-surface-container-high" />
            <div className="h-24 rounded bg-surface-container" />
          </div>
        </div>
      </main>
    );
  }

  if (isError || !game) {
    return (
      <main className="mx-auto max-w-page px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
        <EmptyState
          icon="search_off"
          title="Game not found"
          description="This title is not in the catalog yet. Import a ROM to add it."
          action={
            <Link
              to="/"
              className="mt-2 rounded-lg bg-primary px-4 py-2 text-body-md font-semibold text-on-primary"
            >
              Back to browse
            </Link>
          }
        />
      </main>
    );
  }

  const year = game.release ? game.release.slice(0, 4) : '';

  return (
    <>
      <AmbientBackground />
      {game.coverUrl && (
        <div
          className="page-background"
          style={{ backgroundImage: `url(${game.coverUrl})` }}
          aria-hidden="true"
        />
      )}

      <main className="relative mx-auto max-w-page px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-body-md text-on-surface-variant transition hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            arrow_back
          </span>
          Back to browse
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[360px_1fr] lg:items-start">
          <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
            <CoverArt game={game} className="aspect-[4/3]" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/15 px-3 py-1 text-label-caps uppercase tracking-[0.16em] text-primary">
                {game.genre}
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1 text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
                {game.region}
              </span>
              {game.romCrc32 && (
                <span className="rounded-full bg-white/5 px-3 py-1 font-mono text-label-caps text-on-surface-variant">
                  CRC {game.romCrc32}
                </span>
              )}
            </div>

            <h1 className="mt-4 text-headline-xl-mobile font-extrabold tracking-tight text-on-surface md:text-headline-xl">
              {game.title}
            </h1>
            <p className="mt-2 text-body-lg text-on-surface-variant">
              {[game.developer, year].filter(Boolean).join(' • ')}
            </p>

            <p className="mt-6 max-w-3xl whitespace-pre-line text-body-lg leading-relaxed text-on-surface-variant">
              {game.description || 'No description yet. Add one in the catalog editor.'}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={`/play/${game.slug}`}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary to-tertiary-container px-5 py-2.5 text-body-md font-semibold text-on-primary transition hover:brightness-110"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  play_arrow
                </span>
                Play in browser
              </Link>
              <Link
                to="/admin"
                className="rounded-lg border border-white/15 bg-white/[0.04] px-5 py-2.5 text-body-md font-semibold text-on-surface transition hover:border-white/25 hover:bg-white/[0.08]"
              >
                Import another ROM
              </Link>
            </div>

            <div className="glass-panel mt-10 rounded-2xl p-6">
              <MetadataPanel game={game} />
            </div>
          </div>
        </div>

        <section className="mt-12">
          <h2 className="text-headline-lg text-on-surface">Screenshots</h2>
          <div className="mt-4">
            <ScreenshotCarousel screenshots={game.screenshots} title={game.title} />
          </div>
        </section>

        {game.header && <RomHeaderPanel header={game.header} />}
      </main>
    </>
  );
}
