import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('*, workspace:workspaces(*)')
    .eq('user_id', user!.id)
    .single()

  const { count: connectionCount } = await supabase
    .from('connections')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', membership?.workspace_id)

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome back</h1>
        <p className="text-muted-foreground mt-1">{membership?.workspace?.name}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Connected APIs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{connectionCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Actions today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Automations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">—</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Connect your first API from the <strong>Connectors</strong> catalog.</p>
          <p>2. Ask <strong>Orbit Assistant</strong> anything about your data.</p>
          <p>3. Set up an <strong>Automation</strong> to act on events automatically.</p>
        </CardContent>
      </Card>
    </div>
  )
}
