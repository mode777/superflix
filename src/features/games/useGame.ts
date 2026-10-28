import { useQuery } from '@tanstack/react-query';
import { dataSource, pb } from '@/lib/pb';
import { MOCK_GAMES } from '@/data/mockGames';
import { useLocalGameStore } from '@/features/console/localGameStore';
import { mapGameRecord } from './mapGame';
import type { Game } from '@/types/games';

export function useGame(slug: string | undefined) {
  const localGame = useLocalGameStore((state) => (slug ? state.games[slug] : undefined));

  return useQuery({
    queryKey: ['game', slug, dataSource, localGame?.id],
    enabled: Boolean(slug),
    initialData: localGame,
    queryFn: async (): Promise<Game | null> => {
      if (!slug) return null;
      if (localGame) return localGame;
      if (dataSource === 'mock') return MOCK_GAMES.find((game) => game.slug === slug) ?? null;

      try {
        const record = await pb
          .collection('games')
          .getFirstListItem(pb.filter('slug = {:slug}', { slug }));
        return mapGameRecord(record as unknown as Record<string, unknown>);
      } catch (error) {
        if ((error as { status?: number }).status === 404) return null;
        throw error;
      }
    },
  });
}
