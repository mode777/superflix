import type { SnesRegion } from '@/lib/snes/types';
import type { Region } from '@/types/games';

/**
 * Strip trailing No-Intro region/revision markers:
 * "Super Mario World (USA) (Rev 1)" -> "Super Mario World".
 */
export function cleanDatName(name: string): string {
  let result = name;
  while (/\s*\([^)]*\)\s*$/.test(result)) result = result.replace(/\s*\([^)]*\)\s*$/, '');
  while (/\s*\[[^\]]*\]\s*$/.test(result)) result = result.replace(/\s*\[[^\]]*\]\s*$/, '');
  return result.trim() || name;
}

/** ASCII-safe kebab-case slug. */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Slug for a catalog title, falling back to the CRC32 for unnamed ROMs. */
export function deriveSlug(name: string, crc32: string): string {
  return slugify(cleanDatName(name)) || `unknown-${crc32.toLowerCase()}`;
}

/**
 * Human-readable title from a file name for ROMs without a DAT match:
 * "gothicvania.sfc" -> "Gothicvania", "super_mario_world.smc" -> "Super Mario World".
 */
export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '');
  const words = base
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  const title = words
    .map((word) =>
      word.length > 1 && word === word.toUpperCase()
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');

  return cleanDatName(title);
}

/** Map a DAT region label ("USA", "Europe", "Japan", ...) onto the catalog enum. */
export function regionFromDat(region: string | undefined): Region | null {
  if (!region) return null;
  const value = region.toLowerCase();
  if (/(japan|ntsc-j)/.test(value)) return 'NTSC-J';
  if (/(usa|ntsc-u|canada)/.test(value)) return 'NTSC-U';
  if (/(europe|pal|australia)/.test(value)) return 'PAL';
  return null;
}

/**
 * Prefer the internal header's region (it describes the actual file), falling
 * back to the DAT region label and finally NTSC-U.
 */
export function deriveRegion(datRegion: string | undefined, headerRegion?: SnesRegion): Region {
  if (headerRegion === 'NTSC-U' || headerRegion === 'NTSC-J' || headerRegion === 'PAL') {
    return headerRegion;
  }
  return regionFromDat(datRegion) ?? 'NTSC-U';
}
