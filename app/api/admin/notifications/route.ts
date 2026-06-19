import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

// Super Admin inbox: aggregates the things testers/users submit (feedback,
// connector requests, connector issue reports) into one recent-activity feed
// plus the open-queue counts shown as sidebar badges.

export interface AdminInboxItem {
  id: string
  type: 'feedback' | 'request' | 'report'
  title: string
  body: string | null
  link: string
  created_at: string
}

function truncate(s: string | null, n = 120): string | null {
  if (!s) return null
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

export async function GET() {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const [
    { data: feedback }, { count: newFeedback },
    { data: requests }, { count: pendingRequests },
    { data: reports }, { count: openReports },
  ] = await Promise.all([
    admin.from('feedback').select('id, message, created_at').order('created_at', { ascending: false }).limit(15),
    admin.from('feedback').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    admin.from('connector_requests').select('id, connector_name, use_case, created_at').order('created_at', { ascending: false }).limit(15),
    admin.from('connector_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('connector_reports').select('id, connector_name, what_wrong, created_at').order('created_at', { ascending: false }).limit(15),
    admin.from('connector_reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
  ])

  const items: AdminInboxItem[] = [
    ...(feedback ?? []).map(f => ({
      id: `feedback:${f.id}`, type: 'feedback' as const,
      title: 'New feedback', body: truncate(f.message), link: '/admin/feedback', created_at: f.created_at,
    })),
    ...(requests ?? []).map(r => ({
      id: `request:${r.id}`, type: 'request' as const,
      title: `Connector request: ${r.connector_name}`, body: truncate(r.use_case), link: '/admin/connector-requests', created_at: r.created_at,
    })),
    ...(reports ?? []).map(r => ({
      id: `report:${r.id}`, type: 'report' as const,
      title: `Issue reported: ${r.connector_name}`, body: truncate(r.what_wrong), link: '/admin/connector-reports', created_at: r.created_at,
    })),
  ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 30)

  const counts = {
    feedback: newFeedback ?? 0,
    requests: pendingRequests ?? 0,
    reports: openReports ?? 0,
  }

  return NextResponse.json({ items, counts })
}
