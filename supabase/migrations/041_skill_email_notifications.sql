-- Per-user preference for emailed skill-run summaries. In-app notifications
-- (the bell) are always created; this only controls the optional email channel.
--   off      = never email
--   failures = email only when a skill run fails (default — high signal, low noise)
--   all      = email on every completed run too
alter table public.profiles
  add column if not exists email_skill_notifications text
  not null default 'failures'
  check (email_skill_notifications in ('off', 'failures', 'all'));
