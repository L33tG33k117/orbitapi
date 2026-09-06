-- ============================================================
-- 056 — Self-hosted customers, licences and releases
-- ============================================================
-- Until now, selling a self-hosted install meant running
-- `scripts/license-issue.mjs` on a laptop with the private signing key sitting
-- in a file next to it, then pasting the result into an email. Nothing was
-- recorded anywhere, so "who has a licence, and when does it expire?" had no
-- answer at all. Renewals could only be noticed by a customer complaining.
--
-- These tables live in the CLOUD database only. A self-hosted install never
-- reads them — that is the whole point of offline licensing, and 054's
-- `instance_settings` remains the only licence state an install knows about.
-- This is our side of the ledger: who we sold to, what we signed for them,
-- and which build they are entitled to download.
--
-- RLS on with no policies = service-role only, same as `feedback` and
-- `contact_messages`. Everything here is read through super-admin routes,
-- except the downloads page, which reads through a service-role route after
-- matching the signed-in user itself.

-- ---------------------------------------------------------------- customers --
create table if not exists public.selfhost_customers (
  id uuid primary key default gen_random_uuid(),

  company       text not null,
  contact_name  text,
  contact_email text not null,

  -- Their cloud account, when they have one. This is what gates the downloads
  -- page: a self-hosted customer still signs in to orbitapi.com to fetch
  -- bundles, because the install itself may have no internet at all.
  -- Nullable because a licence can be sold before they have ever signed up.
  user_id uuid references auth.users(id) on delete set null,

  tier  text not null default 'enterprise'
        check (tier in ('free', 'starter', 'pro', 'enterprise')),
  seats integer check (seats is null or seats > 0),

  -- Deliberately separate from licence expiry. A lapsed licence should not
  -- necessarily cut off downloads (they may be renewing), and a suspended
  -- customer should not get new builds even if their key is still in date.
  downloads_enabled boolean not null default true,

  status text not null default 'active'
         check (status in ('active', 'suspended', 'churned')),

  notes text,

  -- ------- the currently-issued licence -------
  -- Denormalised onto the customer so the admin list is one query and one
  -- read tells you "are they covered right now". The full history is in
  -- selfhost_license_issues; this is just the newest row, copied.
  --
  -- The key itself is stored so it can be RE-SENT without re-issuing. That
  -- matters: re-issuing bumps `iat`, and lib/license.ts refuses a key whose
  -- iat is older than the installed one, so casually minting a replacement to
  -- "resend it" is how you strand a customer mid-renewal.
  license_id         uuid,
  license_key        text,
  license_issued_at  timestamptz,
  license_expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.selfhost_customers enable row level security;

create index if not exists selfhost_customers_expiry_idx
  on public.selfhost_customers (license_expires_at)
  where status = 'active';

create index if not exists selfhost_customers_user_idx
  on public.selfhost_customers (user_id)
  where user_id is not null;

-- The downloads page falls back to matching on email when a customer bought
-- before signing up, so this is a lookup path, not just a uniqueness wish.
create index if not exists selfhost_customers_email_idx
  on public.selfhost_customers (lower(contact_email));

-- ------------------------------------------------------------ licence issues --
-- Every key we have ever signed. Append-only in practice: a licence that was
-- put in a customer's hands is a fact, and superseding it does not unmake it.
-- This is what answers "what exactly did we send them in March?" during a
-- support call, and it is the audit trail for a signing key we can never
-- rotate cheaply.
create table if not exists public.selfhost_license_issues (
  id uuid primary key default gen_random_uuid(),

  customer_id uuid not null references public.selfhost_customers(id) on delete cascade,

  -- The `lid` inside the signed payload, so a support ticket quoting a licence
  -- id from an install's Settings → Licence page can be traced back here.
  license_id uuid not null,
  license_key text not null,

  tier  text not null,
  seats integer,
  issued_at  timestamptz not null default now(),
  expires_at timestamptz not null,

  -- 'new' | 'renewal' | 'change' — why this key exists, for the timeline.
  reason text not null default 'new',

  -- Which signing key signed it. When k1 is eventually rotated, this is how we
  -- find every licence in the field that still depends on the old public half.
  kid text not null default 'k1',

  -- Who minted it, for accountability on a page that mints money.
  issued_by uuid references auth.users(id) on delete set null
);

alter table public.selfhost_license_issues enable row level security;

create index if not exists selfhost_license_issues_customer_idx
  on public.selfhost_license_issues (customer_id, issued_at desc);

-- ---------------------------------------------------------------- releases --
-- Bundle metadata. The bundle itself is a multi-hundred-megabyte tarball in
-- Vercel Blob; this row is the catalogue entry that the downloads page renders
-- and the download route resolves.
--
-- Written by the release workflow after it uploads, so cutting a tag is still
-- the single action that publishes a build.
create table if not exists public.selfhost_releases (
  version text primary key,

  -- Where the tarball actually is. Kept as a full URL rather than a key so a
  -- future move off Blob does not need a migration.
  blob_url   text not null,
  size_bytes bigint,

  -- Repeated from the bundle's own manifest so the page can show the checksum
  -- a customer should verify against WITHOUT downloading the bundle first.
  sha256 text not null,

  changelog text,

  channel text not null default 'stable'
          check (channel in ('stable', 'beta')),

  -- A build we have pulled. Yanking hides it from the downloads page and stops
  -- the download route resolving it, without destroying the record of it
  -- having existed — some customer out there may already be running it.
  yanked boolean not null default false,

  published_at timestamptz not null default now()
);

alter table public.selfhost_releases enable row level security;

create index if not exists selfhost_releases_published_idx
  on public.selfhost_releases (published_at desc)
  where not yanked;

-- ----------------------------------------------------------- download log --
-- Who fetched which build, and when. Support triage for a self-hosted customer
-- opens with "what version are you on?", and the honest answer is often "the
-- one they downloaded, not the one they think" — this table is how that gets
-- checked without asking them to run commands on a machine we cannot see.
--
-- Written best-effort: a failure here is swallowed rather than blocking a
-- download (see app/api/downloads/[version]/route.ts).
create table if not exists public.selfhost_download_log (
  id uuid primary key default gen_random_uuid(),

  customer_id uuid references public.selfhost_customers(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  version     text not null,

  downloaded_at timestamptz not null default now()
);

alter table public.selfhost_download_log enable row level security;

create index if not exists selfhost_download_log_customer_idx
  on public.selfhost_download_log (customer_id, downloaded_at desc);
