// Audience-specific marketing pages. Connector slugs must exist in
// connectors/catalog.ts and bundle slugs in lib/bundle-registry.ts —
// both are cross-checked at render time so a rename can't leave a
// solutions page pointing at nothing.

export interface Solution {
  slug: string
  nav: string
  headline: string
  sub: string
  pains: string[]
  missions: { prompt: string; outcome: string }[]
  connectorSlugs: string[]
  bundleSlug: string
  bundleName: string
  bundlePitch: string
}

export const SOLUTIONS: Solution[] = [
  {
    slug: 'security',
    nav: 'Security teams',
    headline: 'A SOC analyst that never sleeps',
    sub: 'Triage detections, contain endpoints, open incidents, and page on-call — with a human approval on every destructive move.',
    pains: [
      'Overnight alerts pile up until a human logs in',
      'Every tool has its own console, query language, and login',
      'Containment decisions bottleneck on whoever is awake',
    ],
    missions: [
      {
        prompt: 'Any critical detections overnight? Contain affected hosts and open an incident for each.',
        outcome: 'CrowdStrike queried, two incidents opened in ServiceNow, containment queued for one-tap approval.',
      },
      {
        prompt: 'Summarize this week\'s detections by severity and post the digest to the SOC channel.',
        outcome: 'Cross-tool digest built and posted to Slack — no console-hopping.',
      },
    ],
    connectorSlugs: ['crowdstrike', 'sentinelone', 'sophos', 'microsoft-defender', 'stellar-cyber', 'servicenow', 'pagerduty', 'slack'],
    bundleSlug: 'security-soc',
    bundleName: 'Security SOC',
    bundlePitch: 'EDR + incident management + paging + chat, pre-wired with triage playbooks and a SOC Analyst skill — installed in one click, entirely in Simulated mode if you want to evaluate it first.',
  },
  {
    slug: 'support',
    nav: 'Support teams',
    headline: 'SLAs that defend themselves',
    sub: 'Watch the queue, draft replies, escalate breaches, and keep the team posted — before customers notice the wait.',
    pains: [
      'SLA breaches are discovered after they happen',
      'Agents burn time re-typing the same first responses',
      'Escalations depend on someone watching a dashboard',
    ],
    missions: [
      {
        prompt: 'Find tickets about to breach SLA, draft replies, and post a summary to Slack.',
        outcome: 'Four at-risk tickets found, replies drafted for agent review, escalation channel notified.',
      },
      {
        prompt: 'Every morning at 8, brief me on overnight tickets by priority.',
        outcome: 'A scheduled skill delivers the digest daily — no prompt needed.',
      },
    ],
    connectorSlugs: ['zendesk', 'plain', 'sendgrid', 'slack', 'teams', 'twilio'],
    bundleSlug: 'support-ops',
    bundleName: 'Support Ops',
    bundlePitch: 'Ticketing + email + chat with an SLA Breach Watch playbook and a Support Triage skill out of the box — try the whole loop on simulated tickets first.',
  },
  {
    slug: 'finance',
    nav: 'Finance & ops',
    headline: 'Your books, on patrol',
    sub: 'Chase overdue invoices, watch billing failures, and turn ERP data into answers — in plain English, not SuiteQL.',
    pains: [
      'Overdue invoices slip until month-end review',
      'ERP queries require a specialist (or a support ticket)',
      'Billing failures surface as churn, not alerts',
    ],
    missions: [
      {
        prompt: 'Show open critical invoices over $50k, email me a summary, and post it to Teams.',
        outcome: 'NetSuite queried, summary emailed via SendGrid, channel notified — three APIs, one sentence.',
      },
      {
        prompt: 'Nudge every customer 14+ days overdue with a polite reminder, and escalate 30+ days to me.',
        outcome: 'Dunning handled on schedule, escalations arrive with full context.',
      },
    ],
    connectorSlugs: ['netsuite', 'quickbooks-online', 'sendgrid', 'twilio', 'slack', 'teams'],
    bundleSlug: 'billing-dunning',
    bundleName: 'Billing & Dunning',
    bundlePitch: 'ERP + email + SMS wired into overdue-invoice patrols and escalation playbooks — evaluate it on simulated financials before it touches a real ledger.',
  },
]
