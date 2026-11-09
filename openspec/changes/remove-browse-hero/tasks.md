# Tasks

## 1. Remove the browse hero

- [x] 1.1 Delete the hero `<section>` from `src/routes/BrowseView.tsx` (badge, "Every classic, one shelf." headline, copy, all four CTAs, mock-catalog note, and screenshot collage), keeping the favorites section, filter bar, states, and game grid; verify `grep -n "Every classic\|Play featured\|Browse the shelf" src/routes/BrowseView.tsx` returns nothing.
- [x] 1.2 Remove the imports and locals used only by the hero (`browseShot`, `detailsShot`, `playerShot`, `DOCS_URL`, `featured`, and `dataSource` if unused), and keep imports the remaining UI still uses (`Link`, favorites, auth, `AmbientBackground`); verify `npm run typecheck` and `npm run lint` pass.
- [x] 1.3 Extend `src/routes/BrowseView.test.tsx` to assert the catalog-first page still renders the "Library" heading and no longer renders the hero headline or "Play featured" link; verify `npm test -- BrowseView` passes.

## 2. Update e2e coverage and docs

- [x] 2.1 Update `e2e/browse.spec.ts` to drop the "Every classic" assertion, assert the "Library" heading is visible, and assert the hero copy is absent; verify `npm run test:e2e -- browse` passes with the core and demo ROM present.
- [x] 2.2 Update the README quick start so it tells readers to open a game from the grid instead of clicking **Play featured**; verify `grep -n "Play featured" README.md` returns nothing and the documented path still matches the visible UI.

## 3. Integration verification

- [x] 3.1 Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`; verify all pass.
- [x] 3.2 In `npm run dev`, open `/` at mobile and desktop widths and confirm the page starts with the fixed header, favorites (when signed in with favorites), filters/search, and the Library grid, with no marketing hero or screenshot collage above the games.

## Workflow follow-up

- Run `openspec validate remove-browse-hero --strict` before archiving.
- Archive the change and confirm `openspec/specs/user-docs-landing/spec.md` keeps its Purpose and the five remaining requirements, with no delta headers.
