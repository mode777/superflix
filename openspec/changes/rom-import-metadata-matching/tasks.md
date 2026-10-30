# Tasks

## 1. Title-index resolution fix

- [x] 1.1 Add a pure title-matching helper in `src/lib/snes-dataset.ts` that normalizes both sides of a comparison (leading-article move, accent folding, case/punctuation collapse via the existing `datasetSlugFromTitle` rules) and returns the first matching entry; unit-test it in `src/lib/snes-dataset.test.ts` for case, punctuation, accent, and `, The`/`The ` article forms plus a no-match case, and verify with `npm test`
- [x] 1.2 Rewire `resolveDatasetSlug` in `src/admin/metadata/dataset.ts` to match through the helper instead of the direct slugified key access; update `dataset.test.ts` mocks to the published index shape (display-title keys like `{ 'Chrono Trigger': 'chrono-trigger' }`) and add a regression test for a display-title key match, then verify with `npm test`

## 2. Big-box cover preference

- [x] 2.1 In `applyRecord` (`src/admin/metadata/enrich.ts`), order the cover source dataset `box` first, then the complementary libretro boxart, then dataset `thumb` as last resort, keeping the manual-cover skip intact; flip the affected `enrich.test.ts` assertions (cover file becomes the box image) and add tests for box-beats-thumb and thumb-only-last-resort, then verify with `npm test`

## 3. Explicit-slug enrichment for manual matches

- [x] 3.1 Add an explicit dataset-slug option to `enrichGame` that skips resolution, enriches from that slug's record, reports unresolved (not a checksum fall-through) when the slug has no record, and writes `metadata_id`/`metadata_source` provenance as usual; unit-test success, dead-slug outcome, and manual-cover preservation in `enrich.test.ts`, then verify with `npm test`

## 4. Dataset picker modal

- [x] 4.1 Add a `listDatasetTitles()` accessor to `src/admin/metadata/dataset.ts` returning the cached title index as `{ slug, title }` entries sorted alphabetically (reusing the existing per-fetcher cache); unit-test with a mocked fetcher including cache reuse, then verify with `npm test`
- [x] 4.2 Create `DatasetMatchModal` under `src/admin/` on top of `src/components/Dialog.tsx`: pre-filled quick filter, case-insensitive substring narrowing over the title list, select and dismiss callbacks, theme tokens only (`bg-surface`, `glass-panel`, …); component-test rendering, filter narrowing, select firing with the chosen slug, and dismiss leaving state untouched, then verify with `npm test`

## 5. Import flow integration

- [x] 5.1 In `src/routes/AdminView.tsx`, open the modal after a successful import whose enrichment reports unresolved (and not `unavailable`); selecting an entry runs the explicit-slug enrichment for the created game and reports the outcome via the existing `describeEnrichment` toast; dismissal is a no-op; extend the admin view tests to cover modal-on-unresolved, no modal on `unavailable`, and no modal on a resolved import, then verify with `npm test`

## 6. Catalog editor integration

- [x] 6.1 In `src/admin/catalog/CatalogTab.tsx`, add a "Match in dataset…" action beside "Sync from dataset" that opens the same modal pre-filled with the record's title and applies/ reports the result identically; add or extend a component test for open, apply, and dismiss, then verify with `npm test`

## 7. Full verification

- [x] 7.1 Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` and confirm all pass with no new warnings or type regressions
