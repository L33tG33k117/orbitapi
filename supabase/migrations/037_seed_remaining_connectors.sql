-- Seed the connector rows for every connector that ships a TypeScript manifest
-- and is marked available:true in connectors/catalog.ts but was never inserted
-- into the connectors table. Without a row here, creating a connection (real or
-- simulated) fails at /api/connections with "Connector not found in database".
--
-- Previously seeded (001/004/008/012/013): lodgify, simulated-lights,
-- simulated-ring, slack, pagerduty, crowdstrike, twilio, sendgrid, teams,
-- servicenow, netsuite. The seven below were missing.

INSERT INTO public.connectors (slug, name, category, manifest, is_simulated) VALUES
(
  'zendesk',
  'Zendesk Support',
  'CRM & Support',
  '{"description":"Customer support — tickets, users, organizations, SLA policies, and CSAT scores.","auth":{"type":"api_key","keyLabel":"API Token","keyPlaceholder":"Zendesk API token"}}',
  false
),
(
  'plain',
  'Plain',
  'CRM & Support',
  '{"description":"Modern B2B customer support — threads, customers, timeline events, and triage workflows.","auth":{"type":"api_key","keyLabel":"API Key","keyPlaceholder":"plainApiKey_..."}}',
  false
),
(
  'sophos',
  'Sophos Central',
  'Security',
  '{"description":"EDR & endpoint protection — alerts, endpoint health, threat quarantine, and isolation.","auth":{"type":"api_key","keyLabel":"API Token","keyPlaceholder":"Sophos Central API token"}}',
  false
),
(
  'sentinelone',
  'SentinelOne',
  'Security',
  '{"description":"AI-powered EDR — threats, agents, network isolation, and automated response actions.","auth":{"type":"api_key","keyLabel":"API Token","keyPlaceholder":"SentinelOne API token"}}',
  false
),
(
  'microsoft-defender',
  'Microsoft Defender',
  'Security',
  '{"description":"EDR — alerts, machines, vulnerability exposure, investigations, and live response actions.","auth":{"type":"api_key","keyLabel":"API Token","keyPlaceholder":"Defender API token"}}',
  false
),
(
  'stellar-cyber',
  'Stellar Cyber',
  'Security',
  '{"description":"Open XDR SIEM — AI-powered threat detection, cases, alerts, and event investigation.","auth":{"type":"api_key","keyLabel":"API Token","keyPlaceholder":"Stellar Cyber API token"}}',
  false
),
(
  'eufy-security',
  'Eufy Security',
  'Smart Home',
  '{"description":"Eufy Security cameras — list devices, view status, alarm control, motion detection, and manage events.","auth":{"type":"api_key","keyLabel":"Account Credentials","keyPlaceholder":"Eufy account token"}}',
  false
)
ON CONFLICT (slug) DO UPDATE
  SET name     = EXCLUDED.name,
      category = EXCLUDED.category;
