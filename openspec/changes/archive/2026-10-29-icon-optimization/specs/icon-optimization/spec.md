# Spec Delta

## Purpose

Serves the app's Material Symbols icons from a build-time subset containing only the glyphs actually used, cutting a multi-megabyte font download to kilobytes while keeping icons visually identical and impossible to drift out of sync.

## ADDED Requirements

### Requirement: Icons delivered as a build-time subset
The app SHALL load icon glyphs from a subset font generated at build time that contains exactly the icon names referenced in the source, with ligatures preserved so existing icon markup keeps working.

#### Scenario: Icons render from the subset
- **WHEN** any page using material icon names is loaded
- **THEN** every icon renders as the correct glyph, visually identical to the full font

### Requirement: Subset payload is bounded
The delivered icon font SHALL be at least an order of magnitude smaller than the full Material Symbols variable font, and the build SHALL NOT include the full font.

#### Scenario: Bundle check
- **WHEN** the production build output is inspected
- **THEN** the full ~4 MB icon font is absent and the subset font is present at a small fraction of that size

### Requirement: Drift protection
The pipeline SHALL detect icon references that are missing from the generated subset and fail the build/test run rather than rendering a broken ligature name.

#### Scenario: New icon added without regenerating
- **WHEN** a component references an icon name not present in the committed subset
- **THEN** the verification step fails with a message naming the missing icon

#### Scenario: Regenerate succeeds
- **WHEN** the subset regeneration script runs after the failure
- **THEN** the new icon is included and verification passes
