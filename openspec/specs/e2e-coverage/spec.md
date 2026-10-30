# e2e-coverage Specification

## Purpose

A Playwright end-to-end suite that guards the core product journey — browse, details, playing the bundled demo ROM, and save/load — on every change, locally and in CI, without external services.

## Requirements

### Requirement: Golden-path journey covered
The e2e suite SHALL cover browse → details → play the bundled demo ROM → save state → load state as one continuous journey.

#### Scenario: Journey passes
- **WHEN** the suite runs against a built app with the core and demo ROM present
- **THEN** the catalog renders, a game opens on the details page, the player boots and reaches playing state, a state saves into a slot, and loading that slot resumes play without error

### Requirement: Catalog interactions covered
The suite SHALL cover genre filtering and search on the browse page and metadata rendering on the details page.

#### Scenario: Filter and search
- **WHEN** the suite selects a genre and types a search term
- **THEN** the grid reflects the filtered results and the empty state appears for no matches

### Requirement: Suite runs without external services
The e2e suite SHALL run against the app in mock data-source mode with locally present core binaries, requiring no PocketBase instance and no internet access during the run.

#### Scenario: Offline run
- **WHEN** the suite is executed after prerequisites (core + demo ROM) are fetched
- **THEN** all scenarios pass with no network dependency beyond the local test server

### Requirement: Player state verification
The suite SHALL verify the emulator reaches playing state and that save/load round-trips preserve a usable session.

#### Scenario: Save then load
- **WHEN** the suite saves a state after play begins and loads the same slot
- **THEN** the player returns to playing state without an error overlay

### Requirement: Runnable locally and in CI
The suite SHALL be runnable with a single npm script locally and as a CI job, with traces/screenshots captured on failure.

#### Scenario: CI failure debugging
- **WHEN** a scenario fails in CI
- **THEN** the run uploads trace and screenshot artifacts sufficient to diagnose the failure
