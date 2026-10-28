# Importing ROMs

ROMs are imported from the admin area, which is restricted to the PocketBase
superuser. The player and catalog stay public.

## 1. Sign in

Open `/admin` and sign in with the superuser credentials created during setup
(see [hosting](./hosting.md)). Visitors without a session only see the sign-in
form.

## 2. Identify

Drop a `.sfc`, `.smc`, `.fig`, `.swc`, or `.bin` file on the dropzone (or use
**Select ROM**). Identification runs entirely in the browser:

- the 512-byte copier header is stripped when present,
- CRC32/MD5/SHA1 are computed over the cartridge image,
- the internal header is parsed (mapper, region, revision, battery, SRAM),
- the hash is matched against the No-Intro index, with libretro metadata
  (developer, publisher, genre, release year, players) merged in when present.

**Play locally** loads the file into the player without writing anything.

## 3. Add to catalog

**Add to catalog** persists the ROM and its metadata:

- the headerless image is uploaded to PocketBase (up to the 16 MB field limit),
- a `games` record is created with the cleaned title, slug, region, hashes,
  size, parsed header, and enrichment metadata,
- a primary `roms` record is created for the same image,
- boxart/screenshots are fetched from libretro-thumbnails when the exact
  No-Intro name exists. Artwork failure never blocks the import.

Upload progress is shown while the file transfers.

### Duplicates and variants

- Same ROM (matching CRC32) already in the catalog → nothing is created; use
  **Open existing game**.
- Same title (matching slug) but a different CRC32 (for example another
  region) → the ROM is attached to the existing game as a non-primary variant
  instead of creating a second game.

## 4. Manage the catalog

The **Catalog** tab lists every game with region, CRC32, and size.

- **Edit** changes title, description, region, genre, developer, publisher,
  release date, and players. The public details page updates immediately.
- **Replace ROM** uploads a new file and recalculates the stored hashes, size,
  and header.
- **Delete** removes the game and its ROM variants after confirmation.
- **Replace cover** uploads artwork manually; provenance switches to `manual`
  and future artwork refreshes keep that cover.
- **Refresh artwork** re-fetches screenshots/provenance from libretro-thumbnails
  (the cover is skipped for manual overrides).

Imported records are normal PocketBase rows, so they can also be managed via
the PocketBase admin UI or API.
