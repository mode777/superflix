import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdminGate } from './AdminGate';
import { adminClient } from './lib/pb';
import { useAdminAuthStore } from './lib/authStore';

beforeEach(() => {
  adminClient.authStore.clear();
  useAdminAuthStore.getState().setUser(null);
});

describe('AdminGate', () => {
  it('shows the superuser sign-in and no import capability when unauthenticated', () => {
    render(
      <AdminGate>
        <div>secret importer</div>
      </AdminGate>,
    );

    expect(screen.getByRole('heading', { name: /superuser sign in/i })).toBeInTheDocument();
    expect(screen.queryByText('secret importer')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add to catalog/i })).not.toBeInTheDocument();
  });

  it('renders the admin children for an authenticated superuser', () => {
    useAdminAuthStore.getState().setUser({ id: 'u1', email: 'admin@example.com' });

    render(
      <AdminGate>
        <div>secret importer</div>
      </AdminGate>,
    );

    expect(screen.getByText('secret importer')).toBeInTheDocument();
  });
});
