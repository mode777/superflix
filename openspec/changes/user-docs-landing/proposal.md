# Proposal

## Why

Superflix is deployable and documented only at the contributor level (README sections, AGENTS.md): there is no `docs/` folder, no user-facing guide for hosting/importing/metadata/controllers, and no landing experience beyond the browse hero. The roadmap's cross-cutting list asks for user docs and a landing page with screenshots so a new visitor (or a fresh self-hoster) understands what this is and how to run it in minutes.

## What Changes

- **User docs** in `docs/`, linked from the README:
  - `hosting.md` — self-hosting: PocketBase, Docker/GitOps deployment, env vars, data paths.
  - `importing.md` — the admin flow: sign in as superuser, identify, add to catalog, duplicates/variants.
  - `metadata.md` — where metadata/artwork comes from (No-Intro + libretro DATs + libretro-thumbnails), provenance fields, attribution/licensing constraints.
  - `controllers.md` — playing: keyboard defaults, pairing gamepads, save states, SRAM, CRT overlay.
  - Docs stay runnable-as-written: every command verified during authoring.
- **Landing experience**: a purposeful landing section (reworked hero on `/` or a dedicated route — decided in design) that states what Superflix is, shows real UI screenshots, and routes visitors to browse or the docs.
- **Screenshots policy**: only captures of the app running the bundled MIT-licensed demo ROM (`gothicvania.sfc`) — never commercial game footage, box art, or copyrighted screenshots (project rule).
- README gains a docs index and a one-paragraph product intro.

No app behavior changes beyond the landing UI addition; no breaking changes.

## Capabilities

### New Capabilities
- `user-docs-landing`: User-facing documentation for hosting, importing, metadata, and controllers, plus a landing page presenting the product with license-safe screenshots and routes to browse/docs.

### Modified Capabilities

(none — `openspec/specs/` is empty; there are no existing capability specs to modify)

## Impact

- New `docs/` directory (four guides), README edits, new/updated landing components under `src/routes/` or `src/components/`.
- New `docs/assets/` screenshots (demo-ROM captures only; attribution kept current in `ATTRIBUTION.md` if any asset requires it).
- No schema, dependency, or emulator-boundary changes.
