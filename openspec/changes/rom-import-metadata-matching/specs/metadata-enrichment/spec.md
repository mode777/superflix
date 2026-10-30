# Spec Delta

## MODIFIED Requirements

### Requirement: Checksum-first game resolution
The system SHALL resolve a catalog game to a dataset record by its stored CRC32 checksum against the dataset's checksum index before attempting any title-based lookup, and SHALL NOT modify any record when neither lookup matches. Title-based lookup SHALL compare the game's cleaned title against the title index's entry titles using the same normalization on both sides (leading-article move, accent folding, case and punctuation collapse), so the published title index's display titles match regardless of formatting differences.

#### Scenario: Exact checksum match
- **WHEN** a game's CRC32 exists in the dataset checksum index
- **THEN** the system resolves the game to its dataset record without performing a title lookup

#### Scenario: Checksum miss falls back to title
- **WHEN** a game's CRC32 is absent from the checksum index but its cleaned title matches a title index entry under the shared normalization
- **THEN** the system resolves the game to that entry's dataset record

#### Scenario: Formatting differences still match
- **WHEN** the game's title differs from a title index entry only in case, punctuation, accents, or a leading article ("Combatribes, The" vs "The Combatribes")
- **THEN** the title lookup still resolves the game to that entry's dataset record

#### Scenario: No dataset entry
- **WHEN** neither the checksum index nor the title index resolves the game
- **THEN** the system skips enrichment and leaves the record unchanged without reporting an error

### Requirement: Dataset artwork is stored locally
When a resolved dataset record provides local box art or a screenshot, the system SHALL download, downscale, and store them as the record's cover image and screenshots in PocketBase, and SHALL fall back to the complementary artwork provider for images the dataset does not provide. The cover image SHALL be the dataset record's big box art whenever the record provides one; the small thumbnail SHALL NOT be used as the cover while a big box is available, and SHALL only be used when neither the dataset box art nor the complementary provider yields a cover.

#### Scenario: Box art and screenshot stored
- **WHEN** the dataset record provides box art and a screenshot
- **THEN** the system stores a downscaled cover image and at least one screenshot on the record, served from PocketBase

#### Scenario: Big box preferred over thumbnail
- **WHEN** the dataset record provides both a big box image and a small thumbnail
- **THEN** the cover is stored from the big box image, not the thumbnail

#### Scenario: Thumbnail only as last resort
- **WHEN** the dataset record provides only a small thumbnail and the complementary provider yields no box art
- **THEN** the cover is stored from the thumbnail

#### Scenario: Artwork gap falls back
- **WHEN** the dataset record has no screenshot
- **THEN** the system attempts the complementary provider for screenshots before giving up

## ADDED Requirements

### Requirement: Manual dataset match when automatic resolution fails
When enrichment cannot resolve a game by checksum or by title during an import, the admin interface SHALL offer a manual match after the import completes: a modal window listing the dataset title index entries with a quick text filter, from which the admin selects the entry the ROM corresponds to. The import itself SHALL already have succeeded before the modal is offered, and dismissing the modal SHALL leave the record unchanged.

#### Scenario: Modal offered after an unresolved import
- **WHEN** an imported ROM resolves neither by checksum nor by title
- **THEN** the import completes and a modal window opens listing dataset title index entries

#### Scenario: Quick filter narrows the list
- **WHEN** the admin types into the modal's filter field
- **THEN** the entry list narrows case-insensitively to entries whose title contains the typed text

#### Scenario: Manual match enriches the record
- **WHEN** the admin selects an entry in the modal
- **THEN** the record is enriched from that entry's dataset record — metadata fields, cover, and screenshots — and the chosen entry is recorded in the record's provenance

#### Scenario: Modal dismissed without a choice
- **WHEN** the admin closes the modal without selecting an entry
- **THEN** the record is left as imported, with no enrichment applied

### Requirement: Manual match from the catalog editor
The catalog editor SHALL offer the same searchable dataset match picker for already-stored records alongside the dataset sync action, and applying a manual match SHALL follow the same enrichment rules as automatic enrichment, including the manual cover override and enrichment provenance.

#### Scenario: Editor match on an existing record
- **WHEN** an admin opens the match picker for a stored game and selects a dataset entry
- **THEN** the record is enriched from that entry and the outcome is reported without leaving the editor

#### Scenario: Manual cover preserved
- **WHEN** a manual match runs on a record whose cover was uploaded manually
- **THEN** the manual cover remains and only the other fields and images are updated

#### Scenario: Editor picker finds nothing applicable
- **WHEN** an admin dismisses the editor's match picker without selecting an entry
- **THEN** the record is left unchanged
