/**
 * Intake for the batch importer: turns file picks and dropped/scanned folder
 * trees into ROM candidates. The traversal core is pure and takes the DOM
 * file-system entry accessors as parameters, so it runs in Node tests against
 * fake entries.
 */

/** The ROM file extensions the importer accepts (single source of truth). */
export const ROM_EXTENSIONS = /\.(sfc|smc|fig|swc|bin)$/i;

/** A ROM file found by the picker or a folder scan, with its selection path. */
export interface RomCandidate {
  file: File;
  /** Path within the selection ("Folder/Sub/game.sfc"); the bare name for plain picks. */
  path: string;
}

/**
 * Minimal structural view of a DOM `FileSystemEntry` (file or directory).
 * Optional members keep it directly assignable from the DOM types while
 * remaining constructible as a plain object in Node tests.
 */
export interface FileSystemEntryLike {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly name: string;
  /** File entries only: resolve the backing `File`. */
  file?: (
    onSuccess: (file: File) => void,
    onError?: (error: unknown) => void,
  ) => void;
  /** Directory entries only: open a reader over the directory's children. */
  createReader?: () => {
    readEntries(
      onSuccess: (entries: FileSystemEntryLike[]) => void,
      onError?: (error: unknown) => void,
    ): void;
  };
}

/** Accessors over the DOM file-system entry APIs, injectable for Node tests. */
export interface IntakeAccessors {
  /** Resolve the `File` behind a file entry (default: the DOM `file()` callback). */
  readFile?: (entry: FileSystemEntryLike) => Promise<File>;
  /** Read one batch of a directory's children (default: one DOM `readEntries` call). */
  readDirectory?: (entry: FileSystemEntryLike) => Promise<FileSystemEntryLike[]>;
}

const defaultReadFile = (entry: FileSystemEntryLike): Promise<File> =>
  new Promise((resolve, reject) => {
    if (!entry.file) {
      reject(new Error(`${entry.name} is not a readable file entry.`));
      return;
    }
    entry.file(resolve, reject);
  });

const defaultReadDirectory = (entry: FileSystemEntryLike): Promise<FileSystemEntryLike[]> =>
  new Promise((resolve, reject) => {
    if (!entry.createReader) {
      reject(new Error(`${entry.name} is not a readable directory entry.`));
      return;
    }
    entry.createReader().readEntries(resolve, reject);
  });

/** True when the file name carries a ROM extension. */
export function isRomFileName(name: string): boolean {
  return ROM_EXTENSIONS.test(name);
}

/** True when any path segment starts with a dot (hidden files and folders). */
export function hasHiddenSegment(path: string): boolean {
  return path.split('/').some((segment) => segment.startsWith('.'));
}

/** Candidates from a plain file list, using `webkitRelativePath` when present. */
export function romCandidatesFromFiles(files: File[]): RomCandidate[] {
  return files
    .map((file) => ({ file, path: file.webkitRelativePath || file.name }))
    .filter((candidate) => isRomFileName(candidate.file.name) && !hasHiddenSegment(candidate.path));
}

/**
 * Collect every ROM file in a dropped/scanned entry list, recursing through
 * directory trees. Read failures isolate: an unreadable file or subtree is
 * skipped while the rest of the scan continues.
 */
export async function collectRomFiles(
  entries: FileSystemEntryLike[],
  accessors: IntakeAccessors = {},
): Promise<RomCandidate[]> {
  const readFile = accessors.readFile ?? defaultReadFile;
  const readDirectory = accessors.readDirectory ?? defaultReadDirectory;
  const found: RomCandidate[] = [];

  const collect = async (entry: FileSystemEntryLike, prefix: string): Promise<void> => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (hasHiddenSegment(path)) return;

    if (entry.isDirectory) {
      // `readEntries` yields at most 100 entries per call; loop until an empty
      // batch so large directories are fully enumerated.
      const children: FileSystemEntryLike[] = [];
      let batch = await readDirectory(entry);
      while (batch.length > 0) {
        children.push(...batch);
        batch = await readDirectory(entry);
      }
      for (const child of children) await collect(child, path);
      return;
    }

    if (!isRomFileName(entry.name)) return;
    found.push({ file: await readFile(entry), path });
  };

  for (const entry of entries) {
    try {
      await collect(entry, '');
    } catch {
      // Skip unreadable subtrees; the scan reports what it found.
    }
  }
  return found;
}
