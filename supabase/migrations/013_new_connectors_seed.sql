-- Seed 6 new connector implementations
INSERT INTO connectors (slug, name, category, is_simulated) VALUES
  ('crowdstrike', 'CrowdStrike Falcon', 'Security', false),
  ('twilio',      'Twilio',            'Communication', false),
  ('sendgrid',    'SendGrid',          'Communication', false),
  ('teams',       'Microsoft Teams',   'Communication', false),
  ('servicenow',  'ServiceNow',        'Incident Management', false),
  ('netsuite',    'NetSuite',          'Finance', false)
ON CONFLICT (slug) DO UPDATE
  SET name        = EXCLUDED.name,
      category    = EXCLUDED.category,
      is_simulated = EXCLUDED.is_simulated;
