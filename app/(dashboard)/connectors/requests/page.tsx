import { RequestConnectorForm } from '../request-connector-form'
import { PageHeader } from '@/components/page-header'

export const metadata = { title: 'Connector Requests · OrbitAPI' }

export default function ConnectorRequestsPage() {
  return (
    <div className="p-4 sm:p-8 max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Connect"
        title="Connector Requests"
        description="Vote on connectors your team wants, track build progress, and message the OrbitAPI team. Approved requests are built automatically and added to your catalog."
      />
      <RequestConnectorForm />
    </div>
  )
}
