import { useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  collectRomFiles,
  romCandidatesFromFiles,
  type FileSystemEntryLike,
  type RomCandidate,
} from '@/admin/lib/romIntake';

/**
 * Batch ROM intake: accepts any number of ROM files (multi-select or dropped
 * together), a folder picked with the directory picker, or a dropped folder —
 * the tree is scanned recursively. Emits one candidate per ROM file found.
 */
export function RomDropzone({
  onFiles,
  disabled = false,
}: {
  onFiles: (candidates: RomCandidate[]) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleList = (list: FileList | null) => {
    if (!list) return;
    const candidates = romCandidatesFromFiles(Array.from(list));
    if (candidates.length > 0) onFiles(candidates);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;

    const transfer = event.dataTransfer;
    // `webkitGetAsEntry` must be called synchronously within the drop handler;
    // entries stay usable afterwards, the items list does not.
    const entries: FileSystemEntryLike[] = [];
    for (const item of Array.from(transfer.items ?? [])) {
      const entry =
        typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
      if (entry) entries.push(entry as FileSystemEntryLike);
    }

    if (entries.length > 0) {
      void collectRomFiles(entries).then((candidates) => {
        if (candidates.length > 0) onFiles(candidates);
      });
      return;
    }

    const candidates = romCandidatesFromFiles(Array.from(transfer.files ?? []));
    if (candidates.length > 0) onFiles(candidates);
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-2xl border p-10 text-center transition-colors',
        dragging
          ? 'border-primary bg-primary/5'
          : disabled
            ? 'border-white/10 opacity-60'
            : 'border-dashed border-white/15 hover:border-white/30',
      )}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragging(false);
      }}
      onDrop={handleDrop}
    >
      <span
        className={cn(
          'material-symbols-outlined text-[44px]',
          dragging ? 'text-primary' : 'text-on-surface-variant',
        )}
        aria-hidden="true"
      >
        memory
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-headline-lg text-on-surface">Drop SNES ROMs or a folder here</p>
        <p className="text-body-md text-on-surface-variant">
          <span className="text-on-surface">.sfc</span>,{' '}
          <span className="text-on-surface">.smc</span>,{' '}
          <span className="text-on-surface">.fig</span>,{' '}
          <span className="text-on-surface">.swc</span>,{' '}
          <span className="text-on-surface">.bin</span> — folders are scanned recursively,
          and everything is identified in your browser, never uploaded.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".sfc,.smc,.fig,.swc,.bin"
        multiple
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          handleList(event.target.files);
          event.target.value = '';
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        accept=".sfc,.smc,.fig,.swc,.bin"
        {...({ webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          handleList(event.target.files);
          event.target.value = '';
        }}
      />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-gradient-to-br from-primary to-tertiary-container px-4 py-2 text-body-md font-semibold text-on-primary transition hover:brightness-110 disabled:opacity-50"
        >
          Select ROMs
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => folderInputRef.current?.click()}
          className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-body-md font-semibold text-on-surface transition hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-50"
        >
          Select folder
        </button>
      </div>
    </div>
  );
}
