import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { z } from 'zod'

const banSchema = z.object({
  ban_type: z.enum(['user_id', 'email', 'email_domain', 'ip']),
  value: z.string().min(1).max(500),
  reason: z.string().max(1000).optional(),
  expires_at: z.string().optional(),
})

export async function GET() {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('platform_bans')
    .select('*, banned_by_profile:profiles!platform_bans_banned_by_fkey(email, full_name)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = banSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('platform_bans')
    .insert({
      ...parsed.data,
      banned_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
