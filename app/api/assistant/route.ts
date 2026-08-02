import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'
import { AI_MAX_RETRIES, NO_THINKING } from '@/lib/ai-resilience'

export const maxDuration = 30

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, context } = await req.json()
  const { page, pageLabel } = context ?? {}

  const system = `You are Orbit Assistant, embedded in OrbitAPI — a platform that lets teams connect APIs and build AI skills that automate work across their tools.

The user is currently on: ${pageLabel ?? 'OrbitAPI'} (path: ${page ?? '/'}).

Your role is to be a helpful, context-aware guide — like a knowledgeable colleague who knows OrbitAPI inside and out. You:
- Answer questions about OrbitAPI features, concepts, and workflows
- Suggest what to do next based on where the user is in the product
- Explain concepts clearly (connectors, groups, skills, autonomy modes, etc.)
- Help users think through their use cases and design better skills
- Keep answers concise and practical — 2-4 sentences max unless the user asks for more

Key concepts to explain when asked:
- Connectors: integrations with external APIs (Slack, GitHub, PagerDuty, etc.)
- Groups: bundles of connectors that a skill can use
- Skills: AI agents with a persona, given access to a group of APIs
- Autonomy modes: Manual (user triggers), Supervised (AI acts, user approves), Autonomous (runs on schedule unattended)
- Orbit Assistant (chat): free-form AI interface to query and act on connected APIs
- Reference & Manual mode: direct API command execution without natural language
- Usage: analytics on API calls, errors, and skill performance
- Audit log: complete history of all API actions taken

Do not make up feature names or capabilities that aren't described above. If unsure, say so and suggest the user explore the relevant section.`

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5'),
    maxRetries: AI_MAX_RETRIES,
    providerOptions: NO_THINKING,
    system,
    messages: messages.slice(-10),
    maxOutputTokens: 400,
  })

  return Response.json({ reply: text })
}
