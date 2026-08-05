-- ============================================================
-- 054 — Instance settings (self-hosted licence + install identity)
-- ============================================================
-- Settings that belong to the INSTALLATION rather than to any workspace.
-- Cloud never writes a row here; the table simply stays empty.
--
-- A single-row table (enforced by the `id` check) rather than key/value,
-- because there are only ever a handful of these and typed columns catch
-- mistakes that a jsonb blob would not.

create table if not exists instance_settings (
  -- Exactly one row, ever. Without this an "apply licence" bug could leave two
  -- rows and the instance would silently pick whichever came back first.
  id                integer primary key default 1 check (id = 1),

  -- The full ORBIT.<payload>.<sig> key as pasted by the administrator.
  -- Verified on read (lib/license.ts) rather than trusted from the database,
  -- so a tampered row grants nothing.
  license_key       text,

  -- Denormalised from the verified payload for display and support. Never
  -- used to decide entitlements — the signature is the only authority.
  license_customer  text,
  license_expires_at timestamptz,
  license_applied_at timestamptz,

  -- Stable id for this installation, used in support bundles so a customer's
  -- logs can be matched to their licence without exposing the key itself.
  install_id        uuid not null default gen_random_uuid(),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table instance_settings enable row level security;

-- No policies: read and written only through the service role, behind an
-- admin-only route. RLS on with zero policies keeps the anon and authenticated
-- keys away from the licence key entirely.
