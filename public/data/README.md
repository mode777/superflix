# Runtime DAT files

`npm run dats:fetch` downloads these files from the
[libretro-database](https://github.com/libretro/libretro-database) mirror of
No-Intro and the libretro metadata databases:

| File | Purpose |
|---|---|
| `no-intro-snes.dat` | Canonical names, regions, sizes, CRC32/MD5/SHA1, serials |
| `developer-snes.dat` | Developer, keyed by CRC32 |
| `publisher-snes.dat` | Publisher, keyed by CRC32 |
| `genre-snes.dat` | Genre, keyed by CRC32 |
| `releaseyear-snes.dat` | Release year, keyed by CRC32 |
| `maxusers-snes.dat` | Player count, keyed by CRC32 |

The `.dat` files are **gitignored** so the repository stays small and the data
is fetched explicitly. They are not bundled into the Docker image unless you
run `npm run dats:fetch` before `npm run build`.

## Licensing

- The libretro-database mirror is **CC-BY-SA-4.0**. Attribution and
  share-alike apply if you redistribute the DAT files.
- The underlying No-Intro data is maintained by
  [No-Intro](https://no-intro.org/); see their terms.
- No ROMs are included or downloaded by this project.
