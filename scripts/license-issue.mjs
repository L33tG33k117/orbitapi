#!/usr/bin/env node
/**
 * Mint a self-hosted licence key. Support tool — run by us, never shipped.
 *
 *   # once, to create a signing key pair
 *   node scripts/license-issue.mjs keygen --kid k1
 *
 *   # per customer
 *   node scripts/license-issue.mjs issue \
 *     --customer "Acme Ltd" --email ops@acme.com \
 *     --tier enterprise --seats 25 --months 12 --kid k1 \
 *     --private-key ./k1.private.pem
 *
 * The private key NEVER goes in the repo. Keep it in the founder's password
 * manager; losing it means rotating to a new kid, and leaking it means anyone
 * can mint licences.
 *
 * Ed25519 via node:crypto — no dependencies, so this keeps working years from
 * now without a package install.
 */
import { generateKeyPairSync, sign as signBuffer, createPrivateKey } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const argv = process.argv.slice(2)
const cmd = argv[0]

function arg(name, fallback = null) {
  const i = argv.indexOf(`--${name}`)
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback
}
function fail(msg) { console.error(`\n✗ ${msg}\n`); process.exit(1) }

// ---------------------------------------------------------------- keygen ----
if (cmd === 'keygen') {
  const kid = arg('kid')
  if (!kid) fail('Usage: license-issue.mjs keygen --kid <id>')

  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const pub = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const priv = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

  const privPath = `${kid}.private.pem`
  if (existsSync(privPath)) fail(`${privPath} already exists — refusing to overwrite a signing key.`)
  writeFileSync(privPath, priv, { mode: 0o600 })

  console.log(`
✓ Generated signing key "${kid}"

  Private key written to ${privPath} (mode 600).
  MOVE IT to the password manager and delete the local copy.

  Add the PUBLIC half to PUBLIC_KEYS in lib/license.ts:

  '${kid}': \`${pub.trimEnd()}\n\`,
`)
  process.exit(0)
}

// ----------------------------------------------------------------- issue ----
if (cmd === 'issue') {
  const customer = arg('customer')
  const kid = arg('kid')
  const privPath = arg('private-key')
  if (!customer || !kid || !privPath) {
    fail('Usage: license-issue.mjs issue --customer "Name" --tier enterprise --months 12 --kid k1 --private-key ./k1.private.pem [--email x] [--seats 25]')
  }
  if (!existsSync(privPath)) fail(`No private key at ${privPath}`)

  const tier = arg('tier', 'enterprise')
  if (!['free', 'starter', 'pro', 'enterprise'].includes(tier)) {
    fail(`Unknown tier "${tier}". Use free | starter | pro | enterprise.`)
  }

  const months = Number(arg('months', '12'))
  if (!Number.isFinite(months) || months <= 0) fail('--months must be a positive number.')

  const seats = arg('seats') ? Number(arg('seats')) : undefined
  if (seats !== undefined && (!Number.isFinite(seats) || seats <= 0)) fail('--seats must be a positive number.')

  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + Math.round(months * 30.44 * 86_400)

  const payload = {
    lid: randomUUID(),
    customer,
    ...(arg('email') ? { email: arg('email') } : {}),
    edition: 'selfhost',
    tier,
    ...(seats ? { limits: { seats } } : {}),
    iat,
    exp,
    kid,
  }

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const privateKey = createPrivateKey(readFileSync(privPath))
  const sig = signBuffer(null, Buffer.from(payloadB64), privateKey).toString('base64url')
  const key = `ORBIT.${payloadB64}.${sig}`

  console.log(`
✓ Licence issued

  Customer : ${customer}
  Tier     : ${tier}${seats ? `   Seats: ${seats}` : ''}
  Expires  : ${new Date(exp * 1000).toISOString().slice(0, 10)}
  Licence  : ${payload.lid}

${key}

  Send that key to the customer. They paste it into
  Settings -> Licence on their installation.
`)
  process.exit(0)
}

console.error(`
OrbitAPI licence tool

  keygen --kid <id>
      Create an Ed25519 signing key pair.

  issue --customer "Name" --tier <tier> --months <n> --kid <id>
        --private-key <path> [--email <addr>] [--seats <n>]
      Mint a licence key.
`)
process.exit(1)
