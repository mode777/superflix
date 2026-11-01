# Design

## Context

Today `AdminView` handles exactly one ROM: `RomDropzone` passes a single `File` to `identifyRom`, and `createCatalogRecord` (`src/admin/lib/importer.ts`) uploads it and *then* calls `enrichGame`, which patches the created record (`src/admin/metadata/enrich.ts`). There is no point between identification and the catalog write where metadata can be reviewed or edited, and progress is only the single XHR upload percent. See proposal.md — Why.

Relevant existing pieces to reuse rather than reinvent: `identifyRom` and the pure SNES library, `buildCatalogDraft`/`toGameFields`/`toRomFields`, `uploadRecord`/`updateRecord` with `UploadProgress`, `precheckImport` (duplicate/variant), the dataset resolution + image pipeline in `src/admin/metadata/` (`resolveDatasetSlug`, `fetchDatasetImages`, `buildArtworkPayload`, `downscaleImage`), `DatasetMatchModal`, and the XHR multipart uploader. PocketBase schema, AdminGate, and the public catalog are untouched.

## Goals / Non-Goals

**Goals:**

- A staged import queue that accepts many files and recursively scanned folders, identifies each entry, and lets the admin review/edit fetched metadata and artwork before any record is written.
- Per-game and total progress during the commit phase, derived from the real multipart uploads.
- Queue/staging logic lives outside the component so it is unit-testable in Node, like the rest of `src/admin/lib`.

**Non-Goals:**

- No PocketBase schema or backend changes; no new runtime dependencies.
- No ZIP/archive extraction; only the existing ROM extensions are picked up.
- No worker-thread identification (main thread stays acceptable because work is sequential); can be added later without spec changes.
- `enrichGame` (post-create enrichment) stays for catalog-tab sync and manual match; this change adds a preview path, it does not remove the sync path.

## Decisions

### 1. Queue state in a plain module + hook (`src/admin/lib/importQueue.ts`)

A framework-free module owns the entry list and status transitions (`pending → identifying → ready | failed`, plus `previewing → ready`, `uploading`, `done/duplicate/variant/error` at commit), exposed to `AdminView` via a small hook (or React state driven by the module's callbacks). *Alternative:* keep it all in `AdminView` `useState` — rejected: the view is already ~600 lines and the queue needs Node tests.

### 2. Folder traversal with two entry points, one pure collector

- **Folder picker**: `<input type="file" webkitdirectory>` — the browser enumerates the tree recursively; `webkitRelativePath` carries the path.
- **Dropped folders**: `DataTransferItem.webkitGetAsEntry()` → recursive `FileSystemDirectoryEntry` traversal. `readEntries()` returns at most 100 entries per call, so the collector must loop until an empty batch; hidden directories (leading `.`) are skipped.
- Both feed one pure collector function (injectable reader interface) that filters to the `RomDropzone` extensions and returns `{ file, path }` entries, so the traversal runs in Node tests against fake entries. `webkitGetAsEntry()` returning null (plain files) falls back to the existing `FileList` path.

### 3. Sequential identification; files held as `File` handles

Entries keep their `File` reference — bytes are only read when a ROM is identified (copier strip + hashes) and later when its upload is built. Nothing pre-reads the whole folder into memory, so scanning hundreds of ROMs costs handles, not buffers. Identification runs one file at a time (hash-wasm is CPU-bound) with per-entry status and a done/total scan counter. *Alternative:* parallel identification with a small pool — rejected: jank and out-of-order progress for little wall-clock gain in an admin flow.

### 4. Enrichment preview: fetch and hold, don't write

New `previewEnrichment()` in `src/admin/metadata/enrich.ts`: resolve the dataset record (checksum-first via the existing `resolveDatasetSlug`, or an explicit slug for manual re-match), map fields with `mapDatasetRecord`, fetch cover + screenshots through the existing dataset-image + libretro-fallback pipeline, downscale — and return everything instead of calling `updateRecord`. The shared resolution/mapping/image core is extracted from the current `applyRecord` so preview and `enrichGame` cannot drift. Result per draft: editable fields (seeded from `buildCatalogDraft`, overwritten by dataset values where present), cover/screenshot blobs, dataset `metadataId`. Manual cover rule carries over: a draft starts with no manual marker; dataset cover fills it first.

### 5. Draft commits in one multipart request

`createCatalogRecord` is extended to take the staged draft (edited fields + held artwork blobs): `uploadRecord('games', fields, { rom, cover_image, screenshots[] }, onProgress)` sends everything at once — the uploader already supports multiple file parts — then creates the `roms` record. Commit checks `precheckImport` per draft at commit time: `duplicate` → report with link, no write; `variant` → `attachVariant`; else create. *Alternative:* create-then-enrich with the existing `enrichGame` — rejected: that is exactly the post-hoc flow being replaced, and fields edited in review would need re-patching.

### 6. Sequential commit loop with two-level progress

Drafts commit one at a time so the single in-flight XHR's `upload.onprogress` maps 1:1 onto the active game's bar. Total progress = `(finishedGames + currentUploadFraction) / totalGames`. Bytes-weighted totals were considered and dropped — ROM sizes vary, but the per-game bar already shows the heavy item; a games-based total is honest and simple. Each item catches its own failure (stays `error` with message, batch continues); auth expiry (`AuthExpiredError`) stops the batch once, matching the existing uploader behavior.

### 7. UI: queue-first identify tab

The identify tab becomes: dropzone (plus "Select folder" button) → scan progress line → stack of draft cards (status chip, artwork preview, editable fields reusing the existing form patterns from `CatalogTab`, per-card "Add to catalog" / re-match / remove) → "Add all ready" button with the total bar; per-card bar during its upload. `DatasetMatchModal` is reused for manual re-match with the chosen slug fed back into `previewEnrichment`. The single-ROM "Play locally" shortcut stays available on a ready card. Styling uses the existing theme tokens.

## Risks / Trade-offs

- [Main-thread identification jank on very large folders] → sequential processing, per-entry status, and done/total keep the UI responsive and honest; a worker is a later, spec-invisible upgrade.
- [Memory growth from artwork blobs held on many ready drafts] → artwork is downscaled catalog-quality (existing caps: 1 cover + ≤5 screenshots) and released when a draft is removed or committed; queue sizes are admin-scale.
- [`webkitdirectory` / `webkitGetAsEntry` are non-standard] → both are implemented in Chromium, Firefox, and Safari; the collector's pure core is tested with fakes so behavior is pinned regardless.
- [`readEntries()` 100-entry batches] → the collector loops until an empty batch; covered by a fake-entry test.
- [Network drop mid-batch] → per-item failures isolate; committed games are CRC-deduplicated, so retrying the batch cannot double-import.
- [Preview/commit drift (preview shows X, commit stores Y)] → both paths share one resolution/image core, and the commit uploads exactly the previewed blobs unless the admin edits fields.

## Migration Plan

Frontend-only: ship behind nothing (admin-only area), no data migration. Rollback is reverting the change; records created by the new flow are identical in shape to today's.

## Open Questions

None — the spec deltas settle observable behavior; remaining choices above are implementation-local.
