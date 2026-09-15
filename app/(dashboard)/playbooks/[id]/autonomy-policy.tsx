'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import {
  SEVERITY_RUBRIC, bandsToThresholds, thresholdsToBands,
  type AutonomyMode, type Bands, type Threshold,
} from '@/lib/severity'

const MODE_LABEL: Record<AutonomyMode, string> = {
  notify: 'Notify only',
  approval: 'Require approval',
  auto: 'Auto-execute',
}
const MODE_TONE: Record<AutonomyMode, string> = {
  notify: 'bg-emerald-500/70',
  approval: 'bg-amber-500/80',
  auto: 'bg-red-500/80',
}

// Boundary options: 1–10, plus 11 meaning "this band is off".
const BOUNDARY = Array.from({ length: 11 }, (_, i) => i + 1)

export function AutonomyPolicyEditor({ thresholds, onChange }: {
  thresholds: Threshold[]
  onChange: (t: Threshold[]) => void
}) {
  const [bands, setBands] = useState<Bands>(() => thresholdsToBands(thresholds))
  const [showHow, setShowHow] = useState(false)

  function update(patch: Partial<Bands>) {
    const next = { ...bands, ...patch }
    if (next.autoFrom < next.approvalFrom) next.autoFrom = next.approvalFrom
    setBands(next)
    onChange(bandsToThresholds(next))
  }

  const cells = Array.from({ length: 11 }, (_, s) =>
    s < bands.approvalFrom ? bands.low : s < bands.autoFrom ? bands.mid : bands.high)

  return (
    <section className="border rounded-xl p-4 bg-card space-y-4">
      <div>
        <h2 className="font-medium text-sm">Autonomy policy</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Each run&apos;s <span className="font-medium text-foreground">Assess</span> step gives the situation a
          severity score from 0 to 10. You decide where the lines are between what the playbook may do on its
          own, what needs a person to approve, and what only sends a notification.
        </p>
      </div>

      {/* Visual scale */}
      <div>
        <div className="grid grid-cols-11 gap-0.5">
          {cells.map((m, s) => (
            <div key={s} className={`h-6 rounded-sm ${MODE_TONE[m]} flex items-center justify-center text-[10px] font-semibold text-white`}
              title={`Score ${s}: ${MODE_LABEL[m]}`}>
              {s}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-0.5 mt-1">
          {SEVERITY_RUBRIC.map(l => (
            <div key={l.label} className="text-[10px] text-muted-foreground text-center truncate">{l.label}</div>
          ))}
        </div>
      </div>

      {/* Boundaries */}
      <div className="space-y-2 text-sm">
        <BandRow
          range={bands.approvalFrom === 0 ? 'Off' : `0 to ${bands.approvalFrom - 1}`}
          mode={bands.low} onMode={m => update({ low: m })}
        />
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pl-1">
          Middle band starts at
          <select value={bands.approvalFrom} onChange={e => update({ approvalFrom: Number(e.target.value) })}
            className="h-7 rounded-md border border-input bg-background px-1.5 text-xs text-foreground">
            {[0, ...BOUNDARY.slice(0, 10)].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <BandRow
          range={bands.autoFrom <= bands.approvalFrom ? 'Off' : `${bands.approvalFrom} to ${Math.min(10, bands.autoFrom - 1)}`}
          mode={bands.mid} onMode={m => update({ mid: m })}
        />
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pl-1">
          Top band starts at
          <select value={bands.autoFrom} onChange={e => update({ autoFrom: Number(e.target.value) })}
            className="h-7 rounded-md border border-input bg-background px-1.5 text-xs text-foreground">
            {BOUNDARY.filter(n => n >= bands.approvalFrom).map(n => <option key={n} value={n}>{n === 11 ? 'Off (no top band)' : n}</option>)}
          </select>
        </div>
        <BandRow
          range={bands.autoFrom > 10 ? 'Off' : `${bands.autoFrom} to 10`}
          mode={bands.high} onMode={m => update({ high: m })}
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Only write actions (anything that changes data) follow this policy. Read-only steps always run.
        An action set to Automatic, Manual approve or Never on its connection&apos;s page overrides it.
        Dry runs never write, whatever the score.
      </p>

      {/* How the score works */}
      <div className="rounded-lg border bg-muted/30">
        <button type="button" onClick={() => setShowHow(v => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium">
          <Info className="h-3.5 w-3.5 text-primary" /> How is the severity score calculated?
          {showHow ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
        </button>
        {showHow && (
          <div className="px-3 pb-3 space-y-3 text-xs text-muted-foreground">
            <ol className="list-decimal pl-4 space-y-1">
              <li>The Assess step reads live data using only <span className="text-foreground">read-only</span> actions on this playbook&apos;s connections. It can&apos;t change anything.</li>
              <li>The AI compares what it found to the fixed scale below and picks one whole number from 0 to 10.</li>
              <li>It also returns up to four short reasons. You&apos;ll see them in each run under &quot;why this score&quot;.</li>
              <li>The playbook then looks up that number in your bands above to decide what happens next.</li>
            </ol>
            <table className="w-full text-left">
              <tbody>
                {SEVERITY_RUBRIC.map(l => (
                  <tr key={l.label} className="align-top border-t">
                    <td className="py-1 pr-2 font-mono whitespace-nowrap">{l.min}–{l.max}</td>
                    <td className="py-1 pr-2 font-medium text-foreground whitespace-nowrap">{l.label}</td>
                    <td className="py-1">{l.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p><span className="text-foreground font-medium">Same scale for every connector.</span> The score rates the situation, not the app it came from. A 7 from Slack data means the same as a 7 from QuickBooks data.</p>
            <p><span className="text-foreground font-medium">It&apos;s a judgment, not a formula.</span> The AI decides the number, guided by this scale and by the Persona and Assess prompt you write. Being specific there (&quot;an invoice over $10,000 that&apos;s 30+ days overdue is High&quot;) makes scores more consistent.</p>
            <p><span className="text-foreground font-medium">When data is missing</span>, the AI is told to score no higher than 4. If it doesn&apos;t return a readable score, the run uses 0.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function BandRow({ range, mode, onMode }: { range: string; mode: AutonomyMode; onMode: (m: AutonomyMode) => void }) {
  return (
    <div className={`flex items-center gap-2 ${range === 'Off' ? 'opacity-50' : ''}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${MODE_TONE[mode]}`} />
      <span className="w-24 text-muted-foreground">{range === 'Off' ? 'Band off' : `Score ${range}`}</span>
      <span className="text-muted-foreground">→</span>
      <select value={mode} onChange={e => onMode(e.target.value as AutonomyMode)}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm">
        {(Object.keys(MODE_LABEL) as AutonomyMode[]).map(m => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
      </select>
    </div>
  )
}
