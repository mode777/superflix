# Tasks

## 1. User accounts

- [x] 1.1 Create `src/features/auth/` (zustand store mirroring `pb.authStore`, `signUp`/`signIn`/`signOut` helpers on the `users` collection) and verify unit tests cover sign-in success/failure and session persistence across store re-initialization
- [x] 1.2 Verify the PocketBase instance has the auth `users` collection; if absent, add it to `scripts/generate-schema.mjs`, regenerate (`npm run pb:schema`), and confirm the migration applies cleanly on a fresh `npm run pb:serve`
- [x] 1.3 Add sign-in/sign-up/sign-out UI (header account menu + auth form) and verify manually: sign up → reload stays signed in → sign out; guest browse/play unaffected; admin session in the same browser unaffected

## 2. Favorites

- [x] 2.1 Implement `useFavorites` (list by user, idempotent toggle via query-then-create/delete) and verify unit tests cover toggle on/off, double-toggle idempotency, and guest prompt path
- [x] 2.2 Add the favorite toggle to `DetailsView` (sign-in prompt for guests) and the "My favorites" row to `BrowseView` for signed-in users; verify against local PocketBase that a favorited game appears in the row and is private to the user

## 3. Local-first storage

- [x] 3.3 Implement the IndexedDB cache (`src/lib/idb.ts`: `state:{gameId}:{slot}` / `sram:{gameId}` → `{ blob, savedAt }`, plus `pendingSync` flags) and verify unit tests (jsdom/fake-indexeddb) cover put/get/overwrite and pending-flag persistence

## 4. Sync layer

- [x] 4.1 Implement `SaveSyncService` (save/load state per slot, save/load SRAM, cloud upsert via filter-then-update/create, LWW by `savedAt` vs cloud `updated`) and verify unit tests: same-device save/load, cache-on-miss from cloud, newer-cloud-wins, and core identity recorded (`core`/`core_version`) with mismatched states refused
- [x] 4.2 Route `useSaveStates` and the SRAM flows through the sync layer with the `started` gate (first `playing` status) and verify a never-started session creates no records
- [x] 4.3 Add the sync status chip (idle/syncing/synced/error) to `GameWindow`; verify a mocked upload failure shows error, keeps the local save, and does not interrupt play; verify a retry succeeds on next action

## 5. Autosave triggers

- [x] 5.1 Implement `pagehide` + `visibilitychange` listeners and the route-leave effect (local write always, cloud push when signed in, persisted pending flag when the push can't finish) and verify: navigate away mid-game saves; leaving before start saves nothing; a killed push syncs on next launch

## 6. Gates

- [x] 6.1 Run the full gate: `npm run typecheck && npm run lint && npm test` green; manual M3 acceptance — save in browser A, sign in on browser B, load the same slot and battery save
