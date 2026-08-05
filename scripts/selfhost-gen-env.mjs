#!/usr/bin/env node
/**
 * Generate a .env for a self-hosted OrbitAPI install.
 *
 * Every instance gets its OWN keys. Nothing is shared between customers and
 * nothing is baked into the image — which is the whole reason this script
 * exists rather than a checked-in .env with defaults someone would forget to
 * change.
 *
 *   node scripts/selfhost-gen-env.mjs --url https://orbit.acme.internal
 *   node scripts/selfhost-gen-env.mjs --url http://192.168.1.10 --out ./docker/.env
 *
 * Refuses to overwrite an existing file without --force: regenerating the keys
 * of a live install would orphan every stored credential and log everyone out.
 */
import { createHmac, randomBytes } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const has = (name) => process.argv.includes(`--${name}`)

const appUrl = arg('url')
const outPath = resolve(arg('out', join(ROOT, 'docker', '.env')))
const force = has('force')

if (!appUrl) {
  console.error(`
Usage: node scripts/selfhost-gen-env.mjs --url <address> [--out <path>] [--force]

  --url    the address users will type into a browser, e.g.
           https://orbit.acme.internal  or  http://192.168.1.10
`)
  process.exit(1)
}

try {
  const u = new URL(appUrl)
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error()
} catch {
  console.error(`\n✗ "${appUrl}" is not a valid http(s) URL.\n`)
  process.exit(1)
}

if (existsSync(outPath) && !force) {
  console.error(`
✗ ${outPath} already exists.

  Regenerating keys for a running install would make every stored credential
  unreadable and sign every user out. If you are sure, pass --force — and back
  up the old file first.
`)
  process.exit(1)
}

// ---- key material -----------------------------------------------------------
const b64 = (n) => randomBytes(n).toString('base64')
const b64url = (buf) => Buffer.from(buf).toString('base64url')

const jwtSecret = randomBytes(48).toString('base64')
const secretsKey = b64(32)               // AES-256-GCM, exactly 32 bytes
const pgPassword = randomBytes(24).toString('base64url')
const cronSecret = randomBytes(24).toString('base64url')

// Supabase-shaped JWTs, signed with the same secret GoTrue and PostgREST hold.
// Hand-rolled because it's ~10 lines of HS256 and pulling in a JWT library for
// two tokens generated once at install isn't worth the dependency.
function signJwt(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const data = `${header}.${body}`
  const sig = createHmac('sha256', jwtSecret).update(data).digest('base64url')
  return `${data}.${sig}`
}

const iat = Math.floor(Date.now() / 1000)
const TEN_YEARS = 60 * 60 * 24 * 365 * 10
const anonKey = signJwt({ role: 'anon', iss: 'orbit', iat, exp: iat + TEN_YEARS })
const serviceKey = signJwt({ role: 'service_role', iss: 'orbit', iat, exp: iat + TEN_YEARS })

const env = `# ============================================================
# OrbitAPI self-hosted configuration
# ============================================================
# Generated ${new Date().toISOString()} by scripts/selfhost-gen-env.mjs
#
#   !! BACK THIS FILE UP, SOMEWHERE OTHER THAN THIS MACHINE !!
#
# ORBIT_SECRETS_KEY encrypts every API credential stored in the database.
# If you lose it, those credentials cannot be recovered by us or by anyone
# else — they would all have to be re-entered by hand. That is deliberate:
# it is what stops a stolen database backup from being useful.

# ---- where users reach this install ----
ORBIT_APP_URL=${appUrl}
ORBIT_HTTP_PORT=80
ORBIT_HTTPS_PORT=443

# ---- image ----
ORBIT_IMAGE=orbitapi/app:latest
ORBIT_VERSION=dev

# ---- database ----
POSTGRES_USER=orbit
POSTGRES_DB=orbit
POSTGRES_PASSWORD=${pgPassword}

# ---- keys (all unique to this install) ----
JWT_SECRET=${jwtSecret}
ANON_KEY=${anonKey}
SERVICE_ROLE_KEY=${serviceKey}
ORBIT_SECRETS_KEY=${secretsKey}
CRON_SECRET=${cronSecret}

# ---- your AI model (optional) ----
# Leave blank to set it up later in Settings > AI Provider. Simulated
# connectors work without any AI at all, so you can explore first.
# Example for Ollama running on the host machine:
#   ORBIT_AI_BASE_URL=http://host.docker.internal:11434/v1
#   ORBIT_AI_MODEL=llama3.1:70b
ORBIT_AI_BASE_URL=
ORBIT_AI_MODEL=
ORBIT_AI_API_KEY=
ORBIT_AI_MAX_OUTPUT_TOKENS=

# ---- scheduled skills and playbooks ----
ORBIT_ENABLE_SCHEDULER=true

# ---- email (optional) ----
# Without SMTP, invitations and password resets are handled by an admin
# copying a link from inside the app instead of a message being sent.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
`

writeFileSync(outPath, env, { mode: 0o600 })

console.log(`
✓ Wrote ${outPath}

  App URL:  ${appUrl}
  Keys:     generated fresh for this install (file mode 600)

  BACK UP THIS FILE NOW. ORBIT_SECRETS_KEY cannot be recovered, and without it
  every stored API credential is lost.
`)
