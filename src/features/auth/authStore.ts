import { create } from 'zustand';
import { pb } from '@/lib/pb';

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
};

function currentUser(): AuthUser | null {
  return (pb.authStore.record as unknown as AuthUser | null) ?? null;
}

/** Mirror of the public PocketBase client's auth store. */
export const useAuthStore = create<AuthState>((set) => ({
  user: currentUser(),
  isAuthenticated: pb.authStore.isValid,
  setUser: (user) => set({ user, isAuthenticated: Boolean(user) }),
}));

pb.authStore.onChange(() => {
  useAuthStore.getState().setUser(currentUser());
});
