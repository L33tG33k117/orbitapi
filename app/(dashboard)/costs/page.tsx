import { redirect } from 'next/navigation'

// "Costs" was renamed to "AI Power". Redirect any old links/bookmarks.
export default function CostsRedirect() {
  redirect('/ai-power')
}
