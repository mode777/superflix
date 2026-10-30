# metadata-artwork Specification

## Purpose

Gives imported catalog records artwork and verifiable metadata provenance using free libretro sources, with PocketBase-cached images, graceful degradation, and admin override — no external API keys.

## Requirements

### Requirement: Artwork matched by exact No-Intro name
During import, the system SHALL look up artwork in libretro-thumbnails using the matched No-Intro DAT name exactly, requesting boxart, in-game snap, and title screen images.

#### Scenario: Exact match found
- **WHEN** a ROM whose No-Intro name has boxart, snap, and title images on libretro-thumbnails is imported
- **THEN** the system retrieves all three by the exact name and associates them with the record

#### Scenario: No exact match
- **WHEN** the matched No-Intro name has no corresponding image in a given category
- **THEN** that category contributes no image and the import continues

### Requirement: Images stored in the catalog, never hotlinked
Artwork displayed in the UI SHALL be served from files stored on the catalog backend; the browse and details pages SHALL NOT reference external image URLs.

#### Scenario: Imported game with artwork
- **WHEN** a game with scraped artwork is viewed in the catalog
- **THEN** its cover and screenshots are loaded from catalog-hosted files

### Requirement: Screenshot cap and derivatives
The system SHALL store at most 5 screenshots per game, prioritizing the title screen and snap, and SHALL store downscaled catalog-quality derivatives rather than full-resolution source images.

#### Scenario: More than five images available
- **WHEN** scraping yields more than five usable screenshots
- **THEN** only five are stored, and each stored image is a downscaled derivative within the backend's size limit

### Requirement: Artwork failures never block import
Any artwork retrieval or processing failure SHALL NOT fail or block the catalog import; the affected game renders with the standard gradient placeholder for missing images.

#### Scenario: Artwork source unreachable
- **WHEN** the artwork host is unreachable or a request is blocked during import
- **THEN** the import completes with metadata only and the game shows placeholder covers in the catalog

#### Scenario: Broken image at render time
- **WHEN** a stored image fails to load in the browser
- **THEN** the UI falls back to the gradient placeholder for that image slot

### Requirement: Manual override in the admin editor
Administrators SHALL be able to replace a game's title, description, and cover image in the catalog editor, and a manually chosen cover SHALL NOT be overwritten by a later artwork refresh.

#### Scenario: Admin replaces the cover
- **WHEN** an admin uploads a replacement cover image and saves
- **THEN** the catalog shows the manual cover and the record's provenance reflects a manual source

#### Scenario: Refresh after manual override
- **WHEN** artwork is refreshed for a game whose cover was manually set
- **THEN** the manual cover is kept and only non-overridden fields are updated

### Requirement: Metadata provenance recorded
When artwork is scraped, the record SHALL carry the source identifier, the matched metadata id, and the scrape timestamp; when the admin manually overrides, the provenance SHALL reflect the manual source.

#### Scenario: Scraped record
- **WHEN** artwork is fetched from libretro-thumbnails for an imported game
- **THEN** the record stores the provider name as source, the No-Intro name as metadata id, and the scrape timestamp

### Requirement: Attribution for metadata and artwork sources
The system SHALL attribute the libretro-database (CC-BY-SA-4.0) and the copyright holders of thumbnail artwork, both in the repository's attribution file and in an in-app attribution panel.

#### Scenario: Attribution visible
- **WHEN** a user opens the attribution panel
- **THEN** it names the metadata and artwork sources, their licenses, and links to them

### Requirement: Provider adapter for artwork sources
Artwork retrieval SHALL go through a provider interface so additional metadata sources can be added without changing the import flow; only the libretro provider SHALL be implemented, and no provider SHALL require an API key.

#### Scenario: Provider contract
- **WHEN** the import flow needs artwork for a game
- **THEN** it requests it from the configured provider by matched name and receives the provider's results or an empty result, never a hard failure
