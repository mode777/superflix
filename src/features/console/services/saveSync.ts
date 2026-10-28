import { idbDelete, idbGet, idbKeys, idbSet } from '@/lib/idb';
import { pb } from '@/lib/pb';
import type { SaveSlot } from '../types';
import { setSyncStatus } from './syncStore';

/** Core identity stamped on save states. */
export const CURRENT_CORE = 'snes9x';
export const CURRENT_CORE_VERSION = 'v1.22.0';

export interface LocalSave {
  blob: Blob;
  savedAt: number;
  core: string;
  coreVersion?: string;
}

const SAVE_SLOTS: SaveSlot[] = ['auto', 'slot1', 'slot2', 'slot3'];
const gameIdCache = new Map<string, string>();

const stateKey = (slug: string, slot: SaveSlot) => `state:${slug}:${slot}`;
const sramKey = (slug: string) => `sram:${slug}`;
const pendingStateKey = (slug: string, slot: SaveSlot) => `pending:state:${slug}:${slot}`;
const pendingSramKey = (slug: string) => `pending:sram:${slug}`;

function currentUserId(): string | null {
  return pb.authStore.isValid ? (pb.authStore.record?.id ?? null) : null;
}

function isSaveSlot(value: string): value is SaveSlot {
  return (SAVE_SLOTS as string[]).includes(value);
}

function assertCore(core: string): void {
  if (core && core !== CURRENT_CORE) {
    throw new Error(
      `This save was created on ${core}. Relaunch the game on ${core} to load it.`,
    );
  }
}

async function resolveGameId(slug: string): Promise<string | null> {
  const cached = gameIdCache.get(slug);
  if (cached) return cached;

  try {
    const record = await pb
      .collection('games')
      .getFirstListItem(pb.filter('slug = {:slug}', { slug }));
    gameIdCache.set(slug, record.id);
    return record.id;
  } catch {
    return null;
  }
}

async function findState(gameId: string, slot: SaveSlot, userId: string) {
  try {
    return await pb
      .collection('save_state')
      .getFirstListItem(
        pb.filter('type = {:type} && game = {:game} && user = {:user}', {
          type: slot,
          game: gameId,
          user: userId,
        }),
      );
  } catch {
    return null;
  }
}

async function findSram(gameId: string, userId: string) {
  try {
    return await pb
      .collection('sram')
      .getFirstListItem(
        pb.filter('game = {:game} && user = {:user}', { game: gameId, user: userId }),
      );
  } catch {
    return null;
  }
}

async function pushState(slug: string, slot: SaveSlot, blob: Blob): Promise<boolean> {
  const user = currentUserId();
  if (!user) return false;

  const game = await resolveGameId(slug);
  if (!game) return false;

  const existing = await findState(game, slot, user);
  const fields = {
    type: slot,
    game,
    user,
    core: CURRENT_CORE,
    core_version: CURRENT_CORE_VERSION,
    data: new File([blob], `${slot}.state`, { type: 'application/octet-stream' }),
  };

  if (existing) await pb.collection('save_state').update(existing.id, fields);
  else await pb.collection('save_state').create(fields);
  return true;
}

async function pushSram(slug: string, blob: Blob): Promise<boolean> {
  const user = currentUserId();
  if (!user) return false;

  const game = await resolveGameId(slug);
  if (!game) return false;

  const existing = await findSram(game, user);
  const fields = {
    game,
    user,
    data: new File([blob], `${slug}.srm`, { type: 'application/octet-stream' }),
  };

  if (existing) await pb.collection('sram').update(existing.id, fields);
  else await pb.collection('sram').create(fields);
  return true;
}

async function cloudState(slug: string, slot: SaveSlot): Promise<{ record: Record<string, unknown> } | null> {
  const user = currentUserId();
  if (!user) return null;
  const game = await resolveGameId(slug);
  if (!game) return null;

  const record = await findState(game, slot, user);
  return record ? { record: record as unknown as Record<string, unknown> } : null;
}

async function cloudSram(slug: string): Promise<{ record: Record<string, unknown> } | null> {
  const user = currentUserId();
  if (!user) return null;
  const game = await resolveGameId(slug);
  if (!game) return null;

  const record = await findSram(game, user);
  return record ? { record: record as unknown as Record<string, unknown> } : null;
}

async function downloadFile(record: Record<string, unknown>): Promise<Blob> {
  const url = pb.files.getURL(
    { collectionId: String(record.collectionId), id: String(record.id) },
    String(record.data),
  );
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download the save (HTTP ${response.status}).`);
  return response.blob();
}

/** Save locally first, then push to the cloud for signed-in users. */
export async function saveState(slug: string, slot: SaveSlot, blob: Blob): Promise<void> {
  await idbSet<LocalSave>(stateKey(slug, slot), {
    blob,
    savedAt: Date.now(),
    core: CURRENT_CORE,
    coreVersion: CURRENT_CORE_VERSION,
  });

  if (!currentUserId()) {
    setSyncStatus('idle');
    return;
  }

  setSyncStatus('syncing');
  try {
    const pushed = await pushState(slug, slot, blob);
    await idbSet(pendingStateKey(slug, slot), !pushed);
    setSyncStatus(pushed ? 'synced' : 'idle');
  } catch (error) {
    await idbSet(pendingStateKey(slug, slot), true);
    setSyncStatus('error', error instanceof Error ? error.message : 'Could not sync the save.');
  }
}

/**
 * Local-first load with last-write-wins: the newer of the local copy and the
 * cloud copy wins. On a cloud win the result is cached locally.
 */
export async function loadState(slug: string, slot: SaveSlot): Promise<Blob> {
  const local = await idbGet<LocalSave>(stateKey(slug, slot));
  const remote = await cloudState(slug, slot);
  const remoteSavedAt = remote ? Date.parse(String(remote.record.updated)) || 0 : 0;

  if (local && (!remote || local.savedAt >= remoteSavedAt)) {
    assertCore(local.core);
    return local.blob;
  }

  if (!remote) throw new Error('No saved state in this slot.');

  const core = String(remote.record.core ?? CURRENT_CORE);
  assertCore(core);

  setSyncStatus('syncing');
  try {
    const blob = await downloadFile(remote.record);
    await idbSet<LocalSave>(stateKey(slug, slot), {
      blob,
      savedAt: remoteSavedAt,
      core,
      coreVersion: String(remote.record.core_version ?? ''),
    });
    setSyncStatus('synced');
    return blob;
  } catch (error) {
    setSyncStatus('error', error instanceof Error ? error.message : 'Could not download the save.');
    throw error;
  }
}

export async function listSlots(slug: string): Promise<SaveSlot[]> {
  const prefix = `state:${slug}:`;
  const keys = await idbKeys();
  return keys
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length))
    .filter(isSaveSlot);
}

export async function deleteState(slug: string, slot: SaveSlot): Promise<void> {
  await idbDelete(stateKey(slug, slot));
  await idbDelete(pendingStateKey(slug, slot));

  const user = currentUserId();
  const game = user ? await resolveGameId(slug) : null;
  if (user && game) {
    const existing = await findState(game, slot, user);
    if (existing) await pb.collection('save_state').delete(existing.id);
  }
}

export async function saveSram(slug: string, blob: Blob): Promise<void> {
  await idbSet<LocalSave>(sramKey(slug), {
    blob,
    savedAt: Date.now(),
    core: CURRENT_CORE,
    coreVersion: CURRENT_CORE_VERSION,
  });

  if (!currentUserId()) {
    setSyncStatus('idle');
    return;
  }

  setSyncStatus('syncing');
  try {
    const pushed = await pushSram(slug, blob);
    await idbSet(pendingSramKey(slug), !pushed);
    setSyncStatus(pushed ? 'synced' : 'idle');
  } catch (error) {
    await idbSet(pendingSramKey(slug), true);
    setSyncStatus('error', error instanceof Error ? error.message : 'Could not sync the battery save.');
  }
}

/** Local-first battery save lookup with last-write-wins (used to offer a synced save). */
export async function availableSram(slug: string): Promise<Blob | null> {
  const local = await idbGet<LocalSave>(sramKey(slug));
  const remote = await cloudSram(slug);
  const remoteSavedAt = remote ? Date.parse(String(remote.record.updated)) || 0 : 0;

  if (local && (!remote || local.savedAt >= remoteSavedAt)) return local.blob;
  if (!remote) return null;

  try {
    const blob = await downloadFile(remote.record);
    await idbSet<LocalSave>(sramKey(slug), {
      blob,
      savedAt: remoteSavedAt,
      core: CURRENT_CORE,
    });
    return blob;
  } catch {
    return null;
  }
}

/** Retry uploads that failed during a previous session. */
export async function flushPending(slug: string): Promise<void> {
  if (!currentUserId()) return;

  const keys = await idbKeys();
  for (const key of keys.filter((item) => item.startsWith(`pending:state:${slug}:`))) {
    if (!(await idbGet<boolean>(key))) continue;
    const slot = key.split(':').pop() ?? '';
    if (!isSaveSlot(slot)) continue;
    const local = await idbGet<LocalSave>(stateKey(slug, slot));
    if (!local) continue;

    try {
      if (await pushState(slug, slot, local.blob)) {
        await idbSet(key, false);
        setSyncStatus('synced');
      }
    } catch {
      setSyncStatus('error');
      return;
    }
  }

  if (await idbGet<boolean>(pendingSramKey(slug))) {
    const local = await idbGet<LocalSave>(sramKey(slug));
    if (local) {
      try {
        await pushSram(slug, local.blob);
        await idbSet(pendingSramKey(slug), false);
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
    }
  }
}
