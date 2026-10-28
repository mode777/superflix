import { existsSync } from 'node:fs';
import path from 'node:path';

const REQUIRED = [
  'public/cores/snes9x_libretro.js',
  'public/cores/snes9x_libretro.wasm',
  'public/roms/gothicvania.sfc',
];

export default function globalSetup(): void {
  const missing = REQUIRED.filter((file) => !existsSync(path.resolve(process.cwd(), file)));

  if (missing.length > 0) {
    throw new Error(
      `Missing e2e prerequisites: ${missing.join(', ')}. Run "npm run core:fetch" before the e2e suite.`,
    );
  }
}
