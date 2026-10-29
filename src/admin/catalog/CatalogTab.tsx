import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminClient } from '@/admin/lib/pb';
import { replaceGameRom } from '@/admin/lib/importer';
import { describeEnrichment, enrichGame } from '@/admin/metadata/enrich';
import { uploadManualCover } from '@/admin/metadata/artwork';
import type { Region } from '@/types/games';
import { Dialog } from '@/components/Dialog';
import { formatBytes } from '@/lib/format';
import { showToast } from '@/lib/toast';

const PAGE_SIZE = 20;

type GameRecord = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function toDateInput(value: string): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

async function fetchGames(page: number) {
  const result = await adminClient
    .collection('games')
    .getList<GameRecord>(page, PAGE_SIZE, { sort: 'title' });
  return {
    items: result.items,
    totalItems: result.totalItems,
    totalPages: Math.max(1, result.totalPages),
  };
}

function fieldClass(): string {
  return 'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-body-md text-on-surface outline-none transition focus:border-primary/60';
}

function GameEditor({
  record,
  onClose,
  onSaved,
}: {
  record: GameRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: str(record.title),
    description: str(record.description),
    region: str(record.region) || 'NTSC-U',
    genre: str(record.genre),
    developer: str(record.developer),
    publisher: str(record.publisher),
    release: toDateInput(str(record.release)),
    players: str(record.players),
  });
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [coverBusy, setCoverBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await adminClient.collection('games').update(str(record.id), {
        ...form,
        release: form.release ? `${form.release} 00:00:00.000Z` : '',
      });
      showToast('Game updated.', { kind: 'success' });
      onSaved();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update the game.', {
        kind: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const replace = async (file: File | undefined) => {
    if (!file) return;
    setReplacing(true);
    setProgress(0);
    try {
      await replaceGameRom(str(record.id), file, setProgress);
      showToast('ROM replaced and hashes updated.', { kind: 'success' });
      onSaved();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not replace the ROM.', {
        kind: 'error',
      });
    } finally {
      setReplacing(false);
    }
  };

  const setCover = async (file: File | undefined) => {
    if (!file) return;
    setCoverBusy(true);
    try {
      await uploadManualCover(str(record.id), file);
      showToast('Cover updated. Provenance marked as manual.', { kind: 'success' });
      onSaved();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not upload the cover.', {
        kind: 'error',
      });
    } finally {
      setCoverBusy(false);
    }
  };

  const syncFromDataset = async () => {
    setRefreshing(true);
    try {
      const result = await enrichGame({
        id: str(record.id),
        crc32: str(record.rom_crc32) || undefined,
        title: str(record.title),
        region: (str(record.region) || 'NTSC-U') as Region,
        // A slug recorded by a previous sync skips resolution; older records
        // may hold a No-Intro name here, which the dataset lookup treats as a
        // stale hint and falls through to the checksum.
        metadataId: str(record.metadata_id) || undefined,
        manualCover: str(record.metadata_source) === 'manual',
      });
      const changed = result.resolved && (result.metadata || result.cover || result.screenshots > 0);
      showToast(`Dataset sync: ${describeEnrichment(result)}.`, {
        kind: changed ? 'success' : 'info',
      });
      if (changed) onSaved();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section className="glass-panel mt-6 rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label-caps uppercase tracking-[0.18em] text-on-surface-variant">
            Editing
          </p>
          <h2 className="mt-1 text-headline-lg text-on-surface">{form.title || 'Untitled'}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-body-md text-on-surface-variant transition hover:border-white/20 hover:text-on-surface"
        >
          Close
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
            Title
          </span>
          <input
            value={form.title}
            onChange={(event) => update('title', event.target.value)}
            className={fieldClass()}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
            Genre
          </span>
          <input
            value={form.genre}
            onChange={(event) => update('genre', event.target.value)}
            className={fieldClass()}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
            Developer
          </span>
          <input
            value={form.developer}
            onChange={(event) => update('developer', event.target.value)}
            className={fieldClass()}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
            Publisher
          </span>
          <input
            value={form.publisher}
            onChange={(event) => update('publisher', event.target.value)}
            className={fieldClass()}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
            Region
          </span>
          <select
            value={form.region}
            onChange={(event) => update('region', event.target.value)}
            className={fieldClass()}
          >
            <option value="NTSC-U">NTSC-U</option>
            <option value="NTSC-J">NTSC-J</option>
            <option value="PAL">PAL</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
            Release
          </span>
          <input
            type="date"
            value={form.release}
            onChange={(event) => update('release', event.target.value)}
            className={fieldClass()}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
            Players
          </span>
          <input
            value={form.players}
            onChange={(event) => update('players', event.target.value)}
            className={fieldClass()}
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-label-caps uppercase tracking-[0.16em] text-on-surface-variant">
            Description
          </span>
          <textarea
            rows={4}
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
            className={fieldClass()}
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-gradient-to-br from-primary to-tertiary-container px-4 py-2 text-body-md font-semibold text-on-primary transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save metadata'}
        </button>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-body-md font-semibold text-on-surface transition hover:border-white/25">
          <input
            type="file"
            accept=".sfc,.smc,.fig,.swc,.bin"
            className="sr-only"
            onChange={(event) => void replace(event.target.files?.[0])}
          />
          Replace ROM
        </label>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-body-md font-semibold text-on-surface transition hover:border-white/25">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => void setCover(event.target.files?.[0])}
          />
          {coverBusy ? 'Uploading cover…' : 'Replace cover'}
        </label>

        <button
          type="button"
          onClick={() => void syncFromDataset()}
          disabled={refreshing}
          className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-body-md font-semibold text-on-surface transition hover:border-white/25 disabled:opacity-50"
        >
          {refreshing ? 'Syncing…' : 'Sync from dataset'}
        </button>

        {replacing && (
          <span className="text-body-md text-on-surface-variant">
            Uploading… {progress}%
          </span>
        )}
      </div>
    </section>
  );
}

export function CatalogTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<GameRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GameRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const games = useQuery({ queryKey: ['admin-games', page], queryFn: () => fetchGames(page) });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-games'] });
    void queryClient.invalidateQueries({ queryKey: ['games'] });
    void queryClient.invalidateQueries({ queryKey: ['game'] });
  };

  const handleDelete = async (record: GameRecord) => {
    const id = str(record.id);
    const title = str(record.title) || id;

    setDeletingId(id);
    try {
      await adminClient.collection('games').delete(id);
      showToast(`Deleted ${title}.`, { kind: 'success' });
      setPendingDelete(null);
      invalidate();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete the game.', {
        kind: 'error',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-headline-lg text-on-surface">Catalog</h2>
        <p className="text-body-md text-on-surface-variant">
          {games.data ? `${games.data.totalItems} game${games.data.totalItems === 1 ? '' : 's'}` : '—'}
        </p>
      </div>

      {games.isLoading && (
        <p className="mt-4 text-body-md text-on-surface-variant">Loading catalog…</p>
      )}
      {games.isError && (
        <p className="mt-4 rounded-xl border border-error/25 bg-error-container/10 px-4 py-3 text-body-md text-error">
          Could not load the catalog. Is PocketBase running?
        </p>
      )}
      {games.data && games.data.items.length === 0 && (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-body-md text-on-surface-variant">
          No games yet. Identify a ROM in the Identify tab and add it to the catalog.
        </p>
      )}

      {games.data && games.data.items.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-body-md">
            <thead className="bg-white/[0.03] text-label-caps uppercase tracking-[0.14em] text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">CRC32</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {games.data.items.map((record) => {
                const id = str(record.id);
                return (
                  <tr key={id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-on-surface">{str(record.title) || 'Untitled'}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{str(record.region) || '—'}</td>
                    <td className="px-4 py-3 font-mono text-on-surface-variant">
                      {str(record.rom_crc32) || '—'}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {num(record.rom_size) !== undefined ? formatBytes(num(record.rom_size)!) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(record)}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-body-md text-on-surface transition hover:border-white/25"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(record)}
                          disabled={deletingId === id}
                          className="rounded-lg border border-error/30 px-3 py-1.5 text-body-md text-error transition hover:bg-error/10 disabled:opacity-50"
                        >
                          {deletingId === id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {games.data && games.data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-body-md text-on-surface-variant transition hover:border-white/25 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-body-md text-on-surface-variant">
            Page {page} of {games.data.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(games.data!.totalPages, current + 1))}
            disabled={page >= games.data.totalPages}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-body-md text-on-surface-variant transition hover:border-white/25 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {editing && (
        <GameEditor
          key={str(editing.id)}
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={invalidate}
        />
      )}

      <Dialog
        open={Boolean(pendingDelete)}
        title="Delete game?"
        onClose={() => setPendingDelete(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              className="rounded-lg border border-white/10 px-4 py-2 text-body-md text-on-surface-variant transition hover:border-white/20 hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => pendingDelete && void handleDelete(pendingDelete)}
              className="rounded-lg bg-error px-4 py-2 text-body-md font-semibold text-on-error transition hover:brightness-110"
            >
              Delete
            </button>
          </>
        }
      >
        <p>
          Delete{' '}
          {pendingDelete
            ? `“${str(pendingDelete.title) || str(pendingDelete.id)}”`
            : 'this game'}{' '}
          and its ROM variants? This cannot be undone.
        </p>
      </Dialog>
    </section>
  );
}
