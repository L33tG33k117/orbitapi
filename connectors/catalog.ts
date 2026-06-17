// Metadata for all connectors in the OrbitAPI catalog.
// available: true = has a TypeScript manifest and can be connected.
// available: false = coming soon, shows "Request early access".

export interface CatalogEntry {
  slug: string
  name: string
  category: string
  description: string
  logoUrl?: string
  isSimulated?: boolean
  available: boolean
  badgeNew?: boolean
}

export const CATEGORY_ORDER = [
  'Security',
  'Incident Management',
  'Communication',
  'Finance',
  'CRM & Support',
  'Cloud & Infrastructure',
  'DevOps',
  'Productivity',
  'Short-Term Rental',
  'Smart Home',
  'Data & Analytics',
  'Simulated',
]

export const catalog: CatalogEntry[] = [
  // ── Security ──────────────────────────────────────────────────────────────
  { slug: 'crowdstrike',       name: 'CrowdStrike Falcon',        category: 'Security',              description: 'EDR — query detections, list hosts, and contain compromised endpoints.',                                        logoUrl: '/logos/crowdstrike.svg',  available: true,  badgeNew: true  },
  { slug: 'splunk',            name: 'Splunk',                    category: 'Security',              description: 'Search and analyze machine data from any source via Splunk Enterprise or Cloud.',                             available: false },
  { slug: 'microsoft-sentinel',name: 'Microsoft Sentinel',        category: 'Security',              description: 'Cloud-native SIEM with AI-powered threat detection and automated response.',                                  available: false },
  { slug: 'ibm-qradar',        name: 'IBM QRadar',                category: 'Security',              description: 'Enterprise SIEM for security intelligence and event correlation.',                                             available: false },
  { slug: 'elastic-siem',      name: 'Elastic SIEM',              category: 'Security',              description: 'Open and flexible SIEM built on the Elastic Stack.',                                                          available: false },
  { slug: 'sumo-logic',        name: 'Sumo Logic',                category: 'Security',              description: 'Cloud-native analytics for logs, metrics, and security insights.',                                            available: false },
  { slug: 'logrhythm',         name: 'LogRhythm',                 category: 'Security',              description: 'SIEM platform with integrated NDR, UEBA, and SOAR capabilities.',                                            available: false },
  { slug: 'sentinelone',       name: 'SentinelOne',               category: 'Security',              description: 'AI-powered EDR — threats, agents, network isolation, and automated response actions.',                        logoUrl: '/logos/sentinelone.svg',  available: true,  badgeNew: true  },
  { slug: 'sophos',            name: 'Sophos Central',            category: 'Security',              description: 'EDR & endpoint protection — alerts, endpoint health, threat quarantine, and isolation.',                         logoUrl: '/logos/sophos.svg',       available: true,  badgeNew: true  },
  { slug: 'stellar-cyber',     name: 'Stellar Cyber',             category: 'Security',              description: 'Open XDR SIEM — AI-powered threat detection, cases, alerts, and event investigation.',                          logoUrl: '/logos/stellar-cyber.svg', available: true, badgeNew: true  },
  { slug: 'carbon-black',      name: 'VMware Carbon Black',       category: 'Security',              description: 'Endpoint and workload protection with behavioral analysis.',                                                  available: false },
  { slug: 'microsoft-defender',name: 'Microsoft Defender',        category: 'Security',              description: 'EDR — alerts, machines, vulnerability exposure, investigations, and live response actions.',                    logoUrl: '/logos/microsoft-defender.svg', available: true, badgeNew: true },
  { slug: 'cortex-xdr',        name: 'Cortex XDR',                category: 'Security',              description: 'Palo Alto Networks XDR for endpoint, network, and cloud threat detection.',                                  available: false },
  { slug: 'okta',              name: 'Okta',                      category: 'Security',              description: 'Identity and access management — users, groups, apps, and authentication events.',                           available: false },
  { slug: 'azure-ad',          name: 'Azure Active Directory',    category: 'Security',              description: 'Microsoft identity platform for users, sign-ins, and conditional access.',                                   available: false },
  { slug: 'duo-security',      name: 'Duo Security',              category: 'Security',              description: 'MFA and zero-trust access verification for users and endpoints.',                                            available: false },
  { slug: 'cyberark',          name: 'CyberArk',                  category: 'Security',              description: 'Privileged access management — credentials, session monitoring, and just-in-time access.',                  available: false },
  { slug: 'hashicorp-vault',   name: 'HashiCorp Vault',           category: 'Security',              description: 'Secrets management, dynamic credentials, encryption as a service.',                                          available: false },
  { slug: 'palo-alto-xsoar',   name: 'Palo Alto XSOAR',           category: 'Security',              description: 'SOAR platform for security orchestration, automation, and response playbooks.',                              available: false },
  { slug: 'wiz',               name: 'Wiz',                       category: 'Security',              description: 'Cloud security posture — risks, misconfigurations, and vulnerability prioritization.',                       available: false },
  { slug: 'orca-security',     name: 'Orca Security',             category: 'Security',              description: 'Agentless cloud security for AWS, Azure, and GCP workloads.',                                               available: false },
  { slug: 'qualys',            name: 'Qualys VMDR',               category: 'Security',              description: 'Vulnerability management, detection, and response across all assets.',                                       available: false },
  { slug: 'tenable',           name: 'Tenable.io',                category: 'Security',              description: 'Exposure management and vulnerability scanning across cloud and on-prem.',                                   available: false },
  { slug: 'rapid7',            name: 'Rapid7 InsightVM',          category: 'Security',              description: 'Vulnerability risk management with live threat analysis.',                                                    available: false },
  { slug: 'virustotal',        name: 'VirusTotal',                category: 'Security',              description: 'Threat intelligence — file, URL, domain, and IP reputation lookups.',                                       available: false },
  { slug: 'proofpoint',        name: 'Proofpoint',                category: 'Security',              description: 'Email security, advanced threat protection, and phishing defense.',                                          available: false },
  { slug: 'knowbe4',           name: 'KnowBe4',                   category: 'Security',              description: 'Security awareness training metrics and phishing simulation results.',                                        available: false },

  // ── Incident Management ───────────────────────────────────────────────────
  { slug: 'pagerduty',         name: 'PagerDuty',                 category: 'Incident Management',   description: 'Trigger, acknowledge, and resolve incidents via the Events v2 API.',                  logoUrl: '/logos/pagerduty.svg',    available: true  },
  { slug: 'servicenow',        name: 'ServiceNow',                category: 'Incident Management',   description: 'ITSM — create, update, and query incidents, problems, change requests, and CIs.',     logoUrl: '/logos/servicenow.svg',   available: true,  badgeNew: true  },
  { slug: 'opsgenie',          name: 'OpsGenie',                  category: 'Incident Management',   description: 'Alert management and on-call scheduling with intelligent deduplication.',              available: false },
  { slug: 'jira-service',      name: 'Jira Service Management',   category: 'Incident Management',   description: 'IT service desk with issues, queues, SLA tracking, and approvals.',                   available: false },
  { slug: 'freshservice',      name: 'Freshservice',              category: 'Incident Management',   description: 'Cloud ITSM for IT teams — tickets, assets, changes, and CMDB.',                      available: false },
  { slug: 'xmatters',          name: 'xMatters',                  category: 'Incident Management',   description: 'Digital service availability and incident communication platform.',                    available: false },

  // ── Communication ─────────────────────────────────────────────────────────
  { slug: 'slack',             name: 'Slack',                     category: 'Communication',         description: 'Send messages and structured alerts to Slack channels via Bot Token.',               logoUrl: '/logos/slack.svg',        available: true  },
  { slug: 'teams',             name: 'Microsoft Teams',           category: 'Communication',         description: 'Post messages and adaptive cards to Teams channels via Incoming Webhook.',            logoUrl: '/logos/teams.svg',        available: true,  badgeNew: true  },
  { slug: 'twilio',            name: 'Twilio',                    category: 'Communication',         description: 'Send SMS and WhatsApp messages to any phone number via the Twilio API.',             logoUrl: '/logos/twilio.svg',       available: true,  badgeNew: true  },
  { slug: 'sendgrid',          name: 'SendGrid',                  category: 'Communication',         description: 'Send transactional and alert emails via SendGrid\'s Email API.',                     logoUrl: '/logos/sendgrid.svg',     available: true,  badgeNew: true  },
  { slug: 'mailchimp',         name: 'Mailchimp',                 category: 'Communication',         description: 'Email marketing — audience management, campaigns, and subscriber stats.',            available: false },
  { slug: 'postmark',          name: 'Postmark',                  category: 'Communication',         description: 'Fast, reliable transactional email with delivery analytics.',                        available: false },
  { slug: 'intercom',          name: 'Intercom',                  category: 'Communication',         description: 'Customer messaging — conversations, contacts, and support automation.',              available: false },
  { slug: 'vonage',            name: 'Vonage (Nexmo)',            category: 'Communication',         description: 'Programmable voice, SMS, and video communications API.',                             available: false },
  { slug: 'whatsapp-business', name: 'WhatsApp Business',         category: 'Communication',         description: 'Send templated and session messages via the WhatsApp Business API.',                available: false },

  // ── Finance ───────────────────────────────────────────────────────────────
  { slug: 'netsuite',          name: 'NetSuite',                  category: 'Finance',               description: 'ERP — run SuiteQL, query financials, invoices, transactions, and customer records.', logoUrl: '/logos/netsuite.svg',     available: true,  badgeNew: true  },
  { slug: 'quickbooks',        name: 'QuickBooks Online',         category: 'Finance',               description: 'Accounting — invoices, expenses, reports, and customer/vendor records.',             available: false },
  { slug: 'xero',              name: 'Xero',                      category: 'Finance',               description: 'Cloud accounting — invoices, bank reconciliation, and financial reports.',           available: false },
  { slug: 'stripe',            name: 'Stripe',                    category: 'Finance',               description: 'Payment processing — charges, customers, subscriptions, and dispute management.',   available: false },
  { slug: 'sage-intacct',      name: 'Sage Intacct',              category: 'Finance',               description: 'Cloud financial management for multi-entity and multi-currency organizations.',      available: false },
  { slug: 'freshbooks',        name: 'FreshBooks',                category: 'Finance',               description: 'Invoicing, time tracking, and accounting for small businesses.',                    available: false },
  { slug: 'zuora',             name: 'Zuora',                     category: 'Finance',               description: 'Subscription billing, revenue recognition, and recurring billing automation.',      available: false },
  { slug: 'chargebee',         name: 'Chargebee',                 category: 'Finance',               description: 'Subscription management, billing automation, and revenue lifecycle.',               available: false },

  // ── CRM & Support ─────────────────────────────────────────────────────────
  { slug: 'salesforce',        name: 'Salesforce',                category: 'CRM & Support',         description: 'CRM — accounts, contacts, opportunities, cases, and SOQL queries.',                 available: false },
  { slug: 'hubspot',           name: 'HubSpot',                   category: 'CRM & Support',         description: 'CRM — contacts, deals, companies, tickets, and marketing activity.',                available: false },
  { slug: 'zendesk',           name: 'Zendesk Support',           category: 'CRM & Support',         description: 'Customer support — tickets, users, organizations, SLA policies, and CSAT scores.',    logoUrl: '/logos/zendesk.svg',      available: true,  badgeNew: true  },
  { slug: 'plain',             name: 'Plain',                     category: 'CRM & Support',         description: 'Modern B2B customer support — threads, customers, timeline events, and triage workflows.', logoUrl: '/logos/plain.svg',       available: true,  badgeNew: true  },
  { slug: 'freshdesk',         name: 'Freshdesk',                 category: 'CRM & Support',         description: 'Cloud helpdesk — tickets, contacts, agents, and knowledge base articles.',         available: false },
  { slug: 'pipedrive',         name: 'Pipedrive',                 category: 'CRM & Support',         description: 'Sales pipeline management — deals, contacts, activities, and forecasting.',         available: false },
  { slug: 'monday',            name: 'Monday.com',                category: 'CRM & Support',         description: 'Work management — boards, items, timelines, and automations.',                      available: false },
  { slug: 'zoho-crm',          name: 'Zoho CRM',                  category: 'CRM & Support',         description: 'CRM — leads, contacts, accounts, deals, and analytics.',                           available: false },
  { slug: 'help-scout',        name: 'Help Scout',                category: 'CRM & Support',         description: 'Customer support — mailboxes, conversations, and customer profiles.',               available: false },

  // ── Cloud & Infrastructure ────────────────────────────────────────────────
  { slug: 'aws-cloudwatch',    name: 'AWS CloudWatch',            category: 'Cloud & Infrastructure', description: 'Monitor AWS resources — metrics, logs, alarms, and anomaly detection.',            available: false },
  { slug: 'aws-ssm',           name: 'AWS Systems Manager',       category: 'Cloud & Infrastructure', description: 'Run commands, patch instances, and manage EC2 fleets at scale.',                   available: false },
  { slug: 'azure-monitor',     name: 'Azure Monitor',             category: 'Cloud & Infrastructure', description: 'Full-stack observability for Azure resources, apps, and infrastructure.',          available: false },
  { slug: 'gcp-monitoring',    name: 'Google Cloud Monitoring',   category: 'Cloud & Infrastructure', description: 'Monitor GCP infrastructure, services, and application performance.',               available: false },
  { slug: 'datadog',           name: 'Datadog',                   category: 'Cloud & Infrastructure', description: 'Infrastructure monitoring, APM, logs, and security in a single platform.',         available: false },
  { slug: 'new-relic',         name: 'New Relic',                 category: 'Cloud & Infrastructure', description: 'Full-stack observability — metrics, distributed traces, logs, and errors.',       available: false },
  { slug: 'dynatrace',         name: 'Dynatrace',                 category: 'Cloud & Infrastructure', description: 'AI-powered observability and application security platform.',                      available: false },
  { slug: 'grafana',           name: 'Grafana',                   category: 'Cloud & Infrastructure', description: 'Open observability — dashboards, alerts, and data source queries.',                available: false },

  // ── DevOps ────────────────────────────────────────────────────────────────
  { slug: 'github',            name: 'GitHub',                    category: 'DevOps',                description: 'Repositories, issues, pull requests, Actions workflows, and releases.',             available: false },
  { slug: 'gitlab',            name: 'GitLab',                    category: 'DevOps',                description: 'Source control, CI/CD pipelines, issues, and merge requests.',                      available: false },
  { slug: 'jira',              name: 'Jira Software',             category: 'DevOps',                description: 'Agile project management — epics, stories, sprints, and boards.',                   available: false },
  { slug: 'confluence',        name: 'Confluence',                category: 'DevOps',                description: 'Team wiki — spaces, pages, templates, and collaborative documentation.',            available: false },
  { slug: 'circleci',          name: 'CircleCI',                  category: 'DevOps',                description: 'CI/CD pipelines — workflows, jobs, artifacts, and insights.',                       available: false },
  { slug: 'terraform-cloud',   name: 'Terraform Cloud',           category: 'DevOps',                description: 'Infrastructure as code — workspaces, runs, plans, and state management.',          available: false },
  { slug: 'argocd',            name: 'Argo CD',                   category: 'DevOps',                description: 'GitOps continuous delivery for Kubernetes — apps, sync status, and rollbacks.',    available: false },

  // ── Productivity ──────────────────────────────────────────────────────────
  { slug: 'gmail',             name: 'Gmail',                     category: 'Productivity',          description: 'Read, search, and send emails via the Gmail API.',                                   available: false },
  { slug: 'google-drive',      name: 'Google Drive',              category: 'Productivity',          description: 'Upload, list, download, and manage files in Google Drive.',                          available: false },
  { slug: 'google-calendar',   name: 'Google Calendar',           category: 'Productivity',          description: 'Read and create calendar events and check availability.',                            available: false },
  { slug: 'google-sheets',     name: 'Google Sheets',             category: 'Productivity',          description: 'Read and append rows to Google Sheets spreadsheets.',                               available: false },
  { slug: 'outlook',           name: 'Microsoft Outlook',         category: 'Productivity',          description: 'Read and send emails via Microsoft Graph.',                                          available: false },
  { slug: 'notion',            name: 'Notion',                    category: 'Productivity',          description: 'Read and write Notion databases, pages, and blocks via the API.',                   available: false },
  { slug: 'airtable',          name: 'Airtable',                  category: 'Productivity',          description: 'Read and write records in Airtable bases and tables.',                              available: false },
  { slug: 'asana',             name: 'Asana',                     category: 'Productivity',          description: 'Task management — projects, tasks, assignees, and due dates.',                      available: false },
  { slug: 'trello',            name: 'Trello',                    category: 'Productivity',          description: 'Kanban boards — cards, lists, members, and checklists.',                            available: false },

  // ── Short-Term Rental ─────────────────────────────────────────────────────
  { slug: 'lodgify',           name: 'Lodgify',                   category: 'Short-Term Rental',     description: 'Bookings, properties, availability, quotes, and guest messaging.',                  logoUrl: '/logos/lodgify.svg',      available: true  },
  { slug: 'hostaway',          name: 'Hostaway',                  category: 'Short-Term Rental',     description: 'Multi-channel vacation rental — bookings, messaging, and calendar sync.',           available: false },
  { slug: 'guesty',            name: 'Guesty',                    category: 'Short-Term Rental',     description: 'Property management platform for professional short-term rental operators.',        available: false },
  { slug: 'ownerrez',          name: 'OwnerRez',                  category: 'Short-Term Rental',     description: 'Vacation rental software — booking, messaging, and channel management.',           available: false },
  { slug: 'hostfully',         name: 'Hostfully',                 category: 'Short-Term Rental',     description: 'Guest guides, property management, and communications platform.',                  available: false },
  { slug: 'beds24',            name: 'Beds24',                    category: 'Short-Term Rental',     description: 'Booking and channel management for vacation rentals.',                              available: false },

  // ── Smart Home ────────────────────────────────────────────────────────────
  { slug: 'google-home',       name: 'Google Home / Nest',        category: 'Smart Home',            description: 'Control Nest thermostats, cameras, and Google Home smart devices.',                 available: false },
  { slug: 'philips-hue',       name: 'Philips Hue',               category: 'Smart Home',            description: 'Control Hue lights, scenes, and rooms via the local bridge API.',                  available: false },
  { slug: 'smartthings',       name: 'Samsung SmartThings',       category: 'Smart Home',            description: 'Control SmartThings devices, scenes, rules, and automations.',                     available: false },
  { slug: 'ecobee',            name: 'Ecobee',                    category: 'Smart Home',            description: 'Smart thermostat control, schedules, occupancy, and energy reports.',              available: false },
  { slug: 'august',            name: 'August Smart Lock',         category: 'Smart Home',            description: 'Lock/unlock August smart locks and view access event history.',                    available: false },
  { slug: 'eufy-security',     name: 'Eufy Security',             category: 'Smart Home',            description: 'Eufy Security cameras — list devices, view status, alarm control, motion detection, and manage events.', logoUrl: '/logos/eufy-security.svg', available: true, badgeNew: true },
  { slug: 'simulated-lights',  name: 'Simulated Lights',          category: 'Smart Home',            description: 'Virtual lighting system for demos — on/off, brightness, color, and scenes.',      logoUrl: '/logos/simulated-lights.svg', available: true, isSimulated: true },
  { slug: 'simulated-ring',    name: 'Simulated Ring',            category: 'Smart Home',            description: 'Virtual Ring doorbell and motion sensors for demos and skill testing.',            logoUrl: '/logos/simulated-ring.svg',   available: true, isSimulated: true },

  // ── Data & Analytics ──────────────────────────────────────────────────────
  { slug: 'snowflake',         name: 'Snowflake',                 category: 'Data & Analytics',      description: 'Run SQL queries against Snowflake data warehouses.',                                available: false },
  { slug: 'bigquery',          name: 'BigQuery',                  category: 'Data & Analytics',      description: 'Run analytics SQL queries against Google BigQuery datasets.',                       available: false },
  { slug: 'databricks',        name: 'Databricks',                category: 'Data & Analytics',      description: 'Run notebooks and SQL queries on Databricks workspaces.',                          available: false },
  { slug: 'tableau',           name: 'Tableau',                   category: 'Data & Analytics',      description: 'Access Tableau workbooks, views, and published data sources.',                     available: false },
  { slug: 'power-bi',          name: 'Power BI',                  category: 'Data & Analytics',      description: 'Query Power BI datasets, reports, and trigger dataset refreshes.',                 available: false },
]

export const AVAILABLE_SLUGS = new Set(catalog.filter(c => c.available).map(c => c.slug))

export function getCatalogEntry(slug: string): CatalogEntry | undefined {
  return catalog.find(c => c.slug === slug)
}
