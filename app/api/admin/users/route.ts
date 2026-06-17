import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, email, full_name, super_admin, updated_at')
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich each profile with their workspace memberships (id, name, role)
  const enriched = await Promise.all((profiles ?? []).map(async profile => {
    const { data: memberships } = await admin
      .from('memberships')
      .select('role, workspace:workspaces(id, name, is_sandbox)')
      .eq('user_id', profile.id)
      .order('created_at')

    const workspaces = (memberships ?? []).map(m => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(m.workspace as any),
      role: m.role,
    }))

    return { ...profile, workspace_count: workspaces.length, workspaces }
  }))

  return NextResponse.json(enriched)
}
