# Tasks

## 1. Pure identification helpers

- [x] 1.1 Add `mergeDatEntries`/`enrichIndex` to `src/lib/snes/dat.ts` that merges enrichment `DatEntry.fields` into base entries matched by CRC32 without overwriting No-Intro fields, and verify new unit tests (synthetic DATs, no-overwrite, unknown CRC) pass via `npm test`
- [x] 1.2 Extract slug + region derivation from `AdminView.tsx` into a pure module (`cleanDatName`, slugify with `unknown-{crc32}` fallback, DAT region string → NTSC-U/NTSC-J/PAL) and verify its unit tests (suffix stripping, unicode titles, region mapping) pass via `npm test`
- [x] 1.3 Add a real-DAT test for the enrichment merge following the `dat.real.test.ts` `describe.skipIf` pattern (skips when `public/data/*.dat` are absent) and verify it runs green after `npm run dats:fetch`

## 2. Upload transport

- [x] 2.1 Implement `uploadRecord(collection, fields, files, onProgress)` in `src/admin/lib/upload.ts` using XHR multipart POST to `/api/collections/{collection}/records` with the admin auth header, and verify a unit test asserting the FormData body mapping (fields + file part) and progress callback behavior
- [x] 2.2 Handle auth expiry (401) and PocketBase unique-violation 400s with distinct error types and verify unit tests for both error paths pass

## 3. Import flow

- [x] 3.1 Implement the duplicate pre-check (query `games` by `rom_crc32`, then `slug`) in an importer module under `src/admin/`, returning `create | duplicate(existing) | variant(existing)`, and verify unit tests with a mocked `adminClient` cover all three outcomes
- [x] 3.2 Implement record creation: `games` create with stripped-image `rom` file + identification fields, then primary `roms` record (`is_primary: true`, hashes, size, header, region), reusing 1.2 helpers; verify upload-body unit test asserts fields, filename, and header JSON
- [x] 3.3 Add the "Add to catalog" action with progress bar to the identify screen; on duplicate show "open existing" link, on variant attach as `roms` variant; verify by importing `public/roms/gothicvania.sfc` against a local `npm run pb:serve` instance and reloading `/game/gothicvania` (M1 acceptance)
- [x] 3.4 Load the five enrichment DATs in `AdminView` (parallel fetch, merged per 1.1, degraded when missing) and verify an enriched import populates developer/publisher/genre/release/players while a missing-DAT run still imports

## 4. Admin catalog management

- [x] 4.1 Add the Catalog tab to `/admin`: paginated `games` list (title, region, CRC32, size) and verify it renders imported records from the local PocketBase instance
- [x] 4.2 Add metadata editing (title, description, region, genre, developer, publisher, release, players) that invalidates the games react-query cache on save, and verify an edited title is reflected on the public details page
- [x] 4.3 Add "Replace ROM" (re-upload via `uploadRecord`, update hashes/size) and "Delete game" (cascade removes `roms`), and verify locally that a replaced game plays the new file and a deleted game disappears from browse

## 5. Guards and integration

- [x] 5.1 Add a test that the admin area renders the sign-in screen (no import/catalog capability) when unauthenticated, and that import calls are only issued through `adminClient`
- [x] 5.2 Run the full gate: `npm run typecheck && npm run lint && npm test` green; manual pass of the M1 acceptance flow (drop `gothicvania.sfc` → add to catalog → reload → play from `/game/gothicvania`)
