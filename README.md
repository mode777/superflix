# Superflix

A self-hosted, Netflix-style catalog and browser player for **Super Nintendo**
games. Browse a curated grid, open a details view with cover, screenshots, and
ROM metadata, and play in the browser. React frontend, PocketBase backend,
Snes9x in WebAssembly.

This is a fresh, standalone project — it is **not** a fork of PSflix. It reuses
the parts of PSflix that are not PlayStation-specific (the app shell, catalog
UI, admin patterns, PocketBase deployment) and drops the entire PS1 streaming /
BIOS / memory-card stack.

## Name

**Superflix** — “Super” for Super Nintendo, “flix” for the Netflix-style
catalog. The project was scaffolded as `snesflix` and renamed before the first
public release. Other names considered: `snesflix`, `sneshelf`, `supercrate`,
`cartflix`.

## Status

See [`ROADMAP.md`](./ROADMAP.md) for the milestone plan (M1 persistence,
M2 metadata/artwork, M3 accounts/cloud saves). This repository is a **working
vertical slice**, not a finished product:

- ✅ Browse and details views (mock catalog in development; PocketBase in production)
- ✅ ROM identification in the browser: copier-header stripping, internal
  header parsing, CRC32/MD5/SHA1, No-Intro DAT matching
- ✅ “Drop a ROM → identify → play locally” flow
- ✅ Browser player via Nostalgist + Snes9x (save states, SRAM export/import,
  CRT scanline overlay, controller input via RetroArch)
- ✅ Bundled MIT-licensed demo ROM (**Gothicvania**) playable out of the box
- ✅ PocketBase schema + generated migration for games, ROM variants, save
  states, SRAM, documents, favorites
- ⏳ PocketBase upload pipeline (the schema and importer contract are ready)
- ⏳ Metadata enrichment from the libretro developer/publisher/genre DATs
- ⏳ Cover/screenshot download and storage
- ✅ Admin/importer gated to the PocketBase superuser
- ⏳ End-user auth, favorites, and cloud save-state sync UI

## Quick start

```bash
npm install

# Runtime assets (both are gitignored)
npm run core:fetch   # Snes9x libretro JS + WASM → public/cores/
npm run dats:fetch   # No-Intro + libretro metadata DATs → public/data/

npm run dev          # http://127.0.0.1:5173
```

Open http://127.0.0.1:5173 and click **Play featured** to run the bundled
MIT-licensed **Gothicvania** demo. No backend is needed for the player.

### Admin / importer (superuser only)

The `/admin` route is gated to the PocketBase superuser. Start PocketBase and
create a local superuser:

```bash
npm run pb:download
npm run build
npm run pb:serve     # API + SPA at http://127.0.0.1:8090

# In another shell:
./bin/pocketbase superuser upsert you@example.com password
```

Open `/admin`, sign in, and drop a `.sfc`/`.smc` file. Identification runs
entirely in the browser; **Play locally** loads the ROM into the player without
uploading anything.

In production the superuser is created from the `POCKETBASE_ADMIN_EMAIL` /
`POCKETBASE_ADMIN_PASSWORD` env vars supplied by the GitOps secret
(`superflix/resources.yaml`).

Set `VITE_DATA_SOURCE=pocketbase` (and `VITE_PB_URL` if PocketBase is on a
different origin) to use the real catalog instead of the mock data. The schema
is applied by `pb_migrations/0001_initial.js` on first serve. A fresh
production instance with an empty `games` collection falls back to the bundled
Gothicvania demo so the player is usable immediately.

## How ROM identification works

The importer follows the same idea as GoodSNES/No-Intro, with the internal
header as a second signal:

1. **Strip the copier header** — many `.smc` files have 512 extra bytes at the
   start. Detection: `size % 0x8000 === 0x200`.
2. **Hash the cartridge image** — CRC32, MD5, SHA1.
3. **Parse the internal header** at `0x7FC0` (LoROM), `0xFFC0` (HiROM), or
   `0x40FFC0` (ExHiROM). Validate `checksum ^ complement === 0xFFFF`, the map
   mode, and a printable title.
4. **Match** the headerless CRC32 against the No-Intro index. Fall back to
   MD5 → SHA1 → raw CRC32 → 4-character game code → manual metadata.

The parser reads title, mapper (LoROM/HiROM/ExHiROM/SA-1), FastROM, cartridge
type, battery, ROM size, SRAM size, region, revision, checksum, maker code, and
game code. See `src/lib/snes/` and its tests.

**GoodSNES vs No-Intro:** GoodSNES is a legacy CRC32 DAT with `(U) [!]`-style
names. No-Intro is the maintained successor and is what this project uses.
GoodSNES can be imported as a secondary index if you have legacy dumps.

## Metadata sources

| Source | What it gives | Identification | License / notes |
|---|---|---|---|
| [No-Intro via libretro-database](https://github.com/libretro/libretro-database) | Name, region, size, CRC32/MD5/SHA1, serial | Hash | CC-BY-SA-4.0 mirror; headerless DAT |
| libretro `developer` / `publisher` / `genre` / `releaseyear` / `maxusers` DATs | Structured metadata keyed by CRC32 | Hash | CC-BY-SA-4.0 |
| [libretro-thumbnails](https://thumbnails.libretro.com/) | Boxart, snaps, title screens | No-Intro name | No explicit license; images are copyrighted |
| [ScreenScraper](https://www.screenscraper.fr/webapi2.php) | Synopsis, dates, genres, 2D/3D boxart, screenshots, manuals, videos | CRC/MD5/SHA1 + size | CC BY-NC-SA 4.0; developer credentials + quotas |
| [IGDB](https://api-docs.igdb.com) | Summary, genres, companies, cover, screenshots | Title (platform 19 = SNES) | Free non-commercial; Twitch credentials; attribution |
| [TheGamesDB](https://api.thegamesdb.net) | Metadata + art | Title/hash | API key; monthly allowance |
| [RetroAchievements](https://retroachievements.org) | Achievements, box art | MD5 | API key; optional |
| [Hasheous](https://github.com/gaseous-project/hasheous) | Hash → IGDB match | CRC/MD5/SHA1 | Public instance; AGPL server |

The current importer uses **No-Intro only** for identity. The enrichment DATs
are downloaded by `npm run dats:fetch` and ready for the next phase.

## Emulator core

- **Snes9x** (libretro) via [Nostalgist.js](https://nostalgist.js.org/).
- The core is fetched to `public/cores/` and served same-origin; no CDN
  dependency at runtime.
- No BIOS, no disc streaming, no memory cards, no SharedArrayBuffer layer.
- Save states are core-specific; the scaffold keeps them in memory for the
  session. The `save_state` schema stores `core`/`core_version` so a real
  implementation can reject incompatible states.
- If you need a GPL-compatible core, switch to **bsnes** and update the core
  name in `src/features/console/services/nostalgistEmulatorService.ts`.

## Project layout

```
src/lib/snes/              Header parser, copier header, hashing, DAT parser, identify
src/features/games/        Catalog hooks + PocketBase mapping
src/features/console/      Emulator service, ROM store, hooks, GameWindow
src/routes/                Browse, Details, Console, Admin, NotFound
src/admin/                 ROM dropzone
src/components/            Header, media cards, metadata, screenshots, toasts
src/styles/index.css       Tailwind 4 theme (Obsidian Console, SNES palette)
scripts/                   DAT fetch, core fetch, schema generator
tools/                     PocketBase download/serve helpers
pb_migrations/             Generated initial schema
pb_schema.json             Source-of-truth schema export
public/data/               Runtime DATs (gitignored)
public/cores/              Runtime emulator core (gitignored)
```

## PocketBase schema

| Collection | Purpose | Access |
|---|---|---|
| `games` | One catalog entry: metadata + primary ROM + hashes + parsed header | Public read |
| `roms` | Optional regional/revision variants of a game | Public read |
| `documents` | Manuals and guides | Public read |
| `favorites` | User ↔ game link | Owner only |
| `save_state` | Per-user save state per game/slot | Owner only |
| `sram` | Per-user battery save per game | Owner only |

Edit the spec in `scripts/generate-schema.mjs`, then run `npm run pb:schema` to
regenerate `pb_schema.json` and the migration. Do not hand-edit the generated
files.

## Build & deployment

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

The Dockerfile builds the SPA (including the fetched core/DATs) and bakes it
into a PocketBase image:

```bash
docker build -t superflix .
docker run -p 8090:8090 -v "$PWD/pb_data:/pocketbase/pb_data" superflix
```

`VITE_PB_URL` is empty for same-origin PocketBase. The SPA uses a hash router,
so PocketBase’s static handler needs no SPA fallback.

### Live instance

**<https://snes.alexklingenbeck.de>**

Deployment follows the PSflix pattern and is managed entirely from the
[`cloud.alexklingenbeck.de`](https://github.com/mode777/cloud.alexklingenbeck.de)
GitOps repo:

| Piece | Location |
|---|---|
| App manifests | `superflix/resources.yaml` |
| Flux Kustomization | `flux-superflix` (depends on `flux-longhorn`, `flux-cluster-issuer`) |
| Image | `harbor.alexklingenbeck.de/my/superflix:<version>` |
| Release | GitHub Actions on `v*` tags (`publish.sh`) |
| Image automation | `superflix` ImageRepository/ImagePolicy in `image-automation/1_repository_policy.yaml` |
| TLS | cert-manager `letsencrypt-prod`, secret `superflix-tls` |
| Data | hostPath `/var/www/superflix/data` (PSX pattern) |
| Admin env | `POCKETBASE_ADMIN_EMAIL` / `POCKETBASE_ADMIN_PASSWORD` in `superflix/resources.yaml` |

Pushing a `v*` tag builds and pushes the image; Flux image automation bumps the
tag in GitOps, and the cluster reconciles within ~1 minute. Rotate the admin
password by editing the env values in `superflix/resources.yaml` (the
PocketBase entrypoint upserts the superuser on restart).

## Licensing

The project code is **MIT** (see [`LICENSE`](./LICENSE)). The repository ships
**one MIT-licensed homebrew ROM** — Gothicvania by Tom D — for end-to-end
testing. It contains **no commercial ROMs and no copyrighted box art**; the
operator supplies their own dumps for the rest of the catalog.

The most permissive license that is possible with the chosen stack:

- **Project code** — MIT.
- **Bundled demo ROM** — MIT (Gothicvania, © 2026 Tom D; see
  [`public/roms/LICENSE`](./public/roms/LICENSE)).
- **Snes9x** — free for **non-commercial** use; not an OSI open-source license.
  The core is fetched at build time and included in the Docker image, so the
  *combined distributed image* is non-commercial. The source code remains MIT.
  If you need a fully copyleft-compatible distribution, swap to **bsnes**
  (GPL-3.0) and license the project accordingly.
- **Nostalgist.js** — MIT.
- **PocketBase** — MIT.
- **libretro-database** — CC-BY-SA-4.0; attribution + share-alike apply.
- **No-Intro** — see their terms.
- **libretro-thumbnails** — no explicit license; images remain copyrighted.
- **Inter** — SIL OFL; **Material Symbols** — Apache 2.0.

If you publish this project, keep `LICENSE`, `ATTRIBUTION.md`, and
`public/roms/LICENSE` intact.
