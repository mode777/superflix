#!/usr/bin/env node
/**
 * Downloads the SNES identity and enrichment DATs from libretro-database into
 * public/data/. The files are gitignored; run this before building a catalog
 * or before using the importer for the first time.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://raw.githubusercontent.com/libretro/libretro-database/master/metadat';
const OUT_DIR = path.join(process.cwd(), 'public', 'data');

const FILES = [
  ['no-intro/Nintendo - Super Nintendo Entertainment System.dat', 'no-intro-snes.dat'],
  ['developer/Nintendo - Super Nintendo Entertainment System.dat', 'developer-snes.dat'],
  ['publisher/Nintendo - Super Nintendo Entertainment System.dat', 'publisher-snes.dat'],
  ['genre/Nintendo - Super Nintendo Entertainment System.dat', 'genre-snes.dat'],
  ['releaseyear/Nintendo - Super Nintendo Entertainment System.dat', 'releaseyear-snes.dat'],
  ['maxusers/Nintendo - Super Nintendo Entertainment System.dat', 'maxusers-snes.dat'],
];

await mkdir(OUT_DIR, { recursive: true });

for (const [remote, local] of FILES) {
  const url = `${BASE}/${remote.split('/').map(encodeURIComponent).join('/')}`;
  process.stdout.write(`Fetching ${local}... `);

  const response = await fetch(url, {
    headers: { 'User-Agent': 'snesflix-dats-fetch' },
  });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  const text = await response.text();
  await writeFile(path.join(OUT_DIR, local), text);
  process.stdout.write(`${(text.length / 1024).toFixed(0)} KB\n`);
}

console.log('\nDone. DATs are CC-BY-SA-4.0 (libretro-database); see public/data/README.md.');
