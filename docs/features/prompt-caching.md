# Prompt Caching (Unit Economics)

**Status:** Complete (live).

## Summary
Anthropic prompt caching wired into every AI call so the repeated system prompt + tool definitions
bill at ~10% instead of 100%. This is the lever that makes AI Power allowances generous AND profitable
(~3–5× more actions per credit).

## How it works
- In an agentic loop, the persona + guidelines + tool defs are re-sent on every step of every run.
- We pass the system prompt as a `role:'system'` message with
  `providerOptions.anthropic.cacheControl: { type: 'ephemeral' }` (instead of the `system` string param).
- Per the AI SDK Anthropic provider, a cache breakpoint on the system block caches everything before it
  in render order — i.e. **tools + system** — which is the bulk of input tokens.
- Cache hits accrue across the 15–20 steps within a run and across repeated runs within the 5-min TTL.

## Key files
- `lib/skill-runner.ts` — cached system message in `generateText`
- `lib/playbook-runner.ts` — cached system message in `assess()`
- `app/api/chat/route.ts` — cached system message prepended to `streamText` messages

## Verification reference
- Source of the API shape: `node_modules/@ai-sdk/anthropic/src/convert-to-anthropic-messages-prompt.ts`
  (system-role message → top-level `system` with `cache_control`) and `get-cache-control.ts`.

## Gotchas
- Tool definitions must be byte-identical across requests to cache (they are, per skill/workspace).
- Don't interpolate volatile values (timestamps, ids) ahead of the cache breakpoint.
