// connectors/quickbooks-online/index.ts
import type { ConnectorManifest, ActionResult } from '@/connectors/types'

// QuickBooks Online Accounting API.
// Docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account
// Auth: OAuth 2.0 (authorization code grant). Requests require a realmId (company ID)
// which is returned alongside tokens at the end of the OAuth flow and stored in creds.
const QBO_BASE = 'https://quickbooks.api.intuit.com/v3/company'
const MINOR_VERSION = '75'

function buildUrl(realmId: string, path: string, query: Record<string, string> = {}): string {
  const url = new URL(`${QBO_BASE}/${realmId}${path}`)
  url.searchParams.set('minorversion', MINOR_VERSION)
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  return url.toString()
}

async function qboFetch(
  creds: Record<string, string>,
  path: string,
  options: RequestInit = {},
  query: Record<string, string> = {},
): Promise<ActionResult> {
  if (!creds.accessToken) return { ok: false, error: 'Missing QuickBooks access token' }
  if (!creds.realmId) return { ok: false, error: 'Missing QuickBooks company (realm) ID' }
  const url = buildUrl(creds.realmId, path, query)
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    return { ok: false, error: `QuickBooks ${res.status}: ${await res.text().catch(() => res.statusText)}` }
  }
  return { ok: true, data: await res.json() }
}

// Helper to run a QBO SQL-like query against the /query endpoint.
async function qboQuery(creds: Record<string, string>, query: string): Promise<ActionResult> {
  return qboFetch(creds, '/query', { method: 'GET' }, { query })
}

export const quickbooksOnlineManifest: ConnectorManifest = {
  slug: 'quickbooks-online',
  name: 'QuickBooks Online',
  category: 'Finance',
  description: 'Accounting on QuickBooks Online — invoices, customers, payments, bills, and reports.',
  logoUrl: '/logos/quickbooks-online.svg',
  isSimulated: false,
  auth: {
    type: 'api_key',
    keyLabel: 'OAuth Access Token',
    keyPlaceholder: 'Your QuickBooks OAuth 2.0 access token',
    fields: [
      { key: 'accessToken', label: 'Access Token', placeholder: 'OAuth 2.0 access token', inputType: 'password' },
      { key: 'realmId', label: 'Company (Realm) ID', placeholder: 'e.g. 4620816365212345678', inputType: 'text' },
    ],
    setupGuide: [
      { title: 'Create an app', description: 'Go to the **Intuit Developer Portal** (developer.intuit.com) → My Apps → create an app with the **com.intuit.quickbooks.accounting** scope.' },
      { title: 'Run the OAuth 2.0 flow', description: 'Use the authorization code grant to obtain an **access token**. Intuit returns the **realmId** (company ID) on the redirect callback.' },
      { title: 'Copy credentials', description: 'Paste the **access token** and **realmId** here. Access tokens expire after ~1 hour — refresh them via your stored refresh token.' },
    ],
  },
  testConnection: async (creds) => {
    const res = await qboFetch(creds, '/companyinfo/' + creds.realmId)
    if (!res.ok) return { ok: false, error: res.error }
    const name = (res.data as { CompanyInfo?: { CompanyName?: string } })?.CompanyInfo?.CompanyName
    return { ok: true, label: name ? `QuickBooks: ${name}` : `QuickBooks company ${creds.realmId}` }
  },
  network: { hosts: ['quickbooks.api.intuit.com', 'oauth.platform.intuit.com'] },

  actions: [
    {
      slug: 'list_invoices',
      name: 'List Invoices',
      description: 'List invoices, optionally filtered by customer ID. limit defaults to 25 (max 1000).',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          customerId: { type: 'string', description: 'Filter invoices by customer ID' },
          limit: { type: 'number', description: 'Max results (default 25, max 1000)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 1000)
        const where = params.customerId ? ` WHERE CustomerRef = '${params.customerId}'` : ''
        return qboQuery(creds, `SELECT * FROM Invoice${where} MAXRESULTS ${limit}`)
      },
    },
    {
      slug: 'get_invoice',
      name: 'Get Invoice',
      description: 'Retrieve a single invoice by its QuickBooks ID.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: { invoiceId: { type: 'string', description: 'The invoice ID' } },
        required: ['invoiceId'],
      },
      execute: async (creds, params) => {
        return qboFetch(creds, `/invoice/${encodeURIComponent(params.invoiceId as string)}`)
      },
    },
    {
      slug: 'list_customers',
      name: 'List Customers',
      description: 'List customers, optionally searching by display name. limit defaults to 25 (max 1000).',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          nameContains: { type: 'string', description: 'Filter where display name contains this text' },
          limit: { type: 'number', description: 'Max results (default 25, max 1000)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 1000)
        const where = params.nameContains
          ? ` WHERE DisplayName LIKE '%${(params.nameContains as string).replace(/'/g, "\\'")}%'`
          : ''
        return qboQuery(creds, `SELECT * FROM Customer${where} MAXRESULTS ${limit}`)
      },
    },
    {
      slug: 'create_customer',
      name: 'Create Customer',
      description: 'Create a new customer. DisplayName is required and must be unique.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        properties: {
          displayName: { type: 'string', description: 'Unique display name for the customer' },
          email: { type: 'string', description: 'Primary email address' },
          companyName: { type: 'string', description: 'Company name' },
          phone: { type: 'string', description: 'Primary phone number' },
        },
        required: ['displayName'],
      },
      execute: async (creds, params) => {
        const body: Record<string, unknown> = { DisplayName: params.displayName }
        if (params.email) body.PrimaryEmailAddr = { Address: params.email }
        if (params.companyName) body.CompanyName = params.companyName
        if (params.phone) body.PrimaryPhone = { FreeFormNumber: params.phone }
        return qboFetch(creds, '/customer', { method: 'POST', body: JSON.stringify(body) })
      },
    },
    {
      slug: 'create_invoice',
      name: 'Create Invoice',
      description: 'Create an invoice for a customer with one line item referencing an income/service item.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        properties: {
          customerId: { type: 'string', description: 'The customer (CustomerRef) ID to bill' },
          itemId: { type: 'string', description: 'The item (ItemRef) ID for the line' },
          amount: { type: 'number', description: 'Line amount in the company currency' },
          quantity: { type: 'number', description: 'Quantity (default 1)' },
          description: { type: 'string', description: 'Line description' },
        },
        required: ['customerId', 'itemId', 'amount'],
      },
      execute: async (creds, params) => {
        const qty = (params.quantity as number | undefined) ?? 1
        const amount = params.amount as number
        const body = {
          CustomerRef: { value: params.customerId },
          Line: [
            {
              DetailType: 'SalesItemLineDetail',
              Amount: amount,
              Description: (params.description as string | undefined) ?? undefined,
              SalesItemLineDetail: {
                ItemRef: { value: params.itemId },
                Qty: qty,
                UnitPrice: amount / qty,
              },
            },
          ],
        }
        return qboFetch(creds, '/invoice', { method: 'POST', body: JSON.stringify(body) })
      },
    },
    {
      slug: 'record_payment',
      name: 'Record Payment',
      description: 'Record a customer payment, optionally linked to a specific invoice.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        properties: {
          customerId: { type: 'string', description: 'The customer (CustomerRef) ID' },
          amount: { type: 'number', description: 'Total payment amount' },
          invoiceId: { type: 'string', description: 'Optional invoice ID to apply the payment against' },
        },
        required: ['customerId', 'amount'],
      },
      execute: async (creds, params) => {
        const body: Record<string, unknown> = {
          CustomerRef: { value: params.customerId },
          TotalAmt: params.amount,
        }
        if (params.invoiceId) {
          body.Line = [
            {
              Amount: params.amount,
              LinkedTxn: [{ TxnId: params.invoiceId, TxnType: 'Invoice' }],
            },
          ]
        }
        return qboFetch(creds, '/payment', { method: 'POST', body: JSON.stringify(body) })
      },
    },
    {
      slug: 'list_bills',
      name: 'List Bills',
      description: 'List vendor bills (accounts payable). limit defaults to 25 (max 1000).',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          vendorId: { type: 'string', description: 'Filter bills by vendor ID' },
          limit: { type: 'number', description: 'Max results (default 25, max 1000)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 25, 1000)
        const where = params.vendorId ? ` WHERE VendorRef = '${params.vendorId}'` : ''
        return qboQuery(creds, `SELECT * FROM Bill${where} MAXRESULTS ${limit}`)
      },
    },
    {
      slug: 'get_profit_and_loss',
      name: 'Get Profit & Loss Report',
      description: 'Run the Profit and Loss report for a date range (YYYY-MM-DD).',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date YYYY-MM-DD' },
          endDate: { type: 'string', description: 'End date YYYY-MM-DD' },
        },
        required: ['startDate', 'endDate'],
      },
      execute: async (creds, params) => {
        return qboFetch(
          creds,
          '/reports/ProfitAndLoss',
          { method: 'GET' },
          { start_date: params.startDate as string, end_date: params.endDate as string },
        )
      },
    },
  ],
}
