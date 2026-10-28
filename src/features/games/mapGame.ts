import { fileUrl } from '@/lib/pb-files';
import type { SnesHeader } from '@/lib/snes/types';
import type { Game, Region } from '@/types/games';

const PALETTES: [string, string][] = [
  ['#2563eb', '#16a34a'],
  ['#ca8a04', '#166534'],
  ['#7c3aed', '#db2777'],
  ['#0f766e', '#1e3a8a'],
  ['#b45309', '#78350f'],
  ['#1e40af', '#7e22ce'],
  ['#dc2626', '#1d4ed8'],
  ['#0369a1', '#f59e0b'],
  ['#be123c', '#f59e0b'],
  ['#16a34a', '#facc15'],
];

function paletteFor(title: string): [string, string] {
  let hash = 0;
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTES[hash % PALETTES.length]!;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function region(value: unknown): Region {
  return value === 'NTSC-J' || value === 'PAL' ? value : 'NTSC-U';
}

/** Map a PocketBase `games` record onto the UI model. */
export function mapGameRecord(record: Record<string, unknown>): Game {
  const title = str(record.title) || 'Untitled';
  const fileRecord = {
    collectionId: str(record.collectionId),
    id: str(record.id),
  };
  const cover = str(record.cover_image);
  const rom = str(record.rom);
  const headerValue = record.rom_header;

  return {
    id: str(record.id),
    slug: str(record.slug) || str(record.id),
    title,
    region: region(record.region),
    genre: str(record.genre) || 'Unknown',
    developer: str(record.developer),
    publisher: str(record.publisher),
    release: str(record.release),
    description: str(record.description),
    players: str(record.players),
    coverUrl: cover ? fileUrl(fileRecord, cover) : undefined,
    coverColors: paletteFor(title),
    screenshots: strArray(record.screenshots).map((filename) => fileUrl(fileRecord, filename)),
    romUrl: rom ? fileUrl(fileRecord, rom) : undefined,
    romCrc32: str(record.rom_crc32) || undefined,
    romSize: num(record.rom_size),
    header:
      typeof headerValue === 'object' && headerValue !== null
        ? (headerValue as SnesHeader)
        : null,
  };
}
