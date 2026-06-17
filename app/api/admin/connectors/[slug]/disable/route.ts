import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { slug } = await params
  const { disabled, reason } = await req.json() as { disabled: boolean; reason?: string }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('connector_overrides')
    .upsert({
      slug,
      disabled,
      disabled_reason: disabled ? (reason ?? null) : null,
      disabled_by: disabled ? user.id : null,
      disabled_at: disabled ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'slug' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
