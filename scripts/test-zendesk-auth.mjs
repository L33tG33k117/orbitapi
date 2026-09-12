// Verification for Zendesk connector auth.
//
// Zendesk is removing API tokens as an authentication method (all tokens stop
// working 2027-04-30; no new tokens can be created after 2026-10-27). The
// connector must keep working for existing email+token (API token, Basic
// auth) connections, but also accept a Zendesk OAuth access token — sent as
// `Authorization: Bearer <token>` with no agent email — so customers have a
// working migration path before tokens are removed entirely.
//
// Run: npm run test:zendesk-auth

import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./scripts/sim-alias-hook.mjs', pathToFileURL(process.cwd() + '/').href)

let passed = 0
let failed = 0
function check(label, cond) {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.log(`  ✗ ${label}`) }
}

let capturedHeaders
global.fetch = async (_url, options) => {
  capturedHeaders = options.headers
  return { ok: true, status: 200, json: async () => ({ tickets: [] }) }
}

const { zendeskManifest } = await import('../connectors/zendesk/index.ts')

console.log('\nLegacy API token (email + token) still uses Basic auth')
await zendeskManifest.testConnection({ subdomain: 'acme', email: 'agent@acme.com', token: 'abc123' })
check('sends a Basic auth header', capturedHeaders.Authorization.startsWith('Basic '))
const decoded = Buffer.from(capturedHeaders.Authorization.slice('Basic '.length), 'base64').toString('utf8')
check('Basic auth encodes email/token:token', decoded === 'agent@acme.com/token:abc123')

console.log('\nOAuth access token (no email) uses Bearer auth')
await zendeskManifest.testConnection({ subdomain: 'acme', email: '', token: 'oauth-access-token-xyz' })
check('sends a Bearer auth header', capturedHeaders.Authorization === 'Bearer oauth-access-token-xyz')

console.log('\nSetup guide warns about the API token removal')
const guideText = zendeskManifest.auth.setupGuide.map(s => `${s.title} ${s.description}`).join(' ').toLowerCase()
check('mentions the removal/deprecation of API tokens', /removing|deprecat/.test(guideText))
check('mentions the hard cutoff date', guideText.includes('2027'))
check('mentions oauth as the replacement', guideText.includes('oauth'))

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
