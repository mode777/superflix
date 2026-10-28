# Runtime emulator core

`npm run core:fetch` downloads the **Snes9x libretro** core (JS + WASM) used by
Nostalgist into this directory:

- `snes9x_libretro.js`
- `snes9x_libretro.wasm`

The core is **not committed** — it is fetched explicitly so the repository
stays small and the exact core version is visible in `scripts/fetch-core.mjs`.

## License

Snes9x is free for **non-commercial** use. The core is distributed under the
Snes9x license, not an OSI open-source license. Review that license before
distributing the built image commercially.
