import { describe, expect, it } from 'vitest';
import { cleanDatName, deriveRegion, deriveSlug, regionFromDat, slugify } from './slug';

describe('cleanDatName', () => {
  it('strips trailing region and revision markers', () => {
    expect(cleanDatName('Super Mario World (USA)')).toBe('Super Mario World');
    expect(cleanDatName('Super Mario World (Europe) (Rev 1)')).toBe('Super Mario World');
    expect(cleanDatName('Game [b] (Japan)')).toBe('Game');
  });

  it('keeps internal parentheses', () => {
    expect(cleanDatName('Zelda no Densetsu (Japan) (Rev 2)')).toBe('Zelda no Densetsu');
    expect(cleanDatName('Super Game (Special Edition)')).toBe('Super Game');
  });

  it('falls back to the original when everything is stripped', () => {
    expect(cleanDatName('(USA)')).toBe('(USA)');
  });
});

describe('slugify', () => {
  it('produces ASCII kebab-case', () => {
    expect(slugify('Super Mario World')).toBe('super-mario-world');
    expect(slugify("Kirby's Dream Land 3")).toBe('kirbys-dream-land-3');
    expect(slugify('Pokémon Red')).toBe('pokemon-red');
    expect(slugify('  Chrono  Trigger!! ')).toBe('chrono-trigger');
  });

  it('returns an empty string for punctuation-only titles', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('deriveSlug', () => {
  it('uses the slugified title', () => {
    expect(deriveSlug('Super Mario World (USA)', 'B19ED489')).toBe('super-mario-world');
  });

  it('falls back to the CRC32 when the title has no usable characters', () => {
    expect(deriveSlug('!!!', 'B19ED489')).toBe('unknown-b19ed489');
  });
});

describe('region mapping', () => {
  it('maps DAT region labels', () => {
    expect(regionFromDat('USA')).toBe('NTSC-U');
    expect(regionFromDat('Japan')).toBe('NTSC-J');
    expect(regionFromDat('Europe')).toBe('PAL');
    expect(regionFromDat('World')).toBeNull();
  });

  it('prefers the internal header region', () => {
    expect(deriveRegion('Europe', 'NTSC-J')).toBe('NTSC-J');
    expect(deriveRegion('Europe', 'Unknown')).toBe('PAL');
    expect(deriveRegion(undefined, undefined)).toBe('NTSC-U');
  });
});
