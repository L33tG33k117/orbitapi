-- ============================================================
-- 055 — Contact form submissions
-- ============================================================
-- The public /contact form used to be a prop: it waited 800ms and claimed
-- success without sending anything anywhere. Every enquiry, including
-- "Talk to sales" clicks from the Enterprise plan, was silently dropped.
--
-- Persisting first and notifying second is deliberate. Email delivery is
-- best-effort (Resend may be unconfigured, or fail); the database row is the
-- record of truth, so a lead can never be lost just because email is down.
--
-- Written via the service-role API from /api/contact; read by super admins.
-- RLS on with no policies = locked to the service role, same as `feedback`.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  email text not null,
  message text not null,

  -- Where the enquiry came from: the ?subject= param on /contact. Enterprise
  -- and self-hosted leads are worth far more than general questions, so they
  -- need to be sortable rather than buried in one undifferentiated list.
  subject text not null default 'general',

  -- Best-effort attribution: set when a signed-in user submits the form.
  user_id uuid references auth.users(id) on delete set null,

  status text not null default 'new' check (status in ('new', 'replied', 'closed')),

  -- Did the notification email actually go out? Lets the admin UI be honest
  -- about whether anyone was told, rather than assuming.
  notified boolean not null default false,

  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

-- The common admin view is "unanswered sales leads first".
create index if not exists contact_messages_status_subject_idx
  on public.contact_messages (status, subject);
