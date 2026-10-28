# Design

## Context

See proposal.md — Why. Current state (verified by survey): global `:focus-visible` outline exists in `src/styles/index.css`; `aria-label`/`aria-pressed`/`role="status"`/`role="alert"` are used in Header, SearchBar, GenreChips, Toaster, SignInView, CoverArt; `<html lang="en">` set. Gaps: no `prefers-reduced-motion` handling anywhere; no dialog primitive or focus trap (Toaster and GameWindow overlays are not modals, but confirm-style UI and the admin error paths are heading that way); the dropzone relies on drag or a click-through file input; ScreenshotCarousel has no keyboard controls; canvas has aria-label but runtime status is not announced as a live region. Tests are Vitest + RTL; an e2e suite is planned under the `e2e-suite` change.

## Goals / Non-Goals

**Goals:**

- One theme-level reduced-motion switch covering all decorative animation.
- A tiny dialog primitive (focus trap + Escape + focus restore) reusable by current and future UIs.
- Close keyboard/label gaps found by an audit, verified by automated checks.
- Use existing theme tokens for any new focus styling.

**Non-Goals:**

- Full WCAG 2.2 AA audit sign-off or a redesign; remapping emulator input keys (RetroArch owns game keys).
- Audio descriptions/captions (no audio UI exists).
- Third-party focus-trap libraries unless the hand-rolled one proves insufficient.

## Decisions

### D1: Reduced motion as one CSS media query, not per-component checks

Add `@media (prefers-reduced-motion: reduce)` to `src/styles/index.css` that neutralizes the keyframe animations (skeleton shimmer, toast slide, ambient drift) and shortens transitions to near-zero. Components keep their classes; no JS media-query plumbing. Alternative: JS `matchMedia` gating per component — rejected: scattering a global concern across components invites drift.

### D2: Hand-rolled dialog primitive in `src/components/Dialog.tsx`

~60 lines: renders an overlay + `role="dialog"` `aria-modal`, traps Tab within, closes on Escape, restores focus to `document.activeElement` at open time. The native `<dialog>` element provides most of this (`showModal`, `::backdrop`) — use it where browser support suffices (Chromium/evergreen targets are fine) and keep the wrapper thin. Applies to: any confirm prompt introduced with M1–M3 flows (e.g. delete confirmations in the admin catalog list) and the existing SRAM dropdown if it becomes modal. Alternative: `focus-trap` npm package — rejected for one primitive; revisit if more complex popovers appear.

### D3: Keyboard paths for pointer-first affordances

- `RomDropzone`: make the hidden file input a real focusable button pattern (visible "Choose ROM file" button alongside drag-drop; Enter/Space opens the picker — mostly wiring the existing input correctly).
- `ScreenshotCarousel`: add prev/next buttons (icon buttons with aria-labels, also fixing touch users) rather than scroll-only.
- Volume slider is a native `<input type="range">` — verify step/label; nothing new needed.

### D4: Runtime status as a polite live region

The status chip in `GameWindow` gets `aria-live="polite"` on its text (state word: loading/playing/paused/error). Canvas already has an aria-label; keep it updated with the game title. Avoid `role="alert"` for routine transitions (chatty); reserve alert for errors.

### D5: Automated checks with axe in the e2e suite, not Vitest

`@axe-core/playwright` scans the real rendered routes (browse, details, admin sign-in, player) in the planned e2e harness — one place, real DOM, no jsdom gaps (axe needs layout). If `e2e-suite` hasn't landed yet, this change adds a minimal Playwright config itself; either way the dependency and scans live with e2e. Alternative: `vitest-axe` in jsdom — rejected: jsdom lacks layout/styling, producing misleading passes.

## Risks / Trade-offs

- [Native `<dialog>` styling vs theme] → style `::backdrop` and panel with theme tokens; worst case fall back to the hand-rolled overlay.
- [Emulator key conflicts (game keys vs Tab navigation)] → trap only applies inside dialogs; the player page keeps normal tab order, and RetroArch consumes game keys only when the canvas/emulator is active — verified by keyboard test.
- [axe in CI adds runtime] → four route scans, seconds not minutes.

## Migration Plan

Additive UI behavior; no API or schema changes. Rollback = revert.

## Open Questions

- None blocking. The exact set of UIs that become modal dialogs depends on M1–M3 implementation choices; the primitive covers whichever appear.
