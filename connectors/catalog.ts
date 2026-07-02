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
  'E-commerce',
  'Marketing',
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
  { slug: 'splunk',            name: 'Splunk',                    category: 'Security',              description: 'Search and analyze machine data from any source via Splunk Enterprise or Cloud.',                             logoUrl: '/logos/splunk.svg', available: true,  badgeNew: true },
  { slug: 'microsoft-sentinel',name: 'Microsoft Sentinel',        category: 'Security',              description: 'Cloud-native SIEM with AI-powered threat detection and automated response.',                                  logoUrl: '/logos/microsoft-sentinel.svg', available: true,  badgeNew: true },
  { slug: 'ibm-qradar',        name: 'IBM QRadar',                category: 'Security',              description: 'Enterprise SIEM for security intelligence and event correlation.',                                             logoUrl: '/logos/ibm-qradar.svg', available: true,  badgeNew: true },
  { slug: 'elastic-siem',      name: 'Elastic SIEM',              category: 'Security',              description: 'Open and flexible SIEM built on the Elastic Stack.',                                                          logoUrl: '/logos/elastic-siem.svg', available: true,  badgeNew: true },
  { slug: 'sumo-logic',        name: 'Sumo Logic',                category: 'Security',              description: 'Cloud-native analytics for logs, metrics, and security insights.',                                            logoUrl: '/logos/sumo-logic.svg', available: true,  badgeNew: true },
  { slug: 'logrhythm',         name: 'LogRhythm',                 category: 'Security',              description: 'SIEM platform with integrated NDR, UEBA, and SOAR capabilities.',                                            logoUrl: '/logos/logrhythm.svg', available: true,  badgeNew: true },
  { slug: 'sentinelone',       name: 'SentinelOne',               category: 'Security',              description: 'AI-powered EDR — threats, agents, network isolation, and automated response actions.',                        logoUrl: '/logos/sentinelone.svg',  available: true,  badgeNew: true  },
  { slug: 'sophos',            name: 'Sophos Central',            category: 'Security',              description: 'EDR & endpoint protection — alerts, endpoint health, threat quarantine, and isolation.',                         logoUrl: '/logos/sophos.svg',       available: true,  badgeNew: true  },
  { slug: 'stellar-cyber',     name: 'Stellar Cyber',             category: 'Security',              description: 'Open XDR SIEM — AI-powered threat detection, cases, alerts, and event investigation.',                          logoUrl: '/logos/stellar-cyber.svg', available: true, badgeNew: true  },
  { slug: 'carbon-black',      name: 'VMware Carbon Black',       category: 'Security',              description: 'Endpoint and workload protection with behavioral analysis.',                                                  logoUrl: '/logos/carbon-black.svg', available: true,  badgeNew: true },
  { slug: 'microsoft-defender',name: 'Microsoft Defender',        category: 'Security',              description: 'EDR — alerts, machines, vulnerability exposure, investigations, and live response actions.',                    logoUrl: '/logos/microsoft-defender.svg', available: true, badgeNew: true },
  { slug: 'cortex-xdr',        name: 'Cortex XDR',                category: 'Security',              description: 'Palo Alto Networks XDR for endpoint, network, and cloud threat detection.',                                  logoUrl: '/logos/cortex-xdr.svg', available: true,  badgeNew: true },
  { slug: 'okta',              name: 'Okta',                      category: 'Security',              description: 'Identity and access management — users, groups, apps, and authentication events.',                           logoUrl: '/logos/okta.svg', available: true,  badgeNew: true },
  { slug: 'azure-ad',          name: 'Azure Active Directory',    category: 'Security',              description: 'Microsoft identity platform for users, sign-ins, and conditional access.',                                   logoUrl: '/logos/azure-ad.svg', available: true,  badgeNew: true },
  { slug: 'duo-security',      name: 'Duo Security',              category: 'Security',              description: 'MFA and zero-trust access verification for users and endpoints.',                                            logoUrl: '/logos/duo-security.svg', available: true,  badgeNew: true },
  { slug: 'cyberark',          name: 'CyberArk',                  category: 'Security',              description: 'Privileged access management — credentials, session monitoring, and just-in-time access.',                  logoUrl: '/logos/cyberark.svg', available: true,  badgeNew: true },
  { slug: 'hashicorp-vault',   name: 'HashiCorp Vault',           category: 'Security',              description: 'Secrets management, dynamic credentials, encryption as a service.',                                          logoUrl: '/logos/hashicorp-vault.svg', available: true,  badgeNew: true },
  { slug: 'palo-alto-xsoar',   name: 'Palo Alto XSOAR',           category: 'Security',              description: 'SOAR platform for security orchestration, automation, and response playbooks.',                              logoUrl: '/logos/palo-alto-xsoar.svg', available: true,  badgeNew: true },
  { slug: 'wiz',               name: 'Wiz',                       category: 'Security',              description: 'Cloud security posture — risks, misconfigurations, and vulnerability prioritization.',                       logoUrl: '/logos/wiz.svg', available: true,  badgeNew: true },
  { slug: 'orca-security',     name: 'Orca Security',             category: 'Security',              description: 'Agentless cloud security for AWS, Azure, and GCP workloads.',                                               logoUrl: '/logos/orca-security.svg', available: true,  badgeNew: true },
  { slug: 'qualys',            name: 'Qualys VMDR',               category: 'Security',              description: 'Vulnerability management, detection, and response across all assets.',                                       logoUrl: '/logos/qualys.svg', available: true,  badgeNew: true },
  { slug: 'tenable',           name: 'Tenable.io',                category: 'Security',              description: 'Exposure management and vulnerability scanning across cloud and on-prem.',                                   logoUrl: '/logos/tenable.svg', available: true,  badgeNew: true },
  { slug: 'rapid7',            name: 'Rapid7 InsightVM',          category: 'Security',              description: 'Vulnerability risk management with live threat analysis.',                                                    logoUrl: '/logos/rapid7.svg', available: true,  badgeNew: true },
  { slug: 'virustotal',        name: 'VirusTotal',                category: 'Security',              description: 'Threat intelligence — file, URL, domain, and IP reputation lookups.',                                       logoUrl: '/logos/virustotal.svg', available: true,  badgeNew: true },
  { slug: 'proofpoint',        name: 'Proofpoint',                category: 'Security',              description: 'Email security, advanced threat protection, and phishing defense.',                                          logoUrl: '/logos/proofpoint.svg', available: true,  badgeNew: true },
  { slug: 'knowbe4',           name: 'KnowBe4',                   category: 'Security',              description: 'Security awareness training metrics and phishing simulation results.',                                        logoUrl: '/logos/knowbe4.svg', available: true,  badgeNew: true },

  // ── Incident Management ───────────────────────────────────────────────────
  { slug: 'pagerduty',         name: 'PagerDuty',                 category: 'Incident Management',   description: 'Trigger, acknowledge, and resolve incidents via the Events v2 API.',                  logoUrl: '/logos/pagerduty.svg',    available: true  },
  { slug: 'servicenow',        name: 'ServiceNow',                category: 'Incident Management',   description: 'ITSM — create, update, and query incidents, problems, change requests, and CIs.',     logoUrl: '/logos/servicenow.svg',   available: true,  badgeNew: true  },
  { slug: 'opsgenie',          name: 'OpsGenie',                  category: 'Incident Management',   description: 'Alert management and on-call scheduling with intelligent deduplication.',              logoUrl: '/logos/opsgenie.svg', available: true,  badgeNew: true },
  { slug: 'jira-service',      name: 'Jira Service Management',   category: 'Incident Management',   description: 'IT service desk with issues, queues, SLA tracking, and approvals.',                   logoUrl: '/logos/jira-service.svg', available: true,  badgeNew: true },
  { slug: 'freshservice',      name: 'Freshservice',              category: 'Incident Management',   description: 'Cloud ITSM for IT teams — tickets, assets, changes, and CMDB.',                      logoUrl: '/logos/freshservice.svg', available: true,  badgeNew: true },
  { slug: 'xmatters',          name: 'xMatters',                  category: 'Incident Management',   description: 'Digital service availability and incident communication platform.',                    logoUrl: '/logos/xmatters.svg', available: true,  badgeNew: true },

  // ── Communication ─────────────────────────────────────────────────────────
  { slug: 'slack',             name: 'Slack',                     category: 'Communication',         description: 'Send messages and structured alerts to Slack channels via Bot Token.',               logoUrl: '/logos/slack.svg',        available: true  },
  { slug: 'teams',             name: 'Microsoft Teams',           category: 'Communication',         description: 'Post messages and adaptive cards to Teams channels via Incoming Webhook.',            logoUrl: '/logos/teams.svg',        available: true,  badgeNew: true  },
  { slug: 'twilio',            name: 'Twilio',                    category: 'Communication',         description: 'Send SMS and WhatsApp messages to any phone number via the Twilio API.',             logoUrl: '/logos/twilio.svg',       available: true,  badgeNew: true  },
  { slug: 'sendgrid',          name: 'SendGrid',                  category: 'Communication',         description: 'Send transactional and alert emails via SendGrid\'s Email API.',                     logoUrl: '/logos/sendgrid.svg',     available: true,  badgeNew: true  },
  { slug: 'mailchimp',         name: 'Mailchimp',                 category: 'Communication',         description: 'Email marketing — audience management, campaigns, and subscriber stats.',            logoUrl: '/logos/mailchimp.svg', available: true,  badgeNew: true },
  { slug: 'postmark',          name: 'Postmark',                  category: 'Communication',         description: 'Fast, reliable transactional email with delivery analytics.',                        logoUrl: '/logos/postmark.svg', available: true,  badgeNew: true },
  { slug: 'intercom',          name: 'Intercom',                  category: 'Communication',         description: 'Customer messaging — conversations, contacts, and support automation.',              logoUrl: '/logos/intercom.svg', available: true,  badgeNew: true },
  { slug: 'vonage',            name: 'Vonage (Nexmo)',            category: 'Communication',         description: 'Programmable voice, SMS, and video communications API.',                             logoUrl: '/logos/vonage.svg', available: true,  badgeNew: true },
  { slug: 'whatsapp-business', name: 'WhatsApp Business',         category: 'Communication',         description: 'Send templated and session messages via the WhatsApp Business API.',                logoUrl: '/logos/whatsapp-business.svg', available: true,  badgeNew: true },

  // ── Finance ───────────────────────────────────────────────────────────────
  { slug: 'netsuite',          name: 'NetSuite',                  category: 'Finance',               description: 'ERP — run SuiteQL, query financials, invoices, transactions, and customer records.', logoUrl: '/logos/netsuite.svg',     available: true,  badgeNew: true  },
  { slug: 'xero',              name: 'Xero',                      category: 'Finance',               description: 'Cloud accounting — invoices, bank reconciliation, and financial reports.',           logoUrl: '/logos/xero.svg', available: true,  badgeNew: true },
  { slug: 'stripe',            name: 'Stripe',                    category: 'Finance',               description: 'Payment processing — charges, customers, subscriptions, and dispute management.',   logoUrl: '/logos/stripe.svg', available: true,  badgeNew: true },
  { slug: 'sage-intacct',      name: 'Sage Intacct',              category: 'Finance',               description: 'Cloud financial management for multi-entity and multi-currency organizations.',      logoUrl: '/logos/sage-intacct.svg', available: true,  badgeNew: true },
  { slug: 'freshbooks',        name: 'FreshBooks',                category: 'Finance',               description: 'Invoicing, time tracking, and accounting for small businesses.',                    logoUrl: '/logos/freshbooks.svg', available: true,  badgeNew: true },
  { slug: 'zuora',             name: 'Zuora',                     category: 'Finance',               description: 'Subscription billing, revenue recognition, and recurring billing automation.',      logoUrl: '/logos/zuora.svg', available: true,  badgeNew: true },
  { slug: 'chargebee',         name: 'Chargebee',                 category: 'Finance',               description: 'Subscription management, billing automation, and revenue lifecycle.',               logoUrl: '/logos/chargebee.svg', available: true,  badgeNew: true },

  // ── CRM & Support ─────────────────────────────────────────────────────────
  { slug: 'salesforce',        name: 'Salesforce',                category: 'CRM & Support',         description: 'CRM — accounts, contacts, opportunities, cases, and SOQL queries.',                 logoUrl: '/logos/salesforce.svg', available: true,  badgeNew: true },
  { slug: 'hubspot',           name: 'HubSpot',                   category: 'CRM & Support',         description: 'CRM — contacts, deals, companies, tickets, and marketing activity.',                logoUrl: '/logos/hubspot.svg', available: true,  badgeNew: true },
  { slug: 'zendesk',           name: 'Zendesk Support',           category: 'CRM & Support',         description: 'Customer support — tickets, users, organizations, SLA policies, and CSAT scores.',    logoUrl: '/logos/zendesk.svg',      available: true,  badgeNew: true  },
  { slug: 'plain',             name: 'Plain',                     category: 'CRM & Support',         description: 'Modern B2B customer support — threads, customers, timeline events, and triage workflows.', logoUrl: '/logos/plain.svg',       available: true,  badgeNew: true  },
  { slug: 'freshdesk',         name: 'Freshdesk',                 category: 'CRM & Support',         description: 'Cloud helpdesk — tickets, contacts, agents, and knowledge base articles.',         logoUrl: '/logos/freshdesk.svg', available: true,  badgeNew: true },
  { slug: 'pipedrive',         name: 'Pipedrive',                 category: 'CRM & Support',         description: 'Sales pipeline management — deals, contacts, activities, and forecasting.',         logoUrl: '/logos/pipedrive.svg', available: true,  badgeNew: true },
  { slug: 'monday',            name: 'Monday.com',                category: 'CRM & Support',         description: 'Work management — boards, items, timelines, and automations.',                      logoUrl: '/logos/monday.svg', available: true,  badgeNew: true },
  { slug: 'zoho-crm',          name: 'Zoho CRM',                  category: 'CRM & Support',         description: 'CRM — leads, contacts, accounts, deals, and analytics.',                           logoUrl: '/logos/zoho-crm.svg', available: true,  badgeNew: true },
  { slug: 'help-scout',        name: 'Help Scout',                category: 'CRM & Support',         description: 'Customer support — mailboxes, conversations, and customer profiles.',               logoUrl: '/logos/help-scout.svg', available: true,  badgeNew: true },

  // ── Cloud & Infrastructure ────────────────────────────────────────────────
  { slug: 'aws-cloudwatch',    name: 'AWS CloudWatch',            category: 'Cloud & Infrastructure', description: 'Monitor AWS resources — metrics, logs, alarms, and anomaly detection.',            logoUrl: '/logos/aws-cloudwatch.svg', available: true,  badgeNew: true },
  { slug: 'aws-ssm',           name: 'AWS Systems Manager',       category: 'Cloud & Infrastructure', description: 'Run commands, patch instances, and manage EC2 fleets at scale.',                   logoUrl: '/logos/aws-ssm.svg', available: true,  badgeNew: true },
  { slug: 'azure-monitor',     name: 'Azure Monitor',             category: 'Cloud & Infrastructure', description: 'Full-stack observability for Azure resources, apps, and infrastructure.',          logoUrl: '/logos/azure-monitor.svg', available: true,  badgeNew: true },
  { slug: 'gcp-monitoring',    name: 'Google Cloud Monitoring',   category: 'Cloud & Infrastructure', description: 'Monitor GCP infrastructure, services, and application performance.',               logoUrl: '/logos/gcp-monitoring.svg', available: true,  badgeNew: true },
  { slug: 'datadog',           name: 'Datadog',                   category: 'Cloud & Infrastructure', description: 'Infrastructure monitoring, APM, logs, and security in a single platform.',         logoUrl: '/logos/datadog.svg', available: true,  badgeNew: true },
  { slug: 'new-relic',         name: 'New Relic',                 category: 'Cloud & Infrastructure', description: 'Full-stack observability — metrics, distributed traces, logs, and errors.',       logoUrl: '/logos/new-relic.svg', available: true,  badgeNew: true },
  { slug: 'dynatrace',         name: 'Dynatrace',                 category: 'Cloud & Infrastructure', description: 'AI-powered observability and application security platform.',                      logoUrl: '/logos/dynatrace.svg', available: true,  badgeNew: true },
  { slug: 'grafana',           name: 'Grafana',                   category: 'Cloud & Infrastructure', description: 'Open observability — dashboards, alerts, and data source queries.',                logoUrl: '/logos/grafana.svg', available: true,  badgeNew: true },

  // ── DevOps ────────────────────────────────────────────────────────────────
  { slug: 'github',            name: 'GitHub',                    category: 'DevOps',                description: 'Repositories, issues, pull requests, Actions workflows, and releases.',             logoUrl: '/logos/github.svg', available: true,  badgeNew: true },
  { slug: 'gitlab',            name: 'GitLab',                    category: 'DevOps',                description: 'Source control, CI/CD pipelines, issues, and merge requests.',                      logoUrl: '/logos/gitlab.svg', available: true,  badgeNew: true },
  { slug: 'jira',              name: 'Jira Software',             category: 'DevOps',                description: 'Agile project management — epics, stories, sprints, and boards.',                   logoUrl: '/logos/jira.svg', available: true,  badgeNew: true },
  { slug: 'confluence',        name: 'Confluence',                category: 'DevOps',                description: 'Team wiki — spaces, pages, templates, and collaborative documentation.',            logoUrl: '/logos/confluence.svg', available: true,  badgeNew: true },
  { slug: 'circleci',          name: 'CircleCI',                  category: 'DevOps',                description: 'CI/CD pipelines — workflows, jobs, artifacts, and insights.',                       logoUrl: '/logos/circleci.svg', available: true,  badgeNew: true },
  { slug: 'terraform-cloud',   name: 'Terraform Cloud',           category: 'DevOps',                description: 'Infrastructure as code — workspaces, runs, plans, and state management.',          logoUrl: '/logos/terraform-cloud.svg', available: true,  badgeNew: true },
  { slug: 'argocd',            name: 'Argo CD',                   category: 'DevOps',                description: 'GitOps continuous delivery for Kubernetes — apps, sync status, and rollbacks.',    logoUrl: '/logos/argocd.svg', available: true,  badgeNew: true },

  // ── Productivity ──────────────────────────────────────────────────────────
  { slug: 'gmail',             name: 'Gmail',                     category: 'Productivity',          description: 'Read, search, and send emails via the Gmail API.',                                   logoUrl: '/logos/gmail.svg', available: true,  badgeNew: true },
  { slug: 'google-drive',      name: 'Google Drive',              category: 'Productivity',          description: 'Browse, search, and read files and folders in Google Drive.',                       logoUrl: '/logos/google-drive.svg', available: true, badgeNew: true },
  { slug: 'google-calendar',   name: 'Google Calendar',           category: 'Productivity',          description: 'Read and create calendar events and check availability.',                            logoUrl: '/logos/google-calendar.svg', available: true,  badgeNew: true },
  { slug: 'google-sheets',     name: 'Google Sheets',             category: 'Productivity',          description: 'Read and append rows to Google Sheets spreadsheets.',                               logoUrl: '/logos/google-sheets.svg', available: true,  badgeNew: true },
  { slug: 'outlook',           name: 'Microsoft Outlook',         category: 'Productivity',          description: 'Read and send emails via Microsoft Graph.',                                          logoUrl: '/logos/outlook.svg', available: true,  badgeNew: true },
  { slug: 'notion',            name: 'Notion',                    category: 'Productivity',          description: 'Read and write Notion databases, pages, and blocks via the API.',                   logoUrl: '/logos/notion.svg', available: true,  badgeNew: true },
  { slug: 'airtable',          name: 'Airtable',                  category: 'Productivity',          description: 'Read and write records in Airtable bases and tables.',                              logoUrl: '/logos/airtable.svg', available: true,  badgeNew: true },
  { slug: 'asana',             name: 'Asana',                     category: 'Productivity',          description: 'Task management — projects, tasks, assignees, and due dates.',                      logoUrl: '/logos/asana.svg', available: true,  badgeNew: true },
  { slug: 'trello',            name: 'Trello',                    category: 'Productivity',          description: 'Kanban boards — cards, lists, members, and checklists.',                            logoUrl: '/logos/trello.svg', available: true,  badgeNew: true },

  // ── Short-Term Rental ─────────────────────────────────────────────────────
  { slug: 'lodgify',           name: 'Lodgify',                   category: 'Short-Term Rental',     description: 'Bookings, properties, availability, quotes, and guest messaging.',                  logoUrl: '/logos/lodgify.svg',      available: true  },
  { slug: 'hostaway',          name: 'Hostaway',                  category: 'Short-Term Rental',     description: 'Multi-channel vacation rental — bookings, messaging, and calendar sync.',           logoUrl: '/logos/hostaway.svg', available: true,  badgeNew: true },
  { slug: 'guesty',            name: 'Guesty',                    category: 'Short-Term Rental',     description: 'Property management platform for professional short-term rental operators.',        logoUrl: '/logos/guesty.svg', available: true,  badgeNew: true },
  { slug: 'ownerrez',          name: 'OwnerRez',                  category: 'Short-Term Rental',     description: 'Vacation rental software — booking, messaging, and channel management.',           logoUrl: '/logos/ownerrez.svg', available: true,  badgeNew: true },
  { slug: 'hostfully',         name: 'Hostfully',                 category: 'Short-Term Rental',     description: 'Guest guides, property management, and communications platform.',                  logoUrl: '/logos/hostfully.svg', available: true,  badgeNew: true },
  { slug: 'beds24',            name: 'Beds24',                    category: 'Short-Term Rental',     description: 'Booking and channel management for vacation rentals.',                              logoUrl: '/logos/beds24.svg', available: true,  badgeNew: true },

  // ── Smart Home ────────────────────────────────────────────────────────────
  { slug: 'google-home',       name: 'Google Home / Nest',        category: 'Smart Home',            description: 'Control Nest thermostats, cameras, and Google Home smart devices.',                 logoUrl: '/logos/google-home.svg', available: true,  badgeNew: true },
  { slug: 'philips-hue',       name: 'Philips Hue',               category: 'Smart Home',            description: 'Control Hue lights, scenes, and rooms via the local bridge API.',                  logoUrl: '/logos/philips-hue.svg', available: true,  badgeNew: true },
  { slug: 'smartthings',       name: 'Samsung SmartThings',       category: 'Smart Home',            description: 'Control SmartThings devices, scenes, rules, and automations.',                     logoUrl: '/logos/smartthings.svg', available: true,  badgeNew: true },
  { slug: 'ecobee',            name: 'Ecobee',                    category: 'Smart Home',            description: 'Smart thermostat control, schedules, occupancy, and energy reports.',              logoUrl: '/logos/ecobee.svg', available: true,  badgeNew: true },
  { slug: 'august',            name: 'August Smart Lock',         category: 'Smart Home',            description: 'Lock/unlock August smart locks and view access event history.',                    logoUrl: '/logos/august.svg', available: true,  badgeNew: true },
  { slug: 'eufy-security',     name: 'Eufy Security',             category: 'Smart Home',            description: 'Eufy Security cameras — list devices, view status, alarm control, motion detection, and manage events.', logoUrl: '/logos/eufy-security.svg', available: true, badgeNew: true },
  { slug: 'simulated-lights',  name: 'Simulated Lights',          category: 'Smart Home',            description: 'Virtual lighting system for demos — on/off, brightness, color, and scenes.',      logoUrl: '/logos/simulated-lights.svg', available: true, isSimulated: true },
  { slug: 'simulated-ring',    name: 'Simulated Ring',            category: 'Smart Home',            description: 'Virtual Ring doorbell and motion sensors for demos and skill testing.',            logoUrl: '/logos/simulated-ring.svg',   available: true, isSimulated: true },

  // ── Data & Analytics ──────────────────────────────────────────────────────
  { slug: 'snowflake',         name: 'Snowflake',                 category: 'Data & Analytics',      description: 'Run SQL queries against Snowflake data warehouses.',                                logoUrl: '/logos/snowflake.svg', available: true,  badgeNew: true },
  { slug: 'bigquery',          name: 'BigQuery',                  category: 'Data & Analytics',      description: 'Run analytics SQL queries against Google BigQuery datasets.',                       logoUrl: '/logos/bigquery.svg', available: true,  badgeNew: true },
  { slug: 'databricks',        name: 'Databricks',                category: 'Data & Analytics',      description: 'Run notebooks and SQL queries on Databricks workspaces.',                          logoUrl: '/logos/databricks.svg', available: true,  badgeNew: true },
  { slug: 'tableau',           name: 'Tableau',                   category: 'Data & Analytics',      description: 'Access Tableau workbooks, views, and published data sources.',                     logoUrl: '/logos/tableau.svg', available: true,  badgeNew: true },
  { slug: 'power-bi',          name: 'Power BI',                  category: 'Data & Analytics',      description: 'Query Power BI datasets, reports, and trigger dataset refreshes.',                 logoUrl: '/logos/power-bi.svg', available: true,  badgeNew: true },
  { slug: 'quickbooks-online', name: 'QuickBooks Online', category: 'Finance', description: 'Accounting on QuickBooks Online — invoices, customers, payments, bills, and reports.', logoUrl: '/logos/quickbooks-online.svg', available: true, badgeNew: true  },

  // ── Coming soon: top APIs people use (wave 2) ─────────────────────────────
  // Productivity
  { slug: 'dropbox',           name: 'Dropbox',                   category: 'Productivity',          description: 'Files, folders, sharing links, and search across your Dropbox.',                    available: false },
  { slug: 'box',               name: 'Box',                       category: 'Productivity',          description: 'Enterprise file storage — folders, collaboration, and metadata.',                   available: false },
  { slug: 'onedrive',          name: 'OneDrive',                  category: 'Productivity',          description: 'Microsoft 365 files — browse, search, share, and manage.',                          available: false },
  { slug: 'google-docs',       name: 'Google Docs',               category: 'Productivity',          description: 'Create and edit documents, insert text, and export.',                               available: false },
  { slug: 'todoist',           name: 'Todoist',                   category: 'Productivity',          description: 'Tasks, projects, and due dates in Todoist.',                                        available: false },
  { slug: 'clickup',           name: 'ClickUp',                   category: 'Productivity',          description: 'Tasks, lists, and spaces in ClickUp workspaces.',                                   available: false },
  { slug: 'linear',            name: 'Linear',                    category: 'Productivity',          description: 'Issues, cycles, and projects in Linear.',                                           available: false },
  { slug: 'basecamp',          name: 'Basecamp',                  category: 'Productivity',          description: 'Projects, to-dos, and messages in Basecamp.',                                       available: false },
  { slug: 'miro',              name: 'Miro',                      category: 'Productivity',          description: 'Boards, frames, and collaboration in Miro.',                                        available: false },
  { slug: 'figma',             name: 'Figma',                     category: 'Productivity',          description: 'Files, components, and comments in Figma projects.',                               available: false },
  { slug: 'canva',             name: 'Canva',                     category: 'Productivity',          description: 'Designs, folders, and exports in Canva.',                                           available: false },
  { slug: 'calendly',          name: 'Calendly',                  category: 'Productivity',          description: 'Scheduled events, invitees, and availability.',                                     available: false },
  { slug: 'zoom',              name: 'Zoom',                      category: 'Productivity',          description: 'Meetings, recordings, and participants.',                                           available: false },
  { slug: 'docusign',          name: 'DocuSign',                  category: 'Productivity',          description: 'Envelopes, signatures, and document status.',                                       available: false },
  // E-commerce
  { slug: 'shopify',           name: 'Shopify',                   category: 'E-commerce',            description: 'Orders, products, customers, and inventory on Shopify stores.',                     available: false },
  { slug: 'woocommerce',       name: 'WooCommerce',               category: 'E-commerce',            description: 'Orders, products, and customers on WordPress stores.',                              available: false },
  { slug: 'bigcommerce',       name: 'BigCommerce',               category: 'E-commerce',            description: 'Catalog, orders, and customers on BigCommerce.',                                    available: false },
  { slug: 'magento',           name: 'Adobe Commerce (Magento)',  category: 'E-commerce',            description: 'Products, orders, and customers on Magento stores.',                                available: false },
  { slug: 'squarespace',       name: 'Squarespace',               category: 'E-commerce',            description: 'Commerce orders, inventory, and site content.',                                     available: false },
  { slug: 'wix',               name: 'Wix',                       category: 'E-commerce',            description: 'Store orders, products, and site data on Wix.',                                     available: false },
  { slug: 'etsy',              name: 'Etsy',                      category: 'E-commerce',            description: 'Shop listings, orders, and reviews on Etsy.',                                       available: false },
  { slug: 'amazon-seller',     name: 'Amazon Seller',             category: 'E-commerce',            description: 'Orders, inventory, and reports via SP-API.',                                        available: false },
  { slug: 'ebay',              name: 'eBay',                      category: 'E-commerce',            description: 'Listings, orders, and fulfillment on eBay.',                                        available: false },
  { slug: 'walmart-marketplace', name: 'Walmart Marketplace',     category: 'E-commerce',            description: 'Items, orders, and inventory on Walmart Marketplace.',                              available: false },
  { slug: 'paddle',            name: 'Paddle',                    category: 'E-commerce',            description: 'Subscriptions, transactions, and customers on Paddle.',                             available: false },
  { slug: 'lemon-squeezy',     name: 'Lemon Squeezy',             category: 'E-commerce',            description: 'Products, orders, and subscriptions on Lemon Squeezy.',                             available: false },
  // Marketing
  { slug: 'google-ads',        name: 'Google Ads',                category: 'Marketing',             description: 'Campaigns, budgets, and performance reports.',                                      available: false },
  { slug: 'meta-ads',          name: 'Meta Ads',                  category: 'Marketing',             description: 'Facebook/Instagram ad campaigns, ad sets, and insights.',                           available: false },
  { slug: 'tiktok-ads',        name: 'TikTok Ads',                category: 'Marketing',             description: 'Campaigns and reporting on TikTok for Business.',                                   available: false },
  { slug: 'linkedin-ads',      name: 'LinkedIn Ads',              category: 'Marketing',             description: 'Campaigns and analytics on LinkedIn Marketing.',                                    available: false },
  { slug: 'instagram',         name: 'Instagram',                 category: 'Marketing',             description: 'Profile media, comments, and insights via the Graph API.',                          available: false },
  { slug: 'youtube',           name: 'YouTube',                   category: 'Marketing',             description: 'Channel videos, playlists, comments, and analytics.',                               available: false },
  { slug: 'tiktok',            name: 'TikTok',                    category: 'Marketing',             description: 'Account videos and performance data.',                                              available: false },
  { slug: 'pinterest',         name: 'Pinterest',                 category: 'Marketing',             description: 'Boards, pins, and analytics.',                                                      available: false },
  { slug: 'reddit',            name: 'Reddit',                    category: 'Marketing',             description: 'Subreddit posts, comments, and search.',                                            available: false },
  { slug: 'buffer',            name: 'Buffer',                    category: 'Marketing',             description: 'Schedule and analyze social posts across networks.',                                available: false },
  { slug: 'hootsuite',         name: 'Hootsuite',                 category: 'Marketing',             description: 'Social scheduling, streams, and analytics.',                                        available: false },
  { slug: 'semrush',           name: 'Semrush',                   category: 'Marketing',             description: 'SEO keywords, domain analytics, and backlinks.',                                    available: false },
  { slug: 'webflow',           name: 'Webflow',                   category: 'Marketing',             description: 'Sites, CMS collections, and form submissions.',                                     available: false },
  { slug: 'wordpress',         name: 'WordPress',                 category: 'Marketing',             description: 'Posts, pages, and comments via the WordPress REST API.',                            available: false },
  { slug: 'ghost',             name: 'Ghost',                     category: 'Marketing',             description: 'Posts, members, and newsletters on Ghost publications.',                            available: false },
  { slug: 'substack',          name: 'Substack',                  category: 'Marketing',             description: 'Publication posts and subscriber stats.',                                           available: false },
  // Communication
  { slug: 'discord',           name: 'Discord',                   category: 'Communication',         description: 'Servers, channels, and messages via the Discord API.',                              available: false },
  { slug: 'telegram',          name: 'Telegram',                  category: 'Communication',         description: 'Send messages and manage chats via the Bot API.',                                   available: false },
  { slug: 'messenger',         name: 'Facebook Messenger',        category: 'Communication',         description: 'Page conversations and messages via the Graph API.',                                available: false },
  { slug: 'klaviyo',           name: 'Klaviyo',                   category: 'Communication',         description: 'Email/SMS campaigns, flows, lists, and metrics.',                                   available: false },
  { slug: 'braze',             name: 'Braze',                     category: 'Communication',         description: 'Customer engagement campaigns, canvases, and segments.',                            available: false },
  { slug: 'customerio',        name: 'Customer.io',               category: 'Communication',         description: 'Journeys, broadcasts, and customer profiles.',                                      available: false },
  { slug: 'activecampaign',    name: 'ActiveCampaign',            category: 'Communication',         description: 'Contacts, automations, campaigns, and deals.',                                      available: false },
  { slug: 'convertkit',        name: 'Kit (ConvertKit)',          category: 'Communication',         description: 'Subscribers, broadcasts, and sequences for creators.',                              available: false },
  { slug: 'brevo',             name: 'Brevo',                     category: 'Communication',         description: 'Email/SMS campaigns, contacts, and transactional sending.',                         available: false },
  { slug: 'mailgun',           name: 'Mailgun',                   category: 'Communication',         description: 'Transactional email sending, logs, and validations.',                               available: false },
  // CRM & Support
  { slug: 'front',             name: 'Front',                     category: 'CRM & Support',         description: 'Shared inboxes, conversations, and assignments.',                                   available: false },
  { slug: 'gorgias',           name: 'Gorgias',                   category: 'CRM & Support',         description: 'E-commerce helpdesk tickets and macros.',                                           available: false },
  { slug: 'drift',             name: 'Drift',                     category: 'CRM & Support',         description: 'Conversations, contacts, and playbooks.',                                           available: false },
  { slug: 'close',             name: 'Close',                     category: 'CRM & Support',         description: 'Leads, opportunities, calls, and email sequences.',                                 available: false },
  { slug: 'copper',            name: 'Copper',                    category: 'CRM & Support',         description: 'CRM built for Google Workspace — people, deals, tasks.',                            available: false },
  { slug: 'attio',             name: 'Attio',                     category: 'CRM & Support',         description: 'Flexible CRM objects, records, and lists.',                                         available: false },
  { slug: 'apollo',            name: 'Apollo.io',                 category: 'CRM & Support',         description: 'Prospecting — people/company search and sequences.',                                available: false },
  { slug: 'gong',              name: 'Gong',                      category: 'CRM & Support',         description: 'Call recordings, stats, and deal intelligence.',                                    available: false },
  // Finance
  { slug: 'paypal',            name: 'PayPal',                    category: 'Finance',               description: 'Payments, payouts, and transaction history.',                                       available: false },
  { slug: 'square',            name: 'Square',                    category: 'Finance',               description: 'Payments, orders, catalog, and customers.',                                         available: false },
  { slug: 'plaid',             name: 'Plaid',                     category: 'Finance',               description: 'Bank account balances, transactions, and identity.',                                available: false },
  { slug: 'wise',              name: 'Wise',                      category: 'Finance',               description: 'Multi-currency balances, transfers, and rates.',                                    available: false },
  { slug: 'brex',              name: 'Brex',                      category: 'Finance',               description: 'Corporate card transactions, budgets, and users.',                                  available: false },
  { slug: 'ramp',              name: 'Ramp',                      category: 'Finance',               description: 'Spend management — cards, transactions, reimbursements.',                           available: false },
  { slug: 'expensify',         name: 'Expensify',                 category: 'Finance',               description: 'Expense reports and receipts.',                                                     available: false },
  { slug: 'bill-com',          name: 'Bill.com',                  category: 'Finance',               description: 'AP/AR bills, invoices, and payments.',                                              available: false },
  { slug: 'gusto',             name: 'Gusto',                     category: 'Finance',               description: 'Payroll, employees, and benefits.',                                                 available: false },
  { slug: 'rippling',          name: 'Rippling',                  category: 'Finance',               description: 'HR, payroll, and device data.',                                                     available: false },
  { slug: 'deel',              name: 'Deel',                      category: 'Finance',               description: 'Global payroll and contractor management.',                                         available: false },
  { slug: 'coinbase',          name: 'Coinbase',                  category: 'Finance',               description: 'Account balances, prices, and transactions.',                                      available: false },
  // DevOps
  { slug: 'bitbucket',         name: 'Bitbucket',                 category: 'DevOps',                description: 'Repos, pull requests, and pipelines.',                                              available: false },
  { slug: 'azure-devops',      name: 'Azure DevOps',              category: 'DevOps',                description: 'Boards, repos, and pipelines.',                                                     available: false },
  { slug: 'jenkins',           name: 'Jenkins',                   category: 'DevOps',                description: 'Jobs, builds, and queue via the Jenkins API.',                                      available: false },
  { slug: 'buildkite',         name: 'Buildkite',                 category: 'DevOps',                description: 'Pipelines, builds, and agents.',                                                    available: false },
  { slug: 'sentry',            name: 'Sentry',                    category: 'DevOps',                description: 'Error issues, events, and releases.',                                               available: false },
  { slug: 'launchdarkly',      name: 'LaunchDarkly',              category: 'DevOps',                description: 'Feature flags, targeting, and environments.',                                       available: false },
  { slug: 'docker-hub',        name: 'Docker Hub',                category: 'DevOps',                description: 'Repositories, tags, and image metadata.',                                           available: false },
  { slug: 'vercel',            name: 'Vercel',                    category: 'DevOps',                description: 'Deployments, projects, and domains.',                                               available: false },
  { slug: 'netlify',           name: 'Netlify',                   category: 'DevOps',                description: 'Sites, deploys, and forms.',                                                        available: false },
  { slug: 'cloudflare',        name: 'Cloudflare',                category: 'DevOps',                description: 'DNS, zones, cache purge, and firewall rules.',                                      available: false },
  // Cloud & Infrastructure
  { slug: 'aws-ec2',           name: 'AWS EC2',                   category: 'Cloud & Infrastructure', description: 'Instances — list, start, stop, and describe.',                                     available: false },
  { slug: 'aws-s3',            name: 'AWS S3',                    category: 'Cloud & Infrastructure', description: 'Buckets and objects — list, read, and manage.',                                    available: false },
  { slug: 'aws-lambda',        name: 'AWS Lambda',                category: 'Cloud & Infrastructure', description: 'Functions — list, invoke, and inspect.',                                           available: false },
  { slug: 'digitalocean',      name: 'DigitalOcean',              category: 'Cloud & Infrastructure', description: 'Droplets, databases, and monitoring.',                                             available: false },
  { slug: 'heroku',            name: 'Heroku',                    category: 'Cloud & Infrastructure', description: 'Apps, dynos, releases, and logs.',                                                 available: false },
  { slug: 'pingdom',           name: 'Pingdom',                   category: 'Cloud & Infrastructure', description: 'Uptime checks and response-time reports.',                                         available: false },
  { slug: 'statuspage',        name: 'Statuspage',                category: 'Cloud & Infrastructure', description: 'Incidents, components, and subscriber updates.',                                   available: false },
  { slug: 'uptime-robot',      name: 'UptimeRobot',               category: 'Cloud & Infrastructure', description: 'Monitors, alerts, and status pages.',                                              available: false },
  // Data & Analytics
  { slug: 'google-analytics',  name: 'Google Analytics',          category: 'Data & Analytics',      description: 'GA4 reports — traffic, conversions, and audiences.',                                available: false },
  { slug: 'mixpanel',          name: 'Mixpanel',                  category: 'Data & Analytics',      description: 'Product analytics — events, funnels, and cohorts.',                                 available: false },
  { slug: 'amplitude',         name: 'Amplitude',                 category: 'Data & Analytics',      description: 'Behavioral analytics — charts, cohorts, and events.',                               available: false },
  { slug: 'segment',           name: 'Segment',                   category: 'Data & Analytics',      description: 'Customer data pipelines — sources, destinations, and tracking.',                    available: false },
  { slug: 'posthog',           name: 'PostHog',                   category: 'Data & Analytics',      description: 'Product analytics, feature flags, and session replays.',                            available: false },
  { slug: 'looker',            name: 'Looker',                    category: 'Data & Analytics',      description: 'Looks, dashboards, and queries.',                                                   available: false },
  { slug: 'metabase',          name: 'Metabase',                  category: 'Data & Analytics',      description: 'Questions, dashboards, and database queries.',                                      available: false },
  { slug: 'mongodb-atlas',     name: 'MongoDB Atlas',             category: 'Data & Analytics',      description: 'Clusters, databases, and Data API queries.',                                        available: false },
  { slug: 'supabase',          name: 'Supabase',                  category: 'Data & Analytics',      description: 'Postgres tables, auth users, and storage.',                                         available: false },
  { slug: 'algolia',           name: 'Algolia',                   category: 'Data & Analytics',      description: 'Search indexes, records, and analytics.',                                           available: false },
]

export const AVAILABLE_SLUGS = new Set(catalog.filter(c => c.available).map(c => c.slug))

export function getCatalogEntry(slug: string): CatalogEntry | undefined {
  return catalog.find(c => c.slug === slug)
}
