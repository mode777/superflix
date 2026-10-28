#!/usr/bin/env node
/**
 * Downloads the Snes9x libretro core used by Nostalgist into public/cores/.
 * Self-hosting the core avoids a runtime dependency on jsDelivr and keeps the
 * player working offline after the first load.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const VERSION = 'v1.22.0';
const BASE = `https://cdn.jsdelivr.net/gh/arianrhodsandlot/retroarch-emscripten-build@${VERSION}/retroarch`;
const OUT_DIR = path.join(process.cwd(), 'public', 'cores');
const FILES = ['snes9x_libretro.js', 'snes9x_libretro.wasm'];

await mkdir(OUT_DIR, { recursive: true });

for (const file of FILES) {
  const url = `${BASE}/${file}`;
  process.stdout.write(`Fetching ${file}... `);

  const response = await fetch(url, {
    headers: { 'User-Agent': 'superflix-core-fetch' },
  });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(path.join(OUT_DIR, file), bytes);
  process.stdout.write(`${(bytes.length / 1024 / 1024).toFixed(2)} MB\n`);
}

console.log('\nDone. Snes9x core is ready in public/cores/.');
