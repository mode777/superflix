# Design

## Context

See proposal.md — Why. Save states live in a `Map` inside `NostalgistEmulatorService` and SRAM in a field — both die on reload. The schema already defines `favorites` (owner-only, unique `(user, game)`), `save_state` (owner-only, unique `(type, game, user)`, 2 MB `data` file, `core`/`core_version` text fields), and `sram` (owner-only, unique `(user, game)`, 256 KB `data`). The public client `pb` (default auth store, localStorage `pocketbase_auth`) is untouched today; the admin client deliberately uses a different store key. `src/lib/persist.ts` has unused localStorage helpers; nothing uses IndexedDB yet. `useSaveStates(gameId)` wraps the service for the UI.

## Goals / Non-Goals

**Goals:**

- Sign-up/in/out on the public client with a store the header can react to, isolated from the admin session.
- Favorites toggle + row, reading/writing the existing collection.
- A sync layer **above** `EmulatorService` (contract untouched): local-first IDB cache, cloud upsert per unique index, LWW by timestamp, cache-on-miss on load.
- Autosave on `pagehide`/route-leave, gated on "session started".

**Non-Goals:**

- Real-time multi-device push (no websockets; cloud is consulted on load/save).
- Merging divergent saves (LWW only — roadmap decision).
- Sharing saves between users, save-state export UI (already exists), memory cards/BIOS (banned domain).
- Schema changes.

## Decisions

### D1: Mirror the admin auth-store pattern for the public client

`src/features/auth/` with `useAuthStore` (zustand) synced from `pb.authStore.onChange`, initialized from `pb.authStore`, plus `auth = { signUp, signIn, signOut }` helpers calling `pb.collection('users')` (`create`, `authWithPassword`, `authStore.clear`). The public client keeps its default `pocketbase_auth` localStorage key — distinct from `superflix_admin_auth`, satisfying the isolation requirement without new plumbing. Header renders an account menu from the store.

Risk noted: the PocketBase instance must have an auth `users` collection (`_pb_users_auth_`). Fresh PocketBase installs create one by default; if a deployment lacks it, `scripts/generate-schema.mjs` gains a `users` collection definition (verified at implementation time, it is schema script's job to keep the backend reproducible).

### D2: Hand-rolled IndexedDB key-value cache in `src/lib/idb.ts`

~80-line promise wrapper over `indexedDB` with one object store: keys `state:{gameId}:{slot}` and `sram:{gameId}`, values `{ blob, savedAt }`. Alternatives: localStorage — state blobs (~0.1–2 MB) overflow the ~5 MB quota and want Blob storage; `idb-keyval` dependency — trivial to avoid; rejected to keep dependencies flat.

### D3: `SaveSyncService` beside the emulator service, not inside it

`src/features/console/services/saveSync.ts`: a module aware of auth + IDB + PocketBase, exposing `saveState(gameId, slot, blob)`, `loadState(gameId, slot)`, `saveSram(gameId, blob)`, `loadSram(gameId)`, and a `syncStatus` store. `useSaveStates` and the SRAM download/upload flows call it instead of the raw service; the `EmulatorService` interface stays exactly as-is (it never knew about persistence, and the UI keeps importing only the boundary). Alternative: teach `NostalgistEmulatorService` persistence — rejected; would push auth/PocketBase concerns into the emulator boundary and break its testability.

Cloud upsert per unique index: query by filter (`type/game/user` for states, `user/game` for SRAM) → update `data` file + `updated` if found, else create. No delete-on-recreate races.

### D4: LWW by `savedAt` vs cloud `updated`

On load: local hit → use local **after** a cheap staleness check is skipped (cloud only consulted on local miss — roadmap's "cache-on-miss", avoids a per-load round trip). On save: write local, then upsert cloud with the save timestamp; if the cloud record's `updated` is somehow newer than the local `savedAt` (concurrent device), last write wins at upsert time and the older device's next cache-on-miss load pulls the newer copy. Slot-level granularity, never mixing blobs.

### D5: Session-started gate and autosave triggers

A `started` flag flips the first time runtime status reaches `playing`. Triggers: `pagehide` + `visibilitychange → hidden` (registered while ConsoleView is mounted) and a ConsoleView unmount effect (route change). Both check `started` and skip otherwise (never-started session requirement). The pending save is fire-and-forget with `keepalive`-style best effort — `pagehide` cannot await uploads; the IDB write is synchronous-enough (transaction queued) and a sync retry runs on next launch if the cloud push failed (status persisted in IDB as `pendingSync` flags).

### D6: Favorites hook + row

`src/features/favorites/useFavorites.ts`: react-query for the user's favorites (`filter = user.id`), `toggle(gameId)` mutating the collection (query-then-create/delete for idempotency, the unique index backstops it). `DetailsView` gets the toggle (sign-in prompt for guests); `BrowseView` renders the favorites row above the genre grid when authenticated.

## Risks / Trade-offs

- [`pagehide` can't complete a network upload] → local write always lands first; cloud push retries next launch via persisted pending flags; acceptable for this product.
- [Two devices genuinely diverge] → LWW loses the older branch — explicit roadmap decision; surfaced by timestamps, not merge UI.
- [`users` collection missing on an existing deployment] → D1 verification + schema-script ownership; migration is additive.
- [Token expiry mid-session] → SDK refreshes; on hard 401 the chip shows error and the session stays locally playable.

## Migration Plan

Frontend-only, additive; guest behavior identical to today. Rollback = revert. Cloud records use existing collections — no backend migration.

## Open Questions

- None blocking. Exact chip placement/wording is a UI detail; a follow-up could add an "export/import cloud save" affordance without touching these requirements.
