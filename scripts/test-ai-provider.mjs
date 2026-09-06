// Verification for the AI provider abstraction (offline edition, Phase 1).
//
// Covers the logic that decides what a run COSTS and which provider-specific
// options get sent — the two things that would silently do the wrong thing
// rather than crash. Pure modules only; no DB, no network, no API key needed.
//
// Run: npm run test:ai-provider

import { APICallError } from 'ai'
import {
  computeCost, isLocalModel, localModelId, localModelName, MODEL_PRICING,
} from '../lib/usage-cost.ts'
import {
  cacheControlFor, friendlyAiError, isConnectionRefused, isContextLengthError,
  maxTokensFor, thinkingFor, withModelFallback, AGENTIC_MAX_TOKENS,
} from '../lib/ai-resilience.ts'

let passed = 0
let failed = 0

function check(label, cond) {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.log(`  ✗ ${label}`) }
}

const ANTHROPIC = {
  kind: 'anthropic', supportsThinking: true, supportsPromptCache: true,
  clampMaxTokens: n => n,
}
const LOCAL = {
  kind: 'local', supportsThinking: false, supportsPromptCache: false,
  clampMaxTokens: n => Math.min(n, 8192),
}

console.log('\nModel ids')
check('localModelId tags a name', localModelId('llama3.1:70b') === 'local:llama3.1:70b')
check('isLocalModel true for local:', isLocalModel('local:llama3.1:70b'))
check('isLocalModel false for Claude', !isLocalModel('claude-opus-5'))
check('isLocalModel false for null', !isLocalModel(null))
check('localModelName unwraps', localModelName('local:llama3.1:70b') === 'llama3.1:70b')

console.log('\nCost')
check('a local run costs nothing', computeCost('local:llama3.1:70b', 500_000, 200_000) === 0)
check('Claude still bills', computeCost('claude-opus-5', 1_000_000, 0) === MODEL_PRICING['claude-opus-5'].inputPerMTok)
// The regression this guards: an unknown id falls back to DEFAULT_MODEL pricing,
// so a `local:` id checked AFTER the lookup would bill Sonnet rates.
check('local is checked before the pricing fallback', computeCost('local:anything', 1_000_000, 1_000_000) === 0)
check('an unknown non-local id still falls back', computeCost('mystery-model', 1_000_000, 0) > 0)

console.log('\nProvider-specific options')
check('anthropic gets adaptive thinking', thinkingFor(ANTHROPIC, 'agentic').anthropic.thinking.type === 'adaptive')
check('anthropic can disable thinking', thinkingFor(ANTHROPIC, 'none').anthropic.thinking.type === 'disabled')
check('local gets no thinking options', thinkingFor(LOCAL, 'agentic') === undefined)
check('local gets no thinking options (none preset)', thinkingFor(LOCAL, 'none') === undefined)
// The bug this guards (prod, 2026-09-02): chat sent adaptive thinking to
// Haiku 4.5 — the model that economy tier and the overload fallback both land
// on — and every message died with "adaptive thinking is not supported on this
// model" behind a generic "Something went wrong."
check('haiku takes no thinking block at all', thinkingFor(ANTHROPIC, 'agentic', 'claude-haiku-4-5') === undefined)
check('haiku takes no thinking block (none preset)', thinkingFor(ANTHROPIC, 'none', 'claude-haiku-4-5') === undefined)
check('opus 5 still thinks', thinkingFor(ANTHROPIC, 'agentic', 'claude-opus-5').anthropic.thinking.type === 'adaptive')
check('sonnet 5 still thinks', thinkingFor(ANTHROPIC, 'agentic', 'claude-sonnet-5').anthropic.thinking.type === 'adaptive')
check('sonnet 4.6 still thinks', thinkingFor(ANTHROPIC, 'agentic', 'claude-sonnet-4-6') !== undefined)
check('an unnamed model keeps the old behaviour', thinkingFor(ANTHROPIC, 'none', undefined) !== undefined)
check('anthropic gets a cache block', cacheControlFor(ANTHROPIC).anthropic.cacheControl.type === 'ephemeral')
check('local gets no cache block', cacheControlFor(LOCAL) === undefined)
check('anthropic keeps the full agentic budget', maxTokensFor(ANTHROPIC, AGENTIC_MAX_TOKENS) === AGENTIC_MAX_TOKENS)
check('local clamps the agentic budget', maxTokensFor(LOCAL, AGENTIC_MAX_TOKENS) === 8192)
check('local leaves a small budget alone', maxTokensFor(LOCAL, 400) === 400)

console.log('\nModel fallback')
const overloaded = new APICallError({
  message: 'overloaded_error', url: 'https://api.anthropic.com', requestBodyValues: {},
  statusCode: 529, responseBody: '{"type":"overloaded_error"}',
})

{
  let calls = 0
  const r = await withModelFallback('claude-opus-5', async m => { calls++; return m }, {})
  check('anthropic happy path runs once', calls === 1 && r.model === 'claude-opus-5' && !r.usedFallback)
}
{
  let calls = 0
  const r = await withModelFallback('claude-opus-5', async m => {
    calls++
    if (m === 'claude-opus-5') throw overloaded
    return m
  }, {})
  check('anthropic falls back to Economy on 529', calls === 2 && r.usedFallback && r.model === 'claude-haiku-4-5')
}
{
  // The point of the local no-op: there is no second model to try, and
  // retrying the SAME unreachable endpoint would just double the wait.
  let calls = 0
  let threw = false
  try {
    await withModelFallback('claude-opus-5', async () => { calls++; throw overloaded }, { provider: LOCAL })
  } catch { threw = true }
  check('local never falls back — runs once and rethrows', calls === 1 && threw)
}

console.log('\nError copy')
const refused = new TypeError('fetch failed: connect ECONNREFUSED 192.168.1.50:11434')
const ctxLen = new APICallError({
  message: "This model's maximum context length is 8192 tokens",
  url: 'http://localhost:11434/v1', requestBodyValues: {}, statusCode: 400,
})
check('detects a refused connection', isConnectionRefused(refused))
check('detects a context-length error', isContextLengthError(ctxLen))
check('local outage blames the local server, not us',
  /your AI model server/i.test(friendlyAiError(refused, LOCAL)))
check('local error never says "Orbit\'s AI provider"',
  !/Orbit's AI provider/i.test(friendlyAiError(refused, LOCAL)))
check('local context-length error suggests a shorter request',
  /shorter|smaller steps/i.test(friendlyAiError(ctxLen, LOCAL)))
check('cloud 529 keeps its existing copy',
  /unusually busy/i.test(friendlyAiError(overloaded, ANTHROPIC)))
check('cloud copy is unchanged when no provider is passed',
  friendlyAiError(overloaded) === friendlyAiError(overloaded, ANTHROPIC))

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
