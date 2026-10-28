import { create } from 'zustand';
import { adminClient } from './pb';
import type { AdminUser } from './pb-auth';

type AdminAuthState = {
  user: AdminUser | null;
  isAuthenticated: boolean;
  setUser: (user: AdminUser | null) => void;
};

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  user: (adminClient.authStore.record as unknown as AdminUser | null) ?? null,
  isAuthenticated: adminClient.authStore.isValid,
  setUser: (user) => set({ user, isAuthenticated: Boolean(user) }),
}));

adminClient.authStore.onChange(() => {
  useAdminAuthStore
    .getState()
    .setUser((adminClient.authStore.record as unknown as AdminUser | null) ?? null);
});
