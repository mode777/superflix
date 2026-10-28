import { expect, test } from '@playwright/test';

test('icons render as glyphs from the subset font (not fallback text)', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const result = await page.evaluate(async () => {
    await document.fonts.load('24px "Material Symbols Outlined"');
    await document.fonts.ready;

    const probe = document.createElement('span');
    probe.className = 'material-symbols-outlined';
    probe.style.fontSize = '24px';
    probe.style.position = 'absolute';
    probe.textContent = 'play_arrow';
    document.body.appendChild(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();

    // The ligature must resolve to the same glyph as play_arrow's codepoint
    // (U+E037); a fallback/tofu glyph would render differently.
    const paint = (text: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext('2d');
      if (!context) return '';
      context.font = '48px "Material Symbols Outlined"';
      context.fillStyle = '#000';
      context.textBaseline = 'top';
      context.fillText(text, 4, 4);
      return canvas.toDataURL();
    };
    const ligatureMatchesGlyph = paint('play_arrow') === paint('\ue037');

    const fonts = performance
      .getEntriesByType('resource')
      .filter((entry) => /\.woff2(\?|$)/.test(entry.name))
      .map((entry) => (entry as PerformanceResourceTiming).decodedBodySize);

    return {
      width,
      ligatureMatchesGlyph,
      loaded: document.fonts.check('24px "Material Symbols Outlined"'),
      iconFontBytes: fonts.reduce((total, size) => total + size, 0),
    };
  });

  // A single ligature glyph is ~24px wide; fallback text renders much wider.
  expect(result.width).toBeGreaterThan(0);
  expect(result.width).toBeLessThan(40);
  expect(result.ligatureMatchesGlyph).toBe(true);
  expect(result.loaded).toBe(true);
  // The full font is ~4 MB; the subset must be an order of magnitude smaller.
  expect(result.iconFontBytes).toBeGreaterThan(0);
  expect(result.iconFontBytes).toBeLessThan(400_000);
});
