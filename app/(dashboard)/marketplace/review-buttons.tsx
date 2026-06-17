'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'

export function ReviewButtons({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function review(status: 'approved' | 'rejected') {
    setLoading(true)
    const res = await fetch(`/api/marketplace/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    setLoading(false)
    if (!res.ok) { toast.error('Review failed'); return }
    toast.success(status === 'approved' ? 'Approved' : 'Rejected')
    router.refresh()
  }

  return (
    <div className="flex gap-2 shrink-0">
      <Button size="sm" onClick={() => review('approved')} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700"><Check className="h-3.5 w-3.5" /> Approve</Button>
      <Button size="sm" variant="outline" onClick={() => review('rejected')} disabled={loading}><X className="h-3.5 w-3.5" /> Reject</Button>
    </div>
  )
}
