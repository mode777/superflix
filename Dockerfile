# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# Runtime assets are gitignored; fetch them at image build time.
RUN npm run core:fetch && npm run dats:fetch && npm run build

FROM adrianmusante/pocketbase:0.40.4
COPY --from=build /app/dist/. /pocketbase/public/
COPY pb_migrations/. /pocketbase/migrations/
COPY pb_hooks/. /pocketbase/hooks/
