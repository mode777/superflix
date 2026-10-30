# Design

## Context

See proposal.md — Why. The import pipeline from `catalog-importer` creates `games`/`roms` records via XHR multipart upload (`src/admin/lib/upload.ts`); the schema already has `cover_image` (file, 10 MB, jpeg/png/webp), `screenshots` (file ×10), and `metadata_source`/`metadata_id`/`scraped_at`. `CoverArt`/`ScreenshotCarousel` already render `coverUrl`/`screenshots` via `fileUrl()` and fall back to gradient placeholders when absent — but `CoverArt` has no `onError` handling today. libretro-thumbnails is a static image host organized as `<System>/<Named_Boxarts|Named_Snaps|Named_Titles>/<No-Intro Name>.png` with the SNES system directory `Nintendo_-_Super_Nintendo_Entertainment_System`.

## Goals / Non-Goals

**Goals:**

- Zero-key artwork for imported games, fetched once at import and cached in PocketBase.
- Keep the import flow resilient: artwork is an enhancement, never a gate.
- A provider seam that a future ScreenScraper/IGDB adapter can plug into without touching the import flow.
- Respect the project rule: never hotlink images in the UI.

**Non-Goals:**

- Fuzzy name matching, regional fallback chains, or scraping screenscraper/IGDB now.
- Storing original full-resolution artwork (only derivatives are stored).
- Re-scraping on a schedule (refresh is admin-triggered).
- Schema changes.

## Decisions

### D1: Pure URL builder + provider interface; libretro provider implements it

New `src/lib/thumbnails.ts` (pure, Node-testable, outside `src/lib/snes` which stays ROM-identification only): `thumbnailUrl(system, kind, noIntroName)` → URL-encoded exact-name URL, and kind constants. `src/admin/metadata/provider.ts` defines the seam:

```ts
interface ArtworkProvider {
  id: string                       // stored in metadata_source
  fetchArtwork(noIntroName: string): Promise<ArtworkResult>  // { cover?: ImageBlob[]; screenshots: ImageBlob[] }
}
```

with `ArtworkResult` never throwing for "not found". The libretro implementation composes `thumbnailUrl` + `fetch`, mapping: cover ← first `Named_Boxarts` entry; screenshots ← `Named_Titles` + `Named_Snaps`, capped at 5 (title first). Alternative considered: put matching inside `src/lib/snes` — rejected; it is not SNES-rom-identification logic and the library must stay focused.

### D2: Download in the browser at import, upload as record files

The importer (admin context, authenticated) fetches provider images as Blobs, processes them (D3), then updates the `games` record with a multipart PATCH via the existing `uploadRecord` helper: `cover_image` file part, `screenshots` file parts, and provenance fields `metadata_source`/`metadata_id`/`scraped_at`. Browse-time UI keeps reading `fileUrl()` — no hotlinking anywhere.

Risk noted: if `thumbnails.libretro.com` ever stops sending CORS headers, browser fetch fails; the degradation path (spec: *Artwork failures never block import*) keeps imports working, and the manual cover override is the escape hatch. No server-side proxy — that would put scraping load on the deployment and complicate the single-binary PocketBase setup.

### D3: Store downscaled derivatives, not originals

Full snaps are ~1–2 MB PNGs. Before upload, decode each image and re-encode via `<canvas>`: cover at max 640 px on the long edge, screenshots at max 640 px wide, WebP (JPEG fallback) — comfortably within the 10 MB field limit and typically ≤ ~200 KB each. "Generate thumbnails" from the roadmap is satisfied by storing these catalog-quality derivatives; originals are discarded. Alternative considered: storing originals plus generated thumbnails as paired file fields — rejected, it needs a schema change and doubles storage for no UI benefit.

### D4: Manual override via provenance marker, no schema change

The admin editor gains cover upload + description/title editing. When an admin uploads a cover, the update sets `metadata_source: 'manual'` (and clears/keeps `metadata_id`). The refresh action skips cover replacement when `metadata_source === 'manual'` (spec: *Refresh after manual override*). No boolean field needed; `metadata_source` already encodes the distinction.

### D5: Attribution as a shared panel component

Small presentational component (details page footer + admin about area) listing source name, license, link — content mirrored in `ATTRIBUTION.md`. Roadmap asks for a panel/docs; one component avoids duplicating the text in-app.

### D6: Render-time fallback added to CoverArt/ScreenshotCarousel

Add `onError` handling so a deleted/corrupt stored image falls back to the gradient placeholder (spec: *Broken image at render time*). Small change to existing components, no API change.

## Risks / Trade-offs

- [libretro-thumbnails CORS or downtime] → import degrades to metadata-only; manual cover upload remains; surfaced via the existing toast system, not a blocking dialog.
- [Name-encoded mismatches (e.g. `&`, é, `/` in No-Intro names)] → the URL builder encodes exactly; unit tests cover punctuation/diacritics; unmatched names degrade.
- [Canvas re-encode of odd PNGs fails in some browsers] → per-image try/catch; skip the failed image, keep the rest.
- [Derivative quality complaints] → acceptable for a catalog UI; manual override covers exceptions. Full-res art is always available at the source.

## Migration Plan

Frontend-only; no schema or backend change. Deploys with the normal build. Rollback = revert; previously imported records simply keep whatever artwork they had.

## Open Questions

- None blocking. The in-app placement of the attribution panel (details footer vs. separate about page) can be decided during implementation without changing the requirements.
