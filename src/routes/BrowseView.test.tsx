import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import BrowseView from './BrowseView';

function renderBrowse() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BrowseView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BrowseView', () => {
  it('renders the mock catalog', async () => {
    renderBrowse();
    const headings = await screen.findAllByRole('heading', { name: 'Super Mario World' });
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.getByText('Library')).toBeInTheDocument();
  });
});
