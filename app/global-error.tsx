'use client'

import { useEffect } from 'react'

export default function GlobalError({
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
        context: 'global-error',
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: window.location.href,
      }),
    }).catch(() => {})
  }, [error])

  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground text-sm">
            An unexpected error occurred. The details have been logged.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground font-mono">ref: {error.digest}</p>
          )}
          <button
            onClick={unstable_retry}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
