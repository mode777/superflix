# Tasks

## 1. Harness setup

- [x] 1.1 Add `@playwright/test`, `playwright.config.ts` (chromium, `vite preview` webServer with `VITE_DATA_SOURCE=mock`, retries in CI, traces on first retry), and a `test:e2e` npm script; verify `npx playwright test --list` enumerates an empty suite without errors
- [x] 1.2 Add a `globalSetup` that fails fast with instructions when the core (`public/cores/snes9x_libretro.js`) or demo ROM is missing, and verify the message appears after deleting the core and disappears after `npm run core:fetch`

## 2. Catalog specs

- [x] 2.1 Write `e2e/browse.spec.ts` (grid renders the demo game, genre filter narrows results, search matches title/developer, empty state on no match) and verify it passes against the preview server
- [x] 2.2 Write `e2e/details.spec.ts` (metadata panel renders, play button navigates to the player route) and verify it passes

## 3. Player journey spec

- [x] 3.1 Write `e2e/player.spec.ts` as a serial journey: open details → play → wait for playing status (status chip / `data-testid="player-status"`), with user-gesture activation; verify it passes locally and on a cold cache
- [x] 3.2 Extend the journey with save → load on the same slot, asserting the player returns to playing state with no error overlay; add `data-testid` hooks to `GameWindow` where stable selectors are missing and verify the suite still passes with them
- [x] 3.3 Harden waits (no fixed sleeps; role/text-based waits, raised timeouts for core boot) and verify a deliberately broken wait (temporarily) fails quickly with a useful trace, then restore

## 4. CI integration

- [x] 4.1 Add the `e2e` job to `.github/workflows/ci.yml` (fetch core/DATs → build → `npx playwright install --with-deps chromium` → `npm run test:e2e` → upload `playwright-report` on failure) and verify a green run on the PR that adds it

## 5. Gates

- [x] 5.2 Run the full gate including the new suite: `npm run typecheck && npm run lint && npm test && npm run test:e2e` green locally
