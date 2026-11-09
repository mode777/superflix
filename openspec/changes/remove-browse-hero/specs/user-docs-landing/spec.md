# Spec Delta

## MODIFIED Requirements

### Requirement: Documentation discoverable

The README SHALL index the user docs, and every user guide SHALL be reachable
from that index in at most two clicks. The app is not required to link to the
user docs.

#### Scenario: Discovery path

- **WHEN** a reader starts at the README
- **THEN** they can reach every user guide in at most two clicks

## REMOVED Requirements

### Requirement: Landing experience with safe screenshots

**Reason**: The browse route is catalog-first: the marketing/landing hero
(headline, product copy, screenshot collage, and CTAs) was removed so the game
shelf appears immediately. There is no landing surface left to carry the
product statement, screenshots, or one-click routes.

**Migration**: None required at runtime. The README provides the product
overview and docs index, and visitors reach the catalog by loading the site
root. Any documentation screenshots already in `docs/assets/` remain valid
license-safe demo-ROM captures.
