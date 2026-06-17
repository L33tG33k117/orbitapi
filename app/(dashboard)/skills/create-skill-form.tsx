'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sparkles } from 'lucide-react'

interface Group { id: string; name: string; color: string }

function getPersonaSuggestions(groupName: string): Array<{ name: string; description: string }> {
  const name = groupName.toLowerCase()

  if (name.includes('github') || name.includes('git') || name.includes('code')) return [
    { name: 'Code Reviewer', description: 'Reviews PRs, flags issues, enforces standards' },
    { name: 'Release Manager', description: 'Tracks releases, changelogs, deployment status' },
    { name: 'Issue Triager', description: 'Labels, prioritizes, and routes new issues' },
  ]
  if (name.includes('slack') || name.includes('teams') || name.includes('discord') || name.includes('comm')) return [
    { name: 'Ops Notifier', description: 'Sends alerts and updates to the right channels' },
    { name: 'Standup Bot', description: 'Collects and posts daily standups automatically' },
    { name: 'Incident Commander', description: 'Escalates and communicates incidents in real time' },
  ]
  if (name.includes('salesforce') || name.includes('crm') || name.includes('hubspot') || name.includes('sales')) return [
    { name: 'Deal Coach', description: 'Monitors pipeline health, surfaces at-risk deals' },
    { name: 'Lead Qualifier', description: 'Scores and routes inbound leads automatically' },
    { name: 'Renewal Tracker', description: 'Tracks contract renewals, sends timely reminders' },
  ]
  if (name.includes('email') || name.includes('gmail') || name.includes('outlook')) return [
    { name: 'Email Summarizer', description: 'Digests high-volume inboxes into daily briefs' },
    { name: 'Follow-up Manager', description: 'Tracks unanswered emails, sends reminders' },
    { name: 'Newsletter Writer', description: 'Drafts and schedules outbound communications' },
  ]
  if (name.includes('google') || name.includes('drive') || name.includes('docs') || name.includes('sheet')) return [
    { name: 'Report Generator', description: 'Pulls data and builds automated weekly reports' },
    { name: 'Document Organizer', description: 'Categorizes, tags, and archives files' },
    { name: 'Data Analyst', description: 'Watches sheets for anomalies, sends digests' },
  ]
  if (name.includes('jira') || name.includes('linear') || name.includes('asana') || name.includes('task')) return [
    { name: 'Sprint Manager', description: 'Monitors velocity, flags blocked tickets' },
    { name: 'Backlog Groomer', description: 'Prioritizes and organizes the backlog weekly' },
    { name: 'Deadline Guardian', description: 'Alerts on overdue tasks before they slip' },
  ]
  if (name.includes('payment') || name.includes('stripe') || name.includes('finance') || name.includes('billing')) return [
    { name: 'Revenue Monitor', description: 'Watches MRR, ARR, churn, and failed payments' },
    { name: 'Invoice Manager', description: 'Flags overdue invoices, generates reminders' },
    { name: 'Fraud Spotter', description: 'Detects unusual transaction patterns in real time' },
  ]
  if (name.includes('aws') || name.includes('cloud') || name.includes('infra') || name.includes('server')) return [
    { name: 'Infrastructure Guardian', description: 'Monitors costs, capacity, and anomalies' },
    { name: 'Deployment Watcher', description: 'Tracks deployments and rollback readiness' },
    { name: 'Cost Optimizer', description: 'Identifies idle resources and cost overruns' },
  ]
  if (name.includes('calendar') || name.includes('meeting') || name.includes('schedule')) return [
    { name: 'Meeting Prep Agent', description: 'Aggregates context before each meeting' },
    { name: 'Schedule Optimizer', description: 'Finds and protects focus time blocks' },
    { name: 'Recap Writer', description: 'Summarizes meetings and assigns follow-ups' },
  ]
  // Fallback generic suggestions
  return [
    { name: 'Monitor Agent', description: 'Watches for changes and sends alerts on triggers' },
    { name: 'Report Compiler', description: 'Aggregates data into scheduled summaries' },
    { name: 'Automation Assistant', description: 'Handles repetitive tasks across connected APIs' },
  ]
}

export function CreateSkillForm({ groups, defaultGroupId }: { groups: Group[]; defaultGroupId?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(!!defaultGroupId)
  const [name, setName] = useState('')
  const [groupId, setGroupId] = useState(defaultGroupId ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedGroup = groups.find(g => g.id === groupId)
  const personas = selectedGroup ? getPersonaSuggestions(selectedGroup.name) : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), group_id: groupId || null }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setLoading(false)
      return
    }

    router.push(`/skills/${data.id}`)
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>New skill</Button>
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="border rounded-xl p-4 space-y-4 bg-card">
        <h2 className="font-medium">Create skill</h2>
        <div className="space-y-1.5">
          <Label htmlFor="sgroup">Group (optional)</Label>
          <select
            id="sgroup"
            value={groupId}
            onChange={e => setGroupId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">No group — uses all connections</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sname">Skill name</Label>
          <Input
            id="sname"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Property Manager"
            required
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading ? 'Creating…' : 'Create'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </form>

      {/* Persona suggestions when a group is selected */}
      {personas.length > 0 && selectedGroup && (
        <div className="border rounded-xl p-4 bg-muted/20 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-semibold">Persona ideas for <span className="text-primary">{selectedGroup.name}</span></p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {personas.map(p => (
              <button
                key={p.name}
                type="button"
                onClick={() => setName(p.name)}
                className="text-left p-3 rounded-lg border border-border bg-background hover:border-primary/40 hover:bg-primary/5 transition-all space-y-0.5"
              >
                <p className="text-xs font-semibold">{p.name}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{p.description}</p>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Click a persona to use its name, or type your own above.</p>
        </div>
      )}
    </div>
  )
}
