# Hosting Superflix

Superflix is a static React app plus a PocketBase backend. PocketBase serves
the built SPA, the API, and the uploaded ROMs/artwork from one process.

## Requirements

- Node.js 24 (build only)
- PocketBase 0.40.x (downloaded by `npm run pb:download`, or the Docker image)
- ~1 GB disk for PocketBase data, ROMs, and artwork

## Local instance (5 minutes)

```bash
npm install
npm run core:fetch      # Snes9x core → public/cores/
npm run dats:fetch      # No-Intro + libretro DATs → public/data/
npm run build
npm run pb:download     # bin/pocketbase
npm run pb:serve        # http://127.0.0.1:8090
```

In a second shell, create the superuser used by `/admin`:

```bash
./bin/pocketbase superuser upsert you@example.com 'a-long-password' --dir ./pb_data
```

Open <http://127.0.0.1:8090>, import a ROM from `/admin`, then browse the
catalog. Passwords are only stored in PocketBase; they are never written to
this repository.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `VITE_PB_URL` | `http://127.0.0.1:8090` in dev, same origin in production | PocketBase API origin baked into the SPA at build time |
| `VITE_DATA_SOURCE` | `mock` in dev, `pocketbase` in production | `mock` uses the bundled demo catalog |
| `POCKETBASE_ADMIN_EMAIL` / `POCKETBASE_ADMIN_PASSWORD` | — | Deployment-only: upserted as superuser on container start |

Rebuild the SPA after changing `VITE_*` values — they are compiled in.

## Docker

```bash
docker compose up --build
```

The image builds the SPA (fetching the core and DATs), then runs PocketBase
with `dist/` as its public directory. `./pb_data` on the host holds the SQLite
database and uploaded files; back it up as a unit.

## Production notes

- The reference deployment runs on Kubernetes via Flux (GitOps) behind Traefik
  at <https://snes.alexklingenbeck.de>, with the PocketBase data on a hostPath
  volume (`/var/www/superflix/data`).
- Releases are tagged `v*`; the release workflow publishes
  `harbor.alexklingenbeck.de/my/superflix:<version>` and Flux updates the image.
- PocketBase applies `pb_migrations/` on start. Do not edit generated
  migrations by hand; change `scripts/generate-schema.mjs` and run
  `npm run pb:schema`.
- No COOP/COEP headers are required: SNES ROMs are loaded whole; there is no
  SharedArrayBuffer or streaming layer.

## Backups

Copy the entire `pb_data` directory (database + `storage/`). Restoring is a
matter of putting it back before starting PocketBase.

## Troubleshooting

- **Player says “Could not start the emulator”** — the core is missing. Run
  `npm run core:fetch` (or rebuild the Docker image) and reload.
- **Admin says “No-Intro DAT not found”** — run `npm run dats:fetch`. Hash-only
  identification still works without it.
- **Empty catalog in production** — import a ROM, or check `VITE_PB_URL`
  points at the PocketBase origin you are actually serving.
