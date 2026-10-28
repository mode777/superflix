# Design

## Context

See proposal.md — Why. Today the README carries quick-start + deployment notes aimed at developers; no `docs/` exists; the browse hero ("Every classic, one shelf.") doubles as the landing with an "Import a ROM" CTA. Screenshots would come from the running app — the verification server (per AGENTS.md house docs) can capture headless llvmpipe renders, or simply a local dev server; the only bundled-safe content is the MIT demo ROM. The site is hash-routed (`createHashRouter`) with routes `/`, `/game/:slug`, `/play/:slug`, `/admin`.

## Goals / Non-Goals

**Goals:**

- Four focused guides in `docs/`, each independently useful and verified runnable.
- A landing that orients a stranger in one screen and drives to catalog/docs.
- A repeatable, license-safe screenshot capture procedure documented for future refreshes.

**Non-Goals:**

- An in-app help system or CMS — markdown in the repo.
- Marketing site with its own domain/theme.
- Screenshots of commercial games (hard project rule).
- Translations.

## Decisions

### D1: Markdown docs in `docs/`, indexed from README — not a docs site generator

Four files (`hosting.md`, `importing.md`, `metadata.md`, `controllers.md`) rendered by GitHub/any viewer. Alternative: VitePress/docusaurus — rejected: a second build pipeline and theme to maintain for four pages that rarely change; the repo is the product's home.

### D2: Rework the browse hero into the landing rather than adding a route

The existing hero block on `/` grows into a landing section: value statement, three UI screenshots (browse grid, details page, player with demo ROM), primary CTAs "Browse the shelf" (scrolls to grid) and "Read the docs" (external link to `docs/` on the repo). Alternative: dedicated `/welcome` route — rejected: hash router + extra click; the root is the natural landing and the catalog stays immediately below it, preserving today's instant-catalog feel.

### D3: Screenshot procedure + demo-ROM-only captures

`docs/assets/` holds captures taken against `npm run dev` (mock data, gothicvania everywhere) at a fixed viewport (1440×900), captured manually or via the verification box's headless browser for repeatability. A short section in `docs/hosting.md`… no — a `docs/assets/README.md` states the procedure and the licensing rule (demo ROM only). Attribution file gains a line only if a screenshot includes third-party art (the ansimuz CC0 assets inside gothicvania are already attributed).

### D4: Docs content sourced from reality

Each guide is written against the shipped behavior: hosting mirrors `Dockerfile`/`docker-compose.yml`/GitOps notes already in the README (which link into the guide instead of duplicating); importing follows the M1 flow (write after/with `catalog-importer` landed); metadata follows M2 provenance fields; controllers documents actual defaults (RetroArch keyboard mapping, gamepad auto-detection, save slots, SRAM export/import, CRT toggle). Where a flow doesn't exist yet, the guide waits for that change — sequencing note in tasks.

## Risks / Trade-offs

- [Docs rot as flows change] → each milestone change's verification step includes "update the corresponding guide"; guides are small enough to re-check quickly.
- [Screenshots age visually] → procedure documented for cheap refreshes; assets are not auto-loaded anywhere except the landing, keeping blast radius small.
- [Landing growth vs catalog-first feel] → landing stays one section; the grid remains on the initial viewport scroll.

## Migration Plan

Additive markdown + one hero rework; no backend or schema impact. Rollback = revert.

## Open Questions

- None blocking. Final screenshot count/composition is an authoring-time choice as long as the demo-ROM-only rule holds.
