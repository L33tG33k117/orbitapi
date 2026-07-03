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

// The universal "explore_api" action (added by the connector factory) is a
// read-only escape hatch that can GET any endpoint of a vendor's API. It's
// governed like every other action by risk class, but an admin may still want to
// keep the curated shortcuts while disabling open-ended exploration on a
// sensitive connection (a secrets manager, an identity provider). This flag
// expresses that. Column absent (migration 048 not applied) or unset ⇒ allowed,
// so enforcement never bricks a connection it has no policy for.
export const EXPLORE_ACTION_SLUG = 'explore_api'

export function explorationAllowed(
  conn: { allow_api_exploration?: boolean | null } | null | undefined,
): boolean {
  return conn?.allow_api_exploration !== false
}

// True when an action should be skipped for a connection purely because open API
// exploration is turned off. Curated actions are unaffected.
export function explorationBlocks(
  conn: { allow_api_exploration?: boolean | null } | null | undefined,
  actionSlug: string,
): boolean {
  return actionSlug === EXPLORE_ACTION_SLUG && !explorationAllowed(conn)
}
