# catalog-importer Specification

## Purpose

Turns the admin ROM identification screen into a real importer: identified ROMs are persisted as public catalog records in PocketBase, with duplicate protection, metadata enrichment, and admin catalog management.

## Requirements

### Requirement: Add to catalog action
The admin identify screen SHALL offer an "Add to catalog" action for an identified ROM that persists the ROM as a catalog record and, on success, links to the new game's public detail page.

#### Scenario: Successful import
- **WHEN** a superuser identifies a ROM and activates "Add to catalog"
- **THEN** the system creates the catalog record and confirms success with a link to the imported game's detail page
- **AND** the game appears in the public catalog after reload

#### Scenario: Import failure is reported
- **WHEN** the catalog write fails (for example the backend is unreachable or rejects the request)
- **THEN** the system shows an error message and keeps the identification result on screen so the admin can retry

### Requirement: Upload with progress
ROM upload SHALL report real progress derived from the multipart upload itself, not an indeterminate indicator.

#### Scenario: Large ROM upload
- **WHEN** a multi-megabyte ROM file is being uploaded to the catalog
- **THEN** the admin UI shows the upload progressing toward completion and disables the import action until it finishes

### Requirement: Stored ROM is the headerless image
The catalog SHALL store the copier-header-stripped ROM image, and the record's checksum fields SHALL match the stored bytes.

#### Scenario: Copier-headered ROM is normalized on import
- **WHEN** a ROM with a 512-byte copier header is imported
- **THEN** the stored ROM file is the stripped image and the recorded CRC32/MD5/SHA1 are the hashes of that stripped image

### Requirement: Record fields from identification
A created catalog record SHALL capture the cleaned game title, a unique slug, region, ROM size, parsed internal header, and the checksums computed during identification.

#### Scenario: Fully identified ROM
- **WHEN** a ROM matching the No-Intro DAT is imported
- **THEN** the record's title comes from the matched DAT name (region/revision suffixes stripped), region is derived from the match or internal header, and the header JSON, size, and hashes are stored

#### Scenario: Unmatched ROM still imports
- **WHEN** a ROM has no DAT match
- **THEN** the record is created from the cleaned file name (or the internal header when the name is unusable), with the CRC32-derived slug as the final fallback, and import succeeds

### Requirement: Enrichment metadata from libretro DATs
When the matched ROM has entries in the libretro enrichment DATs, the created record SHALL carry developer, publisher, genre, release year, and players; missing enrichment SHALL NOT block or fail the import.

#### Scenario: Enriched import
- **WHEN** the matched ROM has developer, publisher, genre, releaseyear, and maxusers entries in the enrichment data
- **THEN** the created record carries those values as developer, publisher, genre, release date, and players

#### Scenario: Enrichment absent
- **WHEN** the matched ROM has no enrichment entries or the enrichment data failed to load
- **THEN** the import still succeeds and the affected metadata fields are left empty

### Requirement: Duplicate ROM by checksum
When the stripped-image CRC32 of the ROM being imported matches an existing catalog record, the system SHALL NOT create a second record and SHALL offer to open the existing game.

#### Scenario: Same ROM imported twice
- **WHEN** a superuser imports a ROM whose CRC32 already exists in the catalog
- **THEN** no second record is created and the admin is offered a link to the existing game's page

### Requirement: Same title as a ROM variant
When the derived slug collides with an existing record but the CRC32 differs, the system SHALL attach the ROM to the existing game as an additional regional/revision variant instead of creating a second game.

#### Scenario: Second region of the same game
- **WHEN** a superuser imports a different regional version of a game that already exists under the same title
- **THEN** the existing game record is kept and the new ROM is stored as a non-primary variant with its own region, revision, size, and hashes

### Requirement: Admin catalog management
Administrators SHALL manage the imported catalog: view a paginated list of games, edit game metadata, replace a game's ROM file, and delete a game with its ROM variants.

#### Scenario: Edit metadata
- **WHEN** an admin changes metadata (for example title, description, genre, region) in the catalog editor and saves
- **THEN** the public catalog shows the updated values

#### Scenario: Replace ROM
- **WHEN** an admin replaces a game's ROM file with another file
- **THEN** the stored file and the record's checksum/size fields are updated to match the new file

#### Scenario: Delete game
- **WHEN** an admin deletes a game
- **THEN** the game and its ROM variant records are removed from the catalog and the game no longer appears publicly

### Requirement: Import restricted to superusers
Catalog import and management SHALL be available only to authenticated PocketBase superusers; unauthenticated visitors SHALL NOT reach any import or management function.

#### Scenario: Unauthenticated visit
- **WHEN** a visitor without a superuser session opens the admin area
- **THEN** they see the superuser sign-in screen and no import or catalog management capability
