import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  type Listener = () => void;
  const listeners: Listener[] = [];
  const authStore = {
    record: null as Record<string, unknown> | null,
    isValid: false,
    token: '',
    clear: vi.fn(() => {
      authStore.record = null;
      authStore.isValid = false;
      listeners.forEach((listener) => listener());
    }),
    onChange: vi.fn((listener: Listener) => {
      listeners.push(listener);
      return () => undefined;
    }),
  };

  function applySession(record: Record<string, unknown>) {
    authStore.record = record;
    authStore.isValid = true;
    listeners.forEach((listener) => listener());
  }

  const authWithPassword = vi.fn(async (email: string) => {
    applySession({ id: 'u1', email });
    return { record: { id: 'u1', email } };
  });
  const create = vi.fn(async () => ({ id: 'u1' }));

  const collection = vi.fn(() => ({
    authWithPassword,
    create,
  }));

  return { listeners, authStore, collection, applySession, authWithPassword, create };
});

vi.mock('@/lib/pb', () => ({
  pb: {
    collection: h.collection,
    authStore: h.authStore,
  },
}));

const { auth } = await import('./auth');
const { useAuthStore } = await import('./authStore');

beforeEach(() => {
  vi.clearAllMocks();
  h.authStore.record = null;
  h.authStore.isValid = false;
  useAuthStore.getState().setUser(null);
});

describe('auth', () => {
  it('signs in and mirrors the session into the store', async () => {
    await expect(auth.signIn('player@example.com', 'password123')).resolves.toEqual({
      id: 'u1',
      email: 'player@example.com',
    });

    expect(h.collection).toHaveBeenCalledWith('users');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.email).toBe('player@example.com');
  });

  it('rejects invalid credentials without creating a session', async () => {
    h.authWithPassword.mockRejectedValueOnce(new Error('Invalid credentials.'));

    await expect(auth.signIn('player@example.com', 'wrong')).rejects.toThrow('Invalid credentials.');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('creates an account and signs in', async () => {
    await expect(auth.signUp('new@example.com', 'password123')).resolves.toEqual({
      id: 'u1',
      email: 'new@example.com',
    });

    expect(h.create).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
      passwordConfirm: 'password123',
    });
    expect(h.authWithPassword).toHaveBeenCalledWith('new@example.com', 'password123');
  });

  it('signs out and clears the mirrored session', async () => {
    await auth.signIn('player@example.com', 'password123');
    auth.signOut();

    expect(h.authStore.clear).toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('initializes from an existing persisted session', async () => {
    vi.resetModules();
    h.authStore.record = { id: 'u2', email: 'saved@example.com' };
    h.authStore.isValid = true;

    const fresh = await import('./authStore');

    expect(fresh.useAuthStore.getState().isAuthenticated).toBe(true);
    expect(fresh.useAuthStore.getState().user?.email).toBe('saved@example.com');
  });
});
