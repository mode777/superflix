#!/usr/bin/env node
/**
 * Generates pb_schema.json and pb_migrations/0001_initial.js from a compact
 * spec. PocketBase is picky about collection/field IDs and rule shapes, so
 * keeping the spec in one place is less error-prone than hand-editing JSON.
 *
 * Run: npm run pb:schema
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const USERS_ID = '_pb_users_auth_';

function hex(seed, length) {
  return createHash('sha1').update(seed).digest('hex').slice(0, length);
}

function collectionId(name) {
  return `pbc_${hex(`collection:${name}`, 11)}`;
}

function fieldId(collection, name, prefix) {
  return `${prefix}${hex(`field:${collection}:${name}`, 11)}`;
}

function idField(collection) {
  return {
    autogeneratePattern: '[a-z0-9]{15}',
    help: '',
    hidden: false,
    id: fieldId(collection, 'id', 'text'),
    max: 15,
    min: 15,
    name: 'id',
    pattern: '^[a-z0-9]+$',
    presentable: false,
    primaryKey: true,
    required: true,
    system: true,
    type: 'text',
  };
}

function text(collection, name, { required = false, max = 0, min = 0 } = {}) {
  return {
    autogeneratePattern: '',
    help: '',
    hidden: false,
    id: fieldId(collection, name, 'text'),
    max,
    min,
    name,
    pattern: '',
    presentable: false,
    primaryKey: false,
    required,
    system: false,
    type: 'text',
  };
}

function select(collection, name, values, { maxSelect = 0, required = false } = {}) {
  return {
    help: '',
    hidden: false,
    id: fieldId(collection, name, 'sel'),
    maxSelect,
    name,
    presentable: false,
    required,
    system: false,
    type: 'select',
    values,
  };
}

function file(
  collection,
  name,
  { maxSelect = 0, maxSize = 0, mimeTypes = null, required = false, protected: isProtected = false } = {},
) {
  return {
    help: '',
    hidden: false,
    id: fieldId(collection, name, 'file'),
    maxSelect,
    maxSize,
    mimeTypes,
    name,
    presentable: false,
    protected: isProtected,
    required,
    system: false,
    thumbs: null,
    type: 'file',
  };
}

function relation(
  collection,
  name,
  target,
  { required = true, maxSelect = 0, minSelect = 0, cascadeDelete = true } = {},
) {
  return {
    cascadeDelete,
    collectionId: target,
    help: '',
    hidden: false,
    id: fieldId(collection, name, 'rel'),
    maxSelect,
    minSelect,
    name,
    presentable: false,
    required,
    system: false,
    type: 'relation',
  };
}

function number(collection, name, { min = 0, max = 0, onlyInt = false, required = false } = {}) {
  return {
    help: '',
    hidden: false,
    id: fieldId(collection, name, 'num'),
    max,
    min,
    name,
    onlyInt,
    presentable: false,
    required,
    system: false,
    type: 'number',
  };
}

function json(collection, name, { maxSize = 0, required = false } = {}) {
  return {
    help: '',
    hidden: false,
    id: fieldId(collection, name, 'json'),
    maxSize,
    name,
    presentable: false,
    required,
    system: false,
    type: 'json',
  };
}

function date(collection, name, { required = false } = {}) {
  return {
    help: '',
    hidden: false,
    id: fieldId(collection, name, 'date'),
    max: '',
    min: '',
    name,
    presentable: false,
    required,
    system: false,
    type: 'date',
  };
}

function bool(collection, name, { required = false } = {}) {
  return {
    help: '',
    hidden: false,
    id: fieldId(collection, name, 'bool'),
    name,
    presentable: false,
    required,
    system: false,
    type: 'bool',
  };
}

function autodate(collection, name, onCreate, onUpdate) {
  return {
    hidden: false,
    id: fieldId(collection, name, 'auto'),
    name,
    onCreate,
    onUpdate,
    presentable: false,
    system: false,
    type: 'autodate',
  };
}

function timestamps(collection) {
  return [
    autodate(collection, 'created', true, false),
    autodate(collection, 'updated', true, true),
  ];
}

const GAMES_ID = collectionId('games');
const ROMS_ID = collectionId('roms');
const DOCUMENTS_ID = collectionId('documents');
const FAVORITES_ID = collectionId('favorites');
const SAVE_STATE_ID = collectionId('save_state');
const SRAM_ID = collectionId('sram');

const collections = [
  {
    id: GAMES_ID,
    listRule: '',
    viewRule: '',
    createRule: null,
    updateRule: null,
    deleteRule: null,
    name: 'games',
    type: 'base',
    fields: [
      idField('games'),
      text('games', 'title', { required: true }),
      text('games', 'slug', { required: true }),
      select('games', 'region', ['NTSC-U', 'NTSC-J', 'PAL']),
      text('games', 'genre'),
      text('games', 'developer'),
      text('games', 'publisher'),
      date('games', 'release'),
      file('games', 'cover_image', { maxSize: 10_000_000, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] }),
      file('games', 'screenshots', {
        maxSelect: 10,
        maxSize: 10_000_000,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      }),
      text('games', 'description', { max: 50_000 }),
      text('games', 'manufacturer_description'),
      json('games', 'languages'),
      json('games', 'features'),
      text('games', 'players'),
      file('games', 'rom', { maxSize: 16_000_000 }),
      text('games', 'rom_crc32', { required: true }),
      text('games', 'rom_md5'),
      text('games', 'rom_sha1'),
      number('games', 'rom_size', { min: 0, max: 16_777_216, onlyInt: true }),
      json('games', 'rom_header'),
      text('games', 'metadata_source'),
      text('games', 'metadata_id'),
      date('games', 'scraped_at'),
      ...timestamps('games'),
    ],
    indexes: [
      `CREATE UNIQUE INDEX \`idx_games_slug\` ON \`games\` (\`slug\`)`,
      `CREATE UNIQUE INDEX \`idx_games_rom_crc32\` ON \`games\` (\`rom_crc32\`)`,
    ],
    system: false,
  },
  {
    id: ROMS_ID,
    listRule: '',
    viewRule: '',
    createRule: null,
    updateRule: null,
    deleteRule: null,
    name: 'roms',
    type: 'base',
    fields: [
      idField('roms'),
      relation('roms', 'game', GAMES_ID),
      select('roms', 'region', ['NTSC-U', 'NTSC-J', 'PAL']),
      number('roms', 'revision', { min: 0, max: 99, onlyInt: true }),
      text('roms', 'crc32', { required: true }),
      text('roms', 'md5'),
      text('roms', 'sha1'),
      number('roms', 'size', { min: 0, max: 16_777_216, onlyInt: true }),
      file('roms', 'file', { maxSize: 16_000_000 }),
      bool('roms', 'is_primary'),
      json('roms', 'header'),
      ...timestamps('roms'),
    ],
    indexes: [
      `CREATE UNIQUE INDEX \`idx_roms_crc32\` ON \`roms\` (\`crc32\`)`,
      `CREATE UNIQUE INDEX \`idx_roms_variant\` ON \`roms\` (\`game\`, \`region\`, \`revision\`)`,
    ],
    system: false,
  },
  {
    id: DOCUMENTS_ID,
    listRule: '',
    viewRule: '',
    createRule: null,
    updateRule: null,
    deleteRule: null,
    name: 'documents',
    type: 'base',
    fields: [
      idField('documents'),
      select('documents', 'type', ['manual', 'guide'], { required: true }),
      relation('documents', 'game', GAMES_ID, { required: false }),
      file('documents', 'file', { maxSize: 100_000_000, required: true }),
      ...timestamps('documents'),
    ],
    indexes: [],
    system: false,
  },
  {
    id: FAVORITES_ID,
    listRule: '@request.auth.id = user.id',
    viewRule: '@request.auth.id = user.id',
    createRule: '@request.auth.id = user.id',
    updateRule: '@request.auth.id = user.id',
    deleteRule: '@request.auth.id = user.id',
    name: 'favorites',
    type: 'base',
    fields: [
      idField('favorites'),
      relation('favorites', 'user', USERS_ID),
      relation('favorites', 'game', GAMES_ID),
      ...timestamps('favorites'),
    ],
    indexes: [`CREATE UNIQUE INDEX \`idx_favorites_user_game\` ON \`favorites\` (\`user\`, \`game\`)`],
    system: false,
  },
  {
    id: SAVE_STATE_ID,
    listRule: '@request.auth.id = user.id',
    viewRule: '@request.auth.id = user.id',
    createRule: '@request.auth.id = user.id',
    updateRule: '@request.auth.id = user.id',
    deleteRule: '@request.auth.id = user.id',
    name: 'save_state',
    type: 'base',
    fields: [
      idField('save_state'),
      select('save_state', 'type', ['auto', 'slot1', 'slot2', 'slot3'], { required: true }),
      relation('save_state', 'game', GAMES_ID),
      relation('save_state', 'user', USERS_ID),
      file('save_state', 'data', { maxSize: 2_000_000, required: true }),
      text('save_state', 'core'),
      text('save_state', 'core_version'),
      ...timestamps('save_state'),
    ],
    indexes: [
      `CREATE UNIQUE INDEX \`idx_save_state_slot\` ON \`save_state\` (\`type\`, \`game\`, \`user\`)`,
    ],
    system: false,
  },
  {
    id: SRAM_ID,
    listRule: '@request.auth.id = user.id',
    viewRule: '@request.auth.id = user.id',
    createRule: '@request.auth.id = user.id',
    updateRule: '@request.auth.id = user.id',
    deleteRule: '@request.auth.id = user.id',
    name: 'sram',
    type: 'base',
    fields: [
      idField('sram'),
      relation('sram', 'user', USERS_ID),
      relation('sram', 'game', GAMES_ID),
      file('sram', 'data', { maxSize: 262_144, required: true }),
      ...timestamps('sram'),
    ],
    indexes: [`CREATE UNIQUE INDEX \`idx_sram_user_game\` ON \`sram\` (\`user\`, \`game\`)`],
    system: false,
  },
];

const migration = `/// <reference path="../pb_data/types.d.ts" />
// Generated by scripts/generate-schema.mjs — do not edit by hand.
migrate((app) => {
  const collections = ${JSON.stringify(collections, null, 2)};

  for (const data of collections) {
    app.save(new Collection(data));
  }
}, (app) => {
  const ids = ${JSON.stringify(collections.map((collection) => collection.id).reverse())};

  for (const id of ids) {
    try {
      app.delete(app.findCollectionByNameOrId(id));
    } catch {
      // already removed
    }
  }
});
`;

await mkdir(path.join(ROOT, 'pb_migrations'), { recursive: true });
await writeFile(path.join(ROOT, 'pb_schema.json'), `${JSON.stringify(collections, null, 2)}\n`);
await writeFile(path.join(ROOT, 'pb_migrations', '0001_initial.js'), migration);

console.log(`Wrote pb_schema.json (${collections.length} collections)`);
console.log('Wrote pb_migrations/0001_initial.js');
