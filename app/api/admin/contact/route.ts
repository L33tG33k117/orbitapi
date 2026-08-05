import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300)

  // Graceful before migration 055 is applied — an empty list beats a 500.
  if (error) return NextResponse.json([])

  return NextResponse.json(data ?? [])
}
