import { Check, Zap, Building2, Rocket, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { getWorkspaceFeatures } from '@/lib/workspace-features'
import { PageHero } from '@/components/page-hero'
import type { WorkspaceTier } from '@/types'

const TIER_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, enterprise: 3 }

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Get started with API connections and basic querying.',
    icon: Building2,
    iconColor: 'text-slate-400',
    iconBg: 'bg-slate-500/15',
    features: [
      'Up to 3 API connections',
      'Manual API queries via chat',
      'Connector catalog access',
      'Audit log (7 days)',
    ],
    locked: [
      'AI Chat assistant',
      'Skills & automations',
      'Autonomous AI agents',
      'Webhook triggers',
    ],
    cta: 'Current plan',
    ctaVariant: 'outline' as const,
    highlight: false,
    ctaHref: '/dashboard',
  },
  {
    name: 'Starter',
    price: '$49',
    period: 'per workspace / mo',
    description: 'Unlock AI-powered automation for your team.',
    icon: Zap,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/15',
    features: [
      'Everything in Free',
      'Unlimited API connections',
      'AI Chat assistant',
      'Skills & automations',
      'Supervised & manual skill modes',
      'Up to 10 team members',
      'Audit log (90 days)',
    ],
    locked: [
      'Autonomous AI agents',
      'Webhook triggers',
      'Advanced connectors',
    ],
    cta: 'Upgrade to Starter',
    ctaVariant: 'default' as const,
    highlight: true,
    ctaHref: '/contact?subject=upgrade-starter',
  },
  {
    name: 'Pro',
    price: '$149',
    period: 'per workspace / mo',
    description: 'Full autonomy for security, finance, and ops teams.',
    icon: Rocket,
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-500/15',
    features: [
      'Everything in Starter',
      'Autonomous AI agents',
      'Webhook & schedule triggers',
      'Advanced connectors (CrowdStrike, NetSuite, etc.)',
      'Unlimited team members',
      'Priority support',
      'Audit log (1 year)',
    ],
    locked: [
      'SSO / SAML',
      'White-label branding',
      'Dedicated SLA',
    ],
    cta: 'Upgrade to Pro',
    ctaVariant: 'default' as const,
    highlight: false,
    ctaHref: '/contact?subject=upgrade-pro',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'annual contract',
    description: 'Compliance, scale, and dedicated support for enterprise teams.',
    icon: Crown,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/15',
    features: [
      'Everything in Pro',
      'SSO / SAML authentication',
      'White-label branding',
      'Dedicated SLA (99.9% uptime)',
      'Unlimited workspaces',
      'Custom data retention policy',
      'On-premise / private cloud option',
      'Custom connector development',
      'Dedicated account manager',
      'Custom contracts & PO billing',
    ],
    locked: [],
    cta: 'Talk to sales',
    ctaVariant: 'outline' as const,
    highlight: false,
    ctaHref: '/contact?subject=enterprise',
  },
]

export default async function UpgradePage() {
  const features = await getWorkspaceFeatures()
  const currentTier = (features?.tier ?? 'free') as WorkspaceTier
  const currentRank = TIER_RANK[currentTier] ?? 0

  return (
    <div className="p-4 sm:p-8 space-y-10 max-w-7xl">
      <PageHero
        eyebrow="Plan"
        title="Upgrade your plan"
        description={`You're currently on the ${currentTier} plan.${currentRank < TIER_RANK.pro ? ' Unlock AI-powered automation, skills, and autonomous agents for your team.' : ''}`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {tiers.map(tier => {
          const Icon = tier.icon
          const tierRank = TIER_RANK[tier.name.toLowerCase()] ?? 0
          const isCurrent = tierRank === currentRank
          const isLower = tierRank < currentRank
          return (
            <div
              key={tier.name}
              className={`rounded-2xl border p-6 space-y-6 flex flex-col ${
                isCurrent
                  ? 'border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20'
                  : tier.highlight
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border bg-card'
              }`}
            >
              {isCurrent ? (
                <div className="flex">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 uppercase tracking-wider">
                    Your plan
                  </span>
                </div>
              ) : tier.highlight && (
                <div className="flex">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/20 text-primary uppercase tracking-wider">
                    Most popular
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <div className={`h-10 w-10 rounded-xl ${tier.iconBg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${tier.iconColor}`} />
                </div>
                <div>
                  <h2 className="text-lg font-bold">{tier.name}</h2>
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                </div>
                <div>
                  <span className="text-3xl font-bold">{tier.price}</span>
                  <span className="text-sm text-muted-foreground ml-1.5">{tier.period}</span>
                </div>
              </div>

              <div className="flex-1 space-y-2">
                {tier.features.map(f => (
                  <div key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
                {tier.locked.map(f => (
                  <div key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground/50">
                    <div className="h-4 w-4 mt-0.5 shrink-0 rounded-full border border-current flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-current" />
                    </div>
                    <span className="line-through">{f}</span>
                  </div>
                ))}
              </div>

              {isCurrent ? (
                <div
                  className={cn(
                    buttonVariants({ variant: 'outline' }),
                    'w-full justify-center border-emerald-500/40 text-emerald-400 pointer-events-none',
                  )}
                >
                  Current plan
                </div>
              ) : isLower ? (
                <div
                  className={cn(
                    buttonVariants({ variant: 'outline' }),
                    'w-full justify-center border-border text-muted-foreground pointer-events-none',
                  )}
                >
                  Included in your plan
                </div>
              ) : (
                <a
                  href={tier.ctaHref}
                  className={cn(
                    buttonVariants({ variant: tier.ctaVariant }),
                    'w-full justify-center',
                    !tier.highlight && 'border-border'
                  )}
                >
                  {tier.cta}
                </a>
              )}
            </div>
          )
        })}
      </div>

      <div className="text-center space-y-1">
        <p className="text-sm text-muted-foreground">
          All plans include end-to-end encryption, SOC 2 compliance, and 24/7 infrastructure monitoring.
        </p>
        <p className="text-sm text-muted-foreground">
          Need help choosing?{' '}
          <a href="/contact" className="underline underline-offset-2 hover:text-foreground">
            Talk to our team
          </a>
        </p>
      </div>
    </div>
  )
}
