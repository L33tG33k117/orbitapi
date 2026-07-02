import { NextResponse } from 'next/server'
import { getEndpointByToken, buildTools, executeTool } from '@/lib/mcp'

// Stateless MCP server over Streamable HTTP. External AI assistants (Claude,
// ChatGPT, Cursor) POST JSON-RPC messages here; every tool call goes through
// Orbit's normal gates (per-connection risk controls, approval queue for
// writes, audit log). No session state is kept — each POST is self-contained,
// which is exactly what the MCP spec's stateless mode allows.

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rpcResult(id: any, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result })
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rpcError(id: any, code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } })
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const endpoint = await getEndpointByToken(token)
  if (!endpoint) {
    return NextResponse.json({ error: 'Unknown or disabled MCP endpoint' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let msg: any
  try {
    msg = await req.json()
  } catch {
    return rpcError(null, -32700, 'Parse error')
  }
  // Batches aren't used by mainstream clients; take the first message if sent.
  if (Array.isArray(msg)) msg = msg[0]
  if (!msg || typeof msg.method !== 'string') return rpcError(msg?.id ?? null, -32600, 'Invalid request')

  // Notifications (no id) get an empty 202 per the streamable HTTP transport.
  if (msg.id === undefined || msg.method.startsWith('notifications/')) {
    return new NextResponse(null, { status: 202 })
  }

  switch (msg.method) {
    case 'initialize': {
      const requested = msg.params?.protocolVersion
      const protocolVersion = PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0]
      return rpcResult(msg.id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'OrbitAPI', version: '1.0.0' },
        instructions:
          'These tools are the user\'s connected APIs in OrbitAPI. Tools marked risk: read run ' +
          'immediately. Tools marked write or destructive are queued for human approval on the ' +
          'OrbitAPI Approvals page and do not execute until a person approves them.',
      })
    }
    case 'ping':
      return rpcResult(msg.id, {})
    case 'tools/list': {
      const { tools } = await buildTools(endpoint.workspace_id)
      return rpcResult(msg.id, { tools })
    }
    case 'tools/call': {
      const name = msg.params?.name
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>
      const { bindings } = await buildTools(endpoint.workspace_id)
      const binding = name ? bindings.get(name) : undefined
      if (!binding) return rpcError(msg.id, -32602, `Unknown tool: ${name}`)
      try {
        const out = await executeTool(endpoint, binding, args)
        return rpcResult(msg.id, {
          content: [{ type: 'text', text: out.text }],
          isError: !!out.isError,
        })
      } catch (e) {
        return rpcResult(msg.id, {
          content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : 'unknown'}` }],
          isError: true,
        })
      }
    }
    default:
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`)
  }
}

// Stateless server: no server-initiated SSE stream, and DELETE (session end)
// is a no-op acknowledged with 200.
export async function GET() {
  return new NextResponse('Method Not Allowed', { status: 405, headers: { Allow: 'POST, DELETE' } })
}
export async function DELETE() {
  return new NextResponse(null, { status: 200 })
}
