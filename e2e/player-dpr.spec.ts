import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The CRT pattern is anchored to the emulated frame, not the output surface.
 * This run uses a phone-sized viewport at DPR 2: the canvas may be rendered at
 * device resolution by the emulator, but it must stay the only rendering
 * surface and keep the 3:2 effect frame while CRT is on.
 */
test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});

async function expectCrtCanvasShape(page: Page) {
  await expect
    .poll(async () =>
      page.getByTestId('player-canvas').evaluate((canvas: HTMLCanvasElement) => ({
        ratio: canvas.width / canvas.height,
        canvases: canvas.parentElement?.querySelectorAll('canvas').length ?? 0,
        visible: canvas.getBoundingClientRect().width > 0,
      })),
    )
    .toEqual({ ratio: 1.5, canvases: 1, visible: true });
}

test.describe.serial('player at DPR 2', () => {
  test('plays the demo and keeps the CRT frame on a phone viewport', async ({ page }) => {
    test.slow();

    await page.goto('/#/game/gothicvania');
    await page.getByRole('link', { name: /Play in browser/i }).click();
    await expect(page).toHaveURL(/#\/play\/gothicvania/);

    await expect(page.getByTestId('player-canvas')).toBeVisible();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByTestId('runtime-status')).toHaveText(/live|playing/i, {
      timeout: 90_000,
    });
    await expect(page.getByText(/Could not start the emulator/i)).toHaveCount(0);

    await expectCrtCanvasShape(page);

    await page.getByRole('button', { name: 'Toggle CRT scanlines' }).click();
    await expect(page.getByTestId('runtime-status')).toHaveText(/live|playing/i);

    await page.getByRole('button', { name: 'Toggle CRT scanlines' }).click();
    await expect(page.getByTestId('runtime-status')).toHaveText(/live|playing/i);
    await expectCrtCanvasShape(page);
    await expect(page.getByText(/Could not start the emulator/i)).toHaveCount(0);
  });
});
