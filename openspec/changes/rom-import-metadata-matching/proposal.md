# Proposal

## Why

Imported ROMs regularly end up without metadata: the dataset's title-index fallback never matches real data (`index.json` is keyed by display titles, but the lookup uses a slugified key), and covers prefer the dataset's small `thumb` image over its big box art. When neither the CRC32 nor the title resolves, the admin has no way to match the ROM by hand, so the record stays bare.

## What Changes

- Fix dataset title-index resolution so it matches the published `index.json` (display-title keys → slug values), making the automatic hash-miss → name fallback actually work.
- Prefer the dataset's big box art (`box`) for covers; the small `thumb` is a last-resort fallback only when no big box exists anywhere.
- When automatic resolution fails during import (no CRC32 hit, no title hit), offer a manual match: a modal window listing every entry in the dataset's `index.json` with a quick filter, from which the admin picks the dataset entry to enrich from.
- Expose the same manual match picker from the catalog editor, next to the existing "Sync from dataset" action, for records that were imported before this change.
- Enrichment remains automatic at import time and never blocks or fails the import; manual matching is an additional path, not a replacement.

Assumptions (recorded, not user-confirmed):

- "Always use the big box" means the big box wins whenever one exists; if the dataset has no `box` image, the cover falls back to the complementary libretro `Named_Boxarts` and only then to the dataset `thumb`. Full thumb removal would drop cover coverage from ~91% to ~68% of matched records.
- A manually matched record keeps its imported title; the choice applies the dataset's metadata fields and artwork and records the chosen slug in `metadata_id` / provenance.
- The modal opens after the import completes (enrichment must not block the catalog write) and can be dismissed.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `metadata-enrichment`: the title-index resolution requirement is corrected to match the real `index.json` shape; the dataset artwork requirement is amended to require big box art for covers; new requirements cover manual dataset matching (searchable, filterable picker) offered when automatic resolution fails, at import time and from the catalog editor.

## Impact

- `src/lib/snes-dataset.ts` — add a pure title-search/normalization helper for matching against display-title keys and for the picker's filtering (stays framework-free, Node-testable).
- `src/admin/metadata/dataset.ts` — fix `resolveDatasetSlug`'s index lookup; expose a way to list/search the title index.
- `src/admin/metadata/enrich.ts` — cover source order (`box` before `thumb`); accept an explicit dataset slug for manual matches (via the existing `metadata_id` path or a new option).
- `src/routes/AdminView.tsx` (import flow) and `src/admin/catalog/CatalogTab.tsx` (catalog editor) — trigger the manual match picker; new modal component under `src/admin/`.
- Tests: `dataset.test.ts`, `enrich.test.ts` (currently asserts the thumb-first cover — must be updated), plus new tests for the search helper and the picker flow.
- No schema, API, or dependency changes; no new external services beyond the already-used snes-dataset static host.
