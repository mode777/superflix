import { identifyRom } from '@/lib/snes/identify';
import type { DatIndex, RomIdentification } from '@/lib/snes/types';
import { deriveRegion, titleFromIdentification } from '@/features/games/slug';
import { previewEnrichment, type EnrichmentPreview } from '@/admin/metadata/enrich';
import type { Region } from '@/types/games';
import type { RomCandidate } from './romIntake';

/**
 * Staged import queue: owns the entries picked from files/folders and their
 * transitions through identification, dataset preview, and commit.
 * Framework-free — React binds through `subscribe`/`getSnapshot`
 * (see useImportQueue.ts).
 */

export type QueueEntryStatus =
  | 'pending'
  | 'identifying'
  | 'previewing'
  | 'ready'
  | 'failed'
  | 'uploading'
  | 'done'
  | 'duplicate'
  | 'variant'
  | 'error';

export interface QueueEntry {
  id: string;
  file: File;
  /** Path within the original selection ("Folder/Sub/game.sfc"). */
  path: string;
  status: QueueEntryStatus;
  /** Present once identification completed. */
  identification?: RomIdentification;
  /** Fetched dataset preview (fields, cover, screenshots) held for review. */
  preview?: EnrichmentPreview;
  /** The dataset could not be reached: the draft stays committable, identification-only. */
  previewFailed?: boolean;
  /** Failure reason for `failed`/`error` entries. */
  error?: string;
  /** Existing game link for `duplicate`/`variant` outcomes. */
  result?: { slug: string; title: string };
}

export interface ImportQueueSnapshot {
  entries: readonly QueueEntry[];
  /** Identification scan progress (done / total entries). */
  scan: { done: number; total: number };
}

/** Input for the dataset preview of one identified entry. */
export interface PreviewInput {
  crc32: string;
  title: string;
  region: Region;
  noIntroName?: string;
}

export interface ScanOptions {
  /** Loaded No-Intro index; absent when the DAT could not be fetched. */
  datIndex?: DatIndex | null;
  /** Dataset preview runner (default: the real `previewEnrichment`). */
  preview?: (input: PreviewInput) => Promise<EnrichmentPreview>;
}

let nextId = 0;

export class ImportQueue {
  private listeners = new Set<() => void>();
  private entries: QueueEntry[] = [];
  private scan = { done: 0, total: 0 };
  private snapshot: ImportQueueSnapshot = { entries: this.entries, scan: this.scan };
  private scanning = false;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ImportQueueSnapshot => this.snapshot;

  /** Append candidates as pending entries and restart the identification scan. */
  addCandidates(candidates: RomCandidate[]): void {
    if (candidates.length === 0) return;
    this.entries = [
      ...this.entries,
      ...candidates.map((candidate) => ({
        id: `rom-${nextId++}`,
        file: candidate.file,
        path: candidate.path,
        status: 'pending' as const,
      })),
    ];
    this.publish();
  }

  /** Drop an entry and release anything it holds. */
  remove(id: string): void {
    const removed = this.entries.find((entry) => entry.id === id);
    this.entries = this.entries.filter((entry) => entry.id !== id);
    // An already-processed entry must not keep the scan counter waiting for it.
    if (removed && (removed.status === 'ready' || removed.status === 'failed')) {
      this.scan = { ...this.scan, done: Math.max(0, this.scan.done - 1) };
    }
    this.publish();
  }

  /**
   * Identify every pending entry, one file at a time (hash-wasm is CPU-bound),
   * including entries enqueued while the scan is running. A failing entry ends
   * `failed`; the remaining entries continue.
   */
  async scanAll(options: ScanOptions = {}): Promise<void> {
    if (this.scanning) return;
    this.scanning = true;
    try {
      for (;;) {
        const pending = this.entries.filter((entry) => entry.status === 'pending');
        if (pending.length === 0) break;
        const next = pending[0]!;
        this.scan = { done: this.scan.done, total: this.scan.done + pending.length };
        this.publish();
        this.update(next.id, { status: 'identifying' });
        const stillQueued = () => this.entries.some((entry) => entry.id === next.id);

        let identification: RomIdentification;
        try {
          const bytes = new Uint8Array(await next.file.arrayBuffer());
          identification = await identifyRom(bytes, options.datIndex ?? undefined, next.file.name);
        } catch (error) {
          if (stillQueued()) {
            this.update(next.id, {
              status: 'failed',
              error: error instanceof Error ? error.message : String(error),
            });
            this.scan = { ...this.scan, done: this.scan.done + 1 };
            this.publish();
          }
          continue;
        }

        // Fetch the dataset preview for review (never writes); a failure leaves
        // the draft committable with identification-only values.
        this.update(next.id, { status: 'previewing' });
        const preview = await (options.preview ?? previewEnrichment)({
          crc32: identification.hashes.crc32,
          title: titleFromIdentification(identification.match?.name, identification.header?.title, next.file.name),
          region: deriveRegion(identification.match?.region, identification.header?.region),
          noIntroName: identification.match?.name,
        });
        this.update(next.id, {
          status: 'ready',
          identification,
          preview,
          previewFailed: Boolean(preview.unavailable),
          error: undefined,
        });
        if (stillQueued()) {
          this.scan = { ...this.scan, done: this.scan.done + 1 };
          this.publish();
        }
      }
    } finally {
      this.scanning = false;
    }
  }

  /** Commit-phase transition (uploading/done/duplicate/variant/error). */
  setCommitState(
    id: string,
    status: Extract<QueueEntryStatus, 'uploading' | 'done' | 'duplicate' | 'variant' | 'error'>,
    data: { error?: string; result?: { slug: string; title: string } } = {},
  ): void {
    this.update(id, { status, ...data });
  }

  /** Replace an entry's preview after a manual dataset re-match. */
  applyPreview(id: string, preview: EnrichmentPreview): void {
    this.update(id, {
      status: 'ready',
      preview,
      previewFailed: Boolean(preview.unavailable),
    });
  }

  private update(id: string, patch: Partial<QueueEntry>): void {
    this.entries = this.entries.map((entry) =>
      entry.id === id ? { ...entry, ...patch } : entry,
    );
    this.publish();
  }

  private publish(): void {
    this.snapshot = { entries: this.entries, scan: { ...this.scan } };
    for (const listener of this.listeners) listener();
  }
}
