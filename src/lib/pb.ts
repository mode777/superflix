import PocketBase from 'pocketbase';

const url =
  import.meta.env.VITE_PB_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8090' : window.location.origin);

export const pb = new PocketBase(url);
pb.autoCancellation(false);

/**
 * The app runs with a mock catalog until a PocketBase instance is configured.
 * Set VITE_DATA_SOURCE=pocketbase (or VITE_PB_URL) to use the real backend.
 */
export type DataSource = 'mock' | 'pocketbase';

export const dataSource: DataSource =
  (import.meta.env.VITE_DATA_SOURCE as DataSource | undefined) ??
  (import.meta.env.DEV ? 'mock' : 'pocketbase');
