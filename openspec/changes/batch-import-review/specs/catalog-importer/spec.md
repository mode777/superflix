# Spec Delta

## MODIFIED Requirements

### Requirement: Add to catalog action
The admin importer SHALL offer an "Add to catalog" action for each staged, identified game draft and a batch action that adds all ready drafts in one go. Committing a draft SHALL persist it as reviewed — edited metadata taking precedence over fetched values — and, on success, link to the new game's public detail page. A failure committing one draft SHALL NOT abort the rest of the batch.

#### Scenario: Successful import
- **WHEN** an admin activates "Add to catalog" on a staged draft
- **THEN** the catalog record is created from the draft as reviewed (including artwork) and confirmed with a link to the imported game's detail page

#### Scenario: Batch add
- **WHEN** an admin activates the batch add action with several ready drafts
- **THEN** every ready draft is committed, each receiving its own success, duplicate, variant, or failure outcome, and a summary reports the results

#### Scenario: Import failure is reported
- **WHEN** the catalog write for one draft fails (for example the backend is unreachable or rejects the request)
- **THEN** that draft shows an error and stays on screen so the admin can retry, and the remaining drafts of the batch continue to commit

### Requirement: Upload with progress
During a commit the importer SHALL report real progress derived from the multipart uploads themselves, not an indeterminate indicator: a per-game progress indicator for the draft currently uploading, and a total progress indicator across the whole batch that advances as games complete and tracks the upload currently running.

#### Scenario: Large ROM upload
- **WHEN** a multi-megabyte ROM of one draft is being uploaded to the catalog
- **THEN** that draft shows its upload progressing toward completion and its import action is disabled until it finishes

#### Scenario: Total batch progress
- **WHEN** a batch of several games is being committed
- **THEN** the total indicator reflects the completed games plus the share of the upload currently running until every game is done

## ADDED Requirements

### Requirement: Multi-file ROM selection
The importer SHALL accept any number of ROM files in one selection — dragged together or chosen in the file picker — and SHALL turn each ROM file into its own queue entry, while ignoring non-ROM files in the selection.

#### Scenario: Several ROMs picked at once
- **WHEN** an admin drops or selects multiple ROM files
- **THEN** the queue contains one entry per ROM file

#### Scenario: Non-ROM files ignored
- **WHEN** a selection mixes ROM files with other files (for example images or text files)
- **THEN** the non-ROM files are ignored and produce no entry and no error

#### Scenario: Single ROM still imports
- **WHEN** exactly one ROM file is picked
- **THEN** it becomes a queue of one and flows through the same staging, review, and commit steps

### Requirement: Folder import with recursive scan
The importer SHALL offer a folder picker whose selection is scanned recursively, and SHALL scan folders dropped onto the dropzone recursively as well, turning every ROM file found in the folder tree into a queue entry. The scan SHALL report how many games were found.

#### Scenario: Nested subfolders are scanned
- **WHEN** an admin opens a folder whose ROMs are organized in nested subfolders
- **THEN** every ROM file in the whole folder tree becomes a queue entry

#### Scenario: Folder dropped on the dropzone
- **WHEN** an admin drops a folder onto the dropzone
- **THEN** the folder tree is scanned recursively and its ROM files become queue entries

#### Scenario: Scan report
- **WHEN** a folder scan finishes
- **THEN** the importer reports the number of games found and ignores the non-ROM files it encountered

### Requirement: Staged identification queue
Every staged ROM SHALL be identified in the browser — copier header stripped, CRC32/MD5/SHA1 computed, internal header parsed, and the No-Intro index consulted — without further attention, and each entry SHALL show its status (pending, identifying, ready, or failed) together with an overall scan progress. An entry that fails to identify SHALL be marked failed without aborting the identification of the remaining entries.

#### Scenario: Entry identified
- **WHEN** a queued ROM's identification completes
- **THEN** the entry is marked ready and shows its title, checksums, header details, and DAT match

#### Scenario: Identification failure is isolated
- **WHEN** one queued ROM cannot be identified (for example a corrupt or unreadable file)
- **THEN** that entry is marked failed with the reason while the remaining entries continue to identify

#### Scenario: Scan progress
- **WHEN** a large queue is being identified
- **THEN** the importer shows how many entries are done out of the total

### Requirement: Metadata review and editing before commit
For each ready entry the importer SHALL fetch the dataset's metadata, boxart cover, and screenshots and present them as an editable draft before any record is created. The admin SHALL be able to edit the draft's metadata fields, manually re-match the draft to a different dataset entry, or remove the entry, and nothing SHALL be written to the catalog until the admin commits.

#### Scenario: Draft shows fetched data
- **WHEN** a ready entry's dataset preview resolves
- **THEN** the draft displays the fetched metadata, cover, and screenshots while the catalog is still unchanged

#### Scenario: Edited fields are committed
- **WHEN** an admin edits a draft's metadata and commits it
- **THEN** the created record carries the edited values

#### Scenario: Manual re-match before commit
- **WHEN** an admin re-matches a draft to another dataset entry
- **THEN** the draft re-fetches its metadata and artwork from the chosen entry

#### Scenario: Entry removed before commit
- **WHEN** an admin removes an entry from the queue
- **THEN** no record is created for that ROM and it disappears from the batch

#### Scenario: Preview failure does not block import
- **WHEN** the dataset preview for a ready entry cannot be fetched
- **THEN** the entry remains importable with its identification-only values and the importer reports that metadata could not be fetched

### Requirement: Duplicates within a batch
At commit time each draft SHALL be checked against the catalog and against its own batch: a ROM whose stripped-image CRC32 already exists in the catalog or elsewhere in the batch SHALL NOT produce a second record, and a draft whose slug collides with an existing record but whose CRC32 differs SHALL be attached to that record as an additional variant.

#### Scenario: ROM already in the catalog
- **WHEN** a batch draft's CRC32 matches an existing catalog record
- **THEN** no second record is created, the draft is reported as a duplicate, and the admin is offered a link to the existing game

#### Scenario: Same ROM twice in one batch
- **WHEN** a scanned folder contains the same ROM more than once
- **THEN** committing the batch creates a single record and reports the other occurrences as duplicates

#### Scenario: Variant within a batch
- **WHEN** a batch draft's slug matches an existing record but its CRC32 differs
- **THEN** the ROM is stored as a non-primary variant of that record
