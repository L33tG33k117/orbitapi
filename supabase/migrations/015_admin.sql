-- ============================================================
-- 015 — Admin: super_admin, workspace tiers, feature flags
-- ============================================================

-- Super-admin flag on profiles
alter table public.profiles
  add column if not exists super_admin boolean not null default false;

create index if not exists profiles_super_admin_idx
  on public.profiles(super_admin)
  where super_admin = true;

-- Workspace tier
create type public.workspace_tier as enum ('free', 'starter', 'pro');

alter table public.workspaces
  add column if not exists tier public.workspace_tier not null default 'free';

-- Feature flags per workspace (enforced in Phase 6; stored here now)
-- Defaults: all features on for every workspace
alter table public.workspaces
  add column if not exists feature_flags jsonb not null
    default '{"ai_chat":true,"skills":true,"webhooks":true,"advanced_connectors":true}';

-- ============================================================
-- Bootstrap first super-admin
-- Run this manually (or via Supabase Studio SQL editor) after
-- the migration to grant yourself super-admin access:
--
--   update public.profiles
--   set super_admin = true
--   where email = 'rami.answer@gmail.com';
--
-- ============================================================
