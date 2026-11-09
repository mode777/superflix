# Proposal

## Why

The browse route (`/`) opens with a full marketing hero — badge, "Every classic,
one shelf." headline, product copy, four CTAs, a demo-catalog note, and a collage
of three screenshots — before the player sees a single game. Superflix is a
catalog and player, so the main view should lead with the shelf, not an
advertising panel. The hero also duplicates navigation the header already owns
(Browse, Import) and adds two links ("Read the docs", "Play featured") that the
user does not want kept.

## What Changes

- Remove the entire hero section from the browse route: badge, headline, product
  copy, the "Browse the shelf", "Read the docs", "Import a ROM" and "Play
  featured" CTAs, the demo-catalog note, and the three-screenshot collage.
- Remove the now-unused imports and locals that only exist to build the hero
  (`browseShot`, `detailsShot`, `playerShot`, `DOCS_URL`, `featured`,
  `dataSource`).
- Keep the fixed app header as the only app-level navigation, and keep
  favorites, genre chips, search, loading/error/empty states, and the game grid
  unchanged. The "Library" grid heading becomes the first heading on the page.
- Update the browse e2e test so it no longer asserts the removed headline.
- Update the README quick start: instead of clicking **Play featured**, open a
  game from the grid.
- **BREAKING** for anyone who used the hero's shortcuts: the root no longer
  links to the user docs or launches the bundled demo directly; both remain
  reachable from the README and the catalog grid.

Out of scope: redesigning the header or adding replacement navigation, moving
the product/landing copy to another route, deleting the screenshots in
`docs/assets/`, and changing catalog, favorites, filtering, or search behavior.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `user-docs-landing`: removes the "Landing experience with safe screenshots"
  requirement and its scenarios, and narrows "Documentation discoverable" so
  the user docs are indexed by the README without requiring a link from the app.

## Impact

- `src/routes/BrowseView.tsx` — delete the hero markup and its imports/state.
- `e2e/browse.spec.ts` — drop the removed-heading assertion.
- `README.md` — retarget the quick-start instruction at the game grid.
- `openspec/specs/user-docs-landing/spec.md` after the delta is applied.
- No backend, schema, dependency, emulator-boundary, or data changes. The
  screenshots under `docs/assets/` stay in place; only their import from the
  browse route goes away.
