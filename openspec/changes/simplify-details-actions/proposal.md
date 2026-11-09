# Proposal

## Why

The game details page mixes a loud gradient CTA with a redundant catalog action:
"Play in browser" competes visually with the mild Favorite control, while
"Import another ROM" duplicates the header's Import link on every game. The
credits disclosure also uses a 32px headline for a secondary panel, so it reads
louder than the metadata it explains. The page should make Play the clear,
single blue action and let supporting content stay quiet.

## What Changes

- Change the player CTA label from **Play in browser** to **Play** and replace its
  blue-to-yellow gradient with the theme's solid blue (`bg-primary`). The link
  target, play icon, and accessible name stay; the route is unchanged.
- Remove the **Import another ROM** button from the details actions. Import
  remains available from the header's Import link and the browse empty state.
- Shrink the **Metadata & artwork credits** disclosure header from
  `text-headline-lg` (32px) to the panel's body size (`text-body-md`, 16px),
  keeping the disclosure behavior, label, and content unchanged.
- Update the e2e selectors and user docs that refer to **Play in browser** so
  they match the new **Play** label.

Out of scope: changing the Favorite button, metadata panel, screenshots, ROM
header panel, attribution copy or links, the header navigation, the admin
route, or adding replacement actions on the details page.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — no capability requirement describes these details-page controls or
their visual treatment. This is a UI presentation cleanup, so the change sets
`skip_specs: true` rather than inventing a requirement.)

## Impact

- `src/routes/DetailsView.tsx` — Play link label/classes; remove the import link.
- `src/components/media/AttributionPanel.tsx` — summary typography.
- `e2e/details.spec.ts`, `e2e/player.spec.ts`, `e2e/player-dpr.spec.ts`,
  `e2e/crt-controls.spec.ts` — match the new Play label.
- `README.md`, `docs/controllers.md` — say **Play** instead of **Play in browser**.
- No backend, schema, dependency, data, or routing changes.
