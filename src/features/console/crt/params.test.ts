import { describe, expect, it } from 'vitest';
import { CRT_PARAMS } from './preset';
import {
  BLUR_Y_RATIO,
  CRT_OVERRIDES_STORAGE_KEY,
  DEFAULT_CRT_OVERRIDES,
  MAX_BLUR,
  clampCrtOverrides,
  readStoredCrtOverrides,
  resolveCrtParams,
  writeStoredCrtOverrides,
} from './params';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe('CRT overrides', () => {
  it('defaults to the reference values', () => {
    expect(clampCrtOverrides({})).toEqual(DEFAULT_CRT_OVERRIDES);
    expect(readStoredCrtOverrides(null)).toEqual(DEFAULT_CRT_OVERRIDES);
  });

  it('clamps out-of-range and non-finite values', () => {
    expect(
      clampCrtOverrides({
        scanlineStrength: 2,
        hBlur: 2,
        vBlur: -1,
        vignette: Number.NaN,
        ghosting: 'lots',
      }),
    ).toEqual({
      scanlineStrength: 1,
      hBlur: 1,
      vBlur: 0,
      vignette: DEFAULT_CRT_OVERRIDES.vignette,
      ghosting: DEFAULT_CRT_OVERRIDES.ghosting,
    });
  });

  it('merges partial stored values with the defaults', () => {
    const storage = memoryStorage();
    storage.setItem(
      CRT_OVERRIDES_STORAGE_KEY,
      JSON.stringify({ scanlineStrength: 0.4, hBlur: 0.25 }),
    );
    expect(readStoredCrtOverrides(storage)).toEqual({
      ...DEFAULT_CRT_OVERRIDES,
      scanlineStrength: 0.4,
      hBlur: 0.25,
    });
  });

  it('migrates the v0.8.0 softness shape', () => {
    const storage = memoryStorage();
    storage.setItem(
      CRT_OVERRIDES_STORAGE_KEY,
      JSON.stringify({
        scanlineStrength: 0.6,
        softness: 0.5,
        vignette: 0.2,
        ghosting: 0.1,
      }),
    );
    const migrated = readStoredCrtOverrides(storage);
    expect(migrated.hBlur).toBe(0.5);
    expect(migrated.vBlur).toBeCloseTo(0.5 * BLUR_Y_RATIO);
    expect(migrated.scanlineStrength).toBe(0.6);
  });

  it('falls back on malformed storage', () => {
    const storage = memoryStorage();
    storage.setItem(CRT_OVERRIDES_STORAGE_KEY, '{not json');
    expect(readStoredCrtOverrides(storage)).toEqual(DEFAULT_CRT_OVERRIDES);
  });

  it('round-trips through storage', () => {
    const storage = memoryStorage();
    const next = {
      scanlineStrength: 0.6,
      hBlur: 0.8,
      vBlur: 0.2,
      vignette: 0.1,
      ghosting: 0.2,
    };
    writeStoredCrtOverrides(next, storage);
    expect(readStoredCrtOverrides(storage)).toEqual(next);
  });

  it('does not throw when storage rejects the write', () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error('quota');
    };
    expect(() => writeStoredCrtOverrides(DEFAULT_CRT_OVERRIDES, storage)).not.toThrow();
  });
});

describe('resolveCrtParams', () => {
  it('reproduces the reference shader values at the defaults', () => {
    expect(resolveCrtParams(DEFAULT_CRT_OVERRIDES)).toEqual(CRT_PARAMS);
  });

  it('maps each blur axis independently', () => {
    const horizontal = resolveCrtParams({
      ...DEFAULT_CRT_OVERRIDES,
      hBlur: 1,
      vBlur: 0,
    });
    expect(horizontal.blurX).toBe(MAX_BLUR);
    expect(horizontal.blurY).toBe(0);

    const vertical = resolveCrtParams({
      ...DEFAULT_CRT_OVERRIDES,
      hBlur: 0,
      vBlur: 1,
    });
    expect(vertical.blurX).toBe(0);
    expect(vertical.blurY).toBe(MAX_BLUR);
    expect(vertical.blurY).toBeGreaterThan(vertical.blurX);
  });

  it('passes the exposed values through and keeps the fixed terms', () => {
    const params = resolveCrtParams({
      scanlineStrength: 0.5,
      hBlur: 0.5,
      vBlur: 0.25,
      vignette: 0.2,
      ghosting: 0.1,
    });
    expect(params.scanlineStrength).toBe(0.5);
    expect(params.vignette).toBe(0.2);
    expect(params.ghosting).toBe(0.1);
    expect(params.filmicToe).toBe(CRT_PARAMS.filmicToe);
    expect(params.filmicShoulder).toBe(CRT_PARAMS.filmicShoulder);
    expect(params.gamma).toBe(CRT_PARAMS.gamma);
  });
});
