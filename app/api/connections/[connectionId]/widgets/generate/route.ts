import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnector } from '@/connectors'
import { resolveAiProvider } from '@/lib/ai-provider'
import { AI_MAX_RETRIES, friendlyAiError, maxTokensFor, thinkingFor } from '@/lib/ai-resilience'

const ICON_VALUES = [
  'Shield', 'ShieldOff', 'ShieldCheck', 'Lock', 'Unlock', 'Zap', 'ZapOff',
  'Bell', 'BellOff', 'AlertTriangle', 'AlertCircle', 'CheckCircle', 'XCircle',
  'Power', 'PowerOff', 'Play', 'Pause', 'RotateCcw', 'Search', 'List', 'Eye',
  'Download', 'Send', 'Mail', 'Sun', 'Moon', 'Lightbulb', 'Home', 'Building',
  'Users', 'User', 'UserX', 'Server', 'Globe', 'Wifi', 'WifiOff', 'Activity',
  'BarChart2', 'TrendingUp', 'TrendingDown', 'Trash2', 'RefreshCw', 'Settings', 'Key', 'Flag',
]

const COLORS = ['blue', 'emerald', 'amber', 'red', 'purple', 'slate', 'cyan', 'orange']

export async function POST(req: Request, { params }: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const customPrompt: string | undefined = body.prompt

  const admin = createAdminClient()
  const { data: connection } = await admin
    .from('connections')
    .select('label, connector:connectors(slug, name, category, description)')
    .eq('id', connectionId)
    .eq('workspace_id', membership.workspace_id)
    .single()

  if (!connection) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = connection.connector as any
  const manifest = getConnector(meta?.slug)
  if (!manifest) return NextResponse.json({ error: 'Connector not found' }, { status: 404 })

  const actionsText = manifest.actions.map(a => {
    const props = Object.entries(a.inputSchema?.properties ?? {})
      .map(([k, v]) => {
        const d = v as { type?: string; description?: string }
        return `    - ${k} (${d.type ?? 'string'}): ${d.description ?? ''}`
      }).join('\n')
    return `- slug: ${a.slug}\n  name: ${a.name}\n  risk: ${a.risk}\n  description: ${a.description}\n  params:\n${props || '    (none)'}`
  }).join('\n\n')

  const provider = await resolveAiProvider(membership.workspace_id)

  let text: string
  try {
    ;({ text } = await generateText({
    model: provider.model('claude-sonnet-5'),
    maxRetries: AI_MAX_RETRIES,
    providerOptions: thinkingFor(provider, 'none', 'claude-sonnet-5'),
    system: `You are an expert UI designer for API integration platforms. Design widget button configurations that make API actions accessible as single-click controls.

Key principles:
- Widgets should have 2-8 buttons covering the most commonly needed operations
- READ actions → static_params with sensible defaults, read_only=true, color from [blue, slate, cyan, emerald]
- WRITE actions → dynamic_params for required inputs that vary, confirm=true for destructive ones, color from [amber, red, orange, purple]
- For actions with obvious defaults, pre-set static_params. For actions needing specific IDs, list in dynamic_params.
- Each widget should represent a specific workflow or persona.
${customPrompt ? `\nUser instruction: ${customPrompt}` : ''}

You MUST respond with ONLY valid JSON — no markdown, no explanation. The JSON must be an array of 2-3 widget suggestions.

Schema for each suggestion:
{
  "name": string (2-4 words),
  "description": string (one sentence),
  "buttons": [
    {
      "id": string (short slug),
      "label": string (1-4 words),
      "icon": one of [${ICON_VALUES.join(', ')}],
      "color": one of [${COLORS.join(', ')}],
      "action_slug": string (must be an exact slug from the connector manifest),
      "static_params": object (pre-set values, or {} if all params are dynamic),
      "dynamic_params": string[] (param keys the user must provide at runtime),
      "confirm": boolean (true for write/destructive),
      "read_only": boolean (true for read risk),
      "result_display": "toast" | "inline" | "none"
    }
  ]
}`,
    prompt: `Design widget suggestions for the "${connection.label}" connection.

Connector: ${meta?.name} (${meta?.category})
Description: ${meta?.description ?? ''}

Available actions:
${actionsText}

Return ONLY a JSON array with ${customPrompt ? '1-2' : '2-3'} distinct widget suggestions. No markdown fences, no text, only the JSON array.`,
    maxOutputTokens: maxTokensFor(provider, 2000),
    }))
  } catch (err) {
    console.error('[widgets/generate]', err)
    return NextResponse.json({ error: friendlyAiError(err, provider) }, { status: 502 })
  }

  try {
    const cleaned = text.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/, '')
    const suggestions = JSON.parse(cleaned)
    if (!Array.isArray(suggestions)) throw new Error('Not an array')
    return NextResponse.json(suggestions)
  } catch {
    return NextResponse.json({ error: 'Failed to parse widget suggestions. Try again.' }, { status: 500 })
  }
}
