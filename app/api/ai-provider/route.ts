import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { storeSecret } from '@/lib/credentials'
import { isSelfHost } from '@/lib/edition'
import { hasCapability, type FeatureOverrides } from '@/lib/entitlements'
import { logAuditEvent } from '@/lib/audit'
import type { WorkspaceTier } from '@/types'

// ============================================================
// Workspace AI provider settings (bring-your-own LLM)
// ============================================================
// Admin-only. The API key is never returned — only whether one is set — so a
// workspace member with devtools open can't read it back out of a JSON body.

interface Ctx {
  workspaceId: string
  isAdmin: boolean
  entitled: boolean
}

async function context(): Promise<Ctx | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership) return null

  const admin = createAdminClient()
  const { data: ws } = await admin
    .from('workspaces').select('tier, feature_flags').eq('id', membership.workspace_id).maybeSingle()

  return {
    workspaceId: membership.workspace_id,
    isAdmin: membership.role !== 'member',
    // Self-hosted instances always have this: it's the only way they can run
    // an AI at all. On cloud it's an explicit per-workspace grant.
    entitled: isSelfHost() || hasCapability(
      (ws?.tier ?? null) as WorkspaceTier | null,
      (ws?.feature_flags ?? null) as FeatureOverrides | null,
      'byo_llm',
    ),
  }
}

export async function GET() {
  const ctx = await context()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('ai_provider_settings')
    .select('base_url, model_name, max_output_tokens, enabled, api_key_secret_id')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  return NextResponse.json({
    entitled: ctx.entitled,
    settings: data
      ? {
          baseUrl: data.base_url,
          modelName: data.model_name,
          maxOutputTokens: data.max_output_tokens,
          enabled: data.enabled,
          hasApiKey: !!data.api_key_secret_id,
        }
      : null,
  })
}

export async function PUT(req: Request) {
  const ctx = await context()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!ctx.entitled) {
    return NextResponse.json(
      { error: 'plan_required', message: 'Running your own AI model isn\'t available on this plan.' },
      { status: 403 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const baseUrl = String(body.baseUrl ?? '').trim()
  const modelName = String(body.modelName ?? '').trim()
  const enabled = body.enabled !== false

  if (!baseUrl || !modelName) {
    return NextResponse.json({ error: 'A server address and model name are both required.' }, { status: 400 })
  }
  // Reject anything we can't actually call, with a message that says what to fix.
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    return NextResponse.json({ error: 'That server address isn\'t a valid URL. It should look like http://192.168.1.50:11434/v1' }, { status: 400 })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'The server address must start with http:// or https://' }, { status: 400 })
  }

  const maxOutputTokens = Number(body.maxOutputTokens)
  const maxTokens = Number.isFinite(maxOutputTokens) && maxOutputTokens > 0 ? Math.floor(maxOutputTokens) : null

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('ai_provider_settings')
    .select('api_key_secret_id')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  // An absent apiKey means "leave the stored one alone"; an empty string means
  // "clear it". Without that distinction, saving the form would silently wipe
  // the key every time, since we never send it back down to be re-submitted.
  let apiKeySecretId = existing?.api_key_secret_id ?? null
  if (typeof body.apiKey === 'string') {
    const key = body.apiKey.trim()
    apiKeySecretId = key
      ? await storeSecret({ api_key: key }, `ai_provider_${ctx.workspaceId}_${Date.now()}`)
      : null
  }

  const { error } = await admin.from('ai_provider_settings').upsert({
    workspace_id: ctx.workspaceId,
    base_url: baseUrl,
    model_name: modelName,
    max_output_tokens: maxTokens,
    api_key_secret_id: apiKeySecretId,
    enabled,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    workspaceId: ctx.workspaceId,
    category: 'workspace',
    action: 'ai_provider.updated',
    summary: enabled ? `AI provider set to ${modelName}` : 'AI provider disabled (using Claude)',
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const ctx = await context()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  await admin.from('ai_provider_settings').delete().eq('workspace_id', ctx.workspaceId)

  await logAuditEvent({
    workspaceId: ctx.workspaceId,
    category: 'workspace',
    action: 'ai_provider.removed',
    summary: 'AI provider removed — back to Claude',
  })

  return NextResponse.json({ ok: true })
}
