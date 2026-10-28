export type SnesMapper = 'LoROM' | 'HiROM' | 'ExHiROM' | 'SA-1' | 'Unknown';

export type SnesRegion = 'NTSC-U' | 'NTSC-J' | 'PAL' | 'Unknown';

export interface SnesHeader {
  /** Internal 21-byte title, trimmed and printable. */
  title: string;
  mapper: SnesMapper;
  mapMode: number;
  fastRom: boolean;
  cartridgeType: number;
  cartridgeTypeLabel: string;
  hasBattery: boolean;
  romSizeCode: number;
  romSize: number;
  sramSizeCode: number;
  sramSize: number;
  regionCode: number;
  region: SnesRegion;
  regionLabel: string;
  licenseeCode: number;
  version: number;
  checksum: number;
  checksumComplement: number;
  headerOffset: number;
  makerCode: string | null;
  gameCode: string | null;
  /** Internal confidence score used to pick between candidate offsets. */
  score: number;
}

export interface RomHashes {
  crc32: string;
  md5: string;
  sha1: string;
}

export interface DatRom {
  name: string;
  size: number;
  crc32: string;
  md5: string;
  sha1: string;
  serial?: string;
}

export interface DatEntry {
  /** Canonical game name from the DAT. */
  name: string;
  description?: string;
  region?: string;
  serial?: string;
  /** All scalar fields from the DAT block (developer, publisher, genre, ...). */
  fields: Record<string, string>;
  rom: DatRom;
}

export interface DatIndex {
  byCrc32: Map<string, DatEntry>;
  byMd5: Map<string, DatEntry>;
  bySha1: Map<string, DatEntry>;
  bySerial: Map<string, DatEntry>;
  entries: DatEntry[];
}

export type MatchKind = 'crc32' | 'md5' | 'sha1' | 'raw-crc32' | 'serial';

export interface RomIdentification {
  fileName?: string;
  fileSize: number;
  hadCopierHeader: boolean;
  normalizedSize: number;
  hashes: RomHashes;
  /** CRC32 of the file as supplied (useful for headered DAT fallbacks). */
  rawCrc32: string;
  header: SnesHeader | null;
  match: DatEntry | null;
  matchBy: MatchKind | null;
}
