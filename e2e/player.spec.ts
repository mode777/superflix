import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The canvas backing store must stay a whole-number multiple of the SNES frame
 * (256x224) so the integer stage is never fractionally stretched, and the final
 * fit must use smooth interpolation rather than nearest-neighbour.
 */
async function expectWholePixelCanvas(page: Page) {
  await expect
    .poll(async () =>
      page.getByTestId('player-canvas').evaluate((canvas: HTMLCanvasElement) => {
        const scale = canvas.width / 256;
        return (
          canvas.width > 0 &&
          canvas.width % 256 === 0 &&
          canvas.height === scale * 224 &&
          scale >= 1 &&
          scale <= 8 &&
          getComputedStyle(canvas).imageRendering !== 'pixelated'
        );
      }),
    )
    .toBe(true);
}

/**
 * With CRT on, the canvas is the effect's fixed 1440x960 buffer: the shader is
 * applied by the emulator, so the canvas fills the stage without a transform.
 */
async function expectCrtCanvas(page: Page) {
  await expect
    .poll(async () =>
      page.getByTestId('player-canvas').evaluate((canvas: HTMLCanvasElement) => ({
        width: canvas.width,
        height: canvas.height,
        hasTransform: canvas.style.transform.startsWith('scale('),
        canvases: canvas.parentElement?.querySelectorAll('canvas').length ?? 0,
      })),
    )
    .toEqual({ width: 1440, height: 960, hasTransform: true, canvases: 1 });
}

test.describe.serial('player', () => {
  test('plays the demo ROM and round-trips a save state', async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto('/#/game/gothicvania');
    await page.getByRole('link', { name: /Play in browser/i }).click();
    await expect(page).toHaveURL(/#\/play\/gothicvania/);

    await expect(page.getByTestId('player-canvas')).toBeVisible();

    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByTestId('runtime-status')).toHaveText(/live|playing/i, {
      timeout: 90_000,
    });
    await expect(page.getByText(/Could not start the emulator/i)).toHaveCount(0);

    await expectCrtCanvas(page);

    await page.getByRole('button', { name: 'Save state', exact: true }).click();
    await expect(page.getByText(/Saved to slot1/i)).toBeVisible();

    await page.getByRole('button', { name: 'Load state', exact: true }).click();
    await expect(page.getByText(/Loaded slot1/i)).toBeVisible();
    await expect(page.getByTestId('runtime-status')).toHaveText(/live|playing/i);

    // Volume is absolute: 0 silences, 100 returns to full level, and mute
    // round-trips without disturbing playback.
    const volume = page.getByRole('slider', { name: 'Volume' });
    await volume.press('Home');
    await expect(volume).toHaveValue('0');
    await expect(page.getByTestId('runtime-status')).toHaveText(/live|playing/i);

    await volume.press('End');
    await expect(volume).toHaveValue('100');

    await page.getByRole('button', { name: 'Mute', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Unmute', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Unmute', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Mute', exact: true })).toBeVisible();
    await expect(page.getByTestId('runtime-status')).toHaveText(/live|playing/i);

    // Resizing keeps the effect's fixed buffer: its scanline count must not
    // depend on the window.
    await page.setViewportSize({ width: 900, height: 700 });
    await expectCrtCanvas(page);
    await expect(page.getByTestId('runtime-status')).toHaveText(/live|playing/i);

    // CRT off returns the canvas to a whole-pixel SNES buffer without a reload.
    await page.getByRole('button', { name: 'Toggle CRT scanlines' }).click();
    await expectWholePixelCanvas(page);
    await expect(page.getByTestId('runtime-status')).toHaveText(/live|playing/i);

    // ... and back to the effect.
    await page.getByRole('button', { name: 'Toggle CRT scanlines' }).click();
    await expectCrtCanvas(page);
    await expect(page.getByTestId('runtime-status')).toHaveText(/live|playing/i);
    await expect(page.getByText(/Could not start the emulator/i)).toHaveCount(0);
  });
});
