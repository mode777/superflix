import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@/components/Dialog';
import type { DatasetTitleEntry } from '@/lib/snes-dataset';
import { listDatasetTitles } from './metadata/dataset';

export interface DatasetMatch {
  slug: string;
  title: string;
}

interface DatasetMatchPickerProps {
  initialQuery: string;
  loadTitles: () => Promise<DatasetTitleEntry[]>;
  onSelect: (match: DatasetMatch) => void;
}

/**
 * The picker body. Mounted fresh per open (keyed by the initial query), so the
 * filter starts from the given title and the index load restarts.
 */
function DatasetMatchPicker({ initialQuery, loadTitles, onSelect }: DatasetMatchPickerProps) {
  const [titles, setTitles] = useState<DatasetTitleEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    let active = true;
    loadTitles()
      .then((entries) => {
        if (active) setTitles(entries);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [loadTitles]);

  const matches = useMemo(() => {
    if (!titles) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return titles;
    return titles.filter((entry) => entry.title.toLowerCase().includes(needle));
  }, [titles, query]);

  return (
    <div className="flex flex-col gap-3">
      <p>
        Not in the dataset by hash or title? Pick the entry this ROM corresponds to and its
        metadata and artwork are applied.
      </p>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter by title…"
        aria-label="Filter dataset titles"
        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-body-md text-on-surface outline-none transition focus:border-primary/60"
      />

      {failed && <p className="text-body-md text-error">Could not load the dataset index.</p>}
      {!failed && titles === null && <p>Loading the dataset index…</p>}
      {titles !== null && matches.length === 0 && (
        <p>No dataset entries match “{query.trim()}”.</p>
      )}
      {titles !== null && matches.length > 0 && (
        <ul
          aria-label="Dataset entries"
          className="max-h-80 overflow-y-auto rounded-lg border border-white/10"
        >
          {matches.map((entry) => (
            <li key={entry.slug}>
              <button
                type="button"
                onClick={() => onSelect({ slug: entry.slug, title: entry.title })}
                className="w-full border-b border-white/5 px-3 py-2 text-left text-body-md text-on-surface transition last:border-b-0 hover:bg-white/[0.06]"
              >
                {entry.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface DatasetMatchModalProps {
  open: boolean;
  /** Pre-filled quick filter, usually the game's title. */
  initialQuery?: string;
  /** Title index loader; injectable for tests. */
  loadTitles?: () => Promise<DatasetTitleEntry[]>;
  onSelect: (match: DatasetMatch) => void;
  onDismiss: () => void;
}

/**
 * Manual dataset match picker: a quick-filterable list of every snes-dataset
 * title index entry (spec: manual dataset match when automatic resolution
 * fails). Dismissing never touches the record.
 */
export function DatasetMatchModal({
  open,
  initialQuery = '',
  loadTitles = listDatasetTitles,
  onSelect,
  onDismiss,
}: DatasetMatchModalProps) {
  return (
    <Dialog open={open} title="Match in dataset" onClose={onDismiss}>
      {open && (
        <DatasetMatchPicker
          key={initialQuery}
          initialQuery={initialQuery}
          loadTitles={loadTitles}
          onSelect={onSelect}
        />
      )}
    </Dialog>
  );
}
