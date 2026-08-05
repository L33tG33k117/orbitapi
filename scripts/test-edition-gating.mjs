// Verification for edition gating (offline edition, Phase 2d).
//
// The risk this guards against is asymmetric. A feature wrongly HIDDEN on
// cloud is an outage for paying customers. A feature wrongly SHOWN on
// self-host is a dead end an air-gapped user cannot escape — a Stripe
// checkout that can never load, an upgrade page that doesn't exist.
//
// So every check runs twice: once as cloud, once as self-host.
//
// Run: npm run test:edition-gating

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

let passed = 0
let failed = 0
function check(label, cond) {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.log(`  ✗ ${label}`) }
}

// Modules read process.env per call, so flipping it between imports works.
async function asEdition(edition, fn) {
  const before = process.env.ORBIT_EDITION
  process.env.ORBIT_EDITION = edition
  try { return await fn() } finally { process.env.ORBIT_EDITION = before }
}

const { edition, isSelfHost, isCloud } = await import('../lib/edition.ts')
const { getAppUrl } = await import('../lib/app-url.ts')
const { hasCapability } = await import('../lib/entitlements.ts')
const { aiPowerRequired } = await import('../lib/ai-power.ts')

console.log('\nEdition detection')
await asEdition('selfhost', () => {
  check('selfhost is detected', isSelfHost() && edition() === 'selfhost' && !isCloud())
})
await asEdition('cloud', () => {
  check('cloud is detected', isCloud() && !isSelfHost())
})
await asEdition(undefined, () => {
  // Anything unrecognised must mean cloud: a typo in a deployment variable
  // must never silently strip features from paying customers.
  check('unset defaults to cloud', isCloud() && !isSelfHost())
})
await asEdition('SelfHost', () => {
  check('a near-miss value still means cloud (exact match only)', isCloud())
})

console.log('\nEdition gate')
// The page-level gate returns JSX and lives in components/edition-gate.tsx,
// which node's type stripping can't load — its behaviour is asserted from
// source below. The API guard is pure and is exercised directly here.
const { editionGuard, isCloudOnlyUnavailable, CLOUD_ONLY_COPY } = await import('../lib/edition-gate.ts')
await asEdition('cloud', () => {
  check('cloud: nothing is edition-gated', !isCloudOnlyUnavailable())
  check('cloud: billing API is NOT gated', editionGuard('billing') === null)
})
await asEdition('selfhost', () => {
  check('selfhost: cloud-only features are unavailable', isCloudOnlyUnavailable())
  const res = editionGuard('billing')
  check('selfhost: billing API is gated', res !== null)
  // 404 not 403: the route genuinely does not exist here, and 403 would imply
  // the caller might succeed with better credentials.
  check('selfhost: the API gate is a 404, not a 403', res?.status === 404)
})
check('every cloud-only feature has user-facing copy',
  ['billing', 'sso', 'marketing', 'feedback', 'downloads']
    .every(f => CLOUD_ONLY_COPY[f]?.label && CLOUD_ONLY_COPY[f]?.description))
check('gate copy never tells a self-hosted user to upgrade',
  !Object.values(CLOUD_ONLY_COPY).some(c => /upgrade/i.test(c.description)))

const gateComponent = readFileSync(join(ROOT, 'components', 'edition-gate.tsx'), 'utf8')
check('the page gate returns null on cloud', /if \(!isSelfHost\(\)\) return null/.test(gateComponent))
check('the page gate offers no upgrade link', !/\/upgrade/.test(gateComponent))
check('API routes import the JSX-free module',
  readFileSync(join(ROOT, 'app', 'api', 'billing', 'checkout', 'route.ts'), 'utf8')
    .includes("from '@/lib/edition-gate'"))

console.log('\nApp URL resolution')
await asEdition('selfhost', () => {
  const before = process.env.ORBIT_APP_URL
  process.env.ORBIT_APP_URL = 'https://orbit.acme.internal/'
  check('runtime ORBIT_APP_URL wins', getAppUrl() === 'https://orbit.acme.internal')
  check('trailing slash is stripped', !getAppUrl().endsWith('/'))
  process.env.ORBIT_APP_URL = before ?? ''
  if (!before) delete process.env.ORBIT_APP_URL
})
check('falls back to the request origin when nothing is configured',
  getAppUrl('https://from-request.example') === 'https://from-request.example'
  || !!process.env.NEXT_PUBLIC_APP_URL)

console.log('\nAI Power metering')
check('hosted Claude runs are metered', aiPowerRequired({ kind: 'anthropic' }))
// A self-hosted box has no billing behind the credit counter; metering it
// would silently stop every scheduled run once a number nobody tops up hits 0.
check('a local model is never metered', !aiPowerRequired({ kind: 'local' }))

console.log('\nSelf-host entitlements')
// byo_llm is granted by no tier — a self-hosted install that couldn't use it
// would have no way to run any AI at all.
check('byo_llm is granted by no tier on cloud', !hasCapability('enterprise', null, 'byo_llm'))
check('byo_llm can still be granted per-workspace', hasCapability('free', { byo_llm: true }, 'byo_llm'))
const wsFeatures = readFileSync(join(ROOT, 'lib', 'workspace-features.ts'), 'utf8')
check('self-host forces byo_llm on', /isSelfHost\(\)[\s\S]{0,400}byo_llm:\s*true/.test(wsFeatures))
check('self-host runs the full tier', /isSelfHost\(\)[\s\S]{0,300}tier:\s*'enterprise'/.test(wsFeatures))

console.log('\nCloud-only routes are blocked at the proxy')
const proxy = readFileSync(join(ROOT, 'proxy.ts'), 'utf8')
for (const r of ['/settings/billing', '/upgrade', '/pricing', '/integrations', '/solutions', '/changelog']) {
  check(`proxy blocks ${r} on self-host`, proxy.includes(`'${r}'`))
}
check('the proxy only blocks on self-host', /ORBIT_EDITION !== 'selfhost'[\s\S]{0,80}return false/.test(proxy))
check('blocked routes 404 rather than redirect', /cloudOnlyBlocked[\s\S]{0,300}status: 404/.test(proxy))
// Self-host must keep the things that DO work offline.
for (const kept of ['/webhooks', '/mcp', '/skills', '/connectors', '/bundles']) {
  check(`proxy does NOT block ${kept}`, !proxy.includes(`'${kept}'`))
}

console.log('\nBilling APIs refuse to run on self-host')
for (const route of ['checkout', 'portal', 'topup', 'status']) {
  const src = readFileSync(join(ROOT, 'app', 'api', 'billing', route, 'route.ts'), 'utf8')
  check(`billing/${route} calls editionGuard`, src.includes("editionGuard('billing')"))
}

console.log('\nUI hides what cannot work')
const sidebar = readFileSync(join(ROOT, 'components', 'sidebar.tsx'), 'utf8')
check('Billing nav is marked cloudOnly', /'\/settings\/billing'[^}]*cloudOnly: true/.test(sidebar))
// Hidden, not dimmed: a locked item says "upgrade", and there is no upgrade.
check('cloudOnly nav items are removed, not locked', /item\.cloudOnly && selfHost\) return null/.test(sidebar))
check('AI Provider nav is NOT cloudOnly', !/'\/settings\/ai-provider'[^}]*cloudOnly/.test(sidebar))

const login = readFileSync(join(ROOT, 'app', '(auth)', 'login', 'page.tsx'), 'utf8')
check('Google sign-in is hidden on self-host', /\{!selfHost && \(\s*<Button[\s\S]{0,400}handleGoogleLogin/.test(login))
check('SSO is hidden on self-host (OSS GoTrue has no SAML)', /\{!selfHost && \(\s*<button[\s\S]{0,200}handleSSO/.test(login))
check('self-host points at an administrator instead of signup', /selfHost \?[\s\S]{0,200}administrator/.test(login))

const help = readFileSync(join(ROOT, 'components', 'help-menu.tsx'), 'utf8')
check('feedback becomes Contact support on self-host', /selfHost \?[\s\S]{0,300}Contact support/.test(help))

const aiPowerPage = readFileSync(join(ROOT, 'app', '(dashboard)', 'ai-power', 'page.tsx'), 'utf8')
check('AI Power page retitles to AI Usage when unmetered', /unmetered \? 'AI Usage'/.test(aiPowerPage))
check('top-up packs are withheld when unmetered', /unmetered \? \[\] : TOPUP_PACKS/.test(aiPowerPage))

const aiPowerClient = readFileSync(join(ROOT, 'app', '(dashboard)', 'ai-power', 'ai-power-client.tsx'), 'utf8')
// allowance is Infinity when unmetered; a percentage against it renders NaN.
check('the credit meter is not rendered when unmetered', /\{!unmetered && \(/.test(aiPowerClient))
check('"running low" cannot fire when unmetered', /!unmetered && power\.pctUsed >= 80/.test(aiPowerClient))

const lan = readFileSync(join(ROOT, 'components', 'lan-caveat.tsx'), 'utf8')
check('LAN caveat only shows on self-host', /if \(!useIsSelfHost\(\)\) return null/.test(lan))
for (const f of ['webhooks-client', 'mcp-client']) {
  const p = f === 'webhooks-client'
    ? join(ROOT, 'app', '(dashboard)', 'webhooks', 'webhooks-client.tsx')
    : join(ROOT, 'app', '(dashboard)', 'mcp', 'mcp-client.tsx')
  check(`${f} shows the LAN caveat`, readFileSync(p, 'utf8').includes('<LanCaveat'))
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exitCode = failed === 0 ? 0 : 1
