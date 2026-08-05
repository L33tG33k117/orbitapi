import Link from 'next/link'
import { Cloud } from 'lucide-react'
import { isSelfHost } from '@/lib/edition'
import { CLOUD_ONLY_COPY, type CloudOnlyFeature } from '@/lib/edition-gate'

/**
 * Page-level edition gate. Mirrors pageGate() from components/page-gate.tsx:
 *
 *   const gate = editionGate('billing'); if (gate) return gate
 *
 * Note there is deliberately no "Upgrade" link — see lib/edition-gate.ts for
 * why an edition gate must never look like a capability gate.
 */
export function editionGate(feature: CloudOnlyFeature) {
  if (!isSelfHost()) return null
  const info = CLOUD_ONLY_COPY[feature]
  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-lg mx-auto mt-16 border rounded-xl p-8 text-center space-y-3">
        <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <Cloud className="w-5 h-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold">{info.label}</h1>
        <p className="text-sm text-muted-foreground">{info.description}</p>
        <Link href="/dashboard" className="inline-block text-sm text-primary hover:underline pt-2">
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
