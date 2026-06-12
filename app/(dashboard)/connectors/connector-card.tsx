'use client'

import { useState } from 'react'
import type { ConnectorSummary } from '@/connectors/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConnectDialog } from './connect-dialog'

interface ConnectorCardProps {
  connector: ConnectorSummary
  canManage: boolean
}

export function ConnectorCard({ connector, canManage }: ConnectorCardProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{connector.name}</CardTitle>
              <CardDescription className="mt-0.5">{connector.category}</CardDescription>
            </div>
            {connector.isSimulated && (
              <Badge variant="secondary" className="text-xs shrink-0">Simulated</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground flex-1">{connector.description}</p>
          {canManage && (
            <Button size="sm" onClick={() => setOpen(true)} className="w-full">
              Connect
            </Button>
          )}
          {!canManage && (
            <p className="text-xs text-muted-foreground">Admins can connect this API</p>
          )}
        </CardContent>
      </Card>

      <ConnectDialog
        connector={connector}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
