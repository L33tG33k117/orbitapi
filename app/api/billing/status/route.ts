import { NextResponse } from 'next/server'
import { editionGuard } from '@/lib/edition-gate'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const denied = editionGuard('billing')
  if (denied) return denied

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('memberships')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ tier: 'free', subscription_status: null })

  const { data: workspace } = await admin
    .from('workspaces')
    .select('tier, subscription_status')
    .eq('id', membership.workspace_id)
    .single()

  return NextResponse.json({
    tier: workspace?.tier ?? 'free',
    subscription_status: workspace?.subscription_status ?? null,
  })
}
