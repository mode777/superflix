import { render, screen, fireEvent } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DatasetMatchModal, type DatasetMatch } from './DatasetMatchModal';
import type { DatasetTitleEntry } from '@/lib/snes-dataset';

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

const titles: DatasetTitleEntry[] = [
  { title: 'Chrono Trigger', slug: 'chrono-trigger' },
  { title: 'Super Metroid', slug: 'super-metroid' },
  { title: 'Combatribes, The', slug: 'the-combatribes' },
];

function Harness({
  onSelect,
  onDismiss,
  initialQuery,
  loadTitles,
  open = true,
}: {
  onSelect: (match: DatasetMatch) => void;
  onDismiss: () => void;
  initialQuery?: string;
  loadTitles?: () => Promise<DatasetTitleEntry[]>;
  open?: boolean;
}) {
  return (
    <DatasetMatchModal
      open={open}
      initialQuery={initialQuery}
      loadTitles={loadTitles}
      onSelect={onSelect}
      onDismiss={onDismiss}
    />
  );
}

describe('DatasetMatchModal', () => {
  const noop = () => undefined;

  it('renders the pre-filled filter and the narrowed entry list', async () => {
    render(<Harness onSelect={noop} onDismiss={noop} initialQuery="metroid" loadTitles={() => Promise.resolve(titles)} />);

    const filter = await screen.findByLabelText('Filter dataset titles');
    expect(filter).toHaveValue('metroid');
    expect(screen.getByRole('button', { name: 'Super Metroid' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chrono Trigger' })).not.toBeInTheDocument();
  });

  it('narrows the list case-insensitively as the filter changes', async () => {
    render(<Harness onSelect={noop} onDismiss={noop} loadTitles={() => Promise.resolve(titles)} />);

    await screen.findByRole('button', { name: 'Chrono Trigger' });
    fireEvent.change(screen.getByLabelText('Filter dataset titles'), { target: { value: 'TRIG' } });

    expect(screen.getByRole('button', { name: 'Chrono Trigger' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Super Metroid' })).not.toBeInTheDocument();
  });

  it('selecting an entry fires onSelect with its slug and title', async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} onDismiss={noop} loadTitles={() => Promise.resolve(titles)} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Combatribes, The' }));

    expect(onSelect).toHaveBeenCalledWith({ slug: 'the-combatribes', title: 'Combatribes, The' });
  });

  it('dismissal reports back without selecting anything', async () => {
    const onSelect = vi.fn();
    const onDismiss = vi.fn();
    render(<Harness onSelect={onSelect} onDismiss={onDismiss} loadTitles={() => Promise.resolve(titles)} />);

    await screen.findByRole('button', { name: 'Chrono Trigger' });
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onDismiss).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows an empty state when the filter matches nothing', async () => {
    render(<Harness onSelect={noop} onDismiss={noop} loadTitles={() => Promise.resolve(titles)} />);

    await screen.findByRole('button', { name: 'Chrono Trigger' });
    fireEvent.change(screen.getByLabelText('Filter dataset titles'), { target: { value: 'zzzz' } });

    expect(screen.getByText('No dataset entries match “zzzz”.')).toBeInTheDocument();
  });

  it('reports a failed index load instead of listing entries', async () => {
    render(<Harness onSelect={noop} onDismiss={noop} loadTitles={() => Promise.reject(new Error('down'))} />);

    expect(await screen.findByText('Could not load the dataset index.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Dataset entries' })).not.toBeInTheDocument();
  });
});
