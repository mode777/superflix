// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDatIndex, parseDat } from './dat';

const datPath = path.resolve(process.cwd(), 'public/data/no-intro-snes.dat');
const hasDat = existsSync(datPath);

describe.skipIf(!hasDat)('real No-Intro SNES DAT', () => {
  it('parses the full DAT and indexes a known title', () => {
    const index = buildDatIndex(parseDat(readFileSync(datPath, 'utf8')));
    expect(index.entries.length).toBeGreaterThan(3000);
    expect(index.byCrc32.get('B19ED489')?.name).toBe('Super Mario World (USA)');
    expect(index.byMd5.get('CDD3C8C37322978CA8669B34BC89C804')?.name).toBe(
      'Super Mario World (USA)',
    );
  });
});
