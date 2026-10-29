import { describe, expect, it } from 'vitest';
import { fitStage, selectRenderScale } from './scaling';

describe('selectRenderScale', () => {
  it('selects 3x for a 984x738 stage at device pixel ratio 1', () => {
    expect(selectRenderScale(984, 738, 1)).toBe(3);
  });

  it('selects from device pixels on a high-density display', () => {
    expect(selectRenderScale(984, 738, 2)).toBe(6);
  });

  it('caps the integral stage at 8x', () => {
    // 2880x2160 would fit 9x; the cap keeps the buffer at 2048x1792.
    expect(selectRenderScale(2880, 2160, 1)).toBe(8);
  });

  it('never selects below 1x', () => {
    expect(selectRenderScale(200, 150, 1)).toBe(1);
    expect(selectRenderScale(1, 1, 0.5)).toBe(1);
  });

  it('treats unmeasured or invalid stages as 1x', () => {
    expect(selectRenderScale(0, 738, 1)).toBe(1);
    expect(selectRenderScale(984, Number.NaN, 1)).toBe(1);
    expect(selectRenderScale(-984, 738, 1)).toBe(1);
  });

  it('treats an invalid device pixel ratio as 1', () => {
    expect(selectRenderScale(984, 738, Number.NaN)).toBe(3);
    expect(selectRenderScale(984, 738, 0)).toBe(3);
  });
});

describe('fitStage', () => {
  it('fits a 4:3 stage inside a 1312x738 surface', () => {
    expect(fitStage(1312, 738)).toEqual({ width: 984, height: 738 });
  });

  it('fills the height of a 16:9 fullscreen surface', () => {
    expect(fitStage(1920, 1080)).toEqual({ width: 1440, height: 1080 });
  });

  it('shrinks to the width on a narrow surface', () => {
    expect(fitStage(360, 800)).toEqual({ width: 360, height: 270 });
  });

  it('returns a zero stage for an unmeasured surface', () => {
    expect(fitStage(0, 0)).toEqual({ width: 0, height: 0 });
    expect(fitStage(Number.NaN, 738)).toEqual({ width: 0, height: 0 });
  });
});
