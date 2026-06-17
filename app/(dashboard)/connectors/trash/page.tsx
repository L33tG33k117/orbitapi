import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TrashBinClient } from './trash-bin-client'

export default async function TrashPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('user_id', user!.id)
    .single()

  const canManage = membership?.role === 'owner' || membership?.role === 'admin'

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Connector Trash</h1>
        <p className="text-muted-foreground mt-1">
          Deleted connections are held here for 7 days before being permanently removed.
          Restore a connection to bring it back with all its skills and groups intact.
        </p>
      </div>
      <TrashBinClient canManage={canManage} />
    </div>
  )
}
