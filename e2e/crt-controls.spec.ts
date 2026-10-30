import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const SEVERITIES = ['serious', 'critical'];

async function startDemo(page: Page) {
  await page.goto('/#/game/gothicvania');
  await page.getByRole('link', { name: /Play in browser/i }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByTestId('runtime-status')).toHaveText(/live|playing/i, {
    timeout: 90_000,
  });
}

async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact && SEVERITIES.includes(violation.impact),
  );
  expect(
    serious.map((violation) => `${violation.id}: ${violation.help}`),
    `${label} accessibility violations`,
  ).toEqual([]);
}

test('tunes CRT parameters while playing and remembers them', async ({ page }) => {
  test.slow();

  await startDemo(page);
  await page.getByRole('button', { name: 'Tune CRT' }).click();
  await expect(page.getByRole('group', { name: 'CRT settings' })).toBeVisible();

  const scanlines = page.getByRole('slider', { name: 'Scanlines' });
  await expect(scanlines).toHaveValue('100');

  await scanlines.focus();
  await scanlines.press('Home');
  await expect(scanlines).toHaveValue('0');
  await expect(page.getByTestId('runtime-status')).toHaveText(/live|playing/i);
  await expect(page.getByText(/Could not start the emulator/i)).toHaveCount(0);

  await expectNoSeriousViolations(page, 'CRT panel');

  // The value lives in browser storage; a reload and a fresh boot must reuse it.
  await page.reload();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByTestId('runtime-status')).toHaveText(/live|playing/i, {
    timeout: 90_000,
  });
  await page.getByRole('button', { name: 'Tune CRT' }).click();
  await expect(page.getByRole('slider', { name: 'Scanlines' })).toHaveValue('0');

  await page.getByRole('button', { name: 'Reset to reference' }).click();
  await expect(page.getByRole('slider', { name: 'Scanlines' })).toHaveValue('100');
  await expect(page.getByTestId('runtime-status')).toHaveText(/live|playing/i);
});
