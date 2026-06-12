'use client'

import { useEffect } from 'react'

function report(message: string, stack?: string, context = 'window') {
  fetch('/api/log-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context, message, stack, url: window.location.href }),
  }).catch(() => {})
}

export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      report(e.message, e.error?.stack, 'uncaught')
    }
    const onUnhandled = (e: PromiseRejectionEvent) => {
      const err = e.reason
      const message = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack : undefined
      report(message, stack, 'unhandled-rejection')
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandled)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandled)
    }
  }, [])

  return null
}
