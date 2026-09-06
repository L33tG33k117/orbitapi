import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { resolveCredentials } from '@/lib/credentials'
import { simulateAction } from '@/lib/simulate-action'
import { resolveAiProvider } from '@/lib/ai-provider'
import { AI_MAX_RETRIES, friendlyAiError, isAiError, maxTokensFor, thinkingFor } from '@/lib/ai-resilience'

export const maxDuration = 120

// Feature #3 — AI cross-connector data mapping.
// Pulls a live sample from the source read action, reads the target write action's
// input schema, and asks the model to propose field mappings + a transformed preview
// the user can approve before automating. Read-only on the source; never writes the target.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { sourceConnectionId, sourceAction, targetConnectionId, targetAction } = await req.json()
  if (!sourceConnectionId || !sourceAction || !targetConnectionId || !targetAction) {
    return NextResponse.json({ error: 'source/target connection and action required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: conns } = await admin
    .from('connections')
    .select('id, label, is_simulated, vault_secret_id, connector:connectors(slug, name)')
    .in('id', [sourceConnectionId, targetConnectionId])
    .eq('workspace_id', membership.workspace_id)

  const src = (conns ?? []).find(c => c.id === sourceConnectionId)
  const tgt = (conns ?? []).find(c => c.id === targetConnectionId)
  if (!src || !tgt) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const srcSlug = (src.connector as any)?.slug
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tgtSlug = (tgt.connector as any)?.slug
  const srcManifest = getConnector(srcSlug)
  const tgtManifest = getConnector(tgtSlug)
  const srcDef = srcManifest?.actions.find(a => a.slug === sourceAction)
  const tgtDef = tgtManifest?.actions.find(a => a.slug === targetAction)
  if (!srcDef || !tgtDef) return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  if (srcDef.risk !== 'read') return NextResponse.json({ error: 'Source action must be a read action' }, { status: 400 })

  // Pull a sample from the source (simulated or live).
  const sampleResult = src.is_simulated
    ? simulateAction(srcSlug, sourceAction, {})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : await srcDef.execute(await resolveCredentials(src as any), {})
  if (!sampleResult.ok) {
    return NextResponse.json({ error: `Could not fetch source sample: ${sampleResult.error}` }, { status: 502 })
  }
  // Take the first record if the sample is a list.
  let sample: unknown = sampleResult.data
  if (Array.isArray(sample)) sample = sample[0]
  else if (sample && typeof sample === 'object') {
    const arr = Object.values(sample as Record<string, unknown>).find(v => Array.isArray(v))
    if (Array.isArray(arr)) sample = arr[0]
  }

  const provider = await resolveAiProvider(membership.workspace_id)

  try {
    const { text } = await generateText({
      model: provider.model('claude-opus-5'),
      maxRetries: AI_MAX_RETRIES,
      providerOptions: thinkingFor(provider, 'none', 'claude-opus-5'),
      system: `You map fields from a source record to a target action's input schema.
Return ONLY JSON:
{
  "mappings": [{ "target": "targetField", "source": "source.path or constant", "note": "transform if any" }],
  "preview": { ...target input object built from the sample... },
  "unmapped": ["targetField required but no source match"]
}
Use dot paths into the sample for source. Apply obvious transforms (concatenation, date formats). Only include
target fields that exist in the schema. Flag required target fields you couldn't map in "unmapped".`,
      prompt: `Source connector: ${srcSlug}, action ${srcDef.name}
Sample source record:
${JSON.stringify(sample, null, 2).slice(0, 4000)}

Target connector: ${tgtSlug}, action ${tgtDef.name}
Target input schema:
${JSON.stringify(tgtDef.inputSchema, null, 2).slice(0, 4000)}`,
      maxOutputTokens: maxTokensFor(provider, 2000),
    })
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Could not parse mapping' }, { status: 502 })
    const result = JSON.parse(match[0])
    return NextResponse.json({ ...result, sample })
  } catch (err) {
    console.error('[data-mapping]', err)
    const message = isAiError(err) ? friendlyAiError(err, provider) : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
