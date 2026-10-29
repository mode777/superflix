# Proposal

## Why

Imported games still have `description: ''`, and the only artwork source (libretro-thumbnails) silently fails in the browser because its host sends no CORS headers — so new imports get no description, no cover, and no screenshots unless the admin fills everything by hand. The `snes-dataset` static API (https://mode777.github.io/snes-dataset/, CC0 metadata, 3,070 SNES games) now provides exactly the missing pieces — description, box art, screenshots, per-region dates — with open CORS and exact CRC32 ROM identity, so imports and existing records can be enriched automatically for the first time.

## What Changes

- Add a **snes-dataset enrichment provider** that resolves a game by CRC32 against `by-crc.json` (exact, no fuzzy matching), falls back to the title index (`index.json` + No-Intro name normalization) when the hash is unknown, and maps `data.json` onto catalog fields.
- **At import**: after a record is created, enrich it automatically — description, genre, developer, publisher, release date (region-aware), players — and download `thumb.png`/`box.jpeg` as `cover_image` and `snap.png` as a screenshot. libretro-thumbnails (via its CORS-open mirrors) remains the complementary source for screenshots and cover fallback, keeping the existing `ArtworkProvider` seam.
- **For existing catalog entries**: the admin catalog editor gains a **"Sync from dataset"** action that re-runs the same enrichment against an already-stored record (resolved by stored `rom_crc32`), updating metadata fields and images on demand.
- Record provenance (`metadata_source = 'snes-dataset'`, `metadata_id = <slug>`, `scraped_at`); a manually uploaded cover is never overwritten by a sync, per the existing `manual` rule.
- Surface enrichment results honestly: the import toast and the sync action report what was found (metadata / cover / screenshot) instead of failing silently.
- Add snes-dataset (and its upstreams) to the attribution panel and docs.

No schema changes: provenance and image fields already exist. No changes to public behavior for games the dataset does not cover — they keep today's metadata-only import with gradient placeholders.

## Capabilities

### New Capabilities

- `metadata-enrichment`: Enriching catalog game records with external metadata and artwork — hash-first resolution against a static dataset API, field and image mapping, import-time enrichment, admin-triggered sync for existing records, provenance recording, and graceful degradation when a game is not covered.

### Modified Capabilities

(none — `openspec/specs/` is empty; no merged capability specs exist yet)

## Impact

- `src/admin/metadata/` — new snes-dataset provider (fetch + field mapping) alongside the existing artwork module; a combined enrichment entry point used by both call sites.
- `src/lib/` — pure, Node-testable helpers: slug/title normalization for the fallback lookup and dataset-field → catalog-field mapping (outside `src/lib/snes`, which stays ROM-identification only).
- `src/admin/lib/importer.ts` — replace the post-create libretro-only artwork step with dataset-first enrichment.
- `src/admin/catalog/CatalogTab.tsx` — "Sync from dataset" action in the game editor; honest result toasts.
- `src/components/media/AttributionPanel.tsx`, `ATTRIBUTION.md`, `docs/metadata.md` — credit snes-dataset and its upstream sources.
- Tests: pure lookup/mapping unit tests; provider tests with mocked `fetch`; degradation cases.
- External dependency: runtime HTTPS calls from the admin browser to `mode777.github.io` (CORS-open, no key, no rate limit); no new npm packages.
