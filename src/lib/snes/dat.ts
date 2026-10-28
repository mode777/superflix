import type { DatEntry, DatIndex } from './types';

type TokenType = 'ident' | 'string' | 'number' | 'lparen' | 'rparen';

interface Token {
  type: TokenType;
  value: string;
}

type BlockFields = { [key: string]: string | BlockFields };

interface Block {
  fields: BlockFields;
  end: number;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i]!;

    if (ch === '\uFEFF' || /\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(' });
      i += 1;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')' });
      i += 1;
      continue;
    }

    if (ch === '"') {
      i += 1;
      let value = '';
      while (i < input.length) {
        const c = input[i]!;
        if (c === '\\' && i + 1 < input.length) {
          const next = input[i + 1]!;
          if (next === '"' || next === '\\') {
            value += next;
            i += 2;
            continue;
          }
        }
        if (c === '"') {
          i += 1;
          break;
        }
        value += c;
        i += 1;
      }
      tokens.push({ type: 'string', value });
      continue;
    }

    let value = '';
    while (i < input.length) {
      const c = input[i]!;
      if (/\s/.test(c) || c === '(' || c === ')' || c === '"') break;
      value += c;
      i += 1;
    }

    if (value) {
      tokens.push({
        type: /^-?\d+$/.test(value) ? 'number' : 'ident',
        value,
      });
    }
  }

  return tokens;
}

function parseBlock(tokens: Token[], start: number): Block {
  // start points at the opening parenthesis.
  let i = start + 1;
  const fields: BlockFields = {};

  while (i < tokens.length) {
    const token = tokens[i]!;
    if (token.type === 'rparen') {
      return { fields, end: i };
    }

    const key = token.value;
    i += 1;
    const next = tokens[i];
    if (!next) break;

    if (next.type === 'lparen') {
      const nested = parseBlock(tokens, i);
      // Keep the first occurrence of repeated keys (e.g. multiple rom blocks).
      if (!(key in fields)) fields[key] = nested.fields;
      i = nested.end + 1;
    } else {
      if (!(key in fields)) fields[key] = next.value;
      i += 1;
    }
  }

  return { fields, end: i };
}

function scalarFields(fields: BlockFields): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function normalizeHex(value: string | undefined): string {
  return (value ?? '').trim().replace(/^0x/i, '').toUpperCase();
}

/**
 * Parse a clrmamepro DAT (No-Intro / GoodSNES / libretro metadata DAT).
 * The parser is intentionally small: it reads `game (...)` blocks and their
 * scalar fields plus the nested `rom (...)` block.
 */
export function parseDat(text: string): DatEntry[] {
  const tokens = tokenize(text);
  const entries: DatEntry[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (token.type !== 'ident' || token.value !== 'game' || tokens[i + 1]?.type !== 'lparen') {
      continue;
    }

    const block = parseBlock(tokens, i + 1);
    const fields = scalarFields(block.fields);
    const romBlock = block.fields.rom;
    const rom = romBlock && typeof romBlock === 'object' ? scalarFields(romBlock) : {};

    const name = fields.name || fields.comment || '';
    if (name) {
      entries.push({
        name,
        description: fields.description || undefined,
        region: fields.region || undefined,
        serial: fields.serial || rom.serial || undefined,
        fields,
        rom: {
          name: rom.name || name,
          size: Number(rom.size ?? 0) || 0,
          crc32: normalizeHex(rom.crc),
          md5: normalizeHex(rom.md5),
          sha1: normalizeHex(rom.sha1),
          serial: rom.serial || undefined,
        },
      });
    }

    i = block.end;
  }

  return entries;
}

export function buildDatIndex(entries: DatEntry[]): DatIndex {
  const index: DatIndex = {
    byCrc32: new Map(),
    byMd5: new Map(),
    bySha1: new Map(),
    bySerial: new Map(),
    entries,
  };

  for (const entry of entries) {
    if (entry.rom.crc32) index.byCrc32.set(entry.rom.crc32, entry);
    if (entry.rom.md5) index.byMd5.set(entry.rom.md5, entry);
    if (entry.rom.sha1) index.bySha1.set(entry.rom.sha1, entry);

    const serial = entry.serial || entry.rom.serial;
    if (serial) index.bySerial.set(serial.toUpperCase(), entry);
  }

  return index;
}

export async function loadDatFromUrl(url: string): Promise<DatIndex> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load DAT from ${url} (HTTP ${response.status})`);
  }
  return buildDatIndex(parseDat(await response.text()));
}
