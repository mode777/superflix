import type { SnesHeader } from '@/lib/snes/types';

export type Region = 'NTSC-U' | 'NTSC-J' | 'PAL';

export interface Game {
  id: string;
  slug: string;
  title: string;
  region: Region;
  genre: string;
  developer: string;
  publisher: string;
  /** ISO date string. */
  release: string;
  description: string;
  players: string;
  coverUrl?: string;
  /** Gradient used when no cover image has been imported yet. */
  coverColors: [string, string];
  screenshots: string[];
  romUrl?: string;
  romCrc32?: string;
  romSize?: number;
  header?: SnesHeader | null;
}

export interface GameFilters {
  search: string;
  genre: string;
}

export const ALL_GENRE = 'All';

export const GENRES = [
  ALL_GENRE,
  'Action',
  'Adventure',
  'RPG',
  'Platform',
  'Racing',
  'Shooter',
  'Puzzle',
  'Sports',
  'Strategy',
];
