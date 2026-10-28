# Spec Delta

## Purpose

Local-first synchronization of save states and battery saves (SRAM) per user and game, so a player can continue on another device — with last-write-wins conflicts, visible sync status, and autosave triggers that never fire for an unstarted session.

## ADDED Requirements

### Requirement: Save states sync per slot
For a signed-in user, saving a save state SHALL store it locally first and then upload it to the user's cloud slot identified by save type and game; loading SHALL prefer the local copy and fall back to the cloud on local miss.

#### Scenario: Save and load locally
- **WHEN** a signed-in user saves a state in slot 1 and loads slot 1 on the same device
- **THEN** the local copy is used

#### Scenario: Cloud cache-on-miss
- **WHEN** a signed-in user loads a slot with no local copy on a new device
- **THEN** the cloud copy for that slot and game is fetched and used

#### Scenario: Cross-device continuity
- **WHEN** a user saves a state in browser A and signs in on browser B
- **THEN** the same slot can be loaded with identical game progress

### Requirement: Battery saves sync per game
For a signed-in user, SRAM SHALL sync to a single per-user, per-game cloud record, and loading a game SHALL offer the synced battery save.

#### Scenario: Battery save round trip
- **WHEN** a user plays a game with battery-backed saves in browser A and later launches it on browser B
- **THEN** the battery save from browser A is available and loadable

### Requirement: Last-write-wins conflicts
When local and cloud copies of the same slot or battery save differ, the system SHALL resolve to the newer timestamp and the loser SHALL NOT be silently mixed into the winner.

#### Scenario: Concurrent edits on two devices
- **WHEN** the same slot was saved on device A and later on device B
- **THEN** the device-B copy (newer timestamp) wins on the next load for both devices

### Requirement: Sync status is visible
While playing a synced session, the player SHALL show a sync status with at least the states idle, syncing, synced, and error, and errors SHALL NOT interrupt gameplay.

#### Scenario: Upload failure
- **WHEN** a cloud upload fails during a session
- **THEN** the status shows error, the local save is intact, and play continues

### Requirement: Autosave on page hide and route change
The system SHALL save the current session when the page is hidden or the player route is left, and SHALL NOT save a session that was never started.

#### Scenario: Navigate away mid-game
- **WHEN** a user leaves the player route after starting the game
- **THEN** the current state and battery save are persisted (locally, and to the cloud when signed in)

#### Scenario: Never-started session
- **WHEN** the player page is left without the game ever having started
- **THEN** no save or sync occurs and no empty record is created

### Requirement: Sync requires an account
Cloud sync SHALL apply only to signed-in users; guests SHALL keep today's session-local behavior with no cloud records created.

#### Scenario: Guest session
- **WHEN** a guest plays and saves
- **THEN** saves work for the session only and no cloud records are written

### Requirement: Save states remain core-specific
Cloud save-state records SHALL record the emulator core identity they were created with, and a state SHALL only be loaded by a compatible core.

#### Scenario: Core mismatch
- **WHEN** a saved state's recorded core differs from the core running the game
- **THEN** the state is not loaded and the user is informed instead of the emulator crashing
