// ============================================================
// Foundation B — LLM cost attribution + model routing
// ============================================================
// Single source of truth for model pricing and cost math. Used by
// the skill/playbook runners to record per-run cost, and by the #8
// cost optimizer to route cheap work to cheaper models and warn
// before expensive operations.
//
// Prices are USD per 1,000,000 tokens. Keep in sync with the
// Anthropic pricing reference — do not edit from memory.
// ============================================================

export type ModelId =
  | 'claude-opus-5'
  | 'claude-sonnet-5'
  | 'claude-haiku-4-5'
  | 'claude-fable-5'

// ------------------------------------------------------------
// Local (self-hosted) models
// ------------------------------------------------------------
// A self-hosted customer runs their own model on their own hardware, so there
// is no per-token price to attribute — the tokens are free to us AND to them.
// Those runs are still RECORDED (token counts, run history, usage charts are
// all still useful) but they cost $0 and consume no AI Power.
//
// We tag them with a `local:` prefix so a model id is self-describing wherever
// it lands: a run row, a log line, an admin screen. Nothing has to consult the
// edition to know how to treat it.

/** Model id for a customer-supplied local model, e.g. `local:llama3.1:70b`. */
export type LocalModelId = `local:${string}`

/** Any model id we might record on a run — hosted Claude or a local model. */
export type AnyModelId = ModelId | LocalModelId

export const LOCAL_MODEL_PREFIX = 'local:'

/** Tag a customer's model name as a local model id. */
export function localModelId(name: string): LocalModelId {
  return `${LOCAL_MODEL_PREFIX}${name}` as LocalModelId
}

/** Is this a customer-run local model (free, unmetered) rather than hosted Claude? */
export function isLocalModel(model: string | null | undefined): boolean {
  return typeof model === 'string' && model.startsWith(LOCAL_MODEL_PREFIX)
}

/** The bare model name a local id wraps (`local:llama3` → `llama3`). */
export function localModelName(model: string): string {
  return isLocalModel(model) ? model.slice(LOCAL_MODEL_PREFIX.length) : model
}

export interface ModelPrice {
  inputPerMTok: number
  outputPerMTok: number
  /** Relative capability rank (higher = more capable) — used by the router. */
  tier: number
}

export const MODEL_PRICING: Record<ModelId, ModelPrice> = {
  'claude-fable-5':  { inputPerMTok: 10, outputPerMTok: 50, tier: 4 },
  'claude-opus-5':   { inputPerMTok: 5,  outputPerMTok: 25, tier: 3 },
  // Sonnet 5 list price. Anthropic is running an introductory $2/$10 through
  // 2026-08-31; we bill the list rate so AI Power never has to be re-priced
  // upward when the promo ends. Slightly conservative, never under-charges.
  'claude-sonnet-5': { inputPerMTok: 3,  outputPerMTok: 15, tier: 2 },
  'claude-haiku-4-5':{ inputPerMTok: 1,  outputPerMTok: 5,  tier: 1 },
}

export const DEFAULT_MODEL: ModelId = 'claude-sonnet-5'
export const CHEAP_MODEL: ModelId = 'claude-haiku-4-5'

// Cost of a single run in USD given token usage.
export function computeCost(model: string, tokensIn: number, tokensOut: number): number {
  // A model the customer runs themselves costs us nothing to serve. Checked
  // BEFORE the pricing lookup — an unknown id falls back to DEFAULT_MODEL
  // pricing, which would silently bill Sonnet rates for a local run.
  if (isLocalModel(model)) return 0
  const price = MODEL_PRICING[model as ModelId] ?? MODEL_PRICING[DEFAULT_MODEL]
  const cost =
    (tokensIn / 1_000_000) * price.inputPerMTok +
    (tokensOut / 1_000_000) * price.outputPerMTok
  // Round to 6 decimals to match the numeric(10,6) column.
  return Math.round(cost * 1e6) / 1e6
}

// Normalize the AI SDK's usage object across versions (inputTokens/outputTokens
// in v6; promptTokens/completionTokens in older shapes).
export function normalizeUsage(usage: unknown): { tokensIn: number; tokensOut: number } {
  const u = (usage ?? {}) as Record<string, number | undefined>
  return {
    tokensIn: u.inputTokens ?? u.promptTokens ?? 0,
    tokensOut: u.outputTokens ?? u.completionTokens ?? 0,
  }
}

// #8 router: pick the cheapest model that still clears the task's capability
// floor. `complexity` is a 0–1 hint the caller derives (prompt length, tool
// count, autonomy level). Respects an explicit per-skill override.
export function routeModel(opts: {
  override?: string | null
  complexity?: number
}): ModelId {
  if (opts.override && opts.override in MODEL_PRICING) return opts.override as ModelId
  const c = opts.complexity ?? 0.5
  if (c < 0.25) return 'claude-haiku-4-5'
  if (c < 0.7) return 'claude-sonnet-5'
  return 'claude-opus-5'
}

// Estimate the cost of a run before it happens, for the "warn before expensive
// operations" UX. Uses rough token estimates the caller provides.
export function estimateCost(model: string, estTokensIn: number, estTokensOut: number): number {
  return computeCost(model, estTokensIn, estTokensOut)
}

const EXPENSIVE_RUN_THRESHOLD_USD = 0.5
export function isExpensive(costUsd: number): boolean {
  return costUsd >= EXPENSIVE_RUN_THRESHOLD_USD
}
