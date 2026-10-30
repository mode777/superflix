# game-favorites Specification

## Purpose

Personal, per-user favorites: a one-tap toggle on the game details page and a "My favorites" row on browse, backed by owner-only records so no user ever sees another user's favorites.

## Requirements

### Requirement: Favorite toggle
Signed-in users SHALL be able to favorite and un favorite a game from its details page, with the current state visible before acting.

#### Scenario: Favorite a game
- **WHEN** a signed-in user activates the favorite toggle on a game they have not favorited
- **THEN** the game is favorited and the toggle reflects the favorited state

#### Scenario: Un-favorite a game
- **WHEN** a signed-in user activates the favorite toggle on a favorited game
- **THEN** the favorite is removed and the toggle reflects the un-favorited state

### Requirement: Favorites require an account
The favorite toggle SHALL be unavailable to guests except as a sign-in prompt; favorites SHALL only exist for signed-in users.

#### Scenario: Guest activates favorite
- **WHEN** a guest activates the favorite toggle
- **THEN** a sign-in prompt appears and no favorite is created

### Requirement: My favorites row on browse
Signed-in users SHALL see a "My favorites" row on the browse page listing their favorited games; guests do not see the row.

#### Scenario: Signed-in browse
- **WHEN** a signed-in user with favorites opens browse
- **THEN** a favorites row shows those games and links to their detail pages

#### Scenario: Signed-in with no favorites
- **WHEN** a signed-in user without favorites opens browse
- **THEN** the favorites row is absent or shows an explanatory empty state

### Requirement: Favorites are private
Favorite records SHALL be visible and modifiable only by their owner.

#### Scenario: Owner-only access
- **WHEN** any request other than the owner's own session attempts to read or modify favorites
- **THEN** the request is rejected by the backend rules

### Requirement: Favoriting is idempotent per game
Favoriting the same game twice SHALL NOT create duplicate favorite records.

#### Scenario: Double favorite
- **WHEN** a user favorites a game that is already favorited
- **THEN** exactly one favorite record exists for that user and game
