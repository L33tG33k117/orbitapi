'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Check, Download } from 'lucide-react'

export function InstallButton({ slug, source, installed }: { slug: string; source: 'builtin' | 'marketplace'; installed: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  if (installed) {
    return <Button size="sm" variant="outline" disabled><Check className="h-3.5 w-3.5" /> Installed</Button>
  }

  async function install() {
    setLoading(true)
    const res = await fetch('/api/bundles/install', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, source }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.error ?? 'Install failed'); return }
    const c = data.created
    toast.success(`Installed — ${c.playbooks.length} playbook(s), ${c.skills.length} skill(s), ${c.connections.length} connection(s)`)
    router.refresh()
  }

  return (
    <Button size="sm" onClick={install} disabled={loading}>
      <Download className="h-3.5 w-3.5" /> {loading ? 'Installing…' : 'Install'}
    </Button>
  )
}
