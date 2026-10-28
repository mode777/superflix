# Proposal

## Why

The app has good a11y seeds (global `:focus-visible`, aria-labels on icon buttons, `role="status"` toasts) but the roadmap's cross-cutting pass is open: nothing honors `prefers-reduced-motion` (skeleton shimmers, toast slides, ambient background keep animating), there is no focus-trap or escape handling for modal-style UI, and keyboard users hit gaps in the dropzone/carousel/controls. An emulator player is a keyboard-first product — this pass makes it usable without a pointer and comfortable for motion-sensitive users.

## What Changes

- **Reduced motion**: honor `prefers-reduced-motion` across all decorative animation (skeleton shimmer, toast slide-in, ambient background drift, any transition) via a theme-level media query — no behavior loss, just stillness.
- **Keyboard operability**: every interactive control reachable and usable by keyboard in a logical order — file dropzone/pickers, save-slot controls, SRAM dropdown actions, carousel, volume, search, chips (mostly present; audit and fix gaps).
- **Dialog semantics**: when modal UI exists (sign-in error recovery, confirm-style prompts, future dialogs), it traps focus, closes on Escape, and restores focus to its trigger. Introduce a small dialog/focus-trap utility and apply it where the UI currently fakes modality.
- **Visible focus**: audit focus visibility on all interactive elements, including custom-styled chips and icon buttons, using the existing theme tokens (no hard-coded colors).
- **Screen-reader basics**: labels/roles for the player canvas, transport controls, and status surfaces; live-region behavior for runtime status changes.
- Verification: axe-core automated checks wired into the existing test run plus targeted keyboard-interaction tests.

No visual redesign and no breaking changes; styling uses the existing Tailwind theme tokens.

## Capabilities

### New Capabilities
- `accessibility`: Keyboard operability, reduced-motion support, dialog/focus management, and non-visual labeling across browse, details, admin, and the player.

### Modified Capabilities

(none — `openspec/specs/` is empty; there are no existing capability specs to modify)

## Impact

- `src/styles/index.css` (reduced-motion media query), `src/components/` (dialog primitive, focus fixes), `src/features/console/components/GameWindow.tsx` (labels, keyboard), `src/admin/` (dropzone keyboard path), carousel controls.
- DevDependency: an axe-core matcher (e.g. `vitest-axe` or `@axe-core/playwright` in the e2e suite) — decided in design.
- New tests: axe scans per route + keyboard interaction tests.
