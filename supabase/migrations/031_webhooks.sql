-- ============================================================
-- 031 — Foundation D: Webhook registry + HMAC signing
-- ============================================================
-- A first-class inbound webhook registry. Each endpoint has an
-- unguessable URL token AND an HMAC signing secret delivered in the
-- X-Orbit-Signature header (not the URL — fixing the leak in the old
-- /api/webhooks/skills/:id?secret= scheme). Every delivery is logged
-- with its signature-validation result so the #10 dashboard can show
-- payloads and replay them. Endpoints can trigger a skill, a playbook,
-- or emit a named event that resumes async-waiting playbook runs (#6).
-- ============================================================

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,

  -- Unguessable path segment: POST /api/hooks/{token}
  token text not null unique,
  -- HMAC-SHA256 secret; sender signs the raw body → X-Orbit-Signature header.
  signing_secret text not null,

  -- What firing this endpoint does.
  target_type text not null default 'event'
    check (target_type in ('skill', 'playbook', 'event')),
  target_id uuid,            -- skill_id or playbook_id when target_type != 'event'
  event_name text,           -- the event a 'event' endpoint emits (resumes #6 waits)

  -- Optional JSON schema for payload inspection in the dashboard.
  payload_schema jsonb,

  enabled boolean not null default true,
  -- Require a valid signature? Off allows quick testing; on enforces HMAC.
  require_signature boolean not null default true,

  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  last_delivery_at timestamptz
);

create index webhook_endpoints_workspace_idx on public.webhook_endpoints (workspace_id);

-- Every inbound delivery, logged for inspection + replay (#10).
create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  source_ip text,
  headers jsonb,
  payload jsonb,
  signature_valid boolean,

  -- Outcome of dispatch.
  status text not null default 'received'
    check (status in ('received', 'rejected', 'dispatched', 'failed')),
  dispatch_summary text,         -- e.g. "ran playbook X" / "resumed 2 runs"
  error text,
  is_replay boolean not null default false,

  received_at timestamptz default now()
);

create index webhook_deliveries_endpoint_idx on public.webhook_deliveries (endpoint_id, received_at desc);

-- ------------------------------------------------------------
-- RLS — registry/deliveries are workspace-scoped admin surfaces.
-- (The inbound receiver uses the admin client, so it bypasses RLS.)
-- ------------------------------------------------------------
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;

create policy "Workspace members view endpoints" on public.webhook_endpoints
  for select using (
    workspace_id in (select workspace_id from public.memberships where user_id = auth.uid())
  );
create policy "Admins manage endpoints" on public.webhook_endpoints
  for all using (
    workspace_id in (
      select workspace_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  ) with check (true);

create policy "Workspace members view deliveries" on public.webhook_deliveries
  for select using (
    workspace_id in (select workspace_id from public.memberships where user_id = auth.uid())
  );
create policy "Admins manage deliveries" on public.webhook_deliveries
  for all using (
    workspace_id in (
      select workspace_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  ) with check (true);
