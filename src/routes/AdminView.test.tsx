import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RomIdentification } from '@/lib/snes/types';
import type { EnrichmentResult } from '@/admin/metadata/enrich';
import { useAdminAuthStore } from '@/admin/lib/authStore';

const identifyRom = vi.fn();
const precheckImport = vi.fn();
const createCatalogRecord = vi.fn();
const enrichGame = vi.fn();
const listDatasetTitles = vi.fn();
const showToast = vi.fn();

vi.mock('@/lib/snes/identify', () => ({ identifyRom }));
vi.mock('@/admin/lib/importer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/admin/lib/importer')>();
  return {
    ...actual,
    precheckImport,
    createCatalogRecord,
    attachVariant: vi.fn(),
  };
});
vi.mock('@/admin/metadata/enrich', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/admin/metadata/enrich')>();
  return {
    ...actual,
    enrichGame,
  };
});
vi.mock('@/admin/metadata/dataset', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/admin/metadata/dataset')>();
  return {
    ...actual,
    listDatasetTitles,
  };
});
vi.mock('@/lib/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/toast')>();
  return {
    ...actual,
    showToast,
  };
});
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

const { default: AdminView } = await import('./AdminView');

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

function renderAdmin() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAdminAuthStore.getState().setUser({ id: 'u1', email: 'admin@example.com' });
  identifyRom.mockResolvedValue(identified);
  enrichGame.mockResolvedValue({
    resolved: true,
    metadata: true,
    cover: true,
    screenshots: 2,
  } satisfies EnrichmentResult);
  listDatasetTitles.mockResolvedValue([
    { title: 'Chrono Trigger', slug: 'chrono-trigger' },
    { title: 'Super Metroid', slug: 'super-metroid' },
  ]);
});

async function dropAndImport() {
  precheckImport.mockResolvedValue({ kind: 'create' });
  renderAdmin();
  await screen.findByText(/No-Intro index ready/);

  const file = new File([new Uint8Array(1024)], 'gothicvania.sfc');
  fireEvent.change(document.querySelector('input[type="file"]')!, {
    target: { files: [file] },
  });
  await screen.findByRole('heading', { name: /Gothicvania/i });
  fireEvent.click(screen.getByRole('button', { name: /Add to catalog/ }));
  await screen.findByText(/is now in the catalog/);
}

describe('AdminView import flow', () => {
  it('identifies a dropped ROM and adds it to the catalog with progress', async () => {
    precheckImport.mockResolvedValue({ kind: 'create' });
    createCatalogRecord.mockImplementation(
      async (_result: RomIdentification, _file: File, onProgress?: (value: number) => void) => {
        onProgress?.(40);
        onProgress?.(100);
        return {
          game: { id: 'g1', slug: 'gothicvania', title: 'Gothicvania' },
          enrichment: { resolved: true, metadata: true, cover: true, screenshots: 1 },
        };
      },
    );

    renderAdmin();
    await screen.findByText(/No-Intro index ready/);

    const file = new File([new Uint8Array(1024)], 'gothicvania.sfc');
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });

    await screen.findByRole('heading', { name: /Gothicvania/i });
    fireEvent.click(screen.getByRole('button', { name: /Add to catalog/ }));

    await screen.findByText(/is now in the catalog/);
    expect(precheckImport).toHaveBeenCalledWith('gothicvania', '88D63376');
    expect(createCatalogRecord).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Open the game' })).toHaveAttribute(
      'href',
      '/game/gothicvania',
    );
    // A resolved enrichment must not offer the manual match.
    expect(screen.queryByRole('dialog', { name: 'Match in dataset' })).toBeNull();
  });

  it('shows an open-existing link instead of creating a duplicate', async () => {
    precheckImport.mockResolvedValue({
      kind: 'duplicate',
      game: { id: 'g1', slug: 'gothicvania', title: 'Gothicvania' },
    });

    renderAdmin();
    await screen.findByText(/No-Intro index ready/);

    const file = new File([new Uint8Array(1024)], 'gothicvania.sfc');
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });

    await screen.findByRole('heading', { name: /Gothicvania/i });
    fireEvent.click(screen.getByRole('button', { name: /Add to catalog/ }));

    await screen.findByText(/already in the catalog/);
    expect(createCatalogRecord).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Open existing game' })).toHaveAttribute(
      'href',
      '/game/gothicvania',
    );
  });

  it('surfaces import errors without losing the identification', async () => {
    precheckImport.mockRejectedValue(new Error('Backend unreachable'));

    renderAdmin();
    await screen.findByText(/No-Intro index ready/);

    const file = new File([new Uint8Array(1024)], 'gothicvania.sfc');
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });

    await screen.findByRole('heading', { name: /Gothicvania/i });
    fireEvent.click(screen.getByRole('button', { name: /Add to catalog/ }));

    await waitFor(() => expect(screen.getByText('Backend unreachable')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Add to catalog/ })).toBeInTheDocument();
  });

  it('offers the manual dataset match after an unresolved import', async () => {
    createCatalogRecord.mockResolvedValue({
      game: { id: 'g1', slug: 'gothicvania', title: 'Gothicvania' },
      enrichment: { resolved: false, metadata: false, cover: false, screenshots: 0 },
    });

    await dropAndImport();

    const dialog = await screen.findByRole('dialog', { name: 'Match in dataset' });
    expect(dialog).toBeInTheDocument();
    // The quick filter is pre-filled with the imported title…
    const filter = await screen.findByLabelText('Filter dataset titles');
    await waitFor(() => expect(filter).toHaveValue('Gothicvania'));
    // …so the admin only edits it to widen the search.
    fireEvent.change(filter, { target: { value: 'chron' } });
    fireEvent.click(screen.getByRole('button', { name: 'Chrono Trigger' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Dataset match: metadata + cover + 2 screenshots.', {
        kind: 'success',
      }),
    );
    expect(enrichGame).toHaveBeenCalledWith({
      id: 'g1',
      slug: 'chrono-trigger',
      title: 'Gothicvania',
      region: 'NTSC-U',
    });
  });

  it('leaves the record untouched when the match modal is dismissed', async () => {
    createCatalogRecord.mockResolvedValue({
      game: { id: 'g1', slug: 'gothicvania', title: 'Gothicvania' },
      enrichment: { resolved: false, metadata: false, cover: false, screenshots: 0 },
    });

    await dropAndImport();

    await screen.findByRole('dialog', { name: 'Match in dataset' });
    fireEvent.keyDown(document, { key: 'Escape' });

    // A closed native <dialog> is display:none and drops out of role queries.
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Match in dataset' })).toBeNull(),
    );
    expect(enrichGame).not.toHaveBeenCalled();
  });

  it('does not offer the manual match when the dataset is unreachable', async () => {
    createCatalogRecord.mockResolvedValue({
      game: { id: 'g1', slug: 'gothicvania', title: 'Gothicvania' },
      enrichment: {
        resolved: false,
        metadata: false,
        cover: false,
        screenshots: 0,
        unavailable: true,
      },
    });

    await dropAndImport();
    // Flush pending effects; the modal must never open nor load the index.
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole('dialog', { name: 'Match in dataset' })).toBeNull();
    expect(listDatasetTitles).not.toHaveBeenCalled();
  });
});
