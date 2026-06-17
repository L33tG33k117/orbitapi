import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const createSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  permissions: z.object({
    can_use_chat: z.boolean().optional(),
    can_view_audit: z.boolean().optional(),
    can_approve_actions: z.boolean().optional(),
    can_manage_skills: z.boolean().optional(),
    can_manage_connectors: z.boolean().optional(),
    can_view_usage: z.boolean().optional(),
    can_manage_members: z.boolean().optional(),
  }),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { workspaceId, name, description, permissions } = parsed.data

  const { data: caller } = await supabase
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!caller || !['owner', 'admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('custom_roles')
    .insert({
      workspace_id: workspaceId,
      name: name.trim(),
      description: description?.trim() ?? null,
      permissions,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
