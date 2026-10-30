# Design

## Context

Enrichment already runs automatically at import (`createCatalogRecord` → `enrichGame`) and resolves a game by stored CRC32 (`by-crc.json`), then by title (`index.json`), then falls back to libretro artwork. Two defects and one gap motivate this change:

- **Title fallback never matches real data.** The published `index.json` maps ~3,070 display titles to slugs (`"Super Metroid": "super-metroid"`; zero slug-like keys), but `resolveDatasetSlug` looks up `index[datasetSlugFromTitle(base)]` — a slugified key. Unit tests pass only because their mocks use slug keys. The proposed spec fixes the contract; the design must fix matching on the consumer side.
- **Covers prefer the small thumb.** `applyRecord` picks `thumb ?? box` for the cover, and `enrich.test.ts` asserts `slug-thumb.png`. The dataset's `box` image is the big box art and should win.
- **No escape hatch.** When both lookups miss, the admin only sees "not in dataset" in a toast; there is no way to match by hand.

Existing building blocks: the title index is already fetched once and cached per session in `src/admin/metadata/dataset.ts`; `enrichGame` already trusts a known slug via `metadataId`; the catalog editor has a "Sync from dataset" action; `src/components/Dialog.tsx` provides the modal shell.

## Goals / Non-Goals

**Goals:**

- Make the automatic hash-miss → title fallback work against the published index, with normalization shared by both sides of the comparison.
- Big box art wins for covers; thumb demoted to last resort.
- A quick-filterable dataset picker, shown after an unresolved import and available from the catalog editor, that enriches the record from the chosen entry.

**Non-Goals:**

- No schema, API, provider-interface, or dependency changes.
- No fuzzy/fuzzy-scoring matching beyond the existing normalization (no Levenshtein, no "did you mean").
- No bulk re-match tooling; the picker matches one record at a time.
- No changes to the dataset repository itself.

## Decisions

### 1. Normalize both sides of the title comparison (consumer-side fix)

Compare `datasetSlugFromTitle(gameTitle)` against `datasetSlugFromTitle(indexKey)` for each index entry — the existing helper already folds accents, moves the leading article, and collapses case/punctuation. First exact normalized match wins; no behavior beyond the two existing lookups (spec: checksum-first resolution).

- *Alternative: regenerate `index.json` with slug keys in the dataset repo.* Rejected: the dataset is a published static artifact used by other consumers, and the fix must survive dataset updates.
- *Alternative: lowercase/trim keys only.* Rejected: it would not handle the `, The` article form, the exact case the existing helper was written for.

Cost: one pass over ~3,070 entries per title lookup, memoizable alongside the existing index cache. This matching logic is pure string work, so it lives in `src/lib/snes-dataset.ts` (framework-free, Node-testable) as e.g. `matchDatasetTitle(title, entries)`; `resolveDatasetSlug` calls it instead of the direct key access.

### 2. Cover order: dataset box → complementary libretro boxart → dataset thumb

In `applyRecord`, take `box` when the record advertises it. Only when it does not, try the complementary libretro provider's `Named_Boxarts` (which the flow already calls for screenshots), and only when that fails too, fall back to `thumb`. Rationale: the user requirement is "always the big box", but dropping thumb entirely would cut cover coverage on matched records from ~91% to ~68% (measured in the archived enrichment change); last-resort keeps covers on records that genuinely have no box art anywhere. `enrich.test.ts` assertions flip accordingly.

### 3. Manual match = explicit slug through the existing enrichment pipeline

Add an option to `enrichGame` (e.g. `slug`) that skips resolution and goes straight to `fetchDatasetRecord(slug)` + `applyRecord`. Unlike `metadataId` (opportunistic, falls through to checksum on a miss), an explicit match reports "not in dataset" when the slug 404s instead of silently resolving elsewhere — the admin made a choice and must see its outcome. Provenance is unchanged (`metadata_id = slug`, `metadata_source = snes-dataset`), so later syncs skip matching. Manual-cover override keeps applying.

- *Alternative: reuse `metadataId`.* Rejected: its documented semantics (verify-then-fall-through) would swallow a dead slug choice.
- *Alternative: a separate "applyDatasetMatch" function.* Rejected: it would duplicate `applyRecord`'s field/image/provenance rules and drift from them.

### 4. Picker UI: one modal component, two entry points

A single `DatasetMatchModal` (under `src/admin/`) built on `src/components/Dialog.tsx`, styled with theme tokens:

- Data: the cached title index via a new `dataset.ts` accessor (`listDatasetTitles(): Promise<Array<{ slug, title }>>`) — no new endpoint, same session cache.
- List: alphabetical by title, virtualization unnecessary at ~3,070 rows; a plain scrollable list.
- Quick filter: case-insensitive substring on the display title, applied as the admin types (spec scenario). The imported/stored title pre-fills the field so the list usually starts narrowed.
- Selection: fetches the record, runs `enrichGame({ slug })`, reports the outcome with the existing `describeEnrichment` toast, closes the modal.
- Entry points:
  - `AdminView` import flow: when `createCatalogRecord` returns `enrichment.resolved === false && !enrichment.unavailable`, open the modal after the success toast. The import has already succeeded (spec: enrichment never blocks catalog writes); dismissal leaves the record as imported.
  - `CatalogTab`: a "Match in dataset…" button next to "Sync from dataset", pre-filled with the record's title.

- *Alternative: inline autocomplete on the import screen instead of a modal.* Rejected: the user asked for a modal, and the editor needs the same picker anyway.
- *Alternative: server-side/PocketBase-cached index.* Rejected: the index is small, static, and already cached client-side per session.

## Risks / Trade-offs

- [Normalization collision — two different titles slugify identically] → Match returns the first entry in index order; the admin sees the resolved title in the toast and can correct via the picker. No silent wrong-write beyond what a wrong automatic match already risks today.
- [A wrong manual match overwrites fields] → The editor already supports manual correction, the manual-cover override protects uploaded covers, and the sync action can re-run enrichment from `metadata_id`.
- [Full-list rendering feels heavy on slow devices] → 3,070 simple rows is fine in practice; if not, the filter is the mitigation (pre-filled query narrows the initial render). Virtualization stays out of scope.
- [Modal appears on every hash-and-title miss, including junk dumps] → It is dismissable in one interaction and only opens when the record actually failed both lookups; `unavailable` (network) cases do not open it.

## Migration Plan

No data or schema migration. Deploy is a normal SPA release: previously imported bare records get their metadata via the editor's existing sync or the new picker. Rollback is a normal image rollback; records enriched in the meantime keep valid `metadata_id`/provenance values.

## Open Questions

None.
