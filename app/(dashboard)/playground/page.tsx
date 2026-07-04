import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Play, Plug, Zap, ShieldAlert, ArrowRight, Rocket, Clock } from 'lucide-react'
import { PageHero } from '@/components/page-hero'
import { ResultExport } from '@/components/result-export'
import { bestResult } from '@/lib/export-data'
import { SkillRunButton } from '../skills/skill-run-button'
import { PlaybookRunButton } from '../playbooks/playbook-run-button'

// The Playground — one place to run everything you've set up (apps, skills,
// playbooks) and see & export the latest results. Not a duplicate of the
// per-feature pages: it's the launchpad that ties them together, since nowhere
// else lets you run across all three and grab the output in one spot.

interface RunStepish { status?: string; result?: unknown }

function relative(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default async function PlaygroundPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')

  const isAdmin = membership.role !== 'member'
  const admin = createAdminClient()
  const wsId = membership.workspace_id

  const [{ data: connections }, { data: skills }, { data: playbooks }, { data: skillRuns }, { data: playbookRuns }] = await Promise.all([
    admin.from('connections')
      .select('id, label, status, is_simulated, connector:connectors(slug, name)')
      .eq('workspace_id', wsId).eq('status', 'active').order('created_at').limit(30),
    admin.from('skills')
      .select('id, name, autonomy, persona, enabled, group:groups(color)')
      .eq('workspace_id', wsId).order('name'),
    admin.from('playbooks')
      .select('id, name, enabled')
      .eq('workspace_id', wsId).order('name'),
    admin.from('skill_runs')
      .select('id, status, prompt, steps, started_at, skill:skills(name)')
      .eq('workspace_id', wsId).order('started_at', { ascending: false }).limit(6),
    admin.from('playbook_runs')
      .select('id, status, summary, prompt, steps, started_at, playbook:playbooks(name)')
      .eq('workspace_id', wsId).order('started_at', { ascending: false }).limit(6),
  ])

  const conns = connections ?? []
  const skillList = skills ?? []
  const playbookList = playbooks ?? []

  // Merge recent runs into a single "latest results" feed with exportable data.
  type Result = { id: string; kind: 'skill' | 'playbook'; title: string; at: string; status: string; summary: string | null; data: unknown }
  const results: Result[] = []
  for (const r of (skillRuns ?? []) as unknown as { id: string; status: string; prompt: string | null; steps: RunStepish[]; started_at: string; skill: { name: string } | null }[]) {
    results.push({
      id: r.id, kind: 'skill', title: r.skill?.name ?? 'Skill', at: r.started_at, status: r.status,
      summary: r.prompt, data: bestResult((r.steps ?? []).filter(s => s.status === 'success').map(s => s.result)),
    })
  }
  for (const r of (playbookRuns ?? []) as unknown as { id: string; status: string; summary: string | null; prompt: string | null; steps: RunStepish[]; started_at: string; playbook: { name: string } | null }[]) {
    results.push({
      id: r.id, kind: 'playbook', title: r.playbook?.name ?? 'Playbook', at: r.started_at, status: r.status,
      summary: r.summary ?? r.prompt, data: bestResult((r.steps ?? []).filter(s => s.status === 'success').map(s => s.result)),
    })
  }
  results.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  const latest = results.slice(0, 6)

  const nothingSetUp = conns.length === 0 && skillList.length === 0 && playbookList.length === 0

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl">
      <PageHero
        eyebrow="Operate"
        title="Playground"
        description="Run anything you've set up — your apps, skills, and playbooks — and see & export the results, all in one place."
        stats={[
          { label: 'apps', value: conns.length },
          { label: 'skills', value: skillList.length },
          { label: 'playbooks', value: playbookList.length },
        ]}
      />

      {nothingSetUp ? (
        <div className="rounded-xl border border-dashed bg-muted/20 p-10 text-center space-y-2">
          <Rocket className="h-8 w-8 mx-auto text-primary/50" />
          <p className="font-semibold">Nothing to run yet</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Connect an app (or try a Simulated one — no keys needed) and it&apos;ll show up here, ready to run.
          </p>
          <Link href="/connectors" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            Connect your first app <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <>
          <div data-tour="playground-run" className="grid lg:grid-cols-3 gap-4">
            {/* Apps */}
            <section className="rounded-xl border bg-card overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
                <div className="flex items-center gap-2"><Plug className="h-4 w-4 text-primary" /><h2 className="font-semibold text-sm">Your apps</h2></div>
                <Link href="/connectors" className="text-xs text-muted-foreground hover:text-foreground">Manage →</Link>
              </div>
              <div className="divide-y max-h-[380px] overflow-y-auto">
                {conns.length === 0 && <p className="px-4 py-6 text-xs text-muted-foreground text-center">No apps connected yet.</p>}
                {conns.map(c => {
                  const cn = c.connector as unknown as { slug: string; name: string } | null
                  return (
                    <div key={c.id} className="flex items-center gap-2.5 px-3 py-2.5">
                      <Image src={`/logos/${cn?.slug ?? 'default'}.svg`} alt="" width={22} height={22} className="rounded shrink-0" unoptimized />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.label}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{cn?.name}{c.is_simulated ? ' · simulated' : ''}</p>
                      </div>
                      <Link href={`/connectors/${c.id}/manual`} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium hover:border-primary/40 hover:bg-primary/5 transition-colors shrink-0">
                        <Play className="h-3 w-3" /> Use now
                      </Link>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Skills */}
            <section className="rounded-xl border bg-card overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
                <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /><h2 className="font-semibold text-sm">Your skills</h2></div>
                <Link href="/skills" className="text-xs text-muted-foreground hover:text-foreground">Manage →</Link>
              </div>
              <div className="divide-y max-h-[380px] overflow-y-auto">
                {skillList.length === 0 && <p className="px-4 py-6 text-xs text-muted-foreground text-center">No skills yet.</p>}
                {skillList.map(s => (
                  <div key={s.id} className="flex items-center gap-2.5 px-3 py-2.5">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: (s.group as unknown as { color?: string } | null)?.color ?? '#6366f1' }} />
                    <div className="flex-1 min-w-0">
                      <Link href={`/skills/${s.id}`} className="text-sm font-medium truncate hover:underline block">{s.name}</Link>
                      <p className="text-[11px] text-muted-foreground">{s.autonomy}</p>
                    </div>
                    {isAdmin
                      ? <SkillRunButton skillId={s.id} autonomy={s.autonomy as 'supervised' | 'manual' | 'autonomous'} runnable={!!(s.persona && String(s.persona).trim())} afterRun="refresh" />
                      : <Link href={`/skills/${s.id}`} className="text-xs text-primary hover:underline shrink-0">Open</Link>}
                  </div>
                ))}
              </div>
            </section>

            {/* Playbooks */}
            <section className="rounded-xl border bg-card overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
                <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-primary" /><h2 className="font-semibold text-sm">Your playbooks</h2></div>
                <Link href="/playbooks" className="text-xs text-muted-foreground hover:text-foreground">Manage →</Link>
              </div>
              <div className="divide-y max-h-[380px] overflow-y-auto">
                {playbookList.length === 0 && <p className="px-4 py-6 text-xs text-muted-foreground text-center">No playbooks yet.</p>}
                {playbookList.map(p => (
                  <div key={p.id} className="flex items-center gap-2.5 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <Link href={`/playbooks/${p.id}`} className="text-sm font-medium truncate hover:underline block">{p.name}</Link>
                      <p className="text-[11px] text-muted-foreground">{p.enabled ? 'on' : 'off'}</p>
                    </div>
                    {isAdmin
                      ? <PlaybookRunButton playbookId={p.id} enabled={!!p.enabled} afterRun="refresh" />
                      : <Link href={`/playbooks/${p.id}`} className="text-xs text-primary hover:underline shrink-0">Open</Link>}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Latest results */}
          <section data-tour="playground-results" className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /><h2 className="font-semibold text-sm">Latest results</h2></div>
              <Link href="/activity" className="text-xs text-muted-foreground hover:text-foreground">See all in Activity →</Link>
            </div>
            {latest.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground text-center">
                Nothing has run yet. Hit <span className="font-medium text-foreground">Run</span> on a skill or <span className="font-medium text-foreground">Use now</span> on an app above — the result shows up here.
              </p>
            ) : (
              <div className="divide-y">
                {latest.map(r => (
                  <div key={`${r.kind}-${r.id}`} className="px-4 py-3 flex items-start gap-3">
                    {r.kind === 'skill' ? <Zap className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> : <ShieldAlert className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{r.title}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${r.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : r.status === 'failed' ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'}`}>{r.status}</span>
                        <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{relative(r.at)}</span>
                      </div>
                      {r.summary && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.summary}</p>}
                      {r.data != null && (
                        <div className="mt-1.5"><ResultExport data={r.data} baseName={`${r.title.replace(/\s+/g, '_')}_run`} variant="compact" /></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
