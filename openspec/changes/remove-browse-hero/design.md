# Design

## Context

See `proposal.md` — Why. The browse route (`src/routes/BrowseView.tsx`) renders
a fixed app header from the layout, then a marketing hero section, then
favorites (when signed in), the genre/search bar, and the game grid. The hero
is the only consumer of the three screenshots imported from `docs/assets/`;
the docs pages themselves do not embed those images. `e2e/browse.spec.ts`
asserts the hero headline, and the README quick start points at the hero's
"Play featured" CTA.

The existing `user-docs-landing` capability requires a landing experience and
an app-side docs link; this change retires the first and narrows the second
(see `specs/user-docs-landing/spec.md`).

## Goals / Non-Goals

**Goals:**

- Make `/` catalog-first: the fixed header, favorites, filter bar, and game
  grid are the whole page.
- Remove the hero markup and every import/local that exists only for it.
- Keep browse behavior (favorites, genre filtering, search, loading, error,
  and empty states) and theme tokens unchanged.
- Leave tests and documentation consistent with the new page.

**Non-Goals:**

- Redesigning the header or adding replacement navigation/CTAs.
- Creating a separate landing route or moving the product copy elsewhere.
- Deleting the screenshots in `docs/assets/`.
- Changing catalog data flow, queries, routing, or styling tokens.

## Decisions

**Delete the hero section outright instead of hiding it with CSS or a flag.**
A flag would leave dead markup, imports, screenshots, and a test assertion
around for a feature that is being removed. Reverting the commit restores the
section if the decision changes. A dedicated `/welcome` route was already
rejected when the landing was introduced (hash router, extra click); it stays
out of scope here.

**No replacement for the docs link or the demo shortcut.** The user chose to
remove the hero without a substitute. The README keeps the product overview,
the docs index, and the quick start, so both the docs and the bundled demo
remain reachable. Adding a header/footer docs link was considered and rejected
as unrequested UI.

**Keep the existing page spacing and heading levels.** The main element keeps
`pt-32` so the fixed header still clears the content, and the "Library" `h2`
becomes the first visible heading. The accessibility spec gates only serious
and critical automated violations; `page-has-heading-one` is not in that set,
so no heading rewrite is part of this change.

**Keep the screenshots in `docs/assets/`, remove only their imports.** They are
license-safe demo-ROM captures belonging to the user documentation; deleting
them is a separate docs-asset cleanup and would make this change larger than
the UI removal.

**Update the e2e assertion and README in the same change.** Leaving either
pointing at the hero would break the suite and mislead readers, so both are
part of the work rather than a follow-up.

## Risks / Trade-offs

- **Visitors lose the in-app docs and demo shortcuts** → Accepted by the user;
  the README keeps both paths, and the removed requirement's migration note
  records the change.
- **A future landing page would need new markup rather than editing the old
  hero** → Acceptable: the old hero was marketing copy this project no longer
  wants on the catalog route; history retains it.
- **The root no longer has an `h1`** → Automated serious/critical accessibility
  checks are unaffected; add a page title in a future a11y pass if desired.
- **The screenshots become unused by the app** → Kept as documentation assets;
  they can be cleaned up separately without affecting runtime behavior.

## Migration Plan

Deploy the frontend as usual. No data, schema, environment, or dependency
changes. Roll back by reverting the commit, which restores the hero, its
imports, the e2e assertion, and the README wording.

## Open Questions

None.
