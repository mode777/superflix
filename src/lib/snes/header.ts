import type { SnesHeader, SnesMapper, SnesRegion } from './types';

export interface HeaderCandidate {
  offset: number;
  mapper: Exclude<SnesMapper, 'Unknown'>;
}

/**
 * The internal header sits right before the interrupt vectors. Its file offset
 * depends on the cartridge mapping:
 *
 *   LoROM    0x007FC0
 *   HiROM    0x00FFC0
 *   ExHiROM  0x40FFC0
 *
 * SA-1 uses the LoROM location with map mode 0x23.
 */
export const HEADER_CANDIDATES: readonly HeaderCandidate[] = [
  { offset: 0x7fc0, mapper: 'LoROM' },
  { offset: 0xffc0, mapper: 'HiROM' },
  { offset: 0x40ffc0, mapper: 'ExHiROM' },
];

const MAP_MODES: Record<number, { mapper: SnesMapper; fastRom: boolean }> = {
  0x20: { mapper: 'LoROM', fastRom: false },
  0x21: { mapper: 'HiROM', fastRom: false },
  0x23: { mapper: 'SA-1', fastRom: false },
  0x25: { mapper: 'ExHiROM', fastRom: false },
  0x30: { mapper: 'LoROM', fastRom: true },
  0x31: { mapper: 'HiROM', fastRom: true },
  0x35: { mapper: 'ExHiROM', fastRom: true },
};

const REGIONS: Record<number, { region: SnesRegion; label: string }> = {
  0x00: { region: 'NTSC-J', label: 'Japan' },
  0x01: { region: 'NTSC-U', label: 'USA / Canada' },
  0x02: { region: 'PAL', label: 'Europe' },
  0x03: { region: 'PAL', label: 'Scandinavia' },
  0x06: { region: 'PAL', label: 'France' },
  0x07: { region: 'PAL', label: 'Netherlands' },
  0x08: { region: 'PAL', label: 'Spain' },
  0x09: { region: 'PAL', label: 'Germany' },
  0x0a: { region: 'PAL', label: 'Italy' },
  0x0b: { region: 'PAL', label: 'China' },
  0x0d: { region: 'NTSC-J', label: 'Korea' },
  0x0e: { region: 'Unknown', label: 'Common' },
  0x0f: { region: 'NTSC-U', label: 'Canada' },
  0x10: { region: 'PAL', label: 'Brazil' },
  0x11: { region: 'PAL', label: 'Australia' },
  0x12: { region: 'Unknown', label: 'Other' },
  0x13: { region: 'Unknown', label: 'Other' },
  0x14: { region: 'Unknown', label: 'Other' },
};

const CARTRIDGE_TYPES: Record<number, string> = {
  0x00: 'ROM',
  0x01: 'ROM + RAM',
  0x02: 'ROM + RAM + Battery',
  0x03: 'ROM + DSP',
  0x04: 'ROM + DSP + RAM',
  0x05: 'ROM + DSP + RAM + Battery',
  0x13: 'ROM + Super FX',
  0x14: 'ROM + Super FX + RAM',
  0x15: 'ROM + Super FX + RAM + Battery',
  0x25: 'ROM + OBC1 + RAM + Battery',
  0x34: 'ROM + SA-1 + RAM',
  0x35: 'ROM + SA-1 + RAM + Battery',
  0x43: 'ROM + S-DD1',
  0x45: 'ROM + S-DD1 + RAM + Battery',
  0x55: 'ROM + S-RTC + RAM + Battery',
  0xe3: 'ROM + Other Chip',
};

function decodeTitle(bytes: Uint8Array): string {
  // JIS X 0201 is a subset of Shift-JIS; it decodes ASCII plus half-width
  // katakana. Fall back to ASCII when TextDecoder is unavailable.
  let text: string;
  try {
    text = new TextDecoder('shift_jis').decode(bytes);
  } catch {
    text = new TextDecoder('ascii').decode(bytes);
  }
  const cleaned = Array.from(text)
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code < 0x20 || code === 0x7f ? ' ' : char;
    })
    .join('');

  return cleaned.replace(/\s+/g, ' ').trim();
}

function printableRatio(bytes: Uint8Array): number {
  let printable = 0;
  for (const b of bytes) {
    if ((b >= 0x20 && b <= 0x7e) || (b >= 0xa0 && b <= 0xdf)) printable += 1;
  }
  return printable / bytes.length;
}

function readU16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readAscii(bytes: Uint8Array): string {
  return Array.from(bytes)
    .filter((b) => b >= 0x20 && b <= 0x7e)
    .map((b) => String.fromCharCode(b))
    .join('')
    .trim();
}

function parseCandidate(rom: Uint8Array, candidate: HeaderCandidate): SnesHeader | null {
  const { offset } = candidate;
  if (offset + 0x20 > rom.length) return null;

  const header = rom.subarray(offset, offset + 0x20);
  const checksum = readU16LE(header, 0x1e);
  const checksumComplement = readU16LE(header, 0x1c);
  const checksumValid = (checksum ^ checksumComplement) === 0xffff;

  const mapMode = header[0x15]!;
  const mapInfo = MAP_MODES[mapMode];
  const title = decodeTitle(header.subarray(0, 21));
  const titleScore = printableRatio(header.subarray(0, 21));

  // A random 32-byte window can accidentally pass one check; require a valid
  // checksum OR a known map mode plus a mostly printable title.
  if (!checksumValid && !(mapInfo && titleScore >= 0.7)) return null;

  const cartridgeType = header[0x16]!;
  const romSizeCode = header[0x17]!;
  const sramSizeCode = header[0x18]!;
  const regionCode = header[0x19]!;
  const regionInfo = REGIONS[regionCode] ?? { region: 'Unknown' as const, label: 'Unknown' };

  const extendedOffset = offset - 0x10;
  const makerCode =
    extendedOffset >= 0 ? readAscii(rom.subarray(extendedOffset, extendedOffset + 2)) : '';
  const gameCode =
    extendedOffset >= 0 ? readAscii(rom.subarray(extendedOffset + 2, extendedOffset + 6)) : '';

  let score = 0;
  if (checksumValid) score += 100;
  if (mapInfo) score += 20;
  score += Math.round(titleScore * 10);

  return {
    title,
    mapper: mapInfo?.mapper ?? candidate.mapper,
    mapMode,
    fastRom: mapInfo?.fastRom ?? false,
    cartridgeType,
    cartridgeTypeLabel: CARTRIDGE_TYPES[cartridgeType] ?? `Unknown (0x${cartridgeType.toString(16)})`,
    hasBattery: (cartridgeType & 0x02) !== 0,
    romSizeCode,
    romSize: romSizeCode === 0 ? 0 : 1024 << (romSizeCode & 0x0f),
    sramSizeCode,
    sramSize: sramSizeCode === 0 ? 0 : 1024 << (sramSizeCode & 0x0f),
    regionCode,
    region: regionInfo.region,
    regionLabel: regionInfo.label,
    licenseeCode: header[0x1a]!,
    version: header[0x1b]!,
    checksum,
    checksumComplement,
    headerOffset: offset,
    makerCode: makerCode.length === 2 ? makerCode : null,
    gameCode: gameCode.length === 4 ? gameCode : null,
    score,
  };
}

/**
 * Find and parse the internal SNES header. Returns null when no candidate looks
 * like a valid header (e.g. a homebrew ROM with a blank header).
 */
export function parseSnesHeader(rom: Uint8Array): SnesHeader | null {
  let best: SnesHeader | null = null;
  for (const candidate of HEADER_CANDIDATES) {
    const parsed = parseCandidate(rom, candidate);
    if (parsed && (!best || parsed.score > best.score)) best = parsed;
  }
  return best;
}
