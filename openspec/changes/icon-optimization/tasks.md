# Tasks

## 1. Subsetting pipeline

- [x] 1.1 Write `scripts/subset-icons.mjs` (scan `src/` for icon names, subset the packaged variable woff2 via `harfbuzzjs` with ligatures preserved and `wght` instanced to 400, emit `public/icons/material-symbols-subset.woff2`, minimal CSS, and a name manifest) and verify the generated font is < 100 KB and contains every scanned name
- [x] 1.2 Switch `src/main.tsx` to import the generated CSS (removing the `material-symbols/outlined.css` import) and verify icons still render identically across browse/details/admin/player in dev and a production build

## 2. Drift protection

- [x] 2.1 Add `icons:check` (re-scan source names, diff against the committed manifest, fail naming missing icons) and wire it into CI; verify it fails when a bogus icon name is added temporarily, then passes after regeneration
- [x] 2.2 Commit the regenerated subset + CSS + manifest and verify `npm run build` output contains no multi-megabyte icon font (spec: *Subset payload is bounded*)

## 3. Gates

- [x] 3.1 Run the full gate: `npm run typecheck && npm run lint && npm test && npm run build` green; manual visual pass confirming every icon renders as before
