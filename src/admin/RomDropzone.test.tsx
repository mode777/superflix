import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RomDropzone } from './RomDropzone';

describe('RomDropzone keyboard support', () => {
  it('opens the file picker with keyboard activation', async () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const user = userEvent.setup();

    render(<RomDropzone onFile={vi.fn()} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Select ROM' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  it('reports the selected ROM file', () => {
    const onFile = vi.fn();
    render(<RomDropzone onFile={onFile} />);

    const file = new File([new Uint8Array(16)], 'game.sfc');
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });

    expect(onFile).toHaveBeenCalledWith(file);
  });
});
