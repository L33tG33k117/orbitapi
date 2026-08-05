import type { ConnectorManifest, ActionResult } from '@/connectors/types'

const PLAIN_ENDPOINT = 'https://core.plain.com/b/graphql'

async function plainGql(apiKey: string, query: string, variables: Record<string, unknown> = {}): Promise<ActionResult> {
  const res = await fetch(PLAIN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `Plain API ${res.status}: ${text}` }
  }
  const json = await res.json()
  if (json.errors?.length) {
    return { ok: false, error: json.errors.map((e: { message: string }) => e.message).join('; ') }
  }
  return { ok: true, data: json.data }
}

export const plainManifest: ConnectorManifest = {
  slug: 'plain',
  name: 'Plain',
  category: 'CRM & Support',
  description: 'Modern B2B customer support — threads, customers, labels, timeline events, assignments, and triage workflows.',
  logoUrl: '/logos/plain.svg',
  isSimulated: false,

  auth: {
    type: 'api_key',
    keyLabel: 'API Key',
    keyPlaceholder: 'plainApiKey_...',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'plainApiKey_...', inputType: 'password' },
    ],
    setupGuide: [
      {
        title: 'Create a machine user API key',
        description:
          'In Plain: **Settings → Machine users → New machine user**. ' +
          'Give it a name (e.g. OrbitAPI) and the following permissions: ' +
          '**Read threads, Write threads, Read customers, Write customers, Read timeline, Write timeline, Read labels, Write labels**. ' +
          'Copy the generated API key.',
      },
    ],
  },

  testConnection: async (creds) => {
    const res = await plainGql(creds.api_key, `query { workspace { id name } }`)
    if (!res.ok) return { ok: false, error: res.error }
    const name = (res.data as { workspace: { name: string } }).workspace?.name
    return { ok: true, label: `Plain — ${name ?? 'workspace'}` }
  },

  network: { hosts: ['core.plain.com'] },

  actions: [
    {
      slug: 'list_threads',
      name: 'List Threads',
      description:
        'List Plain support threads. Filter by status: TODO, DONE, SNOOZED. ' +
        'Returns thread ID, title, status, customer, priority, and assignee. limit defaults to 20.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by status: TODO, DONE, SNOOZED' },
          limit: { type: 'number', description: 'Max threads (default 20, max 50)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 50)
        const filters = params.status
          ? `filters: { statuses: [${params.status}] }`
          : ''
        const query = `
          query ListThreads {
            threads(first: ${limit} ${filters}) {
              edges {
                node {
                  id
                  title
                  status
                  priority
                  createdAt { iso8601 }
                  updatedAt { iso8601 }
                  customer { id fullName email { email } }
                  assignee { ... on UserActor { user { id fullName } } }
                  labels { id name color }
                }
              }
            }
          }
        `
        return plainGql(creds.api_key, query)
      },
    },
    {
      slug: 'get_thread',
      name: 'Get Thread',
      description: 'Get a single Plain thread by ID, including all timeline events and customer details.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['thread_id'],
        properties: {
          thread_id: { type: 'string', description: 'The Plain thread ID (e.g. th_01ABC...)' },
        },
      },
      execute: async (creds, params) => {
        const query = `
          query GetThread($threadId: ID!) {
            thread(threadId: $threadId) {
              id title status priority
              createdAt { iso8601 }
              customer { id fullName email { email } externalId }
              assignee { ... on UserActor { user { id fullName } } }
              labels { id name color }
              timeline(first: 20) {
                edges {
                  node {
                    id
                    __typename
                    ... on CustomerTimelineEntry { text { value } }
                    ... on NoteTimelineEntry { text { value } markdownText { value } }
                    ... on ChatTimelineEntry { chatEntry { text { value } } }
                    ... on EmailTimelineEntry { emailEntry { subject textContent } }
                  }
                }
              }
            }
          }
        `
        return plainGql(creds.api_key, query, { threadId: params.thread_id as string })
      },
    },
    {
      slug: 'get_customer',
      name: 'Get Customer',
      description: 'Look up a Plain customer by email address. Returns customer ID, name, email, and linked external ID.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', description: 'Customer email address' },
        },
      },
      execute: async (creds, params) => {
        const query = `
          query GetCustomerByEmail($email: String!) {
            customerByEmail(email: $email) {
              id fullName
              email { email isVerified }
              externalId
              createdAt { iso8601 }
              updatedAt { iso8601 }
            }
          }
        `
        return plainGql(creds.api_key, query, { email: params.email as string })
      },
    },
    {
      slug: 'list_customers',
      name: 'List Customers',
      description: 'List Plain customers with pagination. Optionally filter by full name or email.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Search by customer name or email (optional)' },
          limit: { type: 'number', description: 'Max customers (default 20, max 50)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 50)
        const filters = params.search
          ? `, filters: { searchQuery: "${(params.search as string).replace(/"/g, '\\"')}" }`
          : ''
        const query = `
          query ListCustomers {
            customers(first: ${limit}${filters}) {
              edges {
                node {
                  id fullName externalId
                  email { email isVerified }
                  createdAt { iso8601 }
                  updatedAt { iso8601 }
                }
              }
              totalCount
            }
          }
        `
        return plainGql(creds.api_key, query)
      },
    },
    {
      slug: 'create_customer',
      name: 'Create Customer',
      description: 'Create a new Plain customer. Optionally include an externalId to link to your system.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['full_name', 'email'],
        properties: {
          full_name: { type: 'string', description: 'Customer full name' },
          email: { type: 'string', description: 'Customer email address' },
          external_id: { type: 'string', description: 'Your internal system ID for this customer (optional)' },
        },
      },
      execute: async (creds, params) => {
        const mutation = `
          mutation UpsertCustomer($input: UpsertCustomerInput!) {
            upsertCustomer(input: $input) {
              customer { id fullName email { email } externalId }
              error { message fields { field message } }
              result
            }
          }
        `
        const identifier = params.external_id
          ? { externalId: params.external_id }
          : { emailAddress: params.email }
        return plainGql(creds.api_key, mutation, {
          input: {
            identifier,
            onCreate: {
              fullName: params.full_name,
              email: { email: params.email, isVerified: false },
              ...(params.external_id ? { externalId: params.external_id } : {}),
            },
            onUpdate: {},
          },
        })
      },
    },
    {
      slug: 'update_customer',
      name: 'Update Customer',
      description: 'Update a Plain customer\'s full name or external ID by their email address.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', description: 'Customer email (used to identify the customer)' },
          full_name: { type: 'string', description: 'New full name (optional)' },
          external_id: { type: 'string', description: 'New external ID (optional)' },
        },
      },
      execute: async (creds, params) => {
        const mutation = `
          mutation UpsertCustomer($input: UpsertCustomerInput!) {
            upsertCustomer(input: $input) {
              customer { id fullName email { email } externalId }
              error { message }
              result
            }
          }
        `
        const onUpdate: Record<string, unknown> = {}
        if (params.full_name) onUpdate.fullName = params.full_name
        if (params.external_id) onUpdate.externalId = params.external_id
        return plainGql(creds.api_key, mutation, {
          input: {
            identifier: { emailAddress: params.email as string },
            onCreate: { fullName: (params.full_name as string | undefined) ?? '', email: { email: params.email, isVerified: false } },
            onUpdate,
          },
        })
      },
    },
    {
      slug: 'create_thread',
      name: 'Create Thread',
      description:
        'Create a new Plain support thread for an existing customer. ' +
        'Requires the customer\'s email. Optionally assign a label and priority.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['customer_email', 'title'],
        properties: {
          customer_email: { type: 'string', description: 'Customer email address' },
          title: { type: 'string', description: 'Thread title / subject' },
          message: { type: 'string', description: 'Initial message text (optional)' },
          priority: { type: 'number', description: 'Priority: 0=Urgent, 1=High, 2=Normal, 3=Low (default 2)' },
          label_type_id: { type: 'string', description: 'Label type ID to attach (optional)' },
        },
      },
      execute: async (creds, params) => {
        const mutation = `
          mutation CreateThread($input: CreateThreadInput!) {
            createThread(input: $input) {
              thread { id title status priority }
              error { message fields { field message } }
            }
          }
        `
        const input: Record<string, unknown> = {
          customerIdentifier: { emailAddress: params.customer_email },
          title: params.title,
          priority: (params.priority as number | undefined) ?? 2,
        }
        if (params.message) {
          input.components = [{ componentText: { text: params.message } }]
        }
        if (params.label_type_id) {
          input.labelTypeIds = [params.label_type_id]
        }
        return plainGql(creds.api_key, mutation, { input })
      },
    },
    {
      slug: 'reply_to_thread',
      name: 'Reply to Thread',
      description:
        'Send a reply to a Plain thread as a chat message visible to the customer. ' +
        'Use for responding to support inquiries from automations.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['thread_id', 'text'],
        properties: {
          thread_id: { type: 'string', description: 'The Plain thread ID to reply to' },
          text: { type: 'string', description: 'The reply message text (plain text)' },
        },
      },
      execute: async (creds, params) => {
        const mutation = `
          mutation ReplyToThread($input: ReplyToThreadInput!) {
            replyToThread(input: $input) {
              thread { id status }
              error { message }
            }
          }
        `
        return plainGql(creds.api_key, mutation, {
          input: {
            threadId: params.thread_id,
            text: params.text,
          },
        })
      },
    },
    {
      slug: 'add_note',
      name: 'Add Internal Note',
      description:
        'Add an internal note to a Plain thread (not visible to the customer). ' +
        'Supports markdown formatting for rich team collaboration.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['thread_id', 'text'],
        properties: {
          thread_id: { type: 'string', description: 'The Plain thread ID' },
          text: { type: 'string', description: 'Note content (markdown supported)' },
        },
      },
      execute: async (creds, params) => {
        const mutation = `
          mutation AddNote($input: CreateNoteInput!) {
            createNote(input: $input) {
              note { id }
              error { message }
            }
          }
        `
        return plainGql(creds.api_key, mutation, {
          input: {
            threadId: params.thread_id,
            text: params.text,
          },
        })
      },
    },
    {
      slug: 'change_thread_status',
      name: 'Change Thread Status',
      description:
        'Change the status of a Plain thread. ' +
        'status: TODO (re-open/assign), DONE (resolve), SNOOZED (snooze until a time). ' +
        'snoozed_until_iso is required when status=SNOOZED.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['thread_id', 'status'],
        properties: {
          thread_id: { type: 'string', description: 'The Plain thread ID' },
          status: { type: 'string', enum: ['TODO', 'DONE', 'SNOOZED'], description: 'New thread status' },
          snoozed_until_iso: { type: 'string', description: 'ISO 8601 datetime — required when status is SNOOZED' },
        },
      },
      execute: async (creds, params) => {
        const mutation = `
          mutation ChangeThreadStatus($input: ChangeThreadStatusInput!) {
            changeThreadStatus(input: $input) {
              thread { id status }
              error { message }
            }
          }
        `
        const input: Record<string, unknown> = {
          threadId: params.thread_id,
          status: params.status,
        }
        if (params.snoozed_until_iso) {
          input.snoozedUntil = { iso8601: params.snoozed_until_iso }
        }
        return plainGql(creds.api_key, mutation, { input })
      },
    },
    {
      slug: 'assign_thread',
      name: 'Assign Thread',
      description:
        'Assign a Plain thread to a user (by user ID) or unassign it. ' +
        'Pass user_id to assign; omit it to unassign.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['thread_id'],
        properties: {
          thread_id: { type: 'string', description: 'The Plain thread ID' },
          user_id: { type: 'string', description: 'User ID to assign to (omit to unassign)' },
        },
      },
      execute: async (creds, params) => {
        if (params.user_id) {
          const mutation = `
            mutation AssignThread($input: AssignThreadToUserInput!) {
              assignThreadToUser(input: $input) {
                thread { id assignee { ... on UserActor { user { id fullName } } } }
                error { message }
              }
            }
          `
          return plainGql(creds.api_key, mutation, {
            input: { threadId: params.thread_id, userId: params.user_id },
          })
        } else {
          const mutation = `
            mutation UnassignThread($input: UnassignThreadInput!) {
              unassignThread(input: $input) {
                thread { id assignee { ... on UserActor { user { id fullName } } } }
                error { message }
              }
            }
          `
          return plainGql(creds.api_key, mutation, {
            input: { threadId: params.thread_id },
          })
        }
      },
    },
    {
      slug: 'set_thread_priority',
      name: 'Set Thread Priority',
      description: 'Change the priority of a Plain thread. Priority: 0=Urgent, 1=High, 2=Normal, 3=Low.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['thread_id', 'priority'],
        properties: {
          thread_id: { type: 'string', description: 'The Plain thread ID' },
          priority: { type: 'number', description: 'Priority level: 0=Urgent, 1=High, 2=Normal, 3=Low' },
        },
      },
      execute: async (creds, params) => {
        const mutation = `
          mutation SetThreadPriority($input: SetThreadPriorityInput!) {
            setThreadPriority(input: $input) {
              thread { id priority }
              error { message }
            }
          }
        `
        return plainGql(creds.api_key, mutation, {
          input: { threadId: params.thread_id, priority: params.priority },
        })
      },
    },
    {
      slug: 'list_labels',
      name: 'List Label Types',
      description: 'List all available Plain label types in the workspace. Returns label type IDs and names needed for adding labels to threads.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max label types to return (default 50)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 50, 100)
        const query = `
          query ListLabelTypes {
            labelTypes(first: ${limit}) {
              edges {
                node { id name isArchived }
              }
              totalCount
            }
          }
        `
        return plainGql(creds.api_key, query)
      },
    },
    {
      slug: 'add_label',
      name: 'Add Label to Thread',
      description: 'Add a label to a Plain thread by label type ID. Use "List Label Types" to find available label type IDs.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['thread_id', 'label_type_id'],
        properties: {
          thread_id: { type: 'string', description: 'The Plain thread ID' },
          label_type_id: { type: 'string', description: 'Label type ID (from list_labels)' },
        },
      },
      execute: async (creds, params) => {
        const mutation = `
          mutation AddLabel($input: AddLabelsInput!) {
            addLabels(input: $input) {
              labels { id labelType { id name } }
              error { message }
            }
          }
        `
        return plainGql(creds.api_key, mutation, {
          input: {
            threadId: params.thread_id,
            labelTypeIds: [params.label_type_id],
          },
        })
      },
    },
    {
      slug: 'remove_label',
      name: 'Remove Label from Thread',
      description: 'Remove a label from a Plain thread by label ID (not label type ID). Use "Get Thread" to see current label IDs.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['thread_id', 'label_id'],
        properties: {
          thread_id: { type: 'string', description: 'The Plain thread ID' },
          label_id: { type: 'string', description: 'The specific label instance ID to remove (from the thread\'s labels list)' },
        },
      },
      execute: async (creds, params) => {
        const mutation = `
          mutation RemoveLabel($input: RemoveLabelsInput!) {
            removeLabels(input: $input) {
              error { message }
            }
          }
        `
        return plainGql(creds.api_key, mutation, {
          input: {
            threadId: params.thread_id,
            labelIds: [params.label_id],
          },
        })
      },
    },
    {
      slug: 'create_timeline_event',
      name: 'Create Timeline Event',
      description:
        'Add a custom timeline event to a Plain customer\'s history. ' +
        'Useful for logging external events (deployments, billing changes, logins) into the customer timeline.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['customer_email', 'title'],
        properties: {
          customer_email: { type: 'string', description: 'Customer email address' },
          title: { type: 'string', description: 'Event title (shown as the main label in the timeline)' },
          components: { type: 'string', description: 'JSON array of component objects (optional). Example: [{"componentText":{"text":"Details here"}}]' },
          external_id: { type: 'string', description: 'Your system\'s unique ID for this event (for deduplication, optional)' },
          occurred_at_iso: { type: 'string', description: 'ISO 8601 datetime when the event occurred (defaults to now, optional)' },
        },
      },
      execute: async (creds, params) => {
        const mutation = `
          mutation CreateCustomerEvent($input: CreateCustomerEventInput!) {
            createCustomerEvent(input: $input) {
              customerEvent { id title }
              error { message }
            }
          }
        `
        let components: unknown[] = []
        if (params.components) {
          try { components = JSON.parse(params.components as string) } catch { components = [] }
        }
        const input: Record<string, unknown> = {
          customerIdentifier: { emailAddress: params.customer_email },
          title: params.title,
          components,
        }
        if (params.external_id) input.externalId = params.external_id
        if (params.occurred_at_iso) input.occurredAt = { iso8601: params.occurred_at_iso }
        return plainGql(creds.api_key, mutation, { input })
      },
    },
    {
      slug: 'list_workspace_users',
      name: 'List Workspace Users',
      description: 'List all users in the Plain workspace. Returns user IDs and names — needed for thread assignment.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max users to return (default 50)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 50, 100)
        const query = `
          query ListUsers {
            users(first: ${limit}) {
              edges {
                node { id fullName email { email } isDeleted }
              }
              totalCount
            }
          }
        `
        return plainGql(creds.api_key, query)
      },
    },
    {
      slug: 'search_threads',
      name: 'Search Threads',
      description: 'Search Plain threads by a keyword across titles and customer details.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Search keyword or phrase' },
          limit: { type: 'number', description: 'Max results (default 20, max 50)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 50)
        const gql = `
          query SearchThreads {
            threads(first: ${limit}, filters: { searchQuery: "${(params.query as string).replace(/"/g, '\\"')}" }) {
              edges {
                node {
                  id title status priority
                  createdAt { iso8601 }
                  customer { id fullName email { email } }
                  labels { id name }
                }
              }
              totalCount
            }
          }
        `
        return plainGql(creds.api_key, gql)
      },
    },
    {
      slug: 'get_workspace',
      name: 'Get Workspace Info',
      description: 'Get information about the connected Plain workspace including name, ID, and plan details.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async (creds) => {
        const query = `
          query GetWorkspace {
            workspace {
              id
              name
              publicName
              createdAt { iso8601 }
            }
          }
        `
        return plainGql(creds.api_key, query)
      },
    },
  ],
}
