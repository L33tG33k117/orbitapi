import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'
import { getPack } from '@/lib/ai-power'

// One-time purchase of an AI Power pack. Grants credits via the billing webhook.
export async function POST(req: Request) {
  if (!stripe) return NextResponse.json({ error: 'Billing is not configured' }, { status: 503 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user.id).single()
  if (!membership || membership.role === 'member') {
    return NextResponse.json({ error: 'Only admins can purchase' }, { status: 403 })
  }

  const { packId } = await req.json()
  const pack = getPack(packId)
  if (!pack) return NextResponse.json({ error: 'Unknown pack' }, { status: 400 })

  const admin = createAdminClient()
  const { data: workspace } = await admin
    .from('workspaces').select('id, name, stripe_customer_id').eq('id', membership.workspace_id).single()
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  let customerId = workspace.stripe_customer_id as string | null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email, metadata: { workspace_id: workspace.id, workspace_name: workspace.name },
    })
    customerId = customer.id
    await admin.from('workspaces').update({ stripe_customer_id: customerId }).eq('id', workspace.id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: `${pack.label} — AI Power` },
        unit_amount: Math.round(pack.retailUsd * 100),
      },
      quantity: 1,
    }],
    success_url: `${appUrl}/ai-power?topup=1`,
    cancel_url: `${appUrl}/ai-power`,
    // The webhook reads these to grant credits.
    metadata: { workspace_id: workspace.id, topup_credits: String(pack.credits) },
  })

  return NextResponse.json({ url: session.url })
}
