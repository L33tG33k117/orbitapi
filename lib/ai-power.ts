import { createAdminClient } from '@/lib/supabase/admin'
import type { ModelId } from '@/lib/usage-cost'

// ============================================================
// AI Power — customer-facing credits + efficiency
// ============================================================
// Users never see dollars, tokens, model names, or the AI vendor.
// They see "AI Power" credits (monthly allowance + optional top-ups)
// and choose an Efficiency level. Internally we map efficiency → a
// model and convert our real cost (cost_usd) → credits.
//
// Tune the numbers in this file freely — they're the business knobs.
// ============================================================

export type Efficiency = 'maximum' | 'balanced' | 'economy'

// Efficiency → underlying model. Kept server-side only; never sent to the UI.
export const EFFICIENCY_MODEL: Record<Efficiency, ModelId> = {
  maximum: 'claude-opus-5',
  balanced: 'claude-sonnet-5',
  economy: 'claude-haiku-4-5',
}

// User-facing copy for each efficiency level (no model/vendor names).
export const EFFICIENCY_INFO: Record<Efficiency, { label: string; blurb: string }> = {
  maximum: { label: 'Maximum', blurb: 'Most capable — best for complex, high-stakes work. Uses more AI Power.' },
  balanced: { label: 'Balanced', blurb: 'Great quality at a sensible pace. Recommended for most work.' },
  economy: { label: 'Economy', blurb: 'Fast and light for simple, high-volume tasks. Uses the least AI Power.' },
}
export const EFFICIENCY_ORDER: Efficiency[] = ['economy', 'balanced', 'maximum']

// 1 credit = $0.001 of underlying cost (a tenth of a cent). Internal only.
const CREDIT_USD = 0.001
export function costToCredits(costUsd: number): number {
  return Math.ceil((costUsd || 0) / CREDIT_USD)
}

// Monthly included credits by PAID plan tier (≈ our cost cap × 1000).
// Free is intentionally NOT a monthly grant — see FREE_TRIAL_CREDITS below.
export const TIER_MONTHLY_CREDITS: Record<string, number> = {
  free: 0,            // no recurring AI cost for free workspaces
  starter: 15_000,    // ≈ $15 / month
  pro: 60_000,        // ≈ $60 / month
  enterprise: 1_000_000,
}

// Free tier = a ONE-TIME trial pool (never refills). Lets a new user feel the
// real product a handful of times at a tiny, bounded cost to us (~$0.50), then
// they upgrade to keep going. Tune this single number to size the trial.
export const FREE_TRIAL_CREDITS = 500

export function tierCredits(tier: string | null | undefined): number {
  return TIER_MONTHLY_CREDITS[tier ?? 'free'] ?? TIER_MONTHLY_CREDITS.free
}

// Base allowance shown for a plan (trial for free, monthly for paid). Used by
// admin views; the authoritative per-workspace number comes from getAiPower.
export function planBaseCredits(tier: string | null | undefined): number {
  return (tier ?? 'free') === 'free' ? FREE_TRIAL_CREDITS : tierCredits(tier)
}

// Top-up packs: retailUsd is what the customer pays; `credits` is the usable AI
// value (margin = retailUsd − credits×CREDIT_USD). $25 → 20k credits (~$5 margin).
export const TOPUP_PACKS = [
  { id: 'power-25', label: 'Power Pack', retailUsd: 25, credits: 20_000 },
  { id: 'power-50', label: 'Power Pack +', retailUsd: 50, credits: 42_000 },
  { id: 'power-100', label: 'Mega Power Pack', retailUsd: 100, credits: 90_000 },
]
export function getPack(id: string) {
  return TOPUP_PACKS.find(p => p.id === id)
}

// Minimum poll interval (hours) for autonomous/scheduled runs, by tier — stops a
// single autonomous skill from draining the pool, and is an upgrade lever.
export const TIER_MIN_POLL_HOURS: Record<string, number> = {
  free: 24, starter: 6, pro: 1, enterprise: 0,
}
export function tierMinPollHours(tier: string | null | undefined): number {
  return TIER_MIN_POLL_HOURS[tier ?? 'free'] ?? 24
}

const CYCLE_MS = 30 * 24 * 60 * 60 * 1000

export interface AiPower {
  tier: string
  monthly: number
  topup: number
  used: number
  allowance: number
  remaining: number
  pctUsed: number
  efficiency: Efficiency
  resetInDays: number   // whole days until the allowance resets (0 for trial)
  isTrial: boolean      // free = one-time pool that never refills
}

// Read-only view of a workspace's AI Power. Treats an elapsed cycle as reset
// (the authoritative reset happens atomically in consume_ai_credits on next use).
export async function getAiPower(workspaceId: string): Promise<AiPower> {
  const admin = createAdminClient()
  const { data: ws } = await admin
    .from('workspaces')
    .select('tier, ai_credits_used, ai_topup_credits, ai_credits_cycle_start, ai_efficiency, ai_credit_override')
    .eq('id', workspaceId)
    .single()

  const tier = ws?.tier ?? 'free'
  // Free is a one-time trial pool (never refills); paid tiers reset each cycle.
  const isTrial = tier === 'free'
  const cycleStart = ws?.ai_credits_cycle_start ? new Date(ws.ai_credits_cycle_start).getTime() : 0
  const elapsed = !isTrial && (!cycleStart || Date.now() - cycleStart > CYCLE_MS)

  const used = elapsed ? 0 : (ws?.ai_credits_used ?? 0)
  const topup = elapsed ? 0 : (ws?.ai_topup_credits ?? 0)
  // Per-workspace override (custom/enterprise deals, comped testers) wins over the tier default.
  const override = ws?.ai_credit_override
  const hasOverride = typeof override === 'number' && override >= 0
  const monthly = hasOverride ? override : (isTrial ? FREE_TRIAL_CREDITS : tierCredits(tier))
  const allowance = monthly + topup
  const remaining = Math.max(0, allowance - used)

  // Days until the allowance resets. Trial pools don't reset.
  const resetAt = elapsed ? Date.now() + CYCLE_MS : cycleStart + CYCLE_MS
  const resetInDays = isTrial ? 0 : Math.max(0, Math.ceil((resetAt - Date.now()) / (24 * 60 * 60 * 1000)))

  return {
    tier, monthly, topup, used, allowance, remaining,
    pctUsed: allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0,
    efficiency: (ws?.ai_efficiency ?? 'balanced') as Efficiency,
    resetInDays,
    isTrial,
  }
}

export async function hasAiPower(workspaceId: string): Promise<boolean> {
  return (await getAiPower(workspaceId)).remaining > 0
}

// Record usage after a run (cost → credits). Best-effort; never throws.
export async function consumeCredits(workspaceId: string, costUsd: number): Promise<void> {
  const credits = costToCredits(costUsd)
  if (credits <= 0) return
  const admin = createAdminClient()
  await admin.rpc('consume_ai_credits', { p_workspace_id: workspaceId, p_credits: credits }).then(() => {}, () => {})
}

// Resolve the model for a run from efficiency (per-skill override → workspace default).
export function modelFor(efficiency: Efficiency | null | undefined, fallback: Efficiency = 'balanced'): ModelId {
  return EFFICIENCY_MODEL[efficiency ?? fallback]
}

// Thrown when a workspace is out of AI Power so callers can return a clean prompt.
export const OUT_OF_AI_POWER = 'OUT_OF_AI_POWER'
