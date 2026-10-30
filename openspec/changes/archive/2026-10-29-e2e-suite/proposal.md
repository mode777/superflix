# Proposal

## Why

Superflix has unit coverage (identification library, one browse smoke test) but nothing exercises the product end to end: browse → details → boot the WASM core → play the bundled demo ROM → save and load a state. Regressions in the boot chain (core resolution, canvas attach, ROM URL, save slots) are only caught by hand. The roadmap's cross-cutting list asks for exactly this Playwright suite, and `AGENTS.md` notes "add one when the upload/player flows grow" — the M1 importer makes that imminent.

## What Changes

- Add **Playwright** as the e2e harness: config, browser install script, and npm scripts (`test:e2e`, CI wiring).
- Cover the golden path against the bundled MIT demo ROM (`public/roms/gothicvania.sfc`) in mock data-source mode (no PocketBase required):
  - Browse renders the catalog; filtering by genre and search works.
  - Details page shows metadata; navigation to the player works.
  - Player boots the Snes9x core, reaches playing state, and renders frames.
  - Save a state in a slot, then load it and confirm play continues.
- Make the suite runnable locally and in CI (core + DATs fetched first, deterministic waits, no external network).
- Failure artifacts: traces/screenshots on CI for debugging.

No product behavior changes; no breaking changes. The suite is a safety net for the M1–M3 changes.

## Capabilities

### New Capabilities
- `e2e-coverage`: An end-to-end Playwright suite that guards the browse → details → play → save/load journey with the bundled demo ROM, runnable locally and in CI without external services.

### Modified Capabilities

(none — `openspec/specs/` is empty; there are no existing capability specs to modify)

## Impact

- New `e2e/` directory with Playwright config and specs; `package.json` scripts and devDependency (`@playwright/test`).
- `.github/workflows/ci.yml` gains an e2e job (fetch core/DATs → build/preview → test).
- `.gitignore` already covers `playwright-report` / `test-results`.
- No runtime application code changes (test-only selectors may be added where needed).
