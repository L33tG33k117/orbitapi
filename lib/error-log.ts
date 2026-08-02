// ============================================================
// In-app error monitoring
// ============================================================
// docs/STATUS.md debt: "No error monitoring — see failures testers don't
// report." Client and server errors are persisted to `error_events` and read
// back in the admin area, so failures are visible without digging through
// Vercel's logs or standing up a third-party service.
//
// Every function here is best-effort and MUST NOT throw: an error in the error
// logger would be the worst possible bug. If migration 052 hasn't been applied
// the writes no-op and we fall back to console.error, exactly as before.

import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export interface ErrorEventInput {
  source: 'client' | 'server'
  message: string
  stack?: string | null
  url?: string | null
  digest?: string | null
  /** Where in the product it happened — 'skill-runner', 'chat', a route path. */
  context?: string | null
  userAgent?: string | null
  workspaceId?: string | null
  userId?: string | null
}

// Strip the parts of a message that vary between otherwise-identical errors, so
// they roll up into one row instead of one row each.
function normalise(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\b\d{4}-\d{2}-\d{2}T[\d:.]+Z?\b/g, '<time>')
    .replace(/\b\d{5,}\b/g, '<n>')
    .replace(/https?:\/\/[^\s"')]+/g, '<url>')
    .slice(0, 500)
}

// Group by source + normalised message + the first stack frame. The frame is
// what separates "same message, different call site" into distinct problems.
function fingerprint(input: ErrorEventInput): string {
  const frame = (input.stack ?? '').split('\n').find(l => /\s+at\s/.test(l))?.trim() ?? ''
  const basis = `${input.source}|${normalise(input.message)}|${normalise(frame)}`
  return createHash('sha256').update(basis).digest('hex').slice(0, 32)
}

/**
 * Record an error. Rolls up onto an existing row when the same problem recurs.
 * Never throws — callers can fire-and-forget.
 */
export async function logErrorEvent(input: ErrorEventInput): Promise<void> {
  // Always keep the console line: it's the fallback when the table is missing,
  // and it's what shows up in Vercel's live log tail during a deploy.
  console.error(
    `[${input.source.toUpperCase()} ERROR]${input.context ? ` [${input.context}]` : ''} ${input.message}` +
    (input.url ? `\n  URL: ${input.url}` : ''),
  )

  try {
    const admin = createAdminClient()
    const fp = fingerprint(input)
    const now = new Date().toISOString()

    // Bump the existing row if we've seen this before. A read-then-write race
    // between two concurrent reports is harmless — worst case one occurrence
    // isn't counted, and the unique index makes the insert path idempotent.
    const { data: existing } = await admin
      .from('error_events')
      .select('id, occurrences')
      .eq('fingerprint', fp)
      .maybeSingle()

    if (existing) {
      await admin
        .from('error_events')
        .update({
          occurrences: (existing.occurrences ?? 0) + 1,
          last_seen_at: now,
          // A recurrence un-resolves it: if it's happening again it isn't fixed.
          resolved: false,
        })
        .eq('id', existing.id)
      return
    }

    await admin.from('error_events').insert({
      fingerprint: fp,
      source: input.source,
      message: input.message.slice(0, 2000),
      stack: input.stack?.slice(0, 8000) ?? null,
      url: input.url?.slice(0, 500) ?? null,
      digest: input.digest?.slice(0, 100) ?? null,
      context: input.context?.slice(0, 100) ?? null,
      user_agent: input.userAgent?.slice(0, 300) ?? null,
      workspace_id: input.workspaceId ?? null,
      user_id: input.userId ?? null,
      first_seen_at: now,
      last_seen_at: now,
    })
  } catch {
    // Table missing (migration 052 not applied) or DB unreachable. The
    // console.error above already fired — that's the graceful degradation.
  }
}

/** Convenience wrapper for server-side catch blocks. */
export function logServerError(
  err: unknown,
  context: string,
  meta: { workspaceId?: string | null; userId?: string | null } = {},
): void {
  const e = err instanceof Error ? err : new Error(String(err))
  // Deliberately not awaited — never make a request slower to log its own failure.
  void logErrorEvent({
    source: 'server',
    message: e.message || String(err),
    stack: e.stack ?? null,
    context,
    workspaceId: meta.workspaceId ?? null,
    userId: meta.userId ?? null,
  })
}
