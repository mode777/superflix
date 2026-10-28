import { render, screen, fireEvent } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

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

function Harness({
  open,
  onClose = () => undefined,
}: {
  open: boolean;
  onClose?: () => void;
}) {
  return (
    <>
      <button type="button">Trigger</button>
      <Dialog
        open={open}
        title="Delete game?"
        onClose={onClose}
        footer={
          <>
            <button type="button">Cancel</button>
            <button type="button">Delete</button>
          </>
        }
      >
        Delete this game?
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('renders an accessible modal with its title and content', () => {
    render(<Harness open />);

    const dialog = screen.getByRole('dialog', { name: 'Delete game?' });
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(screen.getByText('Delete this game?')).toBeVisible();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('traps Tab focus inside the dialog', () => {
    render(<Harness open />);
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const remove = screen.getByRole('button', { name: 'Delete' });

    remove.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(remove).toHaveFocus();
  });

  it('restores focus to the trigger when closed', () => {
    const { rerender } = render(<Harness open={false} />);
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    trigger.focus();

    rerender(<Harness open />);
    rerender(<Harness open={false} />);

    expect(trigger).toHaveFocus();
  });
});
