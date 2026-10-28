/**
 * Many SNES ROMs circulated as `.smc` carry a 512-byte copier header.
 * It is not part of the cartridge image and must be stripped before hashing
 * against a headerless DAT (No-Intro) or reading the internal header.
 */
export const COPIER_HEADER_SIZE = 512;

export function hasCopierHeader(size: number): boolean {
  return size > COPIER_HEADER_SIZE && size % 0x8000 === COPIER_HEADER_SIZE;
}

export function stripCopierHeader(bytes: Uint8Array): {
  rom: Uint8Array;
  hadHeader: boolean;
} {
  if (!hasCopierHeader(bytes.length)) {
    return { rom: bytes, hadHeader: false };
  }
  return { rom: bytes.subarray(COPIER_HEADER_SIZE), hadHeader: true };
}
