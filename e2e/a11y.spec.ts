import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const SEVERITIES = ['serious', 'critical'];

async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact && SEVERITIES.includes(violation.impact),
  );

  expect(
    serious.map(
      (violation) =>
        `${violation.id}: ${violation.help} -> ${violation.nodes
          .map((node) => node.target.join(' '))
          .join(' | ')}`,
    ),
    `${label} accessibility violations`,
  ).toEqual([]);
}

for (const route of [
  { name: 'browse', path: '/' },
  { name: 'details', path: '/#/game/gothicvania' },
  { name: 'admin sign-in', path: '/#/admin' },
]) {
  test(`${route.name} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(route.path);
    await page.waitForLoadState('networkidle');
    await expectNoSeriousViolations(page, route.name);
  });
}

test('player has no serious accessibility violations after boot', async ({ page }) => {
  test.slow();
  await page.goto('/#/play/gothicvania');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByTestId('runtime-status')).toHaveText(/live|playing/i, {
    timeout: 90_000,
  });

  await expectNoSeriousViolations(page, 'player');
});

test('reduced motion disables decorative animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const duration = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'animate-pulse';
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).animationDuration;
    probe.remove();
    return value;
  });

  expect(Number.parseFloat(duration)).toBeLessThan(0.01);
});

test('keyboard users can reach the player transport controls', async ({ page }) => {
  await page.goto('/#/play/gothicvania');

  const play = page.getByRole('button', { name: 'Play', exact: true });
  await expect(play).toBeEnabled();
  await play.focus();
  await expect(play).toBeFocused();
  await expect(page.getByRole('button', { name: 'Save state', exact: true })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Volume' })).toBeVisible();
});
