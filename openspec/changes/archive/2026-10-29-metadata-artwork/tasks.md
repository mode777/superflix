# Tasks

## 1. Pure matching utilities

- [x] 1.1 Create `src/lib/thumbnails.ts` with `thumbnailUrl(system, kind, noIntroName)` and kind constants, and verify unit tests pass for plain, punctuated (`&`, `,`), diacritic, and bracketed No-Intro names via `npm test`
- [x] 1.2 Define the `ArtworkProvider` interface and `ArtworkResult` types in `src/admin/metadata/provider.ts` and verify a typecheck (`npm run typecheck`) accepts a stub provider

## 2. libretro provider

- [x] 2.1 Implement the libretro-thumbnails provider (cover ← `Named_Boxarts`, screenshots ← `Named_Titles` + `Named_Snaps`, title first, cap 5; fetch failures resolve to empty results) and verify unit tests with a mocked `fetch` cover found/not-found/error cases
- [x] 2.2 Implement canvas downscaling/re-encoding (cover ≤640 px long edge, screenshots ≤640 px wide, WebP with JPEG fallback, per-image failure skipped) and verify unit tests assert dimensions, format, and cap

## 3. Import integration

- [x] 3.1 Add the artwork step to the import flow: after record creation, fetch → downscale → multipart PATCH of `cover_image`/`screenshots` plus `metadata_source`/`metadata_id`/`scraped_at`, and verify an imported `gothicvania.sfc` against local PocketBase ends up with provenance fields set
- [x] 3.2 Verify degradation end-to-end: with the provider made unreachable (mocked failure), the import still succeeds, the record has no artwork, and browse shows the gradient placeholder
- [x] 3.3 Add `onError` fallbacks to `CoverArt` and `ScreenshotCarousel` and verify a broken stored image URL renders the placeholder instead of a broken image

## 4. Manual override and refresh

- [x] 4.1 Extend the admin catalog editor with cover upload plus title/description editing that sets `metadata_source: 'manual'`, and verify a manual cover shows on the public details page
- [x] 4.2 Add an admin "refresh artwork" action that skips cover replacement for manually overridden records and verify a refresh updates screenshots/provenance while keeping the manual cover
- [x] 4.3 Verify provenance unit tests: scraped record → `metadata_source`/`metadata_id`/`scraped_at` set; overridden record → manual source recorded

## 5. Attribution and gates

- [x] 5.1 Add the attribution panel component (libretro-database CC-BY-SA-4.0, thumbnail copyright holders, links) to the details page and mirror the text in `ATTRIBUTION.md`; verify the panel renders and the file lists both sources
- [x] 5.2 Run the full gate: `npm run typecheck && npm run lint && npm test` green; manual M2 acceptance — import a ROM and see boxart + at least one screenshot with no manual upload, failures degrade to placeholders
