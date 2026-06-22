import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/feedback — the caller's own submitted feedback, newest first, with
// the triage status so they can track progress on what they reported.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('feedback')
    .select('id, message, page_url, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ feedback: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, pageUrl, diagnostics } = await req.json() as {
    message?: string; pageUrl?: string; diagnostics?: Record<string, unknown>
  }
  if (!message?.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user.id).single()

  const admin = createAdminClient()
  const base = {
    workspace_id: membership?.workspace_id ?? null,
    user_id: user.id,
    message: message.trim().slice(0, 5000),
    page_url: pageUrl ?? null,
  }

  // Prefer the structured `diagnostics` column. If it isn't present yet (migration
  // 039 not applied), gracefully fall back to folding a readable summary into the
  // message so nothing is lost and feedback keeps working.
  let { error } = await admin.from('feedback').insert({ ...base, diagnostics: diagnostics ?? null })
  if (error && (error.code === 'PGRST204' || /diagnostics/i.test(error.message))) {
    const summary = summarizeDiagnostics(diagnostics)
    ;({ error } = await admin.from('feedback').insert({
      ...base,
      message: (base.message + summary).slice(0, 8000),
    }))
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}

function summarizeDiagnostics(d?: Record<string, unknown>): string {
  if (!d) return ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errors = (d.errors as any[]) ?? []
  const lines = [
    '',
    '— context —',
    d.path ? `page: ${d.path}` : '',
    d.viewport ? `viewport: ${d.viewport}` : '',
    d.userAgent ? `browser: ${String(d.userAgent).slice(0, 200)}` : '',
    errors.length ? `errors (${errors.length}):` : 'errors: none',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...errors.map((e: any) => `  • ${e.message}${e.source ? ` (${e.source})` : ''}`),
  ]
  return lines.filter(Boolean).join('\n')
}
