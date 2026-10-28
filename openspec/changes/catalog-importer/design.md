# Design

## Context

See proposal.md — Why. Today `AdminView` identifies a ROM entirely client-side (`identifyRom` from `src/lib/snes`) and only supports "Play locally" (memory stores) and "Copy JSON". There is no PocketBase write path anywhere in the app. The schema (`scripts/generate-schema.mjs`, already deployed via `pb_migrations/0001_initial.js`) already defines `games` (unique `slug` and `rom_crc32`, 16 MB `rom` file field, `rom_header` JSON, all metadata fields) and `roms` (unique `crc32`, unique `(game, region, revision)`, `is_primary`). The admin client (`src/admin/lib/pb.ts`, `adminClient` + `LocalAuthStore('superflix_admin_auth')`) exists and works. The PocketBase JS SDK (`pocketbase ^0.28.1`) is fetch-based and provides no upload progress events.

The five libretro enrichment DATs (`developer-`, `publisher-`, `genre-`, `releaseyear-`, `maxusers-snes.dat`) are downloaded into `public/data/` by `npm run dats:fetch` but never fetched or parsed at runtime. `dat.ts` already preserves every scalar `game`-block field on `DatEntry.fields`, so `fields.developer` etc. parse today — only loading/merging is missing.

## Goals / Non-Goals

**Goals:**

- Persist identified ROMs as `games` + primary `roms` records using `adminClient`, with real upload progress.
- Detect duplicates by CRC32 (and slug) before writing; never create a second record for the same image.
- Surface libretro enrichment metadata on imported records by merging the enrichment DATs into the runtime `DatIndex`.
- Give the admin a catalog list with edit / replace-ROM / delete.
- Keep `src/lib/snes` pure and framework-free; keep all admin writes behind `AdminGate` on the dedicated client.

**Non-Goals:**

- Artwork/metadata scraping (M2 — `metadata-artwork` change).
- Public user accounts, favorites, cloud saves (M3 — `accounts-cloud-saves` change).
- Schema changes of any kind (the current schema already supports everything here).
- Multi-file/batch import UI; the dropzone accepts one ROM at a time, same as today.

## Decisions

### D1: XHR-based multipart upload helper for record creation with a file

`XMLHttpRequest` is the only browser API that reports upload progress. Add `uploadRecord(collection, fields, files, onProgress)` in `src/admin/lib/upload.ts`: it builds a `FormData` (text fields + file parts), POSTs to `/api/collections/{collection}/records` with the admin auth header from `adminClient`, and reports `progress` from `xhr.upload.onprogress`. Everything else (updates without files, deletes, duplicate queries) uses `adminClient` normally.

Alternative considered: `adminClient.collection(...).create(formData)` — one call, but fetch-based, so no progress; rejected because progress is an explicit roadmap requirement. A custom `sendFunction` on the SDK still can't surface upload events cleanly.

### D2: Import sequence — duplicate check, then `games` + `roms` in two writes

1. `identifyRom` (unchanged) produces the identification result.
2. Duplicate check: `getList` on `games` filtered by `rom_crc32 = {crc32}`, then by `slug = {slug}`. CRC32 hit → stop, show "open existing" link (spec: *Duplicate ROM by checksum*). Slug hit with different CRC → write only a `roms` variant record (`is_primary: false`, region/revision derived) onto the existing game (spec: *Same title as a ROM variant*).
3. Otherwise create `games` via D1 with text fields + `rom` file part (single multipart create; PocketBase accepts files and fields together).
4. Create the primary `roms` record (`game` relation, `is_primary: true`, hashes, size, header JSON, region select).

The stored file is the **stripped image**: the importer calls `stripCopierHeader` (already exported, pure) itself to get the upload `Blob`, so record hashes match stored bytes (spec: *Stored ROM is the headerless image*). `identifyRom`'s return type is unchanged.

Alternative considered: returning stripped bytes from `identifyRom` — rejected; it would grow every identification result for one consumer, and the pure function is already available.

### D3: Enrichment merge as a pure function in `src/lib/snes`

Add `mergeDatEntries(entries: DatEntry[], enrichment: DatEntry[]): DatEntry[]` (or an index-level `enrichIndex(index, entries)`) that matches entries by CRC32 and merges `fields` without overwriting existing No-Intro fields. `AdminView`'s DAT react-query gains the five enrichment files (parallel `loadDatFromUrl`, `staleTime: Infinity`, `retry: false`); failures degrade to No-Intro-only data (spec: *Enrichment absent*). Unit tests use synthetic DATs; a real-DAT test follows the `dat.real.test.ts` `describe.skipIf` pattern.

Alternative considered: merging DATs at fetch time in `scripts/fetch-dats.mjs` and shipping one combined file — rejected: the script would need a clrmamepro writer and the DATs are build-time artifacts anyway; runtime merge keeps `src/lib/snes` the single owner of DAT semantics.

### D4: Slug and region derivation shared, not duplicated in AdminView

`cleanDatName` currently lives inside `AdminView.tsx`. Move slug derivation (`slugify(cleanDatName) `, fallback `unknown-{crc32-lowercase}`, ASCII-safe) and DAT-region-string → `NTSC-U | NTSC-J | PAL` mapping into a small pure module (e.g. `src/lib/snes/slug.ts` or `src/features/games/slug.ts`) with unit tests, and have `toGame` and the importer both use it. Keeps the local-play flow and the importer from drifting apart.

### D5: Admin catalog list as a second admin tab

`AdminView` gains a tab switch (Identify / Catalog) — no new route, the area is already behind `AdminGate`. The Catalog tab lists `games` (paginated `getList`, sorted by title) with an editor form bound to schema fields, a "Replace ROM" action that reuses the D1 upload path to update `games.rom` + hash/size fields, and delete via `adminClient.collection('games').delete(id)` (the `roms.game` relation has `cascade` delete in the schema). Invalidate the `['games', dataSource]` react-query cache after mutations so the public catalog updates.

Alternative considered: a separate `/admin/catalog` route — deferred; a tab keeps AdminGate/auth wiring in one place and the catalog is a small surface.

## Risks / Trade-offs

- [PocketBase 16 MB file cap vs 8 MB max ROMs] → comfortably inside the limit; the upload helper surfaces server 400s verbatim if a future file exceeds it.
- [Unique-index race: two admins import the same ROM simultaneously] → the pre-check can miss; PocketBase rejects the second create with a 400 on `UNIQUE(slug)`/`UNIQUE(rom_crc32)` → the importer treats a unique-violation 400 as the duplicate path (offer "open existing") instead of showing a generic error.
- [Admin token expires mid-upload] → XHR returns 401 → show a "session expired, sign in again" error rather than retrying automatically; superuser sessions are long-lived.
- [Enrichment DATs missing in a dev checkout] → degrade silently to No-Intro-only matching (same pattern as the existing `DatStatus` banner).

## Migration Plan

No schema or backend changes; deploy is a frontend build. Rollback = revert the commit. Records created by the importer are plain `games`/`roms` rows and remain valid regardless.

## Open Questions

- None material. Revision derivation for variant ROMs uses the internal header's version field (revision `1.x` → integer `x`), which can be refined later without touching the specs.
