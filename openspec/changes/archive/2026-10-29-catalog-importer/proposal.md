# Proposal

## Why

The admin area can identify a ROM (No-Intro DAT match, internal header parse, CRC32/MD5/SHA1) and play it locally, but nothing persists: there is no write path to PocketBase at all. In production the catalog therefore stays empty and browse/details fall back to mock data. Roadmap M1 (v0.2) asks for exactly this: a ROM imported in the admin UI becomes a real catalog record.

## What Changes

- Add an **"Add to catalog"** action to the admin identify screen (`AdminView`) next to the existing "Play locally" flow.
- Upload the ROM file to PocketBase as `games` + primary `roms` records using multipart requests with real progress (XHR upload events), driven by the existing dedicated admin client.
- **Duplicate detection** before create: query `games` by `rom_crc32` and `slug` (both have unique indexes) and offer "open existing" instead of creating a second record.
- Populate record fields from the identification result: cleaned title, slug, region, `rom_crc32`/`rom_md5`/`rom_sha1`, `rom_size`, `rom_header` (parsed header JSON), and metadata from the already-downloaded libretro enrichment DATs (`developer`, `publisher`, `genre`, `releaseyear`, `maxusers`).
- Load and merge the five enrichment DATs into the runtime DAT index — today only `no-intro-snes.dat` is fetched; the enrichment DATs sit unused in `public/data/`. The merge is a new pure function in `src/lib/snes`.
- Add an **admin catalog list** under `/admin`: paginated `games` list with edit metadata, replace ROM, and delete (cascades to `roms`).
- Tests: upload body mapping, duplicate handling, admin auth guard (unauthenticated users never reach write calls).

Note: the M1 line item "Superuser login for the admin area" is already satisfied (`AdminGate`, `SignInView`, `adminClient` on `_superusers`) and needs no work. No breaking changes; the public catalog and player keep working unchanged.

## Capabilities

### New Capabilities
- `catalog-importer`: Persisting admin-identified ROMs as PocketBase catalog records — add-to-catalog flow, upload with progress, duplicate handling, field population from identification + enrichment DATs, and admin catalog management (edit / replace ROM / delete).

### Modified Capabilities

(none — `openspec/specs/` is empty; there are no existing capability specs to modify)

## Impact

- `src/routes/AdminView.tsx` and `src/admin/` — new import action, catalog list/editor components, upload progress UI.
- `src/lib/snes/dat.ts` (+ tests) — new pure merge of enrichment DAT entries into the `DatIndex`; `src/lib/snes` stays framework-free.
- `src/features/games/` — admin-side mutation helpers on top of `adminClient`; `mapGameRecord`/`useGames` unchanged for the public side.
- No schema changes: `games`/`roms` already carry every required field and the unique indexes.
- New tests alongside `src/lib/snes` and `src/admin`.
