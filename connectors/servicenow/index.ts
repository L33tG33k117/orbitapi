import type { ConnectorManifest, ActionResult } from '@/connectors/types'

async function snFetch(instance: string, username: string, password: string, path: string, options: RequestInit = {}): Promise<ActionResult> {
  const url = `https://${instance}.service-now.com/api/now${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, error: `ServiceNow ${res.status}: ${text}` }
  }
  return { ok: true, data: await res.json() }
}

export const servicenowManifest: ConnectorManifest = {
  slug: 'servicenow',
  name: 'ServiceNow',
  category: 'Incident Management',
  description: 'ITSM — create, update, and query incidents, problems, change requests, CMDB records, and catalog items.',
  logoUrl: '/logos/servicenow.svg',
  isSimulated: false,

  auth: {
    type: 'api_key',
    keyLabel: 'Instance Name',
    keyPlaceholder: 'your-instance',
    fields: [
      { key: 'instance', label: 'Instance Name', placeholder: 'e.g. dev123456 (from dev123456.service-now.com)', inputType: 'text' },
      { key: 'username', label: 'Username', placeholder: 'API user or admin username', inputType: 'text' },
      { key: 'password', label: 'Password', placeholder: 'Password for the above user', inputType: 'password' },
    ],
    setupGuide: [
      {
        title: 'Find your instance name',
        description:
          'Your ServiceNow URL is **{instance}.service-now.com**. The instance name is the prefix, e.g. **dev123456**.',
      },
      {
        title: 'Create an API user (recommended)',
        description:
          'Create a dedicated user in ServiceNow with **itil** role for reading incidents/CIs, ' +
          'and **admin** or **incident_manager** for creating/updating.',
      },
    ],
  },

  testConnection: async (creds) => {
    const res = await snFetch(creds.instance, creds.username, creds.password, '/table/incident?sysparm_limit=1')
    if (!res.ok) return { ok: false, error: res.error }
    return { ok: true, label: `ServiceNow ${creds.instance}.service-now.com` }
  },

  actions: [
    {
      slug: 'list_incidents',
      name: 'List Incidents',
      description:
        'List ServiceNow incidents. Filter by state: 1=New, 2=In Progress, 3=On Hold, 6=Resolved, 7=Closed. ' +
        'priority: 1=Critical, 2=High, 3=Medium, 4=Low. limit defaults to 10.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          state: { type: 'string', description: 'State code: 1=New, 2=In Progress, 6=Resolved, 7=Closed' },
          priority: { type: 'string', description: 'Priority: 1=Critical, 2=High, 3=Medium, 4=Low' },
          limit: { type: 'number', description: 'Max incidents (default 10, max 50)' },
          search: { type: 'string', description: 'Search term to filter by short_description (optional)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 10, 50)
        const filters: string[] = []
        if (params.state) filters.push(`state=${params.state}`)
        if (params.priority) filters.push(`priority=${params.priority}`)
        if (params.search) filters.push(`short_descriptionLIKE${params.search}`)
        const qs = `sysparm_limit=${limit}&sysparm_fields=number,short_description,state,priority,assigned_to,opened_at,sys_id,category${filters.length ? `&sysparm_query=${filters.join('^')}` : ''}&sysparm_order_direction=desc&sysparm_order_by=opened_at`
        return snFetch(creds.instance, creds.username, creds.password, `/table/incident?${qs}`)
      },
    },
    {
      slug: 'get_incident',
      name: 'Get Incident',
      description: 'Get a single ServiceNow incident by its INC number (e.g. INC0010001) or sys_id.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['number_or_sysid'],
        properties: {
          number_or_sysid: { type: 'string', description: 'Incident number (INC0010001) or sys_id' },
        },
      },
      execute: async (creds, params) => {
        const val = params.number_or_sysid as string
        if (val.toUpperCase().startsWith('INC')) {
          return snFetch(creds.instance, creds.username, creds.password, `/table/incident?sysparm_query=number=${val}&sysparm_limit=1`)
        }
        return snFetch(creds.instance, creds.username, creds.password, `/table/incident/${val}`)
      },
    },
    {
      slug: 'create_incident',
      name: 'Create Incident',
      description:
        'Create a new ServiceNow incident. priority: 1=Critical, 2=High, 3=Medium, 4=Low. ' +
        'impact: 1=High, 2=Medium, 3=Low. urgency: 1=High, 2=Medium, 3=Low.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['short_description'],
        properties: {
          short_description: { type: 'string', description: 'Brief incident description' },
          description: { type: 'string', description: 'Detailed description (optional)' },
          priority: { type: 'string', enum: ['1', '2', '3', '4'], description: '1=Critical, 2=High, 3=Medium, 4=Low' },
          impact: { type: 'string', enum: ['1', '2', '3'], description: '1=High, 2=Medium, 3=Low' },
          urgency: { type: 'string', enum: ['1', '2', '3'], description: '1=High, 2=Medium, 3=Low' },
          category: { type: 'string', description: 'Category e.g. Hardware, Software, Network' },
          caller_id: { type: 'string', description: 'Username of the caller/reporter (optional)' },
          assignment_group: { type: 'string', description: 'Assignment group name (optional)' },
        },
      },
      execute: async (creds, params) => {
        return snFetch(creds.instance, creds.username, creds.password, '/table/incident', {
          method: 'POST',
          body: JSON.stringify({
            short_description: params.short_description,
            description: params.description ?? '',
            priority: params.priority ?? '3',
            impact: params.impact ?? '2',
            urgency: params.urgency ?? '2',
            category: params.category ?? '',
            caller_id: params.caller_id ?? '',
            assignment_group: params.assignment_group ?? '',
          }),
        })
      },
    },
    {
      slug: 'update_incident',
      name: 'Update Incident',
      description:
        'Update a ServiceNow incident by sys_id. state: 2=In Progress, 6=Resolved, 7=Closed. ' +
        'To resolve: set state="6" and resolution_code="Solved (Permanently)".',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['sys_id'],
        properties: {
          sys_id: { type: 'string', description: 'Incident sys_id to update' },
          state: { type: 'string', description: '2=In Progress, 6=Resolved, 7=Closed' },
          work_notes: { type: 'string', description: 'Internal work notes to add' },
          resolution_notes: { type: 'string', description: 'Resolution notes (required when resolving)' },
          resolution_code: { type: 'string', description: 'e.g. Solved (Permanently)' },
          assigned_to: { type: 'string', description: 'Username to assign to (optional)' },
          assignment_group: { type: 'string', description: 'Assignment group name (optional)' },
        },
      },
      execute: async (creds, params) => {
        const { sys_id, ...fields } = params
        return snFetch(creds.instance, creds.username, creds.password, `/table/incident/${sys_id as string}`, {
          method: 'PATCH',
          body: JSON.stringify(fields),
        })
      },
    },
    {
      slug: 'close_incident',
      name: 'Close Incident',
      description:
        'Close a ServiceNow incident by setting state=7 (Closed). ' +
        'Requires resolution_code and resolution_notes to be set.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['sys_id', 'resolution_notes'],
        properties: {
          sys_id: { type: 'string', description: 'Incident sys_id to close' },
          resolution_notes: { type: 'string', description: 'What was done to resolve the incident' },
          resolution_code: { type: 'string', description: 'Close code (default: Solved (Permanently))' },
        },
      },
      execute: async (creds, params) => {
        return snFetch(creds.instance, creds.username, creds.password, `/table/incident/${params.sys_id as string}`, {
          method: 'PATCH',
          body: JSON.stringify({
            state: '7',
            close_notes: params.resolution_notes,
            close_code: params.resolution_code ?? 'Solved (Permanently)',
          }),
        })
      },
    },
    {
      slug: 'add_work_note',
      name: 'Add Work Note',
      description:
        'Add an internal work note to any ServiceNow record (incident, problem, change, etc.). ' +
        'table defaults to "incident".',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['sys_id', 'work_notes'],
        properties: {
          sys_id: { type: 'string', description: 'Record sys_id to add the note to' },
          work_notes: { type: 'string', description: 'Work note text (internal only)' },
          table: { type: 'string', description: 'Table name (default: incident). Other options: change_request, problem, sc_task' },
        },
      },
      execute: async (creds, params) => {
        const table = (params.table as string | undefined) ?? 'incident'
        return snFetch(creds.instance, creds.username, creds.password, `/table/${table}/${params.sys_id as string}`, {
          method: 'PATCH',
          body: JSON.stringify({ work_notes: params.work_notes }),
        })
      },
    },
    {
      slug: 'search_records',
      name: 'Search Records',
      description:
        'Search any ServiceNow table using a query string. ' +
        'table: incident, change_request, problem, cmdb_ci, sc_task, sys_user, etc. ' +
        'query: ServiceNow encoded query, e.g. "short_descriptionLIKEserver^stateIN1,2".',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['table', 'query'],
        properties: {
          table: { type: 'string', description: 'Table name (e.g. incident, change_request, problem, cmdb_ci)' },
          query: { type: 'string', description: 'ServiceNow encoded query string' },
          fields: { type: 'string', description: 'Comma-separated field names to return (optional)' },
          limit: { type: 'number', description: 'Max records (default 10, max 50)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 10, 50)
        const qs: string[] = [`sysparm_limit=${limit}`, `sysparm_query=${encodeURIComponent(params.query as string)}`]
        if (params.fields) qs.push(`sysparm_fields=${params.fields}`)
        return snFetch(creds.instance, creds.username, creds.password, `/table/${params.table as string}?${qs.join('&')}`)
      },
    },
    {
      slug: 'list_changes',
      name: 'List Change Requests',
      description:
        'List ServiceNow change requests. state: -5=New, -1=Assess, 1=Authorize, 0=Scheduled, 2=Implement, 3=Review, 4=Closed. ' +
        'type: normal, standard, emergency.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          state: { type: 'string', description: 'State: -5=New, 0=Scheduled, 2=Implement, 3=Review, 4=Closed' },
          type: { type: 'string', description: 'Change type: normal, standard, emergency' },
          limit: { type: 'number', description: 'Max change requests (default 10)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 10, 50)
        const filters: string[] = []
        if (params.state) filters.push(`state=${params.state}`)
        if (params.type) filters.push(`type=${params.type}`)
        const qs = `sysparm_limit=${limit}&sysparm_fields=number,short_description,state,type,priority,start_date,end_date,assigned_to,sys_id${filters.length ? `&sysparm_query=${filters.join('^')}` : ''}&sysparm_order_direction=desc&sysparm_order_by=sys_created_on`
        return snFetch(creds.instance, creds.username, creds.password, `/table/change_request?${qs}`)
      },
    },
    {
      slug: 'create_change',
      name: 'Create Change Request',
      description:
        'Create a new ServiceNow change request. type: normal, standard, or emergency. ' +
        'risk: 1=Very High, 2=High, 3=Moderate, 4=Low.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['short_description', 'type'],
        properties: {
          short_description: { type: 'string', description: 'Brief change description' },
          description: { type: 'string', description: 'Detailed description' },
          type: { type: 'string', enum: ['normal', 'standard', 'emergency'], description: 'Change type' },
          risk: { type: 'string', enum: ['1', '2', '3', '4'], description: '1=Very High, 2=High, 3=Moderate, 4=Low' },
          justification: { type: 'string', description: 'Business justification (optional)' },
          implementation_plan: { type: 'string', description: 'Implementation plan (optional)' },
          backout_plan: { type: 'string', description: 'Backout plan (optional)' },
          start_date: { type: 'string', description: 'Planned start date ISO 8601 (optional)' },
          end_date: { type: 'string', description: 'Planned end date ISO 8601 (optional)' },
        },
      },
      execute: async (creds, params) => {
        return snFetch(creds.instance, creds.username, creds.password, '/table/change_request', {
          method: 'POST',
          body: JSON.stringify({
            short_description: params.short_description,
            description: params.description ?? '',
            type: params.type,
            risk: params.risk ?? '3',
            justification: params.justification ?? '',
            implementation_plan: params.implementation_plan ?? '',
            backout_plan: params.backout_plan ?? '',
            start_date: params.start_date ?? '',
            end_date: params.end_date ?? '',
          }),
        })
      },
    },
    {
      slug: 'list_problems',
      name: 'List Problems',
      description: 'List ServiceNow problem records. state: 101=Open, 102=Known Error, 103=Pending Change, 104=Closed/Resolved.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          state: { type: 'string', description: 'State: 101=Open, 102=Known Error, 103=Pending Change, 104=Closed' },
          limit: { type: 'number', description: 'Max problems (default 10)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 10, 50)
        const qs: string[] = [`sysparm_limit=${limit}`, 'sysparm_fields=number,short_description,state,priority,assigned_to,sys_id']
        if (params.state) qs.push(`sysparm_query=state=${params.state}`)
        return snFetch(creds.instance, creds.username, creds.password, `/table/problem?${qs.join('&')}`)
      },
    },
    {
      slug: 'create_problem',
      name: 'Create Problem',
      description: 'Create a new ServiceNow problem record to track a root cause for one or more incidents.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['short_description'],
        properties: {
          short_description: { type: 'string', description: 'Brief problem description' },
          description: { type: 'string', description: 'Detailed description of the problem' },
          priority: { type: 'string', enum: ['1', '2', '3', '4'], description: '1=Critical, 2=High, 3=Medium, 4=Low' },
          category: { type: 'string', description: 'Problem category (optional)' },
          assigned_to: { type: 'string', description: 'Username to assign to (optional)' },
        },
      },
      execute: async (creds, params) => {
        return snFetch(creds.instance, creds.username, creds.password, '/table/problem', {
          method: 'POST',
          body: JSON.stringify({
            short_description: params.short_description,
            description: params.description ?? '',
            priority: params.priority ?? '3',
            category: params.category ?? '',
            assigned_to: params.assigned_to ?? '',
          }),
        })
      },
    },
    {
      slug: 'list_cmdb_cis',
      name: 'List CMDB Configuration Items',
      description:
        'List Configuration Items (CIs) in the ServiceNow CMDB. ' +
        'ci_class: cmdb_ci_server, cmdb_ci_computer, cmdb_ci_app_server, cmdb_ci_database, cmdb_ci_network_adapter. ' +
        'operational_status: 1=Operational, 2=Non-Operational.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          ci_class: { type: 'string', description: 'CI class (default: cmdb_ci). e.g. cmdb_ci_server, cmdb_ci_computer' },
          name_filter: { type: 'string', description: 'Filter by CI name (optional)' },
          operational_status: { type: 'string', description: '1=Operational, 2=Non-Operational' },
          limit: { type: 'number', description: 'Max CIs (default 20)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 50)
        const ciClass = (params.ci_class as string | undefined) ?? 'cmdb_ci'
        const filters: string[] = []
        if (params.name_filter) filters.push(`nameLIKE${params.name_filter}`)
        if (params.operational_status) filters.push(`operational_status=${params.operational_status}`)
        const qs: string[] = [`sysparm_limit=${limit}`, 'sysparm_fields=name,sys_id,sys_class_name,operational_status,ip_address,short_description']
        if (filters.length) qs.push(`sysparm_query=${filters.join('^')}`)
        return snFetch(creds.instance, creds.username, creds.password, `/table/${ciClass}?${qs.join('&')}`)
      },
    },
    {
      slug: 'get_ci',
      name: 'Get Configuration Item',
      description: 'Get full details of a ServiceNow CMDB CI by its sys_id or name.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['name_or_sysid'],
        properties: {
          name_or_sysid: { type: 'string', description: 'CI name or sys_id' },
          ci_class: { type: 'string', description: 'CI class table (default: cmdb_ci)' },
        },
      },
      execute: async (creds, params) => {
        const ciClass = (params.ci_class as string | undefined) ?? 'cmdb_ci'
        const val = params.name_or_sysid as string
        const looksLikeSysId = /^[a-f0-9]{32}$/i.test(val)
        if (looksLikeSysId) {
          return snFetch(creds.instance, creds.username, creds.password, `/table/${ciClass}/${val}`)
        }
        return snFetch(creds.instance, creds.username, creds.password, `/table/${ciClass}?sysparm_query=name=${encodeURIComponent(val)}&sysparm_limit=1`)
      },
    },
    {
      slug: 'list_catalog_items',
      name: 'List Service Catalog Items',
      description: 'List items available in the ServiceNow service catalog that users can order.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max catalog items (default 20)' },
          search: { type: 'string', description: 'Search by item name (optional)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 50)
        const qs: string[] = [`sysparm_limit=${limit}`, 'sysparm_fields=sys_id,name,short_description,category,price']
        if (params.search) qs.push(`sysparm_query=nameLIKE${params.search}^active=true`)
        return snFetch(creds.instance, creds.username, creds.password, `/table/sc_cat_item?${qs.join('&')}`)
      },
    },
    {
      slug: 'list_users',
      name: 'List Users',
      description: 'List ServiceNow users. Filter by active status or search by name/email.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Search by name or email (optional)' },
          active: { type: 'boolean', description: 'Filter by active status (default: true)' },
          limit: { type: 'number', description: 'Max users (default 20)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 50)
        const filters: string[] = [params.active !== false ? 'active=true' : '']
        if (params.search) filters.push(`nameLIKE${params.search}^ORuser_nameLIKE${params.search}^ORemailLIKE${params.search}`)
        const qs = `sysparm_limit=${limit}&sysparm_fields=sys_id,user_name,name,email,title,department,active${filters.filter(Boolean).length ? `&sysparm_query=${filters.filter(Boolean).join('^')}` : ''}`
        return snFetch(creds.instance, creds.username, creds.password, `/table/sys_user?${qs}`)
      },
    },
  ],
}
