import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RomIdentification } from '@/lib/snes/types';
import { useAdminAuthStore } from '@/admin/lib/authStore';

const identifyRom = vi.fn();
const precheckImport = vi.fn();
const createCatalogRecord = vi.fn();

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
});

describe('AdminView import flow', () => {
  it('identifies a dropped ROM and adds it to the catalog with progress', async () => {
    precheckImport.mockResolvedValue({ kind: 'create' });
    createCatalogRecord.mockImplementation(
      async (_result: RomIdentification, _file: File, onProgress?: (value: number) => void) => {
        onProgress?.(40);
        onProgress?.(100);
        return { game: { id: 'g1', slug: 'gothicvania', title: 'Gothicvania' } };
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
});
