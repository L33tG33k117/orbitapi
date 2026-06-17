import { Inbox } from 'lucide-react'
import { RequestConnectorForm } from '../request-connector-form'

export const metadata = { title: 'Connector Requests · OrbitAPI' }

export default function ConnectorRequestsPage() {
  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Inbox className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Connector Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Vote on connectors your team wants, track build progress, and message the OrbitAPI team.
            Approved requests are built automatically and added to your catalog.
          </p>
        </div>
      </div>

      <RequestConnectorForm />
    </div>
  )
}
