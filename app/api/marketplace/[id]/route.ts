import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/admin-guard'

type Params = { params: Promise<{ id: string }> }

// Admin review of a marketplace submission (approve / reject). Feature #4.
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const admin_user = await requireSuperAdmin()
  if (!admin_user) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })

  const body = await req.json()
  const status = body.status as 'approved' | 'rejected'
  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('marketplace_listings')
    .update({
      status,
      reviewed_by: admin_user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: body.review_notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
