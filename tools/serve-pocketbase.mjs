#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === 'win32';
const ext = isWindows ? '.exe' : '';
const pocketbasePath = join(here, '..', 'bin', `pocketbase${ext}`);

const result = spawnSync(
  pocketbasePath,
  ['serve', '--publicDir', './dist', '--dir', './pb_data', '--hooksDir', './pb_hooks'],
  {
    stdio: 'inherit',
    cwd: join(here, '..'),
  },
);

process.exit(result.status ?? 1);
