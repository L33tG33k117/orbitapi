// Verification for the self-hosted install configuration (Phase 2c).
//
// There is no Docker on the machine this was written on, so this cannot prove
// the stack runs. What it CAN prove is that the artifacts the stack depends on
// are internally consistent — that the generated keys are the right shape and
// actually verify against each other, that the compose file wires the same
// names the nginx config proxies to, and that the bundle verifier rejects the
// bundles it must reject.
//
// Those are the failures that would otherwise only surface on a customer's
// air-gapped box, where nobody can debug them.
//
// Run: npm run test:selfhost-config

import { execFileSync } from 'node:child_process'
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

let passed = 0
let failed = 0
function check(label, cond) {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.log(`  ✗ ${label}`) }
}

const work = mkdtempSync(join(tmpdir(), 'orbit-selfhost-'))

try {
  // ------------------------------------------------------------
  console.log('\nGenerated install config')
  // ------------------------------------------------------------
  const envPath = join(work, '.env')
  execFileSync(process.execPath, [
    join(ROOT, 'scripts', 'selfhost-gen-env.mjs'),
    '--url', 'https://orbit.acme.internal',
    '--out', envPath,
  ], { stdio: 'pipe' })

  const env = Object.fromEntries(
    readFileSync(envPath, 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
  )

  check('ORBIT_SECRETS_KEY decodes to exactly 32 bytes (AES-256)',
    Buffer.from(env.ORBIT_SECRETS_KEY, 'base64').length === 32)
  check('ANON_KEY is a three-part JWT', env.ANON_KEY?.split('.').length === 3)

  const [h, p, s] = env.ANON_KEY.split('.')
  const expected = createHmac('sha256', env.JWT_SECRET).update(`${h}.${p}`).digest('base64url')
  // If this drifts, GoTrue and PostgREST reject every request the app makes
  // and the instance looks broken in a way no log explains clearly.
  check('ANON_KEY verifies against JWT_SECRET', s === expected)

  const anonClaims = JSON.parse(Buffer.from(p, 'base64url').toString())
  const svcClaims = JSON.parse(Buffer.from(env.SERVICE_ROLE_KEY.split('.')[1], 'base64url').toString())
  check('anon key carries the anon role', anonClaims.role === 'anon')
  check('service key carries the service_role role', svcClaims.role === 'service_role')
  check('anon and service keys differ', env.ANON_KEY !== env.SERVICE_ROLE_KEY)
  check('keys are long-lived (10y)', svcClaims.exp - svcClaims.iat > 60 * 60 * 24 * 365 * 9)
  check('POSTGRES_PASSWORD generated', (env.POSTGRES_PASSWORD ?? '').length >= 20)
  check('CRON_SECRET generated', (env.CRON_SECRET ?? '').length >= 20)
  check('app URL recorded', env.ORBIT_APP_URL === 'https://orbit.acme.internal')

  // Two installs must never share key material.
  const envPath2 = join(work, 'second.env')
  execFileSync(process.execPath, [
    join(ROOT, 'scripts', 'selfhost-gen-env.mjs'), '--url', 'https://other.internal', '--out', envPath2,
  ], { stdio: 'pipe' })
  const second = readFileSync(envPath2, 'utf8')
  check('a second install gets different keys', !second.includes(env.ORBIT_SECRETS_KEY))

  let clobbered = true
  try {
    execFileSync(process.execPath, [
      join(ROOT, 'scripts', 'selfhost-gen-env.mjs'), '--url', 'https://x.test', '--out', envPath,
    ], { stdio: 'pipe' })
  } catch { clobbered = false }
  check('refuses to overwrite an existing .env without --force', !clobbered)

  // ------------------------------------------------------------
  console.log('\nCompose and gateway agree with each other')
  // ------------------------------------------------------------
  const compose = readFileSync(join(ROOT, 'docker', 'docker-compose.yml'), 'utf8')
  const locations = readFileSync(join(ROOT, 'docker', 'orbit-locations.inc'), 'utf8')
  const nginx = readFileSync(join(ROOT, 'docker', 'nginx.conf'), 'utf8')

  for (const svc of ['orbit-db', 'orbit-auth', 'orbit-rest', 'orbit-app', 'orbit-gateway']) {
    check(`compose defines ${svc}`, new RegExp(`^\\s{2}${svc}:`, 'm').test(compose))
  }
  // An upstream naming a service that doesn't exist fails only at runtime,
  // inside nginx, with a DNS error most operators won't recognise.
  for (const up of ['orbit-app:3000', 'orbit-rest:3000', 'orbit-auth:9999']) {
    check(`gateway upstream ${up} matches a compose service`, locations.includes(up))
  }
  // Upstreams must be resolved per request. Without this nginx resolves once
  // at startup and dies with "host not found in upstream" whenever a backend
  // is still booting — which it always is on a cold `compose up`.
  check('gateway resolves upstreams at request time', /resolver\s+127\.0\.0\.11/.test(nginx))
  check('gateway proxies via variables, not static upstream blocks',
    /proxy_pass http:\/\/\$orbit_app/.test(locations) && !/^upstream /m.test(nginx))
  // nginx refuses to start if an ssl_certificate path is missing, so TLS has
  // to be added conditionally or a certless install serves nothing at all.
  // Comments stripped: the file explains WHY TLS is conditional, and that
  // prose mentions ssl_certificate.
  const nginxCode = nginx.split('\n').filter(l => !l.trim().startsWith('#')).join('\n')
  check('TLS is not hardcoded into the always-loaded config', !nginxCode.includes('ssl_certificate'))
  check('TLS is enabled by an entrypoint script when certs exist',
    existsSync(join(ROOT, 'docker', 'nginx-entrypoint.d', '20-orbit-tls.sh')))
  check('the TLS script is mounted into the nginx entrypoint dir',
    compose.includes('/docker-entrypoint.d/20-orbit-tls.sh'))
  check('gateway proxies the paths supabase-js actually calls',
    locations.includes('/rest/v1/') && locations.includes('/auth/v1/'))
  check('gateway timeout clears the 300s maxDuration routes',
    /proxy_read_timeout\s+3[2-9]\ds/.test(locations))
  check('gateway forwards X-Forwarded-For (the rate limiter needs it)',
    nginx.includes('X-Forwarded-For'))
  check('streaming is not buffered by the gateway', locations.includes('proxy_buffering off'))
  check('app waits for a healthy database', /orbit-db:\s*\n\s*condition: service_healthy/.test(compose))
  // 13 migrations have foreign keys into auth.users, so GoTrue must have
  // migrated its schema before the app's migrations run.
  check('app waits for a healthy GoTrue', /orbit-auth:\s*\n\s*condition: service_healthy/.test(compose))
  check('GoTrue image is pinned, not :latest', /supabase\/gotrue:v[\d.]+/.test(compose))
  check('PostgREST image is pinned, not :latest', /postgrest\/postgrest:v[\d.]+/.test(compose))
  check('only the gateway publishes ports', (compose.match(/^\s{4}ports:/gm) ?? []).length === 1)
  check('public signup is disabled by default', compose.includes('GOTRUE_DISABLE_SIGNUP'))
  check('server-side Supabase calls use the internal URL', compose.includes('SUPABASE_INTERNAL_URL'))
  // The installer generates CRON_SECRET, but if compose doesn't pass it to the
  // app the cron routes fall back to "self-host with no secret = open".
  check('CRON_SECRET reaches the app container', /CRON_SECRET:\s*\$\{CRON_SECRET/.test(compose))
  check('required secrets fail fast if unset', compose.includes('ORBIT_SECRETS_KEY:?'))

  const initSh = readFileSync(join(ROOT, 'docker', 'postgres-init', '01-roles-and-schemas.sh'), 'utf8')
  for (const role of ['anon', 'authenticated', 'service_role', 'authenticator']) {
    check(`db init creates the ${role} role`, initSh.includes(role))
  }
  check('db init creates the auth schema GoTrue needs', initSh.includes('create schema if not exists auth'))
  check('db init enables pgcrypto', initSh.includes('pgcrypto'))
  // Both found by the selfhost CI job on its first run, and both fatal:
  // GoTrue's own migrations grant to a `postgres` role, and our migration 010
  // adds a table to the supabase_realtime publication.
  check('db init creates the postgres role GoTrue grants to', /rolname = 'postgres'/.test(initSh))
  check('db init creates the supabase_realtime publication', initSh.includes('create publication supabase_realtime'))

  const dockerfile = readFileSync(join(ROOT, 'docker', 'Dockerfile'), 'utf8')
  check('image does not bake NEXT_PUBLIC_SUPABASE_URL', !dockerfile.includes('NEXT_PUBLIC_SUPABASE_URL='))
  check('image runs as a non-root user', dockerfile.includes('adduser'))
  check('image ships the migrations it must apply on boot', dockerfile.includes('supabase/migrations'))
  check('image ships pg (standalone tracing misses it)', dockerfile.includes('node_modules/pg '))

  const dockerignore = readFileSync(join(ROOT, '.dockerignore'), 'utf8')
  check('.dockerignore keeps .env out of the build context', /^\.env$/m.test(dockerignore))
  check('.dockerignore keeps certs out of the build context', dockerignore.includes('docker/certs'))

  // ------------------------------------------------------------
  console.log('\nUpdate bundles are verified before they are applied')
  // ------------------------------------------------------------
  // tar is run with cwd set to the work dir and RELATIVE paths throughout:
  // GNU tar reads a `C:\…` argument as a remote host spec and fails with
  // "Cannot connect to C:", which has nothing to do with what's being tested.
  function makeBundle(name, { corrupt = false, unsafePath = false, badVersion = false } = {}) {
    const dir = join(work, name)
    mkdirSync(join(dir, 'images'), { recursive: true })
    const payload = Buffer.from(`fake image ${name}`)
    writeFileSync(join(dir, 'images', 'app.tar'), payload)
    const manifest = {
      version: badVersion ? 'not-a-version' : '1.2.3',
      files: [{
        path: unsafePath ? '../escape.tar' : 'images/app.tar',
        sha256: corrupt
          ? createHash('sha256').update('something else').digest('hex')
          : createHash('sha256').update(payload).digest('hex'),
      }],
    }
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
    execFileSync('tar', ['-czf', `${name}.tar.gz`, '-C', name, '.'], { cwd: work, stdio: 'pipe' })
    return `${name}.tar.gz`
  }

  function verify(bundle, extra = []) {
    try {
      execFileSync(process.execPath, [join(ROOT, 'scripts', 'verify-bundle.mjs'), bundle, ...extra],
        { cwd: work, stdio: 'pipe' })
      return true
    } catch {
      return false
    }
  }

  check('a well-formed unsigned bundle passes with --allow-unsigned',
    verify(makeBundle('good'), ['--allow-unsigned']))
  // The important one: an unsigned bundle is what an attacker can trivially
  // produce, so the default must be refusal.
  check('an unsigned bundle is REFUSED by default', !verify(makeBundle('good2')))
  check('a corrupted file is refused', !verify(makeBundle('corrupt', { corrupt: true }), ['--allow-unsigned']))
  check('a path escaping the bundle is refused',
    !verify(makeBundle('escape', { unsafePath: true }), ['--allow-unsigned']))
  check('a non-semver version is refused',
    !verify(makeBundle('badver', { badVersion: true }), ['--allow-unsigned']))
  check('a non-bundle file is refused', !verify('.env', ['--allow-unsigned']))

  // ------------------------------------------------------------
  console.log('\nOperator script')
  // ------------------------------------------------------------
  const orbitSh = readFileSync(join(ROOT, 'docker', 'orbit.sh'), 'utf8')
  for (const c of ['install', 'start', 'stop', 'status', 'logs', 'backup', 'update', 'rollback', 'support-bundle']) {
    check(`orbit.sh handles "${c}"`, new RegExp(`^\\s*${c}\\)`, 'm').test(orbitSh))
  }
  check('orbit.sh backs up before applying an update', /cmd_update\(\)[\s\S]*cmd_backup/.test(orbitSh))
  check('orbit.sh verifies a bundle before applying it', /cmd_update\(\)[\s\S]*verify-bundle/.test(orbitSh))
  check('support bundle redacts secrets', /ORBIT_SECRETS_KEY[^\n]*redacted/.test(orbitSh))
  check('rollback warns that data is not rolled back', /rollback[\s\S]*not the previous DATA/i.test(orbitSh))

  check('entrypoint tells PostgREST to reload after migrating',
    readFileSync(join(ROOT, 'docker', 'entrypoint.sh'), 'utf8').includes("notify pgrst"))
  check('entrypoint refuses to start without required env',
    readFileSync(join(ROOT, 'docker', 'entrypoint.sh'), 'utf8').includes('missing required environment'))
  check('instrumentation only starts the scheduler on self-host',
    readFileSync(join(ROOT, 'instrumentation.ts'), 'utf8').includes("ORBIT_EDITION !== 'selfhost'"))
  check('health route exists for the container healthcheck',
    existsSync(join(ROOT, 'app', 'api', 'health', 'route.ts')))
} finally {
  rmSync(work, { recursive: true, force: true })
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exitCode = failed === 0 ? 0 : 1
