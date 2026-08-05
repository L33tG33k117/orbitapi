// Verification for secret storage (offline edition, Phase 2b).
//
// The stakes here are asymmetric: a bug that fails loudly costs an error
// message, a bug that silently stores a credential in plain text costs the
// customer their credentials. So these checks care most about what ends up in
// the column.
//
// Run: npm run test:secrets

import { randomBytes } from 'node:crypto'

// Set the key BEFORE importing, since the module reads it per call but the
// import itself must not blow up without one.
process.env.ORBIT_SECRETS_KEY = randomBytes(32).toString('base64')

const {
  storeSecret, readSecret, isLegacyInlineSecret, reencryptLegacySecret,
} = await import('../lib/credentials.ts')

let passed = 0
let failed = 0
function check(label, cond) {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.log(`  ✗ ${label}`) }
}

const creds = { api_key: 'sk-super-secret-value', account: 'acme' }

console.log('\nEncryption round-trip')
// No Supabase reachable here, so storeSecret falls through to local encryption.
const stored = await storeSecret(creds, 'test-secret')
check('stored value is tagged enc:v1', stored.startsWith('enc:v1:'))
check('has iv, ciphertext and auth tag', stored.slice('enc:v1:'.length).split(':').length === 3)
// The whole point: the plaintext must not be recoverable by looking at it.
check('plaintext does not appear in the stored value', !stored.includes('sk-super-secret-value'))
check('plaintext is not base64-recoverable',
  !Buffer.from(stored.slice('enc:v1:'.length).split(':')[1], 'base64').toString('utf8').includes('sk-super'))

const round = await readSecret(stored)
check('decrypts back to the original', round?.api_key === creds.api_key && round?.account === creds.account)

console.log('\nEach write is unique')
const again = await storeSecret(creds, 'test-secret-2')
check('same input encrypts differently (random IV)', again !== stored)
check('and still decrypts', (await readSecret(again))?.api_key === creds.api_key)

console.log('\nTampering and wrong keys are rejected, not guessed at')
const parts = stored.slice('enc:v1:'.length).split(':')
const flipped = Buffer.from(parts[1], 'base64')
flipped[0] ^= 0xff
const tampered = `enc:v1:${parts[0]}:${flipped.toString('base64')}:${parts[2]}`
check('tampered ciphertext returns null', (await readSecret(tampered)) === null)

const goodKey = process.env.ORBIT_SECRETS_KEY
process.env.ORBIT_SECRETS_KEY = randomBytes(32).toString('base64')
check('wrong key returns null rather than garbage', (await readSecret(stored)) === null)
process.env.ORBIT_SECRETS_KEY = ''
check('missing key returns null rather than throwing', (await readSecret(stored)) === null)
process.env.ORBIT_SECRETS_KEY = goodKey
check('restoring the key restores access', (await readSecret(stored))?.api_key === creds.api_key)

console.log('\nLegacy inline rows still work')
const legacy = `inline:${Buffer.from(JSON.stringify(creds)).toString('base64')}`
check('legacy format is detected', isLegacyInlineSecret(legacy))
check('encrypted format is not flagged as legacy', !isLegacyInlineSecret(stored))
check('legacy rows are still readable', (await readSecret(legacy))?.api_key === creds.api_key)

const upgraded = reencryptLegacySecret(legacy)
check('legacy row upgrades to enc:v1', upgraded?.startsWith('enc:v1:'))
check('upgraded row decrypts to the same credentials',
  (await readSecret(upgraded))?.api_key === creds.api_key)
check('upgrading an already-encrypted value is refused', reencryptLegacySecret(stored) === null)

console.log('\nBad input is survivable')
check('null id returns null', (await readSecret(null)) === null)
check('empty id returns null', (await readSecret('')) === null)
check('malformed enc value returns null', (await readSecret('enc:v1:nonsense')) === null)
check('malformed inline value returns null', (await readSecret('inline:%%%')) === null)

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exitCode = failed === 0 ? 0 : 1
