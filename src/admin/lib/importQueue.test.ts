// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportQueue, type QueueEntry } from './importQueue';
import type { EnrichmentPreview } from '@/admin/metadata/enrich';

const previewEnrichment = vi.hoisted(() => vi.fn());
vi.mock('@/admin/metadata/enrich', () => ({ previewEnrichment }));

const romPath = path.resolve(process.cwd(), 'public/roms/gothicvania.sfc');

const noDataset: EnrichmentPreview = { resolved: false, fields: {}, cover: null, screenshots: [] };

function candidate(name = 'gothicvania.sfc', bytes?: Uint8Array<ArrayBuffer>) {
  const data =
    bytes ??
    (() => {
      // Distinct bytes per name so staged files have distinct CRCs.
      const buffer = new Uint8Array(1024);
      buffer.set(new TextEncoder().encode(name), 0);
      return buffer;
    })();
  return { file: new File([data], name), path: `Library/${name}` };
}

function states(entries: readonly QueueEntry[]) {
  return entries.map((entry) => entry.status);
}

beforeEach(() => {
  previewEnrichment.mockReset();
  previewEnrichment.mockResolvedValue(noDataset);
});

describe('ImportQueue entries', () => {
  it('enqueues N candidates as N pending entries', () => {
    const queue = new ImportQueue();
    const listener = vi.fn();
    queue.subscribe(listener);

    queue.addCandidates([candidate(), candidate('b.smc'), candidate('c.fig')]);

    const { entries } = queue.getSnapshot();
    expect(entries).toHaveLength(3);
    expect(states(entries)).toEqual(['pending', 'pending', 'pending']);
    expect(entries[0]?.path).toBe('Library/gothicvania.sfc');
    expect(listener).toHaveBeenCalled();
  });

  it('removes the right entry', () => {
    const queue = new ImportQueue();
    queue.addCandidates([candidate(), candidate('b.smc')]);
    const { id } = queue.getSnapshot().entries[0]!;

    queue.remove(id);

    const { entries } = queue.getSnapshot();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.file.name).toBe('b.smc');
  });
});

describe('ImportQueue scanning', () => {
  it('identifies the bundled demo ROM and reaches ready with correct hashes', async () => {
    const bytes = new Uint8Array(readFileSync(romPath));
    const queue = new ImportQueue();
    queue.addCandidates([{ file: new File([bytes], 'gothicvania.sfc'), path: 'gothicvania.sfc' }]);

    await queue.scanAll();

    const entry = queue.getSnapshot().entries[0]!;
    expect(entry.status).toBe('ready');
    expect(entry.identification?.hashes.crc32).toBe('88D63376');
    expect(entry.identification?.header?.title).toBe('GOTHICVANIA CEMETERY');
    expect(queue.getSnapshot().scan).toEqual({ done: 1, total: 1 });
  });

  it('marks an unreadable entry failed without stopping the rest', async () => {
    const unreadable = {
      name: 'broken.sfc',
      arrayBuffer: () => Promise.reject(new Error('unreadable file')),
    } as unknown as File;
    const queue = new ImportQueue();
    queue.addCandidates([
      { file: unreadable, path: 'broken.sfc' },
      candidate('gothicvania.sfc'),
    ]);

    await queue.scanAll();

    const entries = queue.getSnapshot().entries;
    expect(states(entries)).toEqual(['failed', 'ready']);
    expect(entries[0]?.error).toBe('unreadable file');
    expect(queue.getSnapshot().scan).toEqual({ done: 2, total: 2 });
  });

  it('publishes per-entry transitions and scan progress while scanning', async () => {
    const queue = new ImportQueue();
    queue.addCandidates([candidate(), candidate('b.smc')]);
    const progress: Array<{ done: number; total: number; pendingStatuses: string[] }> = [];
    queue.subscribe(() => {
      const snapshot = queue.getSnapshot();
      progress.push({
        ...snapshot.scan,
        pendingStatuses: states(snapshot.entries),
      });
    });

    await queue.scanAll();

    // Sequential: exactly one entry is `identifying` while the rest wait.
    expect(progress.some((p) => p.pendingStatuses.includes('identifying'))).toBe(true);
    expect(progress.every((p) => p.pendingStatuses.filter((s) => s === 'identifying').length <= 1)).toBe(true);
    expect(progress.at(-1)?.done).toBe(2);
    expect(states(queue.getSnapshot().entries)).toEqual(['ready', 'ready']);
  });

  it('skips entries removed mid-scan and shrinks the total', async () => {
    const bytes = new Uint8Array(readFileSync(romPath));
    const queue = new ImportQueue();
    queue.addCandidates([
      candidate(),
      { file: new File([bytes], 'gothicvania.sfc'), path: 'gothicvania.sfc' },
    ]);
    const firstId = queue.getSnapshot().entries[0]!.id;
    let removed = false;
    queue.subscribe(() => {
      if (!removed && states(queue.getSnapshot().entries).includes('identifying')) {
        removed = true;
        queue.remove(firstId);
      }
    });

    await queue.scanAll();

    const { entries, scan } = queue.getSnapshot();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.status).toBe('ready');
    expect(scan.total).toBe(1);
  });
});

describe('ImportQueue previewing', () => {
  it('previews each identified entry with its checksum, title, and region', async () => {
    previewEnrichment.mockResolvedValue({
      resolved: true,
      slug: 'gothicvania',
      fields: { description: 'A demo game.' },
      cover: { blob: new Blob(['box'], { type: 'image/png' }), fileName: 'box.png', kind: 'boxart' },
      screenshots: [],
    });
    const bytes = new Uint8Array(readFileSync(romPath));
    const queue = new ImportQueue();
    queue.addCandidates([{ file: new File([bytes], 'gothicvania.sfc'), path: 'gothicvania.sfc' }]);

    await queue.scanAll({ datIndex: null });

    expect(previewEnrichment).toHaveBeenCalledWith({
      crc32: '88D63376',
      title: 'Gothicvania',
      region: 'NTSC-U',
      noIntroName: undefined,
    });
    const entry = queue.getSnapshot().entries[0]!;
    expect(entry.status).toBe('ready');
    expect(entry.preview?.resolved).toBe(true);
    expect(entry.preview?.fields.description).toBe('A demo game.');
    expect(entry.previewFailed).toBe(false);
  });

  it('stays committable with identification-only values when the preview fails', async () => {
    previewEnrichment.mockResolvedValue({ ...noDataset, unavailable: true });
    const bytes = new Uint8Array(readFileSync(romPath));
    const queue = new ImportQueue();
    queue.addCandidates([{ file: new File([bytes], 'gothicvania.sfc'), path: 'gothicvania.sfc' }]);

    await queue.scanAll();

    const entry = queue.getSnapshot().entries[0]!;
    expect(entry.status).toBe('ready');
    expect(entry.previewFailed).toBe(true);
    expect(entry.identification?.hashes.crc32).toBe('88D63376');
  });

  it('does not preview an entry whose identification failed', async () => {
    const unreadable = {
      name: 'broken.sfc',
      arrayBuffer: () => Promise.reject(new Error('unreadable file')),
    } as unknown as File;
    const queue = new ImportQueue();
    queue.addCandidates([{ file: unreadable, path: 'broken.sfc' }]);

    await queue.scanAll();

    expect(previewEnrichment).not.toHaveBeenCalled();
    expect(queue.getSnapshot().entries[0]?.status).toBe('failed');
  });
});

describe('ImportQueue duplicate detection', () => {
  it('flags a ROM already in the catalog and skips its preview', async () => {
    const bytes = new Uint8Array(readFileSync(romPath));
    const queue = new ImportQueue();
    queue.addCandidates([{ file: new File([bytes], 'gothicvania.sfc'), path: 'gothicvania.sfc' }]);

    await queue.scanAll({
      findExisting: async () => ({ slug: 'gothicvania', title: 'Gothicvania' }),
    });

    const entry = queue.getSnapshot().entries[0]!;
    expect(entry.status).toBe('duplicate');
    expect(entry.duplicateKind).toBe('catalog');
    expect(entry.result).toEqual({ slug: 'gothicvania', title: 'Gothicvania' });
    expect(previewEnrichment).not.toHaveBeenCalled();
  });

  it('flags a repeated CRC32 within one batch and previews only the first', async () => {
    const bytes = new Uint8Array(readFileSync(romPath));
    const queue = new ImportQueue();
    queue.addCandidates([
      { file: new File([bytes], 'gothicvania.sfc'), path: 'A/gothicvania.sfc' },
      { file: new File([bytes], 'gothicvania.sfc'), path: 'B/gothicvania.sfc' },
    ]);

    await queue.scanAll();

    const [first, second] = queue.getSnapshot().entries;
    expect(first?.status).toBe('ready');
    expect(second?.status).toBe('duplicate');
    expect(second?.duplicateKind).toBe('batch');
    expect(second?.result).toBeUndefined();
    expect(previewEnrichment).toHaveBeenCalledTimes(1);
  });

  it('stages the draft when the catalog lookup fails', async () => {
    const bytes = new Uint8Array(readFileSync(romPath));
    const queue = new ImportQueue();
    queue.addCandidates([{ file: new File([bytes], 'gothicvania.sfc'), path: 'gothicvania.sfc' }]);

    await queue.scanAll({
      findExisting: async () => {
        throw new Error('backend offline');
      },
    });

    expect(queue.getSnapshot().entries[0]?.status).toBe('ready');
  });
});

describe('ImportQueue commit states', () => {
  it('transitions an entry through uploading to a terminal commit state', () => {
    const queue = new ImportQueue();
    queue.addCandidates([candidate()]);
    const { id } = queue.getSnapshot().entries[0]!;

    queue.setCommitState(id, 'uploading');
    expect(states(queue.getSnapshot().entries)).toEqual(['uploading']);

    queue.setCommitState(id, 'done', { result: { slug: 'gothicvania', title: 'Gothicvania' } });
    const entry = queue.getSnapshot().entries[0]!;
    expect(entry.status).toBe('done');
    expect(entry.result).toEqual({ slug: 'gothicvania', title: 'Gothicvania' });
  });
});
