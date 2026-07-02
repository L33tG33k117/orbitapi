import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SectionIntro } from '@/components/section-intro'
import { PageHeader } from '@/components/page-header'
import { Shuffle, ArrowRight } from 'lucide-react'

// Data mapping is parked as "coming soon": people can read what it will do, but
// the builder itself is greyed out. (The working client lives in
// data-mapping-client.tsx and can be wired back in when the feature ships.)
export default async function DataMappingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl">
      <PageHeader
        eyebrow="Automate"
        title="Data mapping"
        description="Sync data between API connectors — e.g. Zendesk tickets → ServiceNow incidents. Orbit proposes the field mappings, previews the transformed record against a live sample, and you approve before automating."
      >
        <span className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-semibold text-primary">
          Coming soon
        </span>
      </PageHeader>

      {/* Let people read what it will do */}
      <SectionIntro id="data-mapping" />

      {/* Greyed-out preview of the feature with a coming-soon overlay */}
      <div className="relative overflow-hidden rounded-2xl border border-dashed border-border">
        <div className="pointer-events-none select-none p-6 opacity-30">
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium">Zendesk · Ticket</div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium">ServiceNow · Incident</div>
          </div>
          <div className="mt-4 space-y-2">
            {[
              ['subject', 'short_description'],
              ['description', 'description'],
              ['priority', 'urgency'],
              ['requester.email', 'caller_id'],
            ].map(([from, to]) => (
              <div key={from} className="flex items-center gap-3 text-xs">
                <span className="flex-1 rounded-md bg-muted px-2 py-1.5 font-mono">{from}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="flex-1 rounded-md bg-muted px-2 py-1.5 font-mono">{to}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
          <div className="text-center px-6">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Shuffle className="h-5 w-5 text-primary" />
            </div>
            <p className="font-semibold">Coming soon</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Field-level data mapping between your connectors is on the way. You&apos;ll be able to set this up here when it launches.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
