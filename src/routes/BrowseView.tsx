import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AmbientBackground } from '@/components/media/AmbientBackground';
import { CoverArt } from '@/components/media/CoverArt';
import { GameCard } from '@/components/media/GameCard';
import { GenreChips } from '@/components/media/GenreChips';
import { SearchBar } from '@/components/media/SearchBar';
import { EmptyState } from '@/components/EmptyState';
import { useGames } from '@/features/games/useGames';
import { ALL_GENRE, GENRES } from '@/types/games';
import { dataSource } from '@/lib/pb';

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse overflow-hidden rounded-2xl border border-white/5 bg-surface-container/50"
        >
          <div className="aspect-[4/3] bg-surface-container-high" />
          <div className="flex flex-col gap-2 p-4">
            <div className="h-4 w-3/4 rounded bg-surface-container-highest" />
            <div className="h-3 w-1/2 rounded bg-surface-container-high" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BrowseView() {
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState(ALL_GENRE);
  const { games, total, isLoading, isError, refetch } = useGames({ search, genre });
  const featured = games[0] ?? null;

  return (
    <>
      <AmbientBackground />
      <main className="relative mx-auto max-w-page px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
        <section className="mb-14 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-label-caps uppercase tracking-[0.2em] text-primary">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                sports_esports
              </span>
              16-bit library
            </span>
            <h1 className="mt-5 text-headline-xl-mobile font-extrabold tracking-tight text-on-surface md:text-headline-xl">
              Every classic,
              <br />
              one shelf.
            </h1>
            <p className="mt-5 max-w-xl text-body-lg text-on-surface-variant">
              Browse the Super Nintendo library, open a detail page, and play in the browser. ROMs
              stay on your machine or in your own PocketBase instance.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/admin"
                className="rounded-lg bg-gradient-to-br from-primary to-tertiary-container px-5 py-2.5 text-body-md font-semibold text-on-primary transition hover:brightness-110"
              >
                Import a ROM
              </Link>
              {featured && (
                <Link
                  to={`/play/${featured.slug}`}
                  className="rounded-lg border border-white/15 bg-white/[0.04] px-5 py-2.5 text-body-md font-semibold text-on-surface transition hover:border-white/25 hover:bg-white/[0.08]"
                >
                  Play featured
                </Link>
              )}
            </div>
            {dataSource === 'mock' && (
              <p className="mt-5 text-body-md text-on-surface-variant/80">
                Demo catalog. Import a ROM or connect PocketBase to populate real entries.
              </p>
            )}
          </div>

          {featured && (
            <Link
              to={`/game/${featured.slug}`}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-surface-container/60 shadow-2xl transition hover:border-white/20"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <CoverArt
                  game={featured}
                  className="transition duration-700 group-hover:scale-[1.04]"
                />
              </div>
              <div className="flex flex-col gap-2 p-5">
                <span className="text-label-caps uppercase tracking-[0.2em] text-secondary">
                  Featured
                </span>
                <h2 className="text-headline-lg text-on-surface">{featured.title}</h2>
                <p className="line-clamp-2 text-body-md text-on-surface-variant">
                  {featured.description}
                </p>
              </div>
            </Link>
          )}
        </section>

        <div className="glass-panel mb-8 flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center md:justify-between">
          <GenreChips genres={GENRES} value={genre} onChange={setGenre} />
          <SearchBar value={search} onChange={setSearch} />
        </div>

        {isError ? (
          <EmptyState
            icon="error"
            title="Could not load the catalog"
            description="Check the PocketBase URL and that the games collection is reachable."
            action={
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-2 rounded-lg bg-primary px-4 py-2 text-body-md font-semibold text-on-primary"
              >
                Retry
              </button>
            }
          />
        ) : isLoading ? (
          <GridSkeleton />
        ) : games.length === 0 ? (
          <EmptyState
            icon="search_off"
            title="No games match"
            description="Try a different search or genre, or import a ROM to add a title to the catalog."
            action={
              <Link
                to="/admin"
                className="mt-2 rounded-lg bg-primary px-4 py-2 text-body-md font-semibold text-on-primary"
              >
                Import a ROM
              </Link>
            }
          />
        ) : (
          <>
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-headline-lg text-on-surface">Library</h2>
              <span className="text-body-md text-on-surface-variant">
                {games.length} of {total} titles
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {games.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
