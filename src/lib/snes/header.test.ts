// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hasCopierHeader, stripCopierHeader } from '@/lib/snes/copier';
import { parseSnesHeader } from '@/lib/snes/header';
import { makeRom, withCopierHeader } from '@/test/fixtures/makeRom';

describe('copier header', () => {
  it('detects 512 bytes over a multiple of 32 KB', () => {
    expect(hasCopierHeader(0x8000 + 512)).toBe(true);
    expect(hasCopierHeader(0x8000)).toBe(false);
    expect(hasCopierHeader(0x10000 + 512)).toBe(true);
    expect(hasCopierHeader(0x10000 + 256)).toBe(false);
  });

  it('strips the header without mutating the input', () => {
    const rom = makeRom();
    const headered = withCopierHeader(rom);
    const result = stripCopierHeader(headered);
    expect(result.hadHeader).toBe(true);
    expect(result.rom.length).toBe(rom.length);
    expect(result.rom[0x7fc0]).toBe(rom[0x7fc0]);
    expect(headered.length).toBe(rom.length + 512);
  });
});

describe('parseSnesHeader', () => {
  it('parses a LoROM header', () => {
    const rom = makeRom({ title: 'SUPER TEST', regionCode: 0x01 });
    const header = parseSnesHeader(rom);
    expect(header).not.toBeNull();
    expect(header).toMatchObject({
      title: 'SUPER TEST',
      mapper: 'LoROM',
      mapMode: 0x20,
      fastRom: false,
      region: 'NTSC-U',
      regionLabel: 'USA / Canada',
      hasBattery: true,
      sramSize: 8192,
      version: 0,
      checksum: 0x1234,
      headerOffset: 0x7fc0,
      gameCode: 'TEST',
      makerCode: '01',
    });
  });

  it('parses a HiROM header', () => {
    const rom = makeRom({
      size: 0x10000,
      headerOffset: 0xffc0,
      mapMode: 0x31,
      title: 'HIROM TEST',
      regionCode: 0x00,
    });
    const header = parseSnesHeader(rom);
    expect(header).not.toBeNull();
    expect(header).toMatchObject({
      title: 'HIROM TEST',
      mapper: 'HiROM',
      fastRom: true,
      region: 'NTSC-J',
      headerOffset: 0xffc0,
    });
  });

  it('recognises SA-1 mapping', () => {
    const rom = makeRom({ mapMode: 0x23, title: 'SA1 TEST' });
    const header = parseSnesHeader(rom);
    expect(header?.mapper).toBe('SA-1');
  });

  it('parses an ExHiROM header', () => {
    const rom = makeRom({
      size: 0x410000,
      headerOffset: 0x40ffc0,
      mapMode: 0x25,
      title: 'EXHIROM TEST',
    });
    const header = parseSnesHeader(rom);
    expect(header).not.toBeNull();
    expect(header).toMatchObject({
      title: 'EXHIROM TEST',
      mapper: 'ExHiROM',
      headerOffset: 0x40ffc0,
    });
  });

  it('returns null for a blank file', () => {
    expect(parseSnesHeader(new Uint8Array(0x8000))).toBeNull();
  });

  it('rejects a header with a broken checksum and no known map mode', () => {
    const rom = makeRom();
    rom[0x7fc0] = 0xff; // break the title
    rom[0x7fd5] = 0x99; // unknown map mode
    rom[0x7fdc] = 0x00;
    rom[0x7fdd] = 0x00;
    rom[0x7fde] = 0x00;
    rom[0x7fdf] = 0x00;
    expect(parseSnesHeader(rom)).toBeNull();
  });
});
