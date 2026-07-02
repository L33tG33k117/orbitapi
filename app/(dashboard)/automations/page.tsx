import { redirect } from 'next/navigation'

// The old "Automations" placeholder became Skills + Playbooks. Redirect any
// old links/bookmarks to Skills.
export default function AutomationsRedirect() {
  redirect('/skills')
}
