import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AmbientBackground } from '@/components/media/AmbientBackground';
import { GameCard } from '@/components/media/GameCard';
import { GenreChips } from '@/components/media/GenreChips';
import { SearchBar } from '@/components/media/SearchBar';
import { EmptyState } from '@/components/EmptyState';
import { useGames } from '@/features/games/useGames';
import { useFavorites } from '@/features/favorites/useFavorites';
import { useAuthStore } from '@/features/auth/authStore';
import { ALL_GENRE, GENRES } from '@/types/games';

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
  const { favoriteIds } = useFavorites();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const favoriteGames = games.filter((game) => favoriteIds.has(game.id));

  return (
    <>
      <AmbientBackground />
      <main className="relative mx-auto max-w-page px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
        {isAuthenticated && favoriteGames.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-headline-lg text-on-surface">My favorites</h2>
              <span className="text-body-md text-on-surface-variant">
                {favoriteGames.length} title{favoriteGames.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {favoriteGames.map((favorite) => (
                <GameCard key={favorite.id} game={favorite} />
              ))}
            </div>
          </section>
        )}

        <div
          id="library"
          className="glass-panel mb-8 flex scroll-mt-32 flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center md:justify-between"
        >
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
