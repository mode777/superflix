import { crc32, md5, sha1 } from 'hash-wasm';
import type { RomHashes } from './types';

function upper(value: string): string {
  return value.toUpperCase();
}

/** CRC32, MD5 and SHA-1 of a ROM image, as uppercase hex strings. */
export async function hashRom(bytes: Uint8Array): Promise<RomHashes> {
  const [crc, md, sha] = await Promise.all([crc32(bytes), md5(bytes), sha1(bytes)]);
  return {
    crc32: upper(crc),
    md5: upper(md),
    sha1: upper(sha),
  };
}

export async function crc32Hex(bytes: Uint8Array): Promise<string> {
  return upper(await crc32(bytes));
}
