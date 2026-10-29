# Spec Delta

## Purpose

Enriches catalog game records with metadata and artwork from an external static dataset (snes-dataset), automatically at import time and on demand for existing entries, so imported games get descriptions, box art, and screenshots without manual editing.

## ADDED Requirements

### Requirement: Checksum-first game resolution
The system SHALL resolve a catalog game to a dataset record by its stored CRC32 checksum against the dataset's checksum index before attempting any title-based lookup, and SHALL NOT modify any record when neither lookup matches.

#### Scenario: Exact checksum match
- **WHEN** a game's CRC32 exists in the dataset checksum index
- **THEN** the system resolves the game to its dataset record without performing a title lookup

#### Scenario: Checksum miss falls back to title
- **WHEN** a game's CRC32 is absent from the checksum index but its normalized title resolves in the dataset title index
- **THEN** the system resolves the game via the title index

#### Scenario: No dataset entry
- **WHEN** neither the checksum index nor the title index resolves the game
- **THEN** the system skips enrichment and leaves the record unchanged without reporting an error

### Requirement: Import-time enrichment
When a ROM is added to the catalog and a dataset record resolves, the system SHALL populate the new record's description, genre, developer, publisher, players, and region-appropriate release date from the dataset, and SHALL leave any field empty in the dataset at the value produced by identification.

#### Scenario: Fully covered game
- **WHEN** a ROM with a resolvable dataset record is added to the catalog
- **THEN** the created record carries the dataset's metadata fields and a release date matching the ROM's region when the dataset provides one

#### Scenario: Partially covered game
- **WHEN** the dataset record lacks a description
- **THEN** the record's description remains empty rather than filled with placeholder or unrelated text

### Requirement: Dataset artwork is stored locally
When a resolved dataset record provides local box art or a screenshot, the system SHALL download, downscale, and store them as the record's cover image and screenshots in PocketBase, and SHALL fall back to the complementary artwork provider for images the dataset does not provide.

#### Scenario: Box art and screenshot stored
- **WHEN** the dataset record provides box art and a screenshot
- **THEN** the system stores a downscaled cover image and at least one screenshot on the record, served from PocketBase

#### Scenario: Artwork gap falls back
- **WHEN** the dataset record has no screenshot
- **THEN** the system attempts the complementary provider for screenshots before giving up

### Requirement: Admin-triggered sync for existing entries
The admin catalog editor SHALL provide an action that re-runs enrichment against an already-stored record, resolving it by its stored CRC32 checksum and updating its metadata fields and images, and SHALL report the outcome without leaving the editor.

#### Scenario: Sync updates an existing record
- **WHEN** an admin invokes the sync action on a stored game that resolves in the dataset
- **THEN** the record's metadata fields and images are updated and a success outcome naming what was enriched is shown

#### Scenario: Sync finds nothing
- **WHEN** the sync action cannot resolve the game in the dataset
- **THEN** an informational outcome is shown and the record is left unchanged

### Requirement: Manual cover override is preserved
When a record's cover image was uploaded manually, enrichment SHALL update its other fields and images but SHALL NOT replace the manual cover.

#### Scenario: Manual cover kept during sync
- **WHEN** enrichment or sync runs on a record whose cover was uploaded manually
- **THEN** the manual cover remains and provenance continues to record the manual override

### Requirement: Enrichment provenance is recorded
When enrichment writes metadata or images to a record, the system SHALL record the enrichment source, the dataset identifier it resolved to, and the time of enrichment in the record's provenance fields.

#### Scenario: Provenance written on success
- **WHEN** a record is enriched from the dataset
- **THEN** its provenance fields name the dataset source, the resolved dataset identifier, and the enrichment timestamp

### Requirement: Enrichment never blocks catalog writes
Enrichment failures (network errors, unreachable hosts, undecodable images) SHALL NOT fail the import or the sync action, and the admin SHALL be shown which parts were enriched and which were not.

#### Scenario: Dataset unreachable during import
- **WHEN** the dataset cannot be reached while a ROM is being added
- **THEN** the import completes with the identification-only record and the admin is told enrichment did not happen

#### Scenario: Partial enrichment reported
- **WHEN** enrichment resolves metadata but no artwork
- **THEN** the outcome reports the metadata as enriched and the artwork as missing rather than reporting overall success or overall failure

### Requirement: Dataset attribution is visible
The attribution information shown with game details SHALL credit the dataset and the upstream sources it compiles, including the image copyright caveat.

#### Scenario: Attribution panel lists the dataset
- **WHEN** a visitor views a game that was enriched from the dataset
- **THEN** the attribution panel credits the dataset and its upstream metadata and image sources
