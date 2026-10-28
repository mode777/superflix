import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pb } from '@/lib/pb';
import { useAuthStore } from '@/features/auth/authStore';
import { showToast } from '@/lib/toast';

export function useFavorites() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['favorites', user?.id ?? 'guest'],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) return [];
      return pb
        .collection('favorites')
        .getFullList({ filter: pb.filter('user = {:user}', { user: user.id }) });
    },
  });

  const favoriteIds = new Set((query.data ?? []).map((record) => String(record.game)));

  const toggle = async (gameId: string) => {
    if (!user) {
      showToast('Sign in to save favorites.', { kind: 'info' });
      return;
    }

    const existing = (query.data ?? []).find((record) => String(record.game) === gameId);

    try {
      if (existing) {
        await pb.collection('favorites').delete(existing.id);
      } else {
        await pb.collection('favorites').create({ user: user.id, game: gameId });
      }
    } catch (error) {
      const status = (error as { status?: number }).status;
      const serialized = JSON.stringify(error);
      if (!(status === 400 && serialized.includes('validation_not_unique'))) {
        showToast('Could not update favorites.', { kind: 'error' });
        return;
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['favorites', user.id] });
  };

  return {
    favoriteIds,
    isFavorite: (gameId: string) => favoriteIds.has(gameId),
    toggle,
    isLoading: query.isLoading,
  };
}
