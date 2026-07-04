// Client-side handler for the "connections not set up" refusal from the run
// routes. Shows a toast that explains WHY the run was refused and offers the
// two ways forward: finish setup in Apps, or one-click switch the unfinished
// connections to Simulation (sample data) and run again.

export interface NotSetUpPayload {
  error?: string
  message?: string
  connections?: { id: string; label: string; connector: string }[]
}

export function isNotSetUp(status: number, body: NotSetUpPayload): boolean {
  return status === 409 && body.error === 'connections_not_set_up'
}

export async function offerSimulateAndRerun(opts: {
  name: string
  body: NotSetUpPayload
  rerun: () => void
}) {
  const { toast } = await import('sonner')
  const conns = opts.body.connections ?? []
  const apps = conns.map(c => c.label).join(', ')
  toast.warning(`“${opts.name}” isn't fully set up yet`, {
    duration: 20000,
    description: conns.length
      ? `${apps} ${conns.length === 1 ? 'has' : 'have'} no credentials yet. Switch to Simulation to test with realistic sample data, or finish setup in Apps.`
      : (opts.body.message ?? 'Some apps have no credentials yet.'),
    action: {
      label: 'Simulate & run',
      onClick: async () => {
        const res = await fetch('/api/connections/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionIds: conns.map(c => c.id) }),
        })
        if (!res.ok) {
          toast.error('Could not switch those apps to Simulation. Try it from the Apps page.')
          return
        }
        toast.success('Switched to Simulation — launching now.')
        opts.rerun()
      },
    },
    cancel: {
      label: 'Finish setup',
      onClick: () => { window.location.assign('/connectors') },
    },
  })
}
