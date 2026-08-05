import { NextResponse } from 'next/server'
import { editionGuard } from '@/lib/edition-gate'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe, STRIPE_PRICES } from '@/lib/stripe'
import { getAppUrl } from '@/lib/app-url'

export async function POST(req: Request) {
  const denied = editionGuard('billing')
  if (denied) return denied

  if (!stripe) {
    return NextResponse.json({ error: 'Billing is not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tier } = await req.json() as { tier: string }
  const priceId = STRIPE_PRICES[tier]
  if (!priceId) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }

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
    .select('id, name, stripe_customer_id')
    .eq('id', membership.workspace_id)
    .single()

  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const { data: profile } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', user.id)
    .single()

  // Create or reuse Stripe customer
  let customerId = workspace.stripe_customer_id as string | null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email,
      name: profile?.full_name ?? undefined,
      metadata: { workspace_id: workspace.id, workspace_name: workspace.name },
    })
    customerId = customer.id
    await admin.from('workspaces').update({ stripe_customer_id: customerId }).eq('id', workspace.id)
  }

  const appUrl = getAppUrl()

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/settings/billing?success=1`,
    cancel_url: `${appUrl}/upgrade`,
    metadata: { workspace_id: workspace.id },
    subscription_data: {
      metadata: { workspace_id: workspace.id },
    },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
