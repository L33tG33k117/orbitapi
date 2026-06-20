'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Download } from 'lucide-react'
import { InstallBundleDialog, type BundleConnectorChoice, type ExistingConnection } from '../bundles/install-bundle-dialog'

// Marketplace bundles install through the same builder dialog as vertical
// bundles — so users reuse/substitute connectors instead of getting duplicates.
export function MarketplaceInstall({
  slug, name, installed, connectors, existingConnections,
}: {
  slug: string
  name: string
  installed: boolean
  connectors: BundleConnectorChoice[]
  existingConnections: ExistingConnection[]
}) {
  const [open, setOpen] = useState(false)

  if (installed) {
    return <Button size="sm" variant="outline" disabled><Check className="h-3.5 w-3.5" /> Installed</Button>
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Download className="h-3.5 w-3.5" /> Install</Button>
      <InstallBundleDialog
        slug={slug}
        bundleName={name}
        source="marketplace"
        connectors={connectors}
        existingConnections={existingConnections}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
