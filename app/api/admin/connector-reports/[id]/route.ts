import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { status, admin_note } = await req.json() as { status?: string; admin_note?: string }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('connector_reports')
    .update({ status, admin_note, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, status, admin_note')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
