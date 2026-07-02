'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { RunStep } from '@/lib/skill-runner'

interface Run {
  id: string
  mode: string
  status: string
  triggered_by: string
  started_at: string
  completed_at: string | null
  steps: RunStep[]
  prompt: string | null
}

function StepRow({ s }: { s: RunStep }) {
  const statusColor = {
    success: 'text-green-600',
    error: 'text-destructive',
    dry_run: 'text-blue-600',
    blocked: 'text-orange-500',
    awaiting_approval: 'text-amber-500',
    text: 'text-muted-foreground',
  }[s.status] ?? 'text-muted-foreground'

  return (
    <div className="flex gap-3 text-xs py-1.5 border-b last:border-0">
      <span className="text-muted-foreground w-5 shrink-0 text-right">{s.step}</span>
      <div className="flex-1 min-w-0">
        <span className={`font-medium ${statusColor}`}>
          {s.status === 'dry_run' ? '◦ Would: ' : s.status === 'awaiting_approval' ? '⏳ Awaiting approval: ' : s.status === 'blocked' ? '✕ Blocked: ' : s.status === 'error' ? '✕ Error: ' : '✓ '}
        </span>
        <span>{s.tool_name ?? 'text'}</span>
        {s.params && Object.keys(s.params).length > 0 && (
          <span className="text-muted-foreground ml-1 font-mono">
            ({Object.entries(s.params).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')})
          </span>
        )}
        {s.note && <span className="text-muted-foreground ml-1">— {s.note}</span>}
        {s.status === 'error' && (s.result as { error?: string } | undefined)?.error && (
          <p className="text-destructive/80 mt-1 break-words">{String((s.result as { error: string }).error).slice(0, 300)}</p>
        )}
      </div>
      {s.risk && (
        <Badge variant={s.risk === 'read' ? 'outline' : 'secondary'} className="shrink-0 text-xs">
          {s.risk}
        </Badge>
      )}
    </div>
  )
}

function RunCard({ run }: { run: Run }) {
  const [expanded, setExpanded] = useState(false)
  const duration = run.completed_at
    ? Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)
    : null

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant={run.mode === 'live' ? 'default' : 'secondary'}>
              {run.mode === 'live' ? 'Live' : 'Dry run'}
            </Badge>
            <Badge variant={run.status === 'completed' ? 'outline' : run.status === 'failed' ? 'destructive' : 'secondary'}>
              {run.status}
            </Badge>
            <span className="text-xs text-muted-foreground">{run.triggered_by}</span>
            {duration !== null && (
              <span className="text-xs text-muted-foreground">{duration}s</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(run.started_at).toLocaleString()}
            {' · '}
            {run.steps.length} step{run.steps.length !== 1 ? 's' : ''}
            {' · '}
            {run.steps.filter(s => s.status === 'dry_run').length} would-execute,{' '}
            {run.steps.filter(s => s.status === 'blocked').length} blocked
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground shrink-0"
        >
          {expanded ? 'Hide' : 'View'} steps
        </button>
      </div>

      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-2">
          {run.steps.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No steps recorded.</p>
          ) : (
            run.steps.map(s => <StepRow key={s.step} s={s} />)
          )}
          {run.steps.some(s => s.status === 'error') && (
            <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1.5">
              <p className="text-xs font-semibold">A step hit an error — here&apos;s how to fix it</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                <li>The red text under the step says what the connected app reported back.</li>
                <li>If it mentions a key or 401/403, open <a href="/connectors" className="text-primary hover:underline">API Connectors</a> and hit <span className="font-medium text-foreground">Test</span> on that connection — it may need new credentials.</li>
                <li>Errors on one action don&apos;t stop the skill — it works around them. If this action isn&apos;t essential, you can block it in the skill&apos;s settings.</li>
                <li>Still stuck? Use the <span className="font-medium text-foreground">Feedback</span> button (top right) — the error details come along automatically.</li>
              </ul>
            </div>
          )}
          {run.prompt && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground font-medium mb-1">AI summary</p>
              <p className="text-xs whitespace-pre-wrap">{run.prompt}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function RunHistory({
  skillId,
  initialRuns,
  isAdmin,
  autonomy = 'supervised',
  runnable = true,
}: {
  skillId: string
  initialRuns: Run[]
  isAdmin: boolean
  autonomy?: 'supervised' | 'manual' | 'autonomous'
  runnable?: boolean
}) {
  const [runs, setRuns] = useState(initialRuns)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)

  // Supervised = always dry-run; manual and autonomous = live
  const mode: 'dry_run' | 'live' = autonomy === 'supervised' ? 'dry_run' : 'live'
  const buttonLabel = autonomy === 'supervised' ? 'Test run (dry)' : 'Run now'

  async function triggerRun() {
    setRunning(true)
    setRunError(null)
    try {
      const res = await fetch(`/api/skills/${skillId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      if (!res.ok) {
        const d = await res.json()
        setRunError(d.error ?? 'Run failed')
        return
      }
      const runsRes = await fetch(`/api/skills/${skillId}/runs`)
      if (runsRes.ok) setRuns(await runsRes.json())
    } catch (e) {
      setRunError(String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex items-center gap-3">
          <Button
            onClick={triggerRun}
            disabled={running || !runnable}
            variant={autonomy === 'supervised' ? 'secondary' : 'default'}
            title={!runnable ? 'Add a persona and verify the skill before running' : undefined}
          >
            {running ? 'Running…' : buttonLabel}
          </Button>
          {!runnable && <p className="text-sm text-muted-foreground">Add a persona and verify this skill before running it.</p>}
          {runError && <p className="text-sm text-destructive">{runError}</p>}
        </div>
      )}
      {isAdmin && autonomy === 'supervised' && (
        <p className="text-xs text-muted-foreground -mt-2">
          A test run is a safe rehearsal: it reads real data but only <em>shows</em> what it would change
          (marked &ldquo;Would&rdquo;), without changing anything.
        </p>
      )}

      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
          No runs yet. Trigger a test run above.
        </p>
      ) : (
        <div className="space-y-2">
          {runs.map(r => <RunCard key={r.id} run={r} />)}
        </div>
      )}
    </div>
  )
}
