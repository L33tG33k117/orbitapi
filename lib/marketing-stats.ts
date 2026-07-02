import { catalog } from '@/connectors/catalog'
import { connectors } from '@/connectors'
import { BUILTIN_BUNDLES } from '@/lib/bundle-registry'

// Live numbers for the marketing site, derived from the same data the app
// runs on. Add a connector to the catalog and every public page updates on
// the next deploy — never hardcode these counts in page copy.

export function getMarketingStats() {
  const total = catalog.length
  const available = catalog.filter(c => c.available).length
  const actions = connectors.reduce((n, c) => n + c.actions.length, 0)
  const bundles = BUILTIN_BUNDLES.length
  const categories = new Set(catalog.map(c => c.category)).size
  return { total, available, actions, bundles, categories }
}
