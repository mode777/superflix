# Tasks

## 1. Docs foundation

- [x] 1.1 Create `docs/hosting.md` from the real deployment surface (PocketBase binary, Docker, GitOps, env vars, persistent data paths) and verify every command runs as written on a clean checkout
- [x] 1.2 Create `docs/metadata.md` covering No-Intro + libretro DATs + libretro-thumbnails sources, licenses, and the provenance fields (`metadata_source`/`metadata_id`/`scraped_at`), and verify field names match `scripts/generate-schema.mjs`
- [x] 1.3 Create `docs/controllers.md` with the actual keyboard bindings, gamepad pairing, save slots, SRAM export/import, and CRT toggle, and verify each described control exists in `GameWindow` today
- [x] 1.4 Create `docs/importing.md` for the M1 admin flow (superuser sign-in → identify → add to catalog → duplicates/variants), sequenced after `catalog-importer` lands, and verify the walkthrough matches the shipped UI

## 2. Screenshots and landing

- [x] 2.1 Capture license-safe screenshots (mock catalog + demo ROM only, fixed 1440×900 viewport: browse, details, player), store under `docs/assets/`, and write `docs/assets/README.md` with the capture procedure and the demo-ROM-only rule
- [x] 2.2 Rework the browse hero into the landing section (value statement, screenshots, CTAs to catalog and docs) using theme tokens only, and verify the catalog grid is still reachable by one scroll and the docs link resolves
- [x] 2.3 Add the docs index to the README and verify every guide is reachable in ≤ 2 clicks from both README and landing

## 3. Gates

- [x] 3.1 Run the full gate: `npm run typecheck && npm run lint && npm test && npm run build` green; verify no screenshot contains commercial game content (self-review against the project rule)
