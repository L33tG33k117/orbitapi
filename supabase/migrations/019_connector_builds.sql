create table if not exists public.connector_builds (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.connector_requests(id) on delete cascade,
  connector_name text not null,
  connector_slug text,
  status       text not null default 'generating', -- generating | complete | failed
  manifest_code  text,
  catalog_entry  text,
  import_line    text,
  export_entry   text,
  logo_svg       text,
  error          text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists connector_builds_request_id_idx
  on public.connector_builds (request_id);

alter table public.connector_builds enable row level security;
-- All access goes through the service-role admin client; no user-facing policies needed.
