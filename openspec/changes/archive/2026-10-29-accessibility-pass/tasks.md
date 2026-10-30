# Tasks

## 1. Reduced motion

- [x] 1.1 Add the `prefers-reduced-motion` media query to `src/styles/index.css` neutralizing shimmer, slide, drift, and transition animations, and verify by emulating reduced motion in devtools that skeletons/toasts/ambient background are still and content is unaffected

## 2. Dialog primitive

- [x] 2.1 Implement `src/components/Dialog.tsx` (native `<dialog>` wrapper: `aria-modal`, focus trap, Escape close, focus restore) styled with theme tokens, and verify RTL tests cover open/escape/restore and focus cycling
- [x] 2.2 Apply the dialog primitive to the first real consumer (e.g. an admin delete-confirmation once available, or the SRAM actions if made modal) and verify keyboard-only completion of that flow

## 3. Keyboard operability

- [x] 3.1 Make `RomDropzone` fully keyboard-operable (visible choose-file button, Enter/Space opens picker) and verify an RTL test tabs to and activates the picker without a pointer
- [x] 3.2 Add prev/next controls with aria-labels to `ScreenshotCarousel` and verify an RTL keyboard test navigates images
- [x] 3.3 Audit and fix remaining keyboard gaps in the player transport and volume (native range), and verify a manual tab-through of browse → details → play reaches and operates every control in DOM order

## 4. Labels and live regions

- [x] 4.4 Set the player runtime status text as a polite live region and keep the canvas aria-label bound to the game title; verify an RTL test observes announced status transitions (loading → playing)

## 5. Automated checks and gates

- [x] 5.1 Add axe scans (`@axe-core/playwright`) for browse, details, admin sign-in, and player routes to the e2e harness (adding a minimal Playwright config here if `e2e-suite` hasn't landed) and verify zero serious/critical violations
- [x] 5.2 Run the full gate: `npm run typecheck && npm run lint && npm test` (plus e2e where configured) green; manual keyboard-only pass over the golden path
