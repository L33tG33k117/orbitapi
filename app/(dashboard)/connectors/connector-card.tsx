'use client'

import { useState } from 'react'
import Image from 'next/image'
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
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            {connector.logoUrl ? (
              <Image
                src={connector.logoUrl}
                alt={connector.name}
                width={40}
                height={40}
                className="rounded-lg shrink-0"
                unoptimized
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-muted shrink-0 flex items-center justify-center text-sm font-bold text-muted-foreground">
                {connector.name[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base leading-tight">{connector.name}</CardTitle>
                {connector.isSimulated && (
                  <Badge variant="secondary" className="text-xs shrink-0">Simulated</Badge>
                )}
              </div>
              <CardDescription className="mt-0.5">{connector.category}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground flex-1">{connector.description}</p>
          {canManage ? (
            <Button size="sm" onClick={() => setOpen(true)} className="w-full">
              Connect
            </Button>
          ) : (
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
