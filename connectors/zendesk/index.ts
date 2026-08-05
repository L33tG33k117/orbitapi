import type { ConnectorManifest, ActionResult } from '@/connectors/types'

async function zdFetch(subdomain: string, email: string, token: string, path: string, options: RequestInit = {}): Promise<ActionResult> {
  const url = `https://${subdomain}.zendesk.com/api/v2${path}`
  const basicAuth = Buffer.from(`${email}/token:${token}`).toString('base64')
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `Zendesk ${res.status}: ${text}` }
  }
  if (res.status === 204) return { ok: true, data: { status: 'success' } }
  return { ok: true, data: await res.json() }
}

export const zendeskManifest: ConnectorManifest = {
  slug: 'zendesk',
  name: 'Zendesk Support',
  category: 'CRM & Support',
  description: 'Customer support — create, update, and manage tickets, users, organizations, macros, views, and CSAT scores.',
  logoUrl: '/logos/zendesk.svg',
  isSimulated: false,

  auth: {
    type: 'api_key',
    keyLabel: 'API Token',
    keyPlaceholder: 'Your Zendesk API token',
    fields: [
      { key: 'subdomain', label: 'Subdomain', placeholder: 'e.g. acme (from acme.zendesk.com)', inputType: 'text' },
      { key: 'email', label: 'Agent Email', placeholder: 'agent@yourcompany.com', inputType: 'text' },
      { key: 'token', label: 'API Token', placeholder: 'Zendesk API token', inputType: 'password' },
    ],
    setupGuide: [
      {
        title: 'Find your subdomain',
        description: 'Your Zendesk URL is **{subdomain}.zendesk.com** — the subdomain is the prefix before .zendesk.com.',
      },
      {
        title: 'Generate an API token',
        description:
          'In Zendesk: **Admin Center → Apps and integrations → Zendesk API → API token**. ' +
          'Click **Add API token**, give it a name, copy the token. ' +
          'Use your agent email (not the token) as the email field above.',
      },
    ],
  },

  testConnection: async (creds) => {
    const res = await zdFetch(creds.subdomain, creds.email, creds.token, '/tickets.json?page[size]=1')
    if (!res.ok) return { ok: false, error: res.error }
    return { ok: true, label: `Zendesk ${creds.subdomain}.zendesk.com` }
  },

  network: { hostPattern: '<your-subdomain>.zendesk.com' },

  actions: [
    {
      slug: 'list_tickets',
      name: 'List Tickets',
      description:
        'List Zendesk support tickets. Filter by status: new, open, pending, hold, solved, closed. ' +
        'priority: urgent, high, normal, low. limit defaults to 25.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by status: new, open, pending, hold, solved, closed' },
          priority: { type: 'string', description: 'Filter by priority: urgent, high, normal, low' },
          limit: { type: 'number', description: 'Max tickets (default 25, max 100)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        const filters: string[] = [`page[size]=${limit}`, 'sort=-created_at']
        if (params.status) filters.push(`status=${params.status}`)
        if (params.priority) filters.push(`priority=${params.priority}`)
        return zdFetch(creds.subdomain, creds.email, creds.token, `/tickets.json?${filters.join('&')}`)
      },
    },
    {
      slug: 'get_ticket',
      name: 'Get Ticket',
      description: 'Get a single Zendesk ticket by its numeric ID including all fields and metadata.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['ticket_id'],
        properties: {
          ticket_id: { type: 'number', description: 'The Zendesk ticket ID' },
        },
      },
      execute: async (creds, params) => {
        return zdFetch(creds.subdomain, creds.email, creds.token, `/tickets/${params.ticket_id as number}.json`)
      },
    },
    {
      slug: 'search_tickets',
      name: 'Search Tickets',
      description:
        'Search Zendesk tickets using the Zendesk search syntax. ' +
        'Examples: "status:open priority:high", "subject:outage created>2024-01-01", "assignee:me".',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Zendesk search query string' },
          limit: { type: 'number', description: 'Max results (default 25)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        const q = encodeURIComponent(`type:ticket ${params.query as string}`)
        return zdFetch(creds.subdomain, creds.email, creds.token, `/search.json?query=${q}&page[size]=${limit}`)
      },
    },
    {
      slug: 'create_ticket',
      name: 'Create Ticket',
      description:
        'Create a new Zendesk support ticket. priority: urgent, high, normal, low. ' +
        'type: problem, incident, question, task. requester_email sets the customer.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['subject', 'body'],
        properties: {
          subject: { type: 'string', description: 'Ticket subject line' },
          body: { type: 'string', description: 'Initial ticket description' },
          priority: { type: 'string', enum: ['urgent', 'high', 'normal', 'low'], description: 'Ticket priority (default: normal)' },
          type: { type: 'string', enum: ['problem', 'incident', 'question', 'task'], description: 'Ticket type' },
          requester_email: { type: 'string', description: 'Email of the end-user/requester (optional)' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Array of tags to apply' },
          assignee_email: { type: 'string', description: 'Agent email to assign the ticket to (optional)' },
        },
      },
      execute: async (creds, params) => {
        const body: Record<string, unknown> = {
          subject: params.subject,
          comment: { body: params.body },
          priority: params.priority ?? 'normal',
        }
        if (params.type) body.type = params.type
        if (params.requester_email) body.requester = { email: params.requester_email }
        if (params.tags) body.tags = params.tags
        if (params.assignee_email) body.assignee = { email: params.assignee_email }
        return zdFetch(creds.subdomain, creds.email, creds.token, '/tickets.json', {
          method: 'POST',
          body: JSON.stringify({ ticket: body }),
        })
      },
    },
    {
      slug: 'update_ticket',
      name: 'Update Ticket',
      description:
        'Update a Zendesk ticket — change status, priority, or add an internal/public comment. ' +
        'status: open, pending, hold, solved. Set comment_public=false for internal notes.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['ticket_id'],
        properties: {
          ticket_id: { type: 'number', description: 'Ticket ID to update' },
          status: { type: 'string', enum: ['open', 'pending', 'hold', 'solved'], description: 'New status' },
          priority: { type: 'string', enum: ['urgent', 'high', 'normal', 'low'], description: 'New priority' },
          comment: { type: 'string', description: 'Comment text to add' },
          comment_public: { type: 'boolean', description: 'true = public reply, false = internal note (default: true)' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Replace ticket tags' },
          assignee_email: { type: 'string', description: 'Reassign to agent email (optional)' },
        },
      },
      execute: async (creds, params) => {
        const { ticket_id, comment, comment_public, assignee_email, ...fields } = params
        const ticket: Record<string, unknown> = { ...fields }
        if (comment) ticket.comment = { body: comment, public: comment_public !== false }
        if (assignee_email) ticket.assignee = { email: assignee_email }
        return zdFetch(creds.subdomain, creds.email, creds.token, `/tickets/${ticket_id as number}.json`, {
          method: 'PUT',
          body: JSON.stringify({ ticket }),
        })
      },
    },
    {
      slug: 'delete_ticket',
      name: 'Delete Ticket',
      description: 'Permanently delete a Zendesk ticket by its ID. This action cannot be undone.',
      risk: 'destructive',
      inputSchema: {
        type: 'object',
        required: ['ticket_id'],
        properties: {
          ticket_id: { type: 'number', description: 'Ticket ID to delete' },
        },
      },
      execute: async (creds, params) => {
        return zdFetch(creds.subdomain, creds.email, creds.token, `/tickets/${params.ticket_id as number}.json`, {
          method: 'DELETE',
        })
      },
    },
    {
      slug: 'add_comment',
      name: 'Add Comment to Ticket',
      description:
        'Add a comment to an existing Zendesk ticket. ' +
        'Set public=false for an internal note visible only to agents.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['ticket_id', 'body'],
        properties: {
          ticket_id: { type: 'number', description: 'Ticket ID to comment on' },
          body: { type: 'string', description: 'Comment text' },
          public: { type: 'boolean', description: 'true = public reply to customer, false = internal note (default: true)' },
          author_email: { type: 'string', description: 'Agent email to post as (optional)' },
        },
      },
      execute: async (creds, params) => {
        const ticket: Record<string, unknown> = {
          comment: { body: params.body, public: params.public !== false },
        }
        if (params.author_email) ticket.comment = { ...(ticket.comment as object), author: { email: params.author_email } }
        return zdFetch(creds.subdomain, creds.email, creds.token, `/tickets/${params.ticket_id as number}.json`, {
          method: 'PUT',
          body: JSON.stringify({ ticket }),
        })
      },
    },
    {
      slug: 'merge_tickets',
      name: 'Merge Tickets',
      description:
        'Merge one or more source tickets into a target ticket. ' +
        'source_ticket_ids is a comma-separated list of ticket IDs to merge into target_ticket_id.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['target_ticket_id', 'source_ticket_ids'],
        properties: {
          target_ticket_id: { type: 'number', description: 'Ticket ID to merge INTO (will remain open)' },
          source_ticket_ids: { type: 'string', description: 'Comma-separated ticket IDs to merge (will be closed)' },
          target_comment: { type: 'string', description: 'Comment to add to the target ticket (optional)' },
          source_comment: { type: 'string', description: 'Comment to add to source tickets (optional)' },
        },
      },
      execute: async (creds, params) => {
        const sourceIds = (params.source_ticket_ids as string).split(',').map(id => parseInt(id.trim(), 10))
        return zdFetch(creds.subdomain, creds.email, creds.token, `/tickets/${params.target_ticket_id as number}/merge.json`, {
          method: 'POST',
          body: JSON.stringify({
            ids: sourceIds,
            target_comment: params.target_comment ?? 'Merged by OrbitAPI automation.',
            source_comment: params.source_comment ?? 'This ticket was merged by OrbitAPI automation.',
          }),
        })
      },
    },
    {
      slug: 'list_users',
      name: 'List Users',
      description: 'List Zendesk users (agents and end-users). Filter by role: end-user, agent, admin.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          role: { type: 'string', description: 'Filter by role: end-user, agent, admin' },
          limit: { type: 'number', description: 'Max users (default 25)' },
          query: { type: 'string', description: 'Search by name or email (optional)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        if (params.query) {
          const q = encodeURIComponent(`type:user ${params.query as string}`)
          return zdFetch(creds.subdomain, creds.email, creds.token, `/search.json?query=${q}&page[size]=${limit}`)
        }
        const qs = params.role
          ? `/users.json?role=${params.role}&page[size]=${limit}`
          : `/users.json?page[size]=${limit}`
        return zdFetch(creds.subdomain, creds.email, creds.token, qs)
      },
    },
    {
      slug: 'create_user',
      name: 'Create User',
      description:
        'Create a new Zendesk end-user or agent. role: end-user (default), agent, admin. ' +
        'End-users are customers; agents can work tickets.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string', description: 'User full name' },
          email: { type: 'string', description: 'User email address' },
          role: { type: 'string', enum: ['end-user', 'agent', 'admin'], description: 'User role (default: end-user)' },
          phone: { type: 'string', description: 'Phone number (optional)' },
          organization_id: { type: 'number', description: 'Organization ID to add the user to (optional)' },
          verified: { type: 'boolean', description: 'Mark email as verified (default: true)' },
        },
      },
      execute: async (creds, params) => {
        return zdFetch(creds.subdomain, creds.email, creds.token, '/users.json', {
          method: 'POST',
          body: JSON.stringify({
            user: {
              name: params.name,
              email: params.email,
              role: params.role ?? 'end-user',
              phone: params.phone ?? undefined,
              organization_id: params.organization_id ?? undefined,
              verified: params.verified !== false,
            },
          }),
        })
      },
    },
    {
      slug: 'update_user',
      name: 'Update User',
      description: 'Update a Zendesk user\'s name, email, phone, role, or organization.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['user_id'],
        properties: {
          user_id: { type: 'number', description: 'Zendesk user ID to update' },
          name: { type: 'string', description: 'New display name (optional)' },
          email: { type: 'string', description: 'New email address (optional)' },
          phone: { type: 'string', description: 'New phone number (optional)' },
          role: { type: 'string', enum: ['end-user', 'agent', 'admin'], description: 'New role (optional)' },
          notes: { type: 'string', description: 'Internal notes about the user (optional)' },
        },
      },
      execute: async (creds, params) => {
        const { user_id, ...fields } = params
        return zdFetch(creds.subdomain, creds.email, creds.token, `/users/${user_id as number}.json`, {
          method: 'PUT',
          body: JSON.stringify({ user: fields }),
        })
      },
    },
    {
      slug: 'suspend_user',
      name: 'Suspend User',
      description:
        'Suspend a Zendesk end-user, preventing them from submitting new tickets. ' +
        'Set suspended=false to unsuspend.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['user_id'],
        properties: {
          user_id: { type: 'number', description: 'Zendesk user ID to suspend or unsuspend' },
          suspended: { type: 'boolean', description: 'true to suspend, false to unsuspend (default: true)' },
        },
      },
      execute: async (creds, params) => {
        return zdFetch(creds.subdomain, creds.email, creds.token, `/users/${params.user_id as number}.json`, {
          method: 'PUT',
          body: JSON.stringify({ user: { suspended: params.suspended !== false } }),
        })
      },
    },
    {
      slug: 'list_organizations',
      name: 'List Organizations',
      description: 'List Zendesk organizations (companies). Returns organization ID, name, and domain.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max organizations (default 25)' },
          query: { type: 'string', description: 'Filter by name (optional)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        if (params.query) {
          const q = encodeURIComponent(`type:organization ${params.query as string}`)
          return zdFetch(creds.subdomain, creds.email, creds.token, `/search.json?query=${q}&page[size]=${limit}`)
        }
        return zdFetch(creds.subdomain, creds.email, creds.token, `/organizations.json?page[size]=${limit}`)
      },
    },
    {
      slug: 'create_organization',
      name: 'Create Organization',
      description: 'Create a new Zendesk organization (company account). Optionally set the domain name for auto-association.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', description: 'Organization name' },
          domain_names: { type: 'string', description: 'Comma-separated email domain names (e.g. "acme.com,acme.co.uk")' },
          notes: { type: 'string', description: 'Internal notes about the organization (optional)' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tags to apply (optional)' },
        },
      },
      execute: async (creds, params) => {
        const org: Record<string, unknown> = { name: params.name }
        if (params.domain_names) org.domain_names = (params.domain_names as string).split(',').map(d => d.trim())
        if (params.notes) org.notes = params.notes
        if (params.tags) org.tags = params.tags
        return zdFetch(creds.subdomain, creds.email, creds.token, '/organizations.json', {
          method: 'POST',
          body: JSON.stringify({ organization: org }),
        })
      },
    },
    {
      slug: 'apply_macro',
      name: 'Apply Macro to Ticket',
      description:
        'Apply a Zendesk macro to a ticket. Macros can auto-set status, tags, assignee, and add a comment. ' +
        'Find macro IDs with list_macros.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['ticket_id', 'macro_id'],
        properties: {
          ticket_id: { type: 'number', description: 'Ticket ID to apply the macro to' },
          macro_id: { type: 'number', description: 'Macro ID to apply' },
        },
      },
      execute: async (creds, params) => {
        return zdFetch(creds.subdomain, creds.email, creds.token, `/tickets/${params.ticket_id as number}/macros/${params.macro_id as number}/apply.json`)
      },
    },
    {
      slug: 'list_macros',
      name: 'List Macros',
      description: 'List available Zendesk macros that can be applied to tickets.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max macros (default 25)' },
          query: { type: 'string', description: 'Search by macro name (optional)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        const qs: string[] = [`page[size]=${limit}`]
        if (params.query) qs.push(`query=${encodeURIComponent(params.query as string)}`)
        return zdFetch(creds.subdomain, creds.email, creds.token, `/macros.json?${qs.join('&')}`)
      },
    },
    {
      slug: 'list_views',
      name: 'List Views',
      description: 'List Zendesk ticket views (saved ticket filters). Returns view ID, title, and ticket count.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max views (default 25)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        return zdFetch(creds.subdomain, creds.email, creds.token, `/views.json?page[size]=${limit}`)
      },
    },
    {
      slug: 'get_view_tickets',
      name: 'Get View Tickets',
      description: 'Retrieve tickets from a specific Zendesk view by its ID.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['view_id'],
        properties: {
          view_id: { type: 'number', description: 'Zendesk view ID' },
          limit: { type: 'number', description: 'Max tickets to return (default 25)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 100)
        return zdFetch(creds.subdomain, creds.email, creds.token, `/views/${params.view_id as number}/tickets.json?page[size]=${limit}`)
      },
    },
    {
      slug: 'get_ticket_metrics',
      name: 'Get Ticket Metrics',
      description: 'Get detailed timing metrics for a Zendesk ticket: first reply time, full resolution time, and SLA info.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['ticket_id'],
        properties: {
          ticket_id: { type: 'number', description: 'Ticket ID to get metrics for' },
        },
      },
      execute: async (creds, params) => {
        return zdFetch(creds.subdomain, creds.email, creds.token, `/tickets/${params.ticket_id as number}/metrics.json`)
      },
    },
    {
      slug: 'bulk_update_tickets',
      name: 'Bulk Update Tickets',
      description:
        'Update multiple Zendesk tickets at once. ' +
        'ticket_ids is a comma-separated list of ticket IDs. Can set status, priority, and add a comment.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['ticket_ids'],
        properties: {
          ticket_ids: { type: 'string', description: 'Comma-separated ticket IDs to update' },
          status: { type: 'string', enum: ['open', 'pending', 'hold', 'solved'], description: 'New status for all tickets' },
          priority: { type: 'string', enum: ['urgent', 'high', 'normal', 'low'], description: 'New priority for all tickets' },
          comment: { type: 'string', description: 'Comment to add to all tickets (optional)' },
          comment_public: { type: 'boolean', description: 'Public or internal comment (default: false for bulk)' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tags to add (optional)' },
        },
      },
      execute: async (creds, params) => {
        const ids = (params.ticket_ids as string).split(',').map(id => parseInt(id.trim(), 10)).filter(n => !isNaN(n))
        const ticket: Record<string, unknown> = {}
        if (params.status) ticket.status = params.status
        if (params.priority) ticket.priority = params.priority
        if (params.tags) ticket.tags = params.tags
        if (params.comment) ticket.comment = { body: params.comment, public: params.comment_public === true }
        return zdFetch(creds.subdomain, creds.email, creds.token, `/tickets/update_many.json?ids=${ids.join(',')}`, {
          method: 'PUT',
          body: JSON.stringify({ ticket }),
        })
      },
    },
  ],
}
