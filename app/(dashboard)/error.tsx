'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: 'dashboard',
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: window.location.href,
      }),
    }).catch(() => {})
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
      <h2 className="text-xl font-semibold">Page error</h2>
      <p className="text-muted-foreground text-sm max-w-sm">
        Something went wrong loading this page. The error has been logged.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">ref: {error.digest}</p>
      )}
      <p className="text-sm text-destructive font-mono bg-destructive/10 px-3 py-2 rounded-md max-w-sm break-all">
        {error.message}
      </p>
      <Button onClick={unstable_retry}>Try again</Button>
    </div>
  )
}
