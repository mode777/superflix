import { CRT_PARAMS, type CrtParams } from './preset';

/**
 * The user-facing CRT values. Normalized to 0..1 so the panel can show
 * percentages and the shader conversion stays in one place.
 */
export interface CrtOverrides {
  scanlineStrength: number;
  softness: number;
  vignette: number;
  ghosting: number;
}

export const DEFAULT_CRT_OVERRIDES: CrtOverrides = {
  scanlineStrength: 1,
  softness: 0.5,
  vignette: 0.35,
  ghosting: 0.3,
};

export const CRT_OVERRIDES_STORAGE_KEY = 'superflix.crt-params.v1';

/** Softness 1.0 maps to this horizontal blur step in frame pixels. */
export const SOFTNESS_MAX_BLUR_X = 12;

/** Vertical/horizontal ratio that reproduces the reference 2.5/6 look. */
export const BLUR_Y_RATIO = CRT_PARAMS.blurY / CRT_PARAMS.blurX;

function clamp01(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

/** Clamp an untrusted value into the override shape. Missing keys default. */
export function clampCrtOverrides(value: unknown): CrtOverrides {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    scanlineStrength: clamp01(
      record.scanlineStrength,
      DEFAULT_CRT_OVERRIDES.scanlineStrength,
    ),
    softness: clamp01(record.softness, DEFAULT_CRT_OVERRIDES.softness),
    vignette: clamp01(record.vignette, DEFAULT_CRT_OVERRIDES.vignette),
    ghosting: clamp01(record.ghosting, DEFAULT_CRT_OVERRIDES.ghosting),
  };
}

/** Expand the four controls into the full shader parameter set. */
export function resolveCrtParams(overrides: CrtOverrides): CrtParams {
  const blurX = overrides.softness * SOFTNESS_MAX_BLUR_X;
  return {
    ...CRT_PARAMS,
    scanlineStrength: overrides.scanlineStrength,
    vignette: overrides.vignette,
    ghosting: overrides.ghosting,
    blurX,
    blurY: blurX * BLUR_Y_RATIO,
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
