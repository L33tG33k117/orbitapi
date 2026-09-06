-- ============================================================
-- 057 — Self-service: revocation, renewal requests, check-in
-- ============================================================
-- 056 gave us a ledger. This makes the relationship two-way: the customer can
-- serve themselves, and we can withdraw a licence.
--
-- ⚠️ Read this before touching revocation:
--
-- Revoking a licence CANNOT reach an air-gapped installation. Licences are
-- verified locally against an embedded public key with no network call — that
-- is what makes the offline edition work at all. Revoking has two real effects:
--
--   1. Immediately: downloads and self-service licence retrieval stop.
--   2. Eventually: we don't issue the next renewal, so their key runs out and
--      automation collapses to the free floor 30 days later.
--
-- The optional check-in below closes that gap for installs that DO have
-- internet, which is most of them — "self-hosted" usually means "our hardware",
-- not "no network". It is a licence-enforcement lever, not a security boundary:
-- a customer who controls the server can block the check-in, and expiry is what
-- actually bounds the damage. Do not build anything on the assumption that a
-- revoked install will definitely find out.

-- ------------------------------------------------------- customer: revoke --
alter table public.selfhost_customers
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_reason text;

-- ---------------------------------------------- customer: renewal request --
-- The customer's "I want to renew" button. Deliberately a request and not a
-- transaction: money stays a conversation, but the mechanics of asking should
-- not require finding the right person's email address.
alter table public.selfhost_customers
  add column if not exists renewal_requested_at timestamptz,
  add column if not exists renewal_note text;

-- Partial index: the admin view is "who is waiting on me", which is almost
-- always a handful of rows out of the whole table.
create index if not exists selfhost_customers_renewal_idx
  on public.selfhost_customers (renewal_requested_at)
  where renewal_requested_at is not null;

-- --------------------------------------------------- customer: check-in ----
-- What the install last told us. All nullable: an air-gapped customer never
-- reports anything and must not look broken because of it.
alter table public.selfhost_customers
  add column if not exists last_checkin_at timestamptz,
  add column if not exists last_seen_version text,
  -- Their install_id from instance_settings (054). Lets support tie a support
  -- bundle to a customer without either side handling the licence key.
  add column if not exists install_id uuid;

create index if not exists selfhost_customers_checkin_idx
  on public.selfhost_customers (last_checkin_at desc)
  where last_checkin_at is not null;

-- ============================================================
-- Install side (self-hosted database only — cloud leaves this empty)
-- ============================================================
-- Check-in state on the single instance_settings row from 054.
--
-- `checkin_enabled` defaults TRUE, and that default is a product decision worth
-- stating: an install that can reach us should learn that an update exists and
-- that its licence was withdrawn. An air-gapped install fails the call
-- harmlessly and carries on. The toggle is in Settings → Licence for anyone who
-- would rather it never called out at all.
alter table instance_settings
  add column if not exists checkin_enabled boolean not null default true,
  add column if not exists last_checkin_at timestamptz,

  -- 'ok' | 'revoked' | 'unreachable' | null. Advisory only: entitlements are
  -- still decided by the signed licence in lib/license.ts. A cached 'revoked'
  -- narrows what the instance grants, but a *missing* or 'unreachable' result
  -- can never widen or narrow anything — otherwise losing internet would
  -- silently change what a customer's installation does.
  add column if not exists checkin_status text,
  add column if not exists checkin_message text,

  -- The newest release the cloud knows about, so Settings → Updates can say
  -- "1.3.0 is available" instead of "check this folder".
  add column if not exists latest_version text;
