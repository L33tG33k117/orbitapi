#!/usr/bin/env node
/**
 * Seeds the two fixture workspaces the live half of test-workspace-isolation.mjs
 * needs, so that half can run in CI instead of being skipped forever.
 *
 * Creates (idempotently — safe to re-run, it reuses whatever already exists):
 *
 *   Workspace "iso-A"  user ISO_A_EMAIL (admin)
 *                      + 1 simulated connection, 1 group holding it,
 *                        1 skill, 1 webhook endpoint
 *   Workspace "iso-B"  user ISO_B_EMAIL (admin)
 *                      + 1 group, 1 playbook
 *
 * The isolation test then signs in as both and proves nothing in B can touch
 * anything in A.
 *
 * Needs a service-role key, because it writes auth users:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ISO_A_EMAIL / ISO_A_PASSWORD / ISO_B_EMAIL / ISO_B_PASSWORD
 *
 * NEVER point this at production — it creates users. It refuses to run against
 * a project ref listed in PROD_REFS below.
 *
 *   node scripts/seed-isolation-fixtures.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const env = { ...process.env }
if (existsSync(join(ROOT, '.env.local'))) {
  for (const l of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

// Production project refs. Seeding invents users; doing that in production
// would be both a data problem and a security one.
const PROD_REFS = ['mbpsddqneemubmnhsthk']

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const need = (k) => { if (!env[k]) { console.error(`\n✗ ${k} is required\n`); process.exit(1) } }
;['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ISO_A_EMAIL', 'ISO_A_PASSWORD', 'ISO_B_EMAIL', 'ISO_B_PASSWORD'].forEach(need)

const ref = new URL(URL_).hostname.split('.')[0]
if (PROD_REFS.includes(ref)) {
  console.error(`\n✗ Refusing to seed fixtures into production project ${ref}.\n  Point NEXT_PUBLIC_SUPABASE_URL at the dev project.\n`)
  process.exit(1)
}

const db = createClient(URL_, KEY, { auth: { persistSession: false } })
const log = (m) => console.log(`  ${m}`)

/** Find an auth user by email, or create one with the password given. */
async function ensureUser(email, password) {
  // listUsers is paginated; the fixture project is small, but be explicit.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    const found = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (found) { log(`user ${email} already exists`); return found }
    if (data.users.length < 200) break
  }
  const { data, error } = await db.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  log(`created user ${email}`)
  return data.user
}

/** A workspace of this name that this user is already a member of, else a new one. */
async function ensureWorkspace(name, user) {
  const { data: existing } = await db
    .from('memberships').select('workspace_id, workspace:workspaces(id, name)').eq('user_id', user.id)
  const match = (existing ?? []).find(m => m.workspace?.name === name)
  if (match) { log(`workspace ${name} already exists`); return match.workspace_id }

  const { data: ws, error } = await db.from('workspaces').insert({ name }).select('id').single()
  if (error) throw new Error(`create workspace ${name}: ${error.message}`)
  const { error: mErr } = await db.from('memberships')
    .insert({ workspace_id: ws.id, user_id: user.id, role: 'owner' })
  if (mErr) throw new Error(`membership ${name}: ${mErr.message}`)
  await db.from('profiles').upsert({ id: user.id, email: user.email }, { onConflict: 'id' })
  log(`created workspace ${name}`)
  return ws.id
}

/** First row matching `match`, or an insert of `row`. */
async function ensureRow(table, match, row, label) {
  const q = db.from(table).select('id')
  for (const [k, v] of Object.entries(match)) q.eq(k, v)
  const { data } = await q.limit(1)
  if (data?.length) { log(`${label} already exists`); return data[0].id }
  const { data: made, error } = await db.from(table).insert(row).select('id').single()
  if (error) throw new Error(`${label}: ${error.message}`)
  log(`created ${label}`)
  return made.id
}

console.log(`\nSeeding isolation fixtures into ${ref}\n`)

// A simulated connection needs a connector row to point at. Reuse whatever the
// catalog sync put there; the isolation test never actually calls the provider.
const { data: connector } = await db.from('connectors').select('id, slug').limit(1).single()
if (!connector) {
  console.error('\n✗ No rows in public.connectors — run the app once so the catalog syncs, then re-run.\n')
  process.exit(1)
}

console.log('Workspace A')
const userA = await ensureUser(env.ISO_A_EMAIL, env.ISO_A_PASSWORD)
const wsA = await ensureWorkspace('iso-A', userA)
const connA = await ensureRow('connections',
  { workspace_id: wsA, label: 'iso-A connection' },
  { workspace_id: wsA, connector_id: connector.id, label: 'iso-A connection', status: 'active', is_simulated: true, created_by: userA.id },
  'connection')
const groupA = await ensureRow('groups',
  { workspace_id: wsA, name: 'iso-A group' },
  { workspace_id: wsA, name: 'iso-A group' },
  'group')
await ensureRow('group_connections',
  { group_id: groupA, connection_id: connA },
  { group_id: groupA, connection_id: connA },
  'group membership')
await ensureRow('skills',
  { workspace_id: wsA, name: 'iso-A skill' },
  { workspace_id: wsA, group_id: groupA, name: 'iso-A skill', persona: 'Fixture skill for isolation tests. Does nothing.' },
  'skill')
await ensureRow('webhook_endpoints',
  { workspace_id: wsA, name: 'iso-A endpoint' },
  { workspace_id: wsA, name: 'iso-A endpoint', token: `iso-a-${crypto.randomUUID()}`, signing_secret: crypto.randomUUID(), enabled: true },
  'webhook endpoint')

console.log('\nWorkspace B')
const userB = await ensureUser(env.ISO_B_EMAIL, env.ISO_B_PASSWORD)
const wsB = await ensureWorkspace('iso-B', userB)
const groupB = await ensureRow('groups',
  { workspace_id: wsB, name: 'iso-B group' },
  { workspace_id: wsB, name: 'iso-B group' },
  'group')
await ensureRow('playbooks',
  { workspace_id: wsB, name: 'iso-B playbook' },
  { workspace_id: wsB, group_id: groupB, name: 'iso-B playbook' },
  'playbook')

if (wsA === wsB) {
  console.error('\n✗ A and B resolved to the same workspace — the test would prove nothing.\n')
  process.exit(1)
}

console.log(`\n✓ Fixtures ready (A=${wsA}, B=${wsB})\n`)
