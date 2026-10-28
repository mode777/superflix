import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const state = {
    user: { id: 'u1', email: 'player@example.com' } as { id: string; email: string } | null,
    favorites: [] as Array<{ id: string; game: string }>,
  };
  const getFullList = vi.fn(async () => state.favorites);
  const create = vi.fn(async (data: { game: string }) => {
    state.favorites = [...state.favorites, { id: `f${state.favorites.length + 1}`, game: data.game }];
  });
  const remove = vi.fn(async (id: string) => {
    state.favorites = state.favorites.filter((favorite) => favorite.id !== id);
  });
  const toast = vi.fn();
  const collection = vi.fn(() => ({ getFullList, create, delete: remove }));

  return { state, getFullList, create, remove, toast, collection };
});

vi.mock('@/lib/pb', () => ({
  pb: {
    collection: h.collection,
    filter: (_expression: string, params: Record<string, string>) => JSON.stringify(params),
  },
}));

vi.mock('@/features/auth/authStore', () => ({
  useAuthStore: (selector: (state: { user: unknown; isAuthenticated: boolean }) => unknown) =>
    selector({ user: h.state.user, isAuthenticated: Boolean(h.state.user) }),
}));

vi.mock('@/lib/toast', () => ({ showToast: h.toast }));

const { useFavorites } = await import('./useFavorites');

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  h.state.user = { id: 'u1', email: 'player@example.com' };
  h.state.favorites = [];
  vi.clearAllMocks();
});

describe('useFavorites', () => {
  it('loads the current user favorites', async () => {
    h.state.favorites = [{ id: 'f1', game: 'g1' }];

    const { result } = renderHook(() => useFavorites(), { wrapper });

    await waitFor(() => expect(result.current.isFavorite('g1')).toBe(true));
    expect(h.collection).toHaveBeenCalledWith('favorites');
  });

  it('creates a favorite and refetches', async () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(h.getFullList).toHaveBeenCalled());

    await act(async () => {
      await result.current.toggle('g2');
    });

    expect(h.create).toHaveBeenCalledWith({ user: 'u1', game: 'g2' });
    await waitFor(() => expect(result.current.isFavorite('g2')).toBe(true));
  });

  it('removes an existing favorite', async () => {
    h.state.favorites = [{ id: 'f1', game: 'g1' }];
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.isFavorite('g1')).toBe(true));

    await act(async () => {
      await result.current.toggle('g1');
    });

    expect(h.remove).toHaveBeenCalledWith('f1');
    await waitFor(() => expect(result.current.isFavorite('g1')).toBe(false));
  });

  it('prompts guests to sign in instead of writing', async () => {
    h.state.user = null;
    const { result } = renderHook(() => useFavorites(), { wrapper });

    await act(async () => {
      await result.current.toggle('g1');
    });

    expect(h.create).not.toHaveBeenCalled();
    expect(h.toast).toHaveBeenCalledWith('Sign in to save favorites.', { kind: 'info' });
  });

  it('ignores duplicate-create unique violations', async () => {
    h.create.mockRejectedValueOnce({ status: 400, message: 'validation_not_unique' });
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(h.getFullList).toHaveBeenCalled());

    await act(async () => {
      await result.current.toggle('g2');
    });

    expect(h.toast).not.toHaveBeenCalledWith('Could not update favorites.', { kind: 'error' });
  });
});
