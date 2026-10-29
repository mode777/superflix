# Design

## Context

The import pipeline (`src/admin/lib/importer.ts`) creates `games`/`roms` records with `description: ''` and then calls `applyArtwork`, whose libretro-thumbnails fetches fail silently in the browser (`thumbnails.libretro.com` sends no CORS headers; `artwork.ts` swallows the rejection). The admin editor's "Refresh artwork" hits the same path. The `snes-dataset` static API (CC0 metadata; `by-crc.json`, `index.json`, per-slug `data.json`, `thumb.png`/`box.jpeg`/`snap.png`) is CORS-open, keyless, and resolves games by No-Intro headerless CRC32 — the same identity the importer already computes and stores in `games.rom_crc32`. Measured coverage against the local No-Intro DAT: 81% exact CRC, 92% with title-index fallback; matched records carry ~91% description, ~98% screenshot, ~68% box art.

See proposal.md for motivation and specs/metadata-enrichment/spec.md for the behavior contract.

## Goals / Non-Goals

**Goals:**

- One enrichment path used by both call sites (import and editor sync), dataset-first with libretro as complementary artwork source.
- Exact resolution first (CRC32); title matching only as fallback, so no fuzzy data is written on hash hits.
- Honest reporting of what was enriched, fixing the silent-failure pattern.
- No schema changes; keep `src/lib/snes` untouched; stay admin-side (enrichment runs in the authenticated admin browser).

**Non-Goals:**

- No schema fields for tags, scores (`gf_score`/`metascore`), or languages — the dataset has them but `games` has no columns; mapping them is deferred until the schema wants them.
- No bulk backfill script — the editor sync action covers existing records one at a time.
- No vendoring/mirroring of the dataset into the repo (`public/data/`) — runtime fetch only.
- No changes to the public catalog/player behavior for games the dataset does not cover.

## Decisions

### D1: Pure dataset module + admin provider, mirroring the thumbnails pattern

`src/lib/snes-dataset.ts` (pure, Node-testable, outside `src/lib/snes`): `datasetBaseUrl`, `datasetSlugFromTitle()` (accent-fold, lowercase, non-alnum → dash, article fix `", The"` → `"The …"`), `normalizeNoIntroName()` (strip `(...)`/`[...]` tags, collapse whitespace), `regionToDateKeys(region)` (NTSC-U → `north_america`/`usa`, NTSC-J → `japan`, PAL → `pal`/`europe`), `mapDatasetRecord(record, region)` → catalog field values. `src/admin/metadata/dataset.ts`: `fetch`-injected functions `resolveDatasetSlug(crc32, fallbackName)`, `fetchDatasetRecord(slug)`, `fetchDatasetImages(record)` — mirroring how `src/lib/thumbnails.ts` + `src/admin/metadata/provider.ts` split today. Alternative considered: one admin-side module — rejected; the slug/normalization rules are the fiddly part and must be unit-testable without a DOM.

### D2: Resolution is CRC32-first with a one-step title fallback

Uppercase the stored headerless CRC32 and look it up in `by-crc.json`; only on a miss, normalize the No-Intro name (or clean title) and look it up in `index.json`. Both indexes (~100 KB + ~190 KB) are fetched once and cached in-module for the session. On a title hit the resolved slug is written to `metadata_id`, so later syncs skip matching entirely. No guessing beyond these two lookups (spec: *Checksum-first game resolution*).

### D3: One enrichment entry point, dataset-first, libretro complementary

`enrichGame(record, options)` in `src/admin/metadata/enrich.ts` returns a result object `{ resolved, metadata, cover, screenshots, provenance }` and:

1. resolves the slug (D2) and applies `mapDatasetRecord` metadata fields;
2. downloads `thumb.png`/`box.jpeg` → `downscaleImage` → `cover_image`, `snap.png` → first screenshot;
3. calls the existing libretro artwork path for anything still missing — extra screenshots via `Named_Titles`, and cover only when the dataset had none;
4. writes fields + provenance via the existing `uploadRecord`/`updateRecord` helpers.

`createCatalogRecord` replaces its `applyArtwork` call with `enrichGame`; the editor's "Refresh artwork" becomes "Sync from dataset" backed by the same function. Alternatives: keep two independent actions (rejected — two buttons for one job, and the libretro-only one is the broken path); server-side hook (rejected — PocketBase JSVM can't reuse the canvas downscale pipeline and the admin browser already does this work fine).

### D4: Sync overwrites metadata fields by design

The sync action is an explicit admin act, so dataset values overwrite description/genre/developer/publisher/release/players. There is no `description_source` field to distinguish a hand-written description, and adding schema fields is out of scope; the risk is limited to the admin editor where the change is visible before saving. Cover protection is unchanged: `metadata_source === 'manual'` sets `skipCover`, exactly as today (spec: *Manual cover override is preserved*).

### D5: Point the libretro base URL at a CORS-open mirror

Swap `LIBRETRO_THUMBNAIL_BASE` to the jsDelivr mirror (`cdn.jsdelivr.net/gh/libretro-thumbnails/…@master`), verified to return the same files with `access-control-allow-origin: *` (raw.githubusercontent.com is the backup mirror; both already verified). This is a one-constant change plus test updates, and it is what makes the fallback path in D3 actually work in a browser.

### D6: Provenance and toasts come from the enrichment result object

`metadata_source = 'snes-dataset'`, `metadata_id = slug`, `scraped_at = now` on any successful write. The importer toast becomes e.g. "Added X — metadata + cover + 1 screenshot from snes-dataset" / "Added X (dataset not found)" / "Added X (enrichment unavailable)", and the sync action reports the same shape. No silent catches: every failure path resolves to a reported outcome (spec: *Enrichment never blocks catalog writes*).

## Risks / Trade-offs

- [GitHub Pages (dataset host) unreachable or repo renamed] → enrichment degrades to identification-only with a reported outcome; no record corruption. The base URL is a single constant, so a mirror/vendor switch is trivial later.
- [Single-maintainer dataset (the user's own repo) changes schema] → field mapping is centralized in `mapDatasetRecord` with lenient parsing; provenance records the source so affected records are identifiable.
- [Title fallback writes a wrong match (e.g. remake vs original)] → fallback runs only after a CRC miss, normalizes the exact No-Intro name, and the numeric/revision tags in No-Intro names keep sequels apart; same risk profile as the dataset's own merge, measured at 92–98% two-tier coverage with correct absences for protos/pirates.
- [Dataset images are publisher-copyrighted] → same stance as today's libretro art: stored in PocketBase for identification, attribution panel credits dataset and upstreams, nothing committed to the repo.
- [jsDelivr rate/abuse limits on the libretro mirror] → only fallback artwork and screenshots traverse it, per-game on admin action; if it becomes a problem, `raw.githubusercontent.com` is a verified drop-in.

## Migration Plan

Frontend-only; deploys with the normal build. New imports enrich automatically; existing records are enriched via "Sync from dataset" per game. Rollback = revert; previously written fields/provenance remain valid data.

## Open Questions

- Whether the dataset should later add `Named_Titles` screenshots (second screenshot) and fold current-DAT hashes into `by-crc.json` to lift CRC coverage from ~87% to ~100% for licensed regions — both are upstream dataset improvements that require no Superflix-side change beyond re-running sync.
