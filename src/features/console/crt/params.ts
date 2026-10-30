import { CRT_PARAMS, type CrtParams } from './preset';

/**
 * The user-facing CRT values. Normalized to 0..1 so the panel can show
 * percentages and the shader conversion stays in one place.
 */
export interface CrtOverrides {
  scanlineStrength: number;
  /** Horizontal blur, 0..1 -> blurX 0..MAX_BLUR frame pixels. */
  hBlur: number;
  /** Vertical blur, independent of hBlur. */
  vBlur: number;
  vignette: number;
  ghosting: number;
}

/** Blur slider 1.0 maps to this many frame pixels on each axis. */
export const MAX_BLUR = 12;

/** The reference vertical/horizontal ratio, used for the default and migration. */
export const BLUR_Y_RATIO = CRT_PARAMS.blurY / CRT_PARAMS.blurX;

export const DEFAULT_CRT_OVERRIDES: CrtOverrides = {
  scanlineStrength: 1,
  hBlur: CRT_PARAMS.blurX / MAX_BLUR,
  vBlur: CRT_PARAMS.blurY / MAX_BLUR,
  vignette: 0.35,
  ghosting: 0.3,
};

export const CRT_OVERRIDES_STORAGE_KEY = 'superflix.crt-params.v1';

function clamp01OrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

function clamp01(value: unknown, fallback: number): number {
  return clamp01OrNull(value) ?? fallback;
}

/** Clamp an untrusted value into the override shape. Missing keys default. */
export function clampCrtOverrides(value: unknown): CrtOverrides {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  // v0.8.0 stored one linked `softness`; migrate it to independent axes.
  const legacySoftness = clamp01OrNull(record.softness);
  return {
    scanlineStrength: clamp01(
      record.scanlineStrength,
      DEFAULT_CRT_OVERRIDES.scanlineStrength,
    ),
    hBlur: clamp01(
      record.hBlur,
      legacySoftness ?? DEFAULT_CRT_OVERRIDES.hBlur,
    ),
    vBlur: clamp01(
      record.vBlur,
      legacySoftness !== null
        ? legacySoftness * BLUR_Y_RATIO
        : DEFAULT_CRT_OVERRIDES.vBlur,
    ),
    vignette: clamp01(record.vignette, DEFAULT_CRT_OVERRIDES.vignette),
    ghosting: clamp01(record.ghosting, DEFAULT_CRT_OVERRIDES.ghosting),
  };
}

/** Expand the five controls into the full shader parameter set. */
export function resolveCrtParams(overrides: CrtOverrides): CrtParams {
  return {
    ...CRT_PARAMS,
    scanlineStrength: overrides.scanlineStrength,
    vignette: overrides.vignette,
    ghosting: overrides.ghosting,
    blurX: overrides.hBlur * MAX_BLUR,
    blurY: overrides.vBlur * MAX_BLUR,
  };
}

function defaultStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** Read the persisted overrides, falling back to the reference defaults. */
export function readStoredCrtOverrides(storage: Storage | null = defaultStorage()): CrtOverrides {
  if (!storage) return { ...DEFAULT_CRT_OVERRIDES };
  try {
    const raw = storage.getItem(CRT_OVERRIDES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CRT_OVERRIDES };
    return clampCrtOverrides(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CRT_OVERRIDES };
  }
}

/** Persist the overrides. Storage failures leave the in-memory value intact. */
export function writeStoredCrtOverrides(
  overrides: CrtOverrides,
  storage: Storage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(CRT_OVERRIDES_STORAGE_KEY, JSON.stringify(clampCrtOverrides(overrides)));
  } catch {
    /* private mode or a full quota: keep the session value */
  }
}
