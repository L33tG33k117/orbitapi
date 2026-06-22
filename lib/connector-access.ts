// Per-connector access controls (RBAC by action risk class).
// A connection's `allowed_risk_levels` caps which action classes it may run.
// Enforced in: /api/execute, the chat tool builder, and the skill/playbook runners.

export type Risk = 'read' | 'write' | 'destructive'
export const ALL_RISKS: Risk[] = ['read', 'write', 'destructive']

// null/undefined = legacy row (column absent or unset) → treat as all allowed,
// so enforcement never accidentally bricks a connection it has no policy for.
export function riskAllowed(allowed: readonly string[] | null | undefined, risk: string): boolean {
  if (!allowed || allowed.length === 0) return true
  return allowed.includes(risk)
}

// Normalize arbitrary input to a valid, de-duped risk-level array (read always
// kept — a connection with no readable actions is useless and confusing).
export function normalizeRiskLevels(input: unknown): Risk[] {
  const arr = Array.isArray(input) ? input : []
  const set = new Set<Risk>(['read'])
  for (const r of arr) if (r === 'write' || r === 'destructive') set.add(r)
  return ALL_RISKS.filter(r => set.has(r))
}
