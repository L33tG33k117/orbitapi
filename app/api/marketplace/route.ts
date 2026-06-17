import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exportBundle } from '@/lib/bundles'
import { capabilityGuard } from '@/lib/workspace-features'

// GET: approved listings (browse). POST: publish a listing from this workspace's
// playbooks/skills (status starts 'pending' → admin review). Feature #4.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('marketplace_listings')
    .select('id, slug, name, description, category, kind, price_usd, install_count, rating_sum, rating_count, status, created_at')
    .eq('status', 'approved')
    .order('install_count', { ascending: false })

  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const denied = await capabilityGuard('bundle_export')
  if (denied) return denied

  const body = await req.json()
  const { name, description, category, slug, playbookIds, skillIds, price_usd } = body
  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
  }
  if (!(playbookIds?.length || skillIds?.length)) {
    return NextResponse.json({ error: 'Select at least one playbook or skill to publish' }, { status: 400 })
  }

  // Serialize the chosen resources into a portable manifest (no credentials).
  const manifest = await exportBundle({
    workspaceId: membership.workspace_id,
    slug: slug.trim(),
    name: name.trim(),
    description: description ?? '',
    category: category ?? 'General',
    playbookIds, skillIds,
  })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('marketplace_listings')
    .insert({
      slug: slug.trim(),
      name: name.trim(),
      description: description ?? null,
      category: category ?? 'General',
      kind: 'bundle',
      manifest,
      publisher_workspace_id: membership.workspace_id,
      publisher_user_id: user.id,
      price_usd: Number(price_usd) || 0,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
