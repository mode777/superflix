import { useQuery } from '@tanstack/react-query';
import { dataSource, pb } from '@/lib/pb';
import { MOCK_GAMES } from '@/data/mockGames';
import { DEMO_GAME } from '@/data/demoGame';
import { mapGameRecord } from './mapGame';
import type { Game, GameFilters } from '@/types/games';

async function fetchGames(): Promise<Game[]> {
  if (dataSource === 'mock') return MOCK_GAMES;
  const records = await pb.collection('games').getFullList({ sort: 'title' });
  const games = records.map((record) =>
    mapGameRecord(record as unknown as Record<string, unknown>),
  );
  // A fresh instance has schema but no content; keep the bundled demo playable.
  return games.length > 0 ? games : [DEMO_GAME];
}

export function useGames(filters: GameFilters) {
  const query = useQuery({
    queryKey: ['games', dataSource],
    queryFn: fetchGames,
  });

  const games = query.data ?? [];
  const search = filters.search.trim().toLowerCase();

  const filtered = games.filter((game) => {
    const matchesGenre = filters.genre === 'All' || game.genre === filters.genre;
    const matchesSearch =
      !search ||
      [game.title, game.developer, game.publisher, game.genre].some((value) =>
        value.toLowerCase().includes(search),
      );
    return matchesGenre && matchesSearch;
  });

  return { ...query, games: filtered, total: games.length };
}
