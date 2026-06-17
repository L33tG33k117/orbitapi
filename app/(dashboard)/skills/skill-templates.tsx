'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, ChevronDown, ChevronUp } from 'lucide-react'
import type { SkillTemplate } from '@/lib/skill-templates'
import { TEMPLATE_CATEGORIES } from '@/lib/skill-templates'

interface Props {
  templates: SkillTemplate[]
  groups: { id: string; name: string; color: string }[]
}

export function SkillTemplates({ templates, groups }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [creating, setCreating] = useState<string | null>(null)
  const router = useRouter()

  const categories = ['All', ...TEMPLATE_CATEGORIES]
  const filtered = activeCategory === 'All' ? templates : templates.filter(t => t.category === activeCategory)

  async function useTemplate(template: SkillTemplate) {
    setCreating(template.id)
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          persona: template.persona,
          autonomy: template.autonomy,
          trigger_prompt: template.trigger_prompt ?? '',
          group_id: groups[0]?.id ?? null,
          enabled: false,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/skills/${data.id}`)
      } else {
        const d = await res.json()
        alert(d.error ?? 'Could not create skill')
      }
    } finally {
      setCreating(null)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Start from a template</p>
            <p className="text-xs text-muted-foreground">{templates.length} pre-built automations ready to use</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Category filter */}
          <div className="flex items-center gap-1.5 px-5 py-3 overflow-x-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Template cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-5 pb-5">
            {filtered.map(template => (
              <div
                key={template.id}
                className="rounded-lg border border-border bg-background p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl shrink-0 mt-0.5">{template.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold leading-tight">{template.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wide shrink-0 ${
                        template.autonomy === 'autonomous' ? 'bg-primary/10 text-primary' :
                        template.autonomy === 'manual' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {template.autonomy}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{template.description}</p>
                  </div>
                </div>

                {template.connectors.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {template.connectors.slice(0, 4).map(c => (
                      <span key={c} className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                        {c}
                      </span>
                    ))}
                    {template.connectors.length > 4 && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        +{template.connectors.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                <button
                  onClick={() => useTemplate(template)}
                  disabled={creating === template.id}
                  className="w-full text-xs font-medium py-1.5 rounded-md border border-primary/30 text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  {creating === template.id ? 'Creating…' : 'Use this template →'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
