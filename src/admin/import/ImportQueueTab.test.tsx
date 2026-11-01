// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RomIdentification } from '@/lib/snes/types';
import type { EnrichmentPreview } from '@/admin/metadata/enrich';

const identifyRom = vi.fn();
const previewEnrichment = vi.fn();
const commitStagedDrafts = vi.fn();
const findGameByCrc = vi.fn();
const listDatasetTitles = vi.fn();
const showToast = vi.fn();

vi.mock('@/lib/snes/dat', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/snes/dat')>();
  return {
    ...actual,
    loadDatFromUrl: vi.fn(async () => ({
      byCrc32: new Map(),
      byMd5: new Map(),
      bySha1: new Map(),
      bySerial: new Map(),
      entries: [],
    })),
  };
});
vi.mock('@/lib/snes/identify', () => ({ identifyRom }));
vi.mock('@/admin/metadata/enrich', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/admin/metadata/enrich')>();
  return { ...actual, previewEnrichment, enrichGame: vi.fn() };
});
vi.mock('@/admin/lib/importer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/admin/lib/importer')>();
  return {
    ...actual,
    commitStagedDrafts,
    findGameByCrc,
    precheckImport: vi.fn(),
    attachVariant: vi.fn(),
  };
});
vi.mock('@/admin/metadata/dataset', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/admin/metadata/dataset')>();
  return { ...actual, listDatasetTitles };
});
vi.mock('@/lib/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/toast')>();
  return { ...actual, showToast };
});
vi.mock('@/admin/DatasetMatchModal', () => ({
  DatasetMatchModal: ({
    open,
    onSelect,
  }: {
    open: boolean;
    onSelect: (match: { slug: string; title: string }) => void;
  }) =>
    open ? (
      <button
        type="button"
        onClick={() => onSelect({ slug: 'chrono-trigger', title: 'Chrono Trigger' })}
      >
        PICK: chrono-trigger
      </button>
    ) : null,
}));

const { ImportQueueTab } = await import('./ImportQueueTab');
const { useRomStore } = await import('@/features/console/romStore');

const identified: RomIdentification = {
  fileSize: 524288,
  hadCopierHeader: false,
  normalizedSize: 524288,
  hashes: { crc32: '88D63376', md5: 'MD5', sha1: 'SHA1' },
  rawCrc32: '88D63376',
  header: null,
  match: null,
  matchBy: null,
};

const datasetPreview: EnrichmentPreview = {
  resolved: true,
  slug: 'gothicvania',
  fields: { description: 'Fetched description.', genre: 'Platform' },
  cover: { blob: new Blob(['box'], { type: 'image/png' }), fileName: 'box.png', kind: 'boxart' },
  screenshots: [
    { blob: new Blob(['snap'], { type: 'image/png' }), fileName: 'snap.png', kind: 'snap' },
  ],
};

function renderTab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<ImportQueueTab />} />
          <Route path="/play/:slug" element={<PlayProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function PlayProbe() {
  const { slug } = useParams();
  return <div>PLAY-PROBE:{slug}</div>;
}

async function pickFiles(count: number) {
  const files = Array.from({ length: count }, (_value, index) => new File([new Uint8Array(8)], `rom-${index}.sfc`));
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files } });
  await screen.findByText(`Found ${count} game${count === 1 ? '' : 's'} — review each draft below, then add them.`);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Distinct CRC32 per file index so a multi-file pick is not an in-batch duplicate.
  identifyRom.mockImplementation(async (_bytes: Uint8Array, _index: unknown, fileName?: string) => {
    const index = Number(/rom-(\d+)\.sfc/.exec(fileName ?? '')?.[1] ?? 0);
    return {
      ...identified,
      fileName,
      hashes: { ...identified.hashes, crc32: `88D6337${index}` },
    };
  });
  previewEnrichment.mockResolvedValue(datasetPreview);
  commitStagedDrafts.mockResolvedValue({ added: 1, duplicates: 0, variants: 0, failed: 0 });
  findGameByCrc.mockResolvedValue(null);
  listDatasetTitles.mockResolvedValue([{ title: 'Chrono Trigger', slug: 'chrono-trigger' }]);

  URL.createObjectURL = vi.fn(() => 'blob:preview-url');
  URL.revokeObjectURL = vi.fn();

  useRomStore.getState().clearRom('local-88d63370');
});

describe('ImportQueueTab staging', () => {
  it('renders one draft card per picked file with the scan counter (5.1)', async () => {
    renderTab();
    await screen.findByText(/No-Intro index ready/);

    await pickFiles(3);

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings).toHaveLength(3);
    // Each ready card previews the fetched dataset description.
    expect(screen.getAllByDisplayValue('Fetched description.')).toHaveLength(3);
    expect(screen.getByText('Add 3 ready games')).toBeInTheDocument();
  });

  it('marks a ROM already in the library as a duplicate and excludes it from the batch (7.2)', async () => {
    findGameByCrc.mockResolvedValue({ slug: 'gothicvania', title: 'Gothicvania' });
    const user = userEvent.setup();
    renderTab();
    await screen.findByText(/No-Intro index ready/);

    const file = new File([new Uint8Array(8)], 'gothicvania.sfc');
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });

    await screen.findByText(/— 1 already in the library/);
    expect(screen.getByText(/Already in the library as/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the game' })).toHaveAttribute(
      'href',
      '/game/gothicvania',
    );
    // No draft form and nothing counted for the batch.
    expect(screen.queryByLabelText('Title')).toBeNull();
    expect(screen.queryByRole('button', { name: /Add .* ready game/ })).toBeNull();
    expect(commitStagedDrafts).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByText(/Already in the library as/)).toBeNull();
  });

  it('flags a repeated file within the batch and adds only one copy (7.2)', async () => {
    renderTab();
    await screen.findByText(/No-Intro index ready/);

    const file = new File([new Uint8Array(8)], 'same.sfc');
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file, file] },
    });

    await screen.findByText(/Same ROM as an earlier entry in this batch/);
    expect(screen.getByRole('button', { name: 'Add 1 ready game' })).toBeInTheDocument();
  });

  it('keeps the queue committable when the dataset preview fails (3.3/5.1)', async () => {
    previewEnrichment.mockResolvedValue({
      resolved: false,
      fields: {},
      cover: null,
      screenshots: [],
      unavailable: true,
    });

    renderTab();
    await screen.findByText(/No-Intro index ready/);
    await pickFiles(1);

    expect(await screen.findByText(/Metadata could not be fetched/)).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Rom 0'); // identification-only seed
    expect(screen.getByRole('button', { name: /Add to catalog/ })).toBeEnabled();
  });

  it('commits edited values from the draft card and removes entries without writing (5.2)', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText(/No-Intro index ready/);
    await pickFiles(2);

    await user.clear(screen.getAllByLabelText('Title')[0]!);
    await user.type(screen.getAllByLabelText('Title')[0]!, 'Edited Title');
    await user.click(screen.getAllByRole('button', { name: /Add to catalog/ })[0]!);

    await waitFor(() => expect(commitStagedDrafts).toHaveBeenCalledOnce());
    const [items] = commitStagedDrafts.mock.calls[0]!;
    expect(items).toHaveLength(1);
    expect(items[0].draft.values.title).toBe('Edited Title');
    expect(items[0].draft.metadataId).toBe('gothicvania');
    expect(items[0].draft.cover).toMatchObject({ fileName: 'box.png' });
    expect(items[0].draft.screenshots).toHaveLength(1);

    // Remove the second entry: it disappears and the commit never included it.
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]!);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
    expect(commitStagedDrafts).toHaveBeenCalledOnce(); // no extra commit
  });
});

describe('ImportQueueTab progress', () => {
  it('shows per-game and total progress bars while the batch commits (5.3)', async () => {
    let finishBatch: (() => void) | undefined;
    commitStagedDrafts.mockImplementation(
      (
        items: Array<{ id: string }>,
        events: {
          onEntryState: (
            id: string,
            status: string,
            data?: { result?: { slug: string; title: string } },
          ) => void;
          onEntryProgress: (id: string, percent: number) => void;
          onTotalProgress: (fraction: number) => void;
        },
      ) =>
        new Promise<{ added: number }>((resolve) => {
          for (const item of items) {
            events.onEntryState(item.id, 'uploading');
            events.onEntryProgress(item.id, 40);
            events.onTotalProgress(0.4);
          }
          finishBatch = () => {
            for (const item of items) {
              events.onEntryProgress(item.id, 100);
              events.onTotalProgress(1);
              events.onEntryState(item.id, 'done', { result: { slug: 'rom-0', title: 'Rom 0' } });
            }
            resolve({ added: items.length });
          };
        }),
    );

    const user = userEvent.setup();
    renderTab();
    await screen.findByText(/No-Intro index ready/);
    await pickFiles(1);

    await user.click(screen.getByRole('button', { name: /Add 1 ready game/ }));

    // The per-game bar and the total bar both show the running upload…
    expect(await screen.findByText(/Uploading Rom 0/)).toBeInTheDocument();
    expect(screen.getByText('Total upload progress')).toBeInTheDocument();
    expect(screen.getAllByText('40%').length).toBeGreaterThanOrEqual(1);

    finishBatch?.();

    // …and both finish while the entry lands in the Added state.
    await waitFor(() => expect(screen.getAllByText('100%').length).toBeGreaterThanOrEqual(1));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Batch finished — added 1.', { kind: 'success' }),
    );
    expect(screen.getByText('Added')).toBeInTheDocument();
  });

  it('re-matches a draft to a chosen dataset entry and re-seeds it (5.3)', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText(/No-Intro index ready/);
    await pickFiles(1);

    await user.click(screen.getByRole('button', { name: 'Match in dataset…' }));
    await user.click(screen.getByRole('button', { name: 'PICK: chrono-trigger' }));

    await waitFor(() =>
      expect(previewEnrichment).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'chrono-trigger', crc32: '88D63370' }),
      ),
    );
    // The card re-seeds from the new preview's slug and fields.
    await waitFor(() =>
      expect(previewEnrichment.mock.calls.at(-1)?.[0]).toMatchObject({ slug: 'chrono-trigger' }),
    );
  });
});

describe('ImportQueueTab play shortcut', () => {
  it('navigates to the local player for a ready draft (5.4)', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText(/No-Intro index ready/);
    await pickFiles(1);

    await user.click(screen.getByRole('button', { name: 'Play locally' }));

    expect(await screen.findByText('PLAY-PROBE:local-88d63370')).toBeInTheDocument();
    expect(useRomStore.getState().roms['local-88d63370']).toBeTruthy();
  });
});
