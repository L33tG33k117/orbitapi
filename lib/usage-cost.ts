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
  | 'claude-opus-4-8'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5'
  | 'claude-fable-5'

export interface ModelPrice {
  inputPerMTok: number
  outputPerMTok: number
  /** Relative capability rank (higher = more capable) — used by the router. */
  tier: number
}

export const MODEL_PRICING: Record<ModelId, ModelPrice> = {
  'claude-fable-5':   { inputPerMTok: 10, outputPerMTok: 50, tier: 4 },
  'claude-opus-4-8':  { inputPerMTok: 5,  outputPerMTok: 25, tier: 3 },
  'claude-sonnet-4-6':{ inputPerMTok: 3,  outputPerMTok: 15, tier: 2 },
  'claude-haiku-4-5': { inputPerMTok: 1,  outputPerMTok: 5,  tier: 1 },
}

export const DEFAULT_MODEL: ModelId = 'claude-sonnet-4-6'
export const CHEAP_MODEL: ModelId = 'claude-haiku-4-5'

// Cost of a single run in USD given token usage.
export function computeCost(model: string, tokensIn: number, tokensOut: number): number {
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
  if (c < 0.7) return 'claude-sonnet-4-6'
  return 'claude-opus-4-8'
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
