import type { BundleManifest } from '@/lib/bundles'

// ============================================================
// Feature #7 — Vertical bundles (code-defined)
// ============================================================
// Runnable-out-of-the-box suites: each installs connections + a group +
// pre-built playbooks (with severity-driven autonomy) + skills + personas.
// Action steps reference connectors by slug; installBundle remaps them to
// the created connection ids. Connections install needing credentials —
// the playbooks/skills/personas are the land-and-expand value.
// ============================================================

const SECURITY_SOC: BundleManifest = {
  slug: 'security-soc',
  name: 'Security SOC',
  description: 'A security operations bundle: EDR + alerting + comms, wired into severity-driven response playbooks and an AI SOC analyst.',
  category: 'Security',
  version: '1.0.0',
  connectors: [
    { slug: 'crowdstrike', role: 'EDR / endpoint', alternatives: ['sentinelone', 'sophos', 'microsoft-defender'] },
    { slug: 'microsoft-defender', role: 'Threat & vuln intel', alternatives: ['stellar-cyber'] },
    { slug: 'pagerduty', role: 'On-call paging', alternatives: ['servicenow'] },
    { slug: 'slack', role: 'Team chat', alternatives: ['teams'] },
  ],
  groups: [
    { key: 'soc', name: 'Security SOC', color: '#ef4444',
      connectorSlugs: ['crowdstrike', 'microsoft-defender', 'pagerduty', 'slack'] },
  ],
  playbooks: [
    {
      name: 'Critical Detection Response',
      description: 'Assess incoming detections, auto-contain the host on critical severity, require approval otherwise.',
      persona: 'You are a senior SOC analyst. You triage EDR detections decisively and contain real threats fast.',
      groupKey: 'soc',
      trigger_type: 'manual',
      autonomy_policy: { thresholds: [
        { min: 9, max: 10, mode: 'auto' },
        { min: 6, max: 8, mode: 'approval' },
        { min: 0, max: 5, mode: 'notify' },
      ] },
      definition: { steps: [
        { id: 'assess', name: 'Triage detections', type: 'assess',
          prompt: 'List the latest CrowdStrike detections. Judge the worst one\'s severity (0–10) based on tactic, confidence, and affected host criticality.',
          next: 'contain' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ id: 'contain', name: 'Contain affected host', type: 'action',
          connector_slug: 'crowdstrike', action_slug: 'contain_host', next: 'notify' } as any),
        { id: 'notify', name: 'Notify the SOC channel', type: 'notify',
          message: 'Critical Detection Response ran (severity {{state.severity}}): {{state.assessment}}' },
      ] },
    },
    {
      name: 'Endpoint Isolation (approval chain)',
      description: 'A deliberate isolation flow that always pauses for a human before isolating an endpoint.',
      persona: 'You are a SOC analyst preparing an endpoint isolation for human review.',
      groupKey: 'soc',
      trigger_type: 'manual',
      definition: { steps: [
        { id: 'assess', name: 'Gather host context', type: 'assess',
          prompt: 'Summarize the host, its recent detections, and why isolation is being considered.', next: 'approve' },
        { id: 'approve', name: 'Human approval to isolate', type: 'approval', next: 'isolate' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ id: 'isolate', name: 'Isolate endpoint', type: 'action',
          connector_slug: 'crowdstrike', action_slug: 'contain_host', next: 'notify' } as any),
        { id: 'notify', name: 'Confirm isolation', type: 'notify', message: 'Endpoint isolated after approval: {{state.assessment}}' },
      ] },
    },
  ],
  skills: [
    { name: 'SOC Analyst', groupKey: 'soc', autonomy: 'supervised',
      description: 'Triages detections across EDR tools and notifies the team.',
      persona: 'You are an AI SOC analyst. Query CrowdStrike, SentinelOne, and Defender for active threats, correlate them, and post a concise summary to Slack. Page on-call via PagerDuty only for critical, confirmed threats.' },
  ],
}

const SUPPORT_OPS: BundleManifest = {
  slug: 'support-ops',
  name: 'Support Ops',
  description: 'Ticketing + comms wired into SLA monitoring and an AI support triage agent.',
  category: 'CRM & Support',
  version: '1.0.0',
  connectors: [
    { slug: 'zendesk', role: 'Ticketing', alternatives: ['plain', 'servicenow'] },
    { slug: 'sendgrid', role: 'Email' },
    { slug: 'slack', role: 'Team chat', alternatives: ['teams'] },
  ],
  groups: [
    { key: 'support', name: 'Support Ops', color: '#0ea5e9', connectorSlugs: ['zendesk', 'sendgrid', 'slack'] },
  ],
  playbooks: [
    {
      name: 'SLA Breach Watch',
      description: 'Assess open tickets for SLA risk and escalate the urgent ones.',
      persona: 'You are a support operations lead watching for SLA breaches.',
      groupKey: 'support',
      trigger_type: 'schedule',
      schedule: '0 * * * *',
      definition: { steps: [
        { id: 'assess', name: 'Scan ticket queue', type: 'assess',
          prompt: 'Review open tickets. Score severity by how close the most at-risk ticket is to breaching SLA.', next: 'notify' },
        { id: 'notify', name: 'Escalate to Slack', type: 'notify', message: 'SLA watch (severity {{state.severity}}): {{state.assessment}}' },
      ] },
    },
  ],
  skills: [
    { name: 'Support Triage', groupKey: 'support', autonomy: 'supervised',
      description: 'Reads incoming tickets, drafts responses, routes by topic.',
      persona: 'You are an AI support agent. Read new tickets from the connected help desk, summarize the issue, draft a reply, and flag anything needing human attention in Slack.' },
  ],
}

const PROPERTY_MGMT: BundleManifest = {
  slug: 'property-management',
  name: 'Property Management',
  description: 'Short-term-rental ops: bookings + guest comms wired into a check-in concierge.',
  category: 'Short-Term Rental',
  version: '1.0.0',
  connectors: [
    { slug: 'lodgify', role: 'Bookings / PMS' },
    { slug: 'twilio', role: 'SMS' },
    { slug: 'sendgrid', role: 'Email' },
    { slug: 'slack', role: 'Team chat', alternatives: ['teams'] },
  ],
  groups: [
    { key: 'pm', name: 'Property Management', color: '#10b981', connectorSlugs: ['lodgify', 'twilio', 'sendgrid', 'slack'] },
  ],
  playbooks: [
    {
      name: 'Daily Arrivals Briefing',
      description: 'Each morning, assess today\'s check-ins and brief the team.',
      persona: 'You are a property operations coordinator.',
      groupKey: 'pm',
      trigger_type: 'schedule',
      schedule: '0 8 * * *',
      definition: { steps: [
        { id: 'assess', name: 'Review today\'s arrivals', type: 'assess',
          prompt: 'List today\'s Lodgify check-ins and note anything needing attention (late arrivals, special requests).', next: 'notify' },
        { id: 'notify', name: 'Post the briefing', type: 'notify', message: 'Today\'s arrivals: {{state.assessment}}' },
      ] },
    },
  ],
  skills: [
    { name: 'Check-in Concierge', groupKey: 'pm', autonomy: 'supervised',
      description: 'Sends check-in instructions and answers guest questions.',
      persona: 'You are a guest concierge. For today\'s Lodgify arrivals, send warm check-in instructions via SMS (Twilio) and email (SendGrid), and surface any issues to Slack.' },
  ],
}

// ── Finance ───────────────────────────────────────────────────────────────────
const ACCOUNTANT: BundleManifest = {
  slug: 'accountant',
  name: 'Accountant',
  description: 'Your books on autopilot — chase overdue invoices, draft dunning emails, and get a weekly financial brief.',
  category: 'Finance',
  version: '1.0.0',
  connectors: [
    { slug: 'netsuite', role: 'Accounting / ERP', alternatives: ['quickbooks-online'] },
    { slug: 'sendgrid', role: 'Email' },
    { slug: 'slack', role: 'Team chat', alternatives: ['teams'] },
  ],
  groups: [{ key: 'acct', name: 'Accounting', color: '#16a34a', connectorSlugs: ['netsuite', 'sendgrid', 'slack'] }],
  playbooks: [{
    name: 'Overdue Invoice Chaser',
    description: 'Each morning, review open invoices and surface the ones past due for follow-up.',
    persona: 'You are a meticulous accounts-receivable clerk.',
    groupKey: 'acct',
    trigger_type: 'schedule',
    schedule: '0 9 * * *',
    definition: { steps: [
      { id: 'assess', name: 'Review open invoices', type: 'assess',
        prompt: 'List open invoices and identify which are past their due date and by how much. Score severity by total overdue amount and days late.', next: 'notify' },
      { id: 'notify', name: 'Post AR summary', type: 'notify', message: 'Overdue AR (severity {{state.severity}}): {{state.assessment}}' },
    ] },
  }],
  skills: [
    { name: 'AR Clerk', groupKey: 'acct', autonomy: 'supervised',
      description: 'Tracks receivables and drafts payment reminders.',
      persona: 'You are an AI accounts-receivable clerk. Review open invoices, identify overdue accounts, draft polite-but-firm payment-reminder emails (SendGrid), and summarize collections risk in Slack.' },
    { name: 'Financial Reporter', groupKey: 'acct', autonomy: 'supervised',
      description: 'Compiles periodic financial summaries.',
      persona: 'You are an AI financial analyst. Pull revenue, AR balance, and open invoices, then write a concise weekly financial brief and post it to Slack.' },
  ],
}

const PAYROLL_PAYSTUBS: BundleManifest = {
  slug: 'payroll-paystubs',
  name: 'Payroll & Paystubs',
  description: 'Run-day helper — prep the payroll summary, distribute paystubs, and flag anything that looks off.',
  category: 'Finance',
  version: '1.0.0',
  connectors: [
    { slug: 'quickbooks-online', role: 'Accounting / payroll', alternatives: ['netsuite'] },
    { slug: 'sendgrid', role: 'Paystub email' },
    { slug: 'slack', role: 'Team chat', alternatives: ['teams'] },
  ],
  groups: [{ key: 'pay', name: 'Payroll', color: '#0891b2', connectorSlugs: ['quickbooks-online', 'sendgrid', 'slack'] }],
  playbooks: [{
    name: 'Payroll Run Summary',
    description: 'Summarize the upcoming payroll run and surface anomalies before approval.',
    persona: 'You are a payroll coordinator who double-checks every run.',
    groupKey: 'pay',
    trigger_type: 'schedule',
    schedule: '0 8 * * 5',
    definition: { steps: [
      { id: 'assess', name: 'Review payroll figures', type: 'assess',
        prompt: 'Summarize this pay period: total payroll, headcount, and any figures that look unusual versus a normal run. Score severity by size of any anomaly.', next: 'notify' },
      { id: 'notify', name: 'Post payroll summary', type: 'notify', message: 'Payroll run summary (severity {{state.severity}}): {{state.assessment}}' },
    ] },
  }],
  skills: [
    { name: 'Payroll Assistant', groupKey: 'pay', autonomy: 'supervised',
      description: 'Preps payroll, distributes paystubs, flags discrepancies.',
      persona: 'You are an AI payroll assistant. Prepare the payroll run summary, email each employee their paystub via SendGrid, and flag any discrepancies (missing hours, unusual amounts) in Slack for human review before anything is finalized.' },
  ],
}

const BILLING_DUNNING: BundleManifest = {
  slug: 'billing-dunning',
  name: 'Billing & Dunning',
  description: 'Recover revenue automatically — find overdue balances and run a polite multi-channel reminder sequence.',
  category: 'Finance',
  version: '1.0.0',
  connectors: [
    { slug: 'quickbooks-online', role: 'Billing', alternatives: ['netsuite'] },
    { slug: 'sendgrid', role: 'Email' },
    { slug: 'twilio', role: 'SMS' },
    { slug: 'slack', role: 'Team chat', alternatives: ['teams'] },
  ],
  groups: [{ key: 'bill', name: 'Billing', color: '#ca8a04', connectorSlugs: ['quickbooks-online', 'sendgrid', 'twilio', 'slack'] }],
  playbooks: [{
    name: 'Dunning Sequence',
    description: 'Find overdue balances and escalate reminders by how late they are.',
    persona: 'You are a collections specialist who recovers revenue without burning customer goodwill.',
    groupKey: 'bill',
    trigger_type: 'schedule',
    schedule: '0 10 * * 1',
    autonomy_policy: { thresholds: [
      { min: 8, max: 10, mode: 'approval' },
      { min: 0, max: 7, mode: 'notify' },
    ] },
    definition: { steps: [
      { id: 'assess', name: 'Find overdue balances', type: 'assess',
        prompt: 'List overdue invoices and bucket them by days late (1–30, 31–60, 60+). Score severity by the oldest/largest overdue balance.', next: 'notify' },
      { id: 'notify', name: 'Report collections status', type: 'notify', message: 'Dunning run (severity {{state.severity}}): {{state.assessment}}' },
    ] },
  }],
  skills: [
    { name: 'Dunning Agent', groupKey: 'bill', autonomy: 'supervised',
      description: 'Sends staged payment reminders across email and SMS.',
      persona: 'You are an AI collections agent. Identify overdue invoices, send staged reminders — a gentle email (SendGrid) first, an SMS (Twilio) when very overdue — and escalate accounts 60+ days late to Slack for a human.' },
  ],
}

export const BUILTIN_BUNDLES: BundleManifest[] = [
  SECURITY_SOC, SUPPORT_OPS, PROPERTY_MGMT,
  ACCOUNTANT, PAYROLL_PAYSTUBS, BILLING_DUNNING,
]

export function getBuiltinBundle(slug: string): BundleManifest | undefined {
  return BUILTIN_BUNDLES.find(b => b.slug === slug)
}
