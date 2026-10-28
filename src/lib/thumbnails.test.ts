// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { imageNameStem, thumbnailUrl } from './thumbnails';

describe('thumbnailUrl', () => {
  it('builds exact-name libretro-thumbnails URLs', () => {
    expect(thumbnailUrl('Super Mario World (USA)', 'boxart')).toBe(
      'https://thumbnails.libretro.com/Nintendo%20-%20Super%20Nintendo%20Entertainment%20System/Named_Boxarts/Super%20Mario%20World%20(USA).png',
    );
  });

  it('uses the right directory per artwork kind', () => {
    expect(thumbnailUrl('Game', 'snap')).toContain('/Named_Snaps/Game.png');
    expect(thumbnailUrl('Game', 'title')).toContain('/Named_Titles/Game.png');
  });

  it('URL-encodes punctuation and diacritics', () => {
    expect(thumbnailUrl("Kirby's Dream Land & Friends", 'boxart')).toContain(
      'Kirby%27s%20Dream%20Land%20%26%20Friends.png',
    );
    expect(thumbnailUrl('Pokémon Red', 'boxart')).toContain('Pok%C3%A9mon%20Red.png');
  });

  it('honours a custom base URL', () => {
    expect(thumbnailUrl('Game', 'boxart', 'https://mirror.test/')).toMatch(
      /^https:\/\/mirror\.test\/Nintendo/,
    );
  });
});

describe('imageNameStem', () => {
  it('produces safe upload names', () => {
    expect(imageNameStem('Super Mario World (USA)')).toBe('super-mario-world-usa');
    expect(imageNameStem('!!!')).toBe('artwork');
  });
});
