import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RomIdentification } from '@/lib/snes/types';
import type { ArtworkImage } from '../metadata/provider';

const mocks = vi.hoisted(() => ({
  getFirstListItem: vi.fn(),
  create: vi.fn(),
  uploadRecord: vi.fn(),
  updateRecord: vi.fn(),
  filter: vi.fn(
    (expression: string, params: Record<string, string>) =>
      `${expression} ${JSON.stringify(params)}`,
  ),
}));

vi.mock('./pb', () => ({
  adminClient: {
    collection: () => ({
      getFirstListItem: mocks.getFirstListItem,
      create: mocks.create,
    }),
    filter: mocks.filter,
  },
}));

vi.mock('./upload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./upload')>();
  return {
    ...actual,
    uploadRecord: mocks.uploadRecord,
    updateRecord: mocks.updateRecord,
  };
});

const importer = await import('./importer');
const {
  attachVariant,
  buildCatalogDraft,
  commitStagedDrafts,
  createCatalogRecord,
  precheckImport,
  toGameFields,
} = importer;
type StagedDraft = import('./importer').StagedDraft;
const { AuthExpiredError, UploadError } = await import('./upload');

const identified: RomIdentification = {
  fileSize: 524288,
  hadCopierHeader: false,
  normalizedSize: 524288,
  hashes: { crc32: 'B19ED489', md5: 'CDD3C8C37322978CA8669B34BC89C804', sha1: 'SHA1VALUE' },
  rawCrc32: 'B19ED489',
  header: {
    title: 'SUPER MARIO WORLD',
    mapper: 'LoROM',
    mapMode: 0x20,
    fastRom: false,
    cartridgeType: 0,
    cartridgeTypeLabel: 'ROM',
    hasBattery: false,
    romSizeCode: 9,
    romSize: 524288,
    sramSizeCode: 0,
    sramSize: 0,
    regionCode: 1,
    region: 'NTSC-U',
    regionLabel: 'USA',
    licenseeCode: 1,
    version: 0,
    checksum: 0,
    checksumComplement: 0xffff,
    headerOffset: 0x7fc0,
    makerCode: null,
    gameCode: 'SMW',
    score: 10,
  },
  match: {
    name: 'Super Mario World (USA)',
    region: 'USA',
    fields: {
      genre: 'Platform',
      developer: 'Nintendo EAD',
      publisher: 'Nintendo',
      releaseyear: '1991',
      users: '2',
    },
    rom: {
      name: 'Super Mario World (USA).sfc',
      size: 524288,
      crc32: 'B19ED489',
      md5: 'CDD3C8C37322978CA8669B34BC89C804',
      sha1: 'SHA1VALUE',
    },
  },
  matchBy: 'crc32',
};

function makeFile(bytes = 1024) {
  return new File([new Uint8Array(bytes)], 'smw.sfc', { type: 'application/octet-stream' });
}

function stagedDraft(overrides: Partial<StagedDraft> = {}): StagedDraft {
  return {
    values: buildCatalogDraft(identified, 'smw.sfc'),
    identification: identified,
    file: makeFile(),
    ...overrides,
  };
}

const artwork = (name: string): ArtworkImage => ({
  blob: new Blob([name], { type: 'image/png' }),
  fileName: name,
  kind: 'boxart',
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({});
  mocks.getFirstListItem.mockRejectedValue({ status: 404 });
});

describe('precheckImport', () => {
  it('returns duplicate when the CRC32 already exists', async () => {
    mocks.getFirstListItem.mockResolvedValueOnce({
      id: 'g1',
      slug: 'super-mario-world',
      title: 'Super Mario World',
    });

    await expect(precheckImport('super-mario-world', 'B19ED489')).resolves.toEqual({
      kind: 'duplicate',
      game: { id: 'g1', slug: 'super-mario-world', title: 'Super Mario World' },
    });
    expect(mocks.getFirstListItem).toHaveBeenCalledTimes(1);
    expect(mocks.filter).toHaveBeenCalledWith('rom_crc32 = {:value}', { value: 'B19ED489' });
  });

  it('returns variant when only the slug exists', async () => {
    mocks.getFirstListItem
      .mockRejectedValueOnce({ status: 404 })
      .mockResolvedValueOnce({ id: 'g2', slug: 'super-mario-world', title: 'Super Mario World' });

    await expect(precheckImport('super-mario-world', '11223344')).resolves.toEqual({
      kind: 'variant',
      game: { id: 'g2', slug: 'super-mario-world', title: 'Super Mario World' },
    });
  });

  it('returns create when neither exists', async () => {
    await expect(precheckImport('new-game', 'AABBCCDD')).resolves.toEqual({ kind: 'create' });
  });

  it('propagates non-404 errors', async () => {
    mocks.getFirstListItem.mockRejectedValue({ status: 500 });

    await expect(precheckImport('x', 'AABBCCDD')).rejects.toEqual({ status: 500 });
  });
});

describe('buildCatalogDraft', () => {
  it('maps identification and enrichment fields', () => {
    const draft = buildCatalogDraft(identified, 'smw.sfc');

    expect(draft).toMatchObject({
      title: 'Super Mario World',
      slug: 'super-mario-world',
      region: 'NTSC-U',
      genre: 'Platform',
      developer: 'Nintendo EAD',
      publisher: 'Nintendo',
      release: '1991-01-01 00:00:00.000Z',
      players: '2',
      crc32: 'B19ED489',
      size: 524288,
      revision: 0,
    });
  });

  it('falls back to the file name without a DAT match', () => {
    const draft = buildCatalogDraft(
      { ...identified, match: null, matchBy: null, hashes: { ...identified.hashes, crc32: 'AABBCCDD' } },
      'gothicvania.sfc',
    );

    expect(draft.title).toBe('Gothicvania');
    expect(draft.slug).toBe('gothicvania');
    expect(draft.release).toBe('');
  });

  it('falls back to the header title when the file name is unusable', () => {
    const draft = buildCatalogDraft(
      { ...identified, match: null, matchBy: null },
      '.sfc',
    );

    expect(draft.title).toBe('SUPER MARIO WORLD');
  });
});

describe('createCatalogRecord', () => {
  it('uploads the reviewed draft and creates a primary ROM record', async () => {
    mocks.uploadRecord.mockResolvedValue({
      id: 'g1',
      slug: 'super-mario-world',
      title: 'Super Mario World',
    });

    const draft = stagedDraft();
    const progress = vi.fn();
    const { game } = await createCatalogRecord(draft, progress);

    expect(game).toEqual({ id: 'g1', slug: 'super-mario-world', title: 'Super Mario World' });

    const [collection, fields, files, callback] = mocks.uploadRecord.mock.calls[0]!;
    expect(collection).toBe('games');
    expect(callback).toBe(progress);
    expect(fields).toMatchObject({
      title: 'Super Mario World',
      slug: 'super-mario-world',
      rom_crc32: 'B19ED489',
      rom_size: 524288,
    });
    expect(JSON.parse(String(fields.rom_header)).title).toBe('SUPER MARIO WORLD');
    expect((files.rom as File).name).toBe('super-mario-world.sfc');

    expect(mocks.create).toHaveBeenCalledWith({
      game: 'g1',
      region: 'NTSC-U',
      revision: 0,
      crc32: 'B19ED489',
      md5: identified.hashes.md5,
      sha1: identified.hashes.sha1,
      size: 524288,
      is_primary: true,
      header: JSON.stringify(identified.header),
    });
  });

  it('sends edited values, not the identification defaults', async () => {
    mocks.uploadRecord.mockResolvedValue({ id: 'g1', slug: 'x', title: 'X' });

    const draft = stagedDraft({
      values: { ...buildCatalogDraft(identified, 'smw.sfc'), title: 'Edited Title', players: '4' },
    });
    await createCatalogRecord(draft);

    const fields = mocks.uploadRecord.mock.calls[0]![1] as Record<string, unknown>;
    expect(fields.title).toBe('Edited Title');
    expect(fields.players).toBe('4');
    expect(fields.genre).toBe('Platform'); // untouched values pass through
  });

  it('uploads the previewed artwork and records dataset provenance', async () => {
    mocks.uploadRecord.mockResolvedValue({ id: 'g1', slug: 'x', title: 'X' });

    const draft = stagedDraft({
      metadataId: 'super-mario-world',
      cover: artwork('box.png'),
      screenshots: [artwork('snap-1.png'), artwork('snap-2.png')],
    });
    await createCatalogRecord(draft);

    const [collection, fields, files] = mocks.uploadRecord.mock.calls[0]!;
    expect(collection).toBe('games');
    expect(fields).toMatchObject({
      metadata_source: 'snes-dataset',
      metadata_id: 'super-mario-world',
      scraped_at: expect.any(String),
    });
    const parts = files as { cover_image: File; screenshots: File[] };
    expect(parts.cover_image.name).toBe('box.png');
    expect(parts.screenshots.map((file) => file.name)).toEqual(['snap-1.png', 'snap-2.png']);
  });

  it('omits artwork parts and provenance for identification-only drafts', async () => {
    mocks.uploadRecord.mockResolvedValue({ id: 'g1', slug: 'x', title: 'X' });

    await createCatalogRecord(stagedDraft());

    const [, fields, files] = mocks.uploadRecord.mock.calls[0]!;
    expect(fields.metadata_source).toBeUndefined();
    expect(files).toEqual({ rom: expect.any(File) });
  });

  it('stores the headerless image for copier-headered files', async () => {
    mocks.uploadRecord.mockResolvedValue({ id: 'g1', slug: 'x', title: 'X' });

    const headered = new File([new Uint8Array(512 + 32768)], 'headered.smc');
    await createCatalogRecord(stagedDraft({ file: headered }));

    const files = mocks.uploadRecord.mock.calls[0]![2];
    expect((files.rom as File).size).toBe(32768);
  });
});

describe('attachVariant', () => {
  it('creates a non-primary ROM record with the uploaded variant file', async () => {
    mocks.uploadRecord.mockResolvedValue({ id: 'r1' });

    await attachVariant(
      { id: 'g1', slug: 'super-mario-world', title: 'Super Mario World' },
      stagedDraft(),
    );

    const [collection, fields, files] = mocks.uploadRecord.mock.calls[0]!;
    expect(collection).toBe('roms');
    expect(fields).toMatchObject({ game: 'g1', crc32: 'B19ED489', is_primary: false });
    expect((files.file as File).name).toBe('super-mario-world-ntsc-u-rev0.sfc');
  });
});

describe('toGameFields', () => {
  it('omits empty release dates and null headers', () => {
    const draft = buildCatalogDraft({ ...identified, match: null, matchBy: null }, 'x.sfc');
    const fields = toGameFields({ ...draft, release: '', header: null });

    expect(fields.release).toBeUndefined();
    expect(fields.rom_header).toBeUndefined();
  });
});

describe('commitStagedDrafts', () => {
  const item = (id: string, crc: string, overrides: Partial<StagedDraft> = {}) => ({
    id,
    draft: stagedDraft({
      values: { ...buildCatalogDraft(identified, 'smw.sfc'), crc32: crc },
      file: makeFile(),
      ...overrides,
    }),
  });

  it('creates each ready draft and reports per-entry and total progress', async () => {
    mocks.uploadRecord.mockImplementation(async (_collection, _fields, _files, onProgress) => {
      onProgress?.(50);
      onProgress?.(100);
      return { id: 'g1', slug: 'super-mario-world', title: 'Super Mario World' };
    });

    const entryStates: Array<[string, string]> = [];
    const entryProgress: Array<[string, number]> = [];
    const totalProgress: number[] = [];
    const summary = await commitStagedDrafts([item('a', 'CRC00001'), item('b', 'CRC00002')], {
      onEntryState: (id, status) => entryStates.push([id, status]),
      onEntryProgress: (id, percent) => entryProgress.push([id, percent]),
      onTotalProgress: (fraction) => totalProgress.push(fraction),
    });

    expect(summary).toEqual({ added: 2, duplicates: 0, variants: 0, failed: 0 });
    expect(mocks.uploadRecord).toHaveBeenCalledTimes(2);
    expect(entryStates.filter(([, status]) => status === 'done')).toEqual([
      ['a', 'done'],
      ['b', 'done'],
    ]);
    // Each upload reports real percent steps; every entry ends at 100.
    expect(entryProgress.filter(([, percent]) => percent === 50)).toEqual([
      ['a', 50],
      ['b', 50],
    ]);
    expect(entryProgress.at(-2)).toEqual(['b', 100]);
    expect(totalProgress.at(-1)).toBe(1);
  });

  it('reports a catalog duplicate without writing', async () => {
    mocks.getFirstListItem.mockResolvedValue({
      id: 'g0',
      slug: 'super-mario-world',
      title: 'Super Mario World',
    });

    const states: Array<Record<string, unknown>> = [];
    const summary = await commitStagedDrafts([item('a', 'B19ED489')], {
      onEntryState: (id, status, data) => states.push({ id, status, ...data }),
    });

    expect(summary).toEqual({ added: 0, duplicates: 1, variants: 0, failed: 0 });
    expect(mocks.uploadRecord).not.toHaveBeenCalled();
    expect(states.at(-1)).toEqual({
      id: 'a',
      status: 'duplicate',
      result: { slug: 'super-mario-world', title: 'Super Mario World' },
    });
  });

  it('attaches a slug-collision draft as a variant', async () => {
    mocks.getFirstListItem
      .mockRejectedValueOnce({ status: 404 }) // CRC miss
      .mockResolvedValueOnce({ id: 'g2', slug: 'super-mario-world', title: 'Super Mario World' });
    mocks.uploadRecord.mockResolvedValue({ id: 'r1' });

    const states: Array<Record<string, unknown>> = [];
    const summary = await commitStagedDrafts([item('a', 'NEWCRC001')], {
      onEntryState: (id, status, data) => states.push({ id, status, ...data }),
    });

    expect(summary).toEqual({ added: 0, variants: 1, duplicates: 0, failed: 0 });
    const [collection] = mocks.uploadRecord.mock.calls[0]!;
    expect(collection).toBe('roms');
    expect(states.at(-1)).toMatchObject({ id: 'a', status: 'variant' });
  });

  it('resolves the same CRC32 twice in one batch as a duplicate of the first commit', async () => {
    mocks.uploadRecord
      .mockResolvedValueOnce({ id: 'g1', slug: 'super-mario-world', title: 'Super Mario World' })
      .mockResolvedValue({ id: 'g9', slug: 'x', title: 'X' });

    const summary = await commitStagedDrafts([
      item('a', 'B19ED489'),
      item('b', 'B19ED489'),
    ]);

    expect(summary).toEqual({ added: 1, duplicates: 1, variants: 0, failed: 0 });
    expect(mocks.uploadRecord).toHaveBeenCalledTimes(1); // only the first commits
    // The second item never consults the catalog: the batch map settles it.
    expect(mocks.getFirstListItem).toHaveBeenCalledTimes(2);
  });

  it('isolates a failing entry and keeps committing the rest', async () => {
    mocks.uploadRecord
      .mockRejectedValueOnce(new UploadError(500, 'Backend unreachable'))
      .mockResolvedValue({ id: 'g2', slug: 'super-mario-world', title: 'Super Mario World' });

    const errors: Array<Record<string, unknown>> = [];
    const summary = await commitStagedDrafts([item('a', 'CRC00001'), item('b', 'CRC00002')], {
      onEntryState: (id, status, data) => {
        if (status === 'error') errors.push({ id, ...data });
      },
    });

    expect(summary).toEqual({ added: 1, duplicates: 0, variants: 0, failed: 1 });
    expect(mocks.uploadRecord).toHaveBeenCalledTimes(2);
    expect(errors).toEqual([{ id: 'a', error: 'Backend unreachable' }]);
  });

  it('stops the batch once when the admin session has expired', async () => {
    mocks.uploadRecord.mockRejectedValue(new AuthExpiredError());

    const errors: Array<Record<string, unknown>> = [];
    const summary = await commitStagedDrafts([item('a', 'CRC00001'), item('b', 'CRC00002')], {
      onEntryState: (id, status, data) => {
        if (status === 'error') errors.push({ id, ...data });
      },
    });

    expect(summary).toEqual({ added: 0, duplicates: 0, variants: 0, failed: 2 });
    expect(mocks.uploadRecord).toHaveBeenCalledTimes(1); // the rest would fail auth too
    expect(errors).toHaveLength(2);
    expect(errors.every((entry) => entry.error === 'Your admin session expired. Sign in again.')).toBe(true);
  });
});
