# Design

## Context

See `proposal.md` — Why. `DetailsView` renders three actions in one flex row: a
gradient Play link (`bg-gradient-to-br from-primary to-tertiary-container`), an
"Import another ROM" link to `/admin`, and the Favorite toggle. The header
already exposes Import, so the details link is redundant. `AttributionPanel`
is a native `<details>` whose `<summary>` uses `text-headline-lg` (32px) while
its paragraphs use `text-body-md` (16px). Four e2e specs find the Play link by
the name `/Play in browser/i`, and the README plus `docs/controllers.md` repeat
that label.

## Goals / Non-Goals

**Goals:**

- Make Play the single, solid blue primary action on the details page.
- Remove the duplicated import action without losing access to import.
- Make the credits disclosure header match the panel's body text size.
- Keep the Favorite toggle, player route, attribution content, and layout
  otherwise unchanged.

**Non-Goals:**

- Restyling the Favorite toggle or other buttons on the page.
- Removing the header's Import link or the browse empty-state import action.
- Changing the credits label, wording, links, or source list.
- Making the credits panel a modal or custom JS disclosure.

## Decisions

**Use `bg-primary` with the existing hover brightness, not
`bg-primary-container`.** `--color-primary` is the theme's blue (`#5b9dff`);
`primary-container` is a darker blue that would read as a different action.
Keeping `text-on-primary` and `hover:brightness-110` preserves contrast and the
existing hover feedback now that the gradient is gone.

**Label the link exactly "Play".** The icon remains `aria-hidden`, so the
accessible name is the text alone. All Play-link selectors become exact-name
lookups instead of `/Play in browser/i`; exact matching also prevents matching
an unrelated "Play" control on the details page.

**Delete the import link rather than demote or relabel it.** The header's
Import nav item and the browse empty state already route to `/admin`; a third
path on every game is the redundancy the request removes. An icon-only or
overflow-menu version was rejected as unrequested UI.

**Use `text-body-md font-semibold` for the summary.** The panel body is
`text-body-md` (16px), so the header now matches the text the request refers to;
semibold keeps it recognizable as a disclosure trigger. `text-body-lg` (18px)
was rejected as less clearly "much smaller"; regular weight was rejected because
it would make the trigger indistinguishable from the paragraphs.

**Keep the native `<details>`/`<summary>`.** No JavaScript is needed for the
size change; native keyboard behavior, focus, and expansion state stay intact.
The `cursor-pointer` and default disclosure marker remain.

**Update every consumer of the old label in the same change.** The four e2e
specs, README quick start, and controllers guide are updated with the UI so no
test or doc points at a label that no longer exists.

## Risks / Trade-offs

- **The accessible-name change breaks existing e2e selectors and docs** → All
  four specs and both docs are updated in the same change; specs are re-listed
  with Playwright and greps confirm no "Play in browser" remains.
- **Removing the details import link reduces one discoverability path** → The
  header Import item remains on every page, and the browse empty state still
  offers import.
- **A 16px summary can look like static text** → The native disclosure marker,
  pointer cursor, and semibold weight keep the affordance visible, and keyboard
  behavior is unchanged.

## Migration Plan

Deploy the frontend as usual; no data, schema, environment, or dependency
changes. Roll back by reverting the commit, which restores the label, gradient,
import link, summary size, selectors, and docs.

## Open Questions

None.
