import { createClient } from '@/lib/supabase/server'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">Your account details</p>
      </div>
      <div className="border rounded-lg p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Email</p>
          <p>{user?.email}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Name</p>
          <p>{(user?.user_metadata?.full_name as string) ?? '—'}</p>
        </div>
      </div>
    </div>
  )
}
