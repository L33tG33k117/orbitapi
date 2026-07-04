import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHero } from '@/components/page-hero'
import { McpClient } from './mcp-client'

export const metadata = { title: 'Connect your AI · OrbitAPI' }

export default async function McpPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('workspace_id, role').eq('user_id', user!.id).single()
  if (!membership) redirect('/dashboard')

  const isAdmin = membership.role !== 'member'

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-3xl">
      <PageHero
        eyebrow="Operate"
        title="Connect your AI"
        description="Use your Orbit connectors from Claude, ChatGPT, GitHub Copilot, or Cursor. Your assistant gets the tools; Orbit keeps the credentials, the approval gates, and the audit log."
      />
      <McpClient isAdmin={isAdmin} />
    </div>
  )
}
