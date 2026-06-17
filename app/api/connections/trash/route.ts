import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — list trashed connections for this workspace, auto-purge expired ones
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ trashed: [] })

  const admin = createAdminClient()

  // Auto-purge connections that have been in trash for > 7 days
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  await admin
    .from('connections')
    .delete()
    .eq('workspace_id', membership.workspace_id)
    .eq('status', 'trashed')
    .lt('trashed_at', cutoff)

  // Fetch remaining trashed connections
  const { data: trashed } = await admin
    .from('connections')
    .select('*, connector:connectors(slug, name, category)')
    .eq('workspace_id', membership.workspace_id)
    .eq('status', 'trashed')
    .order('trashed_at', { ascending: false })

  return NextResponse.json({ trashed: trashed ?? [] })
}
