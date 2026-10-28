import PocketBase, { LocalAuthStore } from 'pocketbase';
import { pb } from '@/lib/pb';

/**
 * Dedicated admin client. It uses a separate localStorage key so a superuser
 * session never overwrites a future end-user session (the player is public).
 */
export const adminAuthStore = new LocalAuthStore('superflix_admin_auth');

export const adminClient = new PocketBase(pb.baseURL, adminAuthStore);
adminClient.autoCancellation(false);
