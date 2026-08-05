// ============================================================
// Edition — which deployment target is this process running as?
// ============================================================
// OrbitAPI ships as two editions from ONE codebase:
//
//   cloud     — the hosted product (orbitapi-eosin.vercel.app). Anthropic
//               models, AI Power credits, Stripe billing, marketing pages.
//   selfhost  — the offline / air-gapped Docker package a customer runs on
//               their own hardware. Their own LLM, license-key entitlements,
//               no billing, no outbound internet.
//
// `ORBIT_EDITION` is the ONLY switch, and this module is the ONLY place that
// reads it. That makes every edition-dependent behaviour grep-able from one
// symbol (`isSelfHost`) instead of scattered `process.env` checks that drift.
//
// Server-only in practice: the value is a runtime env var, so a client
// component can't read it directly. Pass it down via config-provider instead.
// ============================================================

export type Edition = 'cloud' | 'selfhost'

/** The edition this process is running as. Anything unrecognised means cloud. */
export function edition(): Edition {
  return process.env.ORBIT_EDITION === 'selfhost' ? 'selfhost' : 'cloud'
}

/** True only in the offline / self-hosted Docker package. */
export function isSelfHost(): boolean {
  return edition() === 'selfhost'
}

/** True in the hosted product. The default for any environment that says nothing. */
export function isCloud(): boolean {
  return edition() === 'cloud'
}
