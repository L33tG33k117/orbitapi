-- Add website URL and denormalized vote counter to connector_requests
alter table public.connector_requests
  add column if not exists website_url text,
  add column if not exists vote_count integer not null default 1;

-- ── Votes ────────────────────────────────────────────────────────────────────
-- One vote per user per request; the original submitter counts as vote #1.
create table if not exists public.connector_request_votes (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.connector_requests(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_at   timestamptz default now(),
  unique (request_id, user_id)
);

-- Keep vote_count in sync (votes table count + 1 for original submitter)
create or replace function public.sync_crq_vote_count()
returns trigger language plpgsql security definer as $$
begin
  update public.connector_requests
  set vote_count = (
    select count(*) from public.connector_request_votes where request_id = new.request_id
  ) + 1
  where id = new.request_id;
  return new;
end;
$$;

create trigger crq_vote_inserted
  after insert on public.connector_request_votes
  for each row execute function public.sync_crq_vote_count();

-- ── Messages ─────────────────────────────────────────────────────────────────
-- Back-and-forth between admin and the user who submitted the request.
create table if not exists public.connector_request_messages (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.connector_requests(id) on delete cascade,
  sender_type  text not null check (sender_type in ('admin', 'user')),
  sender_id    uuid not null references auth.users(id),
  content      text not null,
  read_at      timestamptz,
  created_at   timestamptz default now()
);

create index if not exists crm_request_id_idx
  on public.connector_request_messages (request_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.connector_request_votes enable row level security;
alter table public.connector_request_messages enable row level security;

-- Votes: any workspace member can read votes; can insert their own
create policy "Members view votes" on public.connector_request_votes
  for select using (
    workspace_id in (select workspace_id from public.memberships where user_id = auth.uid())
  );
create policy "Members vote" on public.connector_request_votes
  for insert with check (user_id = auth.uid());

-- Messages: users see messages on their own requests or messages they sent
create policy "Users view own request messages" on public.connector_request_messages
  for select using (
    sender_id = auth.uid()
    or request_id in (select id from public.connector_requests where user_id = auth.uid())
  );
create policy "Users send messages" on public.connector_request_messages
  for insert with check (sender_id = auth.uid() and sender_type = 'user');
