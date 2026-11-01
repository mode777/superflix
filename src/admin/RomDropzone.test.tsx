import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FileSystemEntryLike } from './lib/romIntake';
import { RomDropzone } from './RomDropzone';

const romFile = (name = 'game.sfc') => new File([new Uint8Array(16)], name);

function fileEntry(name: string, file: File = romFile(name)): FileSystemEntryLike {
  return {
    isFile: true,
    isDirectory: false,
    name,
    file(onSuccess) {
      onSuccess(file);
    },
  };
}

function directoryEntry(name: string, children: FileSystemEntryLike[]): FileSystemEntryLike {
  let read = false;
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader() {
      return {
        readEntries(onSuccess) {
          // One batch then an empty batch, like the DOM reader's cap.
          onSuccess(read ? [] : children);
          read = true;
        },
      };
    },
  };
}

describe('RomDropzone', () => {
  it('opens the file picker with keyboard activation', async () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const user = userEvent.setup();

    render(<RomDropzone onFiles={vi.fn()} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Select ROMs' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  it('reports every ROM file from a multi-file selection and no non-ROM file', () => {
    const onFiles = vi.fn();
    render(<RomDropzone onFiles={onFiles} />);

    const a = romFile('a.sfc');
    const b = romFile('b.smc');
    const text = new File(['nope'], 'readme.txt');
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    fireEvent.change(inputs[0]!, { target: { files: [a, b, text] } });

    expect(onFiles).toHaveBeenCalledOnce();
    expect(onFiles).toHaveBeenCalledWith([
      { file: a, path: 'a.sfc' },
      { file: b, path: 'b.smc' },
    ]);
  });

  it('reports the ROMs of a folder picker selection with their relative paths', () => {
    const onFiles = vi.fn();
    render(<RomDropzone onFiles={onFiles} />);

    const a = romFile('a.sfc');
    const b = romFile('b.sfc');
    Object.defineProperty(a, 'webkitRelativePath', { value: 'Roms/a.sfc' });
    Object.defineProperty(b, 'webkitRelativePath', { value: 'Roms/Sub/b.sfc' });
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    fireEvent.change(inputs[1]!, { target: { files: [a, b] } });

    expect(onFiles).toHaveBeenCalledWith([
      { file: a, path: 'Roms/a.sfc' },
      { file: b, path: 'Roms/Sub/b.sfc' },
    ]);
  });

  it('scans a dropped folder recursively', async () => {
    const onFiles = vi.fn();
    render(<RomDropzone onFiles={onFiles} />);

    const nested = romFile('nested.sfc');
    const tree = directoryEntry('Roms', [
      fileEntry('top.sfc', romFile('top.sfc')),
      directoryEntry('Sub', [fileEntry('nested.sfc', nested)]),
      fileEntry('cover.png'),
    ]);
    fireEvent.drop(screen.getByText(/Drop SNES ROMs/), {
      dataTransfer: {
        items: [{ webkitGetAsEntry: () => tree }],
        files: [],
      },
    });

    await waitFor(() => expect(onFiles).toHaveBeenCalledOnce());
    expect(onFiles).toHaveBeenCalledWith([
      { file: expect.any(File), path: 'Roms/top.sfc' },
      { file: nested, path: 'Roms/Sub/nested.sfc' },
    ]);
  });

  it('falls back to the plain file list when a drop carries no folder entries', () => {
    const onFiles = vi.fn();
    render(<RomDropzone onFiles={onFiles} />);

    const file = romFile('plain.sfc');
    fireEvent.drop(screen.getByText(/Drop SNES ROMs/), {
      dataTransfer: {
        items: [],
        files: [file, new File(['x'], 'skipped.txt')],
      },
    });

    expect(onFiles).toHaveBeenCalledWith([{ file, path: 'plain.sfc' }]);
  });
});
