import { expect, test } from '@playwright/test';

test.describe.serial('player', () => {
  test('plays the demo ROM and round-trips a save state', async ({ page }) => {
    test.slow();

    await page.goto('/#/game/gothicvania');
    await page.getByRole('link', { name: /Play in browser/i }).click();
    await expect(page).toHaveURL(/#\/play\/gothicvania/);

    await expect(page.locator('canvas')).toBeVisible();

    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByTestId('runtime-status')).toHaveText(/live|playing/i, {
      timeout: 90_000,
    });
    await expect(page.getByText(/Could not start the emulator/i)).toHaveCount(0);

    await page.getByRole('button', { name: 'Save state', exact: true }).click();
    await expect(page.getByText(/Saved to slot1/i)).toBeVisible();

    await page.getByRole('button', { name: 'Load state', exact: true }).click();
    await expect(page.getByText(/Loaded slot1/i)).toBeVisible();
    await expect(page.getByTestId('runtime-status')).toHaveText(/live|playing/i);
  });
});
