# Tasks

## 1. File and folder intake

- [x] 1.1 Create the pure intake collector (e.g. `src/admin/lib/romIntake.ts`) that filters a list of `{ file, path }` candidates to ROM extensions and skips hidden directories, with the folder-entry reader injected so it runs in Node — verify with unit tests covering extension filtering, hidden-dir skipping, and `readEntries()` 100-entry batch looping using fake entries
- [x] 1.2 Extend `RomDropzone` to accept multiple files (multi-select + multi-file drops, one `onFiles` callback) and add a "Select folder" picker (`webkitdirectory`) that feeds the collector — verify via updated `RomDropzone.test.tsx` that several files and a folder picker selection both emit every ROM file and no non-ROM file
- [x] 1.3 Add recursive folder-drop traversal (`webkitGetAsEntry` → directory reader loop, falling back to plain `FileList` entries when `getAsEntry` returns null) feeding the same collector — verify with a component test using a stubbed `DataTransfer` and with the collector's fake-entry tests from 1.1

## 2. Staged import queue

- [x] 2.1 Create `src/admin/lib/importQueue.ts` owning entries and status transitions (`pending → identifying → ready | failed`, plus commit-phase states) with enqueue/remove and no React imports — verify with unit tests that enqueue of N files yields N `pending` entries and remove drops the right entry
- [x] 2.2 Implement the sequential identification loop (copier strip, hashes, header, DAT match via the existing `identifyRom`, one file at a time) with per-entry status and done/total scan progress — verify with unit tests using the bundled `public/roms/gothicvania.sfc` (CRC `B19ED489` smoke test) that entries reach `ready` with correct hashes and that a corrupt entry ends `failed` without stopping the rest
- [x] 2.3 Expose the queue to React via a hook consumed by `AdminView` (state updates on transitions) — verify with a component test that picking several files renders one card per entry and the scan counter

## 3. Enrichment preview before commit

- [x] 3.1 Extract the dataset resolution/mapping/image core from `enrich.ts`'s `applyRecord` into a shared helper (no behavior change to `enrichGame`) — verify `npm test` passes with the existing `enrich.test.ts` / `enrich.integration.test.ts` suites unchanged
- [x] 3.2 Add `previewEnrichment()` returning mapped fields, downscaled cover and screenshot blobs, and the dataset `metadataId` without writing any record; honor an explicit slug for manual re-match and resolve checksum-first otherwise — verify with fetch-stubbed unit tests (existing `dataset.test.ts` patterns) that no `updateRecord` is called and that resolution order (checksum → title → explicit slug) matches the spec deltas
- [x] 3.3 Wire preview into queue entries (`previewing → ready`) with failure isolation: a failed preview leaves the draft committable with identification-only values and a visible "metadata could not be fetched" state — verify with a unit test stubbing a rejected fetch

## 4. Draft commit and progress

- [x] 4.1 Extend `src/admin/lib/importer.ts` with a draft commit that uploads edited fields + ROM + held artwork blobs in one multipart `uploadRecord` (cover_image, screenshots[]) and then creates the `roms` record — verify with unit tests asserting the multipart parts and that edited field values (not dataset values) are sent
- [x] 4.2 Apply per-draft `precheckImport` at commit: duplicate → report with existing-game link and no write, slug-collision → `attachVariant`, else create; the same-CRC32-within-batch case resolves as duplicate — verify with unit tests mocking `precheckImport`/`uploadRecord` for each disposition
- [x] 4.3 Implement the sequential batch commit loop: per-game `onProgress` events (XHR upload percent), total progress as (finished + current fraction) / total, per-item error isolation, batch stop on `AuthExpiredError` only — verify with a unit test driving a fake uploader that per-game and total callbacks fire in order and one failing item doesn't abort the rest

## 5. Importer UI

- [x] 5.1 Rebuild the identify tab around the queue: scan progress line, "Add all ready" action, and per-card status chips (pending/identifying/ready/failed/error) styled with the existing theme tokens — verify with updated `AdminView.test.tsx` smoke coverage of the new states
- [x] 5.2 Build the draft card: artwork preview (cover + screenshots from held blobs), editable metadata fields reusing `CatalogTab`'s form patterns, remove action, and per-card "Add to catalog" — verify with a component test that editing a field and committing sends the edited value and that remove drops the entry with no record created
- [x] 5.3 Add per-card upload progress bar and the total batch progress bar, and reuse `DatasetMatchModal` for manual re-match feeding the chosen slug back into `previewEnrichment` — verify with component tests that a progress callback updates the active card's bar and the total bar, and that a re-match triggers a preview with the selected slug
- [x] 5.4 Keep the single-ROM "Play locally" shortcut on ready cards and route it through the existing local game/ROM stores — verify via the updated `AdminView.test.tsx` that the shortcut still navigates to `/play/<slug>`

## 6. Green-light verification

- [x] 6.1 Run `npm run typecheck`, `npm run lint`, and `npm test` and fix any fallout from the flow change — verify all three exit clean
- [ ] 6.2 Manually exercise `npm run dev` + `npm run pb:serve` with `public/roms/gothicvania.sfc`: single add, multi-file add, folder-scan add, duplicate re-add (duplicate path), and a second region file (variant path), confirming per-game and total progress bars and the dataset preview/edit step — verify each flow against the spec scenarios

## 7. Follow-up fixes (post-release feedback)

- [x] 7.1 Flag catalog duplicates during the staging scan via an injectable CRC32 lookup, exclude them from the ready set and batch count, and mark repeated CRCs within one batch as duplicates of the first entry — verify with queue unit tests (catalog hit, in-batch hit, lookup failure tolerated, preview skipped for duplicates)
- [x] 7.2 Render scan-time duplicates in the draft cards (existing-game link, in-batch explanation) without the add action — verify with component tests that a known ROM shows as a duplicate and is not counted in "Add N ready games"
- [x] 7.3 Regenerate the Material Symbols subset for every icon in use and gate the release workflow on `npm run icons:check` — verify the check exits clean and the `library_add` glyph is in the committed manifest
