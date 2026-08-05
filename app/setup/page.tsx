import { redirect } from 'next/navigation'
import { isSelfHost } from '@/lib/edition'
import { needsFirstRunSetup } from '@/lib/setup-state'
import { SetupClient } from './setup-client'

export const dynamic = 'force-dynamic'

// First-run wizard for a self-hosted install. Reachable only while the
// instance has no accounts at all; once one exists this redirects to login,
// so a stale bookmark can never reopen account creation.
export default async function SetupPage() {
  if (!isSelfHost()) redirect('/')
  if (!(await needsFirstRunSetup())) redirect('/login')

  return <SetupClient />
}
