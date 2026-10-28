# Superflix — Agent Notes

A self-hosted catalog and browser player for Super Nintendo games. React + Vite
+ Tailwind 4 frontend, PocketBase backend, Snes9x (libretro) in WebAssembly via
Nostalgist. This is a standalone project, **not** a fork of PSflix.

## Commands

```bash
npm install
npm run core:fetch      # public/cores/snes9x_libretro.{js,wasm} (gitignored)
npm run dats:fetch      # public/data/*.dat (gitignored)
npm run dev             # http://127.0.0.1:5173
npm run typecheck
npm run lint
npm run test
npm run build
npm run pb:download     # bin/pocketbase
npm run pb:serve        # PocketBase + dist/ at :8090
npm run pb:schema       # regenerate pb_schema.json + migration
```

## Layout

```
src/lib/snes/            Pure identification library (header, copier, hash, DAT)
src/features/games/      Catalog hooks and PocketBase → UI mapping
src/features/console/    Emulator service, ROM store, hooks, GameWindow
src/routes/              Browse / Details / Console / Admin / NotFound
src/components/          Layout, media cards, metadata, toasts
src/styles/index.css     Tailwind 4 theme (SNES grey + red/yellow/green/blue)
scripts/                 fetch-dats, fetch-core, generate-schema
tools/                   PocketBase download/serve
pb_migrations/           Generated initial schema
pb_schema.json           Generated schema export (source of truth is the script)
public/roms/             Bundled MIT-licensed demo ROM (Gothicvania)
ROADMAP.md               Milestones M1–M3 and cross-cutting work
```

## Architecture decisions

### ROMs are whole files

SNES ROMs are 256 KB–8 MB. There is **no** streaming, range request, CHD,
BIOS, memory card, multi-disc, or SharedArrayBuffer layer. Do not reintroduce
the PSxAnywhere worker/SAB stack. `Nostalgist.launch({ core: 'snes9x', rom })`
loads the whole file.

### Emulator boundary

`src/features/console/services/emulator.ts` is the contract. The production
implementation is `NostalgistEmulatorService`; tests can use a mock. The UI
never imports Nostalgist directly.

- Core is self-hosted from `public/cores/` (`npm run core:fetch`).
- `runEmulatorManually: true` means the core boots paused; `play()` calls
  `start()` or `resume()`.
- Save states are core-specific. Keep `core`/`core_version` in the schema.
- SRAM is a raw `.srm` blob; load it by relaunching with the `sram` option.
- Volume is approximate (`VOLUME_UP`/`VOLUME_DOWN` commands); CRT is a CSS
  scanline overlay, not a RetroArch shader.

### ROM identity

`src/lib/snes/identify.ts` is the single entry point:

1. `stripCopierHeader` — `size % 0x8000 === 0x200` means 512 extra bytes.
2. `hashRom` — CRC32/MD5/SHA1 of the headerless image.
3. `parseSnesHeader` — candidates at `0x7FC0`, `0xFFC0`, `0x40FFC0`; validate
   `checksum ^ complement === 0xFFFF`, map mode, printable title.
4. Match CRC32 → MD5 → SHA1 → raw CRC32 → game code/serial.

**No-Intro SNES DATs are headerless.** Always hash the stripped image first.
Super Mario World (USA) is CRC `B19ED489`; use that as a smoke test.

Do not replace `hash-wasm` with a hand-rolled MD5/SHA1. Add tests when touching
the header parser or DAT parser (`npm test`).

### Admin auth

`/admin` is wrapped in `AdminGate` and uses a **dedicated** PocketBase client
with `LocalAuthStore('superflix_admin_auth')` (separate from the public user
client). Only the PocketBase `_superusers` collection can sign in. The player
and catalog remain public. Do not expose the importer or write routes without
this gate.

### Data source

`src/lib/pb.ts` exposes `dataSource`:

- `mock` in development (unless `VITE_DATA_SOURCE` says otherwise) → the
  `MOCK_GAMES` catalog in `src/data/mockGames.ts`.
- `pocketbase` in production, or when `VITE_PB_URL` is set.

`useGame` checks the local game store first so the admin “Play locally” flow
works without a backend. ROMs picked locally live in `useRomStore` (memory only,
keyed by slug, with a `nonce` so re-picking the same file reloads).

### Schema

`scripts/generate-schema.mjs` is the source of truth. It emits
`pb_schema.json` and `pb_migrations/0001_initial.js`. Do not hand-edit the
generated files. Collections:

- `games` — metadata, primary ROM, hashes, parsed header.
- `roms` — optional regional/revision variants.
- `documents` — manuals/guides.
- `favorites` — owner-only user ↔ game.
- `save_state` — owner-only, unique `(type, game, user)`.
- `sram` — owner-only, unique `(user, game)`.

Public read for `games`/`roms`/`documents`; owner-only for the rest. ROM file
limit is 16 MB; save state 2 MB; SRAM 256 KB.

### Styling

Tailwind 4 theme lives in `src/styles/index.css` under `@theme`. The palette is
the Japanese/European Super Famicom look: grey shell, with red, yellow, green,
and blue accents. Use the existing tokens (`bg-surface`, `text-on-surface`,
`text-headline-lg`, `px-margin-mobile`, `max-w-page`, `glass-panel`) rather than
hard-coded colors.

## Rules

- **Never commit commercial ROMs, BIOS files, DATs, core binaries, box art, or
  screenshots.** The only ROM in the repo is the MIT-licensed
  `public/roms/gothicvania.sfc`; keep its license/attribution intact.
  `public/data/*.dat` and `public/cores/*` are gitignored.
- Do not add PlayStation/PS1 code, CHD, memory cards, or a streaming cache.
- Keep `src/lib/snes` pure and framework-free; it must run in Node tests.
- Do not use `any` unless a third-party type forces it; map unknown records
  through `mapGameRecord`.
- If you add a metadata provider, cache the result in PocketBase and record
  `metadata_source` / `metadata_id`; never hotlink images in the UI.
- If you publish the project, keep `ATTRIBUTION.md` current and add a LICENSE.

## Testing

- `npm test` — header/copier/hash/DAT/identify + BrowseView smoke test.
- `src/lib/snes/dat.real.test.ts` parses the downloaded No-Intro DAT and skips
  when the file is absent.
- `npm run typecheck` and `npm run lint` are part of the green-light gates.
- There is no Playwright suite yet; add one when the upload/player flows grow.

## Deployment

`Dockerfile` builds the SPA (fetching core + DATs first) and copies `dist/`,
`pb_migrations/`, and `pb_hooks/` into the PocketBase image. The SPA uses a hash
router, so no SPA fallback is needed. `pb_hooks/main.pb.js` only sets
`X-Content-Type-Options`; add COOP/COEP only if a future core needs
SharedArrayBuffer.
