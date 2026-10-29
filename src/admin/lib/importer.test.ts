import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RomIdentification } from '@/lib/snes/types';

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

const enrichGame = vi.fn(
  async () => ({ resolved: false, metadata: false, cover: false, screenshots: 0 }),
);
vi.mock('../metadata/enrich', () => ({ enrichGame }));

const {
  attachVariant,
  buildCatalogDraft,
  createCatalogRecord,
  precheckImport,
  toGameFields,
} = await import('./importer');

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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({});
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
    mocks.getFirstListItem.mockRejectedValue({ status: 404 });

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
  it('uploads the game and creates a primary ROM record', async () => {
    mocks.uploadRecord.mockResolvedValue({
      id: 'g1',
      slug: 'super-mario-world',
      title: 'Super Mario World',
    });

    const progress = vi.fn();
    const result = await createCatalogRecord(identified, makeFile(), progress);

    expect(result.game).toEqual({
      id: 'g1',
      slug: 'super-mario-world',
      title: 'Super Mario World',
    });

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
    expect(enrichGame).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'g1',
        crc32: 'B19ED489',
        title: 'Super Mario World',
        noIntroName: 'Super Mario World (USA)',
      }),
    );
  });

  it('stores the headerless image for copier-headered files', async () => {
    mocks.uploadRecord.mockResolvedValue({ id: 'g1', slug: 'x', title: 'X' });

    const headered = new File([new Uint8Array(512 + 32768)], 'headered.smc');
    await createCatalogRecord(identified, headered);

    const files = mocks.uploadRecord.mock.calls[0]![2];
    expect((files.rom as File).size).toBe(32768);
  });
});

describe('attachVariant', () => {
  it('creates a non-primary ROM record with the uploaded variant file', async () => {
    mocks.uploadRecord.mockResolvedValue({ id: 'r1' });

    await attachVariant(
      { id: 'g1', slug: 'super-mario-world', title: 'Super Mario World' },
      identified,
      makeFile(),
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
