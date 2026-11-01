# Proposal

## Why

The importer accepts exactly one ROM at a time and enriches each record only *after* it is committed, so building up a SNES library means repeating a manual drop → identify → add cycle for every cartridge, with no chance to review or correct metadata before it goes live. Importing many games in one sitting needs a batch flow with per-game review and visible progress while uploads run.

## What Changes

- **Multi-file selection** — the ROM dropzone accepts any number of files at once (dragging several ROMs or multi-select in the file picker); selecting a single ROM behaves as a batch of one.
- **Folder import** — the admin can open a folder; its subfolders are scanned recursively for ROM files (`.sfc`, `.smc`, `.fig`, `.swc`, `.bin`). Non-ROM files are ignored, and the scan reports how many games were found.
- **Staged import queue** — every picked/scanned ROM becomes a queued entry that is identified in the browser (copier-header strip, CRC32/MD5/SHA1, internal header, DAT match) one file at a time, with scan progress and per-entry status (pending / identifying / ready / failed).
- **Metadata review before commit** — for each ready entry, metadata (title, region, genre, developer, publisher, release, players, description) plus boxart cover and screenshots are fetched from the dataset and shown as an editable draft; the admin can edit fields, manually re-match the dataset entry, or drop the entry before anything is written.
- **Commit to catalog** — each draft has an "Add to catalog" action, and a batch action adds all ready drafts. Existing duplicate/variant rules (same CRC32 → duplicate, same slug → variant) apply per entry at commit; one entry failing does not abort the rest, and a summary reports what was added.
- **Upload progress** — during commit, the UI shows a progress bar per game (its ROM + image upload) and a total progress bar across the batch.

Assumptions (recorded, not blocking):

- The existing single-ROM screen becomes this queue-based flow; there is no separate "batch mode" toggle.
- ZIP archives are not extracted; only the existing ROM extensions are picked up.
- The catalog storage model (whole-file ROMs, `games`/`roms` collections) is unchanged.

## Capabilities

### New Capabilities

<!-- none: batch staging and review are import-flow behavior owned by catalog-importer -->

### Modified Capabilities

- `catalog-importer`: adds multi-file and recursive-folder staging, a staged import queue with identification and metadata review/editing before commit, batch commit with per-entry duplicate/variant handling, and per-game plus total upload progress (extending the single-ROM "Add to catalog action" and "Upload with progress" requirements).
- `metadata-enrichment`: enrichment moves ahead of the catalog write — dataset metadata, boxart, and screenshots are fetched into the staged draft before commit, reviewed values take precedence over dataset values, and images are stored when the draft is committed.

## Impact

- `src/admin/RomDropzone.tsx` — multi-file + folder/directory picking and recursive folder traversal of dropped items.
- `src/routes/AdminView.tsx` — staged queue UI: scan/identification progress, editable draft cards with artwork preview, per-game and total commit progress.
- `src/admin/lib/importer.ts` — staged-draft creation from identification, preview-based record creation (fields + ROM + cover + screenshots in one upload), batch commit loop.
- `src/admin/metadata/enrich.ts` — a preview path that resolves the dataset record and downloads images without writing any record, alongside the existing post-create `enrichGame` (still used by catalog sync).
- New modules for the queue/scan state (e.g. `src/admin/lib/importQueue.ts`) with unit tests; existing importer/enrich/AdminView tests updated.
- No PocketBase schema changes, no new runtime dependencies; the admin area stays behind AdminGate.
