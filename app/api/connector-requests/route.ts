import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — list all pending/approved connector requests with vote counts and user's vote status
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user.id).single()
  if (!membership) return NextResponse.json([])

  const admin = createAdminClient()

  const [{ data: requests }, { data: myVotes }, { data: myRequests }] = await Promise.all([
    admin
      .from('connector_requests')
      .select('id, connector_name, website_url, use_case, status, vote_count, created_at')
      .neq('status', 'rejected')
      .order('vote_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50),
    // Which of these has this user already voted on?
    admin
      .from('connector_request_votes')
      .select('request_id')
      .eq('user_id', user.id),
    // Which did this user originally submit?
    admin
      .from('connector_requests')
      .select('id')
      .eq('user_id', user.id),
  ])

  const votedIds = new Set((myVotes ?? []).map(v => v.request_id))
  const ownedIds = new Set((myRequests ?? []).map(r => r.id))

  // Fetch latest build status for approved requests so UI shows real progress
  const approvedIds = (requests ?? []).filter(r => r.status === 'approved').map(r => r.id)
  const buildStatusMap: Record<string, string> = {}
  if (approvedIds.length > 0) {
    const { data: builds } = await admin
      .from('connector_builds')
      .select('request_id, status')
      .in('request_id', approvedIds)
      .order('created_at', { ascending: false })
    for (const b of builds ?? []) {
      if (!buildStatusMap[b.request_id]) buildStatusMap[b.request_id] = b.status
    }
  }

  const enriched = (requests ?? []).map(r => ({
    ...r,
    has_voted: votedIds.has(r.id) || ownedIds.has(r.id),
    is_own: ownedIds.has(r.id),
    build_status: buildStatusMap[r.id] ?? null,
  }))

  return NextResponse.json(enriched)
}

// POST — create a new request, or vote for an existing one with the same name
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'No workspace' }, { status: 403 })

  const { connector_name, use_case, website_url } = await req.json()
  if (!connector_name?.trim()) {
    return NextResponse.json({ error: 'connector_name is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check for existing request with same name (case-insensitive)
  const { data: existing } = await admin
    .from('connector_requests')
    .select('id, connector_name, vote_count, status')
    .ilike('connector_name', connector_name.trim())
    .neq('status', 'rejected')
    .limit(1)
    .maybeSingle()

  if (existing) {
    // Check if this user already voted / submitted it
    const { data: alreadyVoted } = await admin
      .from('connector_request_votes')
      .select('id')
      .eq('request_id', existing.id)
      .eq('user_id', user.id)
      .maybeSingle()

    const { data: isOwner } = await admin
      .from('connector_requests')
      .select('id')
      .eq('id', existing.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (alreadyVoted || isOwner) {
      return NextResponse.json({ duplicate: true, already_voted: true, request: existing })
    }

    // Add vote
    await admin.from('connector_request_votes').insert({
      request_id: existing.id,
      user_id: user.id,
      workspace_id: membership.workspace_id,
    })

    const { data: updated } = await admin
      .from('connector_requests')
      .select('id, connector_name, vote_count, status')
      .eq('id', existing.id)
      .single()

    return NextResponse.json({ duplicate: true, voted: true, request: updated })
  }

  // Create new request
  const { data: created, error } = await admin
    .from('connector_requests')
    .insert({
      workspace_id: membership.workspace_id,
      user_id: user.id,
      connector_name: connector_name.trim(),
      use_case: use_case?.trim() ?? null,
      website_url: website_url?.trim() ?? null,
    })
    .select('id, connector_name, vote_count, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ created: true, request: created })
}
