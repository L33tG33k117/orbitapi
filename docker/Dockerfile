# ============================================================
# OrbitAPI — self-hosted app image
# ============================================================
# Multi-stage so the shipped layer carries the built app and only the
# node_modules it actually imports. That matters more than usual here: the
# whole bundle gets `docker save`d to a tarball and carried to an air-gapped
# site on physical media, so every avoidable megabyte is a real cost.

# ---------- deps ----------
FROM node:24-alpine AS deps
WORKDIR /app
# Copy only the manifests first so this layer caches across code changes.
COPY package.json package-lock.json ./
RUN npm ci

# ---------- build ----------
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ORBIT_EDITION is needed at BUILD time (next.config.ts switches to standalone
# output and disables image optimization). Everything else is read at runtime.
ENV ORBIT_EDITION=selfhost
ENV NEXT_TELEMETRY_DISABLED=1

# Deliberately NOT passing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY: they would be
# inlined into the client bundle, and this one image is run by every customer
# with their own generated keys. The browser gets them at runtime instead, via
# RuntimeConfigScript (see lib/runtime-config.ts).
ARG ORBIT_VERSION=dev
ENV ORBIT_VERSION=$ORBIT_VERSION

RUN npm run build

# ---------- runtime ----------
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV ORBIT_EDITION=selfhost
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# curl for the healthcheck; su-exec to drop privileges in the entrypoint.
RUN apk add --no-cache curl su-exec

# Run as a non-root user. The app never needs to write to its own filesystem.
RUN addgroup -g 1001 -S orbit && adduser -u 1001 -S orbit -G orbit

# Standalone bundles the server plus its traced dependencies; static assets and
# public/ are not included in it and must be copied alongside.
COPY --from=build --chown=orbit:orbit /app/.next/standalone ./
COPY --from=build --chown=orbit:orbit /app/.next/static ./.next/static
COPY --from=build --chown=orbit:orbit /app/public ./public

# Migrations run on boot, so the SQL and the runner have to be in the image.
# `pg` is needed by the runner but isn't imported by the app, so Next's
# dependency tracing leaves it out of standalone — copy it in explicitly.
COPY --from=build --chown=orbit:orbit /app/supabase/migrations ./supabase/migrations
COPY --from=build --chown=orbit:orbit /app/scripts ./scripts
COPY --from=build --chown=orbit:orbit /app/node_modules/pg ./node_modules/pg
COPY --from=build --chown=orbit:orbit /app/node_modules/pg-protocol ./node_modules/pg-protocol
COPY --from=build --chown=orbit:orbit /app/node_modules/pg-types ./node_modules/pg-types
COPY --from=build --chown=orbit:orbit /app/node_modules/pg-connection-string ./node_modules/pg-connection-string
COPY --from=build --chown=orbit:orbit /app/node_modules/pg-pool ./node_modules/pg-pool
COPY --from=build --chown=orbit:orbit /app/node_modules/pg-int8 ./node_modules/pg-int8
COPY --from=build --chown=orbit:orbit /app/node_modules/pg-cloudflare ./node_modules/pg-cloudflare
COPY --from=build --chown=orbit:orbit /app/node_modules/postgres-array ./node_modules/postgres-array
COPY --from=build --chown=orbit:orbit /app/node_modules/postgres-bytea ./node_modules/postgres-bytea
COPY --from=build --chown=orbit:orbit /app/node_modules/postgres-date ./node_modules/postgres-date
COPY --from=build --chown=orbit:orbit /app/node_modules/postgres-interval ./node_modules/postgres-interval
COPY --from=build --chown=orbit:orbit /app/node_modules/split2 ./node_modules/split2
COPY --from=build --chown=orbit:orbit /app/node_modules/xtend ./node_modules/xtend

COPY --chown=orbit:orbit docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

# Hits a route that touches the database, so "healthy" means "actually able to
# serve", not merely "the process is up".
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
