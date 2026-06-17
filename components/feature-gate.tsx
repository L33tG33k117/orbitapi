import Link from 'next/link'
import { Lock, Zap } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { WorkspaceTier } from '@/types'

const TIER_LABELS: Record<WorkspaceTier, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

interface FeatureGateProps {
  feature: string
  description: string
  currentTier: WorkspaceTier
  requiredTier?: WorkspaceTier
}

export function FeatureGate({ feature, description, currentTier, requiredTier = 'starter' }: FeatureGateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center space-y-6">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Lock className="h-7 w-7 text-primary" />
      </div>

      <div className="space-y-2 max-w-sm">
        <h2 className="text-xl font-bold">{feature}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium capitalize">
          {TIER_LABELS[currentTier]} plan
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary font-medium capitalize flex items-center gap-1.5">
          <Zap className="h-3 w-3" />
          {TIER_LABELS[requiredTier]} plan
        </span>
      </div>

      <Link href="/upgrade" className={cn(buttonVariants())}>
        Upgrade plan
      </Link>

      <p className="text-xs text-muted-foreground">
        Contact your workspace admin or{' '}
        <Link href="/contact" className="underline underline-offset-2 hover:text-foreground">reach out to us</Link>
        {' '}to upgrade.
      </p>
    </div>
  )
}
