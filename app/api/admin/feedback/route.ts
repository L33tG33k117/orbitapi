import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('feedback')
    .select('id, message, page_url, status, created_at, user:profiles(email, full_name), workspace:workspaces(name)')
    .order('created_at', { ascending: false })
    .limit(200)

  return NextResponse.json(data ?? [])
}
