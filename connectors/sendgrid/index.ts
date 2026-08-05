import type { ConnectorManifest, ActionResult } from '@/connectors/types'

const SG_BASE = 'https://api.sendgrid.com/v3'

async function sgPost(apiKey: string, path: string, body: unknown): Promise<ActionResult> {
  const res = await fetch(`${SG_BASE}${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 202 || res.status === 200 || res.status === 201) {
    const text = await res.text()
    try { return { ok: true, data: JSON.parse(text) } } catch { return { ok: true, data: { status: 'success' } } }
  }
  const text = await res.text().catch(() => res.statusText)
  return { ok: false, error: `SendGrid ${res.status}: ${text}` }
}

async function sgGet(apiKey: string, path: string): Promise<ActionResult> {
  const res = await fetch(`${SG_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `SendGrid ${res.status}: ${text}` }
  }
  return { ok: true, data: await res.json() }
}

async function sgDelete(apiKey: string, path: string, body?: unknown): Promise<ActionResult> {
  const res = await fetch(`${SG_BASE}${path}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (res.status === 204 || res.status === 200) return { ok: true, data: { status: 'deleted' } }
  const text = await res.text().catch(() => res.statusText)
  return { ok: false, error: `SendGrid ${res.status}: ${text}` }
}

export const sendgridManifest: ConnectorManifest = {
  slug: 'sendgrid',
  name: 'SendGrid',
  category: 'Communication',
  description: 'Send transactional, templated, and bulk emails, manage contact lists, retrieve stats, and handle suppressions via the SendGrid API.',
  logoUrl: '/logos/sendgrid.svg',
  isSimulated: false,

  auth: {
    type: 'api_key',
    keyLabel: 'API Key',
    keyPlaceholder: 'SG.xxxxxxxxxxxxxxxxxxxxxx',
    keyHint: 'In SendGrid: Settings → API Keys → Create API key. For full access use "Full Access"; for mail only use "Restricted Access" with Mail Send enabled.',
    setupGuide: [
      {
        title: 'Create an API key in SendGrid',
        description:
          'Log into **app.sendgrid.com**, go to **Settings → API Keys → Create API Key**. ' +
          'Choose "Full Access" or "Restricted Access" with the permissions you need.',
      },
      {
        title: 'Verify your sender identity',
        description:
          'Before sending, verify your "from" email in **Settings → Sender Authentication**. ' +
          'Domain authentication is recommended for production deliverability.',
      },
    ],
  },

  testConnection: async (creds) => {
    const res = await fetch(`${SG_BASE}/user/profile`, {
      headers: { 'Authorization': `Bearer ${creds.api_key}` },
    })
    if (!res.ok) return { ok: false, error: 'Invalid SendGrid API key' }
    const data = await res.json()
    return { ok: true, label: `SendGrid: ${data.email ?? 'verified'}` }
  },

  network: { hosts: ['api.sendgrid.com'] },

  actions: [
    {
      slug: 'send_email',
      name: 'Send Email',
      description:
        'Send an email via SendGrid. The from address must be a verified sender in your SendGrid account. ' +
        'Supports both plain text and HTML body.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['to', 'from', 'subject', 'body'],
        properties: {
          to: { type: 'string', description: 'Recipient email address (or comma-separated for multiple)' },
          from: { type: 'string', description: 'Verified sender email address' },
          subject: { type: 'string', description: 'Email subject line' },
          body: { type: 'string', description: 'Email body (plain text)' },
          html_body: { type: 'string', description: 'HTML email body (optional, renders for HTML clients)' },
          reply_to: { type: 'string', description: 'Reply-to email address (optional)' },
          cc: { type: 'string', description: 'CC email addresses (comma-separated, optional)' },
        },
      },
      execute: async (creds, params) => {
        const toAddresses = (params.to as string).split(',').map(e => ({ email: e.trim() }))
        const payload: Record<string, unknown> = {
          personalizations: [{ to: toAddresses }],
          from: { email: params.from },
          subject: params.subject,
          content: [
            ...(params.html_body ? [{ type: 'text/html', value: params.html_body }] : []),
            { type: 'text/plain', value: params.body },
          ],
        }
        if (params.reply_to) payload.reply_to = { email: params.reply_to }
        if (params.cc) {
          const ccs = (params.cc as string).split(',').map(e => ({ email: e.trim() }))
          payload.personalizations = [{ to: toAddresses, cc: ccs }]
        }
        return sgPost(creds.api_key, '/mail/send', payload)
      },
    },
    {
      slug: 'send_alert_email',
      name: 'Send Alert Email',
      description:
        'Send a pre-formatted HTML alert email with a coloured header. ' +
        'level must be: info, warning, or critical.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['to', 'from', 'title', 'body', 'level'],
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          from: { type: 'string', description: 'Verified sender email address' },
          title: { type: 'string', description: 'Alert title' },
          body: { type: 'string', description: 'Alert body text' },
          level: { type: 'string', enum: ['info', 'warning', 'critical'], description: 'Alert severity' },
        },
      },
      execute: async (creds, params) => {
        const colors = { info: '#1a82e2', warning: '#f59e0b', critical: '#dc2626' }
        const color = colors[(params.level as keyof typeof colors)] ?? colors.info
        const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:${color};color:white;padding:16px 24px;border-radius:8px 8px 0 0">
    <strong style="font-size:16px">${params.title}</strong>
    <span style="opacity:0.7;font-size:12px;margin-left:8px;text-transform:uppercase">${params.level}</span>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    <p style="margin:0;color:#374151;line-height:1.6">${(params.body as string).replace(/\n/g, '<br/>')}</p>
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af">Sent by OrbitAPI at ${new Date().toUTCString()}</p>
  </div>
</div>`
        return sgPost(creds.api_key, '/mail/send', {
          personalizations: [{ to: [{ email: params.to }] }],
          from: { email: params.from },
          subject: `[${(params.level as string).toUpperCase()}] ${params.title}`,
          content: [
            { type: 'text/html', value: html },
            { type: 'text/plain', value: `[${(params.level as string).toUpperCase()}] ${params.title}\n\n${params.body}` },
          ],
        })
      },
    },
    {
      slug: 'send_templated_email',
      name: 'Send Templated Email',
      description:
        'Send an email using a SendGrid Dynamic Template. ' +
        'template_id is the ID from your SendGrid Templates dashboard (starts with d-). ' +
        'dynamic_data is a JSON object of template variables.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['to', 'from', 'template_id'],
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          from: { type: 'string', description: 'Verified sender email address' },
          template_id: { type: 'string', description: 'SendGrid dynamic template ID (starts with d-)' },
          dynamic_data: { type: 'string', description: 'JSON object of template variables (e.g. {"name":"John","order_id":"12345"})' },
          subject: { type: 'string', description: 'Email subject (overrides template subject, optional)' },
        },
      },
      execute: async (creds, params) => {
        let templateData: Record<string, unknown> = {}
        try { templateData = JSON.parse(params.dynamic_data as string) } catch { templateData = {} }
        const payload: Record<string, unknown> = {
          personalizations: [{ to: [{ email: params.to }], dynamic_template_data: templateData }],
          from: { email: params.from },
          template_id: params.template_id,
        }
        if (params.subject) payload.subject = params.subject
        return sgPost(creds.api_key, '/mail/send', payload)
      },
    },
    {
      slug: 'list_templates',
      name: 'List Email Templates',
      description: 'List SendGrid Dynamic Email Templates in your account. Returns template ID, name, and generation type.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          page_size: { type: 'number', description: 'Max templates to return (default 10, max 200)' },
        },
      },
      execute: async (creds, params) => {
        const size = Math.min((params.page_size as number | undefined) ?? 10, 200)
        return sgGet(creds.api_key, `/templates?generations=dynamic&page_size=${size}`)
      },
    },
    {
      slug: 'get_email_stats',
      name: 'Get Email Stats',
      description:
        'Retrieve SendGrid email delivery statistics for a date range. ' +
        'Returns delivered, opens, clicks, bounces, spam reports, and unsubscribes. ' +
        'start_date format: YYYY-MM-DD.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['start_date'],
        properties: {
          start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          end_date: { type: 'string', description: 'End date (YYYY-MM-DD, default: today)' },
          aggregated_by: { type: 'string', description: 'Aggregate by: day, week, month (default: day)' },
        },
      },
      execute: async (creds, params) => {
        const qs: string[] = [`start_date=${params.start_date}`]
        if (params.end_date) qs.push(`end_date=${params.end_date}`)
        if (params.aggregated_by) qs.push(`aggregated_by=${params.aggregated_by}`)
        return sgGet(creds.api_key, `/stats?${qs.join('&')}`)
      },
    },
    {
      slug: 'list_contacts',
      name: 'List Contacts',
      description: 'List contacts in your SendGrid Marketing Contacts database. Returns email, first/last name, and custom fields.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          page_size: { type: 'number', description: 'Max contacts per page (default 50, max 1000)' },
          page_token: { type: 'string', description: 'Pagination token from previous response (optional)' },
        },
      },
      execute: async (creds, params) => {
        const size = Math.min((params.page_size as number | undefined) ?? 50, 1000)
        const qs: string[] = [`page_size=${size}`]
        if (params.page_token) qs.push(`page_token=${params.page_token}`)
        return sgGet(creds.api_key, `/marketing/contacts?${qs.join('&')}`)
      },
    },
    {
      slug: 'add_contacts',
      name: 'Add / Update Contacts',
      description:
        'Add or update contacts in SendGrid Marketing. ' +
        'contacts is a JSON array of contact objects, each with at minimum an "email" field. ' +
        'Optional: first_name, last_name, phone_number, list_ids (array).',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['contacts'],
        properties: {
          contacts: { type: 'string', description: 'JSON array of contact objects (e.g. [{"email":"user@example.com","first_name":"Jane"}])' },
          list_ids: { type: 'string', description: 'Comma-separated list IDs to add contacts to (optional)' },
        },
      },
      execute: async (creds, params) => {
        let contacts: unknown[]
        try { contacts = JSON.parse(params.contacts as string) } catch { return { ok: false, error: 'Invalid JSON in contacts field' } }
        const payload: Record<string, unknown> = { contacts }
        if (params.list_ids) payload.list_ids = (params.list_ids as string).split(',').map(id => id.trim())
        return sgPost(creds.api_key, '/marketing/contacts', payload)
      },
    },
    {
      slug: 'list_contact_lists',
      name: 'List Contact Lists',
      description: 'List all SendGrid Marketing contact lists. Returns list ID, name, and contact count.',
      risk: 'read',
      inputSchema: { type: 'object', properties: {} },
      execute: async (creds) => {
        return sgGet(creds.api_key, '/marketing/lists?page_size=100')
      },
    },
    {
      slug: 'create_contact_list',
      name: 'Create Contact List',
      description: 'Create a new SendGrid Marketing contact list.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', description: 'Name for the new contact list' },
        },
      },
      execute: async (creds, params) => {
        return sgPost(creds.api_key, '/marketing/lists', { name: params.name })
      },
    },
    {
      slug: 'validate_email',
      name: 'Validate Email Address',
      description:
        'Use SendGrid Email Validation API to check if an email address is valid, formatted correctly, and likely deliverable. ' +
        'Requires Email Validation API access (paid feature).',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', description: 'Email address to validate' },
        },
      },
      execute: async (creds, params) => {
        return sgPost(creds.api_key, '/validations/email', { email: params.email, source: 'OrbitAPI' })
      },
    },
    {
      slug: 'list_bounces',
      name: 'List Bounced Emails',
      description: 'List email addresses that have bounced. Returns email, reason, and status.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max results (default 25, max 500)' },
          start_time: { type: 'number', description: 'Unix timestamp to filter from (optional)' },
          end_time: { type: 'number', description: 'Unix timestamp to filter to (optional)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 500)
        const qs: string[] = [`limit=${limit}`]
        if (params.start_time) qs.push(`start_time=${params.start_time}`)
        if (params.end_time) qs.push(`end_time=${params.end_time}`)
        return sgGet(creds.api_key, `/suppression/bounces?${qs.join('&')}`)
      },
    },
    {
      slug: 'delete_bounce',
      name: 'Delete Bounce Record',
      description:
        'Remove an email address from the SendGrid bounce list, allowing future sends to that address. ' +
        'Provide a specific email, or set delete_all=true to clear all bounces.',
      risk: 'destructive',
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Specific email address to remove from bounce list (optional)' },
          delete_all: { type: 'boolean', description: 'Set true to delete ALL bounce records (use with caution)' },
        },
      },
      execute: async (creds, params) => {
        if (params.delete_all) {
          return sgDelete(creds.api_key, '/suppression/bounces', { delete_all: true })
        }
        if (!params.email) return { ok: false, error: 'Either email or delete_all must be provided' }
        return sgDelete(creds.api_key, `/suppression/bounces/${encodeURIComponent(params.email as string)}`)
      },
    },
    {
      slug: 'list_unsubscribes',
      name: 'List Unsubscribes',
      description: 'List email addresses that have globally unsubscribed from your SendGrid emails.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max results (default 25, max 500)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 500)
        return sgGet(creds.api_key, `/suppression/unsubscribes?limit=${limit}`)
      },
    },
    {
      slug: 'add_to_suppression',
      name: 'Add to Global Suppression',
      description: 'Add an email address to the global unsubscribe list, preventing all future emails to that address.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', description: 'Email address to suppress' },
        },
      },
      execute: async (creds, params) => {
        return sgPost(creds.api_key, '/asm/suppressions/global', {
          recipient_emails: [params.email],
        })
      },
    },
    {
      slug: 'list_spam_reports',
      name: 'List Spam Reports',
      description: 'List emails that recipients have marked as spam in your SendGrid account.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max results (default 25, max 500)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 500)
        return sgGet(creds.api_key, `/suppression/spam_reports?limit=${limit}`)
      },
    },
    {
      slug: 'schedule_send',
      name: 'Schedule Email Send',
      description:
        'Schedule a Single Send (marketing email blast) to a contact list at a future time. ' +
        'send_at must be an ISO 8601 UTC datetime. list_ids is a comma-separated list of contact list IDs.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['name', 'template_id', 'sender_id', 'list_ids', 'send_at'],
        properties: {
          name: { type: 'string', description: 'Internal name for this send (not shown to recipients)' },
          template_id: { type: 'string', description: 'Dynamic template ID (starts with d-)' },
          sender_id: { type: 'number', description: 'SendGrid sender identity ID (from Settings → Sender Authentication)' },
          list_ids: { type: 'string', description: 'Comma-separated contact list IDs to send to' },
          send_at: { type: 'string', description: 'ISO 8601 UTC send time (e.g. 2024-12-31T10:00:00Z)' },
        },
      },
      execute: async (creds, params) => {
        return sgPost(creds.api_key, '/marketing/singlesends', {
          name: params.name,
          send_to: {
            list_ids: (params.list_ids as string).split(',').map(id => id.trim()),
          },
          email_config: {
            template_id: params.template_id,
            sender_id: params.sender_id,
          },
          send_at: params.send_at,
        })
      },
    },
  ],
}
