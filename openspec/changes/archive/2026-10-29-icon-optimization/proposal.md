# Proposal

## Why

Every visitor downloads the full Material Symbols outlined variable font (~4 MB woff2) because `src/main.tsx` imports `material-symbols/outlined.css` wholesale, while the app actually uses only a few dozen icon names. That is the single largest asset in the bundle — several times larger than the entire application code — and it delays first paint on the deployed site. The roadmap's cross-cutting performance item calls for subsetting the font or moving to tree-shaken SVG icons.

## What Changes

- Stop shipping the full icon font. Keep the existing `<span class="material-symbols-outlined">name</span>` markup and add a **build-time icon-subsetting pipeline**:
  - A script scans `src/` for used icon names, fetches the upstream font, and generates a subset woff2 (ligatures preserved) plus a minimal CSS file committed under `public/icons/` (or generated at build).
  - CI/test fails if a component references an icon missing from the subset, so the subset can never silently go stale.
- First load drops from ~4 MB to a few dozen KB for icons; no visual change, no markup change, no new runtime dependency.
- Alternative considered and rejected: migrating to per-icon SVG components — larger diff across every component for the same payload win (recorded in design).

No breaking changes; icon appearance is unchanged.

## Capabilities

### New Capabilities
- `icon-optimization`: Delivering Material Symbols icons via a build-time subset tied to actually-used icon names, with drift protection so new icons cannot silently fall back to a missing glyph.

### Modified Capabilities

(none — `openspec/specs/` is empty; there are no existing capability specs to modify)

## Impact

- New `scripts/subset-icons.mjs`; `src/main.tsx` swaps the package CSS import for the subset CSS.
- `package.json` scripts (`icons:subset`, wired into `build` or `prebuild` + CI) and possibly a devDependency for subsetting (decided in design).
- `.gitignore`/committed-artifact decision for the generated subset (in design).
- No component changes (markup unchanged); lint/test additions for drift protection.
