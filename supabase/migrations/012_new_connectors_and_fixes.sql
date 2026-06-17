-- Fix audit_log actor_type constraint to include 'skill'
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_type_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_actor_type_check
  CHECK (actor_type IN ('user', 'automation', 'skill'));

-- Seed new real connectors
INSERT INTO public.connectors (slug, name, category, manifest, is_simulated) VALUES
(
  'slack',
  'Slack',
  'Communication',
  '{"description":"Send messages and alerts to Slack channels using a Bot Token.","auth":{"type":"api_key","keyLabel":"Bot Token","keyPlaceholder":"xoxb-..."}}',
  false
),
(
  'pagerduty',
  'PagerDuty',
  'Incident Management',
  '{"description":"Trigger, acknowledge, and resolve PagerDuty incidents via the Events v2 API.","auth":{"type":"api_key","keyLabel":"Integration Key (Routing Key)","keyPlaceholder":"32-character hex key"}}',
  false
),
-- Backfill simulated-ring if not already seeded
(
  'simulated-ring',
  'Simulated Ring',
  'Smart Home',
  '{"description":"Virtual Ring doorbell and motion sensors for demos.","auth":{"type":"api_key","keyLabel":"Location Name"}}',
  true
)
ON CONFLICT (slug) DO NOTHING;
