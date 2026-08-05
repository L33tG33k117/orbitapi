import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { allConnectorNetworks, allowlistFor, allowlistText } from '@/lib/network-access'

// Firewall allowlist export.
//
// `?format=txt`  one host per line, paste-able into most firewalls
// `?format=json` structured, for anyone scripting their rules
// `?connected=1` only the connectors this workspace actually uses — the list
//                a security team will actually approve, rather than 100 hosts
//                for apps nobody here has connected
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const format = url.searchParams.get('format') ?? 'json'
  const connectedOnly = url.searchParams.get('connected') === '1'

  let slugs: string[] | undefined
  if (connectedOnly) {
    const admin = createAdminClient()
    const { data: conns } = await admin
      .from('connections')
      .select('is_simulated, connector:connectors(slug)')
      .eq('workspace_id', membership.workspace_id)
      .neq('status', 'trashed')
    slugs = [...new Set(
      (conns ?? [])
        // A simulated connection makes no outbound requests, so including it
        // would ask the customer to open a hole they don't need.
        .filter(c => !c.is_simulated)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map(c => (c.connector as any)?.slug)
        .filter(Boolean),
    )]
  }

  if (format === 'txt') {
    return new NextResponse(allowlistText(slugs), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="orbitapi-firewall-allowlist.txt"',
      },
    })
  }

  const { hosts, patterns } = allowlistFor(slugs)
  const body = {
    generatedAt: new Date().toISOString(),
    scope: connectedOnly ? 'connected' : 'all',
    hosts,
    patternsRequiringYourInput: patterns,
    connectors: allConnectorNetworks().filter(c => !slugs || slugs.includes(c.slug)),
    note: 'OrbitAPI itself needs no outbound access. The only other destination is your AI model server, if it runs on a different machine.',
  }

  if (url.searchParams.get('download') === '1') {
    return new NextResponse(JSON.stringify(body, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="orbitapi-firewall-rules.json"',
      },
    })
  }
  return NextResponse.json(body)
}
