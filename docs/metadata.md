# Metadata and artwork

Superflix uses free, offline-friendly sources — no API keys are required.

| Source | Provides | License / notes |
|---|---|---|
| [No-Intro](https://no-intro.org/) via [libretro-database](https://github.com/libretro/libretro-database) | Game name, region, size, CRC32/MD5/SHA1, serial | CC-BY-SA-4.0 mirror; DATs are headerless |
| libretro `developer` / `publisher` / `genre` / `releaseyear` / `maxusers` DATs | Structured metadata keyed by CRC32 | CC-BY-SA-4.0 |
| [libretro-thumbnails](https://github.com/libretro-thumbnails/libretro-thumbnails) | Boxart, title screens, in-game snaps | Images remain the property of their owners; shown for identification |

The DATs are downloaded by `npm run dats:fetch` into `public/data/` and are
gitignored. Only the files actually used at runtime are loaded.

## Identification

No-Intro DAT names are canonical. ROMs are hashed **after stripping the copier
header**, because No-Intro DATs describe headerless cartridge images. A match
uses CRC32 first, then MD5, SHA1, raw CRC32, and finally the 4-character game
code.

## Provenance

Artwork imports record three fields on the `games` record:

| Field | Meaning |
|---|---|
| `metadata_source` | Provider id (`libretro-thumbnails`) or `manual` |
| `metadata_id` | Exact No-Intro name used for the lookup |
| `scraped_at` | When the artwork was fetched |

When an administrator uploads a cover manually, `metadata_source` becomes
`manual`; refreshes keep that cover and only update the remaining fields.

## Artwork behaviour

- Images are matched by **exact No-Intro name** and downloaded at import time.
- Covers and screenshots are downscaled to catalog quality (≤640 px, WebP)
  before being stored; at most five screenshots are kept.
- Images live in PocketBase (`cover_image`, `screenshots`) and are served from
  there — the UI never hotlinks external images.
- A missing match, an unreachable host, or a decode failure degrades to the
  gradient placeholder; the import still succeeds.
- A broken stored image also falls back to the placeholder at render time.

## Attribution

- No-Intro and libretro-database: **CC-BY-SA-4.0**.
- libretro-thumbnails: copyright of the respective game publishers; used for
  identification.
- The in-app **Metadata & artwork credits** panel on each details page links to
  these sources. See [`ATTRIBUTION.md`](../ATTRIBUTION.md) for the complete
  list.

If you add another provider (ScreenScraper, IGDB, …), cache the result in
PocketBase, record `metadata_source`/`metadata_id`, keep the attribution
visible, and never hotlink images in the UI.
