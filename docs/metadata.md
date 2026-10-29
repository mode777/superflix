# Metadata and artwork

Superflix uses free, offline-friendly sources — no API keys are required.

| Source | Provides | License / notes |
|---|---|---|
| [No-Intro](https://no-intro.org/) via [libretro-database](https://github.com/libretro/libretro-database) | Game name, region, size, CRC32/MD5/SHA1, serial | CC-BY-SA-4.0 mirror; DATs are headerless |
| libretro `developer` / `publisher` / `genre` / `releaseyear` / `maxusers` DATs | Structured metadata keyed by CRC32 | CC-BY-SA-4.0 |
| [snes-dataset](https://github.com/mode777/snes-dataset) | Description, per-region release dates, developer/publisher, players, box art, screenshots — resolved by exact CRC32 (`by-crc.json`) with a normalized-title fallback | Metadata **CC0** (compiles Kaggle CC0 sets, Wikipedia-derived dates, OpenVGDB, opengamedb); images remain the property of their owners |
| [libretro-thumbnails](https://github.com/libretro-thumbnails/libretro-thumbnails) | Extra box art, title screens, in-game snaps (served via the jsDelivr mirror, which — unlike the primary host — sends CORS headers) | Images remain the property of their owners; shown for identification |

The DATs are downloaded by `npm run dats:fetch` into `public/data/` and are
gitignored. Only the files actually used at runtime are loaded.

## Identification

No-Intro DAT names are canonical. ROMs are hashed **after stripping the copier
header**, because No-Intro DATs describe headerless cartridge images. A match
uses CRC32 first, then MD5, SHA1, raw CRC32, and finally the 4-character game
code.

## Provenance

Enrichment imports record three fields on the `games` record:

| Field | Meaning |
|---|---|
| `metadata_source` | Enrichment source (`snes-dataset`, `libretro-thumbnails`) or `manual` |
| `metadata_id` | snes-dataset slug when enriched from the dataset, otherwise the No-Intro name used for artwork |
| `scraped_at` | When the enrichment ran |

When an administrator uploads a cover manually, `metadata_source` becomes
`manual`; refreshes keep that cover and only update the remaining fields.

## Artwork behaviour

- Games are resolved in snes-dataset by **exact CRC32** (headerless, uppercase)
  first; only when the checksum is unknown does a normalized-title lookup run.
- Images are downloaded at import or sync time and stored in PocketBase; the UI
  never hotlinks external images.
- Covers and screenshots are downscaled to catalog quality (≤640 px, WebP)
  before being stored; at most five screenshots are kept.
- A missing match, an unreachable host, or a decode failure degrades to the
  gradient placeholder; the import still succeeds, and the admin toast says
  which parts were enriched.
- A broken stored image also falls back to the placeholder at render time.
- The admin catalog editor's **Sync from dataset** action re-runs enrichment
  for an already-imported record: metadata fields are refreshed from the
  dataset, and a manually uploaded cover (`metadata_source: manual`) is never
  overwritten.

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
