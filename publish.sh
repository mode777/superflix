#!/bin/bash

# Build and push the Superflix image to Harbor. The Dockerfile fetches the
# Snes9x core and the DATs at build time, then bakes the SPA into PocketBase.
set -e

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

VERSION=$1

docker buildx build \
  --platform linux/amd64 \
  -t "harbor.alexklingenbeck.de/my/superflix:${VERSION}" \
  . \
  --push
