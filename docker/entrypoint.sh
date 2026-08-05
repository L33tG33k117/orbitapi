#!/bin/sh
# ============================================================
# OrbitAPI app container entrypoint
# ============================================================
# Migrate, then start. Doing it here rather than in a separate init container
# means an update is a single `compose up -d`: the new image applies whatever
# schema it needs before it begins serving, and a failure stops the container
# instead of leaving a new app running against an old schema.
set -e

echo "[orbit] starting (edition=${ORBIT_EDITION:-selfhost}, version=${ORBIT_VERSION:-dev})"

# ---- required configuration -------------------------------------------------
missing=""
[ -z "$DATABASE_URL" ] && missing="$missing DATABASE_URL"
[ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && missing="$missing SUPABASE_SERVICE_ROLE_KEY"
[ -z "$ORBIT_SECRETS_KEY" ] && missing="$missing ORBIT_SECRETS_KEY"

if [ -n "$missing" ]; then
  echo "[orbit] FATAL: missing required environment:$missing" >&2
  echo "[orbit] Run ./orbit.sh install to generate a .env, or see docs/SELF_HOST.md" >&2
  exit 1
fi

# ---- wait for Postgres ------------------------------------------------------
# Compose healthchecks already order startup, but a database can accept TCP
# before it will accept queries. Retry rather than crash-loop the container.
echo "[orbit] waiting for the database…"
attempts=0
until node -e "
  const pg = require('pg');
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  c.connect().then(() => c.query('select 1')).then(() => c.end()).then(
    () => process.exit(0),
    () => process.exit(1),
  );
" 2>/dev/null; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 60 ]; then
    echo "[orbit] FATAL: database did not become ready after 60 attempts" >&2
    exit 1
  fi
  sleep 2
done
echo "[orbit] database is ready"

# ---- migrate ----------------------------------------------------------------
# db-migrate picks the direct-Postgres transport automatically because
# DATABASE_URL is set. Re-runs are safe: applied migrations are tracked.
echo "[orbit] applying migrations…"
node scripts/db-migrate.mjs up

# ---- serve ------------------------------------------------------------------
echo "[orbit] starting the app on port ${PORT:-3000}"
exec su-exec orbit "$@"
