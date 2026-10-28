import { expect, test } from '@playwright/test';

test.describe('browse', () => {
  test('renders the catalog and filters by genre and search', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /Every classic/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Gothicvania/i }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Platform', exact: true }).click();
    await expect(page.getByRole('link', { name: /Super Mario World/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Chrono Trigger/i })).toHaveCount(0);

    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.getByLabel('Search games').fill('Chrono');
    await expect(page.getByRole('link', { name: /Chrono Trigger/i }).first()).toBeVisible();

    await page.getByLabel('Search games').fill('zzzz-no-such-game');
    await expect(page.getByText('No games match')).toBeVisible();
  });
});
