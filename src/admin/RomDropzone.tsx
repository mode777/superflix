import { useRef, useState } from 'react';
import { cn } from '@/lib/cn';

const ROM_EXTENSIONS = /\.(sfc|smc|fig|swc|bin)$/i;

export function RomDropzone({
  onFile,
  disabled = false,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleList = (list: FileList | null) => {
    if (!list) return;
    const file = Array.from(list).find((item) => ROM_EXTENSIONS.test(item.name));
    if (file) onFile(file);
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
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) handleList(event.dataTransfer.files);
      }}
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
        <p className="text-headline-lg text-on-surface">Drop a SNES ROM here</p>
        <p className="text-body-md text-on-surface-variant">
          <span className="text-on-surface">.sfc</span>,{' '}
          <span className="text-on-surface">.smc</span>,{' '}
          <span className="text-on-surface">.fig</span>,{' '}
          <span className="text-on-surface">.swc</span> — identified in your browser, never
          uploaded.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".sfc,.smc,.fig,.swc,.bin"
        className="hidden"
        onChange={(event) => {
          handleList(event.target.files);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg bg-gradient-to-br from-primary to-secondary-container px-4 py-2 text-body-md font-semibold text-on-primary transition hover:brightness-110 disabled:opacity-50"
      >
        Select ROM
      </button>
    </div>
  );
}
