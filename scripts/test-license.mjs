// Verification for licence keys (offline edition, Phase 3).
//
// This is the highest-stakes pure logic in the offline edition. A licence that
// verifies when it shouldn't means the product is free; one that fails when it
// shouldn't locks an air-gapped customer out of their own operations with no
// way to reach us. Both directions are tested here against REAL Ed25519
// signatures — readLicenseWith() runs the exact production verification path
// with a key pair generated below.
//
// Run: npm run test:license

import { generateKeyPairSync, sign as signBuffer } from 'node:crypto'

let passed = 0
let failed = 0
function check(label, cond) {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.log(`  ✗ ${label}`) }
}

const lic = await import('../lib/license.ts')

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const { publicKey: otherPub, privateKey: otherPriv } = generateKeyPairSync('ed25519')

const KID = 'test-k1'
const KEYS = { [KID]: publicKey.export({ type: 'spki', format: 'pem' }).toString() }
const KEYS_OTHER = { [KID]: otherPub.export({ type: 'spki', format: 'pem' }).toString() }

const DAY = 86_400
const now = Math.floor(Date.now() / 1000)

function mint(overrides = {}, priv = privateKey) {
  const payload = {
    lid: 'test-licence-id',
    customer: 'Acme Ltd',
    edition: 'selfhost',
    tier: 'enterprise',
    iat: now - DAY,
    exp: now + 90 * DAY,
    kid: KID,
    ...overrides,
  }
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = signBuffer(null, Buffer.from(b64), priv).toString('base64url')
  return { key: `ORBIT.${b64}.${sig}`, payload, b64, sig }
}

const read = (key, keys = KEYS) => lic.readLicenseWith(key, keys)

console.log('\nA genuine licence')
{
  const { key, payload } = mint()
  const s = read(key)
  check('verifies', s.status === 'valid')
  check('carries the customer through', s.payload?.customer === 'Acme Ltd')
  check('carries the tier through', s.payload?.tier === 'enterprise')
  check('reports days remaining', s.daysRemaining > 88 && s.daysRemaining <= 90)
  check('round-trips the licence id', s.payload?.lid === payload.lid)
}

console.log('\nForgery and tampering are refused')
{
  const { key, b64, sig } = mint()

  check('a signature from another key is refused', read(key, KEYS_OTHER).status === 'invalid')
  check('a licence signed by an attacker is refused',
    read(mint({}, otherPriv).key).status === 'invalid')

  // The attack that matters: edit the payload to grant yourself more, keep the
  // old signature.
  const forged = Buffer.from(JSON.stringify({
    lid: 'x', customer: 'Acme Ltd', edition: 'selfhost', tier: 'enterprise',
    iat: now, exp: now + 3650 * DAY, kid: KID,
  })).toString('base64url')
  check('an upgraded payload with the original signature is refused',
    read(`ORBIT.${forged}.${sig}`).status === 'invalid')

  const flipped = Buffer.from(sig, 'base64url')
  flipped[0] ^= 0xff
  check('a corrupted signature is refused',
    read(`ORBIT.${b64}.${flipped.toString('base64url')}`).status === 'invalid')

  check('an unknown kid is refused', read(mint({ kid: 'nope' }).key).status === 'invalid')
  check('and the unknown-kid message points at an update, not at the customer',
    /update|support/i.test(read(mint({ kid: 'nope' }).key).message))
}

console.log('\nMalformed input')
for (const [label, key] of [
  ['null', null],
  ['empty', ''],
  ['random text', 'not-a-licence'],
  ['prefix only', 'ORBIT.'],
  ['no signature segment', 'ORBIT.eyJhIjoxfQ'],
  ['payload that is not JSON', 'ORBIT.bm90anNvbg.c2ln'],
  ['payload missing required fields', `ORBIT.${Buffer.from('{"customer":"x"}').toString('base64url')}.c2ln`],
]) {
  const s = read(key)
  check(`${label} → not usable`, s.status === 'invalid' || s.status === 'absent')
}
check('an absent key reads as "absent", not "invalid"', read(null).status === 'absent')

console.log('\nExpiry and grace')
{
  const expiredYesterday = mint({ exp: now - DAY })
  const s = read(expiredYesterday.key)
  check('a day past expiry is in grace, not dead', s.status === 'grace')
  check('grace explains how long is left', /keeps working/i.test(s.message))

  const deepInGrace = read(mint({ exp: now - 29 * DAY }).key)
  check('day 29 of grace still works', deepInGrace.status === 'grace')

  const pastGrace = read(mint({ exp: now - 31 * DAY }).key)
  check('past the grace period it expires', pastGrace.status === 'expired')
  // The promise that matters most to an air-gapped customer.
  check('the expiry message promises data is still readable',
    /still here|export/i.test(pastGrace.message))
  check('and never threatens deletion', !/delete|erase|destroy/i.test(pastGrace.message))
}

console.log('\nEntitlements')
{
  const ent = s => lic.licenseEntitlements(s)
  const valid = read(mint({ overrides: { byo_llm: true } }).key)
  const grace = read(mint({ exp: now - DAY, overrides: { byo_llm: true } }).key)
  const expired = read(mint({ exp: now - 40 * DAY }).key)

  check('a valid licence grants its tier', ent(valid).tier === 'enterprise')
  check('a valid licence applies its overrides', ent(valid).overrides.byo_llm === true)
  // Grace must grant FULL entitlements — the entire point is that nothing
  // changes while a renewal is in the post.
  check('grace still grants the full tier', ent(grace).tier === 'enterprise')
  check('grace still applies overrides', ent(grace).overrides.byo_llm === true)
  check('an expired licence falls to the floor', ent(expired).tier === lic.EXPIRED_TIER)
  check('an unlicensed instance falls to the floor', ent(read(null)).tier === lic.EXPIRED_TIER)
  check('a forged licence grants nothing', ent(read(mint({}, otherPriv).key)).tier === lic.EXPIRED_TIER)
  check('the floor carries no overrides', Object.keys(ent(expired).overrides).length === 0)
  // The floor must be a real, usable tier — a lapsed customer keeps a working
  // product they can read and export from.
  check('the floor is a real tier', lic.EXPIRED_TIER === 'free')
}

console.log('\nBanners')
{
  const b = key => lic.licenseBanner(read(key))
  check('a healthy licence shows nothing', b(mint({ exp: now + 200 * DAY }).key).tone === 'none')
  check('the last fortnight nudges', b(mint({ exp: now + 10 * DAY }).key).tone === 'info')
  check('grace warns', b(mint({ exp: now - DAY }).key).tone === 'warn')
  check('expired is an error', b(mint({ exp: now - 40 * DAY }).key).tone === 'error')
  check('unlicensed is informational, not alarming', lic.licenseBanner(read(null)).tone === 'info')
  check('grace period is 30 days', lic.GRACE_DAYS === 30)
}

console.log('\nStale-key downgrade guard (the rule the API enforces)')
{
  const installed = read(mint({ iat: now - DAY, tier: 'enterprise' }).key)
  const older = read(mint({ iat: now - 30 * DAY, tier: 'free' }).key)
  const newer = read(mint({ iat: now, tier: 'pro' }).key)
  check('an older key is detectably older', older.payload.iat < installed.payload.iat)
  check('a newer key is detectably newer', newer.payload.iat > installed.payload.iat)
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exitCode = failed === 0 ? 0 : 1
