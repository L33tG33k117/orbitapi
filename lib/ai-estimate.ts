// Client-safe AI Power estimation. Lets the UI show a rough "this will use ~N
// AI Power" before a user commits to a skill, schedule, or bundle.
//
// IMPORTANT: this module is PURE (no server/admin imports) so it can run in
// client components. It mirrors the credit math in lib/ai-power.ts
// (1 credit = $0.001) and the per-efficiency model mapping — keep in sync.
// Estimates are deliberately conservative; prompt caching often makes real
// usage lower, and complex multi-step runs can go higher.

import { computeCost, type ModelId } from '@/lib/usage-cost'

export type Efficiency = 'maximum' | 'balanced' | 'economy'

const EFFICIENCY_MODEL: Record<Efficiency, ModelId> = {
  maximum: 'claude-opus-4-8',
  balanced: 'claude-sonnet-4-6',
  economy: 'claude-haiku-4-5',
}

const CREDIT_USD = 0.001
function creditsFor(model: ModelId, tokensIn: number, tokensOut: number): number {
  return Math.ceil(computeCost(model, tokensIn, tokensOut) / CREDIT_USD)
}

// Rough per-run token profiles. `in` includes system prompt + tool defs + data
// the agent reads; `out` is the reply plus any tool-call arguments.
const PROFILE = {
  low: { in: 8_000, out: 1_000 },
  typical: { in: 18_000, out: 2_500 },
  high: { in: 40_000, out: 6_000 },
}

export interface CreditEstimate { low: number; typical: number; high: number }

// Estimated AI Power for a single run at a given efficiency.
export function estimateRunCredits(efficiency: Efficiency = 'balanced'): CreditEstimate {
  const model = EFFICIENCY_MODEL[efficiency]
  return {
    low: creditsFor(model, PROFILE.low.in, PROFILE.low.out),
    typical: creditsFor(model, PROFILE.typical.in, PROFILE.typical.out),
    high: creditsFor(model, PROFILE.high.in, PROFILE.high.out),
  }
}

// Approx runs per month from a day-of-week cron field: '*' = daily; a comma list
// (e.g. "1,3,5") = those weekdays.
export function runsPerMonth(dow: string | null | undefined): number {
  if (!dow || dow === '*') return 30
  const days = dow.split(',').filter(Boolean).length || 1
  return Math.round(days * 4.345)
}

// Scale a per-run estimate by a run count (for scheduled/monthly totals).
export function scaleEstimate(est: CreditEstimate, runs: number): CreditEstimate {
  return { low: est.low * runs, typical: est.typical * runs, high: est.high * runs }
}

// Sum estimates (e.g. a bundle with several skills).
export function sumEstimates(ests: CreditEstimate[]): CreditEstimate {
  return ests.reduce((a, e) => ({ low: a.low + e.low, typical: a.typical + e.typical, high: a.high + e.high }),
    { low: 0, typical: 0, high: 0 })
}

export function formatCredits(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// "~90 (40–210)" style label for a credit estimate.
export function formatEstimate(est: CreditEstimate): string {
  return `~${formatCredits(est.typical)} (${formatCredits(est.low)}–${formatCredits(est.high)})`
}
