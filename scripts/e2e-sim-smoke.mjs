// End-to-end smoke test of the simulation workflow against a running server
// (npm run start, http://localhost:3000). Creates a disposable confirmed user,
// walks the exact path the setup wizard + connectors UI take, prints timings,
// and deletes the user + workspace afterwards.
//
//   node --no-warnings scripts/e2e-sim-smoke.mjs
//
// Requires .env.local (SUPABASE url + anon + service role). Never prints secrets.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const BASE = process.env.ORBIT_BASE_URL ?? 'http://localhost:3000'

// --- env ---------------------------------------------------------------
const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !ANON || !SERVICE) { console.error('missing supabase env'); process.exit(1) }
const REF = new URL(URL_).hostname.split('.')[0]

const adminSb = createClient(URL_, SERVICE, { auth: { persistSession: false } })
const anonSb = createClient(URL_, ANON, { auth: { persistSession: false } })

// --- helpers -----------------------------------------------------------
let cookieHeader = ''
function buildCookie(session) {
  const raw = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
  const name = `sb-${REF}-auth-token`
  const MAX = 3180
  if (raw.length <= MAX) return `${name}=${raw}`
  const parts = []
  for (let i = 0; i * MAX < raw.length; i++) parts.push(`${name}.${i}=${raw.slice(i * MAX, (i + 1) * MAX)}`)
  return parts.join('; ')
}

const results = []
async function step(name, fn) {
  const t0 = Date.now()
  try {
    const out = await fn()
    const ms = Date.now() - t0
    results.push({ name, ok: true, ms })
    console.log(`PASS  ${String(ms).padStart(6)}ms  ${name}${out ? ' — ' + out : ''}`)
    return true
  } catch (e) {
    const ms = Date.now() - t0
    results.push({ name, ok: false, ms })
    console.log(`FAIL  ${String(ms).padStart(6)}ms  ${name} — ${e.message}`)
    return false
  }
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  let data = null
  try { data = await res.json() } catch { /* non-JSON */ }
  return { status: res.status, data }
}
function expect(cond, msg) { if (!cond) throw new Error(msg) }
const short = (v, n = 140) => JSON.stringify(v ?? null).slice(0, n)

// --- test --------------------------------------------------------------
const email = `orbit-sim-test-${Date.now()}@example.com`
const password = 'SimTest!' + Math.random().toString(36).slice(2, 10)
let userId, workspaceId, lightsConnId, zendeskConnId, skillId

// 1. user
await step('create confirmed test user', async () => {
  const { data, error } = await adminSb.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(error.message)
  userId = data.user.id
  return email
})

// 2. session cookie
await step('sign in + build session cookie', async () => {
  const { data, error } = await anonSb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  cookieHeader = buildCookie(data.session)
  return `cookie ${cookieHeader.length} chars`
})

// 3. workspace (onboarding step)
await step('POST /api/workspaces (onboarding)', async () => {
  const { status, data } = await api('POST', '/api/workspaces', { name: 'Sim Smoke Test' })
  expect(status === 200 || status === 201, `status ${status}: ${short(data)}`)
  workspaceId = data?.workspace?.id ?? data?.id
  expect(workspaceId, `no workspace id in ${short(data)}`)
})

// 4. simulated lights connection (wizard step 1)
await step('POST /api/connections simulated-lights (wizard step 1)', async () => {
  const { status, data } = await api('POST', '/api/connections', {
    connectorSlug: 'simulated-lights', label: 'Smart Lights (demo)', credentials: {}, isSimulated: true,
  })
  expect(status === 201, `status ${status}: ${short(data)}`)
  lightsConnId = data.connection.id
})

// 5. read action
await step('POST /api/execute list_devices (read)', async () => {
  const { status, data } = await api('POST', '/api/execute', {
    connectionId: lightsConnId, actionSlug: 'list_devices', params: {},
  })
  expect(status === 200 && data.ok, `status ${status}: ${short(data)}`)
  return short(data.data)
})

// 6. arbitrary catalog connector in simulated mode (the big claim)
await step('POST /api/connections zendesk SIMULATED (any-connector sim)', async () => {
  const { status, data } = await api('POST', '/api/connections', {
    connectorSlug: 'zendesk', label: 'Zendesk (demo)', credentials: {}, isSimulated: true,
  })
  expect(status === 201, `status ${status}: ${short(data)}`)
  zendeskConnId = data.connection.id
})

await step('POST /api/execute zendesk list_tickets (LLM world, read)', async () => {
  const { status, data } = await api('POST', '/api/execute', {
    connectionId: zendeskConnId, actionSlug: 'list_tickets', params: { status: 'open' },
  })
  expect(status === 200 && data.ok, `status ${status}: ${short(data)}`)
  return short(data.data)
})

await step('POST /api/execute zendesk create_ticket (LLM world, write)', async () => {
  const { status, data } = await api('POST', '/api/execute', {
    connectionId: zendeskConnId, actionSlug: 'create_ticket',
    params: { subject: 'Wifi down in cabin 4', description: 'Guest reports no wifi since 9am', priority: 'high' },
  })
  expect(status === 200 && data.ok, `status ${status}: ${short(data)}`)
  return short(data.data)
})

await step('read-after-write consistency (new ticket visible)', async () => {
  const { status, data } = await api('POST', '/api/execute', {
    connectionId: zendeskConnId, actionSlug: 'search_tickets', params: { query: 'Wifi down' },
  })
  expect(status === 200 && data.ok, `status ${status}: ${short(data)}`)
  const s = JSON.stringify(data.data).toLowerCase()
  expect(s.includes('wifi'), `created ticket not found in search: ${short(data.data)}`)
  return short(data.data)
})

// 7. skill (wizard step 2)
await step('POST /api/skills (wizard step 2)', async () => {
  const { status, data } = await api('POST', '/api/skills', {
    name: 'My first skill — Smart Lights',
    description: 'Read-only starter skill.',
    persona: 'You are a smart-home assistant managing simulated smart lights. List every light and report its state. Read-only; change nothing.',
    autonomy: 'manual',
  })
  expect(status === 200 || status === 201, `status ${status}: ${short(data)}`)
  skillId = data.id
  expect(skillId, `no skill id in ${short(data)}`)
})

// 8. run it (wizard step 3) — real AI run on trial credits
await step('POST /api/skills/:id/run live (wizard step 3, AI run)', async () => {
  const { status, data } = await api('POST', `/api/skills/${skillId}/run`, { mode: 'live' })
  expect(status === 200 || status === 201, `status ${status}: ${short(data, 300)}`)
  return short(data, 200)
})

await step('GET /api/skills/:id/runs (run recorded with steps)', async () => {
  const { status, data } = await api('GET', `/api/skills/${skillId}/runs`)
  expect(status === 200, `status ${status}`)
  const runs = Array.isArray(data) ? data : data?.runs ?? []
  expect(runs.length >= 1, 'no runs recorded')
  const r = runs[0]
  return `status=${r.status} steps=${(r.steps ?? []).length}`
})

// 9. cleanup
await step('cleanup (delete workspace + user)', async () => {
  if (workspaceId) await adminSb.from('workspaces').delete().eq('id', workspaceId)
  if (userId) await adminSb.auth.admin.deleteUser(userId)
})

const failed = results.filter(r => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} steps passed`)
process.exit(failed ? 1 : 0)
