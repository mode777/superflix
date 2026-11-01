# Spec Delta

## MODIFIED Requirements

### Requirement: Import-time enrichment
When a staged import resolves a dataset record, the system SHALL populate the staged draft's description, genre, developer, publisher, players, and region-appropriate release date from the dataset before the record is created, and SHALL leave any field empty in the dataset at the value produced by identification. Values the admin edited on the draft SHALL take precedence over the dataset's values in the committed record.

#### Scenario: Fully covered game
- **WHEN** a staged ROM with a resolvable dataset record is reviewed and committed
- **THEN** the created record carries the dataset's metadata fields and a release date matching the ROM's region when the dataset provides one

#### Scenario: Partially covered game
- **WHEN** the dataset record lacks a description
- **THEN** the draft's description remains empty rather than filled with placeholder or unrelated text

#### Scenario: Edited values win
- **WHEN** an admin edits a populated draft field and commits the game
- **THEN** the record carries the edited value instead of the dataset's value for that field

## ADDED Requirements

### Requirement: Dataset artwork preview before commit
The system SHALL fetch the resolved dataset record's cover and screenshot images for a staged draft and show them before the record exists, holding them locally and storing them on the record only when the draft is committed. Preview fetching SHALL NOT create or modify any catalog record, and a preview failure SHALL NOT prevent committing the draft.

#### Scenario: Artwork previewed before any record exists
- **WHEN** a staged draft's dataset record provides box art and screenshots
- **THEN** the draft shows them while the catalog still has no record for the game

#### Scenario: Previewed artwork stored at commit
- **WHEN** a draft with previewed artwork is committed
- **THEN** the created record carries that cover and those screenshots as catalog-hosted files, subject to the manual-override and screenshot-cap rules

#### Scenario: Preview failure does not block commit
- **WHEN** the artwork preview cannot be fetched for a staged draft
- **THEN** the draft stays committable with identification-only values and no catalog record is created or modified by the failed preview
