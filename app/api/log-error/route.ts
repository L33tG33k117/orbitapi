import { createClient } from '@/lib/supabase/server'
import { logErrorEvent } from '@/lib/error-log'

// Client-side error sink. Previously this only console.error'd, so failures a
// tester hit lived in Vercel's ephemeral logs and nobody ever read them. Now
// they're persisted and surfaced at /admin/errors.
export async function POST(req: Request) {
  try {
    const { message, stack, url, digest, context } = await req.json()
    if (!message) return new Response(null, { status: 204 })

    // Attribute to a user/workspace when we can — it's what turns "something
    // broke" into "Cody hit this on /webhooks". Best-effort: an error thrown
    // before auth resolves still gets logged, just unattributed.
    let userId: string | null = null
    let workspaceId: string | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id ?? null
      if (user) {
        const { data: m } = await supabase
          .from('memberships').select('workspace_id').eq('user_id', user.id).maybeSingle()
        workspaceId = m?.workspace_id ?? null
      }
    } catch { /* unauthenticated or cookie-less — log it anyway */ }

    await logErrorEvent({
      source: 'client',
      message: String(message),
      stack: stack ? String(stack) : null,
      url: url ? String(url) : null,
      digest: digest ? String(digest) : null,
      context: context ? String(context) : null,
      userAgent: req.headers.get('user-agent'),
      userId,
      workspaceId,
    })
  } catch {
    // malformed body — ignore
  }
  return new Response(null, { status: 204 })
}
