import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 120

// Feature #2 — AI-driven connector schema discovery.
// Given an OpenAPI spec URL (or docs URL), introspect it and propose a connector
// manifest: actions with slug/name/method/path/risk/input fields. Returns a draft
// the admin reviews before building — never writes code directly.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, baseUrl, openApiUrl, authHint } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  // Try to fetch the OpenAPI spec to ground the discovery.
  let spec = ''
  if (openApiUrl) {
    try {
      const res = await fetch(openApiUrl, { signal: AbortSignal.timeout(15000) })
      if (res.ok) spec = (await res.text()).slice(0, 60000) // bound token usage
    } catch {
      // proceed without — model falls back to its knowledge of the API
    }
  }

  try {
    const { text } = await generateText({
      model: anthropic('claude-opus-4-8'),
      system: `You introspect an HTTP API and propose a connector manifest for an automation platform.
Return ONLY a JSON object, no prose, of the form:
{
  "validated": boolean,            // false if you cannot confidently identify real endpoints
  "validation_message": string,    // why, if not validated
  "baseUrl": string,
  "auth": { "type": "api_key"|"oauth2", "fields": [{"key","label"}] },
  "actions": [
    { "slug": "snake_case", "name": "Human Name", "description": "for an LLM, example-rich",
      "method": "GET|POST|...", "path": "/v1/...", "risk": "read"|"write"|"destructive",
      "inputs": [{"key","type","required"}] }
  ]
}
Classify risk honestly: GET/list/search = read; create/update = write; delete/cancel/isolate/purge = destructive.
Propose 8–20 of the most useful actions. Do not invent endpoints that clearly don't exist.`,
      prompt: `API name: ${name}
Base URL: ${baseUrl ?? '(unknown)'}
Auth hint: ${authHint ?? '(unknown)'}
${spec ? `OpenAPI/Swagger spec (possibly truncated):\n${spec}` : 'No spec provided — use your knowledge of this API if you recognize it; otherwise set validated=false.'}`,
      maxOutputTokens: 4000,
    })

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Could not parse discovery result' }, { status: 502 })
    const result = JSON.parse(match[0])
    return NextResponse.json(result)
  } catch (err) {
    console.error('[discover]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
