import * as crypto from 'crypto'
import type { ConnectorManifest, ActionResult } from '@/connectors/types'

function buildOAuth1Header(
  method: string, url: string,
  consumerKey: string, consumerSecret: string, token: string, tokenSecret: string
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomBytes(16).toString('hex')

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: timestamp,
    oauth_token: token,
    oauth_version: '1.0',
  }

  const sortedParams = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const baseString = [method.toUpperCase(), encodeURIComponent(url), encodeURIComponent(sortedParams)].join('&')
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`
  const signature = crypto.createHmac('sha256', signingKey).update(baseString).digest('base64')

  return 'OAuth realm="",' + Object.entries({ ...oauthParams, oauth_signature: signature })
    .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
    .join(',')
}

function nsUrl(accountId: string, path: string): string {
  const acct = accountId.toLowerCase().replace('_', '-')
  return `https://${acct}.suitetalk.api.netsuite.com/services/rest${path}`
}

async function nsFetch(creds: Record<string, string>, method: string, path: string, body?: unknown): Promise<ActionResult> {
  const url = nsUrl(creds.account_id, path)
  const auth = buildOAuth1Header(method, url, creds.consumer_key, creds.consumer_secret, creds.token_key, creds.token_secret)
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Prefer': 'transient',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `NetSuite ${res.status}: ${text}` }
  }
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('json')) return { ok: true, data: await res.json() }
  return { ok: true, data: { raw: await res.text() } }
}

async function nsSuiteQL(creds: Record<string, string>, query: string, limit = 20): Promise<ActionResult> {
  return nsFetch(creds, 'POST', '/query/v1/suiteql', { q: query.trim().replace(/\s+/g, ' '), limit, offset: 0 })
}

export const netsuiteManifest: ConnectorManifest = {
  slug: 'netsuite',
  name: 'NetSuite',
  category: 'Finance',
  description: 'ERP — run SuiteQL queries, retrieve financials, invoices, transactions, customers, vendors, purchase orders, sales orders, employees, and items.',
  logoUrl: '/logos/netsuite.svg',
  isSimulated: false,

  auth: {
    type: 'api_key',
    keyLabel: 'Account ID',
    keyPlaceholder: 'e.g. 1234567 or TSTDRV1234567',
    fields: [
      { key: 'account_id', label: 'Account ID', placeholder: '1234567 (from your NetSuite URL)', inputType: 'text' },
      { key: 'consumer_key', label: 'Consumer Key', placeholder: 'OAuth integration consumer key', inputType: 'password' },
      { key: 'consumer_secret', label: 'Consumer Secret', placeholder: 'OAuth integration consumer secret', inputType: 'password' },
      { key: 'token_key', label: 'Token ID', placeholder: 'Access token ID', inputType: 'password' },
      { key: 'token_secret', label: 'Token Secret', placeholder: 'Access token secret', inputType: 'password' },
    ],
    setupGuide: [
      {
        title: 'Enable Token-Based Authentication',
        description: 'In NetSuite: **Setup → Company → Enable Features → SuiteCloud → check Token-Based Authentication**. Save.',
      },
      {
        title: 'Create an Integration record',
        description:
          'Go to **Setup → Integration → Manage Integrations → New**. Enable Token-Based Authentication. ' +
          'Copy the **Consumer Key** and **Consumer Secret** shown once.',
      },
      {
        title: 'Generate an Access Token',
        description:
          'Go to **Setup → Users/Roles → Access Tokens → New**. Choose your integration and user, save. ' +
          'Copy the **Token ID** and **Token Secret** shown once.',
      },
      {
        title: 'Find your Account ID',
        description:
          'Your NetSuite Account ID is in the URL: **{accountId}.app.netsuite.com**. ' +
          'For sandbox: use the format **TSTDRV{accountId}**.',
      },
    ],
  },

  testConnection: async (creds) => {
    const res = await nsSuiteQL(creds, 'SELECT TOP 1 id FROM account', 1)
    if (!res.ok) return { ok: false, error: res.error }
    return { ok: true, label: `NetSuite ${creds.account_id} connected` }
  },

  actions: [
    {
      slug: 'run_suiteql',
      name: 'Run SuiteQL Query',
      description:
        'Run any SuiteQL query against NetSuite and return results. SuiteQL is SQL-like and works against NetSuite record types. ' +
        'Example: "SELECT id, tranid, entity, amount FROM transaction WHERE type = \'Invoice\' ORDER BY trandate DESC LIMIT 10".',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'SuiteQL query string' },
          limit: { type: 'number', description: 'Max rows (default 20, max 1000)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 1000)
        return nsSuiteQL(creds, params.query as string, limit)
      },
    },
    {
      slug: 'list_open_invoices',
      name: 'List Open Invoices',
      description: 'List outstanding customer invoices not yet fully paid. Returns invoice number, customer, amount, due date, and balance.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max invoices (default 20)' },
          customer_name: { type: 'string', description: 'Filter by customer name (optional)' },
          overdue_only: { type: 'boolean', description: 'Only return overdue invoices (optional)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
        const filters: string[] = ['t.type = \'Invoice\'', 't.status = \'CustInvc:A\'']
        if (params.customer_name) filters.push(`LOWER(entity.altname) LIKE LOWER('%${(params.customer_name as string).replace(/'/g, "''")}%')`)
        if (params.overdue_only) filters.push(`t.duedate < SYSDATE`)
        return nsSuiteQL(creds, `
          SELECT t.id, t.tranid, entity.altname AS customer, t.trandate, t.duedate,
                 t.foreigntotal AS amount, t.foreignamountpaid AS paid,
                 (t.foreigntotal - t.foreignamountpaid) AS balance, t.currency
          FROM transaction t JOIN entity ON entity.id = t.entity
          WHERE ${filters.join(' AND ')}
          ORDER BY t.duedate ASC LIMIT ${limit}
        `, limit)
      },
    },
    {
      slug: 'get_financial_summary',
      name: 'Get Financial Summary',
      description: 'Get a high-level financial summary: total revenue, open AR balance, and transaction counts for the current period.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          period_months: { type: 'number', description: 'Lookback in months (default 1 = current month)' },
        },
      },
      execute: async (creds, params) => {
        const months = (params.period_months as number | undefined) ?? 1
        const [revenue, ar] = await Promise.all([
          nsSuiteQL(creds, `SELECT SUM(t.foreigntotal) AS total_revenue, COUNT(*) AS invoice_count FROM transaction t WHERE t.type = 'Invoice' AND t.trandate >= ADD_MONTHS(SYSDATE, -${months})`, 1),
          nsSuiteQL(creds, `SELECT SUM(t.foreigntotal - t.foreignamountpaid) AS open_ar_balance, COUNT(*) AS open_invoices FROM transaction t WHERE t.type = 'Invoice' AND t.status = 'CustInvc:A'`, 1),
        ])
        return {
          ok: true,
          data: {
            revenue: (revenue.data as { items: unknown[] })?.items?.[0],
            accounts_receivable: (ar.data as { items: unknown[] })?.items?.[0],
            period_months: months,
          },
        }
      },
    },
    {
      slug: 'list_customers',
      name: 'List Customers',
      description: 'List NetSuite customer records. Optionally filter by name or company.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Search by customer name or company (optional)' },
          limit: { type: 'number', description: 'Max customers (default 20)' },
          include_inactive: { type: 'boolean', description: 'Include inactive customers (optional)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
        const conditions: string[] = ['e.type = \'CustJob\'']
        if (!params.include_inactive) conditions.push('e.isinactive = \'F\'')
        if (params.search) conditions.push(`LOWER(e.altname) LIKE LOWER('%${(params.search as string).replace(/'/g, "''")}%')`)
        return nsSuiteQL(creds, `
          SELECT e.id, e.altname AS name, e.email, e.phone, e.isinactive, e.datecreated
          FROM entity e
          WHERE ${conditions.join(' AND ')}
          ORDER BY e.altname ASC LIMIT ${limit}
        `, limit)
      },
    },
    {
      slug: 'get_customer',
      name: 'Get Customer',
      description: 'Get full details of a NetSuite customer by their internal ID, name, or email.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['identifier'],
        properties: {
          identifier: { type: 'string', description: 'Customer internal ID, name, or email address' },
        },
      },
      execute: async (creds, params) => {
        const val = (params.identifier as string).replace(/'/g, "''")
        const isNumeric = /^\d+$/.test(val)
        const condition = isNumeric
          ? `e.id = ${val}`
          : `LOWER(e.altname) LIKE LOWER('%${val}%') OR LOWER(e.email) = LOWER('${val}')`
        return nsSuiteQL(creds, `
          SELECT e.id, e.altname AS name, e.email, e.phone, e.address, e.datecreated, e.isinactive
          FROM entity e WHERE e.type = 'CustJob' AND (${condition}) LIMIT 1
        `, 1)
      },
    },
    {
      slug: 'list_vendors',
      name: 'List Vendors',
      description: 'List NetSuite vendor records. Optionally search by name.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Search by vendor name (optional)' },
          limit: { type: 'number', description: 'Max vendors (default 20)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
        const conditions: string[] = ['e.type = \'Vendor\'', 'e.isinactive = \'F\'']
        if (params.search) conditions.push(`LOWER(e.altname) LIKE LOWER('%${(params.search as string).replace(/'/g, "''")}%')`)
        return nsSuiteQL(creds, `
          SELECT e.id, e.altname AS name, e.email, e.phone, e.currency
          FROM entity e WHERE ${conditions.join(' AND ')}
          ORDER BY e.altname ASC LIMIT ${limit}
        `, limit)
      },
    },
    {
      slug: 'list_purchase_orders',
      name: 'List Purchase Orders',
      description: 'List NetSuite purchase orders. Filter by status: pendingBillPartially (A), pendingBill (B), fullyBilled (C), cancelled (H).',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by status: A=Pending Bill Partially, B=Pending Bill, C=Fully Billed, H=Cancelled' },
          vendor_name: { type: 'string', description: 'Filter by vendor name (optional)' },
          limit: { type: 'number', description: 'Max POs (default 20)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
        const conditions: string[] = ['t.type = \'PurchOrd\'']
        if (params.status) conditions.push(`t.status = 'PurchOrd:${params.status}'`)
        if (params.vendor_name) conditions.push(`LOWER(entity.altname) LIKE LOWER('%${(params.vendor_name as string).replace(/'/g, "''")}%')`)
        return nsSuiteQL(creds, `
          SELECT t.id, t.tranid AS po_number, entity.altname AS vendor, t.trandate,
                 t.foreigntotal AS amount, t.status, t.memo
          FROM transaction t JOIN entity ON entity.id = t.entity
          WHERE ${conditions.join(' AND ')}
          ORDER BY t.trandate DESC LIMIT ${limit}
        `, limit)
      },
    },
    {
      slug: 'list_sales_orders',
      name: 'List Sales Orders',
      description: 'List NetSuite sales orders. Filter by status: pendingApproval, pendingFulfillment, partiallyFulfilled, fullyBilled, cancelled.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by status code (e.g. A=Pending Approval, B=Pending Fulfillment, C=Cancelled)' },
          customer_name: { type: 'string', description: 'Filter by customer name (optional)' },
          limit: { type: 'number', description: 'Max sales orders (default 20)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
        const conditions: string[] = ['t.type = \'SalesOrd\'']
        if (params.status) conditions.push(`t.status = 'SalesOrd:${params.status}'`)
        if (params.customer_name) conditions.push(`LOWER(entity.altname) LIKE LOWER('%${(params.customer_name as string).replace(/'/g, "''")}%')`)
        return nsSuiteQL(creds, `
          SELECT t.id, t.tranid AS so_number, entity.altname AS customer, t.trandate,
                 t.foreigntotal AS amount, t.status, t.shippingaddress
          FROM transaction t JOIN entity ON entity.id = t.entity
          WHERE ${conditions.join(' AND ')}
          ORDER BY t.trandate DESC LIMIT ${limit}
        `, limit)
      },
    },
    {
      slug: 'get_transaction',
      name: 'Get Transaction',
      description: 'Get a specific NetSuite transaction by its internal ID or transaction number (tranid like INV-1234 or SO-5678).',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['identifier'],
        properties: {
          identifier: { type: 'string', description: 'Transaction internal ID (numeric) or number (e.g. INV-1234)' },
        },
      },
      execute: async (creds, params) => {
        const val = (params.identifier as string).replace(/'/g, "''")
        const isNumeric = /^\d+$/.test(val)
        const condition = isNumeric ? `t.id = ${val}` : `LOWER(t.tranid) = LOWER('${val}')`
        return nsSuiteQL(creds, `
          SELECT t.id, t.tranid, t.type, entity.altname AS entity_name, t.trandate,
                 t.foreigntotal AS amount, t.status, t.memo, t.currency
          FROM transaction t JOIN entity ON entity.id = t.entity
          WHERE ${condition} LIMIT 1
        `, 1)
      },
    },
    {
      slug: 'list_employees',
      name: 'List Employees',
      description: 'List NetSuite employee records. Optionally filter by name or department.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Search by employee name or email (optional)' },
          department: { type: 'string', description: 'Filter by department name (optional)' },
          limit: { type: 'number', description: 'Max employees (default 20)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
        const conditions: string[] = ['e.type = \'Employee\'', 'e.isinactive = \'F\'']
        if (params.search) conditions.push(`(LOWER(e.altname) LIKE LOWER('%${(params.search as string).replace(/'/g, "''")}%') OR LOWER(e.email) LIKE LOWER('%${(params.search as string).replace(/'/g, "''")}%'))`)
        return nsSuiteQL(creds, `
          SELECT e.id, e.altname AS name, e.email, e.title, e.phone
          FROM entity e
          WHERE ${conditions.join(' AND ')}
          ORDER BY e.altname ASC LIMIT ${limit}
        `, limit)
      },
    },
    {
      slug: 'list_items',
      name: 'List Items',
      description: 'List NetSuite inventory/service items. Filter by type: InvtPart, NonInvtPart, SvcResaleItem, Service.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Search by item name or description (optional)' },
          item_type: { type: 'string', description: 'Filter by type: InvtPart, NonInvtPart, Service (optional)' },
          limit: { type: 'number', description: 'Max items (default 20)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
        const conditions: string[] = ['i.isinactive = \'F\'']
        if (params.item_type) conditions.push(`i.itemtype = '${params.item_type}'`)
        if (params.search) conditions.push(`(LOWER(i.itemid) LIKE LOWER('%${(params.search as string).replace(/'/g, "''")}%') OR LOWER(i.displayname) LIKE LOWER('%${(params.search as string).replace(/'/g, "''")}%'))`)
        return nsSuiteQL(creds, `
          SELECT i.id, i.itemid AS item_number, i.displayname AS name, i.itemtype,
                 i.salesprice AS price, i.quantityonhand AS qty_on_hand
          FROM item i
          WHERE ${conditions.join(' AND ')}
          ORDER BY i.itemid ASC LIMIT ${limit}
        `, limit)
      },
    },
    {
      slug: 'get_account_balance',
      name: 'Get Account Balance',
      description: 'Get the current balance of a specific NetSuite GL account by its account number or ID.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['account_identifier'],
        properties: {
          account_identifier: { type: 'string', description: 'GL account number (e.g. 1000) or account name' },
        },
      },
      execute: async (creds, params) => {
        const val = (params.account_identifier as string).replace(/'/g, "''")
        const isNumeric = /^\d+$/.test(val)
        const condition = isNumeric
          ? `a.acctnumber = '${val}' OR a.id = ${val}`
          : `LOWER(a.fullname) LIKE LOWER('%${val}%') OR LOWER(a.acctnumber) = LOWER('${val}')`
        return nsSuiteQL(creds, `
          SELECT a.id, a.acctnumber, a.fullname AS account_name, a.type, a.currency
          FROM account a
          WHERE (${condition}) AND a.isinactive = 'F'
          LIMIT 5
        `, 5)
      },
    },
    {
      slug: 'list_journal_entries',
      name: 'List Journal Entries',
      description: 'List NetSuite general journal entries. Filter by date range or memo.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'Filter from date (YYYY-MM-DD, optional)' },
          end_date: { type: 'string', description: 'Filter to date (YYYY-MM-DD, optional)' },
          memo_search: { type: 'string', description: 'Search by memo text (optional)' },
          limit: { type: 'number', description: 'Max journal entries (default 20)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
        const conditions: string[] = ['t.type = \'Journal\'']
        if (params.start_date) conditions.push(`t.trandate >= TO_DATE('${params.start_date}', 'YYYY-MM-DD')`)
        if (params.end_date) conditions.push(`t.trandate <= TO_DATE('${params.end_date}', 'YYYY-MM-DD')`)
        if (params.memo_search) conditions.push(`LOWER(t.memo) LIKE LOWER('%${(params.memo_search as string).replace(/'/g, "''")}%')`)
        return nsSuiteQL(creds, `
          SELECT t.id, t.tranid, t.trandate, t.memo, t.foreigntotal AS total, t.currency
          FROM transaction t
          WHERE ${conditions.join(' AND ')}
          ORDER BY t.trandate DESC LIMIT ${limit}
        `, limit)
      },
    },
    {
      slug: 'list_expense_reports',
      name: 'List Expense Reports',
      description: 'List NetSuite employee expense reports. Filter by status: pendingApproval, approved, rejected.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by status: A=Pending Approval, B=Approved, C=Rejected, D=Pending Payment' },
          employee_name: { type: 'string', description: 'Filter by employee name (optional)' },
          limit: { type: 'number', description: 'Max expense reports (default 20)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
        const conditions: string[] = ['t.type = \'ExpRept\'']
        if (params.status) conditions.push(`t.status = 'ExpRept:${params.status}'`)
        if (params.employee_name) conditions.push(`LOWER(entity.altname) LIKE LOWER('%${(params.employee_name as string).replace(/'/g, "''")}%')`)
        return nsSuiteQL(creds, `
          SELECT t.id, t.tranid, entity.altname AS employee, t.trandate,
                 t.foreigntotal AS amount, t.status, t.memo
          FROM transaction t JOIN entity ON entity.id = t.entity
          WHERE ${conditions.join(' AND ')}
          ORDER BY t.trandate DESC LIMIT ${limit}
        `, limit)
      },
    },
    {
      slug: 'get_record',
      name: 'Get Record by Type and ID',
      description:
        'Retrieve any NetSuite record by its REST record type and internal ID. ' +
        'recordType examples: customer, vendor, employee, invoice, purchaseorder, salesorder, item.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['record_type', 'record_id'],
        properties: {
          record_type: { type: 'string', description: 'NetSuite REST record type (e.g. customer, vendor, invoice, item)' },
          record_id: { type: 'string', description: 'Internal record ID (numeric)' },
          fields: { type: 'string', description: 'Comma-separated field names to return (optional)' },
        },
      },
      execute: async (creds, params) => {
        const qs = params.fields ? `?fields=${encodeURIComponent(params.fields as string)}` : ''
        return nsFetch(creds, 'GET', `/record/v1/${params.record_type as string}/${params.record_id as string}${qs}`)
      },
    },
  ],
}
