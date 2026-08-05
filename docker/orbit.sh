#!/usr/bin/env bash
# ============================================================
# orbit.sh — the one command a self-hosted operator needs
# ============================================================
# Wraps docker compose so the person running OrbitAPI doesn't have to know
# which of the five containers does what.
#
#   ./orbit.sh install [--url URL]   first-time setup
#   ./orbit.sh start | stop | restart
#   ./orbit.sh status                what's running, and is it healthy
#   ./orbit.sh logs [service]        follow logs
#   ./orbit.sh update <bundle.tar.gz>  apply an offline update
#   ./orbit.sh rollback              undo the last update
#   ./orbit.sh backup                dump the database
#   ./orbit.sh support-bundle        a redacted archive to send to support
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE=".env"
BACKUP_DIR="./backups"
STATE_DIR="./.orbit-state"

# docker compose (v2) with a fallback to the old binary, because a customer's
# box is whatever it is and the failure mode otherwise is a bare "not found".
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "✗ Docker Compose is not installed. See docs/SELF_HOST.md." >&2
  exit 1
fi

say()  { printf '\n%s\n' "$*"; }
fail() { printf '\n✗ %s\n\n' "$*" >&2; exit 1; }

require_env() {
  [ -f "$ENV_FILE" ] || fail "No $ENV_FILE found. Run: ./orbit.sh install"
}

# ------------------------------------------------------------
cmd_install() {
  local url=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --url) url="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  if [ -f "$ENV_FILE" ]; then
    say "✓ $ENV_FILE already exists — keeping it."
    say "  Delete it (after backing it up!) if you really want fresh keys."
  else
    [ -n "$url" ] || read -r -p "Address users will browse to (e.g. https://orbit.acme.internal): " url
    [ -n "$url" ] || fail "An address is required."
    node ../scripts/selfhost-gen-env.mjs --url "$url" --out "$ENV_FILE" \
      || fail "Could not generate $ENV_FILE (is Node installed on this host?)"
  fi

  mkdir -p "$BACKUP_DIR" "$STATE_DIR" ./updates ./certs

  # A self-signed cert so HTTPS works out of the box. The operator can replace
  # cert.pem/key.pem with real ones and restart; nothing else changes.
  if [ ! -f ./certs/cert.pem ]; then
    say "Generating a self-signed certificate (replace ./certs/*.pem with real ones later)…"
    openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
      -keyout ./certs/key.pem -out ./certs/cert.pem \
      -subj "/CN=orbitapi.local" >/dev/null 2>&1 \
      || say "  (openssl not available — HTTP will still work on port 80)"
  fi

  say "Starting OrbitAPI…"
  $DC --env-file "$ENV_FILE" up -d
  cmd_wait_healthy
  local app_url
  app_url="$(grep -E '^ORBIT_APP_URL=' "$ENV_FILE" | cut -d= -f2-)"
  say "✓ OrbitAPI is running at ${app_url}"
  say "  Open it in a browser to create the first admin account."
  say ""
  say "  !! Back up ${PWD}/${ENV_FILE} now — it holds the key that decrypts"
  say "     every stored credential, and it cannot be regenerated."
}

cmd_wait_healthy() {
  say "Waiting for the app to become healthy…"
  local i=0
  until [ "$($DC --env-file "$ENV_FILE" ps --format '{{.Health}}' orbit-app 2>/dev/null | head -1)" = "healthy" ]; do
    i=$((i + 1))
    if [ "$i" -ge 60 ]; then
      say "✗ The app did not become healthy in time. Recent logs:"
      $DC --env-file "$ENV_FILE" logs --tail 40 orbit-app
      exit 1
    fi
    sleep 5
  done
}

cmd_start()   { require_env; $DC --env-file "$ENV_FILE" up -d; cmd_wait_healthy; say "✓ Running."; }
cmd_stop()    { require_env; $DC --env-file "$ENV_FILE" down; say "✓ Stopped."; }
cmd_restart() { cmd_stop; cmd_start; }
cmd_logs()    { require_env; $DC --env-file "$ENV_FILE" logs -f --tail 100 "${1:-}"; }

cmd_status() {
  require_env
  $DC --env-file "$ENV_FILE" ps
  say "Health endpoint:"
  curl -fsS http://127.0.0.1:"$(grep -E '^ORBIT_HTTP_PORT=' "$ENV_FILE" | cut -d= -f2- || echo 80)"/api/health \
    || say "  (not answering yet)"
  echo
}

cmd_backup() {
  require_env
  mkdir -p "$BACKUP_DIR"
  local stamp file
  stamp="$(date +%Y%m%d-%H%M%S)"
  file="$BACKUP_DIR/orbit-$stamp.sql"
  say "Dumping the database to $file…"
  # shellcheck disable=SC1090
  set -a; . "./$ENV_FILE"; set +a
  $DC --env-file "$ENV_FILE" exec -T orbit-db \
    pg_dump -U "${POSTGRES_USER:-orbit}" -d "${POSTGRES_DB:-orbit}" > "$file"
  gzip -f "$file"
  say "✓ Wrote ${file}.gz"
  say "  Note: this does NOT include ${ENV_FILE}. Without ORBIT_SECRETS_KEY the"
  say "  stored credentials in this dump cannot be decrypted — back up both."
}

cmd_support_bundle() {
  require_env
  local stamp out
  stamp="$(date +%Y%m%d-%H%M%S)"
  out="orbit-support-$stamp"
  mkdir -p "$out"

  $DC --env-file "$ENV_FILE" ps > "$out/containers.txt" 2>&1 || true
  for svc in orbit-app orbit-db orbit-auth orbit-rest orbit-gateway; do
    $DC --env-file "$ENV_FILE" logs --tail 500 "$svc" > "$out/$svc.log" 2>&1 || true
  done
  curl -fsS http://127.0.0.1/api/health > "$out/health.json" 2>&1 || true
  docker version > "$out/docker.txt" 2>&1 || true
  uname -a > "$out/host.txt" 2>&1 || true

  # Config WITHOUT secrets: keys are redacted rather than omitted, so support
  # can still see which settings are present.
  sed -E 's/^(JWT_SECRET|ANON_KEY|SERVICE_ROLE_KEY|ORBIT_SECRETS_KEY|POSTGRES_PASSWORD|CRON_SECRET|ORBIT_AI_API_KEY|SMTP_PASS)=.*/\1=<redacted>/' \
    "$ENV_FILE" > "$out/env.redacted"

  tar -czf "$out.tar.gz" "$out"
  rm -rf "$out"
  say "✓ Wrote $out.tar.gz"
  say "  Secrets are redacted, but please skim it before sending."
}

cmd_update() {
  local bundle="${1:-}"
  [ -n "$bundle" ] || fail "Usage: ./orbit.sh update <bundle.tar.gz>"
  [ -f "$bundle" ] || fail "No such file: $bundle"
  require_env

  say "Verifying $bundle…"
  node ../scripts/verify-bundle.mjs "$bundle" || fail "Bundle verification failed — not applying."

  local work
  work="$(mktemp -d)"
  tar -xzf "$bundle" -C "$work"

  say "Backing up the database first…"
  cmd_backup

  # Remember the current image so rollback has something to return to.
  mkdir -p "$STATE_DIR"
  grep -E '^ORBIT_IMAGE=|^ORBIT_VERSION=' "$ENV_FILE" > "$STATE_DIR/previous.env" || true

  say "Loading images…"
  for tarball in "$work"/images/*.tar; do
    [ -f "$tarball" ] || continue
    docker load -i "$tarball"
  done

  local new_version
  new_version="$(node -e "console.log(require('$work/manifest.json').version)")"
  sed -i.bak -E "s|^ORBIT_VERSION=.*|ORBIT_VERSION=$new_version|" "$ENV_FILE"
  sed -i.bak -E "s|^ORBIT_IMAGE=.*|ORBIT_IMAGE=orbitapi/app:$new_version|" "$ENV_FILE"
  rm -f "$ENV_FILE.bak"

  say "Restarting on $new_version (migrations run automatically)…"
  $DC --env-file "$ENV_FILE" up -d
  cmd_wait_healthy

  rm -rf "$work"
  say "✓ Updated to $new_version"
  say "  If something looks wrong: ./orbit.sh rollback"
}

cmd_rollback() {
  require_env
  [ -f "$STATE_DIR/previous.env" ] || fail "No previous version recorded — nothing to roll back to."

  say "Rolling back to the previous image…"
  while IFS='=' read -r k v; do
    [ -n "$k" ] || continue
    sed -i.bak -E "s|^$k=.*|$k=$v|" "$ENV_FILE"
  done < "$STATE_DIR/previous.env"
  rm -f "$ENV_FILE.bak"

  $DC --env-file "$ENV_FILE" up -d
  cmd_wait_healthy

  say "✓ Rolled back."
  say ""
  say "  IMPORTANT: this restored the previous CODE, not the previous DATA."
  say "  Migrations are not reversed. If the update changed the schema, restore"
  say "  the pre-update dump from $BACKUP_DIR — anything created since the"
  say "  update will be lost."
}

# ------------------------------------------------------------
case "${1:-}" in
  install)        shift; cmd_install "$@" ;;
  start)          cmd_start ;;
  stop)           cmd_stop ;;
  restart)        cmd_restart ;;
  status)         cmd_status ;;
  logs)           shift; cmd_logs "${1:-}" ;;
  backup)         cmd_backup ;;
  update)         shift; cmd_update "${1:-}" ;;
  rollback)       cmd_rollback ;;
  support-bundle) cmd_support_bundle ;;
  *)
    cat <<'EOF'

OrbitAPI — self-hosted

  ./orbit.sh install [--url URL]      first-time setup
  ./orbit.sh start                    start everything
  ./orbit.sh stop                     stop everything
  ./orbit.sh restart
  ./orbit.sh status                   what's running and whether it's healthy
  ./orbit.sh logs [service]           follow logs
  ./orbit.sh backup                   dump the database to ./backups
  ./orbit.sh update <bundle.tar.gz>   apply an offline update
  ./orbit.sh rollback                 return to the previous version
  ./orbit.sh support-bundle           redacted archive to send to support

EOF
    ;;
esac
