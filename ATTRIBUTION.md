# Attribution

This project is a self-hosted catalog. It ships **one MIT-licensed homebrew
ROM** for testing and no commercial ROMs or copyrighted box art. The following
data, code, and assets are used at build/runtime:

## Bundled demo ROM

- **Gothicvania** — <https://github.com/donth77/snes-homebrew> — MIT.
  Copyright (c) 2026 Tom D. The full license text is in
  [`public/roms/LICENSE`](./public/roms/LICENSE).
- Art adapted from **GothicVania Cemetery** by **ansimuz** —
  <https://ansimuz.itch.io/gothicvania-cemetery> — CC0.

## Data

- **No-Intro** — ROM metadata and DAT files. <https://no-intro.org/>
- **libretro-database** — mirror of No-Intro and the libretro developer,
  publisher, genre, releaseyear, and maxusers DATs.
  <https://github.com/libretro/libretro-database> — **CC-BY-SA-4.0**.
- **snes-dataset** — enrichment source for descriptions, per-region release
  dates, box art, and screenshots (resolved by CRC32 at import/sync time and
  cached in PocketBase; never hotlinked).
  <https://github.com/mode777/snes-dataset> — metadata **CC0**; compiled from
  the Kaggle SNES datasets by sergenkaraoglan (**CC0**) and thedevastator,
  Wikipedia-derived release tables, **OpenVGDB** v29
  (<https://github.com/OpenVGDB/OpenVGDB>), and **opengamedb**
  (<https://github.com/karlforshaw/opengamedb>).
- **libretro-thumbnails** — optional box art/screenshot source. Artwork is
  downloaded at import time, downscaled, and cached in PocketBase; it is never
  hotlinked. <https://github.com/libretro-thumbnails> — images (including the
  `Named_Snaps` screenshots redistributed by snes-dataset) remain the
  property of their respective owners and are shown for identification.

## Emulator

- **Snes9x** — <https://www.snes9x.com/> — free for non-commercial use.
- **Nostalgist.js** — <https://github.com/arianrhodsandlot/nostalgist> — MIT.
- **RetroArch** — <https://www.retroarch.com/> — GPL-3.0.

## CRT shader

- **newpixie CRT** — by **Mattias Gustavsson**, slang adaptation by **hunterk**
  — dual licensed MIT or public domain.
  <https://github.com/libretro/slang-shaders/tree/master/crt/shaders/newpixie>
- **Tuned look and GLSL port** — adapted from `psflix`'s
  `src/vendor/psxanywhere/emulator/worker/gl/crt-shader.ts`, which ports the
  newpixie chain to WebGL. This project ships a single-pass GLSL ES 1.00 port
  of its tuned composite: the emulator's WebGL1 build cannot create the render
  targets the multi-pass chain needs, so the accumulation and blur passes are
  replaced by inline sampling. Tuned values are kept.
- No bezel artwork (`crtframe.png`) is bundled; the frame overlay is disabled.

## Backend / frontend

- **PocketBase** — <https://pocketbase.io/> — MIT.
- **React** — MIT.
- **Vite** — MIT.
- **Tailwind CSS** — MIT.
- **TanStack Query** — MIT.
- **Zustand** — MIT.
- **hash-wasm** — MIT.
- **Inter** — SIL Open Font License 1.1.
- **Material Symbols** — Apache License 2.0.

## Optional metadata providers

If you enable these in your instance, keep their attribution visible:

- **ScreenScraper** — <https://www.screenscraper.fr/> — CC BY-NC-SA 4.0.
- **IGDB** — <https://www.igdb.com/> — attribution required.
- **TheGamesDB** — <https://thegamesdb.net/>.
- **RetroAchievements** — <https://retroachievements.org/>.
