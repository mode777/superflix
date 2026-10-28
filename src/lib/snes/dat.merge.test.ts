// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildDatIndex, enrichIndex, mergeDatEntries, parseDat } from './dat';

const BASE_DAT = `
clrmamepro ( name "base" )
game (
  name "Super Mario World (USA)"
  region "USA"
  rom ( name "Super Mario World (USA).sfc" size 524288 crc B19ED489 )
)
game (
  name "Unknown Game (Japan)"
  region "Japan"
  rom ( size 262144 crc 11223344 )
)
`;

const DEVELOPER_DAT = `
clrmamepro ( name "developer" )
game (
  comment "Super Mario World (USA)"
  developer "Nintendo EAD"
  rom ( crc B19ED489 )
)
game (
  comment "Some Other Region"
  developer "Someone Else"
  rom ( crc B19ED489 )
)
`;

const GENRE_DAT = `
clrmamepro ( name "genre" )
game (
  comment "Super Mario World (USA)"
  genre "Platform"
  region "Europe"
  rom ( crc B19ED489 )
)
`;

describe('mergeDatEntries', () => {
  it('fills empty metadata fields from enrichment matched by CRC32', () => {
    const base = parseDat(BASE_DAT);
    const merged = mergeDatEntries(base, parseDat(DEVELOPER_DAT));

    const smw = merged.find((entry) => entry.name === 'Super Mario World (USA)');
    expect(smw?.fields.developer).toBe('Nintendo EAD');
    expect(smw?.fields.region).toBe('USA');
  });

  it('prefers the enrichment entry whose name matches the base entry', () => {
    const base = parseDat(BASE_DAT);
    const merged = mergeDatEntries(base, parseDat(DEVELOPER_DAT));

    const smw = merged.find((entry) => entry.name === 'Super Mario World (USA)');
    expect(smw?.fields.developer).toBe('Nintendo EAD');
    expect(smw?.fields.developer).not.toBe('Someone Else');
  });

  it('never overwrites existing base fields', () => {
    const base = parseDat(BASE_DAT);
    const merged = mergeDatEntries(base, parseDat(GENRE_DAT));

    const smw = merged.find((entry) => entry.name === 'Super Mario World (USA)');
    expect(smw?.fields.genre).toBe('Platform');
    expect(smw?.fields.region).toBe('USA');
  });

  it('leaves entries without an enrichment match untouched', () => {
    const base = parseDat(BASE_DAT);
    const merged = mergeDatEntries(base, parseDat(DEVELOPER_DAT));

    const unknown = merged.find((entry) => entry.name === 'Unknown Game (Japan)');
    expect(unknown).toBe(base[1]);
    expect(unknown?.fields.developer).toBeUndefined();
  });

  it('returns the original entries when enrichment is empty', () => {
    const base = parseDat(BASE_DAT);
    expect(mergeDatEntries(base, [])).toBe(base);
  });

  it('indexes merged entries by all hashes', () => {
    const index = enrichIndex(buildDatIndex(parseDat(BASE_DAT)), parseDat(DEVELOPER_DAT));

    expect(index.byCrc32.get('B19ED489')?.fields.developer).toBe('Nintendo EAD');
    expect(index.byCrc32.get('B19ED489')?.name).toBe('Super Mario World (USA)');
  });
});
