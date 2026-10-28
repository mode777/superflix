// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildDatIndex, parseDat } from '@/lib/snes/dat';

const SAMPLE_DAT = `clrmamepro (
  name "Nintendo - Super Nintendo Entertainment System"
  description "Test fixture"
  version "2026.10.07"
)

game (
  name "Super Mario World (USA)"
  region "USA"
  serial "A83J"
  rom ( name "Super Mario World (USA).sfc" size 524288 crc B19ED489 md5 CDD3C8C37322978CA8669B34BC89C804 sha1 6B47BB75D16514B6A476AA0C73A683A2A4C18765 )
)
game (
  name "Super Mario World (Japan)"
  region "Japan"
  rom ( name "Super Mario World (Japan).sfc" size 524288 crc 3A0C5A2B md5 00000000000000000000000000000000 sha1 0000000000000000000000000000000000000000 )
)
`;

const METADATA_DAT = `clrmamepro (
  name "Nintendo - Super Nintendo Entertainment System"
)

game (
  comment "Super Mario World (USA)"
  developer "Nintendo"
  rom ( crc B19ED489 )
)
game (
  comment "Chrono Trigger (USA)"
  developer "Square"
  rom ( crc 2D206BF7 )
)
`;

describe('parseDat', () => {
  it('parses game and rom blocks', () => {
    const entries = parseDat(SAMPLE_DAT);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      name: 'Super Mario World (USA)',
      region: 'USA',
      serial: 'A83J',
      rom: {
        name: 'Super Mario World (USA).sfc',
        size: 524288,
        crc32: 'B19ED489',
        md5: 'CDD3C8C37322978CA8669B34BC89C804',
        sha1: '6B47BB75D16514B6A476AA0C73A683A2A4C18765',
      },
    });
  });

  it('parses enrichment DATs that use comment and only a CRC', () => {
    const entries = parseDat(METADATA_DAT);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.name).toBe('Super Mario World (USA)');
    expect(entries[0]?.fields.developer).toBe('Nintendo');
    expect(entries[0]?.rom.crc32).toBe('B19ED489');
    expect(entries[0]?.rom.size).toBe(0);
  });

  it('builds CRC/MD5/SHA1/serial indexes', () => {
    const index = buildDatIndex(parseDat(SAMPLE_DAT));
    expect(index.byCrc32.get('B19ED489')?.name).toBe('Super Mario World (USA)');
    expect(index.byMd5.get('CDD3C8C37322978CA8669B34BC89C804')?.name).toBe(
      'Super Mario World (USA)',
    );
    expect(index.bySha1.get('6B47BB75D16514B6A476AA0C73A683A2A4C18765')?.name).toBe(
      'Super Mario World (USA)',
    );
    expect(index.bySerial.get('A83J')?.name).toBe('Super Mario World (USA)');
  });

  it('ignores the clrmamepro header block', () => {
    const entries = parseDat(SAMPLE_DAT);
    expect(entries.some((e) => e.name.includes('clrmamepro'))).toBe(false);
  });
});
