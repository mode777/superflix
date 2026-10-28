// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { identifyRom } from './identify';

const romPath = path.resolve(process.cwd(), 'public/roms/gothicvania.sfc');

describe('bundled demo ROM', () => {
  it('parses as a valid LoROM image', async () => {
    const bytes = new Uint8Array(readFileSync(romPath));
    const result = await identifyRom(bytes);

    expect(result.fileSize).toBe(524_288);
    expect(result.hadCopierHeader).toBe(false);
    expect(result.header).not.toBeNull();
    expect(result.header?.title).toBe('GOTHICVANIA CEMETERY');
    expect(result.header?.mapper).toBe('LoROM');
    expect(result.header?.region).toBe('NTSC-U');
    expect(result.header?.hasBattery).toBe(false);
    expect(result.hashes.crc32).toMatch(/^[0-9A-F]{8}$/);
    expect(result.hashes.md5).toMatch(/^[0-9A-F]{32}$/);
    expect(result.hashes.sha1).toMatch(/^[0-9A-F]{40}$/);
  });
});
