# Tasks

## 1. Pure dataset module and libretro mirror

- [x] 1.1 Create `src/lib/snes-dataset.ts` with `datasetBaseUrl`, `datasetSlugFromTitle()` (accent-fold, lowercase, non-alnum → dash, `", The"` → `"The …"` article fix) and `normalizeNoIntroName()` (strip `(...)`/`[...]` tags), with unit tests over plain, punctuated (`&`, `,`), diacritic, article-inverted, and revision-tagged No-Intro names; verify with `npm test`
- [x] 1.2 Add `regionToDateKeys()` (NTSC-U → `north_america`/`usa`, NTSC-J → `japan`, PAL → `pal`/`europe`) and `mapDatasetRecord()` (description, genre, developer/publisher first entry, players, region-aware release date; missing dataset fields map to empty), with unit tests covering full, partial, and empty records; verify with `npm test`
- [x] 1.3 Point `LIBRETRO_THUMBNAIL_BASE` in `src/lib/thumbnails.ts` at the jsDelivr mirror and update `thumbnails.test.ts` expectations; verify `npm test` passes with the new URLs

## 2. Admin-side dataset provider and enrichment

- [x] 2.1 Create `src/admin/metadata/dataset.ts` with `resolveDatasetSlug(crc32, fallbackName)` (uppercase headerless CRC32 → `by-crc.json`, else normalized title → `index.json`, indexes cached per session, `fetch` injected) plus `fetchDatasetRecord(slug)` and `fetchDatasetImages(record)`; verify mocked `fetch` unit tests cover checksum hit, title fallback, full miss, and network failure
- [x] 2.2 Create `src/admin/metadata/enrich.ts` with `enrichGame()` that applies dataset metadata, downloads/downscales `thumb`/`box` → cover and `snap` → screenshot via the existing `image.ts` pipeline, fills gaps from the libretro provider, and returns a `{ resolved, metadata, cover, screenshots }` result; verify mocked tests cover full, metadata-only, artwork-fallback, not-found, and unreachable paths, and that a manual cover (`metadata_source: 'manual'`) is never replaced
- [x] 2.3 Record provenance (`metadata_source: 'snes-dataset'`, `metadata_id: slug`, `scraped_at`) on every enrichment write and verify via unit tests on the update payloads

## 3. Import and catalog-editor integration

- [x] 3.1 Replace the `applyArtwork` call in `createCatalogRecord` with `enrichGame` and render the result in the import toast ("metadata + cover + N screenshots" / "dataset not found" / "enrichment unavailable"); verify the importer unit/integration paths still pass (`PB_INTEGRATION=1` run against local PocketBase where feasible) and the miss path adds no failure
- [x] 3.2 In `CatalogTab.tsx`, replace the "Refresh artwork" action with "Sync from dataset" that resolves the stored record by `rom_crc32` (preferring an existing `metadata_id` slug) and calls `enrichGame`, showing the same result toast and refreshing the list on success; verify via the existing component-test patterns and a manual editor pass
- [x] 3.3 Verify the sync action on a record with a manual cover updates metadata/screenshots while keeping the manual cover, and that a not-found sync leaves the record untouched with an informational toast

## 4. Attribution and docs

- [x] 4.1 Add snes-dataset (and its upstreams: Kaggle CC0 metadata/box art, OpenVGDB, opengamedb, Wikipedia-derived dates, libretro `Named_Snaps`) to `AttributionPanel`, `ATTRIBUTION.md`, and `docs/metadata.md`, noting images remain publisher-copyrighted; verify the panel test still passes and the files list the sources

## 5. Gates and acceptance

- [x] 5.1 Run `npm run typecheck && npm run lint && npm test` and fix anything the new modules broke
- [x] 5.2 Manual acceptance against a running instance: importing a ROM with a dataset match yields description + cover + screenshot with no manual upload; "Sync from dataset" updates an existing imported record; a ROM with no dataset match imports metadata-only with placeholders and an honest toast

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
