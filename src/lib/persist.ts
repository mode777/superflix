/**
 * Defensive localStorage helpers for typed slices. A corrupt or schema-changed
 * slice never poisons the others; every error falls back to defaults.
 */
export type FieldParser<T> = (raw: unknown, fallback: T) => T;

export type Slice<T extends object> = {
  key: string;
  fallback: T;
  fields: { [K in keyof T]: FieldParser<T[K]> };
};

export function readPersisted<T extends object>(slice: Slice<T>): T {
  try {
    const raw = localStorage.getItem(slice.key);
    if (!raw) return { ...slice.fallback };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out = {} as T;
    (Object.keys(slice.fallback) as (keyof T)[]).forEach((field) => {
      out[field] = slice.fields[field](parsed[field as string], slice.fallback[field]);
    });
    return out;
  } catch {
    return { ...slice.fallback };
  }
}

export function writePersisted<T extends object>(slice: Slice<T>, value: T): void {
  try {
    localStorage.setItem(slice.key, JSON.stringify(value));
  } catch {
    // ignore private mode / quota errors
  }
}

export const parsers = {
  boolean(raw: unknown, fallback: boolean): boolean {
    return typeof raw === 'boolean' ? raw : fallback;
  },
  number(raw: unknown, fallback: number): number {
    return typeof raw === 'number' ? raw : fallback;
  },
  clamped(min: number, max: number): FieldParser<number> {
    return (raw, fallback) =>
      typeof raw === 'number' ? Math.min(max, Math.max(min, raw)) : fallback;
  },
  enum<T extends string>(values: readonly T[]): FieldParser<T> {
    return (raw, fallback) =>
      typeof raw === 'string' && (values as readonly string[]).includes(raw)
        ? (raw as T)
        : fallback;
  },
};
