import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'
import { getAppUrl } from '@/lib/app-url'

export async function POST() {
  if (!stripe) {
    return NextResponse.json({ error: 'Billing is not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('memberships')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Only admins can manage billing' }, { status: 403 })
  }

  const { data: workspace } = await admin
    .from('workspaces')
    .select('stripe_customer_id')
    .eq('id', membership.workspace_id)
    .single()

  if (!workspace?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found. Start a subscription first.' }, { status: 400 })
  }

  const appUrl = getAppUrl()

  const session = await stripe.billingPortal.sessions.create({
    customer: workspace.stripe_customer_id as string,
    return_url: `${appUrl}/settings/billing`,
  })

  return NextResponse.json({ url: session.url })
}
