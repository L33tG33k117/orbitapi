import type { ActionResult } from '@/connectors/types'

// ============================================================================
// Static simulation seed data.
//
// IMPORTANT: this is no longer the primary simulation path. Every simulated
// connection routes through lib/sim-engine.ts (resolveSimulatedAction), which
// AI-generates realistic, query-specific data for ANY connector — including ones
// not listed below. So a brand-new connector works in Simulate mode with zero
// changes to this file.
//
// What the DATA map below is for now: a high-quality SHAPE HINT. When an entry
// exists, the engine feeds it to the model as "this is exactly the JSON shape
// this action returns", which sharpens realism. Adding an entry for a new
// connector is therefore optional polish, not a requirement for it to work.
// (scripts/test-sim-parity.mjs reports missing entries as a quality advisory.)
// ============================================================================

// ── Helpers ───────────────────────────────────────────────────────────────────

function simId(prefix = 'sim') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function past(daysAgo = 0, hoursAgo = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(d.getHours() - hoursAgo)
  return d.toISOString()
}

function writeOk(extra?: Record<string, unknown>): ActionResult {
  return { ok: true, data: { status: 'simulated', id: simId(), ...extra } }
}

// ── Per-connector fake data ───────────────────────────────────────────────────

type SimFn = (params: Record<string, unknown>) => ActionResult

const DATA: Record<string, Record<string, SimFn>> = {
  'google-drive': {
    list_files: () => ({ ok: true, data: { files: [
      { id: 'f_' + simId(), name: 'Q2 Financials.xlsx', mimeType: 'application/vnd.google-apps.spreadsheet', modifiedTime: past(0, 3), webViewLink: 'https://drive.google.com/file/d/sim1/view', owners: [{ displayName: 'Alice Smith' }] },
      { id: 'f_' + simId(), name: 'Onboarding Guide.pdf', mimeType: 'application/pdf', size: '482311', modifiedTime: past(1), webViewLink: 'https://drive.google.com/file/d/sim2/view', owners: [{ displayName: 'Bob Jones' }] },
      { id: 'f_' + simId(), name: 'Roadmap.docx', mimeType: 'application/vnd.google-apps.document', modifiedTime: past(2), webViewLink: 'https://drive.google.com/file/d/sim3/view', owners: [{ displayName: 'Alice Smith' }] },
    ] } }),
    search_files: (p) => ({ ok: true, data: { files: [
      { id: 'f_' + simId(), name: `${p.query ?? 'result'} — notes.docx`, mimeType: 'application/vnd.google-apps.document', modifiedTime: past(0, 5), webViewLink: 'https://drive.google.com/file/d/sim4/view', owners: [{ displayName: 'Alice Smith' }] },
    ] } }),
    get_file: (p) => ({ ok: true, data: {
      id: p.file_id ?? 'f_sim', name: 'Q2 Financials.xlsx', mimeType: 'application/vnd.google-apps.spreadsheet',
      modifiedTime: past(0, 3), webViewLink: 'https://drive.google.com/file/d/sim1/view', owners: [{ displayName: 'Alice Smith' }], parents: ['root'],
    } }),
    list_folders: () => ({ ok: true, data: { files: [
      { id: 'fd_' + simId(), name: 'Finance', mimeType: 'application/vnd.google-apps.folder', modifiedTime: past(5) },
      { id: 'fd_' + simId(), name: 'Engineering', mimeType: 'application/vnd.google-apps.folder', modifiedTime: past(3) },
    ] } }),
    get_storage_quota: () => ({ ok: true, data: {
      storageQuota: { limit: '16106127360', usage: '4821934080', usageInDrive: '3221225472' },
      user: { displayName: 'Alice Smith', emailAddress: 'alice@example.com' },
    } }),
  },

  'quickbooks-online': {
    list_invoices: () => ({ ok: true, data: { QueryResponse: { Invoice: [
      { Id: '1001', DocNumber: 'INV-1001', CustomerRef: { name: 'Acme Corp' }, TotalAmt: 15000.0, Balance: 15000.0, DueDate: past(-5), TxnDate: past(10) },
      { Id: '1002', DocNumber: 'INV-1002', CustomerRef: { name: 'GlobalTech' }, TotalAmt: 8500.0, Balance: 4250.0, DueDate: past(-1), TxnDate: past(5) },
    ] } } }),
    get_invoice: (p) => ({ ok: true, data: { Invoice: {
      Id: p.invoice_id ?? '1001', DocNumber: 'INV-1001', CustomerRef: { name: 'Acme Corp' },
      TotalAmt: 15000.0, Balance: 15000.0, DueDate: past(-5), TxnDate: past(10),
      Line: [{ Amount: 15000.0, Description: 'Professional services' }],
    } } }),
    list_customers: () => ({ ok: true, data: { QueryResponse: { Customer: [
      { Id: '1', DisplayName: 'Acme Corp', PrimaryEmailAddr: { Address: 'billing@acme.com' }, Balance: 15000.0 },
      { Id: '2', DisplayName: 'GlobalTech', PrimaryEmailAddr: { Address: 'accounts@globaltech.io' }, Balance: 4250.0 },
    ] } } }),
    create_customer: () => writeOk({ Customer: { Id: simId('cust'), DisplayName: 'New Customer' } }),
    create_invoice: () => writeOk({ Invoice: { Id: simId('inv'), DocNumber: `INV-${Date.now().toString().slice(-4)}`, TotalAmt: 0 } }),
    record_payment: () => writeOk({ Payment: { Id: simId('pmt'), TotalAmt: 15000.0 } }),
    list_bills: () => ({ ok: true, data: { QueryResponse: { Bill: [
      { Id: '2001', VendorRef: { name: 'Cloud Hosting Co' }, TotalAmt: 4200.0, Balance: 4200.0, DueDate: past(-3) },
    ] } } }),
    get_profit_and_loss: () => ({ ok: true, data: { Header: { ReportName: 'ProfitAndLoss', StartPeriod: past(30), EndPeriod: past(0) }, Rows: {
      Row: [
        { type: 'Section', group: 'Income', Summary: { ColData: [{ value: 'Total Income' }, { value: '245000.00' }] } },
        { type: 'Section', group: 'Expenses', Summary: { ColData: [{ value: 'Total Expenses' }, { value: '178500.00' }] } },
        { type: 'Section', group: 'NetIncome', Summary: { ColData: [{ value: 'Net Income' }, { value: '66500.00' }] } },
      ],
    } } }),
  },

  slack: {
    list_channels: () => ({ ok: true, data: { channels: [
      { id: 'C001', name: 'general', is_private: false, num_members: 48 },
      { id: 'C002', name: 'engineering', is_private: false, num_members: 15 },
      { id: 'C003', name: 'incidents', is_private: false, num_members: 12 },
      { id: 'C004', name: 'security-ops', is_private: true, num_members: 6 },
      { id: 'C005', name: 'deployments', is_private: false, num_members: 22 },
    ] } }),
    get_channel_history: () => ({ ok: true, data: { messages: [
      { ts: '1717000000.001', user: 'U001', text: 'Deployment complete ✅', type: 'message' },
      { ts: '1716990000.002', user: 'U002', text: 'Anyone seen the CPU spike?', type: 'message' },
      { ts: '1716980000.003', user: 'U003', text: 'Running post-mortem now', type: 'message' },
    ] } }),
    list_users: () => ({ ok: true, data: { members: [
      { id: 'U001', name: 'alice.smith', real_name: 'Alice Smith', is_admin: true },
      { id: 'U002', name: 'bob.jones', real_name: 'Bob Jones', is_admin: false },
      { id: 'U003', name: 'carol.white', real_name: 'Carol White', is_admin: false },
    ] } }),
    search_messages: (p) => ({ ok: true, data: { messages: { matches: [
      { text: `Message matching "${p.query ?? 'query'}"`, channel: { name: 'general' }, ts: past(0, 2) },
      { text: `Another result for "${p.query ?? 'query'}"`, channel: { name: 'engineering' }, ts: past(0, 5) },
    ], total: 2 } } }),
    send_message: () => writeOk({ message: { ts: Date.now().toString(), text: '[Simulated message sent]' } }),
    send_alert: () => writeOk({ message: { ts: Date.now().toString(), text: '[Simulated alert sent]' } }),
    post_rich_message: () => writeOk(),
    add_reaction: () => writeOk(),
    create_channel: () => writeOk({ channel: { id: simId('C'), name: 'new-channel' } }),
    schedule_message: () => writeOk(),
    update_message: () => writeOk(),
    list_pins: () => ({ ok: true, data: { items: [] } }),
    open_dm: () => writeOk({ channel: { id: simId('D') } }),
    invite_to_channel: () => writeOk(),
    set_channel_topic: () => writeOk(),
    set_channel_purpose: () => writeOk(),
    post_table_message: () => writeOk(),
    kick_from_channel: () => writeOk(),
    archive_channel: () => writeOk(),
    delete_message: () => writeOk(),
  },

  pagerduty: {
    list_incidents: () => ({ ok: true, data: { incidents: [
      { id: 'P001', title: 'High CPU on prod-api-01', status: 'triggered', urgency: 'high', created_at: past(0, 1) },
      { id: 'P002', title: 'Database connection pool exhausted', status: 'acknowledged', urgency: 'high', created_at: past(0, 3) },
      { id: 'P003', title: 'TLS cert expiring in 7 days', status: 'triggered', urgency: 'low', created_at: past(1) },
    ] } }),
    get_incident: (p) => ({ ok: true, data: { incident: {
      id: p.incident_id ?? 'P001', title: 'Simulated incident', status: 'triggered',
      urgency: 'high', created_at: past(0, 2), escalation_policy: { name: 'Default Policy' },
    } } }),
    list_services: () => ({ ok: true, data: { services: [
      { id: 'SVC001', name: 'Production API', status: 'critical' },
      { id: 'SVC002', name: 'Database Cluster', status: 'active' },
      { id: 'SVC003', name: 'Frontend CDN', status: 'active' },
    ] } }),
    list_on_calls: () => ({ ok: true, data: { oncalls: [
      { user: { name: 'Alice Smith', email: 'alice@example.com' }, schedule: { name: 'Primary On-Call' }, start: past(0, 2), end: past(-1) },
    ] } }),
    list_schedules: () => ({ ok: true, data: { schedules: [
      { id: 'SCH001', name: 'Primary On-Call', time_zone: 'UTC' },
      { id: 'SCH002', name: 'Secondary On-Call', time_zone: 'UTC' },
    ] } }),
    list_escalation_policies: () => ({ ok: true, data: { escalation_policies: [
      { id: 'EP001', name: 'Default Policy', num_loops: 3 },
      { id: 'EP002', name: 'Critical Escalation', num_loops: 5 },
    ] } }),
    list_users: () => ({ ok: true, data: { users: [
      { id: 'USR001', name: 'Alice Smith', email: 'alice@example.com', role: 'admin' },
      { id: 'USR002', name: 'Bob Jones', email: 'bob@example.com', role: 'responder' },
    ] } }),
    trigger_incident: () => writeOk({ incident: { id: simId('P'), status: 'triggered' } }),
    acknowledge_incident: () => writeOk({ incident: { status: 'acknowledged' } }),
    resolve_incident: () => writeOk({ incident: { status: 'resolved' } }),
    manage_incident: () => writeOk(),
    add_incident_note: () => writeOk({ note: { id: simId('NOTE') } }),
    list_log_entries: () => ({ ok: true, data: { log_entries: [
      { type: 'acknowledge_log_entry', created_at: past(0, 1), agent: { name: 'Alice Smith' } },
      { type: 'notify_log_entry', created_at: past(0, 2), agent: { name: 'PagerDuty' } },
    ] } }),
    create_override: () => writeOk(),
    snooze_incident: () => writeOk(),
    list_teams: () => ({ ok: true, data: { teams: [{ id: 'T001', name: 'Security Team' }, { id: 'T002', name: 'Platform Team' }] } }),
  },

  zendesk: {
    list_tickets: () => ({ ok: true, data: { tickets: [
      { id: 12345, subject: 'Login broken for enterprise user', status: 'open', priority: 'high', created_at: past(0, 2) },
      { id: 12344, subject: 'Export to CSV not working', status: 'pending', priority: 'normal', created_at: past(1) },
      { id: 12343, subject: 'Billing question', status: 'open', priority: 'low', created_at: past(2) },
    ] } }),
    get_ticket: (p) => ({ ok: true, data: { ticket: {
      id: p.ticket_id ?? 12345, subject: 'Simulated ticket', status: 'open',
      priority: 'high', created_at: past(0, 3), requester_id: 'U001',
    } } }),
    search_tickets: (p) => ({ ok: true, data: { results: [
      { id: 12340, subject: `Ticket matching "${p.query ?? ''}"`, status: 'open', priority: 'normal' },
    ], count: 1 } }),
    list_users: () => ({ ok: true, data: { users: [
      { id: 1001, name: 'Alice Smith', email: 'alice@example.com', role: 'agent' },
      { id: 1002, name: 'Bob Jones', email: 'bob@example.com', role: 'end-user' },
    ] } }),
    list_organizations: () => ({ ok: true, data: { organizations: [
      { id: 2001, name: 'Acme Corp', domain_names: ['acme.com'] },
      { id: 2002, name: 'GlobalTech', domain_names: ['globaltech.io'] },
    ] } }),
    list_macros: () => ({ ok: true, data: { macros: [
      { id: 3001, title: 'Close and thank', active: true },
      { id: 3002, title: 'Escalate to engineering', active: true },
      { id: 3003, title: 'Request more info', active: true },
    ] } }),
    list_views: () => ({ ok: true, data: { views: [
      { id: 4001, title: 'All unsolved tickets', active: true },
      { id: 4002, title: 'High priority', active: true },
    ] } }),
    create_ticket: () => writeOk({ ticket: { id: Math.floor(Math.random() * 9000) + 10000, status: 'new' } }),
    update_ticket: () => writeOk({ ticket: { status: 'open' } }),
    delete_ticket: () => writeOk(),
    add_comment: () => writeOk({ comment: { id: simId('CMT') } }),
    merge_tickets: () => writeOk(),
    create_user: () => writeOk({ user: { id: simId('USR') } }),
    update_user: () => writeOk(),
    suspend_user: () => writeOk(),
    create_organization: () => writeOk({ organization: { id: simId('ORG') } }),
    apply_macro: () => writeOk(),
    get_view_tickets: () => ({ ok: true, data: { tickets: [] } }),
    get_ticket_metrics: (p) => ({ ok: true, data: { ticket_metric: {
      ticket_id: p.ticket_id ?? 12345, reply_time_in_minutes: { calendar: 34 },
      full_resolution_time_in_minutes: { calendar: 120 },
    } } }),
    bulk_update_tickets: () => writeOk({ updated: 3 }),
  },

  servicenow: {
    list_incidents: () => ({ ok: true, data: { result: [
      { sys_id: simId(), number: 'INC0000001', short_description: 'Production DB down', priority: '1', state: '1', opened_at: past(0, 1) },
      { sys_id: simId(), number: 'INC0000002', short_description: 'Email notifications delayed', priority: '3', state: '2', opened_at: past(0, 4) },
    ] } }),
    get_incident: (p) => ({ ok: true, data: { result: [
      { sys_id: simId(), number: (p.number_or_sysid as string)?.toUpperCase?.().startsWith('INC') ? p.number_or_sysid : 'INC0000001', short_description: 'Email notifications delayed', priority: '2', state: '2', opened_at: past(0, 3) },
    ] } }),
    create_incident: () => writeOk({ result: { sys_id: simId(), number: `INC${Date.now().toString().slice(-7)}`, state: '1' } }),
    update_incident: () => writeOk(),
    close_incident: () => writeOk({ result: { state: '7', close_notes: 'Simulated resolution' } }),
    add_work_note: () => writeOk(),
    search_records: () => ({ ok: true, data: { result: [
      { sys_id: simId(), name: 'Simulated record 1' },
      { sys_id: simId(), name: 'Simulated record 2' },
    ] } }),
    list_changes: () => ({ ok: true, data: { result: [
      { sys_id: simId(), number: 'CHG0000001', short_description: 'DB upgrade', state: 'scheduled', start_date: past(-1) },
    ] } }),
    create_change: () => writeOk({ result: { sys_id: simId(), number: 'CHG0000099' } }),
    list_problems: () => ({ ok: true, data: { result: [
      { sys_id: simId(), number: 'PRB0000001', short_description: 'Recurring auth failures', state: '1' },
    ] } }),
    create_problem: () => writeOk({ result: { sys_id: simId(), number: 'PRB0000099' } }),
    list_cmdb_cis: () => ({ ok: true, data: { result: [
      { sys_id: simId(), name: 'prod-web-01', asset_tag: 'WEB-001', operational_status: '1' },
      { sys_id: simId(), name: 'prod-db-01', asset_tag: 'DB-001', operational_status: '1' },
    ] } }),
    get_ci: (p) => ({ ok: true, data: { result: { sys_id: p.sys_id, name: 'prod-web-01', ip_address: '10.0.1.5', operational_status: '1' } } }),
    list_catalog_items: () => ({ ok: true, data: { result: [
      { sys_id: simId(), name: 'Laptop Request', short_description: 'Request a new laptop' },
      { sys_id: simId(), name: 'Software License', short_description: 'Request software access' },
    ] } }),
    list_users: () => ({ ok: true, data: { result: [
      { sys_id: simId(), user_name: 'alice.smith', name: 'Alice Smith', email: 'alice@example.com' },
    ] } }),
  },

  sendgrid: {
    send_email: () => writeOk({ message_id: simId('msg') }),
    send_alert_email: () => writeOk({ message_id: simId('msg') }),
    send_templated_email: () => writeOk({ message_id: simId('msg') }),
    list_templates: () => ({ ok: true, data: { result: [
      { id: 'd-001', name: 'Welcome Email', generation: 'dynamic' },
      { id: 'd-002', name: 'Incident Alert', generation: 'dynamic' },
      { id: 'd-003', name: 'Weekly Report', generation: 'dynamic' },
    ] } }),
    get_email_stats: () => ({ ok: true, data: [{
      date: new Date().toISOString().split('T')[0],
      stats: [{ metrics: { requests: 1234, delivered: 1198, opens: 456, clicks: 89, bounces: 12, spam_reports: 2 } }],
    }] }),
    list_contacts: () => ({ ok: true, data: { result: [
      { id: simId(), email: 'alice@example.com', first_name: 'Alice', last_name: 'Smith' },
      { id: simId(), email: 'bob@example.com', first_name: 'Bob', last_name: 'Jones' },
    ], contact_count: 2 } }),
    add_contacts: () => writeOk({ job_id: simId('job') }),
    list_contact_lists: () => ({ ok: true, data: { result: [
      { id: simId(), name: 'Newsletter Subscribers', contact_count: 1200 },
      { id: simId(), name: 'Enterprise Customers', contact_count: 45 },
    ] } }),
    create_contact_list: () => writeOk({ id: simId('list') }),
    validate_email: (p) => ({ ok: true, data: { email: p.email, verdict: 'Valid', score: 0.95 } }),
    list_bounces: () => ({ ok: true, data: [
      { email: 'invalid@bounced.com', reason: 'Unknown address', status: '5.1.1' },
    ] }),
    delete_bounce: () => writeOk(),
    list_unsubscribes: () => ({ ok: true, data: [
      { email: 'unsubscribed@example.com', created: past(3) },
    ] }),
    add_to_suppression: () => writeOk(),
    list_spam_reports: () => ({ ok: true, data: [] }),
    schedule_send: () => writeOk({ id: simId('send') }),
  },

  twilio: {
    send_sms: () => writeOk({ sid: simId('SM'), status: 'queued', to: '+15550000000' }),
    send_whatsapp: () => writeOk({ sid: simId('SM'), status: 'queued', to: 'whatsapp:+15550000000' }),
    send_mms: () => writeOk({ sid: simId('SM'), status: 'queued' }),
    get_message: (p) => ({ ok: true, data: { sid: p.message_sid, status: 'delivered', body: 'Simulated message', direction: 'outbound-api' } }),
    make_call: () => writeOk({ sid: simId('CA'), status: 'queued' }),
    list_messages: () => ({ ok: true, data: { messages: [
      { sid: simId('SM'), to: '+15550000001', status: 'delivered', date_sent: past(0, 1) },
      { sid: simId('SM'), to: '+15550000002', status: 'failed', date_sent: past(0, 3) },
    ] } }),
    list_calls: () => ({ ok: true, data: { calls: [
      { sid: simId('CA'), to: '+15550000001', status: 'completed', duration: '45', start_time: past(0, 2) },
    ] } }),
    get_call: (p) => ({ ok: true, data: { sid: p.call_sid, status: 'completed', duration: '30' } }),
    lookup_number: (p) => ({ ok: true, data: { phone_number: p.phone_number, line_type_intelligence: { type: 'mobile', carrier_name: 'SimCarrier' } } }),
    list_phone_numbers: () => ({ ok: true, data: { incoming_phone_numbers: [
      { sid: simId('PN'), phone_number: '+15550000100', friendly_name: 'Main Number' },
    ] } }),
    send_verification: () => writeOk({ status: 'pending', channel: 'sms' }),
    check_verification: () => writeOk({ status: 'approved', valid: true }),
    list_recordings: () => ({ ok: true, data: { recordings: [] } }),
    get_account_usage: () => ({ ok: true, data: { usage_records: [
      { category: 'sms', description: 'SMS', usage: '142', price: '4.26' },
      { category: 'calls', description: 'Voice Calls', usage: '23', price: '1.15' },
    ] } }),
    delete_message: () => writeOk(),
  },

  crowdstrike: {
    list_detections: () => ({ ok: true, data: { resources: [
      { detection_id: 'ldt:01:001', severity: 8, status: 'new', host_info: { hostname: 'LAPTOP-ABC' }, behaviors: [{ tactic: 'Credential Access' }] },
      { detection_id: 'ldt:01:002', severity: 6, status: 'in_progress', host_info: { hostname: 'WIN-SERVER-01' }, behaviors: [{ tactic: 'Lateral Movement' }] },
    ], meta: { total: 2 } } }),
    get_detection: (p) => ({ ok: true, data: { resources: [{ detection_id: p.detection_id, severity: 8, status: 'new' }] } }),
    list_hosts: () => ({ ok: true, data: { resources: [
      { device_id: simId('HOST'), hostname: 'LAPTOP-ABC', platform_name: 'Windows', status: 'normal', last_seen: past(0, 1) },
      { device_id: simId('HOST'), hostname: 'WIN-SERVER-01', platform_name: 'Windows', status: 'normal', last_seen: past(0, 2) },
      { device_id: simId('HOST'), hostname: 'MAC-DEV-01', platform_name: 'Mac', status: 'normal', last_seen: past(0, 0) },
    ] } }),
    search_hosts: () => ({ ok: true, data: { resources: [simId('HOST'), simId('HOST')], meta: { total: 2 } } }),
    contain_host: () => writeOk({ id: simId('HOST') }),
    lift_containment: () => writeOk(),
    get_host_details: () => ({ ok: true, data: { resources: [{ hostname: 'LAPTOP-ABC', status: 'normal', platform_name: 'Windows' }] } }),
    hide_host: () => writeOk(),
    list_incidents: () => ({ ok: true, data: { resources: [
      { incident_id: simId('INC'), name: 'Suspicious lateral movement', state: 'open', severity: 80 },
    ] } }),
    list_iocs: () => ({ ok: true, data: { resources: [
      { id: simId('IOC'), type: 'domain', value: 'malicious.example.com', action: 'prevent' },
    ] } }),
    create_ioc: () => writeOk({ resources: [{ id: simId('IOC') }] }),
    delete_ioc: () => writeOk(),
    list_vulnerabilities: () => ({ ok: true, data: { resources: [
      { id: simId('VULN'), cve: { id: 'CVE-2024-1234', base_score: 9.8, severity: 'CRITICAL' }, host_count: 3 },
    ] } }),
    update_detection: () => writeOk(),
    run_rtr_command: () => ({ ok: true, data: { resources: [{ stdout: 'Command executed successfully (simulated)', base_command: 'ls' }] } }),
  },

  sentinelone: {
    list_threats: () => ({ ok: true, data: { data: [
      { id: simId('THREAT'), agentRealtimeInfo: { agentComputerName: 'LAPTOP-ABC' }, threatInfo: { classification: 'Malware', confidenceLevel: 'malicious', createdAt: past(0, 1) } },
    ], pagination: { totalItems: 1 } } }),
    list_agents: () => ({ ok: true, data: { data: [
      { id: simId('AGENT'), computerName: 'LAPTOP-ABC', osName: 'Windows 11', isActive: true, networkStatus: 'connected' },
      { id: simId('AGENT'), computerName: 'MAC-DEV-01', osName: 'macOS', isActive: true, networkStatus: 'connected' },
    ] } }),
    get_agent: (p) => ({ ok: true, data: { data: [{ id: p.agent_id, computerName: 'LAPTOP-ABC', osName: 'Windows 11', isActive: true }] } }),
    get_threat: (p) => ({ ok: true, data: { data: [{ id: p.threat_id ?? simId('THREAT'), agentRealtimeInfo: { agentComputerName: 'LAPTOP-ABC' }, threatInfo: { classification: 'Malware', confidenceLevel: 'malicious', createdAt: past(0, 1) } }] } }),
    isolate_agent: () => writeOk({ data: { affected: 1 } }),
    reconnect_agent: () => writeOk({ data: { affected: 1 } }),
    mitigate_threat: () => writeOk({ data: { affected: 1 } }),
    mark_as_benign: () => writeOk({ data: { affected: 1 } }),
    initiate_scan: () => writeOk({ data: { affected: 1 } }),
    abort_scan: () => writeOk(),
    decommission_agent: () => writeOk(),
    list_groups: () => ({ ok: true, data: { data: [
      { id: simId('GRP'), name: 'Default Group', filteredGroupIds: [] },
      { id: simId('GRP'), name: 'Servers', filteredGroupIds: [] },
    ] } }),
    list_sites: () => ({ ok: true, data: { data: { sites: [{ id: simId('SITE'), name: 'Production' }] } } }),
    list_activities: () => ({ ok: true, data: { data: [
      { id: 1001, activityType: 21, createdAt: past(0, 1), description: 'Agent isolated (simulated)' },
    ] } }),
    list_exclusions: () => ({ ok: true, data: { data: [] } }),
    add_exclusion: () => writeOk({ data: { id: simId('EXC') } }),
    fetch_agent_logs: () => writeOk({ data: { downloadUrl: `https://example.com/sim-logs-${simId()}.zip` } }),
    get_system_status: () => ({ ok: true, data: { data: { health: 'green', dbStatus: 'green', overallSentinels: 2 } } }),
    list_policies: () => ({ ok: true, data: { data: [{ id: simId('POL'), name: 'Default Policy' }] } }),
  },

  sophos: {
    list_alerts: () => ({ ok: true, data: { items: [
      { id: simId('ALERT'), severity: 'high', description: 'Malware detected on LAPTOP-ABC', type: 'Event::Endpoint::Threat::Detected', raisedAt: past(0, 1) },
      { id: simId('ALERT'), severity: 'medium', description: 'Web control violation', type: 'Event::Endpoint::WebControlViolation', raisedAt: past(0, 3) },
    ] } }),
    list_endpoints: () => ({ ok: true, data: { items: [
      { id: simId('EP'), hostname: 'LAPTOP-ABC', os: { name: 'Windows 11' }, health: { overall: 'good' }, online: true },
      { id: simId('EP'), hostname: 'MAC-DEV-01', os: { name: 'macOS' }, health: { overall: 'good' }, online: true },
    ] } }),
    get_endpoint: (p) => ({ ok: true, data: { id: p.endpoint_id ?? simId('EP'), hostname: 'LAPTOP-ABC', os: { name: 'Windows 11' }, health: { overall: 'good' }, online: true, isolation: { status: 'notIsolated' } } }),
    isolate_endpoint: () => writeOk({ items: [{ id: simId('EP') }] }),
    rejoin_endpoint: () => writeOk(),
    remove_isolation: () => writeOk({ items: [{ id: simId('EP') }] }),
    scan_endpoint: () => writeOk({ items: [{ id: simId('EP') }] }),
    get_endpoint_threats: () => ({ ok: true, data: { items: [
      { id: simId('THREAT'), name: 'Troj/FakeVir-XXXX', type: 'trojan', detectedAt: past(0, 2) },
    ] } }),
    list_quarantine_items: () => ({ ok: true, data: { items: [
      { id: simId('QITEM'), path: 'C:\\Temp\\malware.exe', threat: 'Troj/FakeVir', quarantineDate: past(0, 4) },
    ] } }),
    authorize_quarantine_item: () => writeOk(),
    delete_quarantine_item: () => writeOk(),
    get_tamper_protection: () => ({ ok: true, data: { enabled: true } }),
    toggle_tamper_protection: () => writeOk({ enabled: false, uninstallPassword: 'SIM-' + simId() }),
    list_allowed_items: () => ({ ok: true, data: { items: [] } }),
    add_allowed_item: () => writeOk({ id: simId('ALLOW') }),
    list_events: () => ({ ok: true, data: { items: [
      { id: simId('EVT'), type: 'Event::Endpoint::Threat::Detected', severity: 'high', name: 'Simulated SIEM event', created_at: past(0, 1) },
    ] } }),
  },

  'microsoft-defender': {
    list_alerts: () => ({ ok: true, data: { value: [
      { id: simId('ALERT'), title: 'Suspicious PowerShell execution', severity: 'High', status: 'New', createdDateTime: past(0, 1) },
      { id: simId('ALERT'), title: 'Unusual network connection', severity: 'Medium', status: 'InProgress', createdDateTime: past(0, 4) },
    ] } }),
    get_alert: (p) => ({ ok: true, data: { id: p.alert_id, title: 'Simulated alert', severity: 'High', status: 'New' } }),
    update_alert: () => writeOk(),
    list_machines: () => ({ ok: true, data: { value: [
      { id: simId('MACH'), computerDnsName: 'DESKTOP-ABC123', osPlatform: 'Windows10', healthStatus: 'Active', riskScore: 'None' },
      { id: simId('MACH'), computerDnsName: 'LAPTOP-XYZ', osPlatform: 'Windows11', healthStatus: 'Active', riskScore: 'Medium' },
    ] } }),
    get_machine: (p) => ({ ok: true, data: { id: p.machine_id, computerDnsName: 'DESKTOP-ABC123', healthStatus: 'Active' } }),
    isolate_machine: () => writeOk({ type: 'Isolate', status: 'Pending' }),
    release_machine: () => writeOk({ type: 'Unisolate', status: 'Pending' }),
    run_antivirus_scan: () => writeOk({ status: 'Pending' }),
    stop_and_quarantine_file: () => writeOk({ status: 'Pending' }),
    collect_investigation_package: () => writeOk({ status: 'Pending' }),
    list_machine_vulnerabilities: () => ({ ok: true, data: { value: [
      { id: simId('VULN'), cveId: 'CVE-2024-0001', cvssV3: 9.8, severity: 'Critical' },
    ] } }),
    list_vulnerabilities: () => ({ ok: true, data: { value: [
      { id: 'CVE-2024-0001', cvssV3: 9.8, exposedMachines: 3, severity: 'Critical' },
    ] } }),
    list_software: () => ({ ok: true, data: { value: [
      { id: 'vendor_software', name: 'OpenSSL', vendor: 'OpenSSL Project', weaknesses: 2 },
    ] } }),
    list_investigations: () => ({ ok: true, data: { value: [] } }),
    list_indicators: () => ({ ok: true, data: { value: [
      { id: simId('IOC'), indicatorType: 'Url', indicatorValue: 'http://malicious.example.com', action: 'Block' },
    ] } }),
    create_indicator: () => writeOk({ id: simId('IOC') }),
    get_machine_alerts: () => ({ ok: true, data: { value: [{ id: simId('ALERT'), title: 'Simulated machine alert' }] } }),
  },

  'stellar-cyber': {
    list_alerts: () => ({ ok: true, data: { data: { hits: { hits: [
      { _id: simId('ALERT'), _source: { alert_name: 'Lateral Movement Detected', score: 87, src_ip: '10.0.1.50', created_at: past(0, 1) } },
      { _id: simId('ALERT'), _source: { alert_name: 'Suspicious DNS Query', score: 62, src_ip: '10.0.1.51', created_at: past(0, 3) } },
    ] } } } }),
    list_cases: () => ({ ok: true, data: { data: { hits: { hits: [
      { _id: simId('CASE'), _source: { name: 'Potential C2 Activity', status: 'open', created_at: past(1) } },
    ] } } } }),
    get_case: (p) => ({ ok: true, data: { data: { _id: p.case_id, _source: { name: 'Simulated Case', status: 'open' } } } }),
    get_alert: (p) => ({ ok: true, data: { data: { _id: p.alert_id, _source: { alert_name: 'Simulated Alert', score: 80 } } } }),
    update_alert_status: () => writeOk(),
    update_case: () => writeOk({ id: simId('CASE') }),
    create_case: () => writeOk({ id: simId('CASE') }),
    close_case: () => writeOk(),
    add_case_comment: () => writeOk({ id: simId('CMT') }),
    list_sensors: () => ({ ok: true, data: { data: { hits: { hits: [
      { _id: simId('SENSOR'), _source: { name: 'prod-sensor-01', type: 'network', status: 'active' } },
    ] } } } }),
    get_sensor: (p) => ({ ok: true, data: { data: { _id: p.sensor_id, _source: { name: 'prod-sensor-01', status: 'active' } } } }),
    search_events: () => ({ ok: true, data: { data: { hits: { hits: [
      { _id: simId('EVT'), _source: { event_type: 'network', src_ip: '10.0.1.5', dst_ip: '8.8.8.8', ts: past(0, 1) } },
    ], total: 1 } } } }),
    create_alert_exception: () => writeOk({ id: simId('EXC') }),
    run_threat_hunt: () => ({ ok: true, data: { data: { hits: { total: 0, hits: [] } } } }),
    list_threat_intelligence: () => ({ ok: true, data: { data: { hits: { hits: [] } } } }),
  },

  teams: {
    send_message: () => writeOk(),
    send_alert: () => writeOk(),
    send_facts_card: () => writeOk(),
    send_table_card: () => writeOk(),
    send_action_card: () => writeOk(),
    send_image_card: () => writeOk(),
    send_digest: () => writeOk(),
    send_incident_card: () => writeOk(),
  },

  netsuite: {
    run_suiteql: (p) => ({ ok: true, data: { items: [
      { id: simId(), tranid: 'INV-10001', entity_name: 'Acme Corp', amount: 15000.00 },
      { id: simId(), tranid: 'INV-10002', entity_name: 'GlobalTech', amount: 8500.00 },
    ], totalResults: 2, hasMore: false, links: [], offset: 0, count: 2, fields: [] } }),
    list_open_invoices: () => ({ ok: true, data: { items: [
      { id: simId(), tranid: 'INV-10001', customer: 'Acme Corp', trandate: past(10), duedate: past(-5), amount: 15000.00, balance: 15000.00 },
      { id: simId(), tranid: 'INV-10002', customer: 'GlobalTech', trandate: past(5), duedate: past(-1), amount: 8500.00, balance: 4250.00 },
    ] } }),
    get_financial_summary: () => ({ ok: true, data: {
      revenue: { total_revenue: 245000.00, invoice_count: 18 },
      accounts_receivable: { open_ar_balance: 47500.00, open_invoices: 4 },
      period_months: 1,
    } }),
    list_customers: () => ({ ok: true, data: { items: [
      { id: '1001', name: 'Acme Corp', email: 'billing@acme.com', phone: '+1-555-0100' },
      { id: '1002', name: 'GlobalTech', email: 'accounts@globaltech.io', phone: '+1-555-0200' },
    ] } }),
    list_vendors: () => ({ ok: true, data: { items: [
      { id: '2001', name: 'Cloud Hosting Co', email: 'billing@cloudhost.com' },
      { id: '2002', name: 'Office Supplies Inc', email: 'orders@officesupplies.com' },
    ] } }),
    list_purchase_orders: () => ({ ok: true, data: { items: [
      { id: simId(), po_number: 'PO-001', vendor: 'Cloud Hosting Co', amount: 4200.00, status: 'PurchOrd:B' },
    ] } }),
    list_sales_orders: () => ({ ok: true, data: { items: [
      { id: simId(), so_number: 'SO-001', customer: 'Acme Corp', amount: 22500.00, status: 'SalesOrd:B' },
    ] } }),
    get_transaction: (p) => ({ ok: true, data: { items: [{ id: simId(), tranid: p.identifier ?? 'INV-10001', type: 'Invoice', amount: 15000.00 }] } }),
    list_employees: () => ({ ok: true, data: { items: [
      { id: simId(), name: 'Alice Smith', email: 'alice@example.com', title: 'VP Engineering' },
      { id: simId(), name: 'Bob Jones', email: 'bob@example.com', title: 'Software Engineer' },
    ] } }),
    list_items: () => ({ ok: true, data: { items: [
      { id: simId(), item_number: 'ITEM-001', name: 'Professional Services', itemtype: 'Service', price: 150.00 },
      { id: simId(), item_number: 'ITEM-002', name: 'Software License', itemtype: 'NonInvtPart', price: 99.00 },
    ] } }),
    get_account_balance: (p) => ({ ok: true, data: { items: [
      { id: simId(), acctnumber: p.account_identifier ?? '1000', account_name: 'Cash', type: 'Bank' },
    ] } }),
    list_journal_entries: () => ({ ok: true, data: { items: [
      { id: simId(), tranid: 'JE-001', trandate: past(1), memo: 'Monthly depreciation', total: 5000.00 },
    ] } }),
    list_expense_reports: () => ({ ok: true, data: { items: [] } }),
    get_customer: () => ({ ok: true, data: { items: [{ id: '1001', name: 'Acme Corp', email: 'billing@acme.com' }] } }),
    get_record: () => ({ ok: true, data: { id: simId(), label: 'Simulated record' } }),
  },

  plain: {
    list_threads: () => ({ ok: true, data: { threads: { edges: [
      { node: { id: simId('th'), title: 'API rate limits', status: 'TODO', priority: 2, customer: { fullName: 'Alice Smith', email: { email: 'alice@example.com' } } } },
      { node: { id: simId('th'), title: 'Billing question', status: 'TODO', priority: 3, customer: { fullName: 'Bob Jones', email: { email: 'bob@example.com' } } } },
    ] } } }),
    get_thread: (p) => ({ ok: true, data: { thread: { id: p.thread_id ?? simId('th'), title: 'Simulated thread', status: 'TODO', priority: 2, customer: { fullName: 'Alice Smith' } } } }),
    get_customer: (p) => ({ ok: true, data: { customerByEmail: { id: simId('cust'), fullName: 'Alice Smith', email: { email: p.email ?? 'alice@example.com' }, externalId: 'ext_001' } } }),
    list_customers: () => ({ ok: true, data: { customers: { edges: [
      { node: { id: simId('cust'), fullName: 'Alice Smith', email: { email: 'alice@example.com' } } },
      { node: { id: simId('cust'), fullName: 'Bob Jones', email: { email: 'bob@example.com' } } },
    ], totalCount: 2 } } }),
    create_customer: () => ({ ok: true, data: { upsertCustomer: { customer: { id: simId('cust') }, result: 'CREATED' } } }),
    update_customer: () => ({ ok: true, data: { upsertCustomer: { customer: { id: simId('cust') }, result: 'UPDATED' } } }),
    create_thread: () => ({ ok: true, data: { createThread: { thread: { id: simId('th'), status: 'TODO' } } } }),
    reply_to_thread: () => ({ ok: true, data: { replyToThread: { thread: { id: simId('th'), status: 'TODO' } } } }),
    add_note: () => ({ ok: true, data: { createNote: { note: { id: simId('note') } } } }),
    change_thread_status: () => ({ ok: true, data: { changeThreadStatus: { thread: { status: 'DONE' } } } }),
    assign_thread: () => ({ ok: true, data: { assignThreadToUser: { thread: { id: simId('th') } } } }),
    set_thread_priority: () => ({ ok: true, data: { setThreadPriority: { thread: { priority: 0 } } } }),
    list_labels: () => ({ ok: true, data: { labelTypes: { edges: [
      { node: { id: simId('lbl'), name: 'Bug', isArchived: false } },
      { node: { id: simId('lbl'), name: 'Feature Request', isArchived: false } },
      { node: { id: simId('lbl'), name: 'Billing', isArchived: false } },
    ], totalCount: 3 } } }),
    add_label: () => ({ ok: true, data: { addLabels: { labels: [{ id: simId('label') }] } } }),
    remove_label: () => ({ ok: true, data: { removeLabels: null } }),
    create_timeline_event: () => ({ ok: true, data: { createCustomerEvent: { customerEvent: { id: simId('evt') } } } }),
    list_workspace_users: () => ({ ok: true, data: { users: { edges: [
      { node: { id: simId('usr'), fullName: 'Alice Smith', email: { email: 'alice@example.com' } } },
    ] } } }),
    search_threads: () => ({ ok: true, data: { threads: { edges: [], totalCount: 0 } } }),
    get_workspace: () => ({ ok: true, data: { workspace: { id: simId('ws'), name: 'Simulated Workspace', publicName: 'Demo' } } }),
  },

  lodgify: {
    list_properties: () => ({ ok: true, data: [
      { id: 101, name: 'Beachfront Villa', address: '123 Ocean Drive', type: 'villa' },
      { id: 102, name: 'Mountain Cabin', address: '456 Pine Ridge', type: 'cabin' },
    ] }),
    list_bookings: () => ({ ok: true, data: [
      { id: 50001, arrival: past(-2), departure: past(-5), guest_name: 'John Smith', total_price: 1200, status: 'confirmed', property_id: 101 },
      { id: 50002, arrival: past(3), departure: past(7), guest_name: 'Sarah Johnson', total_price: 875, status: 'confirmed', property_id: 102 },
    ] }),
    get_booking: (p) => ({ ok: true, data: { id: p.booking_id ?? 50001, arrival: past(-2), departure: past(0), guest_name: 'John Smith', total_price: 1200 } }),
    get_availability: () => ({ ok: true, data: [] }),
    get_quote: (p) => ({ ok: true, data: { total: 875, per_night: 125, nights: 7, guests: p.guests ?? 2 } }),
    list_messages: () => ({ ok: true, data: { threads: [
      { booking_id: 50001, thread: { uid: 'th_' + simId(), subject: 'Booking #50001 — Beachfront Villa', messages: [
        { sender: 'John Smith', message: 'Hi! What time is check-in?', created_at: past(1, 2) },
        { sender: 'Host', message: 'Check-in is anytime after 3pm — the door code is in your arrival guide.', created_at: past(1, 1) },
      ] } },
      { booking_id: 50002, thread: { uid: 'th_' + simId(), subject: 'Booking #50002 — Mountain Cabin', messages: [
        { sender: 'Sarah Johnson', message: 'Is the hot tub available in July?', created_at: past(0, 6) },
      ] } },
    ] } }),
    send_message: () => writeOk(),
    create_booking: () => writeOk({ id: Math.floor(Math.random() * 90000) + 50000 }),
    cancel_booking: () => writeOk(),
    update_booking: () => writeOk(),
    list_guests: () => ({ ok: true, data: [
      { id: 1001, name: 'John Smith', email: 'john@example.com', phone: '+1-555-0100' },
      { id: 1002, name: 'Sarah Johnson', email: 'sarah@example.com', phone: '+1-555-0200' },
    ] }),
    get_guest: () => ({ ok: true, data: { id: 1001, name: 'John Smith', email: 'john@example.com' } }),
    create_guest: () => writeOk({ id: Math.floor(Math.random() * 9000) + 1000 }),
    list_rooms: () => ({ ok: true, data: [
      { id: 201, name: 'Master Suite', type: 'suite', max_guests: 4 },
      { id: 202, name: 'Garden Room', type: 'standard', max_guests: 2 },
    ] }),
    get_room: (p) => ({ ok: true, data: { id: p.room_id ?? 201, name: 'Master Suite', max_guests: 4 } }),
    block_dates: () => writeOk(),
    list_rates: () => ({ ok: true, data: [{ id: 301, name: 'Standard Rate', price: 125 }] }),
    update_rate: () => writeOk(),
    get_property: () => ({ ok: true, data: { id: 101, name: 'Beachfront Villa', address: '123 Ocean Drive' } }),
    get_revenue_report: () => ({ ok: true, data: { total_revenue: 15600, average_daily_rate: 125, occupancy_rate: 0.72, booking_count: 12 } }),
    list_transactions: () => ({ ok: true, data: [] }),
    send_invoice: () => writeOk(),
  },

  'eufy-security': {
    list_devices: () => ({ ok: true, data: [
      { device_sn: 'T8600P' + simId().slice(0, 8).toUpperCase(), device_name: 'Front Door Camera', device_type: 2, online: true },
      { device_sn: 'T8600P' + simId().slice(0, 8).toUpperCase(), device_name: 'Backyard Camera', device_type: 2, online: true },
    ] }),
    list_stations: () => ({ ok: true, data: [
      { station_sn: 'T8010P' + simId().slice(0, 8).toUpperCase(), station_name: 'HomeBase 2', online: true, guard_mode: 2 },
    ] }),
    get_device_status: () => ({ ok: true, data: { online: true, battery_level: 85, wifi_signal: -55, guard_mode: 2 } }),
    list_events: () => ({ ok: true, data: [
      { event_id: simId('ev'), device_name: 'Front Door Camera', event_type: 3, start_time: past(0, 1), end_time: past(0, 1) },
    ] }),
    set_guard_mode: () => writeOk(),
    start_stream: () => writeOk({ url: 'rtmp://sim.stream.example.com/live/' + simId() }),
    stop_stream: () => writeOk(),
    trigger_alarm: () => writeOk(),
    stop_alarm: () => writeOk(),
    enable_motion_detection: () => writeOk(),
    disable_motion_detection: () => writeOk(),
    set_motion_sensitivity: () => writeOk(),
    get_event_thumbnail: () => ({ ok: true, data: { url: 'https://example.com/sim-thumb-' + simId() + '.jpg' } }),
    list_clips: () => ({ ok: true, data: [
      { clip_id: simId('clip'), start_time: past(0, 2), duration: 15, device_sn: 'T8600P' + simId().slice(0, 6).toUpperCase() },
    ] }),
    delete_events: () => writeOk({ deleted: 1 }),
    get_home_info: () => ({ ok: true, data: [{ home_id: simId('home'), home_name: 'My Home', station_count: 1, device_count: 2 }] }),
    list_shared_users: () => ({ ok: true, data: [] }),
    reboot_device: () => writeOk(),
  },
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * True when a connector + action has bespoke simulated data. When false,
 * simulateAction() falls back to a generic stub — which is fine for an unknown
 * connector, but a regression for a real connector's declared action.
 * The parity test (scripts/test-sim-parity.mjs) uses this to fail on drift.
 */
export function hasSimulatedData(connectorSlug: string, actionSlug: string): boolean {
  return Boolean(DATA[connectorSlug]?.[actionSlug])
}

/**
 * Returns simulated action result for a connector + action combo.
 * All write actions return a generic success. Read actions return realistic fake data.
 */
export function simulateAction(
  connectorSlug: string,
  actionSlug: string,
  params: Record<string, unknown>
): ActionResult {
  const connData = DATA[connectorSlug]
  if (connData) {
    const fn = connData[actionSlug]
    if (fn) return fn(params)
  }
  // Generic fallback — only reached when an action has no curated shape AND the
  // AI generator in lib/sim-engine.ts was unavailable. Keep it neutral and free
  // of any "simulated" wording so it never breaks the sandbox illusion.
  return { ok: true, data: { status: 'ok', items: [] } }
}
