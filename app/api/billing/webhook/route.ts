import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import type Stripe from 'stripe'
import type { WorkspaceTier } from '@/types'

// Map Stripe price IDs to workspace tiers
function tierFromPriceId(priceId: string): WorkspaceTier | null {
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) return 'starter'
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro'
  return null
}

export async function POST(req: Request) {
  if (!stripe) return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const workspaceId = session.metadata?.workspace_id

      // One-time AI Power top-up purchase → grant credits.
      if (workspaceId && session.mode === 'payment' && session.metadata?.topup_credits) {
        const credits = parseInt(session.metadata.topup_credits, 10)
        if (credits > 0) {
          await admin.rpc('grant_ai_topup', { p_workspace_id: workspaceId, p_credits: credits }).then(() => {}, () => {})
        }
        break
      }

      if (!workspaceId || !session.subscription) break

      const sub = await stripe.subscriptions.retrieve(session.subscription as string)
      const priceId = sub.items.data[0]?.price.id
      const tier = priceId ? tierFromPriceId(priceId) : null

      await admin.from('workspaces').update({
        stripe_subscription_id: sub.id,
        subscription_status: sub.status,
        ...(tier ? { tier } : {}),
      }).eq('id', workspaceId)
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const workspaceId = sub.metadata?.workspace_id
      if (!workspaceId) break

      const priceId = sub.items.data[0]?.price.id
      const tier = priceId ? tierFromPriceId(priceId) : null

      await admin.from('workspaces').update({
        subscription_status: sub.status,
        ...(tier ? { tier } : {}),
      }).eq('stripe_subscription_id', sub.id)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      // Downgrade to free when subscription is cancelled
      await admin.from('workspaces').update({
        subscription_status: 'canceled',
        stripe_subscription_id: null,
        tier: 'free',
      }).eq('stripe_subscription_id', sub.id)
      break
    }

    case 'invoice.payment_failed': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoice = event.data.object as any
      const subId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription
      if (!subId) break
      // Mark subscription as past_due — keeps tier but flags it
      await admin.from('workspaces').update({
        subscription_status: 'past_due',
      }).eq('stripe_subscription_id', subId as string)
      break
    }
  }

  return NextResponse.json({ received: true })
}
