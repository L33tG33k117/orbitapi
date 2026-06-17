-- Platform-level bans (user, email, email domain, IP)
create table if not exists public.platform_bans (
  id uuid primary key default gen_random_uuid(),
  ban_type text not null check (ban_type in ('user_id', 'email', 'email_domain', 'ip')),
  value text not null,
  reason text,
  banned_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique(ban_type, value)
);

-- Impersonation audit log
create table if not exists public.impersonation_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id),
  target_user_id uuid not null references public.profiles(id),
  target_email text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
