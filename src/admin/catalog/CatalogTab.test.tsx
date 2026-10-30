import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const getList = vi.fn();
const enrichGame = vi.fn();
const listDatasetTitles = vi.fn();
const showToast = vi.fn();

vi.mock('@/admin/lib/pb', () => ({
  adminClient: {
    collection: vi.fn(() => ({
      getList,
      update: vi.fn(),
      delete: vi.fn(),
    })),
    filter: vi.fn((expression: string) => expression),
  },
}));
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

const { CatalogTab } = await import('./CatalogTab');

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
  }
});

const game = {
  id: 'g1',
  slug: 'gothicvania',
  title: 'Gothicvania',
  region: 'NTSC-U',
  rom_crc32: '88D63376',
  rom_size: 524288,
  metadata_source: '',
  metadata_id: '',
};

function renderCatalog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CatalogTab />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getList.mockResolvedValue({ items: [game], totalItems: 1, totalPages: 1 });
  enrichGame.mockResolvedValue({
    resolved: true,
    metadata: true,
    cover: false,
    screenshots: 0,
  });
  listDatasetTitles.mockResolvedValue([
    { title: 'Chrono Trigger', slug: 'chrono-trigger' },
    { title: 'Gothicvania', slug: 'gothicvania' },
  ]);
});

async function openEditorAndPicker() {
  renderCatalog();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Match in dataset…' }));
  await screen.findByRole('dialog', { name: 'Match in dataset' });
}

describe('CatalogTab dataset match', () => {
  it('opens the picker pre-filled with the record title and applies the chosen entry', async () => {
    await openEditorAndPicker();

    const filter = await screen.findByLabelText('Filter dataset titles');
    await waitFor(() => expect(filter).toHaveValue('Gothicvania'));
    fireEvent.click(screen.getByRole('button', { name: 'Gothicvania' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Dataset match: metadata.', { kind: 'success' }),
    );
    expect(enrichGame).toHaveBeenCalledWith({
      id: 'g1',
      slug: 'gothicvania',
      title: 'Gothicvania',
      region: 'NTSC-U',
      manualCover: false,
    });
  });

  it('leaves the record unchanged when the picker is dismissed', async () => {
    await openEditorAndPicker();

    await screen.findByRole('button', { name: 'Gothicvania' });
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Match in dataset' })).toBeNull(),
    );
    expect(enrichGame).not.toHaveBeenCalled();
  });

  it('reports an unresolved pick without a success toast', async () => {
    enrichGame.mockResolvedValue({
      resolved: false,
      metadata: false,
      cover: false,
      screenshots: 0,
    });

    await openEditorAndPicker();

    const filter = await screen.findByLabelText('Filter dataset titles');
    await waitFor(() => expect(filter).toHaveValue('Gothicvania'));
    fireEvent.change(filter, { target: { value: 'chron' } });
    fireEvent.click(screen.getByRole('button', { name: 'Chrono Trigger' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Dataset match: not in dataset.', { kind: 'info' }),
    );
  });
});
