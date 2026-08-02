// ============================================================
// Resilient AI calls — retry, Economy fallback, friendly errors
// ============================================================
// docs/STATUS.md debt item: "the friendly 'Orbit's AI is busy, retrying…' +
// Economy fallback on 529s was discussed but never shipped; testers will
// eventually hit a raw provider error."
//
// Three layers, applied in order:
//   1. RETRY   — the AI SDK retries retryable failures (429 / 5xx / 529) with
//                exponential backoff. We just raise the attempt count from the
//                default 2 to AI_MAX_RETRIES.
//   2. FALLBACK— if the model is *still* overloaded after those attempts, rerun
//                on the Economy model. A slower/cheaper answer beats no answer,
//                and Haiku is under far less load than Opus during a spike.
//   3. TRANSLATE— whatever surfaces after that becomes a plain-English sentence
//                instead of `AI_APICallError: 529 {"type":"overloaded_error"...}`.
//
// Pure module: no DB, no Supabase, safe to import anywhere.

import { APICallError } from 'ai'
import { CHEAP_MODEL, MODEL_PRICING, type ModelId } from './usage-cost'

/** Attempts per request before we give up on the chosen model (1 try + 3 retries). */
export const AI_MAX_RETRIES = 3

// ------------------------------------------------------------
// Thinking policy (Opus 5 / Sonnet 5 migration, 2026-08-02)
// ------------------------------------------------------------
// Claude Opus 5 and Sonnet 5 think BY DEFAULT — unlike Opus 4.8 / Sonnet 4.6,
// where omitting the parameter meant no thinking. Two consequences:
//
//   1. `maxOutputTokens` is a hard cap on thinking + answer TOGETHER. A call
//      that asked for 900 tokens of JSON can now spend all 900 thinking and
//      return a truncated answer. Every tight-budget call site must either opt
//      out or get real headroom.
//   2. Thinking tokens bill as output tokens, so leaving it on costs more.
//
// So we split call sites in two:
//
//   NO_THINKING  — short, structured, single-shot work (a JSON manifest, a
//                  field mapping, a yes/no verdict). Thinking buys nothing
//                  here and would eat the budget. Keeps cost and latency
//                  exactly where they were before the upgrade.
//   AGENTIC      — multi-step tool use (chat, skills, playbooks). Reasoning
//                  between tool calls is precisely what got better in this
//                  generation, so we let it think and give it room instead.
//
// Note: on Opus 5, disabling thinking is only permitted at effort `high` or
// below (the default). Don't pair NO_THINKING with `effort: 'xhigh' | 'max'`
// — the API rejects that combination with a 400.

/** Opt a short structured call out of thinking. Pass as `providerOptions`. */
export const NO_THINKING = {
  anthropic: { thinking: { type: 'disabled' as const } },
} as const

/**
 * Let a multi-step agent reason between tool calls. Pass as `providerOptions`.
 * Pair with a generous `maxOutputTokens` — see AGENTIC_MAX_TOKENS.
 */
export const AGENTIC_THINKING = {
  anthropic: { thinking: { type: 'adaptive' as const } },
} as const

/**
 * Output ceiling for agentic runs. Covers thinking + tool-call arguments + the
 * final answer, so it has to be well clear of what the answer alone needs.
 */
export const AGENTIC_MAX_TOKENS = 32_000

// The AI SDK wraps repeated failures in a RetryError carrying every attempt.
// We don't import the class (it isn't exported from every entry point) — we
// duck-type it and walk the chain so classification works either way.
function errorChain(err: unknown): unknown[] {
  const seen = new Set<unknown>()
  const out: unknown[] = []
  let cur: unknown = err
  while (cur && typeof cur === 'object' && !seen.has(cur)) {
    seen.add(cur)
    out.push(cur)
    const e = cur as { lastError?: unknown; errors?: unknown[]; cause?: unknown }
    if (Array.isArray(e.errors)) out.push(...e.errors)
    cur = e.lastError ?? e.cause
  }
  return out
}

function statusOf(err: unknown): number | undefined {
  for (const e of errorChain(err)) {
    if (APICallError.isInstance(e) && typeof e.statusCode === 'number') return e.statusCode
    const s = (e as { statusCode?: number; status?: number })?.statusCode ?? (e as { status?: number })?.status
    if (typeof s === 'number') return s
  }
  return undefined
}

function textOf(err: unknown): string {
  return errorChain(err)
    .map(e => {
      const a = e as { responseBody?: string; message?: string }
      return `${a.responseBody ?? ''} ${a.message ?? ''}`
    })
    .join(' ')
    .toLowerCase()
}

/** Provider is at capacity — 529 overloaded_error, or a 503. Worth falling back. */
export function isOverloadedError(err: unknown): boolean {
  const s = statusOf(err)
  if (s === 529 || s === 503) return true
  return /overloaded_error|overloaded/.test(textOf(err))
}

/** We're being throttled — 429. Retryable, but a different model won't help much. */
export function isRateLimitError(err: unknown): boolean {
  return statusOf(err) === 429 || /rate_limit_error/.test(textOf(err))
}

/** Anthropic is down or erroring, as opposed to us sending a bad request. */
export function isProviderOutage(err: unknown): boolean {
  const s = statusOf(err)
  return s !== undefined && s >= 500
}

/** The request itself is wrong (bad key, bad params) — retrying won't fix it. */
export function isAuthError(err: unknown): boolean {
  const s = statusOf(err)
  return s === 401 || s === 403
}

/**
 * Did this come from the AI provider at all? Lets callers keep their existing
 * message for ordinary failures (a DB error, a bad connector) and only swap in
 * the friendly copy when the model was genuinely the problem.
 */
export function isAiError(err: unknown): boolean {
  return errorChain(err).some(e => APICallError.isInstance(e))
}

/**
 * A sentence we're happy to show a non-technical beta user. Never leaks a raw
 * provider payload, a stack trace, or a model name.
 */
export function friendlyAiError(err: unknown): string {
  if (isOverloadedError(err)) {
    return "Orbit's AI is unusually busy right now. We retried a few times and switched to a faster model, but it's still at capacity — please try again in a minute."
  }
  if (isRateLimitError(err)) {
    return "Orbit's AI is handling a lot of requests at the moment. Give it about a minute and try again."
  }
  if (isAuthError(err)) {
    return "Orbit couldn't reach its AI provider — this is a configuration problem on our side, not something you did. Please let an admin know."
  }
  if (isProviderOutage(err)) {
    return "Orbit's AI provider is having trouble right now. We retried automatically; please try again shortly."
  }
  const msg = err instanceof Error ? err.message : String(err ?? '')
  // Anything unrecognised: keep it short and non-alarming, but don't pretend it
  // was an outage — a truncated real message helps admins triage from the logs.
  return `Something went wrong while Orbit was thinking. ${msg.slice(0, 200)}`.trim()
}

export interface FallbackInfo {
  /** The model that actually produced the result. */
  model: ModelId
  /** True when the primary model was overloaded and Economy answered instead. */
  usedFallback: boolean
}

/**
 * Run an AI call on `primary`; if the provider is overloaded even after the
 * SDK's retries, run it again on the Economy model.
 *
 * The caller gets back which model actually answered so it can bill and log the
 * right one — silently charging Opus rates for a Haiku answer would be wrong.
 *
 * Only overload falls back. A 429 means *our* key is throttled (switching model
 * doesn't help), and a 4xx means the request is malformed (it'd fail identically
 * on any model), so both rethrow immediately.
 */
export async function withModelFallback<T>(
  primary: ModelId,
  run: (model: ModelId) => Promise<T>,
  opts: { fallback?: ModelId; label?: string } = {},
): Promise<{ result: T } & FallbackInfo> {
  const fallback = opts.fallback ?? CHEAP_MODEL
  try {
    return { result: await run(primary), model: primary, usedFallback: false }
  } catch (err) {
    const sameTier = MODEL_PRICING[primary]?.tier <= MODEL_PRICING[fallback]?.tier
    if (!isOverloadedError(err) || primary === fallback || sameTier) throw err

    console.warn(
      `[ai-resilience] ${opts.label ?? 'request'}: ${primary} overloaded after ${AI_MAX_RETRIES} retries — falling back to ${fallback}`,
    )
    try {
      return { result: await run(fallback), model: fallback, usedFallback: true }
    } catch (fallbackErr) {
      // Both models are down. Surface the fallback's error — it's the more
      // recent signal, and it's what the friendly message will describe.
      throw fallbackErr
    }
  }
}
