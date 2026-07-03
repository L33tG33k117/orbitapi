'use client'

import { useState } from 'react'
import { SimpleActionRunner } from './simple-runner'
import { ManualClient } from './manual-client'

interface ActionParam { key: string; type: string; description: string; enum: string[] | null; required: boolean }
interface ActionDef { slug: string; name: string; description: string; risk: 'read' | 'write' | 'destructive'; params: ActionParam[] }

interface Props {
  connectionId: string
  connectionLabel: string
  connectorSlug: string
  connectorName: string
  connectorCategory: string
  status: string
  actions: ActionDef[]
}

// Default to the beginner-friendly form runner; power users can flip to the
// raw terminal. Choice is remembered per browser.
export function RunnerShell(props: Props) {
  const [mode, setMode] = useState<'simple' | 'advanced'>(() => {
    if (typeof window === 'undefined') return 'simple'
    return window.localStorage.getItem('orbit_runner_mode') === 'advanced' ? 'advanced' : 'simple'
  })

  function setAndRemember(m: 'simple' | 'advanced') {
    setMode(m)
    try { window.localStorage.setItem('orbit_runner_mode', m) } catch { /* ignore */ }
  }

  if (mode === 'advanced') {
    return <ManualClient {...props} onSimple={() => setAndRemember('simple')} />
  }
  return <SimpleActionRunner {...props} onAdvanced={() => setAndRemember('advanced')} />
}
