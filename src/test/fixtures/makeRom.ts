export interface MakeRomOptions {
  size?: number;
  title?: string;
  mapMode?: number;
  cartridgeType?: number;
  romSizeCode?: number;
  sramSizeCode?: number;
  regionCode?: number;
  version?: number;
  checksum?: number;
  headerOffset?: number;
  gameCode?: string;
  makerCode?: string;
  fill?: number;
}

/**
 * Build a synthetic ROM with a valid internal header. Used by unit tests only;
 * no copyrighted ROM data is included in this repository.
 */
export function makeRom(options: MakeRomOptions = {}): Uint8Array {
  const size = options.size ?? 0x8000;
  const rom = new Uint8Array(size);
  rom.fill(options.fill ?? 0);

  const offset = options.headerOffset ?? 0x7fc0;
  if (offset + 0x20 > size) {
    throw new Error(`ROM size ${size} is too small for header at 0x${offset.toString(16)}`);
  }

  const title = (options.title ?? 'TEST GAME').padEnd(21, ' ').slice(0, 21);
  for (let i = 0; i < 21; i += 1) rom[offset + i] = title.charCodeAt(i);

  rom[offset + 0x15] = options.mapMode ?? 0x20;
  rom[offset + 0x16] = options.cartridgeType ?? 0x02;
  rom[offset + 0x17] = options.romSizeCode ?? 0x09;
  rom[offset + 0x18] = options.sramSizeCode ?? 0x03;
  rom[offset + 0x19] = options.regionCode ?? 0x01;
  rom[offset + 0x1a] = 0x33;
  rom[offset + 0x1b] = options.version ?? 0x00;

  const checksum = options.checksum ?? 0x1234;
  const complement = checksum ^ 0xffff;
  rom[offset + 0x1c] = complement & 0xff;
  rom[offset + 0x1d] = (complement >> 8) & 0xff;
  rom[offset + 0x1e] = checksum & 0xff;
  rom[offset + 0x1f] = (checksum >> 8) & 0xff;

  const ext = offset - 0x10;
  if (ext >= 0) {
    const maker = (options.makerCode ?? '01').padEnd(2, ' ').slice(0, 2);
    for (let i = 0; i < 2; i += 1) rom[ext + i] = maker.charCodeAt(i);
    const code = (options.gameCode ?? 'TEST').padEnd(4, ' ').slice(0, 4);
    for (let i = 0; i < 4; i += 1) rom[ext + 2 + i] = code.charCodeAt(i);
  }

  return rom;
}

export function withCopierHeader(rom: Uint8Array): Uint8Array {
  const out = new Uint8Array(rom.length + 512);
  out.set(rom, 512);
  return out;
}
