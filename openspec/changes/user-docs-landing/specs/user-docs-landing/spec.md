# Spec Delta

## Purpose

Gives self-hosters and players complete, runnable user documentation (hosting, importing, metadata, controllers) and gives first-time visitors a landing experience with license-safe screenshots — so Superflix is understandable without reading the source.

## ADDED Requirements

### Requirement: Hosting guide
The docs SHALL include a hosting guide covering backend requirements, deployment options, environment variables, and persistent data locations, with every command runnable as written.

#### Scenario: New self-hoster succeeds
- **WHEN** a reader follows the hosting guide from a clean machine
- **THEN** they reach a working Superflix instance and the guide's commands all execute as documented

### Requirement: Importing guide
The docs SHALL include an importing guide covering superuser sign-in, ROM identification, adding games to the catalog, and duplicate/variant handling.

#### Scenario: First import walkthrough
- **WHEN** a reader follows the importing guide
- **THEN** they can import their first ROM and understand what happens on duplicates and second regions

### Requirement: Metadata guide with attribution
The docs SHALL include a metadata guide naming every metadata and artwork source, their licenses, and the provenance fields recorded per game.

#### Scenario: Source and license listed
- **WHEN** a reader opens the metadata guide
- **THEN** No-Intro, libretro-database (CC-BY-SA-4.0), and libretro-thumbnails are identified with their licensing and the app's provenance fields are explained

### Requirement: Controller guide
The docs SHALL include a playing guide covering keyboard controls, gamepad pairing, save states, battery saves, and the CRT overlay.

#### Scenario: Player without a gamepad
- **WHEN** a reader opens the controller guide
- **THEN** default keyboard bindings for the player are listed and gamepad pairing is described

### Requirement: Landing experience with safe screenshots
First-time visitors SHALL see a landing that explains what Superflix is, shows screenshots of the real UI, and routes to browse and the docs; every screenshot SHALL depict only the app running the bundled MIT-licensed demo ROM.

#### Scenario: First visit
- **WHEN** a visitor opens the site root
- **THEN** they can tell what the product is within one screen and reach the catalog and the documentation in one click each

#### Scenario: License-safe imagery
- **WHEN** any landing or docs screenshot is inspected
- **THEN** it contains no commercial game footage, box art, or other copyrighted content

### Requirement: Documentation discoverable
The README SHALL index the user docs and the app SHALL link to them from the landing.

#### Scenario: Discovery path
- **WHEN** a reader starts at the README or the landing page
- **THEN** they can reach every user guide in at most two clicks
