/**
 * Phase 0 acceptance test
 * Spins up two test users with separate workspaces, verifies RLS isolation,
 * tests the invite flow, then cleans up.
 *
 * Run: node scripts/test-phase0.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// ── env ──────────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const URL  = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SVC  = env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !ANON || !SVC) { console.error('Missing env vars'); process.exit(1) }

// ── clients ───────────────────────────────────────────────────────────────────
const admin = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } })

function anonClient() {
  return createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function signIn(email, password) {
  const c = anonClient()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`)
  return c
}

// ── reporter ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0
function ok(msg)         { passed++; console.log(`  ✓  ${msg}`) }
function fail(msg, why)  { failed++; console.error(`  ✗  ${msg}\n       → ${why}`) }
function section(title)  { console.log(`\n── ${title} ──`) }

// ── test data ─────────────────────────────────────────────────────────────────
const A = { email: 'orbit-test-a@example.invalid', password: 'TestPassA1!', workspace: 'Workspace Alpha' }
const B = { email: 'orbit-test-b@example.invalid', password: 'TestPassB1!', workspace: 'Workspace Beta' }

// ── helpers ───────────────────────────────────────────────────────────────────
async function deleteTestUser(email) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const u = data?.users.find(u => u.email === email)
  if (u) await admin.auth.admin.deleteUser(u.id)
}

async function createTestUser({ email, password, workspace }) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    user_metadata: { full_name: `Test ${workspace}`, workspace_name: workspace },
    email_confirm: true,
  })
  if (error) throw new Error(`createUser(${email}): ${error.message}`)
  return data.user
}

// ── main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log('Phase 0 — acceptance tests')

  // ── setup ─────────────────────────────────────────────────────────────────
  section('Setup')
  await deleteTestUser(A.email)
  await deleteTestUser(B.email)

  const userA = await createTestUser(A)
  const userB = await createTestUser(B)
  // Allow trigger to complete
  await new Promise(r => setTimeout(r, 800))
  console.log('  Two test users created with separate workspaces.')

  // ── 1. sign-in ────────────────────────────────────────────────────────────
  section('1. Sign-in')
  let cA, cB
  try { cA = await signIn(A.email, A.password); ok('User A can sign in') }
  catch (e) { fail('User A sign-in', e.message); process.exit(1) }
  try { cB = await signIn(B.email, B.password); ok('User B can sign in') }
  catch (e) { fail('User B sign-in', e.message); process.exit(1) }

  // ── 2. workspace auto-created ─────────────────────────────────────────────
  section('2. Workspace auto-created on signup (trigger)')
  const { data: wsA } = await cA.from('workspaces').select('id, name')
  const { data: wsB } = await cB.from('workspaces').select('id, name')

  wsA?.length === 1 && wsA[0].name === A.workspace
    ? ok(`User A sees exactly their workspace ("${wsA[0].name}")`)
    : fail('User A workspace', `got ${JSON.stringify(wsA)}`)

  wsB?.length === 1 && wsB[0].name === B.workspace
    ? ok(`User B sees exactly their workspace ("${wsB[0].name}")`)
    : fail('User B workspace', `got ${JSON.stringify(wsB)}`)

  const wAId = wsA?.[0]?.id
  const wBId = wsB?.[0]?.id

  // ── 3. RLS: workspace isolation ───────────────────────────────────────────
  section('3. RLS — workspace cross-contamination check')

  // User A must not see Workspace Beta
  !(wsA ?? []).find(w => w.name === B.workspace)
    ? ok('User A cannot see User B\'s workspace')
    : fail('User A cannot see User B\'s workspace', 'Workspace Beta appeared in A\'s results')

  // User B must not see Workspace Alpha
  !(wsB ?? []).find(w => w.name === A.workspace)
    ? ok('User B cannot see User A\'s workspace')
    : fail('User B cannot see User A\'s workspace', 'Workspace Alpha appeared in B\'s results')

  // ── 4. RLS: memberships isolation ─────────────────────────────────────────
  section('4. RLS — memberships isolation')
  const { data: memA } = await cA.from('memberships').select('workspace_id, role')
  const { data: memB } = await cB.from('memberships').select('workspace_id, role')

  memA?.length === 1 && memA[0].workspace_id === wAId
    ? ok('User A sees only their own membership row')
    : fail('User A membership isolation', JSON.stringify(memA))

  memB?.length === 1 && memB[0].workspace_id === wBId
    ? ok('User B sees only their own membership row')
    : fail('User B membership isolation', JSON.stringify(memB))

  memA?.[0]?.role === 'owner'
    ? ok('Workspace creator gets role "owner"')
    : fail('Workspace creator role', `got "${memA?.[0]?.role}"`)

  // ── 5. RLS: no cross-workspace data leakage ───────────────────────────────
  section('5. RLS — cross-workspace data cannot be read directly by ID')

  // User A tries to read User B's workspace by ID — should return empty
  const { data: leak1 } = await cA.from('workspaces').select('id').eq('id', wBId)
  !leak1?.length
    ? ok('User A cannot read Workspace B by ID (returned empty)')
    : fail('User A cannot read Workspace B by ID', `leaked: ${JSON.stringify(leak1)}`)

  // User B tries to read User A's workspace by ID
  const { data: leak2 } = await cB.from('workspaces').select('id').eq('id', wAId)
  !leak2?.length
    ? ok('User B cannot read Workspace A by ID (returned empty)')
    : fail('User B cannot read Workspace A by ID', `leaked: ${JSON.stringify(leak2)}`)

  // User A tries to read User B's memberships by workspace_id
  const { data: leak3 } = await cA.from('memberships').select('id').eq('workspace_id', wBId)
  !leak3?.length
    ? ok('User A cannot read Workspace B\'s memberships by workspace_id')
    : fail('User A cannot read Workspace B memberships', `leaked: ${JSON.stringify(leak3)}`)

  // ── 6. Invite member ──────────────────────────────────────────────────────
  section('6. Invite member — User A invites User B into Workspace A')
  const { error: invErr } = await admin
    .from('memberships')
    .insert({ workspace_id: wAId, user_id: userB.id, role: 'member' })

  if (invErr) { fail('Insert membership (admin)', invErr.message) }
  else { ok('Membership row inserted') }

  // Re-sign-in User B to refresh session claims
  cB = await signIn(B.email, B.password)

  const { data: wsAfterInvite } = await cB.from('workspaces').select('name')
  const names = wsAfterInvite?.map(w => w.name) ?? []

  names.includes(A.workspace)
    ? ok('Invited user can now see Workspace A')
    : fail('Invited user can see Workspace A', `visible: ${JSON.stringify(names)}`)

  // User B should see exactly 2 workspaces (their own + the invited one)
  names.length === 2
    ? ok('Invited user sees exactly 2 workspaces — no leakage beyond what they belong to')
    : fail('Invited user workspace count', `expected 2, got ${names.length}: ${JSON.stringify(names)}`)

  // ── 7. Member cannot see unrelated workspace's memberships ───────────────
  section('7. RLS — invited member still cannot read unrelated data')

  // Create a third workspace via admin and check B can't see it
  const { data: wsC } = await admin.from('workspaces').insert({ name: 'Workspace Gamma (unrelated)' }).select('id').single()
  const { data: leak4 } = await cB.from('workspaces').select('id').eq('id', wsC?.id)
  !leak4?.length
    ? ok('Member cannot read an unrelated workspace even by ID')
    : fail('Member cannot read unrelated workspace', `leaked: ${JSON.stringify(leak4)}`)
  if (wsC?.id) await admin.from('workspaces').delete().eq('id', wsC.id)

  // ── cleanup ───────────────────────────────────────────────────────────────
  section('Cleanup')
  await deleteTestUser(A.email)  // cascades: profiles, memberships
  await deleteTestUser(B.email)
  // Workspaces have no user FK so delete explicitly
  if (wAId) await admin.from('workspaces').delete().eq('id', wAId)
  if (wBId) await admin.from('workspaces').delete().eq('id', wBId)
  console.log('  Test users and workspaces deleted.')

  // ── summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`)
  console.log(`  ${passed} passed  |  ${failed} failed`)
  console.log('─'.repeat(40))
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => { console.error('\nUnhandled error:', e); process.exit(1) })
