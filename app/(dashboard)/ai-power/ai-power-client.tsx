'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Zap, Sparkles, Check, Clock } from 'lucide-react'
import type { AiPower, Efficiency } from '@/lib/ai-power'

interface Pack { id: string; label: string; retailUsd: number; credits: number }
interface SkillRow { id: string; name: string; efficiency: Efficiency | null }

export function AiPowerClient({
  power, tier, packs, efficiencyInfo, efficiencyOrder, skills, unmetered = false,
}: {
  power: AiPower
  tier: string
  packs: Pack[]
  efficiencyInfo: Record<Efficiency, { label: string; blurb: string }>
  efficiencyOrder: Efficiency[]
  skills: SkillRow[]
  /** Self-hosted: the customer's own model, so there is no pool and no cap. */
  unmetered?: boolean
}) {
  const router = useRouter()
  const [defaultEff, setDefaultEff] = useState<Efficiency>(power.efficiency)
  const [rows, setRows] = useState<SkillRow[]>(skills)
  const [saving, setSaving] = useState(false)
  const [buying, setBuying] = useState<string | null>(null)

  // "Running low" and "out of power" are meaningless without an allowance —
  // and with allowance = Infinity the arithmetic would render as NaN%.
  const low = !unmetered && power.pctUsed >= 80
  const out = !unmetered && power.remaining <= 0

  async function setDefault(eff: Efficiency) {
    setDefaultEff(eff)
    setSaving(true)
    const res = await fetch('/api/ai-power', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ defaultEfficiency: eff }),
    })
    setSaving(false)
    if (!res.ok) toast.error('Could not save')
    else toast.success('Default efficiency updated')
  }

  async function setSkillEff(id: string, eff: Efficiency | null) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, efficiency: eff } : r))
    const res = await fetch('/api/ai-power', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skill: { id, efficiency: eff } }),
    })
    if (!res.ok) toast.error('Could not save')
  }

  async function buy(packId: string) {
    setBuying(packId)
    const res = await fetch('/api/billing/topup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packId }),
    })
    const data = await res.json()
    setBuying(null)
    if (res.ok && data.url) { window.location.href = data.url; return }
    toast.error(data.error === 'Billing is not configured' ? 'Billing isn\'t set up yet.' : (data.error ?? 'Could not start checkout'))
  }

  return (
    <div className="space-y-8">
      {/* Usage summary — self-hosted. No allowance, so no meter: a progress bar
          against an infinite pool would be meaningless (and renders as NaN%). */}
      {unmetered && (
        <div data-tour="aipower-meter" className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
          <p className="text-xs text-muted-foreground">AI used so far</p>
          <p className="text-3xl font-bold mt-1">
            {power.used.toLocaleString()} <span className="text-base font-normal text-muted-foreground">units of work</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-2">
            Your AI runs on hardware you control, so there is no allowance and nothing to top up.
            This is here so you can see how heavily your automations are working.
          </p>
        </div>
      )}

      {/* Power meter */}
      {!unmetered && (
      <div data-tour="aipower-meter" className={`rounded-2xl border p-5 ${out ? 'border-red-500/40 bg-red-500/5' : low ? 'border-amber-500/30 bg-amber-500/5' : 'border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent'}`}>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground">{power.isTrial ? 'Free trial AI Power remaining' : 'AI Power remaining this cycle'}</p>
            <p className="text-3xl font-bold mt-1">
              {power.remaining.toLocaleString()} <span className="text-base font-normal text-muted-foreground">/ {power.allowance.toLocaleString()} credits</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground capitalize block">{tier} plan</span>
            <span className="text-xs font-medium mt-0.5 inline-flex items-center gap-1">
              {power.isTrial ? (
                <><Sparkles className="h-3 w-3 text-muted-foreground" /> One-time trial</>
              ) : (
                <><Clock className="h-3 w-3 text-muted-foreground" />
                {power.resetInDays <= 0 ? 'Resets today' : `Resets in ${power.resetInDays} day${power.resetInDays === 1 ? '' : 's'}`}</>
              )}
            </span>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full ${out ? 'bg-red-500' : low ? 'bg-amber-500' : 'bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)]'}`}
            style={{ width: `${Math.min(100, power.pctUsed)}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {power.isTrial
            ? 'Your free trial credits are one-time and don’t refill. Upgrade for a monthly allowance.'
            : 'Your allowance refreshes when the cycle resets. Unused credits don’t carry over to the next cycle.'}
        </p>
        {(low || out) && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium">
              {power.isTrial
                ? (out ? "You've used your free trial." : "You're almost through your free trial.")
                : (out ? "You're out of AI Power — automations are paused." : "You're running low on AI Power.")}
            </p>
            <Link href="/upgrade" className="text-sm text-primary hover:underline">Upgrade plan</Link>
            {!power.isTrial && <span className="text-muted-foreground text-sm">or add a pack below.</span>}
          </div>
        )}
      </div>
      )}

      {/* Top-up packs */}
      {packs.length > 0 && (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> Add more AI Power</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {packs.map(p => (
            <div key={p.id} className="border rounded-xl p-4 bg-card text-center space-y-2">
              <p className="font-medium text-sm">{p.label}</p>
              <p className="text-2xl font-bold">{p.credits.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">credits</p>
              <Button size="sm" className="w-full" onClick={() => buy(p.id)} disabled={buying === p.id}>
                {buying === p.id ? '…' : `Buy · $${p.retailUsd}`}
              </Button>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Packs add to your current cycle and never expose what runs under the hood.</p>
      </section>
      )}

      {/* Default efficiency */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5"><Zap className="h-4 w-4 text-primary" /> Default AI horsepower</h2>
        <p className="text-[11px] text-muted-foreground">
          {unmetered
            // With one installed model there is nothing for the setting to
            // choose between — say so rather than leave a control that appears
            // to do something and doesn't.
            ? 'This installation uses the single AI model you configured, so this setting has no effect unless you switch to OrbitAPI Cloud.'
            : 'Higher horsepower is more capable but uses more AI Power. Applies everywhere unless a skill overrides it.'}
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          {efficiencyOrder.map(eff => {
            const info = efficiencyInfo[eff]
            const active = defaultEff === eff
            return (
              <button
                key={eff}
                onClick={() => setDefault(eff)}
                disabled={saving}
                className={`text-left rounded-xl border p-4 transition-all ${active ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'bg-card hover:border-primary/40'}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{info.label}</p>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{info.blurb}</p>
              </button>
            )
          })}
        </div>
      </section>

      {/* Per-skill overrides */}
      {rows.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Per-skill horsepower</h2>
          {rows.map(s => (
            <div key={s.id} className="flex items-center gap-2 text-sm border rounded-lg px-3 py-2 bg-card">
              <span className="flex-1 min-w-0 truncate">{s.name}</span>
              <select
                value={s.efficiency ?? ''}
                onChange={e => setSkillEff(s.id, (e.target.value || null) as Efficiency | null)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Use default</option>
                {efficiencyOrder.map(eff => <option key={eff} value={eff}>{efficiencyInfo[eff].label}</option>)}
              </select>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
