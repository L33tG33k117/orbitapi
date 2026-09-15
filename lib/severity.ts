// Shared definition of the playbook severity score (0–10).
//
// One place defines what each number means, so the assessment prompt, the
// autonomy policy and the UI explanation can never drift apart. The rubric
// describes the SITUATION, not the connector: a 7 means the same thing whether
// the data came from Slack, QuickBooks or CrowdStrike.
//
// Pure module (no server imports) so client components can use it too.

export type AutonomyMode = 'auto' | 'approval' | 'notify'
export interface Threshold { min: number; max: number; mode: AutonomyMode }

export interface SeverityLevel {
  min: number
  max: number
  label: string
  meaning: string
}

// The rubric the AI scores against. Keep it independent of the autonomy bands:
// the AI judges the situation, the user decides what each score is allowed to do.
export const SEVERITY_RUBRIC: SeverityLevel[] = [
  { min: 0, max: 2, label: 'Informational', meaning: 'Nothing is wrong, or the data is routine. No action needed.' },
  { min: 3, max: 4, label: 'Low', meaning: 'Minor issue or early warning sign. Worth knowing about, not urgent.' },
  { min: 5, max: 6, label: 'Moderate', meaning: 'A real issue that affects something, but it is contained or can wait hours.' },
  { min: 7, max: 8, label: 'High', meaning: 'Clear evidence of a serious problem that needs attention soon.' },
  { min: 9, max: 10, label: 'Critical', meaning: 'Active, confirmed harm in progress. Acting right away is justified.' },
]

export function severityLabel(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return 'Unknown'
  const s = clampScore(score)
  return SEVERITY_RUBRIC.find(l => s >= l.min && s <= l.max)?.label ?? 'Unknown'
}

export function clampScore(n: number): number {
  return Math.max(0, Math.min(10, Math.round(n)))
}

// Text block injected into the assessment prompt.
export function rubricForPrompt(): string {
  return SEVERITY_RUBRIC.map(l => `  ${l.min}–${l.max} = ${l.label}: ${l.meaning}`).join('\n')
}

// ── Autonomy bands ────────────────────────────────────────────────────────────
// Users draw two boundaries on the 0–10 scale. Everything below `approvalFrom`
// is the low band, [approvalFrom, autoFrom) is the middle band, [autoFrom, 10]
// is the top band. Each band keeps its own mode.

export interface Bands {
  approvalFrom: number // first score of the middle band
  autoFrom: number     // first score of the top band (11 = top band disabled)
  low: AutonomyMode
  mid: AutonomyMode
  high: AutonomyMode
}

export const DEFAULT_BANDS: Bands = { approvalFrom: 6, autoFrom: 9, low: 'notify', mid: 'approval', high: 'auto' }

export function bandsToThresholds(b: Bands): Threshold[] {
  const a = clampBoundary(b.approvalFrom)
  const z = Math.max(a, clampBoundary(b.autoFrom))
  const out: Threshold[] = []
  if (a > 0) out.push({ min: 0, max: a - 1, mode: b.low })
  if (z > a) out.push({ min: a, max: z - 1, mode: b.mid })
  if (z <= 10) out.push({ min: z, max: 10, mode: b.high })
  return out
}

// Best-effort read of a stored policy (which may have gaps or overlaps from the
// old free-form editor) back into two boundaries.
export function thresholdsToBands(ts: Threshold[] | null | undefined): Bands {
  if (!ts || ts.length === 0) return { ...DEFAULT_BANDS }
  const sorted = [...ts].sort((x, y) => x.min - y.min)
  if (sorted.length >= 3) {
    return {
      approvalFrom: clampBoundary(sorted[1].min), autoFrom: clampBoundary(sorted[2].min),
      low: sorted[0].mode, mid: sorted[1].mode, high: sorted[2].mode,
    }
  }
  if (sorted.length === 2) {
    return {
      approvalFrom: clampBoundary(sorted[1].min), autoFrom: 11,
      low: sorted[0].mode, mid: sorted[1].mode, high: 'auto',
    }
  }
  return { approvalFrom: 0, autoFrom: 11, low: 'notify', mid: sorted[0].mode, high: 'auto' }
}

function clampBoundary(n: number): number {
  return Math.max(0, Math.min(11, Math.round(Number(n) || 0)))
}

// Validate/normalize a policy arriving from the client. Returns null if the
// shape is unusable. Guarantees integer bands inside 0–10 with a known mode.
export function normalizeThresholds(input: unknown): Threshold[] | null {
  if (!Array.isArray(input)) return null
  const modes: AutonomyMode[] = ['auto', 'approval', 'notify']
  const out: Threshold[] = []
  for (const t of input) {
    if (!t || typeof t !== 'object') return null
    const r = t as Record<string, unknown>
    const min = clampScore(Number(r.min)), max = clampScore(Number(r.max))
    if (!modes.includes(r.mode as AutonomyMode) || !Number.isFinite(Number(r.min)) || !Number.isFinite(Number(r.max)) || min > max) return null
    out.push({ min, max, mode: r.mode as AutonomyMode })
  }
  return out
}

// Which mode applies to a score. Unmatched scores fall back to approval (safe).
export function resolveMode(score: number | null, thresholds: Threshold[] | null | undefined): AutonomyMode {
  const s = clampScore(score ?? 0)
  for (const t of thresholds ?? []) {
    if (s >= t.min && s <= t.max) return t.mode
  }
  return 'approval'
}
