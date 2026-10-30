// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DATASET_BASE_URL,
  datasetSlugFromTitle,
  mapDatasetRecord,
  matchDatasetTitle,
  normalizeNoIntroName,
  parseLooseDate,
  regionToDateKeys,
  releaseDateForRegion,
  type DatasetTitleEntry,
} from './snes-dataset';

describe('datasetSlugFromTitle', () => {
  it('slugifies plain titles', () => {
    expect(datasetSlugFromTitle('Super Mario World')).toBe('super-mario-world');
    expect(datasetSlugFromTitle('Chrono Trigger')).toBe('chrono-trigger');
  });

  it('collapses punctuation, diacritics, and symbols', () => {
    expect(datasetSlugFromTitle("Kirby's Dream Land & Friends")).toBe('kirby-s-dream-land-friends');
    expect(datasetSlugFromTitle('Pokémon Red')).toBe('pokemon-red');
    expect(datasetSlugFromTitle('3×3 Eyes: Seima Kourin Den')).toBe('3-3-eyes-seima-kourin-den');
    expect(datasetSlugFromTitle('Chuck Rock II: Son of Chuck')).toBe('chuck-rock-ii-son-of-chuck');
  });

  it('moves trailing articles to the front', () => {
    expect(datasetSlugFromTitle('Magical Quest Starring Mickey Mouse, The')).toBe(
      'the-magical-quest-starring-mickey-mouse',
    );
    expect(datasetSlugFromTitle('Combatribes, The')).toBe('the-combatribes');
    expect(datasetSlugFromTitle('Legend of Zelda, The')).toBe('the-legend-of-zelda');
  });

  it('never returns leading or trailing dashes', () => {
    expect(datasetSlugFromTitle('  -- Weired (Title) -- ')).toBe('weired-title');
  });
});

describe('normalizeNoIntroName', () => {
  it('strips region, revision, and dump tags', () => {
    expect(normalizeNoIntroName('Super Metroid (Japan, USA)')).toBe('Super Metroid');
    expect(normalizeNoIntroName('Chrono Trigger (USA) (Rev 1)')).toBe('Chrono Trigger');
    expect(normalizeNoIntroName('Fire Emblem: Monshou no Nazo (Japan) [!]')).toBe(
      'Fire Emblem: Monshou no Nazo',
    );
    expect(normalizeNoIntroName("Kirby's Avalanche (USA) (Proto)")).toBe("Kirby's Avalanche");
  });

  it('keeps punctuation inside the title', () => {
    expect(normalizeNoIntroName('U.N. Squadron (USA)')).toBe('U.N. Squadron');
  });
});

describe('matchDatasetTitle', () => {
  const index: DatasetTitleEntry[] = [
    { title: '2020 Super Baseball', slug: '2020-super-baseball' },
    { title: 'Chrono Trigger', slug: 'chrono-trigger' },
    { title: 'Combatribes, The', slug: 'the-combatribes' },
    { title: 'Pokémon Red', slug: 'pokemon-red' },
  ];

  it('matches display-title keys case-insensitively', () => {
    expect(matchDatasetTitle('chrono trigger', index)).toEqual({
      title: 'Chrono Trigger',
      slug: 'chrono-trigger',
    });
  });

  it('ignores punctuation differences', () => {
    expect(matchDatasetTitle('2020 Super Baseball!', index)?.slug).toBe('2020-super-baseball');
  });

  it('ignores diacritics', () => {
    expect(matchDatasetTitle('Pokemon Red', index)?.slug).toBe('pokemon-red');
  });

  it('matches the leading-article form against a trailing article key', () => {
    expect(matchDatasetTitle('The Combatribes', index)?.slug).toBe('the-combatribes');
    expect(matchDatasetTitle('Combatribes, The', index)?.slug).toBe('the-combatribes');
  });

  it('returns the first matching entry on normalization collisions', () => {
    const colliding: DatasetTitleEntry[] = [
      { title: 'Game: Version A', slug: 'game-version-a' },
      { title: 'Game — Version A', slug: 'game-version-a-2' },
    ];
    expect(matchDatasetTitle('game version a', colliding)?.slug).toBe('game-version-a');
  });

  it('returns null when nothing matches', () => {
    expect(matchDatasetTitle('Unknown Game', index)).toBeNull();
  });

  it('returns null for an unusable title', () => {
    expect(matchDatasetTitle('', index)).toBeNull();
    expect(matchDatasetTitle('   ', index)).toBeNull();
  });
});

describe('regionToDateKeys', () => {
  it('maps catalog regions to dataset date keys', () => {
    expect(regionToDateKeys('NTSC-U')).toEqual(['north_america', 'usa']);
    expect(regionToDateKeys('NTSC-J')).toEqual(['japan']);
    expect(regionToDateKeys('PAL')).toEqual(['pal', 'europe']);
  });
});

describe('parseLooseDate', () => {
  it('parses the dataset date shapes deterministically', () => {
    expect(parseLooseDate('1995-08-22')).toBe('1995-08-22');
    expect(parseLooseDate('August 11, 1995')).toBe('1995-08-11');
    expect(parseLooseDate('August 1995')).toBe('1995-08-01');
    expect(parseLooseDate('1995')).toBe('1995-01-01');
  });

  it('rejects values it cannot understand', () => {
    expect(parseLooseDate('')).toBeNull();
    expect(parseLooseDate('TBA')).toBeNull();
    expect(parseLooseDate('Foobar 12, 1995')).toBeNull();
  });
});

describe('releaseDateForRegion', () => {
  const dates = {
    japan: 'August 1995',
    north_america: 'August 11, 1995',
    usa: 'August 1995',
    europe: '23 June 1995',
    pal: '1995',
    first_release: '1995-08-22',
  };

  it('picks the region-appropriate date', () => {
    expect(releaseDateForRegion(dates, 'NTSC-U')).toBe('1995-08-11 00:00:00.000Z');
    expect(releaseDateForRegion(dates, 'NTSC-J')).toBe('1995-08-01 00:00:00.000Z');
    expect(releaseDateForRegion(dates, 'PAL')).toBe('1995-01-01 00:00:00.000Z');
  });

  it('falls back to first_release, then the record year', () => {
    expect(releaseDateForRegion({}, 'NTSC-U', 1991)).toBe('1991-01-01 00:00:00.000Z');
    expect(releaseDateForRegion({ first_release: '1995-08-22' }, 'NTSC-J')).toBe(
      '1995-08-22 00:00:00.000Z',
    );
  });

  it('returns empty when nothing is parseable', () => {
    expect(releaseDateForRegion(undefined, 'NTSC-U')).toBe('');
    expect(releaseDateForRegion({ north_america: 'TBA' }, 'NTSC-U')).toBe('');
  });
});

describe('mapDatasetRecord', () => {
  it('maps a full record', () => {
    const fields = mapDatasetRecord(
      {
        description: 'Take control of Crono…',
        genre: ['Role-Playing', 'Console-style RPG'],
        developer: ['Square', 'SquareSoft'],
        publisher: ['Square'],
        players: '1',
        release_dates: { north_america: 'August 11, 1995' },
        year: 1995,
      },
      'NTSC-U',
    );

    expect(fields).toEqual({
      description: 'Take control of Crono…',
      genre: 'Role-Playing, Console-style RPG',
      developer: 'Square',
      publisher: 'Square',
      players: '1',
      release: '1995-08-11 00:00:00.000Z',
    });
  });

  it('maps a partial record without inventing values', () => {
    const fields = mapDatasetRecord({ description: null, year: 1996 }, 'PAL');
    expect(fields).toEqual({
      description: '',
      genre: '',
      developer: '',
      publisher: '',
      players: '',
      release: '1996-01-01 00:00:00.000Z',
    });
  });

  it('maps an empty record to empty fields', () => {
    expect(mapDatasetRecord({}, 'NTSC-J')).toEqual({
      description: '',
      genre: '',
      developer: '',
      publisher: '',
      players: '',
      release: '',
    });
  });
});

describe('DATASET_BASE_URL', () => {
  it('points at the published dataset', () => {
    expect(DATASET_BASE_URL).toBe('https://mode777.github.io/snes-dataset');
  });
});
