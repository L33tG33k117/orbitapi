import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readSecret } from '@/lib/credentials'
import { providerFromSettings } from '@/lib/ai-provider'
import { friendlyAiError, maxTokensFor } from '@/lib/ai-resilience'

export const maxDuration = 60

// ============================================================
// "Test connection" for the AI Provider settings screen
// ============================================================
// Sends the smallest possible real request to the customer's endpoint. The
// point is to fail HERE, on a screen with a Fix-it message next to the field,
// rather than three days later inside a scheduled skill run at 4am.
//
// It tests the settings in the REQUEST BODY, not what's saved — so an admin
// can verify an address before committing to it.

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const baseUrl = String(body.baseUrl ?? '').trim()
  const modelName = String(body.modelName ?? '').trim()
  if (!baseUrl || !modelName) {
    return NextResponse.json({ ok: false, error: 'Enter a server address and model name first.' }, { status: 400 })
  }

  // If the form didn't send a key, fall back to the saved one — the UI never
  // receives the stored key, so "test without retyping it" has to work.
  let apiKey: string | undefined = typeof body.apiKey === 'string' && body.apiKey.trim()
    ? body.apiKey.trim()
    : undefined
  if (!apiKey) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('ai_provider_settings')
      .select('api_key_secret_id')
      .eq('workspace_id', membership.workspace_id)
      .maybeSingle()
    const secret = data?.api_key_secret_id ? await readSecret(data.api_key_secret_id) : null
    apiKey = secret?.api_key || undefined
  }

  const provider = providerFromSettings({ baseUrl, modelName, apiKey })
  const startedAt = Date.now()

  try {
    const { text } = await generateText({
      model: provider.model(),
      // One word back is all we need. Keep it tiny so a slow local model on
      // modest hardware still answers inside the timeout.
      prompt: 'Reply with the single word: ready',
      maxOutputTokens: maxTokensFor(provider, 32),
      maxRetries: 0,
    })
    return NextResponse.json({
      ok: true,
      ms: Date.now() - startedAt,
      reply: text.trim().slice(0, 100),
    })
  } catch (err) {
    console.error('[ai-provider/test]', err)
    return NextResponse.json({ ok: false, error: friendlyAiError(err, provider) })
  }
}
