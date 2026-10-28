// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildDatIndex, parseDat } from '@/lib/snes/dat';
import { hashRom } from '@/lib/snes/hash';
import { identifyRom } from '@/lib/snes/identify';
import { makeRom, withCopierHeader } from '@/test/fixtures/makeRom';

async function indexFor(rom: Uint8Array, name: string, serial?: string) {
  const hashes = await hashRom(rom);
  const dat = `clrmamepro ( name "test" )
game (
  name "${name}"
  region "USA"
  ${serial ? `serial "${serial}"` : ''}
  rom ( name "${name}.sfc" size ${rom.length} crc ${hashes.crc32} md5 ${hashes.md5} sha1 ${hashes.sha1} )
)
`;
  return buildDatIndex(parseDat(dat));
}

describe('identifyRom', () => {
  it('matches a headerless ROM by CRC32 and reads its header', async () => {
    const rom = makeRom({ title: 'IDENT TEST', gameCode: 'IDNT' });
    const index = await indexFor(rom, 'Ident Test (USA)', 'IDNT');
    const result = await identifyRom(rom, index, 'ident.sfc');

    expect(result.hadCopierHeader).toBe(false);
    expect(result.matchBy).toBe('crc32');
    expect(result.match?.name).toBe('Ident Test (USA)');
    expect(result.header?.title).toBe('IDENT TEST');
    expect(result.header?.gameCode).toBe('IDNT');
  });

  it('strips a 512-byte copier header before matching', async () => {
    const rom = makeRom({ title: 'HEADER TEST' });
    const index = await indexFor(rom, 'Header Test (USA)');
    const result = await identifyRom(withCopierHeader(rom), index);

    expect(result.hadCopierHeader).toBe(true);
    expect(result.normalizedSize).toBe(rom.length);
    expect(result.matchBy).toBe('crc32');
    expect(result.match?.name).toBe('Header Test (USA)');
    expect(result.header?.title).toBe('HEADER TEST');
  });

  it('falls back to the extended-header game code for patched ROMs', async () => {
    const original = makeRom({ title: 'PATCHED TEST', gameCode: 'PTCH' });
    const index = await indexFor(original, 'Patched Test (USA)', 'PTCH');

    const patched = original.slice();
    patched[0x100] ^= 0xff; // change the payload without touching the header
    const result = await identifyRom(patched, index);

    expect(result.matchBy).toBe('serial');
    expect(result.match?.name).toBe('Patched Test (USA)');
  });

  it('returns no match when the index is empty', async () => {
    const rom = makeRom();
    const result = await identifyRom(rom, buildDatIndex([]));
    expect(result.match).toBeNull();
    expect(result.matchBy).toBeNull();
    expect(result.header?.title).toBe('TEST GAME');
  });
});
