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

export const BUILTIN_BUNDLES: BundleManifest[] = [SECURITY_SOC, SUPPORT_OPS, PROPERTY_MGMT]

export function getBuiltinBundle(slug: string): BundleManifest | undefined {
  return BUILTIN_BUNDLES.find(b => b.slug === slug)
}
