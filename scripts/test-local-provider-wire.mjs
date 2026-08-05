// Wire test for the local (self-hosted) AI provider.
//
// Stands up a throwaway OpenAI-compatible server on localhost, points the
// provider at it, and makes a real generateText call. This proves the parts a
// pure unit test can't: that we send a request an actual local model server
// would accept, that we parse its reply, and — most importantly — that no
// Anthropic-only fields leak into the request body.
//
// It is NOT a substitute for running against real Ollama with a real model;
// it can't tell you whether a 7B model is smart enough to drive a skill. It
// tells you the plumbing is right.
//
// Run: npm run test:local-wire

import http from 'node:http'
import { generateText } from 'ai'
import { providerFromSettings } from '../lib/ai-provider.ts'
import { cacheControlFor, maxTokensFor, thinkingFor } from '../lib/ai-resilience.ts'

let passed = 0
let failed = 0
function check(label, cond) {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.log(`  ✗ ${label}`) }
}

// ---- a minimal OpenAI-compatible endpoint ----------------------------------
let lastRequestBody = null

const server = http.createServer((req, res) => {
  let raw = ''
  req.on('data', chunk => { raw += chunk })
  req.on('end', () => {
    lastRequestBody = { path: req.url, headers: req.headers, body: JSON.parse(raw || '{}') }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      id: 'chatcmpl-stub',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: lastRequestBody.body.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: 'ready' },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 11, completion_tokens: 2, total_tokens: 13 },
    }))
  })
})

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const baseUrl = `http://127.0.0.1:${port}/v1`

try {
  const provider = providerFromSettings({ baseUrl, modelName: 'stub-model-30b' })

  console.log('\nProvider shape')
  check('reports itself as local', provider.kind === 'local')
  check('bills as a local model id', provider.billingModelId('claude-opus-5') === 'local:stub-model-30b')
  check('ignores the call site\'s model hint', provider.label === 'stub-model-30b')

  console.log('\nLive call against an OpenAI-compatible endpoint')
  const { text, usage } = await generateText({
    model: provider.model('claude-opus-5'),
    prompt: 'Reply with the single word: ready',
    // Exactly how a converted call site builds its options.
    providerOptions: thinkingFor(provider, 'agentic'),
    maxOutputTokens: maxTokensFor(provider, 32_000),
    maxRetries: 0,
  })

  check('got the reply back', text.trim() === 'ready')
  check('token usage is reported', usage.inputTokens === 11 && usage.outputTokens === 2)
  check('hit the chat completions path', lastRequestBody.path.endsWith('/chat/completions'))
  check('sent the configured model name, not the hint', lastRequestBody.body.model === 'stub-model-30b')

  console.log('\nNo Anthropic-only fields leak to a local server')
  const sent = JSON.stringify(lastRequestBody.body)
  check('no thinking block', !('thinking' in lastRequestBody.body) && !/"thinking"/.test(sent))
  check('no cache_control block', !/cache_control|cacheControl/.test(sent))
  check('no anthropic provider namespace', !/anthropic/i.test(sent))
  check('output budget was clamped to the local ceiling',
    (lastRequestBody.body.max_tokens ?? lastRequestBody.body.max_completion_tokens) === 8192)

  console.log('\nSystem message + cache control')
  lastRequestBody = null
  await generateText({
    model: provider.model(),
    messages: [
      { role: 'system', content: 'You are a test.', providerOptions: cacheControlFor(provider) },
      { role: 'user', content: 'hi' },
    ],
    maxRetries: 0,
  })
  const sent2 = JSON.stringify(lastRequestBody.body)
  check('system message still sent', /You are a test\./.test(sent2))
  check('still no cache_control on the system message', !/cache_control|cacheControl/.test(sent2))

  console.log('\nUnreachable server')
  const dead = providerFromSettings({ baseUrl: 'http://127.0.0.1:1/v1', modelName: 'nope' })
  let threw = false
  try {
    await generateText({ model: dead.model(), prompt: 'x', maxRetries: 0 })
  } catch {
    threw = true
  }
  check('a dead endpoint throws rather than hanging', threw)
} finally {
  // Await the close: calling process.exit() while libuv still holds the
  // handle trips an assertion on Windows and reports a bogus failure.
  await new Promise(resolve => server.close(resolve))
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exitCode = failed === 0 ? 0 : 1
