// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { crc32Hex, hashRom } from '@/lib/snes/hash';

describe('hashRom', () => {
  it('computes the standard CRC32/MD5/SHA1 test vector', async () => {
    const bytes = new TextEncoder().encode('123456789');
    const hashes = await hashRom(bytes);
    expect(hashes.crc32).toBe('CBF43926');
    expect(hashes.md5).toBe('25F9E794323B453885F5181F1B624D0B');
    expect(hashes.sha1).toBe('F7C3BC1D808E04732ADF679965CCC34CA7AE3441');
  });

  it('exposes a CRC32-only helper', async () => {
    const bytes = new TextEncoder().encode('123456789');
    expect(await crc32Hex(bytes)).toBe('CBF43926');
  });
});
