# Proposal

## Why

Today a play session dies with the tab: save states and battery saves (SRAM) live only in the emulator service's in-memory maps, there is no user account, and the `favorites`/`save_state`/`sram` collections exist in the schema with owner-only rules but nothing reads or writes them. Roadmap M3 (v0.4) asks for the classic streaming-app loop: sign in, favorite games, continue on another device.

## What Changes

- **User accounts** on the public client: sign-up, sign-in, sign-out UI (PocketBase `users` auth), session persisted across reloads, account menu in the header. Guests keep full browse/play access; only sync and favorites require an account.
- **Favorites**: favorite toggle on the game details page and a "My favorites" row on browse for signed-in users.
- **Cloud save sync**, local-first:
  - Save states sync per `(type, game, user)` into `save_state`; SRAM syncs per `(user, game)` into `sram`.
  - Local-first: saves land in an IndexedDB cache first; the cloud is consulted on miss (load with empty local cache pulls from the cloud).
  - Last-write-wins conflict resolution per slot using timestamps.
  - A sync status chip in the player (idle / syncing / synced / error).
  - Auto-save on page hide and on route change — but never for a session that was never started.
- The emulator boundary (`EmulatorService`) is unchanged; sync is a layer above it. No schema changes.

Sequenced after `catalog-importer` (cloud records reference catalog games). No breaking changes; guests see exactly today's behavior.

## Capabilities

### New Capabilities
- `user-accounts`: End-user sign-up, sign-in, sign-out, and session persistence on the public client, with guest browsing unaffected.
- `game-favorites`: Per-user favorites with a toggle on the details page and a personal row on browse.
- `cloud-saves`: Local-first save-state and SRAM synchronization per user and game, with last-write-wins conflicts, sync status, and safe autosave triggers.

### Modified Capabilities

(none — `openspec/specs/` is empty; there are no existing capability specs to modify)

## Impact

- New `src/features/auth/` (account UI + store mirroring the public `pb` client auth store — separate from `superflix_admin_auth`), `src/features/favorites/`, console sync layer (`src/features/console/services/`), small IDB cache utility in `src/lib/`.
- `Header` (account menu), `DetailsView` (favorite button), `BrowseView` (favorites row), `ConsoleView`/`GameWindow` (status chip, autosave triggers).
- `src/features/console/hooks/useSaveStates.ts` and SRAM flows route through the sync layer.
- Schema unchanged: `favorites`, `save_state`, `sram` already exist with owner-only rules and the needed unique indexes.
- New tests: conflict resolution, auth gating, sync retry.
