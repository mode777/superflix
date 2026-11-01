// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  collectRomFiles,
  hasHiddenSegment,
  isRomFileName,
  romCandidatesFromFiles,
  type FileSystemEntryLike,
} from './romIntake';

const romFile = (name = 'game.sfc') => new File([new Uint8Array(8)], name);

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

/**
 * Directory entry whose reader hands out the given entry batches — the fake
 * mimics the DOM's 100-entry-per-readEntries cap by only returning one batch
 * per call and an empty batch afterwards.
 */
function directoryEntry(name: string, batches: FileSystemEntryLike[][]): FileSystemEntryLike {
  let call = 0;
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader() {
      return {
        readEntries(onSuccess) {
          onSuccess(batches[call] ?? []);
          call += 1;
        },
      };
    },
  };
}

describe('isRomFileName', () => {
  it('accepts the supported ROM extensions case-insensitively', () => {
    for (const name of ['a.sfc', 'B.SMC', 'c.fig', 'd.swc', 'e.bin']) {
      expect(isRomFileName(name)).toBe(true);
    }
    for (const name of ['a.zip', 'b.txt', 'c.png', 'sfc', '']) {
      expect(isRomFileName(name)).toBe(false);
    }
  });
});

describe('hasHiddenSegment', () => {
  it('flags dot-prefixed path segments', () => {
    expect(hasHiddenSegment('Library/.git/game.sfc')).toBe(true);
    expect(hasHiddenSegment('.hidden/game.sfc')).toBe(true);
    expect(hasHiddenSegment('Library/game.sfc')).toBe(false);
  });
});

describe('romCandidatesFromFiles', () => {
  it('keeps ROM files with their relative path and drops everything else', () => {
    const rom = romFile();
    Object.defineProperty(rom, 'webkitRelativePath', { value: 'Roms/Sub/game.sfc' });
    const text = new File(['nope'], 'readme.txt');

    const candidates = romCandidatesFromFiles([rom, text]);

    expect(candidates).toEqual([{ file: rom, path: 'Roms/Sub/game.sfc' }]);
  });

  it('skips selections inside hidden directories', () => {
    const rom = romFile();
    Object.defineProperty(rom, 'webkitRelativePath', { value: 'Roms/.lost/game.sfc' });

    expect(romCandidatesFromFiles([rom])).toEqual([]);
  });

  it('falls back to the bare file name without a relative path', () => {
    const rom = romFile('standalone.sfc');

    expect(romCandidatesFromFiles([rom])).toEqual([
      { file: rom, path: 'standalone.sfc' },
    ]);
  });
});

describe('collectRomFiles', () => {
  it('walks nested directories and keeps only ROM files', async () => {
    const tree = directoryEntry('Library', [
      [
        fileEntry('a.sfc'),
        fileEntry('notes.txt'),
        directoryEntry('Sub', [[fileEntry('b.smc', romFile('b.smc'))]]),
      ],
      // Second batch from the same reader: the readEntries loop must keep
      // going until an empty batch (the DOM caps each call at 100 entries).
      [directoryEntry('Deep', [[fileEntry('c.fig', romFile('c.fig'))]])],
      [],
    ]);

    const candidates = await collectRomFiles([tree]);

    expect(candidates.map((candidate) => candidate.path)).toEqual([
      'Library/a.sfc',
      'Library/Sub/b.smc',
      'Library/Deep/c.fig',
    ]);
  });

  it('skips hidden directories anywhere in the tree', async () => {
    const tree = directoryEntry('Roms', [
      [fileEntry('keep.sfc'), directoryEntry('.git', [[fileEntry('leak.sfc')]])],
      [],
    ]);

    const candidates = await collectRomFiles([tree]);

    expect(candidates.map((candidate) => candidate.path)).toEqual(['Roms/keep.sfc']);
  });

  it('continues the scan when one subtree cannot be read', async () => {
    const broken = directoryEntry('Broken', [[['never delivered'] as unknown as FileSystemEntryLike]]);
    broken.createReader = () => ({
      readEntries(_onSuccess, onError) {
        onError?.(new Error('reader gone'));
      },
    });
    const healthy = fileEntry('good.sfc');

    const candidates = await collectRomFiles([broken, healthy]);

    expect(candidates.map((candidate) => candidate.path)).toEqual(['good.sfc']);
  });

  it('uses injected accessors instead of the DOM entry methods', async () => {
    const entry = fileEntry('x.sfc');
    const readFile = vi.fn(async () => romFile('injected.sfc'));
    const readDirectory = vi.fn(async () => []);

    const candidates = await collectRomFiles([entry], { readFile, readDirectory });

    expect(readFile).toHaveBeenCalledWith(entry);
    expect(readDirectory).not.toHaveBeenCalled();
    expect(candidates[0]?.file.name).toBe('injected.sfc');
  });

  it('scans a mixed drop of folders and loose files', async () => {
    const entries = [
      directoryEntry('Folder', [[fileEntry('nested.sfc')], []]),
      fileEntry('loose.smc', romFile('loose.smc')),
      fileEntry('cover.png'),
    ];

    const candidates = await collectRomFiles(entries);

    expect(candidates.map((candidate) => candidate.path)).toEqual([
      'Folder/nested.sfc',
      'loose.smc',
    ]);
  });
});
