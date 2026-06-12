insert into public.connectors (slug, name, category, manifest, is_simulated) values
(
  'lodgify',
  'Lodgify',
  'Short-Term Rental',
  '{"description":"Bookings, properties, availability, quotes, and guest messaging via the Lodgify REST API.","auth":{"type":"api_key","keyLabel":"API Key","keyPlaceholder":"Your Lodgify API key"}}',
  false
),
(
  'simulated-lights',
  'Simulated Lights',
  'Smart Home',
  '{"description":"A virtual lighting system for demos — on/off, brightness, color, and scenes.","auth":{"type":"api_key","keyLabel":"Device Group Name"}}',
  true
)
on conflict (slug) do nothing;
