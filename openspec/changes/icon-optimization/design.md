# Design

## Context

See proposal.md — Why. `src/main.tsx` does `import 'material-symbols/outlined.css'`, which ships the full outlined variable woff2 (~4 MB) from the `material-symbols ^0.48.2` package. Usage across the app is `<span className="material-symbols-outlined">icon_name</span>` — ligature-based, so glyph selection happens in the font. The bundle is built with Vite 8; CI runs typecheck/lint/test/build. The font is variable-weight (axis `wght 100..700`); icons render at default weight unless classes override.

## Goals / Non-Goals

**Goals:**

- ~Two orders of magnitude smaller icon payload; no visual change; no component rewrites.
- Subset cannot go stale: an automated check ties source icon references to the subset content.
- Reproducible locally and in CI without proprietary tooling.

**Non-Goals:**

- Migrating components to per-icon SVG components (rejected alternative, documented below).
- Supporting arbitrary/foreign icon names at runtime (e.g. names from backend data).
- Variable-weight axis customization UI.

## Decisions

### D1: Font subsetting (chosen) over SVG migration

A `scripts/subset-icons.mjs` run:
1. Scans `src/**/*.{ts,tsx}` for `material-symbols-outlined">…name…<` patterns (plus a small allowlist file for dynamic names if any emerge) → sorted unique set.
2. Downloads the current full variable woff2 from the installed `material-symbols` package (no network fetch of Google Fonts — the package is already the pinned source of truth).
3. Subsets with `harfbuzzjs` (WASM subsetter, npm-runnable, what Google itself uses — `pyftsubset` equivalent) keeping ligature layout features and the `wght` axis pinned to the weights actually used (default 400 → instance it, halving size again).
4. Emits `public/icons/material-symbols-subset.woff2` + a ~15-line CSS file (font-face + the existing class), and a manifest JSON of included names.

`src/main.tsx` imports the generated CSS instead of the package CSS.

**Alternative: tree-shaken SVG components** (e.g. individual SVGs per icon) — equivalent payload, but touches every component (~dozens of call sites), risks visual drift per-icon, and abandons the ligature system future components naturally reach for. Rejected for diff size; revisit only if subsetting proves brittle.

### D2: Commit the generated subset, verify in CI

The woff2 (~tens of KB) and CSS are committed (like other checked-in assets) so builds don't need the subsetter at all — the pipeline is opt-in regeneration. Verification (`icons:check`, part of CI): re-scan source icon names and compare against the committed manifest; fail naming missing icons (spec: *Drift protection*). No stale-glyph bloat check (extra icons in the subset are harmless; pruning is a regeneration side-effect).

Alternative: generate at build time in CI — rejected: adds a WASM subsetter + font-parsing to every build for a rarely-changing artifact, and local `npm run build` should match CI byte-for-byte.

### D3: Scan strictly enough to be safe, loosely enough to be maintainable

The regex targets the span-class usage pattern plus `EmptyState`'s icon prop values (strings in source). If a truly dynamic icon name ever appears (none today — verified by survey), the allowlist file in the script directory covers it, with a comment explaining why. The check failing loudly is the safety net.

## Risks / Trade-offs

- [Ligatures dropped by a misconfigured subsetter] → subsetting runs with layout features preserved; the drift test renders the app in Vitest with the subset CSS? Not reliable in jsdom — instead the manifest comparison plus a manual visual check in the verification task covers it; e2e suite (when present) asserts icon glyph rendering on one page.
- [New upstream font version changes glyph shapes] → the package is semver-pinned; regeneration is deliberate and reviewable.
- [Variable-axis instance loses weight classes] → project uses default weight only (verified); instance at 400; if a bold icon is introduced later, add the weight to the instance and regenerate.

## Migration Plan

Swap the CSS import and commit the subset in one PR; CI gets the `icons:check` step. Rollback = revert the import (full font returns). No runtime API changes.

## Open Questions

- None blocking. Exact byte savings depend on the final icon count; the spec bounds it by an order of magnitude, which any realistic count satisfies.
