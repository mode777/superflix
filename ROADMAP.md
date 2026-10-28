# Superflix roadmap

Status: **v0.1 — scaffold complete** (2026-10-28)

Guiding principle: SNES ROMs are small (256 KB–8 MB), so the player loads the
whole file. There is no CHD streaming, BIOS, memory-card, or SharedArrayBuffer
layer. Keep the emulator boundary (`EmulatorService`) and the pure
identification library (`src/lib/snes`) stable while the product grows.

## M0 — Foundation ✅

- [x] React + Vite + Tailwind 4 + PocketBase scaffold
- [x] SNES internal-header parser, copier-header stripping, CRC32/MD5/SHA1
- [x] No-Intro DAT parser + matcher (real 3,730-entry SNES DAT)
- [x] “Identify a ROM → play locally” admin flow
- [x] Nostalgist + Snes9x player (save states, SRAM export/import, CRT overlay)
- [x] PocketBase schema + generated migration
- [x] MIT license, bundled MIT-licensed demo ROM, attribution
- [x] GitOps deployment on `snes.alexklingenbeck.de`
- [x] CI + Harbor release workflow

## M1 — Persistence & importer (v0.2)

Goal: a ROM imported in the admin UI becomes a real catalog record.

- [ ] Superuser login for the admin area (PocketBase superuser token; no
      public sign-up for the importer)
- [ ] “Add to catalog” action on the identify screen
- [ ] ROM upload with real progress (XHR/multipart)
- [ ] Duplicate detection by CRC32 and slug; offer “open existing” instead of
      creating a second record
- [ ] Create `games` + primary `roms` records from the identification result
- [ ] Fill `rom_header`, `rom_size`, hashes, region, and title
- [ ] Enrich from the libretro `developer` / `publisher` / `genre` /
      `releaseyear` / `maxusers` DATs (already downloaded)
- [ ] Admin catalog list: edit metadata, replace ROM, delete
- [ ] Tests: upload body mapping, duplicate handling, admin auth guard

**Acceptance:** drop `gothicvania.sfc`, approve, reload the page, and play it
from `/game/gothicvania` with metadata persisted in PocketBase.

## M2 — Metadata & artwork (v0.3)

Goal: imported games look like a streaming catalog without any API keys.

- [ ] Match `libretro-thumbnails` by exact No-Intro name
- [ ] Download boxart (`Named_Boxarts`), in-game snap (`Named_Snaps`), and
      title screen (`Named_Titles`) during import
- [ ] Store images in PocketBase; never hotlink at browse time
- [ ] Cap screenshots (e.g. 5) and generate thumbnails
- [ ] Manual override in the admin editor (title, description, cover)
- [ ] Record `metadata_source`, `metadata_id`, `scraped_at`
- [ ] Attribution panel / docs for libretro-database (CC-BY-SA-4.0) and
      thumbnail copyright
- [ ] Optional provider adapter interface for ScreenScraper/IGDB later
- [ ] Tests: name matching, image failure degradation, provenance fields

**Acceptance:** an imported ROM gets boxart + at least one screenshot with no
manual upload; failures degrade to the gradient placeholder.

## M3 — Accounts & cloud saves (v0.4)

Goal: a user can sign in, favorite games, and continue on another device.

- [ ] Sign-up / sign-in / sign-out UI (PocketBase auth)
- [ ] Favorites button + “My favorites” row
- [ ] Save-state sync: `save_state` per `(type, game, user)`
- [ ] SRAM sync: `sram` per `(user, game)` (no memory-card slots)
- [ ] Local-first IndexedDB cache with cloud cache-on-miss
- [ ] Last-write-wins conflict handling with `updated` timestamps
- [ ] Sync status chip (idle / syncing / synced / error)
- [ ] Save on page hide and on route change; never save a never-started session
- [ ] Tests: conflict resolution, auth gating, sync retry

**Acceptance:** save in browser A, sign in on browser B, load the same slot and
battery save.

## Cross-cutting

- [ ] Playwright e2e: browse → details → play demo ROM → save/load
- [ ] Accessibility pass (focus rings, dialog focus trap, reduced motion)
- [ ] Performance: subset the Material Symbols font (currently ~4 MB) or move
      to tree-shaken SVG icons
- [ ] User docs: hosting, importing, metadata, controller setup
- [ ] Landing page / screenshots
- [ ] Optional: GitHub Actions release on `v*` tags (already scaffolded)
- [ ] Optional: second core (bsnes) behind the same `EmulatorService`

## Decisions locked in

| Decision | Choice |
|---|---|
| Name | Superflix |
| Core | Snes9x (libretro) via Nostalgist |
| Metadata | Free/offline only: No-Intro + libretro DATs + libretro-thumbnails |
| Auth | Admin/importer superuser only; player is public |
| Deployment | Flux GitOps, PocketBase image on Harbor, host `snes.alexklingenbeck.de` |
| Palette | Super Famicom / European SNES grey + red/yellow/green/blue |
| License | MIT for project code; Snes9x core remains non-commercial |
