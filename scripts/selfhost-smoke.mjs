#!/usr/bin/env node
/**
 * End-to-end smoke test against a running self-hosted stack.
 *
 * This is the check that actually proves the containers work. Everything else
 * in the offline test suite verifies our files are internally consistent; this
 * one boots the real thing and drives it through a browser-shaped path:
 *
 *   1. the stack is healthy and the database is reachable
 *   2. the first-run wizard is offered, and creates a working admin
 *   3. that admin can sign in through the gateway (GoTrue + PostgREST both
 *      answering on one origin, which is the whole point of the gateway)
 *   4. a simulated connector can be created and run with NO AI configured
 *   5. the scheduler endpoint is reachable and authorised
 *   6. the wizard closes permanently once an account exists
 *
 * Deliberately uses no AI: a CI runner has no local model, and simulated
 * connectors are exactly what a customer explores with on day one.
 *
 *   node scripts/selfhost-smoke.mjs [--url http://localhost]
 */

const BASE = (process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : process.env.ORBIT_SMOKE_URL || 'http://localhost').replace(/\/$/, '')

const ADMIN_EMAIL = `smoke-${Date.now()}@example.test`
const ADMIN_PASSWORD = 'smoke-test-password-123'

let passed = 0
let failed = 0
const failures = []

function check(label, cond, detail) {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else {
    failed++
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`)
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

async function get(path, init) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual', ...init })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* not JSON */ }
  return { res, text, json }
}

// The app container can be healthy a moment before the gateway routes to it.
async function waitForHealthy(timeoutMs = 180_000) {
  const started = Date.now()
  let lastErr = 'no response'
  while (Date.now() - started < timeoutMs) {
    try {
      const { res, json } = await get('/api/health')
      if (res.ok && json?.status === 'ok') return json
      lastErr = `status ${res.status}${json ? ` (${json.status})` : ''}`
    } catch (e) {
      lastErr = String(e).slice(0, 120)
    }
    await new Promise(r => setTimeout(r, 3000))
  }
  throw new Error(`the stack never became healthy: ${lastErr}`)
}

console.log(`\nSmoke-testing ${BASE}\n`)

// ---- 1. health -------------------------------------------------------------
console.log('Stack health')
const health = await waitForHealthy()
check('health endpoint reports ok', health.status === 'ok')
check('the database is reachable', health.checks?.database === 'ok', JSON.stringify(health.checks))
check('it identifies as the self-hosted edition', health.edition === 'selfhost', health.edition)

// ---- 2. first-run wizard ---------------------------------------------------
console.log('\nFirst run')
{
  const { json } = await get('/api/setup')
  check('a fresh instance asks for setup', json?.needsSetup === true, JSON.stringify(json))
}
{
  // An unauthenticated visitor should be steered to the wizard, not to a
  // login page they could never get past.
  const { res } = await get('/dashboard')
  const location = res.headers.get('location') ?? ''
  check('an unauthenticated visit redirects to /setup',
    res.status >= 300 && res.status < 400 && location.includes('/setup'),
    `status ${res.status} → ${location || '(none)'}`)
}
{
  const { res, json } = await get('/api/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      fullName: 'Smoke Test',
      workspaceName: 'Smoke Workspace',
    }),
  })
  check('the first administrator is created', res.ok && json?.ok === true,
    json?.error ?? `status ${res.status}`)
}
{
  // The window must close permanently — otherwise anyone who can reach the
  // box could mint themselves an owner account on a running instance.
  const { res, json } = await get('/api/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'intruder@example.test', password: 'another-password-123' }),
  })
  check('setup refuses a second account', res.status === 409, `status ${res.status}`)
  check('and says so plainly', /already been set up/i.test(json?.error ?? ''), json?.error)
}
{
  const { json } = await get('/api/setup')
  check('setup is no longer offered', json?.needsSetup === false)
}

// ---- 3. auth through the gateway ------------------------------------------
// This is what proves the single-origin design: the browser reaches GoTrue at
// /auth/v1 on the same host as the app, with no CORS and no baked-in URL.
console.log('\nSign in through the gateway')
let accessToken = null
let refreshToken = null
let userRecord = null
{
  const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: process.env.ANON_KEY ?? '' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  const json = await res.json().catch(() => null)
  accessToken = json?.access_token ?? null
  refreshToken = json?.refresh_token ?? null
  userRecord = json?.user ?? null
  check('GoTrue answers on /auth/v1 and issues a token', !!accessToken,
    json?.error_description ?? json?.msg ?? `status ${res.status}`)
}
{
  const res = await fetch(`${BASE}/rest/v1/workspaces?select=id,name&limit=1`, {
    headers: {
      apikey: process.env.ANON_KEY ?? '',
      Authorization: `Bearer ${accessToken ?? ''}`,
    },
  })
  const rows = await res.json().catch(() => null)
  check('PostgREST answers on /rest/v1', res.ok, `status ${res.status}`)
  check('the wizard provisioned a workspace', Array.isArray(rows) && rows.length === 1,
    JSON.stringify(rows)?.slice(0, 200))
}

// ---- 4. a connector works with no AI --------------------------------------
// The app's own routes authenticate from a COOKIE, not a bearer token —
// they're called by a browser, not by API clients. So we build the session
// cookie @supabase/ssr expects rather than reusing the token above.
console.log('\nSimulated connector (no AI configured)')
{
  // @supabase/ssr names its cookie from the "project ref", which it takes as
  // the first hostname label of the Supabase URL. Self-host points the server
  // at SUPABASE_INTERNAL_URL (http://orbit-gateway), so the ref is the
  // container name.
  const internal = process.env.SUPABASE_INTERNAL_URL || 'http://orbit-gateway'
  const ref = new URL(internal).hostname.split('.')[0]
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: userRecord,
  }
  // @supabase/ssr prefixes the value with `base64-` and uses STANDARD base64.
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`

  const authed = { 'Content-Type': 'application/json', cookie }

  // redirect: 'manual' throughout — a session that isn't accepted shows up as
  // a redirect to /login, and following it would just loop.
  const create = await fetch(`${BASE}/api/connections`, {
    method: 'POST',
    redirect: 'manual',
    headers: authed,
    body: JSON.stringify({
      connectorSlug: 'simulated-lights',
      label: 'Smoke Lights',
      credentials: {},
      isSimulated: true,
    }),
  })
  const created = await create.json().catch(() => null)
  check('the app accepts a browser session cookie', create.status !== 401 && create.status < 300,
    `status ${create.status}`)
  check('a simulated connection can be created', create.ok && !!created?.connection?.id,
    created?.error ?? `status ${create.status}`)

  if (created?.connection?.id) {
    const run = await fetch(`${BASE}/api/execute`, {
      method: 'POST',
      redirect: 'manual',
      headers: authed,
      body: JSON.stringify({
        connectionId: created.connection.id,
        actionSlug: 'list_devices',
        params: {},
      }),
    })
    const result = await run.json().catch(() => null)
    check('a simulated action runs without any AI configured', run.ok,
      result?.error ?? `status ${run.status}`)
  }
}

// An unauthenticated call must not succeed. The app answers these with a
// redirect to /login rather than a 401 — that predates the offline work and is
// the same on cloud, so this asserts "refused", not a specific status.
{
  const { res } = await get('/api/connections')
  check('an unauthenticated API call is refused', res.status !== 200, `status ${res.status}`)
}

// ---- 5. the scheduler's entry point ---------------------------------------
console.log('\nScheduled work')
{
  const secret = process.env.CRON_SECRET
  const { res } = await get('/api/cron/skills', {
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  })
  check('the cron endpoint accepts an authorised call', res.status === 200, `status ${res.status}`)
}
{
  const { res } = await get('/api/cron/skills', { headers: { Authorization: 'Bearer wrong' } })
  check('and rejects a wrong secret', res.status === 401, `status ${res.status}`)
}

// ---- 6. cloud-only surfaces are absent ------------------------------------
console.log('\nCloud-only surfaces are gone')
for (const path of ['/upgrade', '/pricing', '/settings/billing']) {
  const { res } = await get(path)
  check(`${path} is not served`, res.status === 404, `status ${res.status}`)
}

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed) {
  console.log('Failures:')
  for (const f of failures) console.log(`  • ${f}`)
  console.log('')
}
process.exitCode = failed === 0 ? 0 : 1
