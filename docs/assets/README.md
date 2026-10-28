# Screenshots

These images show the app running the bundled MIT-licensed **Gothicvania** demo
ROM. They are used by the landing page and the user guides.

- `browse.png` — catalog grid and filters
- `details.png` — game details page
- `player.png` — Snes9x player running the demo

## Capturing

Capture against a mock-data production build so no commercial content is
involved:

```bash
VITE_DATA_SOURCE=mock npm run build
npm run preview -- --port 4173
node scripts/capture-docs.mjs
```

The script writes 1440×900 PNGs into this directory. Rebuild the SPA afterwards
so the landing page picks up the new files.

**Never capture or commit screenshots of commercial games, box art, or other
copyrighted material.**
