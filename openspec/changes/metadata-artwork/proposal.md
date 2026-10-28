# Proposal

## Why

After M1, imported games have correct metadata but no visuals: every card and details page falls back to the deterministic gradient placeholder, so the catalog doesn't look like a streaming service. Roadmap M2 (v0.3) asks for boxart and screenshots from free sources, with no API keys. Everything needed already exists externally (libretro-thumbnails) and in the schema (`cover_image`, `screenshots`, `metadata_source`/`metadata_id`/`scraped_at` fields are defined but unused).

## What Changes

- During import, fetch artwork from **libretro-thumbnails** by exact No-Intro name: boxart (`Named_Boxarts`), in-game snap (`Named_Snaps`), and title screen (`Named_Titles`).
- **Store images in PocketBase** (`games.cover_image`, `games.screenshots`) — the UI never hotlinks external images at browse time.
- Cap screenshots at 5 and store downscaled, catalog-quality derivatives (generated client-side) instead of full-resolution PNGs.
- **Degrade gracefully**: any artwork failure (no match, network error, blocked request) leaves the record importable and renders the existing gradient placeholder.
- Add a **manual override** in the admin catalog editor (title, description, cover); a manual cover is never overwritten by a later artwork refresh, and provenance switches to `manual`.
- Record provenance on scrape: `metadata_source`, `metadata_id` (No-Intro name), `scraped_at`.
- Add attribution for libretro-database (CC-BY-SA-4.0) and thumbnail copyright holders to `ATTRIBUTION.md` and an in-app attribution panel (e.g. on the details page footer or about section).
- Introduce a minimal **provider adapter interface** for artwork so ScreenScraper/IGDB can be added later — interface and libretro implementation only, no API keys, no additional providers.

Builds on the `catalog-importer` change (uses its import pipeline and admin editor); sequence it after that change. No breaking changes; public catalog/player behavior is unchanged for games without artwork.

## Capabilities

### New Capabilities
- `metadata-artwork`: Fetching, storing, and overriding game artwork and metadata provenance during import — libretro-thumbnails matching, PocketBase-cached images, degradation rules, manual override, and attribution.

### Modified Capabilities

(none — `openspec/specs/` is empty; there are no existing capability specs to modify)

## Impact

- `src/admin/` — artwork step in the import flow, provider module, admin editor gains cover/description override.
- `src/lib/` — pure thumbnail-name/URL matching utility (outside `src/lib/snes`, which stays ROM-identification only).
- `ATTRIBUTION.md`, plus a small in-app attribution panel.
- No schema changes (`cover_image`, `screenshots`, `metadata_source`, `metadata_id`, `scraped_at` already exist).
- New tests: name matching, image failure degradation, provenance fields.
