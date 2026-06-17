'use client'

import { useState, useEffect } from 'react'
import { CreditCard, CheckCircle, AlertTriangle, ExternalLink, Zap, Rocket, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'

const PLANS = [
  {
    tier: 'starter',
    name: 'Starter',
    price: '$49',
    period: '/mo',
    icon: Zap,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/15',
    features: ['AI Chat assistant', 'Skills & automations', 'Up to 10 members', '90-day audit log'],
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: '$149',
    period: '/mo',
    icon: Rocket,
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-500/15',
    features: ['Autonomous AI agents', 'Webhook triggers', 'Advanced connectors', 'Unlimited members'],
    popular: true,
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    icon: Crown,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/15',
    features: ['SSO / SAML', 'White-label', 'Dedicated SLA', 'On-premise option'],
  },
]

const STATUS_DISPLAY: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  active: { label: 'Active', color: 'text-green-400', icon: CheckCircle },
  past_due: { label: 'Payment past due', color: 'text-amber-400', icon: AlertTriangle },
  canceled: { label: 'Canceled', color: 'text-red-400', icon: AlertTriangle },
  trialing: { label: 'Trial', color: 'text-blue-400', icon: CheckCircle },
}

export default function BillingPage() {
  const [currentTier, setCurrentTier] = useState<string>('free')
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === '1') setSuccessMsg(true)

    fetch('/api/billing/status')
      .then(r => r.json())
      .then(d => {
        setCurrentTier(d.tier ?? 'free')
        setSubscriptionStatus(d.subscription_status ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function startCheckout(tier: string) {
    if (tier === 'enterprise') {
      window.location.href = '/contact?subject=enterprise'
      return
    }
    setCheckoutLoading(tier)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else {
      alert(data.error ?? 'Something went wrong')
      setCheckoutLoading(null)
    }
  }

  async function openPortal() {
    setPortalLoading(true)
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else {
      alert(data.error ?? 'Something went wrong')
      setPortalLoading(false)
    }
  }

  const statusInfo = subscriptionStatus ? STATUS_DISPLAY[subscriptionStatus] : null

  return (
    <div className="p-8 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold">Billing</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your subscription and payment details.
        </p>
      </div>

      {successMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Subscription activated — your workspace has been upgraded.
        </div>
      )}

      {/* Current plan */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Current plan</h2>
        {loading ? (
          <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div>
                <p className="font-bold capitalize text-lg">{currentTier}</p>
                {statusInfo && (
                  <div className={`flex items-center gap-1.5 text-xs ${statusInfo.color}`}>
                    <statusInfo.icon className="h-3 w-3" />
                    {statusInfo.label}
                  </div>
                )}
                {currentTier === 'free' && (
                  <p className="text-xs text-muted-foreground">$0 / month</p>
                )}
              </div>
            </div>
            {currentTier !== 'free' && subscriptionStatus && (
              <Button
                variant="outline"
                size="sm"
                onClick={openPortal}
                disabled={portalLoading}
              >
                <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                {portalLoading ? 'Opening…' : 'Manage subscription'}
                <ExternalLink className="h-3 w-3 ml-1.5 opacity-50" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Plan cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Available plans</h2>
        <p className="text-xs text-muted-foreground">
          Flat-rate pricing — no per-run or per-task fees. Pay once per workspace per month.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANS.map(plan => {
            const Icon = plan.icon
            const isCurrent = currentTier === plan.tier
            return (
              <div
                key={plan.tier}
                className={`rounded-xl border p-5 flex flex-col gap-4 ${
                  plan.popular
                    ? 'border-primary bg-primary/5'
                    : isCurrent
                      ? 'border-green-500/40 bg-green-500/5'
                      : 'border-border bg-card'
                }`}
              >
                {plan.popular && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary uppercase tracking-wider self-start">
                    Most popular
                  </span>
                )}
                <div className="flex items-center gap-2.5">
                  <div className={`h-8 w-8 rounded-lg ${plan.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-4 w-4 ${plan.iconColor}`} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{plan.price}</span>{plan.period}
                    </p>
                  </div>
                </div>
                <ul className="space-y-1.5 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={isCurrent ? 'outline' : plan.popular ? 'default' : 'outline'}
                  size="sm"
                  disabled={isCurrent || !!checkoutLoading}
                  onClick={() => !isCurrent && startCheckout(plan.tier)}
                  className="w-full justify-center"
                >
                  {isCurrent
                    ? 'Current plan'
                    : checkoutLoading === plan.tier
                      ? 'Redirecting…'
                      : plan.tier === 'enterprise'
                        ? 'Contact sales'
                        : `Upgrade to ${plan.name}`}
                </Button>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Subscriptions are billed monthly. Cancel anytime from the billing portal.
        For annual pricing or enterprise contracts,{' '}
        <a href="/contact" className="underline underline-offset-2 hover:text-foreground">contact us</a>.
      </p>
    </div>
  )
}
