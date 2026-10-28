import { pb } from '@/lib/pb';
import type { AuthUser } from './authStore';

function userFromStore(): AuthUser | null {
  return (pb.authStore.record as unknown as AuthUser | null) ?? null;
}

export const auth = {
  async signUp(email: string, password: string): Promise<AuthUser> {
    await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
    });
    const result = await pb.collection('users').authWithPassword(email, password);
    return result.record as unknown as AuthUser;
  },

  async signIn(email: string, password: string): Promise<AuthUser> {
    const result = await pb.collection('users').authWithPassword(email, password);
    return result.record as unknown as AuthUser;
  },

  signOut(): void {
    pb.authStore.clear();
  },

  get currentUser(): AuthUser | null {
    return userFromStore();
  },

  isAuthenticated(): boolean {
    return pb.authStore.isValid;
  },
};
