// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDatIndex, enrichIndex, parseDat } from './dat';

const dataDir = path.resolve(process.cwd(), 'public/data');
const basePath = path.join(dataDir, 'no-intro-snes.dat');
const enrichmentFiles = [
  'developer-snes.dat',
  'publisher-snes.dat',
  'genre-snes.dat',
  'releaseyear-snes.dat',
  'maxusers-snes.dat',
];

const hasRealData =
  existsSync(basePath) && enrichmentFiles.every((file) => existsSync(path.join(dataDir, file)));

describe.skipIf(!hasRealData)('real enrichment DATs', () => {
  it('enriches a No-Intro entry with libretro metadata by CRC32', () => {
    const base = buildDatIndex(parseDat(readFileSync(basePath, 'utf8')));
    const enrichment = enrichmentFiles.flatMap((file) =>
      parseDat(readFileSync(path.join(dataDir, file), 'utf8')),
    );

    const index = enrichIndex(base, enrichment);
    const smw = index.byCrc32.get('B19ED489');

    expect(smw?.name).toBe('Super Mario World (USA)');
    expect(smw?.fields.developer).toBe('Nintendo EAD');
    expect(smw?.fields.genre).toBe('Platform');
    expect(smw?.fields.publisher).toBeTruthy();
    expect(smw?.fields.releaseyear).toBe('1991');
  });
});
