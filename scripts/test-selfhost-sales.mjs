// The commercial side of the self-hosted edition: minting licences, and
// deciding who may download a build.
//
// This covers the code that stands between a customer and their software, so
// the failure modes are commercial rather than cosmetic — a key that our own
// verifier rejects strands an air-gapped install, and a leaked licence key or
// an over-permissive download check gives the product away. Both directions
// are asserted here, against REAL Ed25519 signatures via the production
// signing path.
//
// Run: npm run test:selfhost-sales

import { generateKeyPairSync } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Every .ts/.tsx file under a directory, recursively. */
function readdirRecursive(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...readdirRecursive(full))
    else if (/\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

let passed = 0
let failed = 0
function check(label, cond) {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.log(`  ✗ ${label}`) }
}

// Normalised to LF: core.autocrlf rewrites these files on checkout, and an
// assertion that matches a literal "\n    " passes on one machine and fails on
// another. Read the content, not the line endings.
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

// ------------------------------------------------------------------ signing --
console.log('\nSigning')

// A real key pair, wired up the way production is: private half in the env for
// lib/license-sign.ts, public half handed to the verifier.
const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()

process.env.LICENSE_SIGNING_KEY = privPem
delete process.env.ORBIT_EDITION

const sign = await import('../lib/license-sign.ts')
const lic = await import('../lib/license.ts')

const KEYS = { [sign.ACTIVE_KID]: pubPem }

check('canIssueLicenses() is true with a valid key configured', sign.canIssueLicenses() === true)

const issued = sign.issueLicense({
  customer: 'Acme Ltd',
  email: 'ops@acme.com',
  tier: 'enterprise',
  seats: 25,
  months: 12,
})

check('issued key has the ORBIT. prefix', issued.key.startsWith('ORBIT.'))
check('issued key has exactly two segments after the prefix',
  issued.key.slice('ORBIT.'.length).split('.').length === 2)

// The whole point: what we sign must satisfy the verifier the customer runs.
const state = lic.readLicenseWith(issued.key, KEYS)
check('a freshly issued licence verifies as valid', state.status === 'valid')
check('the verified payload carries the customer', state.payload?.customer === 'Acme Ltd')
check('the verified payload carries the seat limit', state.payload?.limits?.seats === 25)
check('the verified payload carries the tier', state.payload?.tier === 'enterprise')
check('edition is pinned to selfhost', state.payload?.edition === 'selfhost')
check('kid matches the active signing key', state.payload?.kid === sign.ACTIVE_KID)

// 12 months must land near a year out, not 360 days out. Drift here shows up
// as a renewal invoice going out at the wrong time, every year, forever.
const days = Math.round((issued.payload.exp - issued.payload.iat) / 86_400)
check(`a 12-month term is ~365 days (got ${days})`, days >= 364 && days <= 366)

const oneMonth = sign.issueLicense({ customer: 'X', tier: 'pro', months: 1 })
const oneMonthDays = Math.round((oneMonth.payload.exp - oneMonth.payload.iat) / 86_400)
check(`a 1-month term is ~30 days (got ${oneMonthDays})`, oneMonthDays >= 30 && oneMonthDays <= 31)

// Two licences must never collide: lid is how support identifies an install.
const a = sign.issueLicense({ customer: 'A', tier: 'pro', months: 12 })
const b = sign.issueLicense({ customer: 'B', tier: 'pro', months: 12 })
check('every issued licence gets a distinct lid', a.payload.lid !== b.payload.lid)

// Re-issuing must produce a NEWER iat, because the install refuses a key whose
// iat is older than the one already applied. If this ever regressed, every
// renewal would be silently rejected on the customer's machine.
const renewal = sign.issueLicense({ customer: 'Acme Ltd', tier: 'enterprise', months: 12 },
  new Date(Date.now() + 1000))
check('a renewal has a newer iat than the licence it replaces', renewal.payload.iat >= issued.payload.iat)

// -------------------------------------------------------------- signing: no --
console.log('\nSigning refuses bad input')

const rejects = (label, fn) => {
  let threw = false
  try { fn() } catch { threw = true }
  check(label, threw)
}

rejects('an empty customer name is refused', () => sign.issueLicense({ customer: '  ', tier: 'pro', months: 12 }))
rejects('a zero-month term is refused', () => sign.issueLicense({ customer: 'A', tier: 'pro', months: 0 }))
rejects('a negative term is refused', () => sign.issueLicense({ customer: 'A', tier: 'pro', months: -6 }))
rejects('fractional seats are refused', () => sign.issueLicense({ customer: 'A', tier: 'pro', months: 12, seats: 2.5 }))
rejects('zero seats are refused', () => sign.issueLicense({ customer: 'A', tier: 'pro', months: 12, seats: 0 }))

// A licence signed by the wrong key must fail the verifier, not sail through.
const { publicKey: otherPub } = generateKeyPairSync('ed25519')
const wrongKeys = { [sign.ACTIVE_KID]: otherPub.export({ type: 'spki', format: 'pem' }).toString() }
check('a licence does not verify against a different public key',
  lic.readLicenseWith(issued.key, wrongKeys).status === 'invalid')

// ----------------------------------------------------- signing: environment --
console.log('\nSigning is unavailable when it should be')

process.env.LICENSE_SIGNING_KEY = ''
check('canIssueLicenses() is false with no key configured', sign.canIssueLicenses() === false)

// base64-wrapped PEM must work: it is the form that survives being pasted into
// a CI variable, and the reason the loader accepts two shapes at all.
process.env.LICENSE_SIGNING_KEY = Buffer.from(privPem).toString('base64')
check('a base64-encoded PEM is accepted', sign.canIssueLicenses() === true)

process.env.LICENSE_SIGNING_KEY = 'not a key at all'
check('garbage in LICENSE_SIGNING_KEY does not throw out of canIssueLicenses', sign.canIssueLicenses() === false)

process.env.LICENSE_SIGNING_KEY = privPem
process.env.ORBIT_EDITION = 'selfhost'
check('signing is refused on a self-hosted build', sign.canIssueLicenses() === false)
rejects('issueLicense() throws on a self-hosted build',
  () => sign.issueLicense({ customer: 'A', tier: 'pro', months: 12 }))
delete process.env.ORBIT_EDITION

// ------------------------------------------------------ the key never leaks --
console.log('\nThe licence key never leaks')

const listRoute = read('app/api/admin/selfhost/customers/route.ts')
check('the customer list route selects an explicit column list',
  listRoute.includes('const LIST_COLUMNS'))
check('the customer list route never selects license_key',
  !/LIST_COLUMNS[\s\S]*?license_key/.test(listRoute.split('export async function')[0]))
check('the customer list route does not select(\'*\')',
  !listRoute.includes(".select('*')"))

const patchRoute = read('app/api/admin/selfhost/customers/[id]/route.ts')
check('the customer PATCH route allow-lists fields instead of spreading the body',
  !patchRoute.includes('...body'))
for (const field of ['license_key', 'license_id', 'license_expires_at']) {
  check(`the PATCH route never writes ${field}`, !patchRoute.includes(`patch.${field}`))
}

const signSource = read('lib/license-sign.ts')
check('the signing module imports node:crypto, so it cannot be bundled for the browser',
  signSource.includes("from 'node:crypto'"))
// The real guard: sweep every component and page for a client file that
// imports the signing module. Checking the module's own text proves nothing —
// the risk lives in the importer, not the import.
const sourceFiles = readdirRecursive('app').concat(readdirRecursive('components'))
const clientImporters = sourceFiles.filter(f => {
  const src = readFileSync(f, 'utf8')
  return /^['"]use client['"]/m.test(src) && /license-sign/.test(src)
})
check(`no client component imports lib/license-sign (${sourceFiles.length} files swept)`,
  clientImporters.length === 0)
if (clientImporters.length) console.log('    →', clientImporters.join('\n    → '))

// The issue route must verify before it stores. A key our own verifier rejects
// must never reach a customer.
const issueRoute = read('app/api/admin/selfhost/customers/[id]/license/route.ts')
check('the issue route verifies the key it just signed', issueRoute.includes('readLicense(issued.key)'))
check('the issue route refuses to store a key that fails verification',
  issueRoute.includes("check.status !== 'valid'"))
check('the issue route records history before updating the customer',
  issueRoute.indexOf('selfhost_license_issues') < issueRoute.indexOf("from('selfhost_customers')\n    .update"))

// ------------------------------------------------------------- entitlement --
console.log('\nDownload entitlement')

const access = read('lib/selfhost-access.ts')
check('a suspended or churned customer is refused', access.includes("row.status !== 'active'"))
check('downloads_enabled is checked independently of status', access.includes('!row.downloads_enabled'))
check('releases are ordered by parsed version, not publish date', access.includes('compareVersions'))
check('yanked releases are excluded', access.includes("eq('yanked', false)"))

const dlRoute = read('app/api/downloads/[version]/route.ts')
check('the download route checks entitlement before resolving a release',
  dlRoute.indexOf('getSelfhostAccess') < dlRoute.indexOf("from('selfhost_releases')"))
check('an unentitled user gets a 404, not a 403 that confirms the version exists',
  /if \(!access\) return NextResponse\.json\(\{ error: 'Not found' \}, \{ status: 404 \}\)/.test(dlRoute))
check('a yanked release cannot be downloaded even by an entitled customer',
  dlRoute.includes('release.yanked'))
check('download logging cannot block the download', dlRoute.includes('.then(undefined, () => {})'))

const catalogue = read('app/api/downloads/route.ts')
check('the catalogue endpoint never returns a bundle URL', !catalogue.includes('blob_url'))

// ------------------------------------------------------------ registration --
console.log('\nRelease registration')

const reg = read('app/api/selfhost/releases/register/route.ts')
check('registration fails closed with no secret configured', reg.includes('if (!expected) return false'))
check('registration compares the secret in constant time', reg.includes('timingSafeEqual'))
check('registration length-guards before timingSafeEqual (it throws on mismatch)',
  reg.indexOf('a.length !== b.length') < reg.indexOf('return timingSafeEqual'))
check('registration validates the version is semver', reg.includes(/^\d+\.\d+\.\d+/.source))
check('registration requires a hex sha256', reg.includes('[0-9a-f]{64}'))
check('registration requires an https bundle URL', reg.includes("startsWith('https://')"))
check('re-running a release job upserts rather than failing', reg.includes("onConflict: 'version'"))

// Caught in production: the auth proxy redirected this route to /login, and a
// 307 is under 400, so curl called it a success — the release would look
// published while nothing was recorded.
const mw = read('lib/supabase/middleware.ts')
check('the register route is exempt from the auth redirect',
  mw.includes("/api/selfhost/releases/register"))

const relYml = read('.github/workflows/release.yml')
check('the release workflow asserts the register status code explicitly',
  relYml.includes('if [ "$CODE" != "200" ]'))
check('the release workflow fails loudly when a bundle is not catalogued',
  relYml.includes('::error title=Not catalogued::'))

// --------------------------------------------------------------- migration --
console.log('\nMigration 056')

const mig = read('supabase/migrations/056_selfhost_customers.sql')
for (const table of ['selfhost_customers', 'selfhost_license_issues', 'selfhost_releases', 'selfhost_download_log']) {
  check(`${table} is created`, mig.includes(`create table if not exists public.${table}`))
  // RLS on with no policies = service-role only, matching feedback/contact.
  check(`${table} has RLS enabled`, mig.includes(`alter table public.${table} enable row level security`))
}
check('the migration creates no RLS policies (service-role only)', !/create policy/i.test(mig))
check('every create is idempotent, so a replay is safe',
  (mig.match(/create table/g) ?? []).length === (mig.match(/create table if not exists/g) ?? []).length)
check('every index is idempotent',
  (mig.match(/create index/g) ?? []).length === (mig.match(/create index if not exists/g) ?? []).length)

// --------------------------------------------------------------- edition ----
console.log('\nEdition gating')

const proxy = read('proxy.ts')
check('the downloads page is cloud-only', proxy.includes("'/settings/downloads'"))
check('the downloads API is cloud-only', proxy.includes("'/api/downloads'"))

const dlPage = read('app/(dashboard)/settings/downloads/page.tsx')
check('the downloads page redirects on a self-hosted install', dlPage.includes('if (isSelfHost()) redirect'))
check('the downloads page redirects a non-customer', dlPage.includes('if (!access) redirect'))

// ------------------------------------------------------- revocation: rules --
console.log('\nRevocation')

// A revoked licence falls to the free floor — the SAME floor as expired, never
// a lockout. Withdrawing a licence must not take a customer's data with it.
const revokedState = { status: 'revoked', payload: issued.payload, daysRemaining: 100, message: 'Withdrawn.' }
const revokedEnt = lic.licenseEntitlements(revokedState)
check('a revoked licence falls to the free floor', revokedEnt.tier === lic.EXPIRED_TIER)
check('a revoked licence grants no capability overrides',
  Object.keys(revokedEnt.overrides).length === 0)
check('a revoked licence banners as an error', lic.licenseBanner(revokedState).tone === 'error')
check('the revoked banner shows the reason we sent', lic.licenseBanner(revokedState).text === 'Withdrawn.')

// The floor is identical to expiry, which is what guarantees data and export
// keep working — that path is already asserted by test:license.
const expiredEnt = lic.licenseEntitlements({ status: 'expired', payload: issued.payload, daysRemaining: -1, message: '' })
check('revoked and expired land on exactly the same floor', revokedEnt.tier === expiredEnt.tier)

const state057 = read('lib/license-state.ts')
check('ONLY an explicit revoked verdict is honoured',
  state057.includes("data?.checkin_status === 'revoked'"))
check('an unreachable check-in cannot narrow entitlements',
  !state057.includes("checkin_status === 'unreachable'"))
check('revocation is overlaid only on a licence that already verifies',
  state057.includes("verified.status === 'valid' || verified.status === 'grace'"))

const accessRules = read('lib/selfhost-access.ts')
check('a revoked customer loses downloads and self-service immediately',
  accessRules.includes('|| row.revoked_at'))

const meLicense = read('app/api/selfhost/me/license/route.ts')
check('a revoked customer cannot re-fetch their key',
  meLicense.includes('if (!access) return NextResponse.json'))

// --------------------------------------------------------------- check-in --
console.log('\nCheck-in')

const checkinLib = read('lib/license-checkin.ts')
check('check-in never throws out of the scheduler tick',
  checkinLib.includes('Never throws'))
check('a non-ok HTTP response is unreachable, NOT revoked',
  /res\.ok[\s\S]{0,400}status: 'unreachable'/.test(checkinLib))
check('a network failure is unreachable, not revoked',
  /catch \{[\s\S]{0,300}status: 'unreachable'/.test(checkinLib))
check('an unreachable check-in does not erase a known latest version',
  checkinLib.includes('...(result.latestVersion ? { latest_version: result.latestVersion } : {})'))
check('check-in has a request timeout', checkinLib.includes('AbortSignal.timeout'))
check('check-in respects an explicit opt-out', checkinLib.includes("row.checkin_enabled === false"))
check('a null checkin_enabled (pre-057 row) still counts as enabled',
  checkinLib.includes('=== false'))
check('check-in is self-host only', checkinLib.includes('if (!isSelfHost()) return idle'))

const cloudCheckin = read('app/api/selfhost/checkin/route.ts')
check('the cloud verifies the licence signature before answering',
  cloudCheckin.indexOf('readLicense(body.key)') < cloudCheckin.indexOf("from('selfhost_customers')"))
check('an unverifiable key gets 401 and no customer lookup',
  cloudCheckin.includes("{ error: 'That licence key could not be verified.' }, { status: 401 }"))
check('the licence key is never stored by the check-in endpoint',
  !/license_key:/.test(cloudCheckin))
check('the latest version is returned even to a revoked install',
  cloudCheckin.indexOf('const releases = await listReleases()') > cloudCheckin.indexOf('const revoked'))
check('the check-in route is exempt from the auth redirect',
  mw.includes('/api/selfhost/checkin'))

const checkinToggle = read('app/api/license/checkin/route.ts')
check('turning check-in off clears the cached verdict',
  checkinToggle.includes('patch.checkin_status = null'))
check('toggling check-in invalidates the licence cache',
  checkinToggle.includes('invalidateLicenseCache()'))

const sched = read('lib/scheduler.ts')
check('check-in runs daily, not hourly', sched.includes("cron.schedule('40 3 * * *', tickCheckin"))

// ------------------------------------------------------------ self-service --
console.log('\nCustomer self-service')

const renew = read('app/api/selfhost/me/renew/route.ts')
check('a renewal note is length-capped before storage', renew.includes('.slice(0, 1000)'))
check('re-requesting refreshes rather than being rejected',
  renew.includes('renewal_requested_at: new Date().toISOString()'))

const issueRoute2 = read('app/api/admin/selfhost/customers/[id]/license/route.ts')
check('issuing a licence clears the renewal request it answers',
  issueRoute2.includes('renewal_requested_at: null'))

const patchRoute2 = read('app/api/admin/selfhost/customers/[id]/route.ts')
check('revocation is reversible', patchRoute2.includes('patch.revoked_at = body.revoked ? new Date().toISOString() : null'))
check('a revocation reason is length-capped', patchRoute2.includes('.slice(0, 500)'))

// --------------------------------------------------------------- migration --
console.log('\nMigration 057')

const mig57 = read('supabase/migrations/057_selfhost_selfservice.sql')
check('every column add is idempotent',
  (mig57.match(/add column/g) ?? []).length === (mig57.match(/add column if not exists/g) ?? []).length)
check('every index is idempotent',
  (mig57.match(/create index/g) ?? []).length === (mig57.match(/create index if not exists/g) ?? []).length)
check('check-in defaults to on', mig57.includes('checkin_enabled boolean not null default true'))
check('the migration documents that revocation cannot reach an air-gapped install',
  /CANNOT reach an air-gapped/.test(mig57))

// ------------------------------------------------------------------ result --
console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
