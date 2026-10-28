# Design

## Context

See proposal.md — Why. The app is a hash-router SPA (`createHashRouter`, `base: './'`) whose production data source is PocketBase but whose dev/mock mode (`VITE_DATA_SOURCE=mock`) serves `MOCK_GAMES` including the bundled `DEMO_GAME` (`romUrl: './roms/gothicvania.sfc'`, CRC `88D63376`). The Snes9x core is self-hosted from `public/cores/` (gitignored, fetched by `npm run core:fetch`). Vitest covers units only; there is no browser automation. CI (Node 24) already runs `core:fetch` + `dats:fetch` before build, and `.gitignore` already knows `playwright-report`/`test-results`.

## Goals / Non-Goals

**Goals:**

- Deterministic e2e for the golden path using the mock catalog and demo ROM — no backend, no network.
- Fast, stable waits (status chip / runtime states, never fixed sleeps).
- Local single-command run and a CI job with failure artifacts.

**Non-Goals:**

- PocketBase-backed scenarios (importer round-trip, cloud saves) — those need a provisioned backend and belong to follow-up suites for their changes; the harness should make adding a PocketBase webServer straightforward later.
- Visual regression screenshots of commercial games (rule: no screenshots of copyrighted content; the demo ROM is MIT-licensed).
- Mobile viewport matrices.

## Decisions

### D1: Playwright with `webServer` running Vite preview against a production build

`playwright.config.ts` runs `npm run build` output via `vite preview` (port fixed, `VITE_DATA_SOURCE=mock` set for the webServer command) — e2e tests the built artifact, not dev-mode HMPU quirks. `reuseExistingServer` for local iteration. Alternative: `npm run dev` — rejected: dev-only behaviors (mock note banner is fine, but HMR/dev flags) differ from what ships.

### D2: Prerequisites as npm scripts, reusing existing fetchers

`predev`-style ordering is not needed: config `globalSetup` fails fast with a clear message when `public/cores/snes9x_libretro.js` or `public/roms/gothicvania.sfc` is missing, telling the runner to execute `npm run core:fetch`. CI already fetches before build. Keeps the suite honest about its inputs without duplicating fetch logic.

### D3: Deterministic waits on observable UI state

The player already exposes observable state: the status chip (idle/loading/playing/paused/error) rendered in `GameWindow`, toast messages for save/load, and slot `<select>`/buttons. The suite waits for those (`getByRole`, text content) — never `waitForTimeout`. Where the current UI lacks a stable hook, add `data-testid` attributes (e.g. `data-testid="player-status"`) rather than class selectors. WASM/core boot can take seconds on slow CI → generous, role-based auto-waiting with a raised per-test timeout.

### D4: One spec file per area, journey-first

`e2e/browse.spec.ts`, `e2e/details.spec.ts`, `e2e/player.spec.ts` (journey: details → play → save → load). Player spec is `test.describe.serial` — booting the core is expensive; reuse the page across the journey assertions instead of re-launching per assertion. Screenshot/trace on failure via config (`trace: 'on-first-retry'`, retries in CI only).

### D5: CI as a separate job, not inline

Add an `e2e` job to `.github/workflows/ci.yml` after build: install browsers (`npx playwright install --with-deps chromium`), run `npm run test:e2e`, upload `playwright-report` on failure. Chromium-only locally and in CI (Firefox/WebKit add flake without value here; WASM audio is irrelevant — assertions are visual state, not audio).

## Risks / Trade-offs

- [Headless WASM core flakiness on shared CI runners] → raised timeouts, retry-once in CI, status-based waits; if a runner is too slow, mark player spec `test.slow` rather than skipping.
- [Core not fetched in a fresh clone] → D2 fail-fast globalSetup message.
- [Mock catalog drift breaking selectors] → journey asserts against the stable demo game entry (slug `gothicvania`) present in every mock revision.
- [Autoplay policies blocking audio start] → Nostalgist boots with `runEmulatorManually` (paused start) and assertions target playing state after explicit Play activation — user-gesture-initiated, which headless Chromium permits.

## Migration Plan

Additive: new directory, scripts, devDependency, CI job. No product code changes except optional `data-testid` hooks. Rollback = remove the job/files.

## Open Questions

- None blocking. Extending the suite to PocketBase-backed flows (importer, cloud saves) is deliberately deferred until those changes land.
