import { expect, test } from '@playwright/test';

test.describe('details', () => {
  test('shows metadata and navigates to the player', async ({ page }) => {
    await page.goto('/#/game/gothicvania');

    await expect(page.getByRole('heading', { name: 'Gothicvania', level: 1 })).toBeVisible();
    await expect(page.getByText('Developer', { exact: true })).toBeVisible();
    await expect(page.locator('dd').filter({ hasText: 'Platform' })).toBeVisible();
    await expect(page.getByText(/grave|cemetery|platformer/i).first()).toBeVisible();

    await page.getByRole('link', { name: /Play in browser/i }).click();
    await expect(page).toHaveURL(/#\/play\/gothicvania/);
  });
});
