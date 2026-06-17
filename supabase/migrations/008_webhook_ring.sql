-- Webhook secret + trigger prompt on skills
alter table public.skills
  add column if not exists webhook_secret text,
  add column if not exists trigger_prompt text;

-- Simulated Ring devices
create table public.simulated_ring_devices (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  device_name text not null,
  device_type text not null default 'doorbell' check (device_type in ('doorbell', 'camera', 'motion_sensor')),
  location text,
  created_at timestamptz default now(),
  unique(connection_id, device_name)
);

-- Simulated Ring events
create table public.simulated_ring_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  device_name text not null,
  event_type text not null check (event_type in ('doorbell', 'motion', 'person_detected')),
  metadata jsonb not null default '{}',
  acknowledged boolean not null default false,
  occurred_at timestamptz default now()
);

alter table public.simulated_ring_devices enable row level security;
alter table public.simulated_ring_events enable row level security;

create policy "Service manages ring devices" on public.simulated_ring_devices
  for all to service_role using (true) with check (true);

create policy "Service manages ring events" on public.simulated_ring_events
  for all to service_role using (true) with check (true);

create policy "Members view ring devices" on public.simulated_ring_devices
  for select to authenticated using (
    connection_id in (
      select c.id from public.connections c
      join public.memberships m on m.workspace_id = c.workspace_id
      where m.user_id = auth.uid()
    )
  );

create policy "Members view ring events" on public.simulated_ring_events
  for select to authenticated using (
    connection_id in (
      select c.id from public.connections c
      join public.memberships m on m.workspace_id = c.workspace_id
      where m.user_id = auth.uid()
    )
  );

-- Seed Ring connector
insert into public.connectors (slug, name, category, manifest, is_simulated) values (
  'simulated-ring',
  'Simulated Ring',
  'Smart Home',
  '{"description":"Virtual Ring doorbell and motion sensors for demos — events trigger autonomous skills.","auth":{"type":"api_key","keyLabel":"Location Name","keyPlaceholder":"e.g. Cabin A"}}',
  true
) on conflict (slug) do nothing;
