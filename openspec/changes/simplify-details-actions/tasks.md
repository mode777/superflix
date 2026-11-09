# Tasks

## 1. Simplify the details actions and credits header

- [x] 1.1 Change the player link in `src/routes/DetailsView.tsx` to the exact label **Play** and replace `bg-gradient-to-br from-primary to-tertiary-container` with solid `bg-primary` (keeping `text-on-primary`, the play icon, `hover:brightness-110`, and the `/play/${game.slug}` target); verify `grep -n "Play in browser\|bg-gradient" src/routes/DetailsView.tsx` returns nothing and the link still points at `/play/`.
- [x] 1.2 Delete the **Import another ROM** `<Link to="/admin">` from the details actions while leaving the Favorite toggle untouched; verify `grep -n "Import another ROM" src/routes/DetailsView.tsx` returns nothing and `grep -n 'NavItem to="/admin"' src/components/layout/Header.tsx` still finds the header import route.
- [x] 1.3 Change the `AttributionPanel` `<summary>` from `text-headline-lg` to `text-body-md font-semibold` (keeping `cursor-pointer`, `text-on-surface`, the label, and the native `<details>`); verify `grep -n "text-headline-lg" src/components/media/AttributionPanel.tsx` returns nothing and `grep -n "text-body-md" src/components/media/AttributionPanel.tsx` finds the summary.

## 2. Update selectors and documentation

- [x] 2.1 Update the Play-link selectors in `e2e/details.spec.ts`, `e2e/player.spec.ts`, `e2e/player-dpr.spec.ts`, and `e2e/crt-controls.spec.ts` from `/Play in browser/i` to an exact **Play** name; verify `grep -rn "Play in browser" e2e` returns nothing and `npx playwright test --list` lists all four specs without parse errors.
- [x] 2.2 Update the quick start in `README.md` and the intro in `docs/controllers.md` to say **Play** instead of **Play in browser**; verify `grep -rn "Play in browser" README.md docs` returns nothing and both files still describe opening a game from the grid then choosing Play.

## 3. Integration verification

- [x] 3.1 Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`; verify all pass.
- [x] 3.2 In a browser-capable environment, run the details/player e2e coverage (`npm run test:e2e -- details` and the player specs that click Play); verify all pass and the details → player navigation still works.
- [x] 3.3 On the details page at mobile and desktop widths, verify Play is a solid blue button with the label Play, no Import another ROM action remains beside Favorite, and the Metadata & artwork credits summary reads at body-text size rather than as a 32px headline.

## Workflow follow-up

- Run `openspec validate simplify-details-actions --strict` before archiving.
- Archive the change and confirm no spec files were added or modified because the change sets `skip_specs: true`.
