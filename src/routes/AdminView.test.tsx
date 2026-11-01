// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminAuthStore } from '@/admin/lib/authStore';

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
vi.mock('@/admin/catalog/CatalogTab', () => ({
  CatalogTab: () => <section>CATALOG-STUB</section>,
}));

const { default: AdminView } = await import('./AdminView');

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
});

describe('AdminView shell', () => {
  it('renders the queue-based importer as the identify tab', async () => {
    renderAdmin();

    expect(screen.getByRole('heading', { name: 'Import games' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Identify' })).toHaveAttribute('aria-selected', 'true');
    // The queue-first intake is mounted: dropzone + DAT status.
    expect(screen.getByText(/Drop SNES ROMs or a folder here/)).toBeInTheDocument();
    await screen.findByText(/No-Intro index ready/);
  });

  it('switches to the catalog management tab and back', async () => {
    const user = userEvent.setup();
    renderAdmin();

    await user.click(screen.getByRole('tab', { name: 'Catalog' }));

    expect(screen.getByRole('heading', { name: 'Manage the catalog' })).toBeInTheDocument();
    expect(screen.getByText('CATALOG-STUB')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Identify' }));
    expect(screen.getByRole('heading', { name: 'Import games' })).toBeInTheDocument();
  });
});
