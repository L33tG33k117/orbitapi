-- ============================================================
-- 030 — Foundation C: Bundles + Marketplace
-- ============================================================
-- A bundle is a serialized package of groups + connections +
-- playbooks + skills + demo data. Vertical bundles (#7) ship as
-- code-defined manifests; the marketplace (#4) stores community
-- bundles/skills/playbooks as rows here. Both install through the
-- same primitive (lib/bundles.ts) and are tracked per workspace
-- so they can be uninstalled cleanly.
-- ============================================================

-- Community-published, admin-reviewed listings (#4).
create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  category text,
  kind text not null default 'bundle'
    check (kind in ('bundle', 'skill', 'playbook')),

  -- The serialized BundleManifest (see lib/bundles.ts).
  manifest jsonb not null default '{}',

  -- Publisher + revenue share (the network-effect moat).
  publisher_workspace_id uuid references public.workspaces(id) on delete set null,
  publisher_user_id uuid references auth.users(id),
  price_usd numeric(10, 2) not null default 0,           -- 0 = free
  revenue_share_pct numeric(5, 2) not null default 70,   -- publisher's cut

  -- Review workflow (admin-reviewed, like connector requests).
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text,

  install_count integer not null default 0,
  rating_sum integer not null default 0,
  rating_count integer not null default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index marketplace_listings_status_idx on public.marketplace_listings (status, category);

-- Tracks every bundle installed into a workspace + the resources it created,
-- so an uninstall can remove exactly what it added.
create table public.bundle_installations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  bundle_slug text not null,
  source text not null default 'builtin'
    check (source in ('builtin', 'marketplace')),
  listing_id uuid references public.marketplace_listings(id) on delete set null,

  -- { groups: [...ids], connections: [...ids], playbooks: [...ids], skills: [...ids] }
  created_resources jsonb not null default '{}',

  installed_by uuid references auth.users(id),
  installed_at timestamptz default now(),
  unique (workspace_id, bundle_slug)
);

create index bundle_installations_workspace_idx on public.bundle_installations (workspace_id);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.marketplace_listings enable row level security;
alter table public.bundle_installations enable row level security;

-- Approved listings are visible to everyone; publishers see their own drafts.
create policy "Anyone views approved listings" on public.marketplace_listings
  for select using (
    status = 'approved'
    or publisher_user_id = auth.uid()
  );
-- Members may publish from their own workspace.
create policy "Members create listings" on public.marketplace_listings
  for insert with check (
    publisher_workspace_id in (select workspace_id from public.memberships where user_id = auth.uid())
  );
create policy "Publishers update own listings" on public.marketplace_listings
  for update using (publisher_user_id = auth.uid());

-- Installations are workspace-scoped.
create policy "Workspace members view installations" on public.bundle_installations
  for select using (
    workspace_id in (select workspace_id from public.memberships where user_id = auth.uid())
  );
create policy "Admins manage installations" on public.bundle_installations
  for all using (
    workspace_id in (
      select workspace_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  ) with check (true);

-- Atomically bump install count when a bundle is installed.
create or replace function public.increment_listing_installs(p_listing_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.marketplace_listings
  set install_count = install_count + 1, updated_at = now()
  where id = p_listing_id;
$$;
