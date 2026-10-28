import { stripCopierHeader } from './copier';
import { parseSnesHeader } from './header';
import { crc32Hex, hashRom } from './hash';
import type { DatIndex, MatchKind, RomIdentification } from './types';

/**
 * Identify a ROM by normalizing the copier header, hashing the cartridge
 * image, reading the internal header, and matching against a DAT index.
 *
 * Match order:
 *   1. CRC32 of the headerless image (No-Intro)
 *   2. MD5 / SHA1 (for DATs that omit or disagree on CRC)
 *   3. CRC32 of the original file (headered DAT fallback)
 *   4. 4-character game code from the extended header (patched ROMs)
 */
export async function identifyRom(
  bytes: Uint8Array,
  index?: DatIndex,
  fileName?: string,
): Promise<RomIdentification> {
  const { rom, hadHeader } = stripCopierHeader(bytes);
  const hashes = await hashRom(rom);
  const rawCrc32 = hadHeader ? await crc32Hex(bytes) : hashes.crc32;
  const header = parseSnesHeader(rom);

  let match = null;
  let matchBy: MatchKind | null = null;

  if (index) {
    if (index.byCrc32.has(hashes.crc32)) {
      match = index.byCrc32.get(hashes.crc32)!;
      matchBy = 'crc32';
    } else if (index.byMd5.has(hashes.md5)) {
      match = index.byMd5.get(hashes.md5)!;
      matchBy = 'md5';
    } else if (index.bySha1.has(hashes.sha1)) {
      match = index.bySha1.get(hashes.sha1)!;
      matchBy = 'sha1';
    } else if (hadHeader && index.byCrc32.has(rawCrc32)) {
      match = index.byCrc32.get(rawCrc32)!;
      matchBy = 'raw-crc32';
    } else if (header?.gameCode && index.bySerial.has(header.gameCode.toUpperCase())) {
      match = index.bySerial.get(header.gameCode.toUpperCase())!;
      matchBy = 'serial';
    }
  }

  return {
    fileName,
    fileSize: bytes.length,
    hadCopierHeader: hadHeader,
    normalizedSize: rom.length,
    hashes,
    rawCrc32,
    header,
    match,
    matchBy,
  };
}
