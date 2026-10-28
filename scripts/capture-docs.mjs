#!/usr/bin/env node
/**
 * Captures the landing/docs screenshots from a running production build.
 *
 *   npm run build          # with VITE_DATA_SOURCE=mock
 *   npm run preview -- --port 4173
 *   node scripts/capture-docs.mjs
 *
 * Only captures the bundled MIT-licensed demo ROM. Never commit screenshots of
 * commercial games.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.DOCS_BASE_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.CHROME_SHELL_PATH;
const OUT_DIR = path.join(process.cwd(), 'docs', 'assets');

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

try {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.locator('#library').evaluate((element) => {
    element.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, 'browse.png') });
  console.log('captured browse.png');

  await page.goto(`${BASE}/#/game/gothicvania`);
  await page.getByRole('heading', { name: 'Gothicvania', level: 1 }).waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, 'details.png') });
  console.log('captured details.png');

  await page.goto(`${BASE}/#/play/gothicvania`);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page
    .getByTestId('runtime-status')
    .filter({ hasText: /live|playing/i })
    .waitFor({ timeout: 90_000 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT_DIR, 'player.png') });
  console.log('captured player.png');
} finally {
  await browser.close();
}
